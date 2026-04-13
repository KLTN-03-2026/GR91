const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiRoom {
  type_id: number;
  type_name: string;
  description: string;
  base_price: number;
  capacity: number;
  area_sqm?: number | null;
  category_id?: number | null;
  category_name?: string | null;
  amenities: string[];
  beds?: { name: string; quantity: number }[];
  image: string | null;
  room_count?: number;
  rooms?: { room_id?: number; room_number: string; floor: number; status?: string; images?: string[]; room_note?: string | null }[];
}

export interface RoomCategory {
  category_id: number;
  name: string;
  description?: string | null;
}

export interface BedType {
  bed_id: number;
  name: string;
}

export interface RoomQuery {
  min_price?: number;
  max_price?: number;
  capacity?: number;
  check_in?: string;
  check_out?: string;
  type_id?: number;
}

// Wrap fetch để bắt lỗi network (server không chạy, mất kết nối...)
async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra server đang chạy.');
  }
}

async function get<T>(path: string, params?: Record<string, any>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const res = await safeFetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await safeFetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}

export interface AuthUser {
  userId: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'USER' | 'ADMIN';
  total_bookings?: number;
  total_spent?: number;
  created_at?: string;
}

export interface ApiStats {
  totalRevenue: number;
  bookingCount: number;
  totalRooms: number;
  vacantRooms: number;
  userCount: number;
  recentBookings: {
    booking_id: number;
    status: string;
    total_price: number;
    created_at: string;
    full_name: string;
    room_type: string;
    room_number: string;
  }[];
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (identifier: string, password: string) =>
    post<AuthResponse>('/auth/login', { identifier, password }),
  register: (data: { username: string; full_name: string; email: string; phone?: string; password: string }) =>
    post<AuthResponse>('/auth/register', data),
};

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await safeFetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await safeFetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}

