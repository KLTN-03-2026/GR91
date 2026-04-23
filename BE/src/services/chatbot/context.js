import db from "./db.js";
import { diffNights } from "./date.js";
import { defaultContext } from "./session.js";

export async function mapRoomType(name) {
  if (!name) return null;
  try {
    const [rows] = await db.execute(
      "SELECT type_id, name, capacity FROM room_types WHERE name LIKE ? ORDER BY type_id LIMIT 1",
      [`%${name}%`]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function mapAmenities(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  try {
    const placeholders = list.map(() => "?").join(", ");
    const [rows] = await db.execute(
      `SELECT amenity_id, name FROM amenities WHERE name IN (${placeholders})`,
      list
    );
    return rows;
  } catch {
    return [];
  }
}

function inferBudgetLabel(nlu = {}) {
  if (nlu.sort_by === "price_asc") return "cheap";
  if (nlu.sort_by === "price_desc") return "premium";
  if (Array.isArray(nlu.preferences) && nlu.preferences.includes("budget")) return "cheap";
  if (Array.isArray(nlu.preferences) && nlu.preferences.includes("best_value")) return "value";
  if (nlu.max_price && nlu.max_price <= 700_000) return "cheap";
  if (nlu.max_price && nlu.max_price >= 1_500_000) return "premium";
  if (nlu.max_price) return "mid";
  return null;
}

export async function updateContext(ctx, nluResult) {
  const nlu = nluResult?.entities || {};
  const merged = { ...defaultContext, ...(ctx || {}) };

  if (nlu.room_type) {
    const rt = await mapRoomType(nlu.room_type);
    if (rt) {
      merged.room_type_id = rt.type_id;
      merged.room_type_name = rt.name;
      merged.capacity = rt.capacity ?? merged.capacity;
    }
  }

  if (nlu.amenities) {
    const amRows = await mapAmenities(nlu.amenities);
    const amenityIds = amRows.map((r) => r.amenity_id);
    merged.amenity_ids = [...new Set([...(merged.amenity_ids || []), ...amenityIds])];
    merged.amenities = [...new Set([...(merged.amenities || []), ...nlu.amenities])];
  }

  merged.people = nlu.people ?? merged.people;
  merged.checkin = nlu.checkin ?? merged.checkin;
  merged.checkout = nlu.checkout ?? merged.checkout;
  merged.floor = nlu.floor ?? merged.floor;
  merged.floor_preference = nlu.floor_preference ?? merged.floor_preference;
  if (nlu.sort_by) {
    merged.sort_by = nlu.sort_by;
    merged.room_type = nlu.room_type ?? null;
    merged.room_type_id = nlu.room_type ? merged.room_type_id : null;
    merged.room_type_name = nlu.room_type ? merged.room_type_name : null;
    merged.preferences = (merged.preferences || []).filter((pref) => !["budget", "best_value"].includes(pref));
  }
  merged.preferences =
    Array.isArray(nlu.preferences) && nlu.preferences.length > 0
      ? [...new Set([...(merged.preferences || []), ...nlu.preferences])]
      : merged.preferences || [];
  merged.min_price = nlu.min_price ?? merged.min_price;
  merged.max_price = nlu.max_price ?? merged.max_price;
  merged.intent = nluResult?.intent ?? merged.intent;
  merged.room_type = nlu.room_type ?? merged.room_type ?? merged.room_type_name;
  merged.sort_by = nlu.sort_by ?? merged.sort_by;
  merged.last_query = nluResult?.rawText?.trim?.() || merged.last_query;
  merged.budget_label = inferBudgetLabel(nlu) ?? merged.budget_label;
  if (merged.checkin && merged.checkout) {
    merged.nights = diffNights(merged.checkin, merged.checkout);
  }

  return merged;
}
