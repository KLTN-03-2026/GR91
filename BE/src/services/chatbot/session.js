import { createClient } from "redis";
import { diffNights } from "./date.js";
import pool from "./db.js";

const redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
let useRedis = false;

redisClient.on("error", () => {});

export async function connectRedis() {
  try {
    // Timeout 3 giây để không block server startup
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    useRedis = true;
    console.log("✅ Redis Connected!");
  } catch {
    console.log("⚠️ Redis không chạy, dùng Memory RAM.");
  }
}

const memStore = {};
const memContextStore = {};
const TTL = 7200; // 2 giờ

export const defaultContext = {
  user_id: null,
  checkin: null,
  checkout: null,
  nights: null,
  people: null,
  room_type_id: null,
  room_type_name: null,
  capacity: null,
  floor: null,
  floor_preference: null,
  preferences: [],
  sort_by: null,
  min_price: null,
  max_price: null,
  amenities: [],
  amenity_ids: [],
  intent: null,
  last_query: null,
  budget_label: null,
};

export async function getHistory(sessionId) {
  if (useRedis) {
    try {
      const data = await redisClient.get(`hist:${sessionId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  return memStore[sessionId] || [];
}

export async function saveHistory(sessionId, history) {
  // Giữ tối đa 20 messages để tránh context quá dài
  const trimmed = history.slice(-20);
  if (useRedis) {
    await redisClient.set(`hist:${sessionId}`, JSON.stringify(trimmed), { EX: TTL });
  } else {
    memStore[sessionId] = trimmed;
  }
}

async function ensureDbSession(sessionId, userId = null) {
  await pool.execute(
    `INSERT INTO chatbot_sessions (session_id, user_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = COALESCE(VALUES(user_id), user_id)`,
    [sessionId, userId]
  );
}

export async function saveChatTurn(sessionId, userMessage, botMessage, userId = null) {
  try {
    await ensureDbSession(sessionId, userId);
    await pool.execute(
      "INSERT INTO chatbot_messages (session_id, sender, message) VALUES (?, 'USER', ?), (?, 'BOT', ?)",
      [sessionId, userMessage, sessionId, botMessage || ""]
    );
  } catch (err) {
    console.warn("[Chatbot Session] Không thể lưu MySQL chat log:", err.message);
  }
}

function normalizeContextPatch(patch = {}) {
  const checkin = patch.checkin ?? null;
  const checkout = patch.checkout ?? null;
  const nights =
    patch.nights ??
    (checkin && checkout ? diffNights(checkin, checkout) : null);

  return {
    user_id: patch.user_id ?? null,
    people: patch.people ?? null,
    children: patch.children ?? null,
    checkin,
    checkout,
    nights,
    room_type: patch.room_type ?? null,
    room_type_id: patch.room_type_id ?? null,
    room_type_name: patch.room_type_name ?? null,
    capacity: patch.capacity ?? null,
    floor: patch.floor ?? null,
    floor_preference: patch.floor_preference ?? null,
    preferences: Array.isArray(patch.preferences) ? patch.preferences : [],
    sort_by: patch.sort_by ?? null,
    min_price: patch.min_price ?? null,
    max_price: patch.max_price ?? null,
    amenities: Array.isArray(patch.amenities) ? patch.amenities : [],
    amenity_ids: Array.isArray(patch.amenity_ids) ? patch.amenity_ids : [],
    intent: patch.intent ?? null,
    last_query: patch.last_query ?? null,
    budget_label: patch.budget_label ?? null,
  };
}

export async function getContext(sessionId) {
  if (useRedis) {
    try {
      const data = await redisClient.get(`ctx:${sessionId}`);
      return data ? { ...defaultContext, ...JSON.parse(data) } : { ...defaultContext };
    } catch {
      return { ...defaultContext };
    }
  }
  return memContextStore[sessionId] || { ...defaultContext };
}

export async function saveContext(sessionId, contextPatch = {}) {
  const current = await getContext(sessionId);
  const normalizedPatch = normalizeContextPatch(contextPatch);
  const merged = {
    ...current,
    ...normalizedPatch,
    amenities:
      normalizedPatch.amenities.length > 0
        ? [...new Set([...(current.amenities || []), ...normalizedPatch.amenities])]
        : current.amenities || [],
    amenity_ids:
      normalizedPatch.amenity_ids.length > 0
        ? [...new Set([...(current.amenity_ids || []), ...normalizedPatch.amenity_ids])]
        : current.amenity_ids || [],
    preferences:
      normalizedPatch.preferences.length > 0
        ? [...new Set([...(current.preferences || []), ...normalizedPatch.preferences])]
        : current.preferences || [],
  };

  if (useRedis) {
    await redisClient.set(`ctx:${sessionId}`, JSON.stringify(merged), { EX: TTL });
  } else {
    memContextStore[sessionId] = merged;
  }
  return merged;
}
