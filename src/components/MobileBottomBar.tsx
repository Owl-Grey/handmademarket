import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const formatCartCount = (count: number): string => {
  if (count <= 0) return '0';
  if (count > 999) {
    const k = Math.floor(count / 1000);
    return `${k}k+`;
  }
  return String(count);
};

const MobileBottomBar = () => {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);

  const loadCartCount = useCallback(async () => {
    if (!user) {
      setCartCount(0);
      return;
    }

    setCartLoading(true);

    try {
      const { data: cartRow, error: cartError } = await supabase
        .from('cart')
        .select('cart_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cartError || !cartRow) {
        setCartCount(0);
        return;
      }

      const cartId = cartRow.cart_id as string;

      const { data: items, error: goodsError } = await supabase
        .from('goods_in_cart')
        .select('count')
        .eq('cart_id', cartId);

      if (goodsError) {
        console.error('goods_in_cart count error', goodsError);
        setCartCount(0);
        return;
      }

      const total = (items ?? []).reduce(
        (sum, row) => sum + (Number((row as any).count) || 0),
        0,
      );

      setCartCount(total);
    } catch (e) {
      console.error('loadCartCount error', e);
      setCartCount(0);
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  useEffect(() => {
    const handler = () => loadCartCount();
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, [loadCartCount]);

  const node = typeof document !== 'undefined' ? document.body : null;

  const bar = (
    <div className="mobile-bottom-bar" role="navigation" aria-label="mobile menu">
      {/* Categories */}
      <Link to="/search" aria-label="categories" className="mobile-bar-link">
        <span className="mobile-icon" aria-hidden="true">📂</span>
        <span className="mobile-label">Категории</span>
      </Link>

      {/* Cart */}
      <Link to="/cart" aria-label="cart" className="mobile-bar-link cart-link">
        <span className="mobile-icon cart-icon" aria-hidden="true">🛒</span>
        {!cartLoading && cartCount > 0 && (
          <span className="mobile-bottom-badge">{formatCartCount(cartCount)}</span>
        )}
        <span className="mobile-label">Корзина</span>
      </Link>

      {/* Profile / Auth */}
      {user ? (
        <Link to="/profile" aria-label="profile" className="mobile-bar-link profile-link">
          <span className="mobile-icon" aria-hidden="true">👤</span>
          <span className="mobile-label">Профиль</span>
        </Link>
      ) : (
        <Link to="/auth" aria-label="login" className="mobile-bar-link profile-link">
          <span className="mobile-icon" aria-hidden="true">👤</span>
          <span className="mobile-label">Войти</span>
        </Link>
      )}
    </div>
  );

  if (!node) return null;
  return createPortal(bar, node);
};

export default MobileBottomBar;
