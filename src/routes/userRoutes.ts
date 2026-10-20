import express from "express";
import {
  createUser,
  deleteUser,
  getUserById,
  getAllUsers,
  getEmployees,
  loginUser,
  logoutUser,
  updateUser,
  updateUserPassword,
} from "../controllers/userController";
import middleware from "../utils/middleware";
import { authLimiter, userCreationLimiter } from "../utils/rateLimiter";
import { get } from "http";

const router = express.Router();

router.get(
  "/",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  middleware.rejectManualUserId,
  getEmployees
);
router.get(
  "/all",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  middleware.rejectManualUserId,
  getAllUsers
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
router.post("/logout", logoutUser);
// Must be registered before "/:user_id", otherwise that param route matches
// "update-password" first and rejects non-admins.
router.put(
  "/update-password",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  middleware.rejectManualUserId,
  updateUserPassword
);
router.put(
  "/:user_id",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  middleware.rejectManualUserId,
  updateUser
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
