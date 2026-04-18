export const SERVICE_FEE_RATE = 0.05;
export const VAT_RATE = 0.10;
export const TOTAL_RATE = 1.15;

export const COUNTRIES = [
  'Việt Nam', 'Hoa Kỳ', 'Nhật Bản', 'Hàn Quốc',
  'Trung Quốc', 'Pháp', 'Đức', 'Anh', 'Úc', 'Singapore',
];

export const ROOM_TYPES = ['Standard', 'Superior', 'Deluxe', 'Suite', 'Villa'] as const;

export const AMENITY_FILTERS = ['Wifi miễn phí', 'Hồ bơi', 'Spa', 'Phòng Gym', 'Bữa sáng'];

export const SORT_OPTIONS = [
  { value: 'recommend', label: 'Dành cho bạn' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá: Thấp đến cao' },
  { value: 'price_desc', label: 'Giá: Cao xuống thấp' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
];

export const NAV_LINKS = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Phòng', path: '/rooms' },
  { label: 'Dịch vụ', path: '/services' },
  { label: 'Giới thiệu', path: '/about' },
  { label: 'Liên hệ', path: '/contact' },
];
