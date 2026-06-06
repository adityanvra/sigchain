/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_CHAIN_NAME: string;
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_BLOCK_EXPLORER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
