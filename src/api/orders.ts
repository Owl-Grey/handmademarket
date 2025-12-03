import { supabase } from '../lib/supabaseClient';
import type { OrderRow } from '../types';

export class OrderError extends Error {}

export const createOrderFromCart = async (userId: string): Promise<OrderRow> => {
  // 1. получить корзину пользователя
  const { data: cartRow, error: cartErr } = await supabase
    .from('cart')
    .select('cart_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (cartErr || !cartRow) {
    throw new OrderError('Корзина не найдена.');
  }

  const cartId = cartRow.cart_id as string;

  // 2. проверить, что в корзине есть позиции
  const { count: itemsCount, error: itemsErr } = await supabase
    .from('goods_in_cart')
    .select('*', { count: 'exact', head: true })
    .eq('cart_id', cartId);

  if (itemsErr) {
    console.error('order items count error', itemsErr);
    throw new OrderError('Не удалось проверить корзину.');
  }
  if (!itemsCount || itemsCount <= 0) {
    throw new OrderError('В корзине нет товаров.');
  }

  // 3. посчитать сумму заказа по позициям корзины
  const { data: cartItems, error: cartItemsErr } = await supabase
    .from('goods_in_cart')
    .select('good_id, count')
    .eq('cart_id', cartId);

  if (cartItemsErr || !cartItems || cartItems.length === 0) {
    console.error('order items fetch error', cartItemsErr);
    throw new OrderError('Не удалось получить состав корзины.');
  }

  const goodIds = cartItems.map((row: any) => row.good_id as string);
  const { data: goods, error: goodsErr } = await supabase
    .from('goods')
    .select('id, price')
    .in('id', goodIds);

  if (goodsErr || !goods) {
    console.error('order goods fetch error', goodsErr);
    throw new OrderError('Не удалось получить цены товаров.');
  }

  const priceMap: Record<string, number> = {};
  for (const g of goods) {
    priceMap[(g as any).id as string] = Number((g as any).price ?? 0);
  }

  const orderSum = cartItems.reduce((sum, row: any) => {
    const count = Number(row.count ?? 0);
    const price = priceMap[row.good_id] ?? 0;
    return sum + count * price;
  }, 0);

  // 3. создать заказ
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

  return order as OrderRow;
};
