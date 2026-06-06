import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import documentRoutes from "./documentRoutes";
import verificationRoutes from "./verificationRoutes";
import auditRoutes from "./auditRoutes";
import dashboardRoutes from "./dashboardRoutes";
import { env } from "../config/env";
import { blockchain } from "../services/blockchainService";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "SIGCHAIN-UAD backend",
    time: new Date().toISOString(),
    dbMock: env.DB_MOCK_MODE,
    blockchain: blockchain.config(),
  });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/documents", documentRoutes);
router.use("/verify", verificationRoutes);
router.use("/audit", auditRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
