import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../src/app";
import { connectDatabase } from "../src/config/db";
import { env } from "../src/config/env";
import { ensureDemoUsers } from "../src/seed/demoUsers";

// Vercel serverless entrypoint. The Express app is created once per warm
// instance; the DB connection is established lazily and cached.
const app = createApp();
let bootstrapped: Promise<void> | null = null;

async function bootstrap() {
  await connectDatabase();
  if (env.DB_MOCK_MODE) {
    await ensureDemoUsers(false);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!bootstrapped) bootstrapped = bootstrap().catch((e) => {
    bootstrapped = null;
    throw e;
  });
  await bootstrapped;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
