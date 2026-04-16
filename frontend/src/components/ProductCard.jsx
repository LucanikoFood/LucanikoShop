import { Card, Badge, Carousel } from 'react-bootstrap';
import './ProductCard.css';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/CartContext';
import { wishlistAPI } from '../services/api';
import { useState, useEffect, useRef, memo, useMemo } from 'react'; // ⚡ PERFORMANCE: memo
import { CloudinaryPresets } from '../utils/cloudinaryOptimizer';
import { toast } from 'react-toastify';

const ProductCard = ({ product, fromShop }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [carouselActive, setCarouselActive] = useState(false);
  const cardRef = useRef(null);

  // Calcola prezzo minimo, prezzo scontato minimo e stock totale se ci sono varianti usando useMemo
  const { minVariantPrice, minVariantDiscountedPrice, minVariantOriginalPrice, totalVariantStock } = useMemo(() => {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      return { minVariantPrice: null, minVariantDiscountedPrice: null, minVariantOriginalPrice: null, totalVariantStock: 0 };
    }
    
    const prices = product.variants.filter(v => typeof v.price === 'number').map(v => v.price);
    const discountedPrices = product.variants.filter(v => typeof v.discountedPrice === 'number').map(v => v.discountedPrice);
    const originalPrices = product.variants.filter(v => typeof v.originalPrice === 'number').map(v => v.originalPrice);
    const stocks = product.variants.filter(v => typeof v.stock === 'number').map(v => v.stock);
    
    return {
      minVariantPrice: prices.length > 0 ? Math.min(...prices) : null,
      minVariantDiscountedPrice: discountedPrices.length > 0 ? Math.min(...discountedPrices) : null,
      minVariantOriginalPrice: originalPrices.length > 0 ? Math.min(...originalPrices) : null,
      totalVariantStock: stocks.reduce((sum, stock) => sum + stock, 0)
    };
  }, [product.variants]);

  // Intersection Observer per animazione scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);

  // Verifica se il prodotto è nella wishlist
  useEffect(() => {
    const checkWishlist = async () => {
      if (user?.token) {
        try {
          const wishlistData = await wishlistAPI.getWishlist(user.token);
          const inWishlist = wishlistData.some(item => item.product?._id === product._id);
          setIsInWishlist(inWishlist);
        } catch (error) {
          console.error('Errore nel controllo wishlist:', error);
        }
      }
    };
    checkWishlist();
  }, [user, product._id]);

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    if (!user?.token) return;

    setLoading(true);
    try {
      if (isInWishlist) {
        await wishlistAPI.removeFromWishlist(product._id, user.token);
        setIsInWishlist(false);
      } else {
        await wishlistAPI.addToWishlist(product._id, user.token);
        setIsInWishlist(true);
      }
    } catch (error) {
      console.error('Errore gestione wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddToCart = (e) => {
    e.stopPropagation();
    
    // Se ha varianti, naviga alla pagina di dettaglio
    if (product.hasVariants && product.variants?.length > 0) {
      navigate(`/products/${product._id}`, fromShop ? { state: { fromShop } } : undefined);
      return;
    }
    
    // Altrimenti, aggiungi direttamente al carrello
    const hasStock = (typeof product.stock === 'number' && product.stock > 0) || totalVariantStock > 0;
    const isAvailable = hasStock && product.isActive;
    
    if (!isAvailable) {
      toast.error('Prodotto non disponibile');
      return;
    }
    
    addToCart(product);
    toast.success(`✅ ${product.name} aggiunto al carrello!`, {
      position: "top-right",
      autoClose: 2000,
    });
  };

  return (
    <div ref={cardRef} className={`product-card-wrapper ${isVisible ? 'fade-in-up' : ''}`}>
    <Card
      style={{
        cursor: 'pointer',
        height: '100%',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.12)',
        border: '2px solid transparent',
        transition: 'all 0.3s ease'
      }}
      onClick={e => {
        // Se il click è su una freccia del carosello, non aprire dettaglio
        if (
          e.target.closest('.carousel-control-prev') ||
          e.target.closest('.carousel-control-next')
        ) {
          e.stopPropagation();
          return;
        }
        // Passa lo stato fromShop se presente
        navigate(`/products/${product._id}`, fromShop ? { state: { fromShop } } : undefined);
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.16)';
        e.currentTarget.style.borderColor = '#004b75';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.12)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
      className="h-100"
    >
      {/* Cuore wishlist in alto a sinistra, solo per buyer loggato */}
      {user && user.role === 'buyer' && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 11,
            fontSize: 24,
            color: isInWishlist ? '#e74c3c' : '#ccc',
            background: 'rgba(255,255,255,0.85)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            cursor: loading ? 'wait' : 'pointer'
          }}
          title={isInWishlist ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
          onClick={handleWishlistToggle}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleWishlistToggle(e);
            }
          }}
        >
          <i className={`bi bi-heart${isInWishlist ? '-fill' : ''}`}></i>
        </span>
      )}

      {/* Badge sconto in alto a destra */}
      {product.hasActiveDiscount && (product.discountPercentage || product.discountAmount) && (
        <Badge className="badge-discount">
          {product.discountType === 'fixed' && product.discountAmount
            ? `-€${Math.round(product.discountAmount)}`
            : product.discountPercentage
            ? `-${product.discountPercentage}%`
            : ''}
        </Badge>
      )}
      
      {product.images && product.images.length > 0 ? (
        <Carousel
          interval={2500}
          indicators={false}
          controls={product.images.length > 1}
          className="product-card-carousel"
          onSlide={() => setCarouselActive(true)}
        >
          {product.images.map((img, idx) => (
            <Carousel.Item key={idx}>
              {/* Skeleton loader solo per prima immagine e se non ancora caricata */}
              {!imageLoaded && idx === 0 && (
                <div
                  style={{
                    height: '280px',
                    backgroundColor: '#f8f9fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    width: '100%',
                    top: 0,
                    left: 0,
                    zIndex: 1
                  }}
                >
                  <div className="spinner-border text-primary" role="status" style={{ width: '1.5rem', height: '1.5rem', opacity: 0.5 }}>
                    <span className="visually-hidden">Caricamento...</span>
                  </div>
                </div>
              )}
              
              <img
                src={CloudinaryPresets.productCard(img.url)}
                srcSet={`
                  ${CloudinaryPresets.productCardMobile(img.url)} 280w,
                  ${CloudinaryPresets.productCard(img.url)} 500w
                `}
                sizes="(max-width: 576px) 180px, 280px"
                alt={product.name}
                className="product-card-img"
                width="500"
                height="500"
                loading={idx === 0 ? 'eager' : 'lazy'}
                fetchPriority={idx === 0 ? 'high' : 'auto'}
                decoding="async"
                onLoad={() => idx === 0 && setImageLoaded(true)}
                style={{
                  opacity: imageLoaded || idx > 0 ? 1 : 0.3,
                  transition: 'opacity 0.2s ease-in-out'
                }}
              />
            </Carousel.Item>
          ))}
        </Carousel>
      ) : (
        <div
          style={{
            height: '280px',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span className="text-muted">Nessuna immagine</span>
        </div>
      )}

      <Card.Body className="d-flex flex-column">
        <Card.Title
          className="product-card-title"
          style={{
            fontWeight: 700,
            color: '#004b75'
          }}
        >
          {product.name}
        </Card.Title>
        {/* Nome azienda creatrice - altezza fissa per uniformità */}
        <div 
          className="text-muted small mb-2 product-card-seller" 
          style={{ 
            height: 20,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {fromShop?.shopName || (product.seller ? (product.seller.businessName || product.seller.name) : '\u00A0')}
        </div>

        {/* Rating e recensioni - altezza fissa sempre presente */}
        <div className="d-flex align-items-center mb-2 justify-content-between product-card-rating" style={{ height: 24 }}>
          {product.numReviews > 0 ? (
            <>
              <span style={{ color: '#FFD700', fontSize: '1em', marginRight: 4, lineHeight: 1 }}>
                {'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}
              </span>
              <span className="text-muted small" style={{ marginLeft: 4, lineHeight: 1 }}>
                {product.rating ? product.rating.toFixed(1) : '0.0'} ({product.numReviews})
              </span>
            </>
          ) : <span style={{ visibility: 'hidden' }}>{'\u00A0'}</span>}
        </div>

        <div className="d-flex flex-row flex-nowrap gap-2 mb-2 badge-category-row" style={{ height: 22 }}>
          <Badge className="badge-category-product">
            {typeof product.category === 'string' ? product.category : product.category?.name || 'N/A'}
          </Badge>
        </div>

        <div className="mt-auto">
          {/* Icona carrello quick add - posizionata sopra prezzo/badge */}
          <div className="d-flex justify-content-end mb-2">
            <span
              className="quick-add-cart-icon"
              onClick={handleQuickAddToCart}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleQuickAddToCart(e);
                }
              }}
              title={product.hasVariants ? 'Vedi varianti' : 'Aggiungi al carrello'}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#004b75',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#00bf63';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#004b75';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className="bi bi-cart-plus"></i>
            </span>
          </div>
          
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              {product.hasActiveDiscount && product.originalPrice && !product.hasVariants ? (
                <>
                  <h5 className="mb-0" style={{ fontSize: '1rem', color: '#004b75', fontWeight: 700 }}>
                    €{product.discountedPrice?.toFixed(2) || '0.00'}
                  </h5>
                  <small className="text-muted" style={{ textDecoration: 'line-through', fontSize: '0.85rem' }}>
                    €{product.originalPrice?.toFixed(2) || '0.00'}
                  </small>
                </>
              ) : product.hasActiveDiscount && product.hasVariants && minVariantDiscountedPrice !== null && minVariantOriginalPrice !== null ? (
                <>
                  <h5 className="mb-0" style={{ fontSize: '1rem', color: '#004b75', fontWeight: 700 }}>
                    da €{minVariantDiscountedPrice.toFixed(2)}
                  </h5>
                  <small className="text-muted" style={{ textDecoration: 'line-through', fontSize: '0.85rem' }}>
                    €{minVariantOriginalPrice.toFixed(2)}
                  </small>
                </>
              ) : (product.hasVariants || minVariantPrice !== null) ? (
                <h5 className="mb-0" style={{ fontSize: '1rem', color: '#004b75', fontWeight: 700 }}>
                  {minVariantPrice !== null ? `da €${minVariantPrice.toFixed(2)}` : (typeof product.price === 'number' ? `da €${product.price.toFixed(2)}` : 'Prezzo su varianti')}
                </h5>
              ) : typeof product.price === 'number' ? (
                <h5 className="mb-0" style={{ fontSize: '1rem', color: '#004b75', fontWeight: 700 }}>
                  €{product.price.toFixed(2)}
                </h5>
              ) : (
                <h5 className="text-muted mb-0">
                  <small>Prezzo non disponibile</small>
                </h5>
              )}
            </div>

            {(() => {
              const hasStock = (typeof product.stock === 'number' && product.stock > 0) || totalVariantStock > 0;
              const isAvailable = hasStock && product.isActive;
              if (!hasStock) {
                return <Badge className="badge-esaurito">Esaurito</Badge>;
              }
              return isAvailable ? (
                <>
                  <Badge className="badge-availability d-none d-sm-inline">Disponibile</Badge>
                  <Badge className="badge-availability d-inline d-sm-none">Disp.</Badge>
                </>
              ) : (
                <>
                  <Badge className="badge-not-available d-none d-sm-inline">Non disponibile</Badge>
                  <Badge className="badge-not-available d-inline d-sm-none">Non Disp.</Badge>
                </>
              );
            })()}
          </div>
        </div>
      </Card.Body>
    </Card>
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    price: PropTypes.number.isRequired,
    category: PropTypes.string.isRequired,
    stock: PropTypes.number.isRequired,
    unit: PropTypes.string.isRequired,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string.isRequired,
        public_id: PropTypes.string.isRequired,
      })
    ),
  fromShop: PropTypes.shape({
    sellerId: PropTypes.string.isRequired,
    shopName: PropTypes.string.isRequired,
  }),
  }).isRequired,
};

// ⚡ PERFORMANCE: Memoizza per evitare re-render inutili
// Re-render solo se cambia product._id o fromShop
export default memo(ProductCard, (prevProps, nextProps) => {
  return prevProps.product._id === nextProps.product._id &&
         prevProps.fromShop?.sellerId === nextProps.fromShop?.sellerId;
});

