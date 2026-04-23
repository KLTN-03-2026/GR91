import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { hotelApi } from '../lib/api';

export const Contact: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [hotelInfo, setHotelInfo] = useState({
    name: "Sunrise Smart Hotel",
    address: "TP ĐÀ NẴNG",
    phone: "0774423506",
    email: "nhieu1652004@gmail.com",
    hours: "Mở cửa 24/7"
  });

  useEffect(() => {
    document.title = "Liên hệ - SmartHotel";

    // Fetch real hotel info
    const fetchInfo = async () => {
      try {
        const res = await hotelApi.getInfo();
        if (res.success) {
          setHotelInfo({
            ...res.data,
            hours: "Mở cửa 24/7"
          });
        }
      } catch (err) {
        console.error("Failed to fetch hotel info:", err);
      }
    };
    fetchInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Giả lập gửi liên hệ
    await new Promise(resolve => setTimeout(resolve, 1000));

    addToast('Gửi liên hệ thành công! Chúng tôi sẽ phản hồi sớm nhất.', 'success');
    setFormData({ name: '', email: '', subject: '', message: '' });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-gray-900 mb-4"
          >
            Liên hệ với chúng tôi
          </motion.h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Chúng tôi luôn sẵn sàng lắng nghe ý kiến đóng góp và giải đáp mọi thắc mắc của bạn.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Side: Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Thông tin khách sạn</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-medium uppercase mb-1">Địa chỉ</p>
                    <p className="text-gray-700 font-semibold">{hotelInfo.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-medium uppercase mb-1">Số điện thoại</p>
                    <p className="text-gray-700 font-semibold">{hotelInfo.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-medium uppercase mb-1">Email hỗ trợ</p>
                    <p className="text-gray-700 font-semibold">{hotelInfo.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 font-medium uppercase mb-1">Giờ làm việc</p>
                    <p className="text-gray-700 font-semibold">{hotelInfo.hours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="h-64 bg-gray-200 rounded-3xl overflow-hidden relative border border-gray-100">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3833.896131498642!2d108.21814677593284!3d16.059424684619475!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x314219c1186b5155%3A0x633d57733427!2zMTIzIE5ndXnhu4VuIEh14buHLCBC4bq_biBOZ2jDqSwgUXXhuq1uIDEsIFRow6BuaCBwaOG7kSBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e0!3m2!1svi!2s!4v1650000000000!5m2!1svi!2s"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
              />
            </div>
          </motion.div>

          {/* Right Side: Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Gửi góp ý cho chúng tôi</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Họ và tên"
                  placeholder="Nguyễn Văn A"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <Input
                label="Tiêu đề"
                placeholder="Vấn đề cần hỗ trợ"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                required
              />
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 ml-1">Nội dung</label>
                <textarea
                  className="w-full min-h-[150px] p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-sm"
                  placeholder="Nhập nội dung góp ý của bạn..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  required
                ></textarea>
              </div>

              <Button
                type="submit"
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 group"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Gửi liên hệ ngay</span>
                    <Send className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </Button>

              <div className="p-4 bg-blue-50 rounded-2xl flex gap-3 items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Ý kiến của bạn sẽ được AI xử lý và chuyển đến bộ phận chuyên môn trong vòng 5 phút.
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Component giả lập Loader vì lucide-react có thể không có Loader2 trong phiên bản hiện tại
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);
