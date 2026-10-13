import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export interface OnChainRecord {
  exists: boolean;
  signer: string | null;
  blockNumber: number | null;
  timestamp: number | null; // unix seconds
}

export interface StoreResult {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  mock: boolean;
}

// ---------------------------------------------------------------------------
// Mock in-memory chain (used when RPC/contract are not configured)
// ---------------------------------------------------------------------------
interface MockEntry {
  signer: string;
  blockNumber: number;
  timestamp: number;
  txHash: string;
}
const mockRegistry = new Map<string, MockEntry>();
let mockBlock = 7_000_000;

function randomHex(bytes: number): string {
  return (
    "0x" +
    Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  );
}

// ---------------------------------------------------------------------------
// Real chain (ethers v6)
// ---------------------------------------------------------------------------
let provider: ethers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;

function loadAbi(): ethers.InterfaceAbi {
  const abiPath = path.join(__dirname, "..", "blockchain", "abi.json");
  if (fs.existsSync(abiPath)) {
    return JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  }
  // Minimal fallback ABI matching the contract surface.
  return [
    "function storeDocumentHash(string documentHash, address signer) external",
    "function verifyDocument(string documentHash) external view returns (bool)",
    "function getSigner(string documentHash) external view returns (address)",
    "function getDocumentData(string documentHash) external view returns (address signer, uint256 timestamp, uint256 blockNumber, bool exists)",
    "function totalDocuments() external view returns (uint256)",
    "event DocumentStored(string indexed documentHashIndexed, string documentHash, address indexed signer, uint256 blockNumber, uint256 timestamp)",
  ];
}

function getContract(): ethers.Contract {
  if (contract) return contract;
  provider = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL, env.CHAIN_ID);
  contract = new ethers.Contract(env.CONTRACT_ADDRESS, loadAbi(), provider);
  return contract;
}

