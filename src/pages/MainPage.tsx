// src/pages/MainPage.tsx
import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import type { Good } from '../types';
import {
  PAGE_SIZE,
  fetchGoodsPage,
  fetchHotGoods,
  fetchMainPhotosForGoods,
} from '../api/goods';

// items per slide: 4 on desktop, 1 on narrow (mobile)
// we'll compute this responsively so slider shows 4 items on PC and 1 on mobile

const MainPage = () => {
  const [goods, setGoods] = useState<Good[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [hotGoods, setHotGoods] = useState<Good[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  const [itemsPerSlide, setItemsPerSlide] = useState<number>(() => {
    try {
      return window.innerWidth >= 1024 ? 4 : 1;
    } catch {
      return 4;
    }
  });

  const [mainPhotoByGoodId, setMainPhotoByGoodId] = useState<
    Record<string, string>
  >({});

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  /* -------------------- Стартовая загрузка товаров -------------------- */
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setHasMore(true);
      setPage(0);

      const firstPage = await fetchGoodsPage(0);
      setGoods(firstPage);
      setLoading(false);

      const photosMap = await fetchMainPhotosForGoods(firstPage);
      if (Object.keys(photosMap).length > 0) {
        setMainPhotoByGoodId((prev) => ({ ...prev, ...photosMap }));
      }

      if (firstPage.length < PAGE_SIZE) setHasMore(false);
    };

    void loadInitial();
  }, []);

  /* -------------------- Догрузка страниц (инфинит скролл) -------------------- */
  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    const nextData = await fetchGoodsPage(nextPage);
    setGoods((prev) => [...prev, ...nextData]);
    setPage(nextPage);
    setLoadingMore(false);

    const photosMap = await fetchMainPhotosForGoods(nextData);
    if (Object.keys(photosMap).length > 0) {
      setMainPhotoByGoodId((prev) => ({ ...prev, ...photosMap }));
    }

    if (nextData.length < PAGE_SIZE) setHasMore(false);
  };

  /* -------------------- Бесконечный скролл -------------------- */
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
  }, [hasMore, loadingMore, page]);

  /* -------------------- Горячие предложения -------------------- */
  useEffect(() => {
    const loadHot = async () => {
      const hot = await fetchHotGoods();
      setHotGoods(hot);

      const photosMap = await fetchMainPhotosForGoods(hot);
      if (Object.keys(photosMap).length > 0) {
        setMainPhotoByGoodId((prev) => ({ ...prev, ...photosMap }));
      }
    };

    void loadHot();
  }, []);

  const totalHotSlides = hotGoods.length
    ? Math.ceil(hotGoods.length / itemsPerSlide)
    : 0;

  /* -------------------- Автопереключение слайдера -------------------- */
  useEffect(() => {
    if (totalHotSlides <= 1) return;

    const id = setInterval(() => {
      setActiveSlide((prev) => (prev + 1 >= totalHotSlides ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(id);
  }, [totalHotSlides]);

  /* -------------------- responsive items per slide -------------------- */
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const next = w >= 1024 ? 4 : 1;
      setItemsPerSlide(next);
    };

    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  useEffect(() => {
    setActiveSlide(0);
  }, [itemsPerSlide]);

  /* ================================================================ */

  return (
    <div className="page">
      <Header />

      <main className="main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-text">
            <h1>Рынок вещей, сделанных руками</h1>
            <p>
              Авторские картины, керамика, одежда и подарки от независимых
              мастеров. Находи вещи с историей — без миллионов одинаковых лотов.
            </p>
          </div>
        </section>

        {/* -------------------- Слайдер горячих товаров -------------------- */}
        {hotGoods.length > 0 && (
          <section className="section section-hot">
            <h2 className="section-title">Горячие предложения</h2>

            <div className="hot-slider">
              <div className="hot-slider-viewport">
                <div
                  className="hot-slider-track"
                  style={{
                    transform: `translateX(-${activeSlide * 100}%)`,
                  }}
                >
                  {Array.from({ length: totalHotSlides }).map((_, idx) => {
                    const start = idx * itemsPerSlide;
                    const slideGoods = hotGoods.slice(start, start + itemsPerSlide);

                    return (
                      <div className="hot-slide" key={idx}>
                        {slideGoods.map((g) => (
                          <ProductCard
                            key={g.id}
                            good={g}
                            variant="hot"
                            photoUrl={mainPhotoByGoodId[g.id]}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {totalHotSlides > 1 && (
                <div className="hot-dots">
                  {Array.from({ length: totalHotSlides }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={idx === activeSlide ? 'hot-dot active' : 'hot-dot'}
                      onClick={() => setActiveSlide(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* -------------------- Все товары (бесконечный скролл) -------------------- */}
        {loading ? (
          <div className="loading">Загрузка…</div>
        ) : (
          <section className="section">
            <h2 className="section-title">Все товары</h2>

            <div className="products-grid">
              {goods.map((g) => (
                <ProductCard
                  key={g.id}
                  good={g}
                  photoUrl={mainPhotoByGoodId[g.id]}
                />
              ))}
            </div>

            {hasMore && (
              <div ref={loadMoreRef} className="load-more">
                {loadingMore ? 'Загрузка…' : 'Прокрутите вниз'}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default MainPage;
