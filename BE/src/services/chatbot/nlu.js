/**
 * NLU - Natural Language Understanding
 * Chuẩn hóa và extract entities từ input tiếng Việt cho chatbot đặt phòng
 */

import { addDays, formatLocalDate, fromDayMonth, todayLocalDate } from "./date.js";

// ─── Từ điển ─────────────────────────────────────────────────────────────────
const ROOM_TYPE_MAP = {
  "phòng đôi": "đôi", "giường đôi": "đôi", "double": "đôi",
  "phòng 2 người": "đôi", "couple": "đôi", "2 vợ chồng": "đôi",
  "phòng đơn": "đơn", "giường đơn": "đơn", "single": "đơn", "phòng 1 người": "đơn",
  "phòng gia đình": "Family", "family": "Family", "gia đình": "Family",
  "phòng suite": "Suite", "suite": "Suite", "phòng sang": "Suite", "cao cấp": "Suite",
  "phòng deluxe": "Deluxe", "deluxe": "Deluxe",
  "phòng superior": "Superior", "superior": "Superior",
  "phòng standard": "Standard", "tiêu chuẩn": "Standard",
  "phòng rẻ": "Standard", "bình dân": "Standard", "tiết kiệm": "Standard",
  "phòng vip": "VIP", "vip": "VIP", "tổng thống": "VIP",
  "phòng executive": "Executive", "executive": "Executive",
  // View — dùng làm room_type search keyword
  "view biển": "biển", "hướng biển": "biển", "ra biển": "biển", "nhìn biển": "biển",
  "view hồ": "hồ", "hướng hồ": "hồ", "nhìn hồ": "hồ",
  "view thành phố": "thành phố", "city view": "thành phố", "nhìn phố": "thành phố",
  "view vườn": "vườn", "hướng vườn": "vườn",
  "view hồ bơi": "hồ bơi",
  // Tiện nghi — chỉ map khi không có keyword loại phòng nào khác
  "có bồn tắm": "bồn tắm", "jacuzzi": "jacuzzi",
};

const AMENITIES_MAP = {
  "bồn tắm": "bathtub", "jacuzzi": "jacuzzi", "ban công": "balcony",
  "hồ bơi": "pool", "view hồ bơi": "pool_view",
  "wifi": "wifi", "wifi miễn phí": "wifi",
  "ăn sáng": "breakfast", "bữa sáng": "breakfast",
  "máy lạnh": "aircon", "điều hòa": "aircon",
  "nhà hàng": "restaurant", "buffet": "buffet",
  "thang máy": "elevator", "gần thang máy": "elevator",
};

const PREFERENCE_MAP = {
  "yên tĩnh": "quiet",
  "đi công tác": "business",
  "công tác": "business",
  "du lịch với gia đình": "family_trip",
  "đi với gia đình": "family_trip",
  "gần thang máy": "near_elevator",
  "view đẹp": "nice_view",
  "đáng tiền": "best_value",
  "giá rẻ": "budget",
};

const PRICE_SORT_PATTERNS = {
  price_asc: /(rẻ nhất|giá thấp nhất|giá rẻ nhất|thấp nhất)/i,
  price_desc: /(đắt nhất|giá cao nhất|mắc nhất|cao nhất)/i,
};

const DATE_RELATIVE_MAP = {
  "hôm nay": 0, "tối nay": 0, "đêm nay": 0,
  "ngày mai": 1, "mai": 1, "sáng mai": 1,
  "ngày kia": 2, "mốt": 2,
  "3 ngày nữa": 3, "4 ngày nữa": 4, "5 ngày nữa": 5,
  "tuần sau": 7, "tuần tới": 7,
};

const DAY_OF_WEEK_MAP = {
  "thứ 2": 1, "thứ hai": 1,
  "thứ 3": 2, "thứ ba": 2,
  "thứ 4": 3, "thứ tư": 3,
  "thứ 5": 4, "thứ năm": 4,
  "thứ 6": 5, "thứ sáu": 5,
  "thứ 7": 6, "thứ bảy": 6,
  "chủ nhật": 0, "cn": 0,
};

export function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/nagyf|ngafy|ngayf/g, "ngày")
    .replace(/\bpax\b/g, "người")
    .replace(/\bnight(s)?\b/g, "đêm")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Price Parser ─────────────────────────────────────────────────────────────
