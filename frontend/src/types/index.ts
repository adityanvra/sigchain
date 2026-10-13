export type UserRole = "admin" | "staff_akademik" | "staff_administrasi" | "mahasiswa";

export interface User {
  _id: string;
  nama: string;
  email: string;
  role: UserRole;
  jabatan?: string[];
  unit?: string;
  nim?: string;
  capacities?: string[];
  walletAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type DocStatus = "DRAFT" | "UNSIGNED" | "SUBMITTED" | "READY_TO_SIGN" | "PARTIALLY_SIGNED" | "PENDING_APPROVAL" | "NEEDS_REVISION" | "REJECTED" | "PENDING_BLOCKCHAIN" | "SIGNED";

export interface SigningStep { signer: User | string; capacity: string; status: "WAITING" | "READY" | "APPLIED" | "APPROVED"; position?: SignaturePosition; approvedAt?: string; hash?: string; }

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
  recordingMethod?: "browser_wallet" | "server_wallet" | "account_approval";
  uploader: User | string;
  assignedTo?: User | null;
  reviewer?: User | string | null;
  signingSteps?: SigningStep[];
  currentStep?: number;
  version?: number;
  previousVersionId?: string;
  supersededBy?: string;
  reviewReason?: string;
  documentType?: string;
  hasRequestFile?: boolean;
  signaturePosition?: SignaturePosition | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureItem {
  _id: string;
  documentId: string;
  signer: User | string;
  walletAddress: string | null;
  signature: string;
  recordingMethod?: "browser_wallet" | "server_wallet" | "account_approval";
  capacity?: string;
  stepIndex?: number;
  approvalMessage?: string;
  approvedAt?: string;
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
  status: "VALID" | "TIDAK VALID" | "TIDAK TERDAFTAR" | "BELUM SELESAI" | "GAGAL DIPERIKSA";
  outcome?: "MATCH" | "DIFFERENT" | "NOT_REGISTERED" | "PENDING" | "NETWORK_ERROR";
  reason?: string;
  referenceHash?: string | null;
  checkedFile?: boolean;
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
    version?: number;
    supersededBy?: string;
    previousVersionId?: string;
    status: DocStatus;
    transactionHash?: string | null;
    blockNumber?: number | null;
    blockchainTimestamp?: string | null;
    walletAddress?: string | null;
    recordingMethod?: "browser_wallet" | "server_wallet" | "account_approval";
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
