import { Router } from "express";
import {
  getMySignature,
  getMySignatureImage,
  getSignatureImage,
  uploadSignature,
  deleteSignature,
} from "../controllers/academicSignatureController";
import { authenticate, authorize } from "../middleware/auth";
import { uploadImageMemory } from "../middleware/upload";

const router = Router();

router.use(authenticate);

// Get current user's active signature metadata (no image)
router.get("/my", getMySignature);

// Serve the current user's active signature image (PNG)
router.get("/my/image", getMySignatureImage);

// Serve a specific signature image (owner or admin)
router.get("/:id/image", getSignatureImage);

// Upload new signature image (replaces existing active)
router.post(
  "/",
  authorize("staff_akademik", "admin"),
  uploadImageMemory.single("image"),
  uploadSignature
);

// Delete a specific signature
router.delete("/:id", authorize("staff_akademik", "admin"), deleteSignature);

export default router;
