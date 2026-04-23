import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Utensils, Waves, Sparkles, Dumbbell, Gamepad2, Car } from 'lucide-react';
import { SearchBar } from '../components/features/SearchBar';
import { RoomCard } from '../components/features/RoomCard';
import { ChatWidget } from '../components/features/ChatWidget';
import { roomApi, type ApiRoom } from '../lib/api';
import type { Room } from '../types';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

function toCard(r: ApiRoom): Room {
  const bedName = r.beds && r.beds.length > 0 ? r.beds[0].name : '';
  return {
    id: String(r.type_id),
    room_id: r.first_room_id ?? r.rooms?.[0]?.room_id ?? null,
    name: r.type_name,
    type: r.type_name as any,
    price: r.base_price,
    size: r.area_sqm ?? 0,
    bed: bedName,
    capacity: String(r.capacity),
    maxGuests: r.capacity,
    rating: (r as any).rating ?? 4.5,
    reviews: (r as any).booking_count ?? Math.floor(Math.random() * 50) + 10,
    image: r.image ?? FALLBACK_IMG,
    images: r.image ? [r.image] : [FALLBACK_IMG],
    description: r.description ?? '',
    amenities: r.amenities || [],
    isPopular: (r as any).booking_count > 5 || (r as any).rating >= 4.8,
    roomCount: r.room_count ?? 0,
  };
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: 'easeOut', delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.6, delay },
});

