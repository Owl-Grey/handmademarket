import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import type { Good, OrderWithItems } from '../types';
import {
  fetchFavoriteGoods,
  fetchOrdersWithItems,
  fetchMainPhotosForList,
} from '../api/profile';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState<Good[]>([]);
  const [favoritePhotos, setFavoritePhotos] = useState<Record<string, string>>(
    {},
  );
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersPhotos, setOrdersPhotos] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const [favGoods, userOrders] = await Promise.all([
        fetchFavoriteGoods(user.id),
        fetchOrdersWithItems(user.id),
      ]);
      setFavorites(favGoods);
      setOrders(userOrders);

      const photosFav = await fetchMainPhotosForList(favGoods);
      setFavoritePhotos(photosFav);

      const goodsFromOrders = userOrders.flatMap((o) =>
        o.items.map((i) => i.good),
      );
      const photosOrders = await fetchMainPhotosForList(goodsFromOrders);
      setOrdersPhotos(photosOrders);

      setLoading(false);
    };

    void load();
  }, [user]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="page">
      <Header showCategoriesButton={false} />
      <main className="main">
        <h1 className="section-title">Личный кабинет</h1>

        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Любимые товары</h2>
          </div>
          {loading ? (
            <div className="loading">Загрузка…</div>
          ) : favorites.length === 0 ? (
            <p className="empty-state">
              Пока нет избранных товаров.
            </p>
          ) : (
            <div className="products-grid">
              {favorites.map((g) => (
                <ProductCard
                  key={g.id}
                  good={g}
                  photoUrl={favoritePhotos[g.id]}
                />
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Заказы</h2>
          </div>
          {loading ? (
            <div className="loading">Загрузка…</div>
          ) : orders.length === 0 ? (
            <p className="empty-state">Заказов пока нет.</p>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.order_id} className="order-card">
                  <div className="order-meta">
                    <div className="order-row">
                      <span className="order-label">Статус:</span>
                      <span className="order-status">{order.status}</span>
                    </div>
                    <div className="order-row">
                      <span className="order-label">Сумма:</span>
                      <span className="order-value">
                        {(order.order_summ ?? 0).toLocaleString('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <div className="order-row">
                      <span className="order-label">Создан:</span>
                      <span className="order-value">
                        {order.order_date
                          ? new Date(order.order_date).toLocaleDateString('ru-RU')
                          : '—'}
                      </span>
                    </div>
                    <div className="order-row">
                      <span className="order-label">Обновлён:</span>
                      <span className="order-value">
                        {order.updated_at
                          ? new Date(order.updated_at).toLocaleDateString('ru-RU')
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="order-items">
                    {order.items.map((item) => (
                      <Link
                        key={item.good.id}
                        to={`/product/${item.good.id}`}
                        className="order-item-card"
                      >
                        <div className="order-item-photo">
                          {ordersPhotos[item.good.id] ? (
                            <img
                              src={ordersPhotos[item.good.id]}
                              alt={item.good.title}
                              className="img-fade"
                            />
                          ) : (
                            <span className="photo-placeholder">Фото</span>
                          )}
                        </div>
                        <div className="order-item-info">
                          <div className="order-item-title">{item.good.title}</div>
                          <div className="order-item-qty">Количество: {item.count}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProfilePage;
