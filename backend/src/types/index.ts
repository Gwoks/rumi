import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'parent';
  name: string;
  created_at?: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface Child {
  id: number;
  parent_id: number;
  name: string;
  date_of_birth: string;
  class_group: string;
  created_at?: string;
  parent_name?: string;
}

export interface Assessment {
  id: number;
  child_id: number;
  date: string;
  domain: 'practical_life' | 'sensorial' | 'language' | 'math' | 'islamic_studies';
  score: number;
  notes: string | null;
  created_at?: string;
}

export interface Photo {
  id: number;
  child_id: number;
  photo_url: string;
  caption: string | null;
  uploaded_at?: string;
}

export interface PlayKit {
  id: number;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string;
  color: string;
  icon: string;
  created_at?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  kit_id: number;
  quantity: number;
  price: number;
  title?: string;
}

export interface Order {
  id: number;
  parent_id: number;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  shipping_status: 'New' | 'Packed' | 'Shipped';
  created_at: string;
  parent_name?: string;
  items?: OrderItem[];
}

export interface PopUpClass {
  id: number;
  title: string;
  date_day: string;
  date_month: string;
  location: string;
  time: string;
  tag: string | null;
  created_at?: string;
}
