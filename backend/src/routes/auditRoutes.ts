import { Router } from "express";
import { listAudit, myAudit } from "../controllers/auditController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/", listAudit);
router.get("/me", myAudit);

export default router;
