/**
 * db.js — Khởi tạo ChatOllama (Local LLM) + MySQL pool cho chatbot
 * Model: llama3.2:3b tại http://localhost:11434
 */
import { ChatOllama } from "@langchain/ollama";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ override: true });

// ── Local LLM (Ollama) ────────────────────────────────────────────────────────
export const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model:   process.env.OLLAMA_MODEL    || "llama3.2:3b",
  temperature: 0,          // temperature=0 → không tự bịa thông tin
  format: "json",          // ép output JSON để dễ parse
});

// Biến thể không ép JSON — dùng cho intent detection
export const llmText = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model:   process.env.OLLAMA_MODEL    || "llama3.2:3b",
  temperature: 0,
});

// ── MySQL pool ────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "localhost",
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME     || "smart_hotel",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

// Ping DB lúc khởi động
if (process.env.DISABLE_DB_PING !== "1") {
  pool.getConnection()
    .then((conn) => {
      console.log("✅ [Chatbot DB] MySQL Connected:", process.env.DB_NAME);
      conn.release();
    })
    .catch((err) => console.error("❌ [Chatbot DB] MySQL Error:", err.message));
}

export default pool;
