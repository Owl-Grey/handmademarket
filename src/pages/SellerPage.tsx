import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import type { Good, Seller } from '../types';
import { fetchMainPhotosForGoods, PAGE_SIZE } from '../api/goods';
import { fetchSellerById, fetchSellerGoodsPage } from '../api/sellers';

const SellerPage = () => {
  const { id } = useParams<{ id: string }>();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [goods, setGoods] = useState<Good[]>([]);
  const [photosByGoodId, setPhotosByGoodId] = useState<Record<string, string>>(
    {},
  );
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadSeller = async () => {
      setSellerLoading(true);
      const data = await fetchSellerById(id);
      setSeller(data);
      setSellerLoading(false);
    };

    const loadFirstGoods = async () => {
      setHasMore(true);
      setPage(0);
      const list = await fetchSellerGoodsPage(id, 0);
      setGoods(list);
      if (list.length < PAGE_SIZE) setHasMore(false);

      const photos = await fetchMainPhotosForGoods(list);
      if (Object.keys(photos).length > 0) {
        setPhotosByGoodId(photos);
      } else {
        setPhotosByGoodId({});
      }
    };

    void loadSeller();
    void loadFirstGoods();
  }, [id]);

  const loadMore = async () => {
    if (!id || !hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const list = await fetchSellerGoodsPage(id, nextPage);
    setGoods((prev) => [...prev, ...list]);
    setPage(nextPage);
    if (list.length < PAGE_SIZE) setHasMore(false);

    const photos = await fetchMainPhotosForGoods(list);
    if (Object.keys(photos).length > 0) {
      setPhotosByGoodId((prev) => ({ ...prev, ...photos }));
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        void loadMore();
      }
    });

    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, page]);

  const renderSellerHeader = () => {
    if (sellerLoading) {
      return <div className="seller-hero">Загрузка магазина…</div>;
    }

    if (!seller) {
      return (
        <div className="seller-hero">
          <p>Магазин не найден.</p>
          <Link to="/search" className="secondary-btn">
            Назад к поиску
          </Link>
        </div>
      );
    }

    return (
      <section className="seller-hero">
        <div className="seller-brand">
          <div className="seller-logo">
            {seller.logo_url ? (
              <img src={seller.logo_url} alt={seller.name} />
            ) : (
              <span className="seller-logo-placeholder">{seller.name[0]}</span>
            )}
          </div>
          <div className="seller-meta">
            <h1 className="seller-title">{seller.name}</h1>
            {seller.description && (
              <p className="seller-desc">{seller.description}</p>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="page">
      <Header />
      <main className="main">
        {renderSellerHeader()}

          {seller && (
            <section className="section">
              <h2 className="section-title">Товары магазина</h2>

              {goods.length === 0 && !sellerLoading ? (
                <p className="empty-state">У этого магазина пока нет товаров.</p>
              ) : (
                <>
                  <div className="products-grid">
                    {goods.map((g) => (
                      <ProductCard
                        key={g.id}
                        good={g}
                        photoUrl={photosByGoodId[g.id]}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div ref={loadMoreRef} className="load-more">
                      {loadingMore ? 'Загрузка…' : 'Подгрузить ещё'}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
      </main>
    </div>
  );
};

export default SellerPage;
