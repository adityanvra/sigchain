export const config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 11155111),
  chainName: import.meta.env.VITE_CHAIN_NAME || "Sepolia",
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || "",
  blockExplorer: import.meta.env.VITE_BLOCK_EXPLORER || "https://sepolia.etherscan.io",
};
