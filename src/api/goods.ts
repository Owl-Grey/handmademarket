// src/api/goods.ts
import { supabase } from '../lib/supabaseClient';
import type { Category, GoodPhoto, Good } from '../types';

export const PAGE_SIZE = 20;

type PhotoRow = {
  good_id: string;
  url: string;
  is_main: boolean | null;
};

/* ===================== БАЗОВЫЕ СПИСКИ ТОВАРОВ ===================== */

export const fetchGoodsPage = async (pageNum: number): Promise<Good[]> => {
  const from = pageNum * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Ошибка загрузки товаров:', error);
    return [];
  }

  return (data as Good[]) ?? [];
};

export const fetchHotGoods = async (limit = 15): Promise<Good[]> => {
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .eq('on_main', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Ошибка загрузки горячих товаров:', error);
    return [];
  }

  return (data as Good[]) ?? [];
};

/* ===================== ФОТО ДЛЯ ТОВАРОВ ===================== */

export const fetchMainPhotosForGoods = async (
  list: Good[],
): Promise<Record<string, string>> => {
  const ids = Array.from(new Set(list.map((g) => g.id)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('goods_photo')
    .select('good_id, url, is_main')
    .in('good_id', ids);

  if (error) {
    console.error('Ошибка загрузки фото:', error);
    return {};
  }

  const rows = (data ?? []) as PhotoRow[];
  const map: Record<string, string> = {};

  for (const row of rows) {
    if (!map[row.good_id] || row.is_main) {
      map[row.good_id] = row.url;
    }
  }

  return map;
};

/* ===================== КАТЕГОРИИ ===================== */

export const fetchAllCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки категорий:', error);
    return [];
  }

  return (data as Category[]) ?? [];
};

/* ===================== ПОИСК ТОВАРОВ ===================== */

export type SearchFilters = {
  query?: string;
  categoryId?: number;
};

export const searchGoodsPage = async (
  filters: SearchFilters,
  pageNum: number,
): Promise<Good[]> => {
  const from = pageNum * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('goods')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.query && filters.query.trim().length > 0) {
    // ищем по названию (при желании потом добавим описание)
    query = query.ilike('title', `%${filters.query.trim()}%`);
  }

  if (filters.categoryId) {
    // предполагаю, что у товара есть category_id (int8)
    query = query.eq('category_id', filters.categoryId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Ошибка поиска товаров:', error);
    return [];
  }

  return (data as Good[]) ?? [];
};

// ======================= Детали товара =======================

export interface GoodMeta {
  materialName: string | null;
  colorName: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
}

/** Один товар по id */
export const fetchGoodById = async (id: string): Promise<Good | null> => {
  const { data, error } = await supabase
    .from('goods')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Ошибка загрузки товара:', error);
    return null;
  }

  return (data as Good) ?? null;
};

/** Все фотки товара в правильном порядке */
export const fetchGoodPhotos = async (goodId: string): Promise<GoodPhoto[]> => {
  const { data, error } = await supabase
    .from('goods_photo')
    .select('*')
    .eq('good_id', goodId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки фото товара:', error);
    return [];
  }

  return (data as GoodPhoto[]) ?? [];
};

/** Человеческие названия материала, цвета, категорий */
export const fetchGoodMeta = async (good: Good): Promise<GoodMeta> => {
  let materialName: string | null = null;
  let colorName: string | null = null;
  let categoryName: string | null = null;
  let subcategoryName: string | null = null;

  // материал
  if (good.material_id) {
    const { data, error } = await supabase
      .from('materials')
      .select('label')
      .eq('id', good.material_id)
      .maybeSingle();

    if (error) {
      console.error('Ошибка загрузки материала:', error);
    } else {
      materialName = (data as any)?.label ?? null;
    }
  }

  // цвет
  if (good.color_id) {
    const { data, error } = await supabase
      .from('color')
      .select('color_name')
      .eq('id', good.color_id)
      .maybeSingle();

    if (error) {
      console.error('Ошибка загрузки цвета:', error);
    } else {
      colorName = (data as any)?.color_name ?? null;
    }
  }

  // категория
  if ((good as any).category_id) {
    const { data, error } = await supabase
      .from('categories')
      .select('category')
      .eq('id', (good as any).category_id)
      .maybeSingle();

    if (error) {
      console.error('Ошибка загрузки категории:', error);
    } else {
      categoryName = (data as any)?.category ?? null;
    }
  }

  // подкатегория
  if ((good as any).subcategory_id) {
    const { data, error } = await supabase
      .from('categories')
      .select('category')
      .eq('id', (good as any).subcategory_id)
      .maybeSingle();

    if (error) {
      console.error('Ошибка загрузки подкатегории:', error);
    } else {
      subcategoryName = (data as any)?.category ?? null;
    }
  }

  return { materialName, colorName, categoryName, subcategoryName };
};
