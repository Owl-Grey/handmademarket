import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Good, GoodPhoto, Seller } from '../types';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  fetchGoodById,
  fetchGoodPhotos,
  fetchGoodMeta,
} from '../api/goods';
import {
  getCartCountForGood,
  changeCartItemCount,
} from '../api/cart';
import { fetchSellerById } from '../api/sellers';

const ProductPage = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Good | null>(null);
  const [photos, setPhotos] = useState<GoodPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [materialName, setMaterialName] = useState<string | null>(null);
  const [colorName, setColorName] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [subcategoryName, setSubcategoryName] = useState<string | null>(null);

  const [cartCount, setCartCount] = useState<number | null>(null);
  const [cartUpdating, setCartUpdating] = useState(false);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      setLoading(true);
      setNotFound(false);

      try {
        const good = await fetchGoodById(id);

        if (!good) {
          setProduct(null);
          setPhotos([]);
          setNotFound(true);
          return;
        }

        setProduct(good);

        const [photosData, meta, sellerData] = await Promise.all([
          fetchGoodPhotos(good.id),
          fetchGoodMeta(good),
          good.seller_id ? fetchSellerById(good.seller_id) : Promise.resolve(null),
        ]);

        setPhotos(photosData);
        setActivePhotoId(photosData.length > 0 ? photosData[0].id : null);

        setMaterialName(meta.materialName);
        setColorName(meta.colorName);
        setCategoryName(meta.categoryName);
        setSubcategoryName(meta.subcategoryName);
        setSeller(sellerData);
      } catch (e) {
        console.error('Load product error', e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  useEffect(() => {
    const loadCartCount = async () => {
      if (!user || !product) {
        setCartCount(null);
        return;
      }

      try {
        const count = await getCartCountForGood(user.id, product.id);
        setCartCount(count);
      } catch (e) {
        console.error('loadCartCount error', e);
        setCartCount(null);
      }
    };

    void loadCartCount();
  }, [user, product]);

  const mainPhoto = photos.find((p) => p.id === activePhotoId) ?? photos[0];
  const thumbnails = photos;
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // when active photo changes, reset loaded state to trigger fade-in
    setPhotoLoaded(false);

    // if image is already in cache and complete, mark as loaded after render
    const check = () => {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) {
        setPhotoLoaded(true);
      }
    };

    // small timeout to allow DOM update (img ref attached)
    const t = setTimeout(check, 20);
    return () => clearTimeout(t);
  }, [activePhotoId]);

  const characteristics: { label: string; value: string }[] = [];

  if (product?.width || product?.length || product?.height) {
    const sizeParts: string[] = [];

    if (product.width) sizeParts.push(`${product.width} см (ширина)`);
    if (product.length) sizeParts.push(`${product.length} см (длина)`);
    if (product.height) sizeParts.push(`${product.height} см (высота)`);

    characteristics.push({
      label: 'Размер',
      value: sizeParts.join(' × '),
    });
  }
  if (materialName) {
    characteristics.push({ label: 'Материал', value: materialName });
  }
  if (colorName) {
    characteristics.push({ label: 'Цвет', value: colorName });
  }
  if (categoryName) {
    characteristics.push({ label: 'Категория', value: categoryName });
  }
  if (subcategoryName) {
    characteristics.push({ label: 'Подкатегория', value: subcategoryName });
  }

  const changeCartCount = async (delta: number) => {
    if (!user) {
      alert('Чтобы управлять корзиной, нужно войти в аккаунт.');
      return;
    }
    if (!product) return;
    if (cartUpdating) return;

    setCartUpdating(true);

    try {
      const newCount = await changeCartItemCount(user.id, product.id, delta);
      setCartCount(newCount);
      window.dispatchEvent(new Event('cart-updated'));
    } catch (e) {
      console.error('changeCartCount error', e);
      alert('Не удалось изменить количество товара в корзине');
    } finally {
      setCartUpdating(false);
    }
  };

  const addToCart = () => {
    void changeCartCount(1);
  };

  useEffect(() => {
    const loadFav = async () => {
      if (!user || !product) {
        setIsFavorite(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('favorites_goods')
          .select('id')
          .eq('user_id', user.id)
          .eq('good_id', product.id)
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
  }, [user, product]);

  const toggleFavorite = async () => {
    if (!user || !product) {
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
          .match({ user_id: user.id, good_id: product.id });

        if (error) throw error;
        setIsFavorite(false);
        window.dispatchEvent(new Event('favorites-updated'));
      } else {
        const { data, error } = await supabase
          .from('favorites_goods')
          .insert({ user_id: user.id, good_id: product.id })
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

  const stock = (product as any)?.count ?? null;

  return (
    <div className="page">
      <Header />
      <main className="main product-page">
        {loading ? (
          <div className="loading">Загружаем товар…</div>
        ) : notFound || !product ? (
          <div className="empty">
            Товар не найден. <Link to="/search">Вернуться к каталогу</Link>
          </div>
        ) : (
          <>
            <div className="product-page-layout">
              <section className="product-page-gallery">
                <div className="product-page-image-main">
                  {mainPhoto ? (
                    <img
                      key={mainPhoto.id}
                      ref={imgRef}
                      src={mainPhoto.url}
                      alt={product.title}
                      className={`img-fade ${photoLoaded ? 'loaded' : ''}`}
                      loading="eager"
                      onLoad={() => setPhotoLoaded(true)}
                      onError={() => setPhotoLoaded(false)}
                    />
                  ) : (
                    <div className="photo-placeholder">НЕТ ФОТО</div>
                  )}
                </div>

                {thumbnails.length > 1 && (
                  <div className="product-page-thumbs">
                    {thumbnails.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className={
                          photo.id === mainPhoto?.id
                            ? 'product-page-thumb active'
                            : 'product-page-thumb'
                        }
                        onClick={() => setActivePhotoId(photo.id)}
                      >
                        <img src={photo.url} alt="" className="thumb-img img-fade" onLoad={(e)=>e.currentTarget.classList.add('loaded')} />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="product-page-info">
                <h1 className="product-page-title">{product.title}</h1>

                {categoryName && (
                  <div className="product-page-breadcrumbs">
                    <span>{categoryName}</span>
                    {subcategoryName && <span> / {subcategoryName}</span>}
                  </div>
                )}

                <div className="product-page-main-row">
                <div className="product-page-description">
                  {product.description ? (
                    <p>{product.description}</p>
                  ) : (
                    <p className="muted">
                        Автор пока не добавил описание этого товара.
                      </p>
                    )}
                  </div>

                  <div className="product-page-order">
                    {seller && (
                      <Link to={`/seller/${seller.id}`} className="product-seller-chip">
                        <div className="product-seller-logo">
                          {seller.logo_url ? (
                            <img src={seller.logo_url} alt={seller.name} />
                          ) : (
                            <span>{seller.name[0]}</span>
                          )}
                        </div>
                        <div className="product-seller-meta">
                          <span className="product-seller-label">Магазин</span>
                          <span className="product-seller-name">{seller.name}</span>
                        </div>
                        <span className="product-seller-arrow" aria-hidden="true">→</span>
                      </Link>
                    )}

                    <div className="product-page-price">
                      {product.price.toLocaleString('ru-RU')} ₽
                    </div>

                    {stock != null && (
                      <div className="product-page-stock">
                        В наличии: {stock} шт.
                      </div>
                    )}

                    {/* actions row: favorite + add-to-cart / qty */}
                    <div className="product-order-actions">
                      <button
                        type="button"
                        className={`fav-btn ${isFavorite ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void toggleFavorite();
                        }}
                        aria-pressed={isFavorite}
                        title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                      >
                        ♥
                      </button>

                      {cartCount && cartCount > 0 ? (
                        <div className="product-order-qty">
                        <button
                          type="button"
                          className="product-order-qty-btn"
                          onClick={() => changeCartCount(-1)}
                          disabled={cartUpdating}
                        >
                          −
                        </button>
                        <span className="product-order-qty-value">
                          {cartCount}
                        </span>
                        <button
                          type="button"
                          className="product-order-qty-btn"
                          onClick={() => changeCartCount(1)}
                          disabled={cartUpdating}
                        >
                          +
                        </button>
                      </div>
                      ) : (
                        <button
                          type="button"
                          className="product-page-add"
                          onClick={addToCart}
                          disabled={cartUpdating}
                        >
                          Добавить в корзину
                        </button>
                      )}
                    </div>

                    {!user && (
                      <p className="product-page-auth-hint">
                        Чтобы оформить заказ, <Link to="/auth">войдите в аккаунт</Link>.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {characteristics.length > 0 && (
              <section className="product-page-extra">
                <h2 className="section-title">Характеристики</h2>
                <div className="product-chars">
                  {characteristics.map((row) => (
                    <div key={row.label} className="product-char-row">
                      <span className="product-char-label">{row.label}</span>
                      <span className="product-char-value">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ProductPage;
