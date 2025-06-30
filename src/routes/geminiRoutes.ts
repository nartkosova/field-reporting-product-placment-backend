import { Router } from "express";
import { generateGeminiResponse } from "../controllers/geminiController";

const router = Router();

router.post("/generate", generateGeminiResponse);

export default router;
