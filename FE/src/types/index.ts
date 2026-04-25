export type RoomType = 'Standard' | 'Superior' | 'Deluxe' | 'Suite' | 'Villa';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'partially_paid' | 'checked_in';
export type UserRole = 'user' | 'admin';

export interface Room {
  id: string;
  room_id?: number | null;
  name: string;
  type: RoomType;
  price: number;
  size: number;
  bed: string;
  capacity: string;
  maxGuests: number;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  description: string;
  amenities: string[];
  isPopular?: boolean;
  discount?: number;
  roomCount?: number;
}

export interface Booking {
  id: string;
  roomName: string;
  roomImage: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  status: BookingStatus;
  totalPrice: number;
  location: string;
}

export interface AdminBooking {
  id: string;
  customer: string;
  room: string;
  date: string;
  status: BookingStatus;
  amount: number;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  address: string;
  memberSince: string;
}
