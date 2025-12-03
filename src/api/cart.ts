// src/api/cart.ts
import { supabase } from '../lib/supabaseClient';
import type { Good } from '../types';

type CartRow = {
  cart_id: string;
  is_ordered?: boolean | null;
};

type GoodsInCartRow = {
  id: string;
  good_id: string;
  count: number | null;
};

export type CartItem = {
  good: Good;
  count: number;
};

// Active cart: newest available cart not linked to an order (created_at might not exist, so no ordering by it)
const getCartId = async (
  userId: string,
  createIfMissing: boolean,
): Promise<string | null> => {
  const { data: cartRows, error: cartErr } = await supabase
    .from('cart')
    .select('cart_id, is_ordered')
    .eq('user_id', userId);

  if (cartErr) {
    console.error('cart select error', cartErr);
    if (!createIfMissing) return null;
  }

  const cartList = (cartRows as CartRow[] | null) ?? [];
  // carts already marked as ordered should be skipped for new purchases
  const notOrdered = cartList.filter((c) => !(c.is_ordered ?? false));
  const fallbackIds = cartList.map((c) => c.cart_id);
  const cartIds = notOrdered.length > 0 ? notOrdered.map((c) => c.cart_id) : fallbackIds;

  // carts already used in orders should stay frozen
  const { data: orderRows, error: orderErr } = await supabase
    .from('orders')
    .select('cart_id')
    .eq('user_id', userId);
  if (orderErr) {
    console.error('orders by cart select error', orderErr);
  }
  const usedCartIds = new Set(
    (orderRows as { cart_id: string }[] | null)?.map((o) => o.cart_id) ?? [],
  );

  const openCartIds = cartIds.filter((id) => !usedCartIds.has(id));

  // Prefer a cart that already has items
  let chosenCartId: string | null = openCartIds[0] ?? null;
  if (openCartIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from('goods_in_cart')
      .select('cart_id, count')
      .in('cart_id', openCartIds);

    if (itemsErr) {
      console.error('goods_in_cart select error', itemsErr);
    } else {
      const totals: Record<string, number> = {};
      for (const row of items ?? []) {
        const cid = (row as any).cart_id as string;
        const cnt = Number((row as any).count ?? 0);
        totals[cid] = (totals[cid] ?? 0) + cnt;
      }
      const withGoods = openCartIds.find((id) => (totals[id] ?? 0) > 0);
      if (withGoods) chosenCartId = withGoods;
    }
  }

  if (chosenCartId) return chosenCartId;

  if (!createIfMissing) return null;

  const { data: newCart, error: newErr } = await supabase
    .from('cart')
    .insert({ user_id: userId })
    .select('cart_id')
    .maybeSingle();

  if (newErr || !newCart) {
    console.error('cart insert error', newErr);
    throw newErr ?? new Error('Не удалось создать корзину');
  }

  return (newCart as CartRow).cart_id;
};

export const getActiveCartId = async (userId: string): Promise<string | null> =>
  getCartId(userId, false);

export const getOrCreateActiveCartId = async (
  userId: string,
): Promise<string> => {
  const id = await getCartId(userId, true);
  if (!id) throw new Error('Не удалось получить корзину');
  return id;
};

/** Total items in current (active) cart */
export const getCartTotalCount = async (userId: string): Promise<number> => {
  const cartId = await getActiveCartId(userId);
  if (!cartId) return 0;

  const { data, error } = await supabase
    .from('goods_in_cart')
    .select('count')
    .eq('cart_id', cartId);

  if (error) {
    console.error('goods_in_cart total error', error);
    return 0;
  }

  const total = (data as GoodsInCartRow[]).reduce(
    (sum, row) => sum + (row.count ?? 0),
    0,
  );

  return total;
};

/** Count for a specific good in current cart (ProductCard / ProductPage) */
export const getCartCountForGood = async (
  userId: string,
  goodId: string,
): Promise<number | null> => {
  const cartId = await getActiveCartId(userId);
  if (!cartId) return null;

  const { data, error } = await supabase
    .from('goods_in_cart')
    .select('count')
    .eq('cart_id', cartId)
    .eq('good_id', goodId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('goods_in_cart count error', error);
    return null;
  }

  return (data as GoodsInCartRow).count ?? null;
};

/**
 * Change count for a good in current cart by delta:
 * - delta > 0 — increment
 * - delta < 0 — decrement / delete if <= 0
 * returns new count or null if removed
 */
export const changeCartItemCount = async (
  userId: string,
  goodId: string,
  delta: number,
): Promise<number | null> => {
  const cartId = await getOrCreateActiveCartId(userId); // create cart if missing
  if (!cartId) throw new Error('Не удалось получить корзину');

  const { data: existing, error: existErr } = await supabase
    .from('goods_in_cart')
    .select('id, count')
    .eq('cart_id', cartId)
    .eq('good_id', goodId)
    .maybeSingle();

  if (existErr) {
    console.error('goods_in_cart select error', existErr);
    throw existErr;
  }

  // no existing row
  if (!existing) {
    if (delta <= 0) return null;

    const { data: inserted, error: insErr } = await supabase
      .from('goods_in_cart')
      .insert({
        cart_id: cartId,
        good_id: goodId,
        count: delta,
      })
      .select('count')
      .maybeSingle();

    if (insErr || !inserted) {
      console.error('insert item error', insErr);
      throw insErr ?? new Error('Не удалось добавить товар в корзину');
    }

    return (inserted as GoodsInCartRow).count ?? delta;
  }

  // existing row — update or delete
  const row = existing as GoodsInCartRow;
  const newCount = (row.count ?? 0) + delta;

  if (newCount <= 0) {
    const { error: delErr } = await supabase
      .from('goods_in_cart')
      .delete()
      .eq('id', row.id);

    if (delErr) {
      console.error('delete item error', delErr);
      throw delErr;
    }

    return null;
  }

  const { data: updated, error: updErr } = await supabase
    .from('goods_in_cart')
    .update({ count: newCount })
    .eq('id', row.id)
    .select('count')
    .maybeSingle();

  if (updErr || !updated) {
    console.error('update item error', updErr);
    throw updErr ?? new Error('Не удалось обновить количество товара');
  }

  return (updated as GoodsInCartRow).count ?? newCount;
};

/** List of cart items with goods data */
export const getCartItemsWithGoods = async (
  userId: string,
): Promise<CartItem[]> => {
  const cartId = await getActiveCartId(userId);
  if (!cartId) return [];

  // 1. items from goods_in_cart
  const { data: rows, error } = await supabase
    .from('goods_in_cart')
    .select('good_id, count')
    .eq('cart_id', cartId);

  if (error || !rows) {
    if (error) console.error('cart items error', error);
    return [];
  }

  const items = rows as GoodsInCartRow[];
  if (items.length === 0) return [];

  const goodIds = Array.from(new Set(items.map((r) => r.good_id)));

  // 2. load goods
  const { data: goodsData, error: goodsErr } = await supabase
    .from('goods')
    .select('*')
    .in('id', goodIds);

  if (goodsErr || !goodsData) {
    if (goodsErr) console.error('goods in cart goods error', goodsErr);
    return [];
  }

  const goodsMap: Record<string, Good> = {};
  for (const g of goodsData as Good[]) {
    goodsMap[g.id] = g;
  }

  // 3. build result
  const result: CartItem[] = [];
  for (const row of items) {
    const good = goodsMap[row.good_id];
    if (!good) continue;

    result.push({
      good,
      count: row.count ?? 0,
    });
  }

  return result;
};
