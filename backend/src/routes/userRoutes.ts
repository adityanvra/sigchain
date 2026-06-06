import { Router } from "express";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  createUserSchema,
  updateUserSchema,
} from "../controllers/userController";
import { authenticate, authorize } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/", listUsers);
router.post("/", validateBody(createUserSchema), createUser);
router.put("/:id", validateBody(updateUserSchema), updateUser);
router.delete("/:id", deleteUser);

export default router;
