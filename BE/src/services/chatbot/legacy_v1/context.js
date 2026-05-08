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

function shouldClearRoomType(nluResult) {
  const raw = String(nluResult?.rawText || "").toLowerCase();
  return (
    nluResult?.intent === "alternative" &&
    !nluResult?.entities?.room_type &&
    /(loại khác|hạng khác|kiểu khác|phòng khác|gợi ý khác|xem thêm)/.test(raw)
  );
}

function getPriceAdjustment(nluResult, ctx = {}) {
  const raw = String(nluResult?.rawText || "").toLowerCase();
  const hasExplicitPrice = Boolean(nluResult?.entities?.min_price || nluResult?.entities?.max_price);
  if (hasExplicitPrice) return null;

  if (/(giá\s*)?(cao hơn|cao hơn nữa|đắt hơn|mắc hơn|xịn hơn|tốt hơn)/.test(raw)) {
    const base = ctx.max_price || ctx.min_price;
    return {
      min_price: base || null,
      max_price: null,
      sort_by: "price_asc",
      budget_label: "higher",
    };
  }

  if (/(giá\s*)?(thấp hơn|rẻ hơn|rẻ hơn nữa|mềm hơn)/.test(raw)) {
    const base = ctx.min_price || ctx.max_price;
    return {
      min_price: null,
      max_price: base || null,
      sort_by: "price_desc",
      budget_label: "lower",
    };
  }

  return null;
}

export async function updateContext(ctx, nluResult) {
  const nlu = nluResult?.entities || {};
  let merged = { ...defaultContext, ...(ctx || {}) };

  const clearRoomType = shouldClearRoomType(nluResult);
  const priceAdjustment = getPriceAdjustment(nluResult, merged);

  if (clearRoomType) {
    merged.room_type = null;
    merged.room_type_id = null;
    merged.room_type_name = null;
    merged.capacity = null;
  }

  // 1. Merge input mới trực tiếp (trừ các key cần xử lý qua rule)
  for (let key in nlu) {
    if (nlu[key] !== null && nlu[key] !== undefined && key !== 'room_type' && key !== 'people' && key !== 'amenities') {
      merged[key] = nlu[key];
    }
  }

  if (nlu.amenities) {
    const amRows = await mapAmenities(nlu.amenities);
    const amenityIds = amRows.map((r) => r.amenity_id);
    merged.amenity_ids = [...new Set([...(merged.amenity_ids || []), ...amenityIds])];
    merged.amenities = [...new Set([...(merged.amenities || []), ...nlu.amenities])];
  }

  // 2. RULE: room_type → people
  if (nlu.room_type) {
    const rt = await mapRoomType(nlu.room_type);
    if (rt) {
      merged.room_type_id = rt.type_id;
      merged.room_type_name = rt.name;
      merged.capacity = rt.capacity ?? merged.capacity;
      merged.room_type = nlu.room_type; // Cập nhật room type
      
      // Override số người nếu user đổi room_type mà không kèm số người mới
      if (!nlu.people) {
        if (nlu.room_type === "Single" || rt.name.includes("Single")) merged.people = 1;
        else if (nlu.room_type === "Double" || rt.name.includes("Double")) merged.people = 2;
        else if (nlu.room_type === "Family" || rt.name.includes("Family")) merged.people = 4;
        else if (rt.capacity) merged.people = rt.capacity;
      }
    }
  }

  // 3. RULE: Nếu user nói số người → clear room_type nếu mâu thuẫn
  if (nlu.people) {
    merged.people = nlu.people; // Luôn ưu tiên số người mới nhất
    if (
      (nlu.people === 1 && merged.room_type !== "Single" && !String(merged.room_type_name).includes("Single")) ||
      (nlu.people === 2 && merged.room_type !== "Double" && !String(merged.room_type_name).includes("Double")) ||
      (nlu.people >= 4 && merged.room_type !== "Family" && !String(merged.room_type_name).includes("Family"))
    ) {
      merged.room_type = null;
      merged.room_type_id = null;
      merged.room_type_name = null;
      merged.capacity = null;
    }
  }

  if (nlu.sort_by) {
    merged.preferences = (merged.preferences || []).filter((pref) => !["budget", "best_value"].includes(pref));
  }
  
  merged.preferences =
    Array.isArray(nlu.preferences) && nlu.preferences.length > 0
      ? [...new Set([...(merged.preferences || []), ...nlu.preferences])]
      : merged.preferences || [];
      
  merged.min_price = priceAdjustment ? priceAdjustment.min_price : (nlu.min_price ?? merged.min_price);
  merged.max_price = priceAdjustment ? priceAdjustment.max_price : (nlu.max_price ?? merged.max_price);
  merged.intent = nluResult?.intent ?? merged.intent;
  
  if (!clearRoomType && !merged.room_type && merged.room_type_name) {
    merged.room_type = merged.room_type_name;
  }
  
  merged.sort_by = priceAdjustment?.sort_by ?? nlu.sort_by ?? merged.sort_by;
  merged.last_query = nluResult?.rawText?.trim?.() || merged.last_query;
  merged.budget_label = priceAdjustment?.budget_label ?? inferBudgetLabel(nlu) ?? merged.budget_label;
  if (merged.checkin && merged.checkout) {
    merged.nights = diffNights(merged.checkin, merged.checkout);
  }

  return merged;
}
