import { createClient } from "redis";

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

let redisClient: ReturnType<typeof createClient> | null = null;
let redisAvailable = false;

function cleanMemoryStore() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt < now) memoryStore.delete(key);
  }
}

async function initRedis() {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });

    client.on("error", () => {
      // Suppress repeated errors — already handled by the initial connect failure
    });

    await client.connect();
    redisClient = client;
    redisAvailable = true;
    console.log("Connected to Redis for Session Storage");
  } catch {
    console.warn(
      "[Session] Redis unavailable — using in-memory session storage (sessions will not persist across restarts)"
    );
    redisAvailable = false;
  }
}

// Initialize once on module load
initRedis();

async function redisGet(key: string): Promise<string | null> {
  if (redisAvailable && redisClient) {
    return redisClient.get(key);
  }
  cleanMemoryStore();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.value;
}

async function redisSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  if (redisAvailable && redisClient) {
    await redisClient.setEx(key, ttlSeconds, value);
    return;
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function connectRedis() {
  // No-op: connection is handled at module init
}

export async function getHistory(sessionId: string): Promise<any[]> {
  try {
    const data = await redisGet(`chat_history:${sessionId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(sessionId: string, history: any[]) {
  try {
    // Keep only last 6 messages (3 turns) to stay within TPM limits
    const trimmed = history.slice(-6).map((msg: any) => ({
      ...msg,
      // Truncate very long messages to avoid token overflow
      content: typeof msg.content === "string" && msg.content.length > 400
        ? msg.content.slice(0, 400) + "…"
        : msg.content,
    }));
    await redisSetEx(`chat_history:${sessionId}`, 7200, JSON.stringify(trimmed));
  } catch (err) {
    console.error("Failed to save history:", err);
  }
}

export async function getContext(sessionId: string): Promise<any> {
  try {
    const data = await redisGet(`chat_context:${sessionId}`);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function saveContext(sessionId: string, context: any) {
  try {
    await redisSetEx(`chat_context:${sessionId}`, 7200, JSON.stringify(context));
  } catch (err) {
    console.error("Failed to save context:", err);
  }
}
