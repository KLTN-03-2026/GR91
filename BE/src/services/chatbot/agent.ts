import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { llm } from "./llm.js";
import { tools } from "./tools.js";
import { getHistory, saveHistory, getContext, saveContext } from "./session.js";
import { initRag } from "./rag.js";

// Khởi tạo Agent
const agent = createReactAgent({
  llm,
  tools,
});

const SYSTEM_PROMPT = `Bạn là SmartHotel AI Concierge, trợ lý đặt phòng thân thiện và chuyên nghiệp.

NGUYÊN TẮC CỐT LÕI:
1. Xưng "em", gọi khách "anh/chị". Trả lời ngắn gọn, súc tích, có văn phong tư vấn.
2. Luôn gọi tool để lấy dữ liệu thực trước khi trả lời. Không bịa thông tin.
3. KHÔNG BAO GIỜ nói "em sẽ tìm ngay" hay hứa hẹn mà không gọi tool trong cùng lượt.

HƯỚNG DẪN CHỌN TOOL:
- Tìm phòng theo tiêu chí (người, tầng, giá, loại): dùng \`search_rooms\`
  + "tầng cao" = floor >= 4, "tầng thấp" = floor <= 2 (tự suy luận, không hỏi lại)
  + Luôn dùng sort_by: 'price_asc' cho "giá rẻ nhất", 'rating' cho "tốt nhất"
- Khách thay đổi tiêu chí: gọi \`update_search_context\` TRƯỚC (chỉ truyền field thay đổi, field không đổi KHÔNG truyền), rồi gọi \`search_rooms\` với toàn bộ context mới
- Khách nói "loại nào cũng được" hoặc xoá tiêu chí: truyền null cho field đó trong \`update_search_context\`
- Không có yêu cầu cụ thể / hỏi "phòng nào tốt": dùng \`get_trending_rooms\`
- Phân vân giữa 2-3 loại phòng: dùng \`get_room_type_comparison\` rồi phân tích điểm khác biệt
- Yêu cầu tiện nghi cụ thể (ban công, bồn tắm...): dùng \`search_rooms_by_amenities\`
- Đối tượng đặc biệt (cặp đôi/trăng mật, gia đình, công tác, người cao tuổi): dùng \`recommend_by_persona\`

XỬ LÝ KẾT QUẢ:
- nearest_match = true + fallback_reason = "price": nói "không có phòng đúng giá, đây là gợi ý gần nhất"
- nearest_match = true + fallback_reason = "floor_and_price": nói "tầng X không có phòng giá Y, gợi ý phòng tương tự ở tầng khác"
- Khi có kết quả so sánh: phân tích rõ điểm khác biệt (diện tích, tiện nghi, giá), đưa ra lời khuyên cụ thể`;


function safeParseJSON(raw: string) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function runAgent(input: string, options: { sessionId?: string, userId?: number } = {}) {
  const sessionId = options.sessionId || "default-session";
  await initRag(); // Đảm bảo RAG đã sẵn sàng

  const storedHistory = await getHistory(sessionId);
  const currentContext = await getContext(sessionId);

  // Xây dựng messages cho LLM
  const messages: any[] = [new SystemMessage(SYSTEM_PROMPT)];
  
  if (Object.keys(currentContext).length > 0) {
    messages.push(new SystemMessage(`[Bộ nhớ hệ thống hiện tại của khách này]: ${JSON.stringify(currentContext)}`));
  }

  // Khôi phục history
  storedHistory.forEach((item: any) => {
    if (item.role === "user") messages.push(new HumanMessage(item.content));
    else if (item.role === "bot") messages.push(new AIMessage(item.content));
  });

  messages.push(new HumanMessage(input));

  try {
    const agentResult = await agent.invoke({ messages });
    const lastMsg = agentResult.messages?.at(-1);
    const rawContent = typeof lastMsg?.content === "string" ? lastMsg.content : "";

    // Phân tích xem Agent có cập nhật context không
    // (Bằng cách quét các tool_calls trong state messages nếu cần. Ở đây đơn giản hoá bằng cách xem history mới)
    let nextContext = currentContext;
    for (const msg of agentResult.messages) {
       if (msg._getType() === "tool" && msg.name === "update_search_context") {
          const contentStr = typeof msg.content === "string" ? msg.content : "";
          const parsedRes = safeParseJSON(contentStr);
          if (parsedRes && parsedRes.updatedState) {
             nextContext = { ...nextContext, ...parsedRes.updatedState };
             // Xoá các trường bị gán null hoặc undefined để thực sự bỏ tiêu chí này khỏi bộ nhớ
             for (const key of Object.keys(nextContext)) {
                 if (nextContext[key] === null || nextContext[key] === undefined) {
                     delete nextContext[key];
                 }
             }
          }
       }
    }

    // Trích xuất mảng rooms từ bất kỳ tool nào trả về dữ liệu phòng
    const ROOM_TOOLS = new Set([
      "search_rooms",
      "get_trending_rooms",
      "recommend_by_persona",
      "search_rooms_by_amenities",
      "get_room_type_comparison",
    ]);

    let rooms: any[] = [];
    for (const msg of agentResult.messages) {
        if (msg._getType() === "tool" && msg.name && ROOM_TOOLS.has(msg.name)) {
            const contentStr = typeof msg.content === "string" ? msg.content : "";
            const parsedRes = safeParseJSON(contentStr);
            if (!parsedRes) continue;

            // search_rooms / search_rooms_by_amenities → { rooms: [...] }
            if (parsedRes.rooms && parsedRes.rooms.length > 0) {
                rooms = parsedRes.rooms;
                break;
            }
            // get_trending_rooms → { results: [...] }
            if (parsedRes.results && parsedRes.results.length > 0) {
                rooms = parsedRes.results;
                break;
            }
            // recommend_by_persona → { recommendations: [...] }
            if (parsedRes.recommendations && parsedRes.recommendations.length > 0) {
                rooms = parsedRes.recommendations;
                break;
            }
            // get_room_type_comparison → { comparison: [...] }
            if (parsedRes.comparison && parsedRes.comparison.length > 0) {
                rooms = parsedRes.comparison;
                break;
            }
        }
    }

    // Lưu lại history và context
    const nextHistory = [
      ...storedHistory,
      { role: "user", content: input },
      { role: "bot", content: rawContent },
    ];
    await saveContext(sessionId, nextContext);
    await saveHistory(sessionId, nextHistory);

    return {
      text: rawContent || "Xin chào, em có thể giúp gì cho anh/chị?",
      rooms: rooms
    };

  } catch (err: any) {
    console.error("[Agent Error]:", err.message);
    return {
      text: "Xin lỗi, hệ thống của em đang gặp chút sự cố kết nối. Anh/chị vui lòng thử lại sau giây lát ạ.",
      rooms: []
    };
  }
}
