import { ethers, network, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log(`\nDeploying DocumentSignatureRegistry to network: ${network.name}`);

  const Factory = await ethers.getContractFactory("DocumentSignatureRegistry");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const tx = contract.deploymentTransaction();
  const receipt = tx ? await tx.wait() : null;

  console.log("------------------------------------------------------------");
  console.log(`DocumentSignatureRegistry deployed at: ${address}`);
  console.log(`Tx hash                              : ${tx?.hash ?? "n/a"}`);
  console.log(`Block                                : ${receipt?.blockNumber ?? "n/a"}`);
  console.log("------------------------------------------------------------\n");

  // Persist deployment metadata.
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(
      {
        network: network.name,
        address,
        txHash: tx?.hash ?? null,
        blockNumber: receipt?.blockNumber ?? null,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  // Export ABI to backend & frontend so they always stay in sync.
  exportAbi(address);
}

function exportAbi(address: string) {
  const artifact = artifacts.readArtifactSync("DocumentSignatureRegistry");
  const targets = [
    path.join(__dirname, "..", "..", "backend", "src", "blockchain"),
    path.join(__dirname, "..", "..", "frontend", "src", "blockchain"),
  ];
  for (const dir of targets) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "abi.json"), JSON.stringify(artifact.abi, null, 2));
      fs.writeFileSync(
        path.join(dir, "contract-address.json"),
        JSON.stringify({ address }, null, 2)
      );
      console.log(`ABI + address exported to ${dir}`);
    } catch (err) {
      console.warn(`Could not export ABI to ${dir}:`, (err as Error).message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
