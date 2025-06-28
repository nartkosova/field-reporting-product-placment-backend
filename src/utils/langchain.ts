import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";

const openAI = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
});

export const conversationChain = new ConversationChain({
  llm: openAI,
});