export const blockchain = {
  isMock(): boolean {
    return env.CHAIN_MOCK_MODE;
  },

  config() {
    return {
      mock: env.CHAIN_MOCK_MODE,
      chainId: env.CHAIN_ID,
      contractAddress: env.CONTRACT_ADDRESS || null,
      blockExplorer: env.BLOCK_EXPLORER,
      recordingMethod: "server_wallet",
      signingReady: env.CHAIN_MOCK_MODE || Boolean(env.BLOCKCHAIN_PRIVATE_KEY),
    };
  },

  /**
   * Simulate an on-chain store. Receipts are explicitly marked as mock.
   */
  storeMock(hash: string, signer: string): StoreResult {
    if (!mockRegistry.has(hash)) {
      mockBlock += 1;
      mockRegistry.set(hash, {
        signer: signer.toLowerCase(),
        blockNumber: mockBlock,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: randomHex(32),
      });
    }
    const entry = mockRegistry.get(hash)!;
    return {
      transactionHash: entry.txHash,
      blockNumber: entry.blockNumber,
      timestamp: entry.timestamp,
      mock: true,
    };
  },

  /** Read a document record from chain (or mock). */
  async getRecord(hash: string): Promise<OnChainRecord> {
    if (env.CHAIN_MOCK_MODE) {
      const e = mockRegistry.get(hash);
      return {
        exists: !!e,
        signer: e?.signer ?? null,
        blockNumber: e?.blockNumber ?? null,
        timestamp: e?.timestamp ?? null,
      };
    }
    const c = getContract();
    const [signer, timestamp, blockNumber, exists] = await c.getDocumentData(hash);
    return {
      exists: Boolean(exists),
      signer: exists ? String(signer) : null,
      blockNumber: exists ? Number(blockNumber) : null,
      timestamp: exists ? Number(timestamp) : null,
    };
  },

  async verify(hash: string): Promise<boolean> {
    if (env.CHAIN_MOCK_MODE) return mockRegistry.has(hash);
    const c = getContract();
    return Boolean(await c.verifyDocument(hash));
  },

  /** Record using the backend wallet; the authenticated approver is in the DB/audit trail. */
  async storeServer(
    hash: string,
    approvalMessage: string,
    pendingTransactionHash: string | undefined,
    onSubmitted: (transactionHash: string, walletAddress: string) => Promise<void>
  ): Promise<StoreResult & { walletAddress: string; signature: string }> {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw ApiError.badRequest("Hash PDF final tidak valid");
    if (env.CHAIN_MOCK_MODE) {
      const walletAddress = "0x1111111111111111111111111111111111111111";
      return { ...this.storeMock(hash, walletAddress), walletAddress, signature: `demo:${approvalMessage}` };
    }
    if (!env.BLOCKCHAIN_PRIVATE_KEY) {
      throw new ApiError(503, "Wallet pencatat server belum dikonfigurasi. Isi BLOCKCHAIN_PRIVATE_KEY pada backend.");
    }
    const c = getContract();
    const p = provider!;
    let wallet: ethers.Wallet;
    try {
      wallet = new ethers.Wallet(env.BLOCKCHAIN_PRIVATE_KEY, p);
    } catch {
      throw new ApiError(503, "Konfigurasi wallet pencatat server tidak valid");
    }
    const walletAddress = wallet.address.toLowerCase();
    const network = await p.getNetwork();
    if (network.chainId !== BigInt(env.CHAIN_ID)) {
      throw new ApiError(503, "RPC blockchain tidak sesuai dengan CHAIN_ID backend");
    }
    const signature = await wallet.signMessage(approvalMessage);
    let txHash = pendingTransactionHash;
    if (!txHash) {
      // A previous process may have submitted before saving its receipt. Recover
      // the exact event/transaction rather than submitting the same hash twice.
      const record = await this.getRecord(hash);
      if (record.exists) {
        if (record.signer?.toLowerCase() !== walletAddress || record.blockNumber == null) {
          throw ApiError.conflict("Hash sudah dicatat oleh wallet lain; pencatatan tidak dapat diklaim oleh server");
        }
        const logs = await c.queryFilter(c.filters.DocumentStored(), record.blockNumber, record.blockNumber);
        const log = logs.find(item => item instanceof ethers.EventLog && item.args.documentHash === hash);
        if (!log) throw ApiError.conflict("Bukti transaksi untuk hash yang sudah tercatat tidak ditemukan");
        txHash = log.transactionHash;
        await onSubmitted(txHash, walletAddress);
      } else {
        // Serialize submissions sharing a wallet so concurrent documents do not
        // obtain the same pending nonce. Confirmation remains outside the queue.
        await withSubmissionQueue(async () => {
          const writable = c.connect(wallet) as ethers.Contract;
          const networkNonce = await p.getTransactionCount(wallet.address, "pending");
          // JSON-RPC providers may briefly cache the pending nonce. Keep the
          // next accepted nonce locally as well while this wallet is shared.
          const nonce = Math.max(networkNonce, nextNonces.get(walletAddress) ?? networkNonce);
          const tx = await writable.storeDocumentHash(hash, wallet.address, { nonce });
          nextNonces.set(walletAddress, nonce + 1);
          txHash = tx.hash;
          await onSubmitted(tx.hash, walletAddress);
        });
      }
    }
    let result: StoreResult;
    try {
      result = await this.confirmTransaction(txHash!, hash, walletAddress);
    } catch (error) {
      const receipt = await p.getTransactionReceipt(txHash!).catch(() => null);
      if (receipt?.status === 0) {
        // A reverted transaction cannot be resumed; allow a fresh submission.
        await onSubmitted("", walletAddress);
      }
      throw error;
    }
    return { ...result, walletAddress, signature };
  },

  /**
   * Confirm the exact registry transaction, including sender, target and hash.
   */
  async confirmTransaction(txHash: string, expectedHash: string, expectedWallet: string): Promise<StoreResult> {
    const p = provider || new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL, env.CHAIN_ID);
    provider = p;
    // Poll each receipt independently. Shared provider block listeners can
    // miss a fast local block while several confirmations start together.
    const deadline = Date.now() + 120_000;
    let receipt: ethers.TransactionReceipt | null = null;
    while (Date.now() < deadline) {
      receipt = await p.getTransactionReceipt(txHash);
      if (receipt) break; // Inclusion is one confirmation, as in the previous flow.
      await new Promise(resolve => setTimeout(resolve, 1_500));
    }
    if (!receipt) throw new Error("Transaction not found / not mined within timeout");
    if (receipt.status === 0) throw new Error("Transaction reverted on-chain");
    if (receipt.to?.toLowerCase() !== env.CONTRACT_ADDRESS.toLowerCase() ||
        receipt.from.toLowerCase() !== expectedWallet.toLowerCase()) {
      throw ApiError.badRequest("Transaksi bukan dari wallet dan kontrak pencatat yang diharapkan");
    }
    const c = getContract();
    const matches = receipt.logs.some(log => {
      if (log.address.toLowerCase() !== env.CONTRACT_ADDRESS.toLowerCase()) return false;
      try {
        const event = c.interface.parseLog(log);
        return event?.name === "DocumentStored" && event.args.documentHash === expectedHash &&
          String(event.args.signer).toLowerCase() === expectedWallet.toLowerCase();
      } catch { return false; }
    });
    if (!matches) throw ApiError.badRequest("Transaksi tidak memuat bukti pencatatan hash PDF final ini");
    const block = await p.getBlock(receipt.blockNumber);
    if (!block) throw new Error("Block metadata unavailable; retry confirmation");
    return {
      transactionHash: txHash,
      blockNumber: receipt.blockNumber,
      timestamp: block.timestamp,
      mock: false,
    };
  },
};

let submissionQueue: Promise<void> = Promise.resolve();
const nextNonces = new Map<string, number>();
async function withSubmissionQueue<T>(operation: () => Promise<T>): Promise<T> {
  const previous = submissionQueue;
  let release!: () => void;
  submissionQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}