async function del<T>(path: string): Promise<T> {
  const res = await safeFetch(BASE + path, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data;
}

export interface ApiRoomUnit {
  room_id: number;
  room_number: string;
  floor: number;
  status: string;
  room_note: string | null;
  type_id: number;
  type_name: string;
  base_price: number;
  effective_price: number;
  capacity: number;
  description: string;
  amenities: string[];
  image: string | null;
  area_sqm?: number | null;
  category_name?: string | null;
  beds?: { name: string; quantity: number }[];
}

export const roomApi = {
  list: (query?: RoomQuery) => get<ApiRoom[]>('/rooms', query as any),
  listUnits: (query?: RoomQuery) => get<ApiRoomUnit[]>('/rooms/all-units', query as any),
  detail: (typeId: number | string) => get<ApiRoom>(`/rooms/${typeId}`),
  create: (data: { name: string; description?: string; base_price: number; capacity: number; category_id?: number | null; area_sqm?: number | null; bed_id?: number | null }) =>
    post<{ type_id: number }>('/rooms', data),
  update: (typeId: number | string, data: Partial<{ name: string; description: string; base_price: number; capacity: number; category_id: number | null; area_sqm: number | null; bed_id: number | null }>) =>
    put<{ success: boolean }>(`/rooms/${typeId}`, data),
  remove: (typeId: number | string) =>
    del<{ success: boolean }>(`/rooms/${typeId}`),
  listCategories: () => get<RoomCategory[]>('/rooms/categories/list'),
  listBedTypes: () => get<BedType[]>('/rooms/bed-types/list'),
};

export interface ListQuery {
  start_date?: string;
  end_date?: string;
}

export interface ApiReview {
  review_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name: string;
  username: string;
  room_type: string;
  status: 'VISIBLE' | 'HIDDEN';
}

export interface MyReview {
  review_id: number;
  booking_id: number;
  room_type_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  status: 'VISIBLE' | 'HIDDEN';
}

export interface AdminReview extends ApiReview {
  booking_id: number;
  room_type_id: number;
  email?: string | null;
  room_number?: string | null;
  floor?: number | null;
  room_id?: number | null;
  room_image?: string | null;
}

export interface ReviewStats {
  total: number;
  visible: number;
  hidden: number;
  avg_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  low_star: number;
}

export interface ApiBooking {
  booking_id: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  total_price: number;
  created_at: string;
  expires_at?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  check_in: string;
  check_out: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  room_price: number;
  room_type: string;
  room_number: string;
  type_id?: number | null;
  // Detail expansion
  rooms?: { booking_room_id: number; room_id: number; room_number: string; room_type: string; check_in: string; check_out: string; check_in_time?: string | null; check_out_time?: string | null; price: number; image?: string | null }[];
  guests?: { booking_guest_id: number; full_name: string; email?: string | null; phone?: string | null }[];
  payments?: { payment_id: number; amount: number; method: string; status: string; transaction_date: string }[];
}

export const reviewApi = {
  list: (type_id: number | string) => get<ApiReview[]>('/reviews', { type_id }),
  myReviews: () => get<MyReview[]>('/reviews/my'),
  /** @deprecated use myReviews() */
  myReviewedBookings: () => get<MyReview[]>('/reviews/my'),
  create: (data: { booking_id: number; rating: number; comment?: string }) =>
    post<{ review_id: number }>('/reviews', data),
  update: (reviewId: number, data: { rating: number; comment?: string }) =>
    patch<{ success: boolean }>(`/reviews/${reviewId}`, data),
  adminList: (query?: { status?: string; type_id?: number; rating?: number }) =>
    get<AdminReview[]>('/reviews/admin', query as any),
  adminStats: () => get<ReviewStats>('/reviews/admin/stats'),
  setVisibility: (reviewId: number, status: 'VISIBLE' | 'HIDDEN') =>
    patch<{ success: boolean }>(`/reviews/${reviewId}/visibility`, { status }),
  remove: (reviewId: number) =>
    del<{ success: boolean }>(`/reviews/${reviewId}`),
};

export const userApi = {
  list: (query?: ListQuery) => get<AuthUser[]>('/users', query as any),
  detail: (id: number | string) => get<AuthUser>(`/users/${id}`),
  update: (id: number | string, data: Partial<{ full_name: string; phone: string }>) =>
    patch<{ success: boolean }>(`/users/${id}`, data),
  remove: (id: number | string) =>
    del<{ success: boolean }>(`/users/${id}`),
  changePassword: (id: number | string, current_password: string, new_password: string) =>
    patch<{ success: boolean }>(`/users/${id}/password`, { current_password, new_password }),
};

export interface RoomUnit {
  room_id: number;
  room_number: string;
  floor: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  base_price?: number;
  override_price?: number | null;
  effective_price?: number;
  beds?: { name: string; quantity: number }[];
  first_image?: string | null;
  room_note?: string | null;
}

export interface Amenity {
  amenity_id: number;
  name: string;
}

export interface RoomDisplayUnit {
  room_id: number;
  room_number: string;
  floor: number;
  db_status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'CLEANING';
  display_status: 'AVAILABLE' | 'BOOKED' | 'CLEANING' | 'MAINTENANCE' | 'INACTIVE';
  room_note: string | null;
  type_id: number;
  type_name: string;
  base_price: number;
  effective_price: number;
  first_image: string | null;
  beds: { name: string; quantity: number }[];
}

export const adminRoomApi = {
  // Units (phòng vật lý)
  listUnits: (typeId: number | string) =>
    get<RoomUnit[]>(`/rooms/${typeId}/units`),
  listUnitsStatus: (date?: string) =>
    get<RoomDisplayUnit[]>('/rooms/admin/units-status', date ? { date } : undefined),
  addUnit: (typeId: number | string, data: { room_number: string; floor: number }) =>
    post<{ room_id: number }>(`/rooms/${typeId}/units`, data),
  updateUnit: (roomId: number, data: Partial<{ room_number: string; floor: number; status: string; room_note: string }>) =>
    patch<{ success: boolean }>(`/rooms/units/${roomId}`, data),
  deleteUnit: (roomId: number) =>
    del<{ success: boolean }>(`/rooms/units/${roomId}`),
  // Amenities
  listAmenities: (typeId: number | string) =>
    get<Amenity[]>(`/rooms/${typeId}/amenities`),
  addAmenity: (typeId: number | string, name: string) =>
    post<{ amenity_id: number }>(`/rooms/${typeId}/amenities`, { name }),
  deleteAmenity: (typeId: number | string, amenityId: number) =>
    del<{ success: boolean }>(`/rooms/${typeId}/amenities/${amenityId}`),
  // Beds
  listBeds: (typeId: number | string) =>
    get<{ id: number; bed_id: number; name: string; quantity: number }[]>(`/rooms/${typeId}/beds`),
  addBed: (typeId: number | string, bed_id: number, quantity: number) =>
    post<{ id: number }>(`/rooms/${typeId}/beds`, { bed_id, quantity }),
  deleteBed: (typeId: number | string, bedRowId: number) =>
    del<{ success: boolean }>(`/rooms/${typeId}/beds/${bedRowId}`),
  // Images per room unit
  listImages: (roomId: number) =>
    get<{ image_id: number; url: string }[]>(`/rooms/units/${roomId}/images`),
  addImage: (roomId: number, url: string) =>
    post<{ image_id: number; url: string }>(`/rooms/units/${roomId}/images`, { url }),
  deleteImage: (imageId: number) =>
    del<{ success: boolean }>(`/rooms/images/${imageId}`),
  // Price override per room unit
  getPrice: (roomId: number) =>
    get<{ base_price: number; override_price: number | null; effective_price: number }>(`/rooms/units/${roomId}/price`),
  setPrice: (roomId: number, price: number) =>
    put<{ success: boolean }>(`/rooms/units/${roomId}/price`, { price }),
  resetPrice: (roomId: number) =>
    del<{ success: boolean }>(`/rooms/units/${roomId}/price`),
  // Room detail (full info with type + beds)
  getDetail: (roomId: number) =>
    get<{
      room_id: number; room_number: string; floor: number; status: string; room_note: string | null;
      type_id: number; type_name: string; base_price: number; capacity: number;
      area_sqm: number | null; category_name: string | null;
      override_price: number | null; effective_price: number;
      beds: { name: string; quantity: number }[];
    }>(`/rooms/units/${roomId}/detail`),
  // Reassign existing room type
  changeType: (roomId: number, type_id: number) =>
    patch<{ success: boolean }>(`/rooms/units/${roomId}/type`, { type_id }),
  // Create new room type and assign to room (transaction)
  retypeRoom: (roomId: number, data: {
    name: string; base_price: number; capacity?: number;
    category_id?: number | null; area_sqm?: number | null;
    bed_id?: number | null; bed_quantity?: number;
  }) => post<{ type_id: number }>(`/rooms/units/${roomId}/retype`, data),
  // Booking history of a room unit
  listBookings: (roomId: number) =>
    get<any[]>(`/rooms/units/${roomId}/bookings`),
};

export interface ApiAvailableRoom {
  room_id: number;
  room_number: string;
  floor: number;
  room_note: string | null;
  type_id: number;
  type_name: string;
  base_price: number;
  total_price: number;
  capacity: number;
  description: string;
  area_sqm: number | null;
  category_name: string | null;
  amenities: string[];
  beds: { name: string; quantity: number }[];
  image: string | null;
}

export const availableRoomsApi = {
  list: (check_in: string, check_out: string) =>
    get<ApiAvailableRoom[]>('/rooms/available', { check_in, check_out }),
};

export const bookingApi = {
  list: (query?: ListQuery) => get<ApiBooking[]>('/bookings', query as any),
  updateStatus: (id: number | string, status: string) =>
    patch<{ success: boolean }>(`/bookings/${id}/status`, { status }),
  detail: (id: number | string) => get<ApiBooking>(`/bookings/${id}`),
  hardRemove: (id: number | string) =>
    del<{ success: boolean }>(`/bookings/${id}/hard`),
  cancel: (id: number | string) =>
    del<{ success: boolean }>(`/bookings/${id}`),
  create: (data: { room_id: number; check_in: string; check_out: string; check_in_time?: string; check_out_time?: string; guests: { full_name: string; email?: string; phone?: string }[]; payment_method?: string }) =>
    post<{ success: boolean; booking_id: number; total_price: number; base_price: number; early_fee: number; late_fee: number; nights: number; expires_at: string }>('/bookings', data),
  pay: (id: number | string) =>
    patch<{ success: boolean; booking_id: number; status: string }>(`/bookings/${id}/pay`, {}),
};

export const statsApi = {
  get: (query?: ListQuery) => get<ApiStats>('/stats', query as any),
};
