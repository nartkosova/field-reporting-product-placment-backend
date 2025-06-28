import { Request, Response } from "express";
import { conversationChain } from "../utils/langchain";

export const getAIResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { input } = req.body;
    if (!input) {
      res.status(400).json({ error: "Input is required" });
      return;
    }

    const result = await conversationChain.call({ input });

    res.json({ message: result.response });
  } catch (error) {
    console.error("Error with AI response:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
