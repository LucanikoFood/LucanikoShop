import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/authContext';
import ProtectedRoute from './components/ProtectedRoute';
import GoogleAnalytics from './components/GoogleAnalytics';
import { initSentry } from './config/sentry';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SplashScreen from './components/SplashScreen';
import ComingSoon from './components/ComingSoon';
import { useState, useEffect } from 'react';
import CategoriesCarouselArrows from './components/CategoriesCarouselArrows';
import CookieBanner from './components/CookieBanner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CartProvider } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy loading delle pagine per ridurre il bundle iniziale e migliorare le performance
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthSuccess = lazy(() => import('./pages/AuthSuccess'));
const AuthError = lazy(() => import('./pages/AuthError'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const MyProducts = lazy(() => import('./pages/MyProducts'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Cart = lazy(() => import('./pages/Cart'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const CheckoutCancel = lazy(() => import('./pages/CheckoutCancel'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'));
const VendorProfile = lazy(() => import('./pages/VendorProfile'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const Error = lazy(() => import('./pages/Error'));
const BuyerProfile = lazy(() => import('./pages/BuyerProfile'));
const OffersAndDiscounts = lazy(() => import('./pages/OffersAndDiscounts'));
const Categories = lazy(() => import('./pages/Categories'));
const TermsVendors = lazy(() => import('./pages/TermsVendors'));
const TermsBuyers = lazy(() => import('./pages/TermsBuyers'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const HelpCenterBuyer = lazy(() => import('./pages/HelpCenterBuyer'));
const ShippingAndPayments = lazy(() => import('./pages/ShippingAndPayments'));
const SpazioVenditoriLucani = lazy(() => import('./pages/SpazioVenditoriLucani'));
const HelpCenterVendor = lazy(() => import('./pages/HelpCenterVendor'));
const BillingInfo = lazy(() => import('./pages/BillingInfo'));
const Negozi = lazy(() => import('./pages/Negozi'));
const Partners = lazy(() => import('./pages/Partners'));
const Esperienze = lazy(() => import('./pages/Esperienze'));
const ExperienceDetail = lazy(() => import('./pages/ExperienceDetail'));
const Eventi = lazy(() => import('./pages/Eventi'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const AdminPaymentControl = lazy(() => import('./pages/AdminPaymentControl'));
const CookieList = lazy(() => import('./pages/CookieList'));
const AdminCookieConsent = lazy(() => import('./pages/AdminCookieConsent'));

// Componente di loading durante il caricamento lazy delle pagine
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '60vh',
    fontSize: '1.2rem',
    color: '#666'
  }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Caricamento...</span>
    </div>
  </div>
);

function AppContent() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // ⚡ PERFORMANCE: Prefetch route critiche dopo il caricamento iniziale
  useEffect(() => {
    const prefetchRoutes = () => {
      // Usa requestIdleCallback se disponibile per evitare di bloccare l'UI
      const scheduleImport = (importFn) => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => importFn(), { timeout: 2000 });
        } else {
          setTimeout(() => importFn(), 100);
        }
      };

      // Precarica i componenti più visitati tramite dynamic import
      scheduleImport(() => import('./pages/Cart'));
      scheduleImport(() => import('./pages/ProductDetail'));
      scheduleImport(() => import('./pages/ShopPage'));
    };

    // Attendi 2 secondi dopo il mount iniziale
    const timer = setTimeout(prefetchRoutes, 2000);
    return () => clearTimeout(timer);
  }, []); // Esegui solo al mount

  // Pagine dove NON mostrare il carosello
  const hideCarouselPaths = ['/login', '/register', '/cart', '/categories', '/products/new'];
  const shouldShowCarousel = !hideCarouselPaths.includes(location.pathname) && !location.pathname.startsWith('/products/edit/') && !location.pathname.startsWith('/reset-password/');

  return (
    <>
      <GoogleAnalytics measurementId={import.meta.env.VITE_GA_MEASUREMENT_ID} />
      <Navbar />
      <CookieBanner />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route path="/auth/error" element={<AuthError />} />
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* Prodotti pubblici */}
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/shop/:sellerId" element={<ShopPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/checkout/cancel" element={<CheckoutCancel />} />
          <Route path="/offers" element={<OffersAndDiscounts />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/negozi" element={<Negozi />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/esperienze" element={<Esperienze />} />
          <Route path="/esperienze/:id" element={<ExperienceDetail />} />
          <Route path="/eventi" element={<Eventi />} />
          <Route path="/eventi/:id" element={<EventDetail />} />
          <Route path="/billing-info" element={<BillingInfo />} />

          {/* Prodotti protetti (solo seller/admin) */}
          <Route path="/my-products" element={<ProtectedRoute allowedRoles={['seller', 'admin']}> <MyProducts /> </ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute allowedRoles={['seller', 'admin']}> <ProductForm /> </ProtectedRoute>} />
          <Route path="/products/edit/:id" element={<ProtectedRoute allowedRoles={['seller', 'admin']}> <ProductForm /> </ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute> <OrderHistory /> </ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute> <OrderDetail /> </ProtectedRoute>} />
          <Route path="/orders/:id/tracking" element={<ProtectedRoute> <OrderTracking /> </ProtectedRoute>} />

          {/* Vendor Dashboard */}
          <Route path="/vendor/dashboard" element={<ProtectedRoute allowedRoles={['seller', 'admin']}> <VendorDashboard /> </ProtectedRoute>} />
          <Route path="/vendor/profile" element={<ProtectedRoute allowedRoles={['seller', 'admin']}> <VendorProfile /> </ProtectedRoute>} />

          {/* Buyer Profile */}
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['buyer','user','acquirente']}> <BuyerProfile /> </ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}> <AdminDashboard /> </ProtectedRoute>} />
          <Route path="/admin/payment-control" element={<ProtectedRoute allowedRoles={['admin']}> <AdminPaymentControl /> </ProtectedRoute>} />
          <Route path="/admin/cookie-consent" element={<ProtectedRoute allowedRoles={['admin']}> <AdminCookieConsent /> </ProtectedRoute>} />
          <Route path="/terms-vendors" element={<TermsVendors />} />
          <Route path="/terms-buyers" element={<TermsBuyers />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/cookie-list" element={<CookieList />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />


          {/* Centro Assistenza Acquirenti */}
          <Route path="/help-center-buyers" element={<HelpCenterBuyer />} />
          <Route path="/help-center-vendors" element={<HelpCenterVendor />} />
          <Route path="/spazio-venditori-lucani" element={<SpazioVenditoriLucani />} />

          {/* Spedizioni e Metodi di Pagamento */}
          <Route path="/cancellation-policy" element={<ShippingAndPayments />} />

          <Route path="*" element={<Error />} />
        </Routes>
      </Suspense>
      {shouldShowCarousel && <CategoriesCarouselArrows />}
      <Footer />
    </>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Inizializza Sentry per error tracking
  useEffect(() => {
    initSentry();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1000); 
    return () => clearTimeout(timer);
  }, []);

  // Mostra splash screen
  if (showSplash) {
    return <SplashScreen />;
  }

  // Check modalità manutenzione
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const hasBypass = sessionStorage.getItem('maintenance_bypass') === 'true';

  // Se modalità manutenzione attiva e nessun bypass, mostra Coming Soon
  if (isMaintenanceMode && !hasBypass) {
    return <ComingSoon />;
  }

  // Mostra l'app normale
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
