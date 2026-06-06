import { BrowserProvider, Contract, Eip1193Provider } from "ethers";
import abi from "@/blockchain/abi.json";
import { config } from "./config";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!hasMetaMask()) throw new Error("MetaMask tidak terdeteksi. Silakan pasang ekstensi MetaMask.");
  const provider = new BrowserProvider(window.ethereum!);
  const accounts = await provider.send("eth_requestAccounts", []);
  return (accounts[0] as string).toLowerCase();
}

const SEPOLIA_HEX = "0x" + config.chainId.toString(16);

export async function ensureChain(): Promise<void> {
  if (!hasMetaMask()) throw new Error("MetaMask tidak terdeteksi");
  const provider = new BrowserProvider(window.ethereum!);
  const network = await provider.getNetwork();
  if (Number(network.chainId) === config.chainId) return;

  try {
    await window.ethereum!.request?.({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX }],
    });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 4902) {
      await window.ethereum!.request?.({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_HEX,
            chainName: config.chainName,
            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: [config.blockExplorer],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

/** Sign the document hash with the connected wallet (proof of intent). */
export async function signHashMessage(hash: string): Promise<{ address: string; signature: string }> {
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const address = (await signer.getAddress()).toLowerCase();
  const message = `SIGCHAIN-UAD\nMenandatangani dokumen dengan hash:\n0x${hash}`;
  const signature = await signer.signMessage(message);
  return { address, signature };
}

/**
 * Anchor the document hash on-chain through MetaMask. Returns the tx hash.
 * Requires VITE_CONTRACT_ADDRESS to be configured (real blockchain mode).
 */
export async function storeHashOnChain(hash: string, signerAddress: string): Promise<string> {
  if (!config.contractAddress) {
    throw new Error("Alamat kontrak belum dikonfigurasi (VITE_CONTRACT_ADDRESS).");
  }
  await ensureChain();
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const contract = new Contract(config.contractAddress, abi, signer);
  const tx = await contract.storeDocumentHash(hash, signerAddress);
  await tx.wait(1);
  return tx.hash as string;
}
