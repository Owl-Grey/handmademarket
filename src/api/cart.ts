// src/api/cart.ts
import { supabase } from '../lib/supabaseClient';
import type { Good } from '../types';

type CartRow = {
  cart_id: string;
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

/**
 * Внутренняя функция:
 * - если createIfMissing = true — создаёт корзину, если её ещё нет
 * - если false — вернёт null, если корзины нет
 */
const getCartId = async (
  userId: string,
  createIfMissing: boolean,
): Promise<string | null> => {
  const { data: cartRow, error: cartErr } = await supabase
    .from('cart')
    .select('cart_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (cartErr) {
    console.error('cart select error', cartErr);
    if (!createIfMissing) return null;
  }

  if (!cartRow) {
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
  }

  return (cartRow as CartRow).cart_id;
};

/** Общее количество товаров в корзине (для бейджа в хедере) */
export const getCartTotalCount = async (userId: string): Promise<number> => {
  const cartId = await getCartId(userId, false);
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

/** Количество КОНКРЕТНОГО товара в корзине (для ProductCard / ProductPage) */
export const getCartCountForGood = async (
  userId: string,
  goodId: string,
): Promise<number | null> => {
  const cartId = await getCartId(userId, false);
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
 * Изменить количество товара в корзине на delta:
 * - delta > 0 → добавляем
 * - delta < 0 → убавляем
 * Возвращает:
 *   - новое количество
 *   - null, если товара больше нет в корзине
 */
export const changeCartItemCount = async (
  userId: string,
  goodId: string,
  delta: number,
): Promise<number | null> => {
  const cartId = await getCartId(userId, true); // создаём при необходимости
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

  // Если строки ещё нет
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

  // Строка есть — обновляем
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

/** Список товаров в корзине с данными из goods (без join-алиасов) */
export const getCartItemsWithGoods = async (
  userId: string,
): Promise<CartItem[]> => {
  const cartId = await getCartId(userId, false);
  if (!cartId) return [];

  // 1. Берём позиции из goods_in_cart
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

  // 2. Подтягиваем сами товары
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

  // 3. Склеиваем
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
