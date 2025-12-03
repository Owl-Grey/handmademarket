// src/components/ProductCard.tsx
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Good } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  changeCartItemCount as apiChangeCartItemCount,
  getCartCountForGood,
} from '../api/cart';

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
  const stock = good.count ?? null;

  // загрузка количества товара в активной корзине
  useEffect(() => {
    const loadCount = async () => {
      if (!user) {
        setCountInCart(null);
        return;
      }

      try {
        const cnt = await getCartCountForGood(user.id, good.id);
        setCountInCart(cnt ?? null);
      } catch (e) {
        console.error('load item count error', e);
      }
    };

    void loadCount();
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
      alert('Чтобы добавить в избранное, нужно войти в аккаунт.');
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
      alert('Не удалось обновить избранное.');
    } finally {
      setFavLoading(false);
    }
  };

  // изменение количества в корзине
  const changeCartCount = async (delta: number) => {
    if (!user) {
      alert('Чтобы добавить в корзину, нужно войти в аккаунт.');
      return;
    }
    if (updating) return;

    const currentUi = countInCart ?? 0;

    if (delta > 0 && stock != null && currentUi >= stock) {
      alert(`Нельзя добавить больше, чем есть в наличии (${stock} шт.).`);
      return;
    }

    setUpdating(true);

    try {
      const newCount = await apiChangeCartItemCount(user.id, good.id, delta);

      if (newCount == null) {
        setCountInCart(null);
      } else {
        setCountInCart(newCount);
      }

      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      console.error(err);
      alert('Не удалось обновить корзину.');
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
  const disablePlus =
    updating || stockIsZero || (stock != null && (countInCart ?? 0) >= stock);

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
            <div className="product-image placeholder photo-placeholder">Нет фото</div>
          )}
          <button
            className={`fav-btn ${isFavorite ? 'active' : ''}`}
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Убрать из избранного' : 'В избранное'}
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
                  -
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
