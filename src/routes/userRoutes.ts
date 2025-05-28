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
  getUsers,
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"])
);
router.post(
  "/",
  createUser,
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"])
);
router.post("/login", loginUser);
router.put(
  "/update-password",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  updateUserPassword
);

export default router;
//middleware.tokenExtractor, middleware.authenticateToken, middleware.userExtractor,
