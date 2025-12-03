import { useEffect, useMemo, useState } from 'react';
import type { Category, Good } from '../types';
import Header from '../components/Header';
import ProductCard from '../components/ProductCard';
import {
  PAGE_SIZE,
  fetchAllCategories,
  fetchMainPhotosForGoods,
  searchGoodsPage,
  type SearchFilters,
} from '../api/goods';

type CategoryWithParent = Category & {
  parent_id?: number | null;
};

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [mainPhotoByGoodId, setMainPhotoByGoodId] = useState<
    Record<string, string>
  >({});

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [openCategoryIds, setOpenCategoryIds] = useState<number[]>([]);

  /* ===================== ЗАГРУЗКА КАТЕГОРИЙ ===================== */

  useEffect(() => {
    const loadCategories = async () => {
      const cats = await fetchAllCategories();
      setCategories(cats);
    };

    void loadCategories();
  }, []);

  /* ====== Дерево категорий (родитель / подкатегории) ====== */

  const { rootCategories, subcatsByParentId } = useMemo(() => {
    const all = categories as CategoryWithParent[];
    const roots: CategoryWithParent[] = [];
    const subMap: Record<number, CategoryWithParent[]> = {};

    all.forEach((cat) => {
      const parentId = cat.parent_id ?? null;
      if (!parentId) {
        roots.push(cat);
      } else {
        if (!subMap[parentId]) subMap[parentId] = [];
        subMap[parentId].push(cat);
      }
    });

    return { rootCategories: roots, subcatsByParentId: subMap };
  }, [categories]);

  /* ===================== ФИЛЬТРЫ ДЛЯ ПОИСКА ===================== */

  const filters: SearchFilters = useMemo(
    () => ({
      query: searchQuery || undefined,
      categoryId: selectedCategoryId ?? undefined,
    }),
    [searchQuery, selectedCategoryId],
  );

  const applyFilters = async () => {
    setLoading(true);
    setHasMore(true);
    setPage(0);

    const firstPage = await searchGoodsPage(filters, 0);
    setGoods(firstPage);
    setLoading(false);

    const photosMap = await fetchMainPhotosForGoods(firstPage);
    setMainPhotoByGoodId(photosMap);

    if (firstPage.length < PAGE_SIZE) {
      setHasMore(false);
    }
  };

  const resetFilters = async () => {
    setSearchQuery('');
    setSelectedCategoryId(null);
    setGoods([]);
    setMainPhotoByGoodId({});
    setPage(0);
    setHasMore(true);

    await applyFilters();
  };

  useEffect(() => {
    void applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===================== ДОГРУЗКА СЛЕДУЮЩЕЙ СТРАНИЦЫ ===================== */

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    const nextData = await searchGoodsPage(filters, nextPage);
    setGoods((prev) => [...prev, ...nextData]);
    setPage(nextPage);
    setLoadingMore(false);

    const photosMap = await fetchMainPhotosForGoods(nextData);
    setMainPhotoByGoodId((prev) => ({ ...prev, ...photosMap }));

    if (nextData.length < PAGE_SIZE) {
      setHasMore(false);
    }
  };

  /* ===================== UI КАТЕГОРИЙ ===================== */

  const toggleCategoryOpen = (id: number) => {
    setOpenCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isRootActive = (catId: number) => {
    if (selectedCategoryId === catId) return true;
    const subcats = subcatsByParentId[catId] ?? [];
    return subcats.some((s) => s.id === selectedCategoryId);
  };

  /* ===================== РЕНДЕР ===================== */

  return (
    <div className="page">
      <Header
        showSearch
        searchPlaceholder="Поиск по товарам"
        searchValue={searchQuery}
        onSearchChange={(value) => setSearchQuery(value)}
      />

      <main className="main">
        <div className="search-layout">
          <aside className="sidebar">
            <h2 className="sidebar-title">Категории</h2>

            <div className="sidebar-cats">
              <button
                type="button"
                className={
                  selectedCategoryId == null
                    ? 'sidebar-all active'
                    : 'sidebar-all'
                }
                onClick={() => setSelectedCategoryId(null)}
              >
                Все категории
              </button>

              {rootCategories.map((cat) => {
                const subcats = subcatsByParentId[cat.id] ?? [];
                const hasSub = subcats.length > 0;
                const isOpen = openCategoryIds.includes(cat.id);
                const isActive = isRootActive(cat.id);

                return (
                  <div key={cat.id} className="sidebar-cat-group">
                    <button
                      type="button"
                      className={isActive ? 'sidebar-cat active' : 'sidebar-cat'}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      {hasSub && (
                        <span
                          className={
                            isOpen
                              ? 'sidebar-cat-toggle open'
                              : 'sidebar-cat-toggle'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryOpen(cat.id);
                          }}
                        >
                          ▶
                        </span>
                      )}
                      <span>{cat.category}</span>
                    </button>

                    {hasSub && isOpen && (
                      <div className="sidebar-subcats">
                        {subcats.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            className={
                              selectedCategoryId === sub.id
                                ? 'sidebar-subcat active'
                                : 'sidebar-subcat'
                            }
                            onClick={() => setSelectedCategoryId(sub.id)}
                          >
                            {sub.category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sidebar-actions">
              <button
                type="button"
                className="primary-btn sidebar-btn"
                onClick={applyFilters}
              >
                Применить
              </button>
              <button
                type="button"
                className="secondary-btn sidebar-btn"
                onClick={resetFilters}
              >
                Сбросить
              </button>
            </div>
          </aside>

          <section className="section search-results">
            <h1 className="section-title">Результаты поиска</h1>

            {loading ? (
              <div className="loading">Загрузка…</div>
            ) : (
              <>
                {goods.length === 0 ? (
                  <p className="empty-state">
                    Ничего не найдено. Попробуй изменить запрос или фильтры.
                  </p>
                ) : (
                  <div className="products-grid">
                    {goods.map((g) => (
                      <ProductCard
                        key={g.id}
                        good={g}
                        photoUrl={mainPhotoByGoodId[g.id]}
                      />
                    ))}
                  </div>
                )}

                {hasMore && goods.length > 0 && (
                  <div className="load-more">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default SearchPage;
