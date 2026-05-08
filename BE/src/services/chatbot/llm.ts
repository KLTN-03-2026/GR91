import { ChatGroq } from "@langchain/groq";
import * as dotenv from "dotenv";
dotenv.config();

export const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  // llama-4-scout: 30K TPM free tier — đủ cho tool definitions + conversation
  model: "meta-llama/llama-4-scout-17b-16e-instruct",
  temperature: 0,
  maxRetries: 2,
  maxTokens: 1024,
});
