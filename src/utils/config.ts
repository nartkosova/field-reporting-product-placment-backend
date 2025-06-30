import dotenv from "dotenv";
dotenv.config();

export default {
  PORT: 3000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};
