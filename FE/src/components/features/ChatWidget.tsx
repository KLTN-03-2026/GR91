import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { chatbotApi } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  rooms?: any[];
}

const QUICK_REPLIES = [
  'Xem phòng còn trống',
  'Chính sách lưu trú',
  'Giờ nhận / trả phòng',
  'Liên hệ lễ tân',
];

export const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: 'Xin chào! Tôi là trợ lý AI từ SmartHotel. Tôi có thể giúp gì cho chuyến đi của bạn hôm nay? 😊' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});
  
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('smarthotel_chat_session');
    if (stored) return stored;
    const next = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('smarthotel_chat_session', next);
    return next;
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const navigate = useNavigate();

  // Tự động cuộn xuống khi có tin nhắn mới hoặc mảng rooms xuất hiện
  useEffect(() => {
    if (open) {
      const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      // Gọi ngay và gọi sau khi DOM update
      scrollToBottom();
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, open, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: nextId.current++, from: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatbotApi.sendMessage(sessionId, text.trim());
      
      const botMsg: Message = { 
        id: nextId.current++, 
        from: 'bot', 
        text: response.data.message || "",
        rooms: response.data.rooms
      };
      
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chatbot API Error:', error);
      const errorMsg: Message = { 
        id: nextId.current++, 
        from: 'bot', 
        text: 'Dạ, hệ thống đang bận một chút. Anh/chị vui lòng thử lại sau giây lát nhé!' 
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[340px] sm:w-[400px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ maxHeight: '75vh' }}
        >
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">SmartHotel AI Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  <span className="text-blue-100 text-xs">Phản hồi thông minh</span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50 flex flex-col scroll-smooth"
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.from === 'bot' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  {msg.from === 'bot' ? <Bot className="h-4 w-4 text-blue-600" /> : <User className="h-4 w-4 text-gray-600" />}
                </div>
                
                <div className={`max-w-[85%] flex flex-col gap-2 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.text && (
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm border ${
                      msg.from === 'bot' ? 'bg-white text-gray-800 rounded-bl-sm border-gray-100' : 'bg-blue-600 text-white rounded-br-sm border-blue-500'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  
                  {/* Chỉ render Cards khi mảng rooms có dữ liệu thực tế */}
                  {msg.rooms && Array.isArray(msg.rooms) && msg.rooms.length > 0 && (
                    <div className="flex flex-col gap-3 w-[260px] mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {(expandedMessages[msg.id] ? msg.rooms : msg.rooms.slice(0, 3)).map((r: any, idx: number) => {
                        const roomId = r.id || r.room_id;
                        const roomName = r.name || r.type_name || `Phòng ${r.room_number}`;
                        const roomImage = r.image || r.first_image || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                        const roomPrice = r.price || r.effective_price || r.base_price || 0;

                        return (
                          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:border-blue-300 transition-colors">
                            <div className="relative h-28 w-full overflow-hidden">
                              <img src={roomImage} alt={roomName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                            <div className="p-3">
                              <h4 className="font-bold text-sm text-gray-900 truncate">{roomName}</h4>
                              <p className="text-blue-600 font-bold text-sm mt-1">{formatPrice(roomPrice)} <span className="text-gray-400 text-[10px]">/ đêm</span></p>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button onClick={() => navigate(`/room/${roomId}`)} className="py-2 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 text-[11px] font-bold rounded-lg transition-all border border-blue-100">
                                  Xem chi tiết
                                </button>
                                <button onClick={() => navigate(`/room/${roomId}`)} className="py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all border border-blue-600">
                                  Đặt phòng
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {msg.rooms.length > 3 && (
                        <button
                          onClick={() => setExpandedMessages((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                          className="w-full py-2 text-xs font-semibold text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-50"
                        >
                          {expandedMessages[msg.id] ? 'Thu gọn' : `Xem thêm ${msg.rooms.length - 3} phòng`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
               <div className="flex items-end gap-2">
                 <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                   <Bot className="h-4 w-4 text-blue-600" />
                 </div>
                 <div className="bg-white px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 flex items-center gap-1.5 h-[40px]">
                   <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                   <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                   <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                 </div>
               </div>
            )}
            <div ref={bottomRef} className="h-1 shrink-0" />
          </div>

          {/* Quick replies */}
          <div className="px-3 py-2 flex gap-2 overflow-x-auto shrink-0 bg-gray-50 border-t border-gray-100 scrollbar-hide">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={isTyping}
                className="shrink-0 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap disabled:opacity-50"
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
              disabled={isTyping}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={!input.trim() || isTyping} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-all disabled:opacity-50">
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button onClick={() => setOpen((v) => !v)} className="fixed bottom-6 right-6 z-[9999] bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all border-4 border-white">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  );
};
