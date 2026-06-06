import { Router } from "express";
import { dashboardStats } from "../controllers/dashboardController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/stats", dashboardStats);

export default router;
