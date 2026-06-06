import { expect } from "chai";
import { ethers } from "hardhat";
import { DocumentSignatureRegistry } from "../typechain-types";

const HASH_A = "a".repeat(64); // fake SHA-256 hex
const HASH_B = "b".repeat(64);

describe("DocumentSignatureRegistry", () => {
  let registry: DocumentSignatureRegistry;
  let signerAddr: string;

  beforeEach(async () => {
    const [deployer] = await ethers.getSigners();
    signerAddr = deployer.address;
    const Factory = await ethers.getContractFactory("DocumentSignatureRegistry");
    registry = (await Factory.deploy()) as unknown as DocumentSignatureRegistry;
    await registry.waitForDeployment();
  });

  it("stores a document hash and emits events", async () => {
    await expect(registry.storeDocumentHash(HASH_A, signerAddr))
      .to.emit(registry, "DocumentStored")
      .and.to.emit(registry, "DocumentSigned");
  });

  it("verifies an existing document hash as true", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    expect(await registry.verifyDocument(HASH_A)).to.equal(true);
  });

  it("verifies an unknown document hash as false", async () => {
    expect(await registry.verifyDocument(HASH_B)).to.equal(false);
  });

  it("returns the stored signer", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    expect(await registry.getSigner(HASH_A)).to.equal(signerAddr);
  });

  it("returns full document data", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    const [signer, timestamp, blockNumber, exists] = await registry.getDocumentData(HASH_A);
    expect(signer).to.equal(signerAddr);
    expect(timestamp).to.be.greaterThan(0n);
    expect(blockNumber).to.be.greaterThan(0n);
    expect(exists).to.equal(true);
  });

  it("rejects storing the same hash twice (immutability)", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    await expect(registry.storeDocumentHash(HASH_A, signerAddr)).to.be.revertedWith(
      "HASH_ALREADY_EXISTS"
    );
  });

  it("rejects empty hash and zero signer", async () => {
    await expect(registry.storeDocumentHash("", signerAddr)).to.be.revertedWith("EMPTY_HASH");
    await expect(registry.storeDocumentHash(HASH_A, ethers.ZeroAddress)).to.be.revertedWith(
      "ZERO_SIGNER"
    );
  });

  it("tracks total documents and enumerates hashes", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    await registry.storeDocumentHash(HASH_B, signerAddr);
    expect(await registry.totalDocuments()).to.equal(2n);
    expect(await registry.hashAt(0)).to.equal(HASH_A);
    expect(await registry.hashAt(1)).to.equal(HASH_B);
  });

  it("emits DocumentVerified on attestVerification", async () => {
    await registry.storeDocumentHash(HASH_A, signerAddr);
    await expect(registry.attestVerification(HASH_A)).to.emit(registry, "DocumentVerified");
  });
});
