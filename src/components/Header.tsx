// src/components/Header.tsx
import { Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

type HeaderProps = {
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showCategoriesButton?: boolean;
  showLoginButton?: boolean;
};

const formatCartCount = (count: number): string => {
  if (count <= 0) return '0';
  if (count > 999) {
    const k = Math.floor(count / 1000);
    return `${k}к+`;
  }
  return String(count);
};

const Header = ({
  showSearch = true,
  searchPlaceholder = 'Поиск по товарам…',
  searchValue,
  onSearchChange,
  showCategoriesButton = true,
  showLoginButton = true,
}: HeaderProps) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<string>(() => {
    try {
      return (
        document.documentElement.getAttribute('data-theme') ||
        (localStorage.getItem('theme') ?? 'dark')
      );
    } catch {
      return 'dark';
    }
  });
  const [cartCount, setCartCount] = useState(0);
  const [cartLoading, setCartLoading] = useState(false);

  const loadCartCount = useCallback(async () => {
    if (!user) {
      setCartCount(0);
      return;
    }

    setCartLoading(true);

    try {
      // 1. Берём самую новую корзину пользователя (активную)
      const { data: cartRows, error: cartError } = await supabase
        .from('cart')
        .select('cart_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const cartRow = (cartRows as any[] | null)?.[0] ?? null;

      if (cartError || !cartRow) {
        setCartCount(0);
        return;
      }

      const cartId = cartRow.cart_id as string;

      // 2. считаем товары в goods_in_cart
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

  // грузим при логине / перезагрузке
  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  // theme init
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const initial = saved || theme || 'dark';
    document.documentElement.setAttribute('data-theme', initial);
    setTheme(initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  // слушаем событие "cart-updated" от кнопок "В корзину"
  useEffect(() => {
    const handler = () => {
      loadCartCount();
    };

    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, [loadCartCount]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          HANDMADE.MARKET
        </Link>

        {showSearch && (
          <div className="search-block">
            <input
              className="search-input"
              placeholder={searchPlaceholder}
              value={searchValue ?? ''}
              onChange={
                onSearchChange
                  ? (e) => onSearchChange(e.target.value)
                  : undefined
              }
            />
          </div>
        )}

        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            title="Переключить тему"
            onClick={toggleTheme}
          >
            {theme === 'light' ? '🌞' : '🌙'}
          </button>
          {showCategoriesButton && (
            <Link to="/search" className="categories-link">
              Категории
            </Link>
          )}

          {user ? (
            <>
              <Link to="/profile" className="profile-btn">
                👤 {user.name}
              </Link>

              <Link to="/cart" className="cart-btn">
                🛒
                {!cartLoading && cartCount > 0 && (
                  <span className="cart-badge">
                    {formatCartCount(cartCount)}
                  </span>
                )}
              </Link>
            </>
          ) : (
            showLoginButton && (
              <Link to="/auth" className="primary-btn header-login">
                Войти
              </Link>
            )
          )}
        </div>
      </div>
      {/* Mobile bottom bar removed from Header — rendered at app root */}
    </header>
  );
};

export default Header;
