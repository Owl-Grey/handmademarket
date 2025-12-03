// src/pages/CartPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import {
  getCartItemsWithGoods,
  changeCartItemCount,
  type CartItem,
} from '../api/cart';
import { fetchMainPhotosForGoods } from '../api/goods';
import { createOrderFromCart } from '../api/orders';

type PhotoMap = Record<string, string>; // good_id -> url

const CartPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [mainPhotoByGoodId, setMainPhotoByGoodId] = useState<PhotoMap>({});
  const [updatingIds, setUpdatingIds] = useState<string[]>([]); // good_id
  const [ordering, setOrdering] = useState(false);

  const isUpdating = (goodId: string) => updatingIds.includes(goodId);

  const total = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + (item.good.price ?? 0) * (item.count ?? 0),
        0,
      ),
    [cartItems],
  );

  // загрузка корзины
  useEffect(() => {
    const loadCart = async () => {
      if (!user) {
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const items = await getCartItemsWithGoods(user.id);
        setCartItems(items);

        if (items.length === 0) {
          return;
        }

        const goods = items.map((i) => i.good);
        const photosMap = await fetchMainPhotosForGoods(goods);
        setMainPhotoByGoodId(photosMap);
      } catch (e) {
        console.error('Load cart error', e);
        setError('Не удалось загрузить корзину');
      } finally {
        setLoading(false);
      }
    };

    void loadCart();
  }, [user]);


  const changeItemCount = async (item: CartItem, delta: number) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const good = item.good;
    const stock = (good as any).count ?? null;
    const current = item.count;

    // ?????? ?? ?????????? ???????
    if (delta > 0 && stock != null && current >= stock) {
      alert(`?????? ???????? ??????, ??? ??????? (${stock} ??.).`);
      return;
    }

    setUpdatingIds((prev) => [...prev, good.id]);

    try {
      const newCount = await changeCartItemCount(user.id, good.id, delta);

      setCartItems((prev) => {
        if (newCount == null) {
          return prev.filter((row) => row.good.id !== good.id);
        }

        return prev.map((row) =>
          row.good.id === good.id ? { ...row, count: newCount } : row,
        );
      });

      window.dispatchEvent(new Event('cart-updated'));
    } catch (e) {
      console.error('changeItemCount error', e);
      alert('?? ??????? ???????? ?????????? ? ???????.');
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== good.id));
    }
  };

  const handleOrderClick = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (cartItems.length === 0 || ordering) return;

    setOrdering(true);
    setError(null);

    try {
      await createOrderFromCart(user.id);
      setCartItems([]); // очистили локальную корзину, т.к. создан новый cart_id
      setMainPhotoByGoodId({});
      window.dispatchEvent(new Event('cart-updated'));
      alert('Order created! You can view it in your profile.');
      navigate('/profile');
    } catch (e: any) {
      console.error('create order error', e);
      setError((e as any)?.message || 'Failed to create order.');
    } finally {
      setOrdering(false);
    }
  };
  const renderContent = () => {
    if (!user) {
      return (
        <div className="cart-empty">
          <p>Чтобы увидеть корзину, нужно войти в аккаунт.</p>
          <button className="primary-btn" onClick={() => navigate('/auth')}>
            Войти
          </button>
        </div>
      );
    }

    if (loading) {
      return <div className="cart-empty">Загружаем корзину…</div>;
    }

    if (error) {
      return <div className="cart-empty">{error}</div>;
    }

    if (cartItems.length === 0) {
      return (
        <div className="cart-empty">
          <p>В корзине пока пусто.</p>
          <button className="secondary-btn" onClick={() => navigate('/')}>
            На главную
          </button>
        </div>
      );
    }

    return (
      <div className="cart-layout">
        <section className="cart-items">
          {cartItems.map((item) => {
            const { good, count } = item;
            const photoUrl = mainPhotoByGoodId[good.id];
            const lineTotal = (good.price ?? 0) * (count ?? 0);
            const stock = (good as any).count ?? null;

            const disablePlus =
              isUpdating(good.id) || (stock != null && count >= stock);

            return (
              <div key={good.id} className="cart-item">
                <Link to={`/product/${good.id}`} className="cart-item-main">
                  <div className="cart-item-photo-wrapper">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={good.title}
                        className="cart-item-photo img-fade"
                        loading="lazy"
                        onLoad={(e) => e.currentTarget.classList.add('loaded')}
                      />
                    ) : (
                      <span className="photo-placeholder">нет фото</span>
                    )}
                  </div>

                  <div className="cart-item-info">
                    <h3 className="cart-item-title">{good.title}</h3>
                    {stock != null && (
                      <div className="cart-item-stock">
                        В наличии: {stock} шт.
                      </div>
                    )}

                    <div className="cart-item-price-row">
                      <span className="cart-item-price">
                        {good.price.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="cart-item-line-total">
                        {lineTotal.toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="cart-item-controls">
                  <div className="product-order-qty">
                    <button
                      type="button"
                      className="product-order-qty-btn"
                      disabled={isUpdating(good.id)}
                      onClick={() => changeItemCount(item, -1)}
                    >
                      –
                    </button>
                    <span className="product-order-qty-value">{count}</span>
                    <button
                      type="button"
                      className="product-order-qty-btn"
                      disabled={disablePlus}
                      onClick={() => changeItemCount(item, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <aside className="cart-summary">
          <div className="cart-summary-row">
            <span className="cart-summary-label">Итого</span>
            <span className="cart-summary-value">
              {total.toLocaleString('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                maximumFractionDigits: 0,
              })}
            </span>
          </div>

          <button
            className="primary-btn cart-order-btn"
            disabled={cartItems.length === 0 || ordering}
            onClick={handleOrderClick}
          >
            {ordering ? 'Placing...' : 'Place order'}
          </button>
        </aside>
      </div>
    );
  };

  return (
    <div className="page">
      <Header showSearch={false} showCategoriesButton={false} showLoginButton />
      <main className="main cart-main">
        <h1 className="cart-title">Корзина</h1>
        {renderContent()}
      </main>
    </div>
  );
};

export default CartPage;
