import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Alert, Badge, Form, Spinner, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/authContext';
import { checkoutAPI, API_URL } from '../services/api';
import { toast } from 'react-toastify';
import SuggestedProductsCarousel from '../components/SuggestedProductsCarousel';
import SEOHelmet from '../components/SEOHelmet';
import AlertModal from '../components/AlertModal';
import { CloudinaryPresets } from '../utils/cloudinaryOptimizer';

const Cart = () => {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    cartItems, 
    cartCount, 
    cartTotal, 
    updateQuantity, 
    removeFromCart, 
    clearCart,
    appliedCoupon,
    discountAmount,
    applyCoupon,
    removeCoupon
  } = useCart();

  // State per gestione guest checkout
  const [guestEmail, setGuestEmail] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);

  // State per gestione coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // State per gestione spedizione
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingDetails, setShippingDetails] = useState(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShippingOption, setSelectedShippingOption] = useState(null);

  // State per gestione termini e condizioni venditore
  const [vendorTerms, setVendorTerms] = useState({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(false);

  // State per modale privacy policy
  
  // Stato per AlertModal
  const [alertModal, setAlertModal] = useState({ show: false, message: '', type: 'info' });
  
  // Funzione helper per mostrare alert modal
  const showAlert = (message, type = 'info') => {
    setAlertModal({ show: true, message, type });
  };
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Stato per il paese e la regione di spedizione
  const [shippingCountry, setShippingCountry] = useState('Italia');
  const [shippingRegion, setShippingRegion] = useState('');

  // State per nazioni disponibili in base ai venditori
  const [availableCountries, setAvailableCountries] = useState(['Italia']);
  const [vendorCountries, setVendorCountries] = useState({});
  const [unshippableProducts, setUnshippableProducts] = useState([]);
  const [availableItalianRegions, setAvailableItalianRegions] = useState([
    'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 
    'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 
    'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 
    'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'
  ]);

  // State per gestione ritiro in negozio
  const [deliveryType, setDeliveryType] = useState('shipping'); // 'shipping' | 'pickup'
  const [vendorInfo, setVendorInfo] = useState(null);
  const [loadingVendor, setLoadingVendor] = useState(false);
  const [vendorAllowsPickup, setVendorAllowsPickup] = useState(false);

  // Rileva numero di vendor unici nel carrello
  const uniqueVendors = [...new Set(cartItems.map(item => item.seller?._id || item.seller))];
  const isSingleVendor = uniqueVendors.length === 1;
  const vendorId = isSingleVendor ? uniqueVendors[0] : null;

  // Calcola costo spedizione
  const calculateShipping = async () => {
    // Salta calcolo se ritiro in negozio
    if (deliveryType === 'pickup') {
      setShippingCost(0);
      setShippingDetails(null);
      setShippingOptions([]);
      setSelectedShippingOption(null);
      return;
    }

    if (cartCount === 0) return;

    setLoadingShipping(true);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (user) {
        headers.Authorization = `Bearer ${user.token}`;
      }

      const res = await fetch(`${API_URL}/orders/calculate-shipping`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartItems.map(item => ({
            product: item._id,
            quantity: item.quantity,
            price: item.price
          })),
          shippingAddress: {
            country: shippingCountry,
            state: shippingCountry === 'Italia' ? shippingRegion : ''
          }
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setShippingCost(data.totalShipping || 0);
        setShippingDetails(data.vendorShippingCosts || null);
        
        // Salva prodotti non spedibili nella nazione selezionata
        if (data.unshippableVendors && data.unshippableVendors.length > 0) {
          const unshippableProductIds = data.unshippableVendors.flatMap(v => v.productIds);
          setUnshippableProducts(unshippableProductIds);
        } else {
          setUnshippableProducts([]);
        }
        
        // Estrai le opzioni di spedizione disponibili (solo per singolo venditore)
        const allOptions = [];
        if (data.vendorShippingCosts) {
          Object.values(data.vendorShippingCosts).forEach(vendorShipping => {
            if (vendorShipping.shippingOptions && vendorShipping.shippingOptions.length > 0) {
              allOptions.push(...vendorShipping.shippingOptions);
            }
          });
        }
        setShippingOptions(allOptions);
        
        // Seleziona automaticamente l'opzione più economica SOLO per singolo venditore
        // Nel caso multi-venditore, manteniamo sempre totalShipping
        const vendorCount = data.vendorShippingCosts ? Object.keys(data.vendorShippingCosts).length : 0;
        if (allOptions.length > 0 && vendorCount === 1) {
          const cheapest = allOptions.reduce((min, opt) => opt.price < min.price ? opt : min, allOptions[0]);
          setSelectedShippingOption(cheapest);
          setShippingCost(cheapest.price);
        } else {
          // Multi-venditore: usa sempre totalShipping
          setSelectedShippingOption(null);
        }
      } else {
        console.error('Errore calcolo spedizione:', data.message);
        setShippingCost(0);
        setShippingDetails(null);
        setShippingOptions([]);
        setSelectedShippingOption(null);
        setUnshippableProducts([]);
      }
    } catch (error) {
      console.error('Errore nella richiesta calcolo spedizione:', error);
      setShippingCost(0);
      setShippingDetails(null);
    } finally {
      setLoadingShipping(false);
    }
  };

  // Recupera le nazioni disponibili per spedizione
  const fetchAvailableCountries = async () => {
    if (cartCount === 0) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user) {
        headers.Authorization = `Bearer ${user.token}`;
      }

      const res = await fetch(`${API_URL}/orders/available-countries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartItems.map(item => ({
            product: item._id,
            quantity: item.quantity,
            price: item.price
          }))
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAvailableCountries(data.allCountries || ['Italia']);
        setVendorCountries(data.vendorCountries || {});
        
        // Aggiorna le regioni italiane disponibili
        if (data.availableItalianRegions && data.availableItalianRegions.length > 0) {
          setAvailableItalianRegions(data.availableItalianRegions);
        } else {
          // Default: tutte le regioni
          setAvailableItalianRegions([
            'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 
            'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 
            'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 
            'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta', 'Veneto'
          ]);
        }
      }
    } catch (error) {
      console.error('Errore nel recupero nazioni disponibili:', error);
      setAvailableCountries(['Italia']);
    }
  };

  // Recupera nazioni disponibili quando il carrello cambia
  useEffect(() => {
    fetchAvailableCountries();
  }, [cartItems]);

  // Ricalcola spedizione quando il carrello, il paese, la regione o il tipo di consegna cambiano
  useEffect(() => {
    calculateShipping();
  }, [cartItems, user, shippingCountry, shippingRegion, deliveryType]);

  // Recupera i termini e condizioni del venditore
  useEffect(() => {
    const fetchVendorTerms = async () => {
      if (cartItems.length === 0) return;

      setLoadingTerms(true);
      try {
        const vendorId = cartItems[0]?.seller?._id || cartItems[0]?.seller;
        
        if (vendorId) {
          const res = await fetch(`${API_URL}/vendors/${vendorId}`);
          const data = await res.json();
          
          const vendorData = data.vendor || data;

          if (res.ok && vendorData.shopSettings?.termsAndConditions?.content) {
            setVendorTerms({
              vendorId,
              vendorName: vendorData.businessName || 'Venditore',
              termsText: vendorData.shopSettings.termsAndConditions.content
            });
          }
        }
      } catch (error) {
        console.error('Errore recupero termini venditore:', error);
      } finally {
        setLoadingTerms(false);
      }
    };

    fetchVendorTerms();
  }, [cartItems]);

  // Verifica se il venditore permette il ritiro in negozio (sempre per singolo venditore)
  useEffect(() => {
    const checkVendorPickupOption = async () => {
      if (!isSingleVendor || !vendorId) {
        setVendorAllowsPickup(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/vendors/${vendorId}`);
        const data = await res.json();
        const vendorData = data.vendor || data;

        if (res.ok) {
          setVendorAllowsPickup(vendorData.shopSettings?.shipping?.allowStorePickup || false);
        } else {
          setVendorAllowsPickup(false);
        }
      } catch (error) {
        console.error('Errore verifica opzione ritiro:', error);
        setVendorAllowsPickup(false);
      }
    };

    checkVendorPickupOption();
  }, [vendorId, isSingleVendor]);

  // Recupera info negozio quando ritiro selezionato
  useEffect(() => {
    const fetchVendorInfo = async () => {
      if (deliveryType !== 'pickup' || !isSingleVendor || !vendorId) {
        setVendorInfo(null);
        return;
      }

      setLoadingVendor(true);
      try {
        const res = await fetch(`${API_URL}/vendors/${vendorId}`);
        const data = await res.json();
        
        const vendorData = data.vendor || data;

        if (res.ok) {
          setVendorInfo({
            businessName: vendorData.businessName || 'Negozio',
            storeAddress: vendorData.storeAddress || {},
            businessPhone: vendorData.businessPhone || '',
            businessEmail: vendorData.businessEmail || vendorData.email || ''
          });
        }
      } catch (error) {
        console.error('Errore recupero info negozio:', error);
        setVendorInfo(null);
      } finally {
        setLoadingVendor(false);
      }
    };

    fetchVendorInfo();
  }, [deliveryType, vendorId, isSingleVendor]);

  const handleCheckout = async () => {
    if (cartCount === 0) return;

    if (!acceptedTerms) {
      showAlert('Devi accettare i Termini e Condizioni per procedere.', 'warning');
      return;
    }

    // Blocca checkout se ci sono prodotti non spedibili nella nazione selezionata
    if (unshippableProducts.length > 0 && deliveryType === 'shipping') {
      toast.error(`Impossibile procedere: alcuni prodotti non sono spedibili in ${shippingCountry}. Seleziona una nazione diversa o rimuovi i prodotti dal carrello.`);
      return;
    }

    if (!user && !guestEmail) {
      setShowGuestForm(true);
      return;
    }

    setIsCheckingOut(true);
    try {
      const { sessionId, url } = await checkoutAPI.createSession(
        cartItems,
        user ? user.token : null,
        guestEmail,
        appliedCoupon,
        discountAmount,
        deliveryType  // ✅ Passa il tipo di consegna
      );

      localStorage.setItem('cart', JSON.stringify(cartItems));
      await new Promise(resolve => setTimeout(resolve, 100));

      window.location.href = url;
    } catch (error) {
      console.error('Errore durante il checkout:', error);
      toast.error('Errore durante il checkout. Riprova.');
      setIsCheckingOut(false);
    }
  };


  // Funzione per applicare il coupon (simulazione calcolo lato client)
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Inserisci un codice coupon');
      return;
    }

    setApplyingCoupon(true);
    setCouponError('');

    try {
      // Verifica coupon tramite API
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Aggiungi token solo se l'utente è autenticato
      if (user?.token) {
        headers.Authorization = `Bearer ${user.token}`;
      }

      const res = await fetch(`${API_URL}/discounts/validate-coupon`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          couponCode: couponCode.toUpperCase(),
          cartTotal
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Codice coupon non valido');
      }

      // Calcola il subtotale dei prodotti del venditore che ha creato il coupon
      // Converti in stringa per confronto corretto degli ObjectId
      const couponSellerId = String(data.discount.seller);
      const vendorSubtotal = cartItems
        .filter(item => {
          const itemSellerId = String(item.seller?._id || item.seller || '');
          return itemSellerId === couponSellerId;
        })
        .reduce((total, item) => {
          const price = item.discountedPrice || item.originalPrice || item.price || 0;
          return total + (price * item.quantity);
        }, 0);

      if (vendorSubtotal === 0) {
        throw new Error('Questo coupon è valido solo per i prodotti del venditore che lo ha creato');
      }

      // Calcola lo sconto SOLO sul subtotale del venditore
      let discount = 0;
      if (data.discount.discountType === 'percentage') {
        discount = (vendorSubtotal * data.discount.discountValue) / 100;
        
        // Applica limite massimo se presente
        if (data.discount.maxDiscountAmount && discount > data.discount.maxDiscountAmount) {
          discount = data.discount.maxDiscountAmount;
        }
      } else if (data.discount.discountType === 'fixed') {
        discount = data.discount.discountValue;
        
        // Lo sconto non può essere maggiore del subtotale del venditore
        if (discount > vendorSubtotal) {
          discount = vendorSubtotal;
        }
      }

      applyCoupon(data.discount, parseFloat(discount.toFixed(2)));
      setCouponError('');
    } catch (err) {
      setCouponError(err.message);
      removeCoupon();
    } finally {
      setApplyingCoupon(false);
    }
  };

  // Rimuovi coupon applicato
  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponCode('');
    setCouponError('');
  };

  // ...existing code...

  // Calcola il totale finale con sconto e spedizione
  const finalTotal = cartTotal + shippingCost - discountAmount;

  // Determina se un prodotto riceve lo sconto coupon
  const isProductDiscountedByCoupon = (item) => {
    if (!appliedCoupon || !appliedCoupon.seller) return false;
    const couponSellerId = String(appliedCoupon.seller);
    const itemSellerId = String(item.seller?._id || item.seller || '');
    return itemSellerId === couponSellerId;
  };


  if (cartCount === 0) {
    return (
      <Container className="py-5">
        <Card className="text-center p-5">
          <Card.Body>
            <div style={{ fontSize: '5rem' }}>🛒</div>
            <h3 className="mt-3">Il tuo carrello è vuoto</h3>
            <p className="text-muted">Aggiungi prodotti per iniziare!</p>
            <Button variant="primary" onClick={() => navigate('/products')}>
              Vai al Catalogo
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <>
      <SEOHelmet
        title="Carrello - Lucaniko Shop"
        description="Completa il tuo ordine su Lucaniko Shop. Prodotti tipici lucani selezionati per te."
        keywords="carrello, checkout, ordine, lucaniko shop"
        url="https://lucanikoshop.it/cart"
      />
      <Container className="py-5">
        <Row>
        <Col md={8}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 style={{ color: '#004b75', fontWeight: 700 }}>Il tuo Carrello</h2>
            <div>
              {/* ...rimosso Fix Prezzi... */}
              <Button variant="outline-danger" size="sm" onClick={clearCart}>
                Svuota Carrello
              </Button>
            </div>
          </div>

          <ListGroup>
            {cartItems.map((item) => (
              <ListGroup.Item key={item._id} className="p-3">
                <Row className="align-items-center">
                  <Col md={2}>
                    {item.images && item.images.length > 0 ? (
                      <img
                        src={CloudinaryPresets.thumbnail(item.images[item.images.length - 1].url)}
                        alt={item.name}
                        style={{ width: '100%', height: '80px', objectFit: 'contain', borderRadius: '8px' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '80px', backgroundColor: '#f0f0f0', borderRadius: '8px' }} />
                    )}
                  </Col>

                  <Col md={4}>
                    <h5 className="mb-1">{item.name}</h5>
                    {item.seller?.businessName && (
                      <p className="text-muted mb-2" style={{ fontSize: '0.9rem' }}>
                        <i className="bi bi-shop"></i> {item.seller.businessName}
                      </p>
                    )}
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <Badge className="badge-category-product">{typeof item.category === 'string' ? item.category : item.category?.name || 'N/A'}</Badge>
                      {isProductDiscountedByCoupon(item) && (
                        <Badge bg="success" className="d-inline-flex align-items-center gap-1">
                          <i className="bi bi-ticket-perforated-fill"></i>
                          Coupon applicato
                        </Badge>
                      )}
                      {unshippableProducts.includes(item._id) && deliveryType === 'shipping' && (
                        <Badge bg="warning" text="dark" className="d-inline-flex align-items-center gap-1">
                          <i className="bi bi-exclamation-triangle-fill"></i>
                          Non spedibile in {shippingCountry}
                        </Badge>
                      )}
                    </div>
                  </Col>

                  <Col md={2}>
                    {item.hasActiveDiscount && item.discountedPrice && item.originalPrice ? (
                      <>
                        <div className="d-flex align-items-center gap-1">
                          <strong style={{ color: '#004b75' }}>€{item.discountedPrice.toFixed(2)}</strong>
                          <Badge className="badge-discount-small">
                            {item.discountType === 'fixed' && item.discountAmount
                              ? `-€${Math.round(item.discountAmount)}`
                              : item.discountPercentage
                              ? `-${item.discountPercentage}%`
                              : ''}
                          </Badge>
                        </div>
                        <small className="text-muted d-block" style={{ textDecoration: 'line-through' }}>
                          €{item.originalPrice.toFixed(2)}
                        </small>
                      </>
                    ) : (
                      <>
                        <strong>€{typeof item.price === 'number' && !isNaN(item.price) ? item.price.toFixed(2) : '0.00'}</strong>
                      </>
                    )}
                  </Col>

                  <Col md={2}>
                    <Form.Group>
                      <Form.Label className="small">Quantità</Form.Label>
                      
                      {/* Desktop: input classico */}
                      <Form.Control
                        type="number"
                        min="1"
                        max={item.stock}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item._id, parseInt(e.target.value))}
                        className="d-none d-md-block"
                      />
                      
                      {/* Mobile: pulsanti + e - */}
                      <div className="d-flex d-md-none align-items-center justify-content-center gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => updateQuantity(item._id, Math.max(1, item.quantity - 1))}
                          disabled={item.quantity <= 1}
                          style={{
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            borderColor: '#004b75',
                            color: '#004b75',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                          }}
                        >
                          <i className="bi bi-dash"></i>
                        </Button>
                        <span style={{ 
                          minWidth: '35px', 
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          color: '#004b75'
                        }}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => updateQuantity(item._id, Math.min(item.stock, item.quantity + 1))}
                          disabled={item.quantity >= item.stock}
                          style={{
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            borderColor: '#00bf63',
                            color: '#00bf63',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                          }}
                        >
                          <i className="bi bi-plus"></i>
                        </Button>
                      </div>
                    </Form.Group>
                  </Col>

                  <Col md={2} className="text-end">
                    <div className="mb-2">
                      {item.hasActiveDiscount && item.discountedPrice ? (
                        <>
                          <strong style={{ color: '#004b75' }}>€{(item.discountedPrice * item.quantity).toFixed(2)}</strong>
                          <small className="d-block text-muted" style={{ textDecoration: 'line-through', fontSize: '0.8rem' }}>
                            €{(item.originalPrice * item.quantity).toFixed(2)}
                          </small>
                        </>
                      ) : (
                        <strong>€{(typeof item.price === 'number' && typeof item.quantity === 'number' && !isNaN(item.price * item.quantity)) ? (item.price * item.quantity).toFixed(2) : '0.00'}</strong>
                      )}
                    </div>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeFromCart(item._id)}
                    >
                      Rimuovi
                    </Button>
                  </Col>
                </Row>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Col>

        <Col md={4}>
          <Card className="sticky-top" style={{ top: '100px' }}>
            <Card.Header>
              <h5 className="mb-0" style={{ color: '#004b75', fontWeight: 700 }}>Riepilogo Ordine</h5>
            </Card.Header>
            <Card.Body>
              {/* Avviso prodotti non spedibili */}
              {unshippableProducts.length > 0 && deliveryType === 'shipping' && (
                <Alert variant="warning" className="mb-3 small">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  <strong>Attenzione:</strong> {unshippableProducts.length} prodotto{unshippableProducts.length > 1 ? 'i' : ''} non {unshippableProducts.length > 1 ? 'sono spedibili' : 'è spedibile'} in <strong>{shippingCountry}</strong>. 
                  {!isSingleVendor && ' Seleziona una nazione diversa o rimuovi i prodotti per procedere.'}
                </Alert>
              )}
              
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Prodotti ({cartCount})</span>
                  <strong>€{cartTotal.toFixed(2)}</strong>
                </ListGroup.Item>
                <ListGroup.Item className="d-flex justify-content-between">
                  <span>Spedizione</span>
                  {loadingShipping ? (
                    <Spinner animation="border" size="sm" />
                  ) : shippingCost === 0 ? (
                    <Badge bg="success">GRATIS</Badge>
                  ) : (
                    <strong>€{shippingCost.toFixed(2)}</strong>
                  )}
                </ListGroup.Item>
                

                {/* Selezione tipo di consegna */}
                <ListGroup.Item>
                  <Form.Group className="mb-0">
                    <Form.Label className="small mb-2 fw-bold">Tipo di Consegna</Form.Label>
                    <div className="d-flex flex-column gap-2">
                      <Form.Check
                        type="radio"
                        id="delivery-shipping"
                        name="deliveryType"
                        label="📦 Spedizione a domicilio"
                        value="shipping"
                        checked={deliveryType === 'shipping'}
                        onChange={(e) => setDeliveryType(e.target.value)}
                      />
                      <Form.Check
                        type="radio"
                        id="delivery-pickup"
                        name="deliveryType"
                        label="🏪 Ritiro in negozio"
                        value="pickup"
                        checked={deliveryType === 'pickup'}
                        onChange={(e) => setDeliveryType(e.target.value)}
                        disabled={!isSingleVendor || !vendorAllowsPickup}
                      />
                      {!isSingleVendor ? (
                        <small className="text-muted ms-4">
                          ℹ️ Disponibile solo per ordini da un singolo negozio
                        </small>
                      ) : !vendorAllowsPickup ? (
                        <small className="text-muted ms-4">
                          ℹ️ Questo venditore non offre il ritiro in negozio
                        </small>
                      ) : null}
                    </div>
                  </Form.Group>

                  {/* Mostra indirizzo negozio se ritiro selezionato */}
                  {deliveryType === 'pickup' && isSingleVendor && (
                    <div className="mt-3 p-3 bg-light rounded">
                      {loadingVendor ? (
                        <div className="text-center">
                          <Spinner animation="border" size="sm" />
                          <p className="small mb-0 mt-2">Caricamento info negozio...</p>
                        </div>
                      ) : vendorInfo ? (
                        <>
                          <h6 className="mb-2 fw-bold" style={{ color: '#004b75' }}>
                            📍 Punto Ritiro
                          </h6>
                          <p className="mb-1 fw-bold">{vendorInfo.businessName}</p>
                          {vendorInfo.storeAddress && (
                            <>
                              <p className="mb-1 small">
                                {vendorInfo.storeAddress.street}
                              </p>
                              <p className="mb-1 small">
                                {vendorInfo.storeAddress.zipCode} {vendorInfo.storeAddress.city} ({vendorInfo.storeAddress.state})
                              </p>
                              {vendorInfo.storeAddress.country && (
                                <p className="mb-1 small">{vendorInfo.storeAddress.country}</p>
                              )}
                            </>
                          )}
                          {vendorInfo.businessPhone && (
                            <p className="mb-1 small">
                              <strong>Tel:</strong> {vendorInfo.businessPhone}
                            </p>
                          )}
                          {vendorInfo.businessEmail && (
                            <p className="mb-0 small">
                              <strong>Email:</strong> {vendorInfo.businessEmail}
                            </p>
                          )}
                          <Alert variant="info" className="mt-2 mb-0 small">
                            💡 <strong>Importante:</strong> Contattare il venditore prima del ritiro per concordare orari e modalità.
                          </Alert>
                        </>
                      ) : (
                        <Alert variant="warning" className="mb-0 small">
                          ⚠️ Informazioni negozio non disponibili
                        </Alert>
                      )}
                    </div>
                  )}
                </ListGroup.Item>

                {/* Dropdown selezione paese e regione - solo se spedizione */}
                {deliveryType === 'shipping' && (
                  <>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center">
                      <Form.Group className="w-100 mb-0">
                        <Form.Label className="small mb-1">Spedisci in</Form.Label>
                        <Form.Select
                          value={shippingCountry}
                          onChange={e => setShippingCountry(e.target.value)}
                          aria-label="Seleziona paese di spedizione"
                        >
                          {availableCountries.map(country => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                        </Form.Select>
                        {!isSingleVendor && (
                          <Form.Text className="text-muted small">
                            ℹ️ Alcuni venditori potrebbero non spedire in tutte le nazioni
                          </Form.Text>
                        )}
                      </Form.Group>
                    </ListGroup.Item>

                    {/* Dropdown regione se Italia */}
                    {shippingCountry === 'Italia' && (
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <Form.Group className="w-100 mb-0">
                          <Form.Label className="small mb-1">Regione</Form.Label>
                          <Form.Select
                            value={shippingRegion}
                            onChange={e => setShippingRegion(e.target.value)}
                            aria-label="Seleziona regione"
                          >
                            <option value="">Seleziona regione</option>
                            {availableItalianRegions.map(region => (
                              <option key={region} value={region}>{region}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </ListGroup.Item>
                    )}
                  </>
                )}

                {/* Sconto applicato */}
                {appliedCoupon && discountAmount > 0 && (
                  <ListGroup.Item className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="text-success">Sconto ({appliedCoupon.couponCode})</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 ms-2 border-0 shadow-none remove-discount-x-mobile"
                        onClick={handleRemoveCoupon}
                        style={{ textDecoration: 'none', border: 'none', boxShadow: 'none' }}
                      >
                        ✕
                      </Button>
                    </div>
                    <strong className="text-success">-€{discountAmount.toFixed(2)}</strong>
                  </ListGroup.Item>
                )}



                <ListGroup.Item className="d-flex justify-content-between">
                  <h5 className="mb-0">Totale</h5>
                  <h5 className="mb-0" style={{ color: '#004b75' }}>€{finalTotal.toFixed(2)}</h5>
                </ListGroup.Item>
              </ListGroup>

              {/* Campo Coupon */}
              {!appliedCoupon && (
                <div className="mt-3">
                  <Form.Group>
                    <Form.Label className="small">Hai un codice sconto?</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="text"
                        placeholder="Inserisci codice"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      />
                      <Button
                        variant="outline-primary"
                        onClick={handleApplyCoupon}
                        disabled={applyingCoupon || !couponCode.trim()}
                      >
                        {applyingCoupon ? 'Verifica...' : 'Applica'}
                      </Button>
                    </div>
                    {couponError && (
                      <Form.Text className="text-danger">
                        {couponError}
                      </Form.Text>
                    )}
                  </Form.Group>
                </div>
              )}

              {/* Form Email Guest se non loggato */}
              {!user && showGuestForm && (
                <Alert variant="info" className="mt-3">
                  <h6>Procedi come ospite</h6>
                  <p className="small mb-2">Inserisci la tua email per ricevere la conferma d'ordine. Non è necessario registrarsi!</p>
                  <Form.Group>
                    <Form.Control
                      type="email"
                      placeholder="La tua email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <div className="d-flex gap-2 mt-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={handleCheckout}
                      disabled={
                        !guestEmail || 
                        !/\S+@\S+\.\S+/.test(guestEmail) || 
                        (unshippableProducts.length > 0 && deliveryType === 'shipping')
                      }
                      title={
                        unshippableProducts.length > 0 && deliveryType === 'shipping'
                          ? `Impossibile procedere: prodotti non spedibili in ${shippingCountry}`
                          : ''
                      }
                    >
                      Conferma e procedi
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowGuestForm(false)}
                    >
                      Annulla
                    </Button>
                  </div>
                  <div className="text-center mt-2">
                    <small>Oppure <Button variant="link" size="sm" className="p-0" onClick={() => navigate('/login')}>accedi</Button> / <Button variant="link" size="sm" className="p-0" onClick={() => navigate('/register')}>registrati</Button></small>
                  </div>
                </Alert>
              )}

              {/* Checkbox Termini e Condizioni - Sempre visibile */}
              <Form.Group className="mt-3">
                <Form.Check
                  type="checkbox"
                  id="accept-vendor-terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  label={
                    <span>
                      Confermando l'ordine dichiaro di aver letto e accettato i{' '}
                      <Button
                        variant="link"
                        className="p-0 text-decoration-underline border-0 shadow-none no-hover-effect"
                        style={{ fontSize: '0.9rem', verticalAlign: 'baseline', border: 'none', boxShadow: 'none', cursor: 'pointer', background: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          setShowTermsModal(true);
                        }}
                      >
                        Termini
                      </Button>
                      {' '}e la{' '}
                      <Button
                        variant="link"
                        className="p-0 text-decoration-underline border-0 shadow-none no-hover-effect"
                        style={{ fontSize: '0.9rem', verticalAlign: 'baseline', border: 'none', boxShadow: 'none', cursor: 'pointer', background: 'none' }}
                        onClick={(e) => {
                          e.preventDefault();
                          setShowPrivacyModal(true);
                        }}
                      >
                        Privacy Policy
                      </Button>
                      {' '}di Lucaniko Shop e le Condizioni Generali di Vendita dei Venditori presenti nel mio carrello, con i quali concludo separati contratti di vendita (consultabili nelle rispettive pagine Venditore).
                    </span>
                  }
                  required
                />
              </Form.Group>

              <div className="d-grid gap-2 mt-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/billing-info', { 
                    state: { 
                      deliveryType,
                      vendorInfo: deliveryType === 'pickup' ? vendorInfo : null
                    } 
                  })}
                  disabled={
                    isCheckingOut || 
                    !acceptedTerms || 
                    (unshippableProducts.length > 0 && deliveryType === 'shipping')
                  }
                  title={
                    unshippableProducts.length > 0 && deliveryType === 'shipping'
                      ? `Impossibile procedere: ${unshippableProducts.length} prodotto/i non spedibile/i in ${shippingCountry}`
                      : ''
                  }
                >
                  {isCheckingOut ? (
                    'Caricamento...'
                  ) : (
                    <>
                      {/* Desktop: tutto su una riga */}
                      <span className="d-none d-md-inline">
                        Procedi all'acquisto (Na cos r iurn!)
                      </span>
                      
                      {/* Mobile: testo su due righe */}
                      <div className="d-flex d-md-none flex-column align-items-center" style={{ 
                        fontSize: '0.95rem',
                        lineHeight: '1.4'
                      }}>
                        <span style={{ marginBottom: '3px', fontSize: '1.2rem' }}>Procedi all'acquisto</span>
                        <span style={{ fontSize: '0.9em' }}>(Na cos r iurn!)</span>
                      </div>
                    </>
                  )}
                </Button>
                <Button variant="outline-secondary" onClick={() => navigate('/products')}>
                  ← Continua lo shopping
                </Button>
              </div>

              {shippingCost === 0 ? (
                <Alert variant="success" className="mt-3 small mb-0">
                  <strong>🎉 Spedizione gratuita</strong> per questo ordine!
                </Alert>
              ) : (
                <Alert variant="info" className="mt-3 small mb-0">
                  <strong>📦 Spedizione:</strong> I costi variano in base al peso e alla destinazione.
                  {shippingDetails && Object.keys(shippingDetails).length > 1 && (
                    <div className="mt-2">
                      <div className="small fw-bold mb-1">Dettaglio spedizioni per venditore:</div>
                      {Object.entries(shippingDetails).map(([vendorId, details]) => (
                        <div key={vendorId} className="small d-flex justify-content-between align-items-center mb-1">
                          <span className="text-muted">• {details.vendorName || 'Venditore'}</span>
                          <span className="fw-bold">€{(details.shippingCost || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <hr className="my-2" />
                      <div className="small d-flex justify-content-between align-items-center">
                        <span className="fw-bold">Totale Spedizione:</span>
                        <span className="fw-bold text-primary">€{shippingCost.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Caroselli prodotti suggeriti - mostrati solo se ci sono prodotti nel carrello */}
      {cartItems && cartItems.length > 0 && (
        <>
          <SuggestedProductsCarousel 
            cartItems={cartItems}
            sameVendor={true}
            title="Altri prodotti dello stesso venditore"
            titleColor="#004b75"
          />
          
          <SuggestedProductsCarousel 
            cartItems={cartItems}
            sameVendor={false}
            title="Prodotti simili da altre aziende lucane"
            titleColor="#00bf63"
          />
        </>
      )}

      {/* Modale Termini Acquirenti */}
      <Modal show={showTermsModal} onHide={() => setShowTermsModal(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Termini & Condizioni Acquirenti – Lucaniko Shop</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 28 }}>
              <strong>1.1 Oggetto</strong>
              <div style={{ marginTop: 6 }}>
                Lucaniko Shop consente agli Acquirenti di acquistare prodotti venduti da Venditori terzi.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.2 Ruolo della Piattaforma</strong>
              <div style={{ marginTop: 6 }}>
                Lucaniko Shop non è parte del contratto di vendita (salvo diversa indicazione). Il contratto è tra Acquirente e Venditore.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.3 Ordini multi-venditore</strong>
              <div style={{ marginTop: 6 }}>
                Checkout unico, ma vendite separate per Venditore: spedizioni/resi/rimborsi/documenti fiscali separati.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.4 Informazioni su prodotti e prezzi</strong>
              <div style={{ marginTop: 6 }}>
                Responsabilità del Venditore. Immagini indicative. Prezzi e IVA come indicato dal Venditore.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.5 Spedizioni</strong>
              <div style={{ marginTop: 6 }}>
                Gestite dal Venditore; costi e tempi visibili prima della conferma.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.6 Recesso (consumatori) e eccezioni – deperibili</strong>
              <div style={{ marginTop: 6 }}>
                Il consumatore può recedere entro 14 giorni salvo eccezioni previste dal Codice del Consumo, tra cui (a titolo esemplificativo):
                <ul className="d-flex flex-column align-items-center" style={{ marginTop: 8 }}>
                  <li>beni deperibili o che rischiano di deteriorarsi rapidamente (molti alimentari)</li>
                  <li>beni sigillati non restituibili per motivi igienici/sanitari se aperti</li>
                  <li>beni personalizzati</li>
                </ul>
                La gestione del recesso/resi è in capo al Venditore.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.7 Garanzia legale</strong>
              <div style={{ marginTop: 6 }}>
                Per consumatori: garanzia legale di conformità ove applicabile.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.8 Pagamenti</strong>
              <div style={{ marginTop: 6 }}>
                Gestiti da Stripe. L'Acquirente può avviare contestazioni tramite canali bancari; il Venditore gestisce evidenze di consegna/servizio.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.9 Foro competente (SAFE)</strong>
              <div style={{ marginTop: 6 }}>
                Per Acquirenti consumatori, è competente in via inderogabile il foro del luogo di residenza o domicilio del consumatore (normativa consumer).<br />
                Per Acquirenti non consumatori, foro di Potenza.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTermsModal(false)}>
            Chiudi
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setAcceptedTerms(true);
              setShowTermsModal(false);
            }}
          >
            Accetta e Chiudi
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modale Privacy Policy */}
      <Modal show={showPrivacyModal} onHide={() => setShowPrivacyModal(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Privacy Policy – Lucaniko Shop</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3 text-muted" style={{ fontSize: '0.98rem' }}>Ultimo aggiornamento: 4 febbraio 2026</div>
          <div className="mb-4" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
            <strong>Titolare del trattamento</strong><br />
            INSIDE di Di Pietro Vito – P. IVA 02118850763<br />
            Sede: Via Monticchio 17/B, 85028 Rionero in Vulture (PZ)<br />
            Email privacy: <a href="mailto:info@dipietrodigital.it">info@dipietrodigital.it</a>
          </div>

          <div style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 28 }}>
              <strong>1.1 Marketplace: ruoli privacy</strong>
              <div style={{ marginTop: 6 }}>
                <strong>Lucaniko Shop:</strong> Titolare per dati necessari a piattaforma (account, sicurezza, log, gestione tecnica ordini, supporto, comunicazioni).<br /><br />
                <strong>Venditori:</strong> Titolari autonomi per dati necessari a evasione ordine, spedizione, resi, garanzie, fatturazione.<br /><br />
                <strong>Stripe:</strong> gestisce pagamenti secondo propri termini (ruolo come da contratti Stripe).
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.2 Dati trattati</strong>
              <ul style={{ marginTop: 6 }}>
                <li>dati account acquirente (nome, contatti, indirizzi)</li>
                <li>dati ordine (prodotti acquistati, importi, stato)</li>
                <li>dati account venditore (azienda, P.IVA, SDI, referente, documentazione)</li>
                <li>dati assistenza (messaggi/allegati)</li>
                <li>dati tecnici (IP, log, eventi sicurezza)</li>
                <li>dati pagamento: Lucaniko Shop non conserva carte; riceve esiti/ID transazione</li>
              </ul>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.3 Finalità e basi giuridiche</strong>
              <ul style={{ marginTop: 6 }}>
                <li>erogazione servizio e gestione account/ordini (art. 6(1)(b))</li>
                <li>sicurezza e prevenzione frodi (art. 6(1)(f))</li>
                <li>adempimenti legali (art. 6(1)(c))</li>
                <li>assistenza (art. 6(1)(b)/(f))</li>
                <li>marketing/newsletter (consenso art. 6(1)(a) o soft-spam dove lecito)</li>
                <li>analytics e miglioramento (legittimo interesse; consenso per cookie non tecnici)</li>
              </ul>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.4 Destinatari</strong>
              <div style={{ marginTop: 6 }}>
                Fornitori tecnici (hosting, email, helpdesk) come responsabili; Stripe; Venditori per gestione ordini; autorità ove necessario.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.5 Trasferimenti extra SEE</strong>
              <div style={{ marginTop: 6 }}>
                Possibili per alcuni fornitori: con garanzie adeguate (SCC/adeguatezza).
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.6 Conservazione</strong>
              <ul style={{ marginTop: 6 }}>
                <li>account: fino a cancellazione o inattività prolungata (salvo obblighi)</li>
                <li>ordini e dati amministrativi: secondo legge</li>
                <li>log sicurezza: per periodi limitati/proporzionati</li>
              </ul>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.7 Diritti</strong>
              <div style={{ marginTop: 6 }}>
                Accesso, rettifica, cancellazione, limitazione, portabilità, opposizione, revoca consenso; reclamo al Garante.
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <strong>1.8 Minori</strong>
              <div style={{ marginTop: 6 }}>
                Piattaforma non destinata a minori di 18 anni.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPrivacyModal(false)}>
            Chiudi
          </Button>
          <Button 
            variant="primary" 
            onClick={() => {
              setAcceptedTerms(true);
              setShowPrivacyModal(false);
            }}
          >
            Accetta e Chiudi
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Alert Modal per tutti i messaggi */}
      <AlertModal
        show={alertModal.show}
        onHide={() => setAlertModal({ show: false, message: '', type: 'info' })}
        message={alertModal.message}
        type={alertModal.type}
      />
    </Container>
    </>
  );
};

export default Cart;
