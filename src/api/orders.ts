import { supabase } from '../lib/supabaseClient';
import { getActiveCartId } from './cart';
import type { OrderRow } from '../types';

export class OrderError extends Error {}

export const createOrderFromCart = async (userId: string): Promise<OrderRow> => {
  // 1. актуальная корзина
  const cartId = await getActiveCartId(userId);
  if (!cartId) {
    throw new OrderError('Корзина не найдена.');
  }

  // 2. наличие позиций
  const { count: itemsCount, error: itemsErr } = await supabase
    .from('goods_in_cart')
    .select('*', { count: 'exact', head: true })
    .eq('cart_id', cartId);

  if (itemsErr) {
    console.error('order items count error', itemsErr);
    throw new OrderError('Не удалось получить позиции корзины.');
  }
  if (!itemsCount || itemsCount <= 0) {
    throw new OrderError('Корзина пуста.');
  }

  // 3. сами позиции
  const { data: cartItems, error: cartItemsErr } = await supabase
    .from('goods_in_cart')
    .select('good_id, count')
    .eq('cart_id', cartId);

  if (cartItemsErr || !cartItems || cartItems.length === 0) {
    console.error('order items fetch error', cartItemsErr);
    throw new OrderError('Не удалось получить содержимое корзины.');
  }

  const goodIds = cartItems.map((row: any) => row.good_id as string);
  const { data: goods, error: goodsErr } = await supabase
    .from('goods')
    .select('id, price, count')
    .in('id', goodIds);

  if (goodsErr || !goods) {
    console.error('order goods fetch error', goodsErr);
    throw new OrderError('Не удалось получить данные товаров.');
  }

  const priceMap: Record<string, number> = {};
  const goodsMap: Record<string, any> = {};
  for (const g of goods) {
    const id = (g as any).id as string;
    priceMap[id] = Number((g as any).price ?? 0);
    goodsMap[id] = g;
  }

  const orderSum = cartItems.reduce((sum, row: any) => {
    const count = Number(row.count ?? 0);
    const price = priceMap[row.good_id] ?? 0;
    return sum + count * price;
  }, 0);

  // 4. создаём заказ
  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      cart_id: cartId,
      status: 'new',
      order_date: now,
      updated_at: now,
      order_summ: orderSum,
    })
    .select('*')
    .maybeSingle();

  if (orderErr || !order) {
    console.error('create order error', orderErr);
    throw new OrderError('Не удалось создать заказ.');
  }

  // 5. отметить корзину как оформленную
  const { error: cartUpdateErr } = await supabase
    .from('cart')
    .update({ is_ordered: true })
    .eq('cart_id', cartId);
  if (cartUpdateErr) {
    console.error('cart is_ordered update error', cartUpdateErr);
  }

  // 6. уменьшить остатки товаров
  const stockUpdates = cartItems.map((row: any) => {
    const good = goodsMap[row.good_id];
    if (!good) return null;
    const current = Number((good as any).count ?? 0);
    const delta = Number(row.count ?? 0);
    if (Number.isNaN(current) || Number.isNaN(delta)) return null;
    const next = Math.max(0, current - delta);
    return { id: (good as any).id as string, next };
  });

  for (const upd of stockUpdates) {
    if (!upd) continue;
    const { error: updErr } = await supabase
      .from('goods')
      .update({ count: upd.next })
      .eq('id', upd.id);
    if (updErr) {
      console.error('goods stock update error', updErr);
    }
  }

  // 7. создать новую пустую корзину для следующих покупок
  const { error: newCartErr } = await supabase.from('cart').insert({
    user_id: userId,
  });
  if (newCartErr) {
    console.error('new cart create error', newCartErr);
  }

  return order as OrderRow;
};
