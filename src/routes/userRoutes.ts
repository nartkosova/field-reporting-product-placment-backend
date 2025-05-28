import express from "express";
import {
  createUser,
  getUsers,
  loginUser,
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
router.post(
  "/",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  middleware.rejectManualUserId,
  createUser
);
router.post("/login", loginUser);
router.put(
  "/update-password",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  middleware.rejectManualUserId,
  updateUserPassword
);

export default router;
