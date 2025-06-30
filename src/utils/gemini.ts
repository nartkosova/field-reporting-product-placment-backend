import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "./config";

if (!config.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

export const gemini = new GoogleGenerativeAI(config.GEMINI_API_KEY); 