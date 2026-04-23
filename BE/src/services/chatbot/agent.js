/**
 * agent.js — SmartHotel Chatbot Agent
 * Sử dụng createReactAgent từ @langchain/langgraph
 * LLM: Ollama (llama3.2:3b) tại localhost:11434
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { llm, llmText } from "./db.js";
import { tools, searchRooms } from "./tools.js";
import { SYSTEM_PROMPT, INTENT_PROMPT } from "./prompt.js";
import { retrieveContext } from "./knowledge.js";

// ── Tạo ReAct Agent với tool binding ─────────────────────────────────────────
const agent = createReactAgent({
  llm,
  tools,
  messageModifier: SYSTEM_PROMPT,
});

// ── Helper: detect intent nhanh bằng keyword (tránh gọi LLM thêm) ────────────
function quickIntent(text) {
  const t = text.toLowerCase();
  if (/phòng|trống|còn phòng|tìm phòng|\d+\s*(người|ng\b)|đặt phòng/.test(t)) return "ask_availability";
  if (/giá phòng|bao nhiêu tiền|giá bao nhiêu|báo giá/.test(t)) return "ask_price";
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

// ── Hàm chính: runAgent ───────────────────────────────────────────────────────
export async function runAgent(input, history = [], context = {}) {
  const messageText = typeof input === "string" ? input : (input.message || "");

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

    // 2. general_info → dùng knowledge base (không cần LLM/tool)
    if (intent === "general_info") {
      const ragAnswer = retrieveContext(messageText);
      if (ragAnswer) {
        return { text: ragAnswer, rooms: [] };
      }
    }

    // 3. ask_availability / ask_price → gọi tool trực tiếp (nhanh hơn, chắc chắn hơn)
    if (intent === "ask_availability" || intent === "ask_price") {
      // Trích xuất số người từ message
      const peopleMatch = messageText.match(/(\d+)\s*(người|ng\b|person|people)/i);
      const people = peopleMatch ? Number(peopleMatch[1]) : null;

      // Trích xuất giá tối đa
      const priceMatch = messageText.match(/dưới\s*([\d,.]+)\s*(k|nghìn|triệu|tr|đ|vnd)?/i);
      let max_price = null;
      if (priceMatch) {
        const val = Number(priceMatch[1].replace(/[,.]/g, ""));
        const unit = (priceMatch[2] || "").toLowerCase();
        max_price = unit === "triệu" || unit === "tr" ? val * 1_000_000
                  : unit === "k" || unit === "nghìn"  ? val * 1_000
                  : val > 10_000 ? val : val * 1_000;
      }

      console.log(`[Agent] Gọi search_rooms: people=${people}, max_price=${max_price}`);
      const rawResult = await searchRooms.invoke({ people, max_price });

      let rooms = [];
      try { rooms = JSON.parse(rawResult); } catch { rooms = []; }

      // Nếu tool trả về lỗi object thay vì array
      if (!Array.isArray(rooms)) {
        console.warn("[Agent] search_rooms trả về lỗi:", rooms);
        return { text: "Xin lỗi, hệ thống đang gặp sự cố khi tìm phòng. Vui lòng thử lại sau.", rooms: [] };
      }

      if (rooms.length === 0) {
        return {
          text: people
            ? `Xin lỗi, hiện tại em chưa tìm được phòng phù hợp cho ${people} người.`
            : "Xin lỗi, hiện tại em chưa tìm được phòng phù hợp với yêu cầu của anh/chị.",
          rooms: [],
        };
      }

      const msg = `Em tìm được ${rooms.length} phòng phù hợp với yêu cầu của anh/chị:`;
      console.log(`[Agent] Trả về ${rooms.length} phòng`);
      return { text: msg, rooms };
    }

    // 4. ask_booking → gọi ReAct agent để dùng get_booking tool
    if (intent === "ask_booking") {
      const agentResult = await agent.invoke({
        messages: [new HumanMessage(messageText)],
      });

      const lastMsg = agentResult.messages?.at(-1);
      const rawContent = typeof lastMsg?.content === "string" ? lastMsg.content : "";
      const parsed = safeParseJSON(rawContent);

      return {
        text: parsed?.message || rawContent || "Xin lỗi, em chưa tìm được thông tin đặt phòng.",
        rooms: parsed?.rooms || [],
      };
    }

    // 5. other → ReAct agent xử lý tổng quát
    const agentResult = await agent.invoke({
      messages: [new HumanMessage(messageText)],
    });

    const lastMsg = agentResult.messages?.at(-1);
    const rawContent = typeof lastMsg?.content === "string" ? lastMsg.content : "";
    const parsed = safeParseJSON(rawContent);

    // Nếu agent trả về JSON hợp lệ
    if (parsed?.message) {
      return {
        text: parsed.message,
        rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      };
    }

    // Fallback: trả về raw text
    return {
      text: rawContent || "Xin chào! Em có thể giúp gì cho anh/chị?",
      rooms: [],
    };

  } catch (err) {
    console.error("[Agent] Lỗi không xử lý được:", err.message);
    return {
      text: "Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
      rooms: [],
    };
  }
}
