import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, CreditCard, Wifi, Coffee, MapPin, Clock, Star, Zap } from 'lucide-react';
import { Card } from '../components/ui/Card';

export const Services: React.FC = () => {
  useEffect(() => {
    document.title = "Dịch vụ - SmartHotel";
  }, []);

  const mainServices = [
    {
      icon: Bot,
      title: "AI Concierge",
      desc: "Trợ lý ảo thông minh hỗ trợ 24/7. Giải đáp mọi thắc mắc về chính sách, giá phòng và tư vấn lịch trình cá nhân hóa.",
      color: "bg-blue-100 text-blue-600"
    },
    {
      icon: Zap,
      title: "Smart Pricing",
      desc: "Hệ thống giá linh hoạt, cập nhật liên tục theo thời gian thực để mang lại ưu đãi tốt nhất cho khách hàng.",
      color: "bg-purple-100 text-purple-600"
    },
    {
      icon: CreditCard,
      title: "Thanh toán đa nền tảng",
      desc: "Hỗ trợ VNPay, MoMo và tiền mặt. Quy trình thanh toán nhanh gọn, an toàn và bảo mật tuyệt đối.",
      color: "bg-green-100 text-green-600"
    },
    {
      icon: Clock,
      title: "Check-in Siêu tốc",
      desc: "Tiết kiệm thời gian với quy trình nhận phòng tự động qua ứng dụng di động hoặc kiosk tại sảnh.",
      color: "bg-orange-100 text-orange-600"
    }
  ];

  const amenities = [
    { icon: Wifi, name: "Wifi Tốc độ cao" },
    { icon: Coffee, name: "Bữa sáng Buffet" },
    { icon: Star, name: "Phòng Gym 5*" },
    { icon: MapPin, name: "Vị trí Đắc địa" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-gray-900 mb-4"
          >
            Dịch vụ & Tiện ích
          </motion.h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Trải nghiệm đẳng cấp với các dịch vụ tích hợp trí tuệ nhân tạo, mang lại sự tiện nghi vượt mong đợi.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {mainServices.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full hover:shadow-xl transition-all border-none shadow-sm group p-6">
                <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <s.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{s.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="bg-blue-600 rounded-3xl p-8 md:p-16 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Bot size={200} />
          </div>
          <div className="relative z-10 max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Trợ lý AI Concierge 24/7</h2>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              Bạn cần đặt phòng? Bạn muốn biết giá chính xác vào ngày mai? Hay đơn giản là hỏi về chính sách thú cưng? 
              Chatbot AI của chúng tôi luôn sẵn sàng phục vụ bạn bất cứ lúc nào với dữ liệu thời gian thực từ hệ thống.
            </p>
            <button className="bg-white text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors">
              Trò chuyện ngay
            </button>
          </div>
        </div>

        <section className="mt-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Tiện ích miễn phí đi kèm</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {amenities.map((a, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all">
                <a.icon className="h-8 w-8 text-blue-600" />
                <span className="font-semibold text-gray-700">{a.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
