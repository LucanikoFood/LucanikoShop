import express from 'express';
import { register, login, getProfile, googleCallback, getVendorProfile, updateVendorProfile, updateProfile, forgotPassword, resetPassword } from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';
import passport from '../config/passport.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Rotte pubbliche con rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Rotte recupero password (pubbliche con rate limiting)
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);

// Google OAuth
router.get(
  '/google',
  (req, res, next) => {
    console.log('🟢 [AUTH ROUTE] Inizio autenticazione Google');
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get(
  '/google/callback',
  (req, res, next) => {
    console.log('🟢 [AUTH ROUTE] Callback Google ricevuto');
    console.log('🔍 [AUTH ROUTE] Query params:', req.query);
    next();
  },
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`
  }),
  googleCallback
);

// Rotte protette
router.get('/profile', protect, getProfile);

router.get('/vendor-profile', protect, getVendorProfile);
router.put('/vendor-profile', protect, updateVendorProfile);

// Aggiorna profilo acquirente (buyer)
router.put('/profile', protect, updateProfile);

export default router;