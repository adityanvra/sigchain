import { Router } from "express";
import {
  login,
  register,
  me,
  updateProfile,
  logout,
  loginSchema,
  registerSchema,
  profileSchema,
} from "../controllers/authController";
import { validateBody } from "../middleware/validate";
import { authenticate, authorize } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/login", authLimiter, validateBody(loginSchema), login);
// Public self-registration is disabled in production usage; admins create users.
// Kept here (admin-only) so the very first admin can be bootstrapped via seed.
router.post("/register", authenticate, authorize("admin"), validateBody(registerSchema), register);
router.get("/me", authenticate, me);
router.put("/profile", authenticate, validateBody(profileSchema), updateProfile);
router.post("/logout", authenticate, logout);

export default router;
