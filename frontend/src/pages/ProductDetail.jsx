import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
  Carousel,
  ListGroup,
  Modal,
} from 'react-bootstrap';
import { toast } from 'react-toastify';

import { productsAPI, API_URL } from '../services/api';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/CartContext';
import SuggestedProductsCarousel from '../components/SuggestedProductsCarousel';
import SEOHelmet from '../components/SEOHelmet';
import { CloudinaryPresets } from '../utils/cloudinaryOptimizer';


const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth() || {};
  const { addToCart, cartItems } = useCart() || {};

  // Recupera info shop se si arriva da ShopPage
  const fromShop = location.state?.fromShop;

  // STATE
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState('');
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Se il prodotto ha varianti, seleziona la prima combinazione valida all'apertura
  useEffect(() => {
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) return;
    if (Object.keys(selectedOptions).length > 0) return;
    const firstVariant = product.variants.find(v => v.active !== false) || product.variants[0];
    if (!firstVariant) return;
    const initialOptions = {};
    for (const attr of firstVariant.attributes) {
      initialOptions[attr.key] = attr.value;
    }
    setSelectedOptions(initialOptions);
  }, [product]);


  // Aggiorna selectedVariant quando cambia prodotto o selezione
  useEffect(() => {
    if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
      setSelectedVariant(null);
      return;
    }
    // Trova la variante che corrisponde alla selezione
    const found = product.variants.find(variant =>
      variant.attributes.every(attr => selectedOptions[attr.key] === attr.value)
    );
    setSelectedVariant(found || null);
  }, [product, selectedOptions]);

  // LOAD PRODUCT
  const loadProduct = async () => {
    try {
      setLoading(true);
      const data = await productsAPI.getById(id);
      setProduct(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Errore caricamento prodotto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (product) {
      // Prodotto caricato e pronto
    }
  }, [product]);

  // LOAD REVIEWS
  const loadReviews = async () => {
    try {
      setReviewLoading(true);
      setReviewError('');
      setDeleteSuccess('');
      setEditSuccess('');

      const res = await fetch(`${API_URL}/reviews/${id}`);
      if (!res.ok) {
        throw new Error(`Errore caricamento recensioni: status ${res.status}`);
      }

      const data = await res.json();
      setReviews(data);
    } catch (err) {
      console.error(err);
      setReviewError('Errore nel caricamento delle recensioni');
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [id]);

  // CHECK ACQUISTO
  const checkIfPurchased = async () => {
    if (!user) return setHasPurchased(false);

    try {
      const res = await fetch(`${API_URL}/orders/check-purchased/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      const data = await res.json();
      setHasPurchased(!!data.purchased);
    } catch (err) {
      console.error(err);
      setHasPurchased(false);
    }
  };

  useEffect(() => {
    checkIfPurchased();
  }, [id, user]);

  // HANDLERS RECENSIONI
  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setSubmitError('Devi essere loggato.');
      return;
    }
    if (!myComment.trim()) {
      setSubmitError('Il commento non può essere vuoto.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');

      const res = await fetch(`${API_URL}/reviews/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ rating: myRating, comment: myComment }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Errore invio recensione');

      setMyComment('');
      setMyRating(5);
      await loadReviews();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setEditRating(review.rating || 5);
    setEditComment(review.comment || '');
    setEditError('');
    setEditSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
    setEditRating(5);
    setEditComment('');
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      setEditError('Devi essere loggato.');
      return;
    }
    if (!editComment.trim()) {
      setEditError('Il commento non può essere vuoto.');
      return;
    }

    try {
      setEditSubmitting(true);

      const res = await fetch(`${API_URL}/reviews/${editingReview._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ rating: editRating, comment: editComment }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setEditSuccess('Recensione aggiornata.');
      setEditingReview(null);
      await loadReviews();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete review
  const handleDeleteReview = async (reviewId) => {
    if (!user) {
      toast.error('Devi essere loggato.');
      return;
    }

    if (!window.confirm('Sei sicuro di voler eliminare questa recensione?')) return;

    try {
      const res = await fetch(`${API_URL}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setDeleteSuccess('Recensione eliminata.');
      toast.success('Recensione eliminata con successo!');
      await loadReviews();
    } catch (err) {
      toast.error(err.message || 'Errore nell\'eliminazione della recensione');
    }
  };


  // ADD TO CART
  const handleAddToCart = () => {
    if (!product) return;
    
    if (product.hasVariants && product.variants?.length > 0 && !selectedVariant) {
      toast.error('Seleziona una variante prima di aggiungere al carrello');
      return;
    }
    
    let finalPrice = 0;
    
    // Se il prodotto ha varianti E una variante è selezionata
    if (product.hasVariants && selectedVariant) {
      // Usa il prezzo scontato della variante se disponibile, altrimenti il prezzo normale
      if (selectedVariant.discountedPrice != null) {
        finalPrice = selectedVariant.discountedPrice;
      } else if (selectedVariant.price != null) {
        finalPrice = selectedVariant.price;
      }
    } 
    // Se non ha varianti, usa il prezzo del prodotto
    else if (product.hasActiveDiscount && product.discountedPrice != null) {
      finalPrice = product.discountedPrice;
    } else if (product.originalPrice != null) {
      finalPrice = product.originalPrice;
    } else if (product.price != null) {
      finalPrice = product.price;
    }
    
    if (finalPrice === 0 || finalPrice == null) {
      toast.error('Impossibile determinare il prezzo del prodotto');
      return;
    }
    
    const productToAdd = {
      ...product,
      price: finalPrice,
      originalPrice: (product.hasVariants && selectedVariant?.originalPrice) || product.originalPrice || product.price || finalPrice,
      discountedPrice: (product.hasVariants && selectedVariant?.discountedPrice) || (product.hasActiveDiscount ? product.discountedPrice : undefined),
      hasActiveDiscount: (product.hasVariants && selectedVariant?.discountedPrice != null) || product.hasActiveDiscount || false,
      discountPercentage: product.discountPercentage || 0,
      ...(product.hasVariants && selectedVariant ? {
        selectedVariantSku: selectedVariant.sku,
        selectedVariantAttributes: selectedVariant.attributes,
        variantPrice: selectedVariant.price,
        stock: selectedVariant.stock  // Usa lo stock della variante selezionata
      } : {})
    };
    
    addToCart(productToAdd, 1);
    toast.success(`✅ ${product.name} aggiunto al carrello!`, {
      position: "top-right",
      autoClose: 2000,
    });
  };

  // ACQUISTA ORA
  const handleBuyNow = () => {
    if (!product) return;
    
    // Se il prodotto ha varianti, verifica che una variante sia selezionata
    if (product.hasVariants && product.variants?.length > 0 && !selectedVariant) {
      toast.error('Seleziona una variante prima di procedere');
      return;
    }
    
    let finalPrice = 0;
    
    // Se il prodotto ha varianti E una variante è selezionata
    if (product.hasVariants && selectedVariant) {
      // Usa il prezzo scontato della variante se disponibile, altrimenti il prezzo normale
      if (selectedVariant.discountedPrice != null) {
        finalPrice = selectedVariant.discountedPrice;
      } else if (selectedVariant.price != null) {
        finalPrice = selectedVariant.price;
      }
    } 
    // Se non ha varianti, usa il prezzo del prodotto
    else if (product.hasActiveDiscount && product.discountedPrice != null) {
      finalPrice = product.discountedPrice;
    } else if (product.originalPrice != null) {
      finalPrice = product.originalPrice;
    } else if (product.price != null) {
      finalPrice = product.price;
    }
    
    if (finalPrice === 0 || finalPrice == null) {
      toast.error('Impossibile determinare il prezzo del prodotto');
      return;
    }
    
    const productToAdd = {
      ...product,
      price: finalPrice,
      originalPrice: (product.hasVariants && selectedVariant?.originalPrice) || product.originalPrice || product.price || finalPrice,
      discountedPrice: (product.hasVariants && selectedVariant?.discountedPrice) || (product.hasActiveDiscount ? product.discountedPrice : undefined),
      hasActiveDiscount: (product.hasVariants && selectedVariant?.discountedPrice != null) || product.hasActiveDiscount || false,
      discountPercentage: product.discountPercentage || 0,
      ...(product.hasVariants && selectedVariant ? {
        selectedVariantSku: selectedVariant.sku,
        selectedVariantAttributes: selectedVariant.attributes,
        variantPrice: selectedVariant.price,
        stock: selectedVariant.stock  // Usa lo stock della variante selezionata
      } : {})
    };
    
    addToCart(productToAdd, 1);
    // Attendi che il carrello sia aggiornato, poi vai al checkout
    setTimeout(() => {
      navigate('/cart');
    }, 100);
  };

  // RENDER
  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-3">Caricamento prodotto...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button onClick={() => fromShop ? navigate(`/shop/${fromShop.sellerId}`) : navigate('/products')}>
          {fromShop ? `Torna al catalogo di ${fromShop.shopName}` : 'Torna al catalogo'}
        </Button>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container className="py-5">
        <Alert variant="warning">Prodotto non trovato</Alert>
        <Button onClick={() => fromShop ? navigate(`/shop/${fromShop.sellerId}`) : navigate('/products')}>
          {fromShop ? `Torna al catalogo di ${fromShop.shopName}` : 'Torna al catalogo'}
        </Button>
      </Container>
    );
  }

  return (
    <>
      <SEOHelmet
        title={`${product.name} - Lucaniko Shop`}
        description={product.description || `Acquista ${product.name} su Lucaniko Shop. ${product.category ? `Categoria: ${product.category.name}.` : ''} Prodotti tipici lucani di qualità.`}
        keywords={`${product.name}, ${product.category?.name || ''}, prodotti tipici lucani, lucaniko shop`}
        image={product.images?.[0] || 'https://lucanikoshop.it/Lucaniko Shop PNG solo testo-01.png'}
        url={`https://lucanikoshop.it/products/${product._id}`}
        type="product"
      />
      <Container className="py-5">
      <Button 
        variant="outline-secondary" 
        className="mb-4" 
        onClick={() => fromShop ? navigate(`/shop/${fromShop.sellerId}`) : navigate('/products')}
      >
        ← {fromShop ? `Torna al catalogo di ${fromShop.shopName}` : 'Torna al catalogo'}
      </Button>


      <Row>
        {/* COLONNA IMMAGINI */}
        <Col md={6}>
          {(() => {
            // Migrazione automatica: supporta sia images[] che image singola
            const variantImages = selectedVariant?.images && selectedVariant.images.length > 0 
              ? selectedVariant.images 
              : (selectedVariant?.image ? [selectedVariant.image] : null);
            
            if (variantImages && variantImages.length > 0) {
              // Mostra immagini della variante selezionata
              if (variantImages.length === 1) {
                // Singola immagine
                return (
                  <div>
                    <img
                      className="d-block w-100"
                      src={variantImages[0]}
                      alt={`${product.name} - ${selectedVariant.attributes.map(a => a.label || a.value).join(' ')}`}
                      style={{ 
                        maxHeight: '520px',
                        width: '100%',
                        objectFit: 'contain', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
                      }}
                    />
                  </div>
                );
              } else {
                // Carousel per più immagini
                return (
                  <Carousel indicators={false}>
                    {variantImages.map((image, index) => (
                      <Carousel.Item key={index}>
                        <img
                          className="d-block w-100"
                          src={image}
                          alt={`${product.name} - ${selectedVariant.attributes.map(a => a.label || a.value).join(' ')} - ${index + 1}`}
                          style={{ 
                            maxHeight: '520px',
                            width: '100%',
                            objectFit: 'contain', 
                            borderRadius: '8px' 
                          }}
                        />
                      </Carousel.Item>
                    ))}
                  </Carousel>
                );
              }
            } else if (product.images?.length > 0) {
              // Mostra immagini del prodotto base
              return (
                <Carousel indicators={false}>
                  {product.images.map((image, index) => (
                    <Carousel.Item key={index}>
                      <img
                        className="d-block w-100"
                        src={CloudinaryPresets.productDetail(image.url)}
                        srcSet={`
                          ${CloudinaryPresets.productCard(image.url)} 400w,
                          ${CloudinaryPresets.productDetail(image.url)} 800w,
                          ${CloudinaryPresets.productGallery(image.url)} 1200w
                        `}
                        sizes="(max-width: 768px) 400px, (max-width: 1200px) 800px, 1200px"
                        alt={`${product.name} - ${index + 1}`}
                        style={{ 
                          maxHeight: '520px',
                          width: '100%',
                          objectFit: 'contain', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
                        }}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'low'}
                        decoding="async"
                      />
                    </Carousel.Item>
                  ))}
                </Carousel>
              );
            } else {
              return (
                <div
                  style={{
                    height: '520px',
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                  }}
                >
                  <span className="text-muted">Nessuna immagine disponibile</span>
                </div>
              );
            }
          })()}
        </Col>

        {/* COLONNA DETTAGLI */}

        <Col md={6}>
          <div className="mb-3">
            <Badge className="badge-category-product mb-2">
              {typeof product.category === 'string' ? product.category : product.category?.name || 'N/A'}
            </Badge>
            <h2 style={{ color: '#004b75', fontWeight: 700 }}>{product.name}</h2>
          </div>

          {/* VENDITORE */}
          {product.seller && (
            <Card className="mb-3">
              <Card.Body>
                <h5 style={{ color: '#00bf63', fontWeight: 700 }}>Venduto da</h5>
                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <strong>Azienda:</strong>{' '}
                    <span
                      style={{
                        cursor: 'pointer',
                        color: '#004b75',
                        textDecoration: 'underline',
                        textDecorationColor: '#004b75',
                        textDecorationThickness: '2px',
                        textUnderlineOffset: '2px',
                        WebkitTextDecorationColor: '#004b75',
                        fontWeight: 600,
                        transition: 'color 0.2s, text-decoration-color 0.2s'
                      }}
                      onClick={() => navigate(`/shop/${product.seller?.slug || product.seller?._id}`)}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#00bf63';
                        e.currentTarget.style.textDecorationColor = '#00bf63';
                        e.currentTarget.style.WebkitTextDecorationColor = '#00bf63';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#004b75';
                        e.currentTarget.style.textDecorationColor = '#004b75';
                        e.currentTarget.style.WebkitTextDecorationColor = '#004b75';
                      }}
                    >
                      {product.seller.businessName || product.seller.name}
                    </span>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => navigate(`/shop/${product.seller?.slug || product.seller?._id}`)}
                    >
                      Vedi tutti i prodotti di questo venditore →
                    </Button>
                  </ListGroup.Item>
                </ListGroup>
              </Card.Body>
            </Card>
          )}

          {/* VARIANTI: Selezione e prezzo dinamico */}
          <Card className="mb-3">
            <Card.Body>
              {Array.isArray(product.variants) && product.variants.length > 0 && product.customAttributes ? (
                <>
                  {/* Selettori per ogni attributo variante */}
                  {product.customAttributes.filter(a => a.allowVariants && a.options?.length > 0).map(attr => (
                    <div key={attr.key} className="mb-2">
                      <strong style={{ color: '#00bf63' }}>{attr.name}:</strong>{' '}
                      <select
                        value={selectedOptions[attr.key] || ''}
                        onChange={e => {
                          setSelectedOptions(opts => ({ ...opts, [attr.key]: e.target.value }));
                        }}
                        style={{ minWidth: 120, padding: '4px 8px' }}
                      >
                        <option value="">Seleziona...</option>
                        {attr.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {/* Prezzo e disponibilità variante selezionata */}
                  {selectedVariant ? (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div>
                        {(product.hasActiveDiscount || selectedVariant.discountedPrice != null) && (selectedVariant.originalPrice != null || product.originalPrice != null) ? (
                          <>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span style={{ color: '#004b75', fontWeight: 700, fontSize: '1.2rem' }}>
                                €{typeof selectedVariant.discountedPrice === 'number' ? selectedVariant.discountedPrice.toFixed(2) : (typeof selectedVariant.price === 'number' ? selectedVariant.price.toFixed(2) : product.discountedPrice.toFixed(2))}
                              </span>
                              <Badge style={{backgroundColor: '#004b75', color: '#fff'}} className="ms-2">
                                {product.discountType === 'fixed' && product.discountAmount
                                  ? `-€${Math.round(product.discountAmount)}`
                                  : product.discountPercentage
                                  ? `-${product.discountPercentage}%`
                                  : ''}
                              </Badge>
                            </div>
                            <div>
                              <small className="text-muted" style={{ textDecoration: 'line-through' }}>
                                €{typeof selectedVariant.originalPrice === 'number' ? selectedVariant.originalPrice.toFixed(2) : (product.originalPrice != null ? product.originalPrice.toFixed(2) : selectedVariant.price.toFixed(2))}
                              </small>
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#004b75', fontWeight: 700, fontSize: '1.2rem' }}>
                            €{typeof selectedVariant.price === 'number' ? selectedVariant.price.toFixed(2) : (typeof product.price === 'number' ? product.price.toFixed(2) : '—')}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const hasStock = selectedVariant.stock > 0;
                        const isAvailable = hasStock && product.isActive;
                        if (!hasStock) {
                          return <Badge bg="danger">✗ Esaurito</Badge>;
                        }
                        return isAvailable ? (
                          <Badge bg="success">✓ Disponibile ({selectedVariant.stock})</Badge>
                        ) : (
                          <Badge bg="secondary">Non disponibile</Badge>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <h5 className="text-muted mb-0">Seleziona una variante per vedere prezzo e disponibilità</h5>
                      <Badge bg="secondary">—</Badge>
                    </div>
                  )}
                </>
              ) : (
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    {product.hasActiveDiscount && product.discountedPrice && product.originalPrice ? (
                      <>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span style={{ color: '#004b75', fontWeight: 700, fontSize: '1.2rem' }}>
                            €{product.discountedPrice.toFixed(2)}
                          </span>
                          <Badge style={{backgroundColor: '#004b75', color: '#fff'}} className="ms-2">
                            {product.discountType === 'fixed' && product.discountAmount
                              ? `-€${Math.round(product.discountAmount)}`
                              : product.discountPercentage
                              ? `-${product.discountPercentage}%`
                              : ''}
                          </Badge>
                        </div>
                        <div>
                          <small className="text-muted" style={{ textDecoration: 'line-through' }}>
                            €{product.originalPrice.toFixed(2)}
                          </small>
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#004b75', fontWeight: 700, fontSize: '1.2rem' }}>
                        €{typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const hasStock = product.stock > 0;
                    const isAvailable = hasStock && product.isActive;
                    if (!hasStock) {
                      return <Badge bg="danger">✗ Esaurito</Badge>;
                    }
                    return isAvailable ? (
                      <Badge bg="success">✓ Disponibile</Badge>
                    ) : (
                      <Badge bg="secondary">Non disponibile</Badge>
                    );
                  })()}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* BOTTONI */}
          <div className="d-grid gap-2">
            <Button
              variant="primary"
              size="lg"
              className="btn-custom-cart"
              disabled={
                (Array.isArray(product.variants) && product.variants.length > 0)
                  ? !(selectedVariant && selectedVariant.stock > 0 && product.isActive)
                  : !(product.stock > 0 && product.isActive)
              }
              onClick={handleAddToCart}
            >
              {(Array.isArray(product.variants) && product.variants.length > 0)
                ? (selectedVariant && selectedVariant.stock > 0 && product.isActive
                    ? '🛒 Aggiungi al carrello (Jamm bell!)'
                    : '🛒 Aggiungi al carrello (Jamm bell!)')
                : (product.stock > 0 && product.isActive ? '🛒 Aggiungi al carrello' : 'Non disponibile')}
            </Button>
            <Button
              variant="success"
              size="lg"
              className="mt-2"
              disabled={
                (Array.isArray(product.variants) && product.variants.length > 0)
                  ? !(selectedVariant && selectedVariant.stock > 0 && product.isActive)
                  : !(product.stock > 0 && product.isActive)
              }
              onClick={handleBuyNow}
            >
              {(Array.isArray(product.variants) && product.variants.length > 0)
                ? (selectedVariant && selectedVariant.stock > 0 && product.isActive
                    ? '🌶️ Acquista Ora (Mò Stess!)'
                    : '🌶️ Acquista Ora (Mò Stess!)')
                  : (product.stock > 0 && product.isActive ? '🌶️ Acquista Ora (Mò Stess!)' : 'Non disponibile')}
            </Button>
          </div>

          {/* DESCRIZIONE */}
          {product.description && (
            <Card className="mb-3 mt-3">
              <Card.Body>
                <h5 style={{ color: '#00bf63', fontWeight: 700 }}>Descrizione</h5>
                <p style={{ whiteSpace: 'pre-line' }}>
                  {showFullDescription 
                    ? product.description 
                    : (() => {
                        const lines = product.description.split('\n');
                        const first10Lines = lines.slice(0, 10).join('\n');
                        // Se il preview è ancora più lungo di 800 caratteri, tronca
                        return first10Lines.length > 800 ? first10Lines.substring(0, 800) + '...' : first10Lines;
                      })()
                  }
                </p>
                {(product.description.split('\n').length > 10 || product.description.length > 800) && (
                  <Button 
                    variant="link" 
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    style={{ 
                      padding: 0, 
                      textDecoration: 'none',
                      color: '#004b75',
                      fontWeight: 600,
                      border: 'none',
                      outline: 'none',
                      boxShadow: 'none'
                    }}
                  >
                    {showFullDescription ? 'Riduci' : 'Leggi tutto...'}
                  </Button>
                )}
              </Card.Body>
            </Card>
          )}

          {/* RECENSIONI */}
          <Card className="mb-3">
            <Card.Body>
              <h5 style={{ color: '#00bf63', fontWeight: 700 }}>Recensioni</h5>
              {deleteSuccess && <Alert variant="success">{deleteSuccess}</Alert>}
              {editSuccess && <Alert variant="success">{editSuccess}</Alert>}

              {reviewLoading ? (
                <Spinner animation="border" size="sm" />
              ) : reviewError ? (
                <Alert variant="danger">{reviewError}</Alert>
              ) : reviews.length === 0 ? (
                <p>Nessuna recensione per questo prodotto.</p>
              ) : (
                <div>
                  <div className="d-flex align-items-center mb-3">
                    <span style={{ color: '#FFD700', fontSize: '1.5rem' }}>
                      {'★'.repeat(Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
                      {'☆'.repeat(5 - Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length))}
                    </span>
                    <span className="ms-3" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                      {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}/5.0
                    </span>
                    <span className="ms-2 text-muted">
                      ({reviews.length} {reviews.length === 1 ? 'recensione' : 'recensioni'})
                    </span>
                  </div>
                  <Button 
                    variant="outline-primary" 
                    onClick={() => setShowReviewsModal(true)}
                  >
                    Vedi tutte le recensioni
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* FORM RECENSIONE SOLO SE ACQUISTATO */}

          {user &&
            hasPurchased &&
            !reviews.some((r) => r.user?._id === user._id) && (
              <Card className="mb-3">
                <Card.Body>
                  <h6>Lascia una recensione</h6>
                  <form onSubmit={handleReviewSubmit}>
                    <div className="mb-2">
                      <label>Rating:</label>
                      <select
                        className="ms-2"
                        value={myRating}
                        onChange={(e) => setMyRating(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="form-control mb-2"
                      rows={2}
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value)}
                      placeholder="Scrivi un commento..."
                      required
                    />
                    {submitError && <Alert variant="danger">{submitError}</Alert>}
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Invio...' : 'Invia recensione'}
                    </Button>
                  </form>
                </Card.Body>
              </Card>
            )}

          {/* MESSAGGIO SE NON HA ACQUISTATO */}
          {user && !hasPurchased && (
            <Alert variant="info" style={{ background: '#fff', border: 'none', color: '#004b75', fontWeight: 500 }}>
              Puoi lasciare una recensione solo dopo aver acquistato questo prodotto.
            </Alert>
          )}

          
        </Col>
      </Row>

      {/* Caroselli prodotti suggeriti - mostrati solo se il prodotto è caricato */}
      {product && (
        <>
          <SuggestedProductsCarousel 
            cartItems={[product]}
            sameVendor={true}
            title="Altri prodotti dello stesso venditore"
            titleColor="#004b75"
          />
          
          <SuggestedProductsCarousel 
            cartItems={[product]}
            sameVendor={false}
            title="Prodotti simili da altre aziende lucane"
            titleColor="#00bf63"
          />
        </>
      )}

      {/* MODALE RECENSIONI */}
      <Modal 
        show={showReviewsModal} 
        onHide={() => setShowReviewsModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Tutte le recensioni</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {reviews.length === 0 ? (
            <p>Nessuna recensione disponibile.</p>
          ) : (
            <ListGroup variant="flush">
              {reviews.map((r) => (
                <ListGroup.Item key={r._id}>
                  <div className="d-flex align-items-center mb-1">
                    <span style={{ color: '#FFD700' }}>
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </span>

                    <strong className="ms-2">{r.user?.name?.split(' ')[0] || 'Cliente'}</strong>

                    <small className="text-muted ms-2">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </small>

                    {r.isAutomatic && (
                      <span 
                        className="ms-2 badge" 
                        style={{ 
                          backgroundColor: '#17a2b8', 
                          color: 'white',
                          fontSize: '0.7rem'
                        }}
                      >
                        ✓ Acquisto Verificato
                      </span>
                    )}

                    {r.isVerified && !r.isAutomatic && (
                      <span 
                        className="ms-2 badge" 
                        style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white',
                          fontSize: '0.7rem'
                        }}
                      >
                        ✓ Acquisto Verificato
                      </span>
                    )}
                  </div>

                  <div>{r.comment}</div>

                  {r.updatedAt && r.updatedAt !== r.createdAt && (
                    <div className="text-muted" style={{ fontSize: '0.9em' }}>
                      Recensione modificata il {new Date(r.updatedAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Pulsante modifica */}
                  {user && r.user?._id === user._id && !editingReview && (() => {
                    // Permetti la modifica solo se non è già stata modificata una volta
                    const created = new Date(r.createdAt);
                    const updated = new Date(r.updatedAt);
                    const now = new Date();
                    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
                    const alreadyEdited = r.updatedAt && r.updatedAt !== r.createdAt;
                    if (diffDays <= 30 && !alreadyEdited) {
                      return (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="mt-2 me-2"
                          onClick={() => {
                            handleEditReview(r);
                            setShowReviewsModal(false);
                          }}
                        >
                          Modifica
                        </Button>
                      );
                    } else if (alreadyEdited) {
                      return (
                        <div className="text-muted mt-2" style={{ fontSize: '0.9em' }}>
                          Modifica già effettuata
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-muted mt-2" style={{ fontSize: '0.9em' }}>
                          Modifica non più consentita
                        </div>
                      );
                    }
                  })()}

                  {/* Pulsante elimina */}
                  {user &&
                    ((r.user?._id === user._id &&
                      (() => {
                        const created = new Date(r.createdAt);
                        const now = new Date();
                        const diffDays = (now - created) / (1000 * 60 * 60 * 24);
                        return diffDays <= 30;
                      })()) ||
                      user.role === 'admin') && (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          handleDeleteReview(r._id);
                          setShowReviewsModal(false);
                        }}
                      >
                        Elimina
                      </Button>
                    )}

                  {/* FORM modifica */}
                  {editingReview && editingReview._id === r._id && (
                    <form onSubmit={handleEditSubmit} className="mt-2">
                      <div className="mb-2">
                        <label>Rating:</label>
                        <select
                          className="ms-2"
                          value={editRating}
                          onChange={e => setEditRating(Number(e.target.value))}
                        >
                          {[5, 4, 3, 2, 1].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        className="form-control mb-2"
                        rows={2}
                        value={editComment}
                        onChange={e => setEditComment(e.target.value)}
                        placeholder="Scrivi un commento..."
                        required
                      />
                      {editError && <Alert variant="danger">{editError}</Alert>}
                      <div className="d-flex gap-2">
                        <Button type="submit" variant="primary" size="sm" disabled={editSubmitting}>
                          {editSubmitting ? 'Salvataggio...' : 'Salva'}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={handleCancelEdit}>
                          Annulla
                        </Button>
                      </div>
                    </form>
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReviewsModal(false)}>
            Chiudi
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
    </>
  );
};

export default ProductDetail;
