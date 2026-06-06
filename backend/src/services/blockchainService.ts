import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { env } from "../config/env";

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
    };
  },

  /**
   * Simulate an on-chain store. Only used in MOCK mode (real mode stores happen
   * in the browser via MetaMask). Returns a fake but well-formed receipt.
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

  /**
   * Confirm a real MetaMask transaction: wait for the receipt and return block
   * metadata. Throws if the tx failed or cannot be found.
   */
  async confirmTransaction(txHash: string): Promise<StoreResult> {
    const p = provider || new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL, env.CHAIN_ID);
    provider = p;
    const receipt = await p.waitForTransaction(txHash, 1, 120_000);
    if (!receipt) throw new Error("Transaction not found / not mined within timeout");
    if (receipt.status === 0) throw new Error("Transaction reverted on-chain");
    const block = await p.getBlock(receipt.blockNumber);
    return {
      transactionHash: txHash,
      blockNumber: receipt.blockNumber,
      timestamp: block?.timestamp ?? Math.floor(Date.now() / 1000),
      mock: false,
    };
  },
};
