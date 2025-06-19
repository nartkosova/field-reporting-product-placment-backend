import express from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  loginUser,
  updateUser,
  updateUserPassword,
} from "../controllers/userController";
import middleware from "../utils/middleware";
import { authLimiter, userCreationLimiter } from "../utils/rateLimiter";

const router = express.Router();

router.get(
  "/",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  middleware.rejectManualUserId,
  getUsers
);
router.get(
  "/:user_id",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  middleware.rejectManualUserId,
  getUserById
);
router.post(
  "/",
  userCreationLimiter,
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  createUser
);
router.post("/login", authLimiter, loginUser);
router.put(
  "/:user_id",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  middleware.rejectManualUserId,
  updateUser
);
router.put(
  "/update-password",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  middleware.rejectManualUserId,
  updateUserPassword
);
router.delete(
  "/:user_id",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  deleteUser
);
export default router;
