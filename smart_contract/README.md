# SIGCHAIN-UAD — Smart Contract

`DocumentSignatureRegistry.sol` — registry hash dokumen di **Ethereum Sepolia**.
Dibangun dengan **Solidity 0.8.24 + Hardhat + TypeScript + Ethers v6**.

## Perintah

```bash
cd smart_contract
npm install
cp .env.example .env          # isi SEPOLIA_RPC_URL + PRIVATE_KEY (wallet test!)

npm run compile               # kompilasi
npm test                      # 9 unit test (Mocha + Chai)
npm run deploy:sepolia        # deploy ke Sepolia + export ABI ke backend & frontend
npm run deploy:local          # deploy ke node lokal (npm run node dulu)
npm run verify:sepolia <addr> # verifikasi source di Etherscan (opsional)
```

Setelah deploy, `scripts/deploy.ts` otomatis:

- menulis `deployments/sepolia.json` (address, txHash, blockNumber);
- menyalin ABI ke `backend/src/blockchain/abi.json` dan
  `frontend/src/blockchain/abi.json`;
- menyalin alamat kontrak ke `contract-address.json` di kedua folder.

Catat **alamat kontrak** → isi `CONTRACT_ADDRESS` (backend) dan
`VITE_CONTRACT_ADDRESS` (frontend).

## API kontrak

```solidity
function storeDocumentHash(string documentHash, address signer) external; // anchor + emit DocumentStored & DocumentSigned
function verifyDocument(string documentHash) external view returns (bool); // cek keberadaan
function getDocumentData(string documentHash) external view             // (signer, timestamp, blockNumber, exists)
    returns (address, uint256, uint256, bool);
function getSigner(string documentHash) external view returns (address);
function attestVerification(string documentHash) external returns (bool); // emit DocumentVerified
function totalDocuments() external view returns (uint256);
function hashAt(uint256 index) external view returns (string memory);
```

### Events

- `DocumentStored(string indexed, string, address indexed, uint256, uint256)`
- `DocumentSigned(string, address indexed, uint256)`
- `DocumentVerified(string, address indexed, bool, uint256)`

## Properti keamanan

- **Imutabilitas** — hash yang sama tidak dapat ditulis ulang (`require HASH_ALREADY_EXISTS`).
- **Privacy by design** — hanya hash SHA-256 yang naik ke chain; berkas PDF tetap di backend.
- Validasi `EMPTY_HASH` & `ZERO_SIGNER`.