function getMultiplier(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase();
  if (u.startsWith("tr")) return 1_000_000;
  if (u === "k" || u.includes("nghìn") || u.includes("ngàn")) return 1_000;
  return 1;
}

function parseNumericAmount(raw) {
  const normalized = String(raw || "").trim().replace(/\s+/g, "");
  if (!normalized) return NaN;

  const separators = [...normalized.matchAll(/[.,]/g)];
  if (separators.length === 1) {
    const separatorIndex = separators[0].index;
    const digitsAfter = normalized.length - separatorIndex - 1;
    if (digitsAfter > 0 && digitsAfter <= 2) {
      return Number(normalized.replace(",", "."));
    }
  }

  return Number(normalized.replace(/[.,]/g, ""));
}

function parseMoneyAmount(raw, unit) {
  const amount = parseNumericAmount(raw);
  if (!Number.isFinite(amount)) return null;

  if (unit) {
    return Math.round(amount * getMultiplier(unit));
  }

  // Trong ngữ cảnh hỏi giá phòng, số tròn 3-4 chữ số thường được nói tắt là nghìn.
  if (amount >= 100 && amount < 10_000) {
    return Math.round(amount * 1_000);
  }

  return Math.round(amount);
}

function parsePrice(text) {
  const lower = text.toLowerCase();

  // Bỏ qua nếu pattern nằm trong date range "từ 15/4 đến 18/4"
  const cleanedForPrice = lower
    .replace(/từ\s*\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s*(?:đến|tới|-)\s*\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, "")
    .replace(/(?:ngày|từ ngày)\s*\d{1,2}[\/\-]\d{1,2}/g, "");

  // Range: từ X đến Y (chỉ khi có đơn vị tiền)
  const rangeMatch = cleanedForPrice.match(/từ\s*(\d+[\d.,]*)\s*(tr(?:iệu)?|k|nghìn|ngàn)\s*(?:đến|tới|-)\s*(\d+[\d.,]*)\s*(tr(?:iệu)?|k|nghìn|ngàn)?/i);
  if (rangeMatch) {
    const min = parseMoneyAmount(rangeMatch[1], rangeMatch[2]);
    const max = parseMoneyAmount(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
    return { min, max };
  }

  // Dưới / tối đa
  const maxMatch = cleanedForPrice.match(/(?:dưới|tối đa|không quá)\s*(\d+[\d.,]*)\s*(tr(?:iệu)?|k|nghìn|ngàn)?/i);
  if (maxMatch) {
    return { max: parseMoneyAmount(maxMatch[1], maxMatch[2]) };
  }

  // Trên / từ (chỉ khi có đơn vị)
  const minMatch = cleanedForPrice.match(/(?:trên|tối thiểu)\s*(\d+[\d.,]*)\s*(tr(?:iệu)?|k|nghìn|ngàn)/i);
  if (minMatch) {
    return { min: parseMoneyAmount(minMatch[1], minMatch[2]) };
  }

  // Khoảng / tầm
  const approxMatch = cleanedForPrice.match(/(?:khoảng|tầm|xấp xỉ)\s*(\d+[\d.,]*)\s*(tr(?:iệu)?|k|nghìn|ngàn)?/i);
  if (approxMatch) {
    const val = parseMoneyAmount(approxMatch[1], approxMatch[2]);
    return { min: Math.round(val * 0.8), max: Math.round(val * 1.2) };
  }

  const barePriceMatch = cleanedForPrice.match(
    /(?:giá|ngân sách|budget)\s*(?:khoảng|tầm|xấp xỉ)?\s*(\d{3,6}(?:[.,]\d{1,2})?)\b/i
  );
  if (barePriceMatch) {
    return { max: parseMoneyAmount(barePriceMatch[1], null) };
  }

  // Giá đơn: X triệu, Xk — phải có đơn vị rõ ràng
  const singleMatch = cleanedForPrice.match(/(\d+[\d.,]*)\s*(tr(?:iệu)?|k(?:\b|$)|nghìn|ngàn)/i);
  if (singleMatch) {
    return { max: parseMoneyAmount(singleMatch[1], singleMatch[2]) };
  }

  return null;
}

// ─── People Parser ────────────────────────────────────────────────────────────
function parsePeople(text) {
  const lower = text.toLowerCase();
  let adults = null, children = null, childrenAges = [];

  // Người lớn
  const adultMatch = lower.match(/(\d+)\s*(?:người lớn|adult)/) ||
                     lower.match(/(\d+)\s*(?:người|khách|ng\b)/) ||
                     lower.match(/cho\s*(\d+)/);
  if (adultMatch) adults = parseInt(adultMatch[1]);

  // Trẻ em
  const childMatch = lower.match(/(\d+)\s*(?:trẻ em|trẻ|con|em bé|bé|child)/);
  if (childMatch) {
    children = parseInt(childMatch[1]);
    // Tuổi trẻ em: "1 bé 5 tuổi", "2 con 8 và 10 tuổi"
    const ageMatches = [...lower.matchAll(/(\d+)\s*tuổi/g)];
    childrenAges = ageMatches.map(m => parseInt(m[1])).filter(a => a < 18);
  }

  // Couple + con
  const coupleChild = lower.match(/couple\s*\+\s*(\d+)\s*con/);
  if (coupleChild) { adults = 2; children = parseInt(coupleChild[1]); }

  return { adults, children, childrenAges };
}

// ─── Date Parser ──────────────────────────────────────────────────────────────
function parseOneDate(text) {
  const lower = text.trim().toLowerCase();

  // Ngày cụ thể: dd/mm, dd-mm, dd/mm/yyyy
  const explicit = lower.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (explicit) {
    const d = parseInt(explicit[1]), m = parseInt(explicit[2]);
    let y = explicit[3] ? parseInt(explicit[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const date = fromDayMonth(d, m, y);
    if (date) return date;
  }

  // Tương đối
  for (const [key, offset] of Object.entries(DATE_RELATIVE_MAP)) {
    if (lower.includes(key)) {
      return addDays(todayLocalDate(), offset);
    }
  }

  // Chỉ có ngày trong tháng: "ngày 18", "18" (không có tháng/năm)
  const dayOnly = lower.match(/(?:^|\s)(?:ngày\s*)?(\d{1,2})(?:\s|$)/);
  if (dayOnly) {
    const day = parseInt(dayOnly[1], 10);
    if (day >= 1 && day <= 31) {
      const now = new Date();
      const year = now.getFullYear();
      let month = now.getMonth();
      const currentDay = now.getDate();
      // Nếu ngày đã qua trong tháng hiện tại, giả định tháng kế tiếp
      if (day < currentDay) month += 1;
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return formatLocalDate(date);
    }
  }

  // Cuối tuần
  if (lower.includes("cuối tuần")) {
    const d = new Date();
    const daysToSat = ((6 - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToSat);
    return formatLocalDate(d);
  }

  // Ngày trong tuần
  for (const [key, dayNum] of Object.entries(DAY_OF_WEEK_MAP)) {
    if (lower.includes(key)) {
      const d = new Date();
      const current = d.getDay();
      let diff = (dayNum - current + 7) % 7 || 7;
      if (lower.includes("tuần sau") || lower.includes("tuần tới")) diff += 7;
      d.setDate(d.getDate() + diff);
      return formatLocalDate(d);
    }
  }

  return null;
}

function resolveDayOnlyRange(startDay, endDay) {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let startMonth = currentMonth;
  if (startDay < currentDay) startMonth += 1;

  const checkinDate = new Date(year, startMonth, startDay);
  let checkoutDate = new Date(year, startMonth, endDay);
  if (checkoutDate <= checkinDate) {
    checkoutDate = new Date(year, startMonth + 1, endDay);
  }

  return {
    checkin: formatLocalDate(checkinDate),
    checkout: formatLocalDate(checkoutDate),
  };
}

function parseDateRange(text) {
  const lower = text.toLowerCase();

  // Range rõ ràng: "từ ... đến ..."
  const rangeMatch = lower.match(/(?:từ|ngày)\s+(.+?)\s+(?:đến|tới|->)\s+(.+?)(?:\s+|$)/i);
  if (rangeMatch) {
    const startText = rangeMatch[1].trim();
    const endText = rangeMatch[2].trim();
    const startDayOnly = startText.match(/^\d{1,2}$/);
    const endDayOnly = endText.match(/^\d{1,2}$/);

    if (startDayOnly && endDayOnly) {
      return resolveDayOnlyRange(parseInt(startDayOnly[0], 10), parseInt(endDayOnly[0], 10));
    }

    const checkin = parseOneDate(startText);
    const checkout = parseOneDate(endText);
    if (checkin && checkout) return { checkin, checkout };
  }

  // Range day-only: "từ ngày 18 đến ngày 19", "18 đến 19"
  const dayOnlyRange = lower.match(
    /(?:từ\s*)?(?:ngày\s*)?(\d{1,2})(?![\/\-.])\s*(?:đến|tới|-)\s*(?:ngày\s*)?(\d{1,2})(?![\/\-.])/
  );
  if (dayOnlyRange) {
    const d1 = parseInt(dayOnlyRange[1], 10);
    const d2 = parseInt(dayOnlyRange[2], 10);
    if (d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
      return resolveDayOnlyRange(d1, d2);
    }
  }

  // Range ngắn: "16 đến 19", "16-19" (mặc định theo tháng/năm hiện tại)
  const shortRange = lower.match(/(?:^|\s)(\d{1,2})\s*(?:đến|-)\s*(\d{1,2})(?:\s|$)/);
  if (shortRange) {
    const d1 = parseInt(shortRange[1], 10);
    const d2 = parseInt(shortRange[2], 10);
    if (d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
      return resolveDayOnlyRange(d1, d2);
    }
  }

  // Số đêm: "3 đêm", "2 ngày" — chỉ khi có từ khóa đêm/ngày/night rõ ràng
  const nightMatch = lower.match(/(\d+)\s*(?:đêm|night)/);
  const checkin = parseOneDate(lower);
  if (checkin && nightMatch) {
    const nights = parseInt(nightMatch[1]);
    return { checkin, checkout: addDays(checkin, nights) };
  }
  if (checkin) {
    return { checkin, checkout: addDays(checkin, 1) };
  }

  return null;
}

// ─── Room Type Parser ─────────────────────────────────────────────────────────
function parseRoomType(text) {
  const lower = text.toLowerCase();
  const isPriceRankingQuery =
    PRICE_SORT_PATTERNS.price_asc.test(lower) || PRICE_SORT_PATTERNS.price_desc.test(lower);
  const blockedKeywords = isPriceRankingQuery ? new Set(["phòng rẻ", "bình dân", "tiết kiệm"]) : new Set();

  // Ưu tiên match dài nhất, nhưng bỏ qua các key chỉ là "X người" vì đã có parsePeople
  const sorted = Object.entries(ROOM_TYPE_MAP)
    .filter(([k]) => !blockedKeywords.has(k))
    .filter(([k]) => !k.match(/^\d+\s*người$/))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, mapped] of sorted) {
    if (lower.includes(keyword)) return mapped;
  }
  return null;
}

// ─── Amenities Parser ─────────────────────────────────────────────────────────
function parseAmenities(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [key, val] of Object.entries(AMENITIES_MAP)) {
    if (lower.includes(key)) found.push(val);
  }
  return found.length ? found : null;
}

function parseFloor(text) {
  const lower = text.toLowerCase();
  const floorMatch =
    lower.match(/tầng\s*(\d{1,2})/) ||
    lower.match(/lầu\s*(\d{1,2})/) ||
    lower.match(/floor\s*(\d{1,2})/);

  let floor = null;
  if (floorMatch) floor = parseInt(floorMatch[1], 10);

  let floor_preference = null;
  if (lower.includes("tầng thấp") || lower.includes("lầu thấp")) floor_preference = "low";
  if (lower.includes("tầng cao") || lower.includes("lầu cao")) floor_preference = "high";
  if (lower.includes("tầng đẹp")) floor_preference = "high";

  return { floor, floor_preference };
}

function parsePreferences(text) {
  const lower = text.toLowerCase();
  return Object.entries(PREFERENCE_MAP)
    .filter(([key]) => lower.includes(key))
    .map(([, value]) => value);
}

function parseSortBy(text) {
  const lower = text.toLowerCase();
  if (PRICE_SORT_PATTERNS.price_desc.test(lower)) return "price_desc";
  if (PRICE_SORT_PATTERNS.price_asc.test(lower)) return "price_asc";
  return null;
}

// ─── Intent Detector ──────────────────────────────────────────────────────────
function detectIntent(text) {
  const lower = text.toLowerCase();
  if (/bạn có thể giúp gì|giúp gì cho tôi|hướng dẫn/.test(lower)) return "help";
  if (/hủy|cancel|huỷ/.test(lower)) return "cancel";
  if (/chỉnh sửa|thay đổi|update|modify|đổi ngày|đổi phòng|sửa thông tin/.test(lower)) return "modify";
  if (/so sánh|khác gì|tốt hơn|khác nhau/.test(lower)) return "compare";
  if (/chính sách|quy định|hủy phòng|hoàn tiền|check.in sớm/.test(lower)) return "policy";
  if (/khuyến mãi|khuyến mại|voucher|giảm giá|ưu đãi/.test(lower)) return "promotion";
  if (/thanh toán|trả tiền|momo|zalopay|chuyển khoản|thẻ/.test(lower)) return "payment";
  if (/booking của tôi|kiểm tra đặt phòng|tôi đã đặt phòng chưa|phòng của tôi là gì/.test(lower)) return "booking_info";
  if (/tiện ích khách sạn|khách sạn có gì|hồ bơi|gym|nhà hàng|đưa đón sân bay|cho thuê xe/.test(lower)) return "facility";
  if (/ở đâu|địa chỉ|gần biển|gần trung tâm|đậu xe|đỗ xe|dễ tìm/.test(lower)) return "location";
  if (/không đặt được phòng|lỗi thanh toán|không nhận được email|hỗ trợ gấp|gọi lễ tân/.test(lower)) return "support";
  if (/đánh giá|review|khách sạn có tốt không|xem đánh giá/.test(lower)) return "review";
  if (/đặt|book|chốt|xác nhận đặt|reservation/.test(lower)) return "book";
  if (/gợi ý khác|phòng khác|alternative|xem thêm/.test(lower)) return "alternative";
  if (/(^|\s)(xin chào|hello|hi|chào)(\s|$)/.test(lower)) return "greeting";
  if (/cảm ơn|thank/.test(lower)) return "thanks";
  return "search";
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function analyzeInput(text) {
  const normalized = normalizeText(text);
  const lower = normalized;

  const intent = detectIntent(lower);
  const priceInfo = parsePrice(lower);
  const peopleInfo = parsePeople(lower);
  const dateRange = parseDateRange(lower) || {};
  const room_type = parseRoomType(lower);
  const amenities = parseAmenities(lower);
  const floorInfo = parseFloor(lower);
  const preferences = parsePreferences(lower);
  const sort_by = parseSortBy(lower);

  const entities = {
    people: peopleInfo.adults,
    children: peopleInfo.children || null,
    childrenAges: peopleInfo.childrenAges.length ? peopleInfo.childrenAges : null,
    room_type,
    floor: floorInfo.floor,
    floor_preference: floorInfo.floor_preference,
    amenities,
    preferences: preferences.length > 0 ? preferences : null,
    sort_by,
    min_price: priceInfo?.min || null,
    max_price: priceInfo?.max || null,
    checkin: dateRange.checkin || null,
    checkout: dateRange.checkout || null,
  };

  // Enriched text inject vào prompt
  const tags = [];
  if (intent !== "search") tags.push(`[Intent: ${intent}]`);
  if (entities.people) tags.push(`[Người lớn: ${entities.people}]`);
  if (entities.children) {
    const ages = entities.childrenAges ? ` (${entities.childrenAges.join(", ")} tuổi)` : "";
    tags.push(`[Trẻ em: ${entities.children}${ages}]`);
  }
  if (entities.room_type) tags.push(`[Loại phòng: ${entities.room_type}]`);
  if (entities.floor) tags.push(`[Tầng: ${entities.floor}]`);
  if (entities.floor_preference) tags.push(`[Ưu tiên tầng: ${entities.floor_preference}]`);
  if (entities.amenities) tags.push(`[Tiện nghi: ${entities.amenities.join(", ")}]`);
  if (entities.preferences) tags.push(`[Sở thích: ${entities.preferences.join(", ")}]`);
  if (entities.sort_by) tags.push(`[Sắp xếp giá: ${entities.sort_by}]`);
  if (entities.min_price || entities.max_price) {
    const range = [
      entities.min_price ? `từ ${entities.min_price.toLocaleString("vi-VN")}đ` : "",
      entities.max_price ? `đến ${entities.max_price.toLocaleString("vi-VN")}đ` : "",
    ].filter(Boolean).join(" ");
    tags.push(`[Ngân sách: ${range}]`);
  }
  if (entities.checkin) tags.push(`[Check-in: ${entities.checkin}]`);
  if (entities.checkout) tags.push(`[Check-out: ${entities.checkout}]`);

  return {
    intent,
    entities,
    enrichedText: tags.length ? `${normalized}\n${tags.join(" ")}` : normalized,
    rawText: text,
  };
}
