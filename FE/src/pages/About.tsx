import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Shield, Zap, Target, Award, Users } from 'lucide-react';

export const About: React.FC = () => {
  useEffect(() => {
    document.title = "Giới thiệu - SmartHotel";
  }, []);

  const team = [
    { name: "Nguyễn Văn Hiếu", id: "28211153563", role: "Leader - Phát triển hệ thống", time: "Toàn thời gian" },
    { name: "Lương Văn Thịnh", id: "28211153775", role: "Phát triển hệ thống", time: "Toàn thời gian" },
    { name: "Lê Vĩnh Tài", id: "28211150577", role: "Phát triển hệ thống", time: "Toàn thời gian" },
    { name: "Lê Vĩnh Tú", id: "28211151640", role: "Phát triển hệ thống", time: "Toàn thời gian" },
    { name: "Trần Kiều Tiến", id: "28211102962", role: "Phát triển hệ thống", time: "Toàn thời gian" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Section */}
      <section className="relative h-[400px] flex items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=80"
          alt="SmartHotel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-blue-900/60" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center text-white px-4"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">Chào mừng đến với SmartHotel</h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
            Nơi công nghệ AI hội tụ cùng lòng hiếu khách để tạo nên trải nghiệm lưu trú hoàn hảo.
          </p>
        </motion.div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Core Values */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Zap, title: "Hiện đại", desc: "Tích hợp AI điều khiển phòng và trợ lý ảo thông minh 24/7." },
            { icon: Shield, title: "An toàn", desc: "Hệ thống bảo mật đa lớp và quy trình check-in tự động nhanh chóng." },
            { icon: Award, title: "Tiện nghi", desc: "Trang thiết bị cao cấp, sang trọng đạt chuẩn quốc tế." }
          ].map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                <v.icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{v.title}</h3>
              <p className="text-gray-600">{v.desc}</p>
            </motion.div>
          ))}
        </section>

        {/* Introduction */}
        <section className="py-16 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Target className="text-blue-600" /> Tầm nhìn & Sứ mệnh
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  SmartHotel không chỉ là một khách sạn. Chúng tôi là một hệ sinh thái lưu trú thông minh, nơi mọi nhu cầu của bạn được dự đoán và đáp ứng bởi trí tuệ nhân tạo.
                </p>
                <p>
                  Sứ mệnh của chúng tôi là thay đổi cách thế giới vận hành ngành du lịch, mang lại sự cá nhân hóa tối đa cho từng du khách thông qua dữ liệu và thuật toán thông minh.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img src="https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&w=400&q=80" className="rounded-2xl shadow-md h-48 w-full object-cover" />
              <img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80" className="rounded-2xl shadow-md h-48 w-full object-cover mt-8" />
            </div>
          </div>
        </section>

        {/* Development Team */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
              <Users className="text-blue-600" /> Đội ngũ phát triển
            </h2>
            <p className="text-gray-600">Những người đứng sau sự thành công của SmartHotel - Group 92</p>
          </div>

          {/* Supervisor Card */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Award size={80} />
              </div>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-2">Cán bộ hướng dẫn</p>
              <h3 className="text-2xl font-bold">ThS. Phạm Khánh Linh</h3>
              <p className="text-blue-100 mt-1">Giảng viên - Khoa Công nghệ thông tin</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center font-bold text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{m.name}</h4>
                    <p className="text-xs text-gray-500">MSSV: {m.id}</p>
                  </div>
                </div>
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Nhiệm vụ:</span>
                    <span className="text-gray-700 font-medium">{m.role}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Khoa:</span>
                    <span className="text-gray-700">CNTT - Công nghệ phần mềm</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Thời gian:</span>
                    <span className="bg-blue-50 text-blue-600 px-2 rounded-full font-bold">{m.time}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
