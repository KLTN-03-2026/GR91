/**
 * agent.js — SmartHotel Chatbot Agent
 * Sử dụng createReactAgent từ @langchain/langgraph
 * LLM: Ollama (llama3.2:3b) tại localhost:11434
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { llm, llmText } from "./db.js";
import { getHotelAmenitiesInfo, getRoomAmenitiesInfo, searchRoomsByAmenity, tools, searchRooms } from "./tools.js";
import { SYSTEM_PROMPT, INTENT_PROMPT } from "./prompt.js";
import { retrieveContext } from "./knowledge.js";
import { analyzeInput } from "./nlu.js";
import { updateContext } from "./context.js";
import { getContext, getHistory, saveChatTurn, saveContext, saveHistory } from "./session.js";

// ── Tạo ReAct Agent với tool binding ─────────────────────────────────────────
const agent = createReactAgent({
  llm,
  tools,
  messageModifier: SYSTEM_PROMPT,
});

// ── Helper: detect intent nhanh bằng keyword (tránh gọi LLM thêm) ────────────
function quickIntent(text) {
  const t = text.toLowerCase();
  if (/phòng|hòng|trống|còn phòng|tìm phòng|loại khác|hạng khác|kiểu khác|\d+\s*(người|ng\b)|đặt phòng/.test(t)) return "ask_availability";
  if (/giá phòng|bao nhiêu tiền|giá bao nhiêu|báo giá|giá\s*\d|giá cao hơn|cao hơn nữa|đắt hơn|mắc hơn|rẻ hơn/.test(t)) return "ask_price";
  if (/đơn đặt|booking|mã đặt|kiểm tra đặt/.test(t)) return "ask_booking";
  if (/check.?in|check.?out|nhận phòng|trả phòng|hủy|chính sách|tiện ích|wifi|ăn sáng/.test(t)) return "general_info";
  return null;
}

// ── Helper: parse JSON an toàn từ output LLM ─────────────────────────────────
function safeParseJSON(raw) {
  if (typeof raw !== "string") return null;
  // Tìm block JSON đầu tiên trong output
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeOptions(options) {
  if (typeof options === "string") return { sessionId: options };
  if (Array.isArray(options)) return { history: options };
  return options || {};
}

function toAgentMessages(history, currentMessage) {
  const previous = Array.isArray(history) ? history.slice(-8) : [];
  const messages = previous
    .map((item) => {
      const role = item.role || item.from || item.sender;
      const content = item.content || item.text || item.message || "";
      if (!content) return null;
      return role === "bot" || role === "assistant" || role === "BOT"
        ? new AIMessage(content)
        : new HumanMessage(content);
    })
    .filter(Boolean);
  messages.push(new HumanMessage(currentMessage));
  return messages;
}

function parseRoomsResult(rawResult) {
  try {
    const parsed = JSON.parse(rawResult);
    if (Array.isArray(parsed)) return { rooms: parsed };
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return { rooms: [] };
  }
  return { rooms: [] };
}

function buildCriteriaText(ctx) {
  const parts = [];
  if (ctx.checkin && ctx.checkout) parts.push(`từ ${ctx.checkin} đến ${ctx.checkout}`);
  if (ctx.people) parts.push(`${ctx.people} người`);
  if (ctx.room_type) parts.push(`loại ${ctx.room_type}`);
  if (ctx.floor) parts.push(`tầng ${ctx.floor}`);
  if (ctx.min_price) parts.push(`từ ${Number(ctx.min_price).toLocaleString("vi-VN")}đ`);
  if (ctx.max_price) parts.push(`dưới ${Number(ctx.max_price).toLocaleString("vi-VN")}đ`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function isAmenityQuestion(text) {
  const t = text.toLowerCase();
  return /(tiện ích|tiện nghi|có gì|trong phòng có|khách sạn có|wifi|điều hòa|máy lạnh|smart tv|mini bar|bồn tắm|ban công|hồ bơi|gym|spa|ăn sáng|buffet)/.test(t);
}

function wantsHotelAmenities(text) {
  const t = text.toLowerCase();
  return /(khách sạn|chung|dịch vụ|hồ bơi|gym|spa|ăn sáng|buffet)/.test(t) && !/(trong phòng|phòng\s*\d+|loại phòng|room)/.test(t);
}

function wantsRoomAmenities(text) {
  const t = text.toLowerCase();
  return /(trong phòng|phòng\s*\d+|loại phòng|room|phòng.*(có|gồm|tiện ích|tiện nghi)|wifi|điều hòa|máy lạnh|smart tv|mini bar|bồn tắm|ban công|giường)/.test(t);
}

function extractRoomNumber(text) {
  const match = text.match(/phòng\s*(\d{2,4})/i);
  return match ? match[1] : null;
}

function extractAmenityKeyword(text) {
  const t = text.toLowerCase();
  if (/bồn\s*tắm|bathtub|jacuzzi/.test(t)) return "bồn tắm";
  if (/ban\s*công|balcony/.test(t)) return "balcony";
  if (/mini\s*bar|minibar/.test(t)) return "mini bar";
  if (/wifi|wi-fi/.test(t)) return "wifi";
  if (/điều\s*hòa|máy\s*lạnh|air\s*conditioner/.test(t)) return "air conditioner";
  if (/smart\s*tv|\btv\b/.test(t)) return "tv";
  return null;
}

function wantsRoomsWithAmenity(text) {
  const t = text.toLowerCase();
  return /(phòng|hòng|room).*(có|co|gồm|gom)/.test(t) && Boolean(extractAmenityKeyword(text));
}

// ── Hàm chính: runAgent ───────────────────────────────────────────────────────
export async function runAgent(input, options = {}) {
  const opts = normalizeOptions(options);
  const sessionId = opts.sessionId || "default-session";
  const messageText = typeof input === "string" ? input : (input.message || "");
  const storedHistory = opts.history || await getHistory(sessionId);
  const storedContext = opts.context || await getContext(sessionId);
  const nluResult = analyzeInput(messageText);
  const mergedContext = await updateContext(
    { ...storedContext, user_id: opts.userId ?? storedContext.user_id ?? null },
    nluResult
  );

  const finish = async (result) => {
    const nextHistory = [
      ...storedHistory,
      { role: "user", content: messageText },
      { role: "bot", content: result.text || "" },
    ];
    await saveContext(sessionId, mergedContext);
    await saveHistory(sessionId, nextHistory);
    await saveChatTurn(sessionId, messageText, result.text || "", opts.userId ?? null);
    return result;
  };

  try {
    // 1. Detect intent (keyword-first, LLM fallback)
    let intent = quickIntent(messageText);
    if (!intent) {
      try {
        const intentRes = await llmText.invoke([
          new SystemMessage(INTENT_PROMPT),
          new HumanMessage(messageText),
        ]);
        intent = String(intentRes.content).trim().split(/\s/)[0];
      } catch (err) {
        console.warn("[Agent] Intent detection failed:", err.message);
        intent = "other";
      }
    }
    console.log(`[Agent] intent="${intent}" | message="${messageText.slice(0, 60)}"`);

    if (isAmenityQuestion(messageText)) {
      if (wantsHotelAmenities(messageText)) {
        return finish({ text: await getHotelAmenitiesInfo(), rooms: [] });
      }

      if (wantsRoomsWithAmenity(messageText)) {
        const result = await searchRoomsByAmenity({ amenity: extractAmenityKeyword(messageText) });
        return finish(result);
      }

      if (wantsRoomAmenities(messageText)) {
        return finish({
          text: await getRoomAmenitiesInfo({
            room_number: extractRoomNumber(messageText),
            room_type: mergedContext.room_type,
          }),
          rooms: [],
        });
      }

      return finish({
        text: `${await getRoomAmenitiesInfo({ room_type: mergedContext.room_type })}\n\n${await getHotelAmenitiesInfo()}`,
        rooms: [],
      });
    }

    if (nluResult.intent === "book" && !mergedContext.people && !mergedContext.checkin && !mergedContext.checkout) {
      return finish({
        text: "Để đặt phòng an toàn, anh/chị vui lòng mở phòng muốn đặt bằng nút \"Xem chi tiết\", chọn ngày nhận/trả phòng rồi tiếp tục thanh toán ở trang checkout. Em không tự tạo booking trực tiếp để tránh giữ phòng hoặc tính thanh toán sai.",
        rooms: [],
      });
    }

    // 2. general_info → dùng knowledge base (không cần LLM/tool)
    if (intent === "general_info" || ["greeting", "help", "policy", "payment", "facility", "location", "support", "promotion", "thanks"].includes(nluResult.intent)) {
      const ragAnswer = retrieveContext(messageText);
      if (ragAnswer) {
        return finish({ text: ragAnswer, rooms: [] });
      }
    }

    // 3. ask_availability / ask_price → gọi tool trực tiếp (nhanh hơn, chắc chắn hơn)
    const shouldSearch =
      intent === "ask_availability" ||
      intent === "ask_price" ||
      ["search", "alternative", "compare"].includes(nluResult.intent);

    if (shouldSearch) {
      const searchCriteria = {
        checkin: mergedContext.checkin,
        checkout: mergedContext.checkout,
        people: mergedContext.people,
        min_price: mergedContext.min_price,
        max_price: mergedContext.max_price,
        room_type: mergedContext.room_type,
        floor: mergedContext.floor,
        floor_preference: mergedContext.floor_preference,
        sort_by: mergedContext.sort_by,
      };

      console.log("[Agent] Gọi search_rooms:", searchCriteria);
      const rawResult = await searchRooms.invoke(searchCriteria);
      const parsedResult = parseRoomsResult(rawResult);
      const rooms = Array.isArray(parsedResult.rooms) ? parsedResult.rooms : [];

      // Nếu tool trả về lỗi object thay vì array
      if (parsedResult.error) {
        console.warn("[Agent] search_rooms trả về lỗi:", parsedResult);
        return finish({ text: "Xin lỗi, hệ thống đang gặp sự cố khi tìm phòng. Vui lòng thử lại sau.", rooms: [] });
      }

      if (rooms.length === 0) {
        const criteriaText = buildCriteriaText(mergedContext);
        return finish({
          text: `${parsedResult.reason || "Xin lỗi, hiện tại em chưa tìm được phòng phù hợp với yêu cầu của anh/chị."}${criteriaText}. Anh/chị có thể nới ngân sách, đổi ngày ở hoặc giảm bớt tiêu chí để em kiểm tra lại.`,
          rooms: [],
        });
      }

      if (parsedResult.match === "nearest") {
        const budgetText = mergedContext.max_price
          ? ` dưới ${Number(mergedContext.max_price).toLocaleString("vi-VN")}đ`
          : "";
        return finish({
          text: `Em chưa thấy phòng đúng mức${budgetText}${buildCriteriaText({ ...mergedContext, max_price: null })}. Đây là vài lựa chọn gần nhất để anh/chị tham khảo:`,
          rooms,
        });
      }

      const msg = `Em tìm được ${rooms.length} phòng phù hợp với yêu cầu của anh/chị${buildCriteriaText(mergedContext)}:`;
      console.log(`[Agent] Trả về ${rooms.length} phòng`);
      return finish({ text: msg, rooms });
    }

    // 4. ask_booking → gọi ReAct agent để dùng get_booking tool
    if (intent === "ask_booking") {
      const agentResult = await agent.invoke({
        messages: [new HumanMessage(messageText)],
      });

      const lastMsg = agentResult.messages?.at(-1);
      const rawContent = typeof lastMsg?.content === "string" ? lastMsg.content : "";
      const parsed = safeParseJSON(rawContent);

      return finish({
        text: parsed?.message || rawContent || "Xin lỗi, em chưa tìm được thông tin đặt phòng.",
        rooms: parsed?.rooms || [],
      });
    }

    // 5. other → ReAct agent xử lý tổng quát
    const agentResult = await agent.invoke({
      messages: toAgentMessages(storedHistory, nluResult.enrichedText || messageText),
    });

    const lastMsg = agentResult.messages?.at(-1);
    const rawContent = typeof lastMsg?.content === "string" ? lastMsg.content : "";
    const parsed = safeParseJSON(rawContent);

    // Nếu agent trả về JSON hợp lệ
    if (parsed?.message) {
      return finish({
        text: parsed.message,
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      });
    }

    // Fallback: trả về raw text
    return finish({
      text: rawContent || "Xin chào! Em có thể giúp gì cho anh/chị?",
      rooms: [],
    });

  } catch (err) {
    console.error("[Agent] Lỗi không xử lý được:", err.message);
    return finish({
      text: "Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
      rooms: [],
    });
  }
}
