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
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin"]),
  createUser
);
router.post("/login", loginUser);
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
