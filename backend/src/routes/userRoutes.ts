import { Router } from "express";
import {
  listUsers,
  listAkademisi,
  createUser,
  updateUser,
  deleteUser,
  createUserSchema,
  updateUserSchema,
} from "../controllers/userController";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

// Accessible to any authenticated user for assigning documents
router.get("/akademisi", authenticate, listAkademisi);

// Admin-only management endpoints
router.use(authenticate, authorize("admin"));

router.get("/", listUsers);
router.post("/", validateBody(createUserSchema), createUser);
router.put("/:id", validateBody(updateUserSchema), updateUser);
router.delete("/:id", deleteUser);

export default router;
