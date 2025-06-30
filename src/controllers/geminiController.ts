import { Request, Response } from "express";
import { gemini } from "../utils/gemini";

export const generateGeminiResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ result: text });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to generate response" });
    return;
  }
};
