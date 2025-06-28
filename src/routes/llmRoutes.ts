import express from "express";
import { getAIResponse } from "../controllers/llmController";
import middleware from "../utils/middleware";

const router = express.Router();

router.post(
  "/response",
  middleware.authorizeRole(["admin", "employee"]),
  getAIResponse
);

export default router;
