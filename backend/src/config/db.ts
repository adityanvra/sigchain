import mongoose from "mongoose";
import { env } from "./env";

let memoryServerStarted = false;

/**
 * Connects to MongoDB. When MONGODB_URI is not configured we transparently spin
 * up an in-memory MongoDB (mongodb-memory-server) so the entire backend keeps
 * working for demos without any external account. If that package is not
 * installed, we throw a helpful error.
 */
export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  if (!env.DB_MOCK_MODE) {
    await mongoose.connect(env.MONGODB_URI, { dbName: undefined });
    console.log("[db] connected to MongoDB Atlas");
    return;
  }

  // MOCK MODE — try to use an in-memory mongo instance.
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    memoryServerStarted = true;
    await mongoose.connect(mongod.getUri(), { dbName: "sigchain" });
    console.warn(
      "[db] MOCK_MODE: connected to in-memory MongoDB (data is NOT persisted across restarts)"
    );
  } catch (err) {
    console.error(
      "[db] MONGODB_URI is empty and mongodb-memory-server is unavailable.\n" +
        "     Set MONGODB_URI in backend/.env, or run `npm i -D mongodb-memory-server`."
    );
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServerStarted) {
    // memory server process is cleaned up automatically on exit
  }
}
