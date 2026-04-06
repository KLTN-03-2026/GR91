import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
}

const QUICK_REPLIES = [
  'Xem phòng còn trống',
  'Chính sách hủy phòng',
  'Giờ nhận / trả phòng',
  'Liên hệ lễ tân',
];

const BOT_RESPONSES: Record<string, string> = {
  'xem phòng còn trống': 'Hiện tại chúng tôi còn nhiều phòng trống từ ngày mai. Bạn có thể xem danh sách tại trang Phòng nghỉ nhé!',
  'chính sách hủy phòng': 'Bạn có thể hủy miễn phí trước 48 giờ nhận phòng. Sau thời gian đó sẽ tính phí tương đương 1 đêm.',
  'giờ nhận / trả phòng': 'Nhận phòng từ 14:00, trả phòng trước 12:00. Nếu cần early check-in hoặc late check-out, vui lòng liên hệ lễ tân.',
  'liên hệ lễ tân': 'Bạn có thể gọi trực tiếp cho lễ tân qua số +84 123 456 789 hoặc email info@smarthotel.vn. Chúng tôi phục vụ 24/7!',
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, reply] of Object.entries(BOT_RESPONSES)) {
    if (lower.includes(key)) return reply;
  }
  return 'Cảm ơn bạn đã liên hệ! Để được hỗ trợ chi tiết hơn, vui lòng gọi hotline +84 123 456 789 hoặc để lại tin nhắn, chúng tôi sẽ phản hồi sớm nhất.';
}

export const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: 'Xin chào! Tôi là trợ lý SmartHotel. Tôi có thể giúp gì cho bạn hôm nay? 😊' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  let nextId = useRef(1);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: nextId.current++, from: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate bot typing delay
    setTimeout(() => {
      const botMsg: Message = { id: nextId.current++, from: 'bot', text: getBotReply(text) };
      setMessages((prev) => [...prev, botMsg]);
    }, 700);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ maxHeight: '70vh' }}
        >
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">SmartHotel Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  <span className="text-blue-100 text-xs">Đang hoạt động</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Đóng chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.from === 'bot' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  {msg.from === 'bot'
                    ? <Bot className="h-3.5 w-3.5 text-blue-600" />
                    : <User className="h-3.5 w-3.5 text-gray-600" />
                  }
                </div>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.from === 'bot'
                    ? 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                    : 'bg-blue-600 text-white rounded-br-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 flex gap-2 overflow-x-auto shrink-0 bg-gray-50 border-t border-gray-100">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="shrink-0 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-3 flex gap-2 border-t border-gray-100 bg-white shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors shrink-0"
              aria-label="Gửi"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all border-4 border-white"
        aria-label="Chat hỗ trợ"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  );
};
