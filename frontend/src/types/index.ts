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

export type DocStatus = "DRAFT" | "UNSIGNED" | "PENDING_BLOCKCHAIN" | "SIGNED";

export interface SignaturePosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  walletAddress?: string | null;
  status: DocStatus;
  uploader: User | string;
  assignedTo?: User | null;
  signaturePosition?: SignaturePosition | null;
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
  stats: {
    total: number;
    signed: number;
    unsigned: number;
    pendingBlockchain: number;
    draft: number;
  };
  recentDocuments: DocumentItem[];
  recentActivity: AuditItem[];
}

export interface VerifyResult {
  valid: boolean;
  status: "VALID" | "TIDAK VALID";
  hash: string | null;
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
    walletAddress?: string | null;
    uploader?: User;
    assignedTo?: User | null;
    signaturePosition?: SignaturePosition | null;
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

export interface AcademicSignature {
  _id: string;
  academicId: string;
  mimeType: string;
  fileName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
