// src/components/ProductCard.tsx
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Good } from '../types';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

type ProductCardProps = {
  good: Good;
  photoUrl?: string | null;
  variant?: 'default' | 'hot';
};

const ProductCard = ({ good, photoUrl, variant = 'default' }: ProductCardProps) => {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [countInCart, setCountInCart] = useState<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const descLimit = variant === 'hot' ? 90 : 70;
  const stock = good.count ?? null; // остаток товара

  // грузим начальное количество этого товара в корзине
  useEffect(() => {
    const loadCount = async () => {
      if (!user) {
        setCountInCart(null);
        return;
      }

      try {
        // корзина пользователя
        const { data: cartRow, error: cartErr } = await supabase
          .from('cart')
          .select('cart_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cartErr || !cartRow) {
          setCountInCart(null);
          return;
        }

        const cartId = cartRow.cart_id as string;

        // запись по этому товару
        const { data: item, error: itemErr } = await supabase
          .from('goods_in_cart')
          .select('id, count')
          .eq('cart_id', cartId)
          .eq('good_id', good.id)
          .maybeSingle();

        if (itemErr || !item) {
          setCountInCart(null);
          return;
        }

        setCountInCart(item.count ?? 1);
      } catch (e) {
        console.error('load item count error', e);
      }
    };

    loadCount();
  }, [user, good.id]);

  useEffect(() => {
    const loadFav = async () => {
      if (!user) {
        setIsFavorite(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('favorites_goods')
          .select('id')
          .eq('user_id', user.id)
          .eq('good_id', good.id)
          .maybeSingle();

        if (error) {
          console.error('load favorite error', error);
          setIsFavorite(false);
          return;
        }

        setIsFavorite(!!data);
      } catch (e) {
        console.error('load favorite error', e);
        setIsFavorite(false);
      }
    };

    void loadFav();
  }, [user, good.id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Чтобы отмечать товары как избранные, войдите в аккаунт.');
      return;
    }

    if (favLoading) return;
    setFavLoading(true);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites_goods')
          .delete()
          .match({ user_id: user.id, good_id: good.id });

        if (error) throw error;

        setIsFavorite(false);
        window.dispatchEvent(new Event('favorites-updated'));
      } else {
        const { data, error } = await supabase
          .from('favorites_goods')
          .insert({ user_id: user.id, good_id: good.id })
          .select()
          .maybeSingle();

        if (error) throw error;

        setIsFavorite(!!data);
        window.dispatchEvent(new Event('favorites-updated'));
      }
    } catch (err) {
      console.error('toggle favorite error', err);
      alert('Не удалось обновить избранное');
    } finally {
      setFavLoading(false);
    }
  };

  // универсальный хэндлер изменения количества
  const changeCartCount = async (delta: number) => {
    if (!user) {
      alert('Чтобы добавить товар в корзину, войди в аккаунт.');
      return;
    }
    if (updating) return;

    const currentUi = countInCart ?? 0;

    // локально проверяем лимит по остатку
    if (delta > 0 && stock != null && currentUi >= stock) {
      alert(`Нельзя добавить больше, чем есть в наличии (${stock} шт.).`);
      return;
    }

    setUpdating(true);

    try {
      // 1. корзина пользователя
      const { data: cartRow, error: cartErr } = await supabase
        .from('cart')
        .select('cart_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let cartId: string;

      if (cartErr) {
        console.error('cart error', cartErr);
        alert('Ошибка при получении корзины');
        return;
      }

      if (!cartRow) {
        if (delta <= 0) {
          return;
        }

        // если остаток 0 — добавить нельзя
        if (stock != null && stock <= 0) {
          alert('Товар закончился, добавить его в корзину нельзя.');
          return;
        }

        const { data: newCart, error: newErr } = await supabase
          .from('cart')
          .insert({ user_id: user.id })
          .select()
          .maybeSingle();

        if (newErr || !newCart) {
          console.error('create cart error', newErr);
          alert('Не удалось создать корзину');
          return;
        }

        cartId = newCart.cart_id as string;
      } else {
        cartId = cartRow.cart_id as string;
      }

      // 2. ищем строку по этому товару
      const { data: existing, error: existErr } = await supabase
        .from('goods_in_cart')
        .select('id, count')
        .eq('cart_id', cartId)
        .eq('good_id', good.id)
        .maybeSingle();

      if (existErr) {
        console.error('select item error', existErr);
        alert('Ошибка при обращении к корзине');
        return;
      }

      let newCount: number;

      if (!existing) {
        if (delta <= 0) return;

        const initialCount = 1;

        if (stock != null && initialCount > stock) {
          alert(`Нельзя добавить больше, чем есть в наличии (${stock} шт.).`);
          return;
        }

        const { data: inserted, error: insErr } = await supabase
          .from('goods_in_cart')
          .insert({ cart_id: cartId, good_id: good.id, count: initialCount })
          .select('count')
          .maybeSingle();

        if (insErr || !inserted) {
          console.error('insert item error', insErr);
          alert('Не удалось добавить товар в корзину');
          return;
        }

        newCount = inserted.count ?? initialCount;
      } else {
        const currentDb = existing.count ?? 0;
        newCount = currentDb + delta;

        if (delta > 0 && stock != null && newCount > stock) {
          alert(`Нельзя добавить больше, чем есть в наличии (${stock} шт.).`);
          return;
        }

        if (newCount <= 0) {
          const { error: delErr } = await supabase
            .from('goods_in_cart')
            .delete()
            .eq('id', existing.id);

          if (delErr) {
            console.error('delete item error', delErr);
            alert('Не удалось удалить товар из корзины');
            return;
          }

          setCountInCart(null);
          window.dispatchEvent(new Event('cart-updated'));
          return;
        }

        const { data: updated, error: updErr } = await supabase
          .from('goods_in_cart')
          .update({ count: newCount })
          .eq('id', existing.id)
          .select('count')
          .maybeSingle();

        if (updErr || !updated) {
          console.error('update item error', updErr);
          alert('Не удалось обновить количество товара');
          return;
        }

        newCount = updated.count ?? newCount;
      }

      setCountInCart(newCount);
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      console.error(err);
      alert('Что-то пошло не так при обновлении корзины');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void changeCartCount(1);
  };

  const handleMinusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void changeCartCount(-1);
  };

  const handlePlusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void changeCartCount(1);
  };

  const stockIsZero = stock != null && stock <= 0;
  const disablePlus = updating || stockIsZero || (stock != null && (countInCart ?? 0) >= stock);

  return (
    <Link to={`/product/${good.id}`} className="product-card-link">
      <article className={`product-card ${variant === 'hot' ? 'hot-card' : ''}`}>
        <div className="product-image-wrapper">
          {photoUrl ? (
            <img
              src={photoUrl}
              className="product-image img-fade"
              alt={good.title}
              loading="lazy"
              onLoad={(e) => e.currentTarget.classList.add('loaded')}
            />
          ) : (
            <div className="product-image placeholder photo-placeholder">нет фото</div>
          )}
          <button
            className={`fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          >
            ♥
          </button>
        </div>

        <div className="product-body">
          <h3 className="product-title">{good.title}</h3>
          <p className="product-desc">
            {good.description ? good.description.slice(0, descLimit) : '\u00A0'}
          </p>
          <div className="product-bottom">
            <span className="product-price">
              {good.price.toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>

            {stockIsZero ? (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Нет в наличии</span>
            ) : countInCart && countInCart > 0 ? (
              <div className="product-order-qty">
                <button
                  type="button"
                  className="product-order-qty-btn"
                  onClick={handleMinusClick}
                  disabled={updating}
                >
                  −
                </button>
                <span className="product-order-qty-value">{countInCart}</span>
                <button
                  type="button"
                  className="product-order-qty-btn"
                  onClick={handlePlusClick}
                  disabled={disablePlus}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleAddClick}
                disabled={updating}
              >
                В корзину
              </button>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

export default ProductCard;
