import { OllamaEmbeddings } from "@langchain/ollama";
import * as dotenv from "dotenv";
dotenv.config();

const policies = [
  "1. Giờ nhận phòng (Check-in) là 14:00. Giờ trả phòng (Check-out) là 12:00 trưa hôm sau.",
  "2. Phương thức thanh toán: SmartHotel hỗ trợ thanh toán trực tuyến bảo mật qua cổng VNPay (chấp nhận ATM nội địa, thẻ quốc tế Visa/MasterCard, mã QR) và thanh toán bằng Tiền mặt (Cash) trực tiếp tại quầy lễ tân.",
  "3. Chính sách huỷ phòng & hoàn tiền: Quý khách được miễn phí huỷ đặt phòng trước 48 giờ so với giờ check-in. Nếu huỷ trong vòng 48 giờ, khách sạn sẽ thu phí bằng 100% giá trị đêm đầu tiên. Tiền hoàn sẽ được trả về tài khoản VNPay trong vòng 5-7 ngày làm việc.",
  "4. Chính sách trẻ em: Miễn phí lưu trú cho trẻ em dưới 6 tuổi (ngủ chung giường với bố mẹ). Trẻ từ 6-12 tuổi phụ thu 200,000 VNĐ/đêm.",
  "5. Tiện ích & Bữa sáng: Khách sạn có bữa sáng buffet miễn phí từ 6:30 đến 9:30 sáng tại nhà hàng tầng trệt. Có bãi đỗ xe ô tô và Wi-Fi miễn phí.",
  "6. Đồ thất lạc (Lost & Found): Nếu khách hàng để quên đồ, khách sạn sẽ lưu giữ và bảo quản đồ thất lạc tại quầy lễ tân trong vòng 30 ngày kể từ ngày khách trả phòng."
];

let embeddingsModel: OllamaEmbeddings | null = null;
let policyEmbeddings: number[][] = [];
let initialized = false;

// Hàm tính dot product để đo độ tương đồng cosine (do embeddings thường đã được normalize)
function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct; // Xấp xỉ cosine similarity
}

export async function initRag() {
  if (initialized) return;
  try {
    embeddingsModel = new OllamaEmbeddings({
      model: "llama3.2:3b",
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434"
    });
    // Tính toán embedding cho toàn bộ chính sách
    policyEmbeddings = await embeddingsModel.embedDocuments(policies);
    initialized = true;
    console.log("[RAG] Đã khởi tạo Knowledge Base thành công.");
  } catch (error: any) {
    console.warn("[RAG] Không thể kết nối Ollama Embeddings, chuyển sang fallback keyword.", error.message);
    initialized = true;
    embeddingsModel = null;
  }
}

export async function retrievePolicy(query: string): Promise<string> {
  if (!initialized || !embeddingsModel) {
    // Fallback simple keyword search
    const lower = query.toLowerCase();
    const keywords = lower.split(" ").filter(w => w.length > 2);
    const matched = policies.filter(p => {
        const pLower = p.toLowerCase();
        return keywords.some(kw => pLower.includes(kw));
    });
    // Return at most 2 matched policies, or top 2 if no match
    return matched.length > 0 ? matched.slice(0, 2).join("\n") : policies.slice(0, 2).join("\n");
  }

  try {
    const queryEmbedding = await embeddingsModel.embedQuery(query);
    const scores = policies.map((policy, idx) => ({
      policy,
      score: cosineSimilarity(queryEmbedding, policyEmbeddings[idx])
    }));
    
    // Sắp xếp giảm dần theo điểm và lấy top 2
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, 2).map(s => s.policy).join("\n");
  } catch (err: any) {
     return policies.join("\n");
  }
}
