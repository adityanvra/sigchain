export type UserRole = "admin" | "staff_akademik" | "staff_administrasi";

export interface User {
  _id: string;
  nama: string;
  email: string;
  role: UserRole;
  walletAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type DocStatus = "SIGNED" | "UNSIGNED";

export interface DocumentItem {
  _id: string;
  namaDokumen: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hashDokumen: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  blockchainTimestamp?: string | null;
  status: DocStatus;
  uploader: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureItem {
  _id: string;
  documentId: string;
  signer: User | string;
  walletAddress: string;
  signature: string;
  transactionHash?: string | null;
  blockNumber?: number | null;
  timestamp: string;
}

export interface AuditItem {
  _id: string;
  userId?: User | string | null;
  aktivitas: string;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: string;
}

export interface DashboardStats {
  stats: { total: number; signed: number; unsigned: number };
  recentDocuments: DocumentItem[];
  recentActivity: AuditItem[];
}

export interface VerifyResult {
  valid: boolean;
  status: "VALID" | "TIDAK VALID";
  hash: string;
  onChain: {
    exists: boolean;
    signer: string | null;
    blockNumber: number | null;
    timestamp: number | null;
    explorer: string | null;
  };
  document: {
    id: string;
    namaDokumen: string;
    status: DocStatus;
    transactionHash?: string | null;
    blockNumber?: number | null;
    blockchainTimestamp?: string | null;
    uploader?: User;
    createdAt?: string;
  } | null;
  signatures: SignatureItem[];
  mock: boolean;
}

export interface BlockchainConfig {
  mock: boolean;
  chainId: number;
  contractAddress: string | null;
  blockExplorer: string;
}
