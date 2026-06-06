import { connectDatabase, disconnectDatabase } from "../config/db";
import { env } from "../config/env";
import { demoUsers, ensureDemoUsers } from "./demoUsers";

/**
 * Seeds three demo accounts (one per role). Safe to run multiple times.
 * Default password for all demo accounts: `password123`.
 */
async function run() {
  await connectDatabase();
  if (env.DB_MOCK_MODE) {
    console.warn(
      "[seed] MOCK_MODE active — seeded data lives only in the in-memory DB for this process."
    );
  }

  await ensureDemoUsers();

  console.log("\n[seed] done. Demo logins:");
  demoUsers.forEach((u) => console.log(`  - ${u.email} / password123  (${u.role})`));

  await disconnectDatabase();
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
