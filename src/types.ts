export interface Category {
  id: number;                // int8 in Supabase
  category: string;          // название категории
  parent_id: number | null;  // null = корневая категория
}

export interface Seller {
  id: string;
  name: string;
  description: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
}

export interface Good {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  width: number | null;
  length: number | null;
  height: number | null;
  color_id: string | null;
  material_id: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  seller_id: string | null;
  price: number;
  on_main: boolean;   // выводить на главной
  count: number | null; // остаток
}

export interface GoodPhoto {
  id: string;
  created_at: string;
  good_id: string;
  url: string;
  is_main: boolean;
}

export interface Material {
  id: string;
  label: string;
}

export interface Color {
  id: string;
  color_name: string;
}

export interface FavoriteRow {
  id: number;
  user_id: string;
  good_id: string;
}

export interface OrderRow {
  order_id: number;
  user_id: string;
  cart_id: string;
  status: string;
  order_date: string;
  updated_at: string;
  order_summ?: number | null;
}

export interface OrderItem {
  good: Good;
  count: number;
}

export interface OrderWithItems extends OrderRow {
  items: OrderItem[];
}
