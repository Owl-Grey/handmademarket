import { supabase } from '../lib/supabaseClient';
import type { FavoriteRow, Good, OrderRow, OrderWithItems, OrderItem } from '../types';
import { fetchMainPhotosForGoods } from './goods';

export const fetchFavoriteGoods = async (userId: string): Promise<Good[]> => {
  const { data: favRows, error: favErr } = await supabase
    .from('favorites_goods')
    .select('good_id')
    .eq('user_id', userId);

  if (favErr || !favRows || favRows.length === 0) {
    if (favErr) console.error('fetchFavoriteGoods error', favErr);
    return [];
  }

  const goodIds = (favRows as FavoriteRow[]).map((r) => r.good_id);

  const { data: goods, error: goodsErr } = await supabase
    .from('goods')
    .select('*')
    .in('id', goodIds);

  if (goodsErr) {
    console.error('favorite goods select error', goodsErr);
    return [];
  }

  return (goods as Good[]) ?? [];
};

export const fetchOrdersWithItems = async (
  userId: string,
): Promise<OrderWithItems[]> => {
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('order_date', { ascending: false });

  if (ordersErr || !orders) {
    if (ordersErr) console.error('orders fetch error', ordersErr);
    return [];
  }

  const cartIds = Array.from(
    new Set((orders as OrderRow[]).map((o) => o.cart_id)),
  );

  // load items for all carts in one query
  const { data: cartItems, error: itemsErr } = await supabase
    .from('goods_in_cart')
    .select('cart_id, good_id, count')
    .in('cart_id', cartIds);

  if (itemsErr) {
    console.error('order items fetch error', itemsErr);
    return [];
  }

  const itemsByCart: Record<string, { good_id: string; count: number | null }[]> =
    {};
  for (const row of cartItems ?? []) {
    const cartId = (row as any).cart_id as string;
    if (!itemsByCart[cartId]) itemsByCart[cartId] = [];
    itemsByCart[cartId].push({
      good_id: (row as any).good_id as string,
      count: Number((row as any).count ?? 0),
    });
  }

  // collect all good ids to load their data
  const goodIds = Array.from(
    new Set(
      (cartItems ?? []).map((row) => (row as any).good_id as string),
    ),
  );

  let goodsMap: Record<string, Good> = {};
  if (goodIds.length > 0) {
    const { data: goods, error: goodsErr } = await supabase
      .from('goods')
      .select('*')
      .in('id', goodIds);

    if (goodsErr) {
      console.error('order goods fetch error', goodsErr);
    } else {
      goodsMap = Object.fromEntries(
        (goods as Good[]).map((g) => [g.id, g]),
      );
    }
  }

  return (orders as OrderRow[]).map((order) => {
    const itemsRaw = itemsByCart[order.cart_id] ?? [];
    const items: OrderItem[] = itemsRaw
      .map((row) => {
        const good = goodsMap[row.good_id];
        if (!good) return null;
        return { good, count: row.count ?? 0 };
      })
      .filter(Boolean) as OrderItem[];

    return { ...order, items };
  });
};

export const fetchMainPhotosForList = async (
  goods: Good[],
): Promise<Record<string, string>> => {
  return fetchMainPhotosForGoods(goods);
};
