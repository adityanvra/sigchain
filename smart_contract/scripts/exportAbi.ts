import { artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Standalone ABI exporter. Run `npm run export-abi` after `npm run compile`
 * to copy the latest ABI to the backend and frontend without redeploying.
 */
async function main() {
  const artifact = artifacts.readArtifactSync("DocumentSignatureRegistry");
  const targets = [
    path.join(__dirname, "..", "..", "backend", "src", "blockchain"),
    path.join(__dirname, "..", "..", "frontend", "src", "blockchain"),
  ];
  for (const dir of targets) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "abi.json"), JSON.stringify(artifact.abi, null, 2));
    console.log(`ABI exported to ${dir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