const slideLeft = {
  initial: { opacity: 0, x: -50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const slideRight = {
  initial: { opacity: 0, x: 50 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: 'easeOut' },
};

const scrollReveal = (delay = 0) => ({
  initial: { opacity: 0, y: 50 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: 'easeOut', delay },
});

// ─── Data ─────────────────────────────────────────────────────────────────────

const SERVICES = [
  { icon: Utensils, label: 'Nhà hàng', desc: 'Ẩm thực đa dạng' },
  { icon: Waves,    label: 'Hồ bơi',   desc: 'Vô cực & thư giãn' },
  { icon: Sparkles, label: 'Spa',       desc: 'Liệu trình chuyên sâu' },
  { icon: Dumbbell, label: 'Phòng gym', desc: 'Thiết bị hiện đại' },
  { icon: Gamepad2, label: 'Giải trí',  desc: 'Nhanh chóng & tiện lợi' },
  { icon: Car,      label: 'Đưa đón',   desc: 'Đưa đón sân bay' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const Home: React.FC = () => {
  const [featuredRooms, setFeaturedRooms] = useState<ReturnType<typeof toCard>[]>([]);
  const [recommendedRooms, setRecommendedRooms] = useState<ReturnType<typeof toCard>[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  useEffect(() => {
    roomApi.list().then((data) => setFeaturedRooms(data.slice(0, 3).map(toCard))).catch(() => {});
    
    roomApi.recommendations(3).then((data) => {
      setRecommendedRooms(data.map(toCard));
      setLoadingRecommendations(false);
    }).catch(() => {
      setLoadingRecommendations(false);
    });
  }, []);
  return (
  <motion.div className="min-h-screen bg-gray-50" {...fadeIn(0)}>

    {/* ── Hero ── */}
    <section className="relative h-[82vh] flex items-center justify-center mx-4 mt-4 rounded-3xl overflow-hidden shadow-xl">
      {/* Background zoom */}
      <motion.img
        src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&q=80&w=2000"
        alt="SmartHotel luxury pool"
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        <motion.p
          className="text-yellow-300 text-sm font-semibold tracking-widest uppercase mb-4"
          {...fadeUp(0.2)}
        >
          Trải nghiệm sự tinh tế trong từng khoảnh khắc
        </motion.p>

        <motion.h1
          className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight drop-shadow-lg"
          {...fadeUp(0.35)}
        >
          Khám phá kỳ nghỉ<br />hoàn hảo của bạn
        </motion.h1>

        <motion.p
          className="text-base md:text-lg text-gray-200 mb-10"
          {...fadeUp(0.5)}
        >
          Trải nghiệm sự sang trọng và tiện nghi bậc nhất tại SmartHotel.
        </motion.p>

        <motion.div {...fadeUp(0.65)}>
          <SearchBar />
        </motion.div>
      </div>
    </section>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 py-16">

      {/* ── Promo banner ── */}
      <motion.section
        className="bg-blue-600 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-white"
        initial={{ opacity: 0, x: -60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <div>
          <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-2">Khuyến mãi giới hạn</p>
          <h3 className="text-xl md:text-2xl font-bold">Ưu đãi mùa hè: Giảm 20% cho khách đặt phòng trước 7 ngày</h3>
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link
            to="/rooms"
            className="shrink-0 bg-white text-blue-700 font-bold px-7 py-3.5 rounded-xl hover:bg-gray-50 transition-colors inline-block"
          >
            Đặt phòng ngay
          </Link>
        </motion.div>
      </motion.section>

      {/* ── Recommended rooms ── */}
      <section>
        <motion.div
          className="flex justify-between items-end mb-8"
          {...scrollReveal(0)}
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1">Gợi ý cho bạn</h2>
            <p className="text-gray-500 text-sm">Những lựa chọn tuyệt vời nhất dựa trên sở thích của bạn</p>
          </div>
          <Link to="/rooms?sort=recommend" className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800">
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {loadingRecommendations ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-[400px]">
                <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded w-full mt-auto"></div>
              </div>
            ))}
          </div>
        ) : recommendedRooms.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Không có gợi ý phù hợp</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendedRooms.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.15 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <RoomCard room={room} layout="grid" />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Featured rooms ── */}
      <section>
        <motion.div
          className="flex justify-between items-end mb-8"
          {...scrollReveal(0)}
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1">Phòng nổi bật</h2>
            <p className="text-gray-500 text-sm">Lựa chọn phòng nghỉ phù hợp nhất với bạn</p>
          </div>
          <Link to="/rooms" className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800">
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {featuredRooms.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.15 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <RoomCard room={room} layout="grid" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section>
        <motion.div className="text-center mb-10" {...scrollReveal(0)}>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">Dịch vụ cao cấp</h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm">
            Nâng tầm trải nghiệm với những tiện ích đẳng cấp 5 sao tại SmartHotel.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {SERVICES.map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.88 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.18 } }}
              className="bg-white rounded-2xl p-5 text-center border border-gray-100 hover:shadow-md transition-shadow cursor-default"
            >
              <motion.div
                className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3 text-blue-600"
                whileHover={{ rotate: 8, scale: 1.12 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── About ── */}
      <section className="flex flex-col md:flex-row gap-12 items-center">
        <motion.div className="flex-1" {...slideLeft}>
          <img
            src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000"
            alt="SmartHotel pool"
            className="w-full h-80 object-cover rounded-3xl shadow-xl"
          />
        </motion.div>

        <motion.div className="flex-1 space-y-5" {...slideRight}>
          <p className="text-yellow-500 text-xs font-bold tracking-widest uppercase">Khám phá câu chuyện</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Về SmartHotel</h2>
          <p className="text-gray-600 leading-relaxed">
            SmartHotel mang đến trải nghiệm nghỉ dưỡng sang trọng với hệ thống phòng hiện đại, dịch vụ cao cấp và không gian thư giãn lý tưởng. Chúng tôi cam kết mang lại sự hài lòng tuyệt đối qua phong cách phục vụ chuyên nghiệp và tận tâm.
          </p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/about"
              className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-7 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Xem thêm
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <motion.section
        className="text-center py-16"
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Sẵn sàng cho kỳ nghỉ của bạn?</h2>
        <p className="text-gray-500 mb-8 max-w-xl mx-auto">
          Đặt phòng ngay hôm nay để tận hưởng trải nghiệm nghỉ dưỡng tuyệt vời tại SmartHotel.
        </p>
        <motion.div
          whileHover={{ scale: 1.06, boxShadow: '0 12px 32px rgba(37,99,235,0.25)' }}
          whileTap={{ scale: 0.97 }}
          className="inline-block rounded-xl"
        >
          <Link
            to="/rooms"
            className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-10 py-4 text-base rounded-xl font-bold shadow-lg transition-colors"
          >
            Đặt phòng ngay
          </Link>
        </motion.div>
      </motion.section>

    </div>

    {/* ── Chat ── */}
    <ChatWidget />
  </motion.div>
  );
};
