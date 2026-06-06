import dotenv from "dotenv";

dotenv.config();

function asInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MONGODB_URI = process.env.MONGODB_URI?.trim() || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL?.trim() || "";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS?.trim() || "";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: asInt(process.env.PORT, 5000),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  JWT_SECRET: process.env.JWT_SECRET || "dev_insecure_secret_change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  MONGODB_URI,

  SEPOLIA_RPC_URL,
  CHAIN_ID: asInt(process.env.CHAIN_ID, 11155111),
  CONTRACT_ADDRESS,
  BLOCK_EXPLORER: process.env.BLOCK_EXPLORER || "https://sepolia.etherscan.io",

  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
  MAX_UPLOAD_MB: asInt(process.env.MAX_UPLOAD_MB, 15),

  PUBLIC_VERIFY_URL: process.env.PUBLIC_VERIFY_URL || "http://localhost:5173/verify",

  /** When DB or chain credentials are missing we fall back to in-memory mocks. */
  get DB_MOCK_MODE(): boolean {
    return !MONGODB_URI;
  },
  get CHAIN_MOCK_MODE(): boolean {
    return !SEPOLIA_RPC_URL || !CONTRACT_ADDRESS;
  },
};

export type Env = typeof env;
