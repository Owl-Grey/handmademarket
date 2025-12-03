import { supabase } from '../lib/supabaseClient';
import type { Good, Seller } from '../types';
import { PAGE_SIZE } from './goods';

export const fetchSellerById = async (id: string): Promise<Seller | null> => {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('fetchSellerById error', error);
    return null;
  }

  if (!data) return null;

  // Normalize possible misspelled DB column `desription` -> `description`
  const normalized: any = { ...data };
  if (normalized.desription && !normalized.description) {
    normalized.description = normalized.desription;
  }

  return (normalized as Seller) ?? null;
};

export const fetchSellerGoodsPage = async (
  sellerId: string,
  page: number,
): Promise<Good[]> => {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('fetchSellerGoodsPage error', error);
    return [];
  }

  return (data as Good[]) ?? [];
};
