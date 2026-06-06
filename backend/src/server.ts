import { createApp } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { blockchain } from "./services/blockchainService";
import { ensureDemoUsers } from "./seed/demoUsers";

async function bootstrap() {
  await connectDatabase();

  // In mock mode the in-memory DB starts empty — auto-seed demo accounts so the
  // app is immediately usable without a separate seed step.
  if (env.DB_MOCK_MODE) {
    const created = await ensureDemoUsers(false);
    if (created > 0) console.log(`[seed] auto-seeded ${created} demo account(s) (password: password123)`);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log("============================================================");
    console.log(` SIGCHAIN-UAD backend listening on http://localhost:${env.PORT}`);
    console.log(`  env           : ${env.NODE_ENV}`);
    console.log(`  DB mock mode  : ${env.DB_MOCK_MODE}`);
    console.log(`  chain mock    : ${blockchain.isMock()}`);
    if (!blockchain.isMock()) {
      console.log(`  contract      : ${env.CONTRACT_ADDRESS} (chainId ${env.CHAIN_ID})`);
    }
    console.log("============================================================");
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
