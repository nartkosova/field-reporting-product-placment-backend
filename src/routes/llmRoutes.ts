import express from "express";
import { getAIResponse } from "../controllers/llmController";
import middleware from "../utils/middleware";

const router = express.Router();

router.post("/response", getAIResponse);

export default router;
