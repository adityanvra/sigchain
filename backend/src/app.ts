import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "./config/env";
import api from "./routes";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  // Security headers (XSS, clickjacking, etc.). crossOriginResourcePolicy is
  // relaxed so the frontend (different origin) can fetch PDF previews & QR PNGs.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes("*")) {
          return cb(null, true);
        }
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // NoSQL-injection / operator sanitization.
  app.use(mongoSanitize());

  if (env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.use("/api", apiLimiter, api);

  app.get("/", (_req, res) => res.json({ success: true, message: "SIGCHAIN-UAD API" }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
