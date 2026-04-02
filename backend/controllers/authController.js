// @desc    Aggiorna profilo acquirente
// @route   PUT /api/auth/profile
// @access  Private/Buyer
export const updateProfile = async (req, res) => {
  try {
    if (req.user.role !== 'buyer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso negato. Solo acquirenti possono modificare il profilo personale.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    // Aggiorna numero di telefono
    if (typeof req.body.phone === 'string') {
      user.phone = req.body.phone;
    }

    // Aggiorna indirizzo
    if (req.body.address) {
      user.address = {
        street: req.body.address.street || user.address?.street,
        city: req.body.address.city || user.address?.city,
        state: req.body.address.state || user.address?.state,
        zipCode: req.body.address.zipCode || user.address?.zipCode,
        country: req.body.address.country || user.address?.country,
        taxCode: req.body.address.taxCode || user.address?.taxCode
      };
    }

    // Aggiorna indirizzo di fatturazione
    if (req.body.billingAddress) {
      user.billingAddress = {
        street: req.body.billingAddress.street || user.billingAddress?.street,
        city: req.body.billingAddress.city || user.billingAddress?.city,
        state: req.body.billingAddress.state || user.billingAddress?.state,
        zipCode: req.body.billingAddress.zipCode || user.billingAddress?.zipCode,
        country: req.body.billingAddress.country || user.billingAddress?.country,
        taxCode: req.body.billingAddress.taxCode || user.billingAddress?.taxCode
      };
    }

    // Aggiorna password se fornita
    if (req.body.password && req.body.password.length >= 8) {
      user.password = req.body.password;
    }

    // Aggiorna metodo di pagamento preferito
    if (typeof req.body.paymentMethod === 'string') {
      user.paymentMethod = req.body.paymentMethod;
    }

    // Aggiorna dati carta se forniti
    if (req.body.cardDetails) {
      user.cardDetails = {
        cardHolder: req.body.cardDetails.cardHolder || user.cardDetails?.cardHolder,
        cardNumber: req.body.cardDetails.cardNumber || user.cardDetails?.cardNumber,
        expiryDate: req.body.cardDetails.expiryDate || user.cardDetails?.expiryDate,
        cardType: req.body.cardDetails.cardType || user.cardDetails?.cardType
      };
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      phone: user.phone,
      address: user.address,
      billingAddress: user.billingAddress,
      paymentMethod: user.paymentMethod,
      cardDetails: user.cardDetails,
      avatar: user.avatar,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
import Stripe from 'stripe';
import crypto from 'crypto';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendWelcomeEmail, sendApprovalEmail, sendVendorRegistrationEmail, sendPasswordResetEmail } from '../utils/emailTemplates.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc    Registra un nuovo utente
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role,
      businessName,
      vatNumber,
      phoneNumber,
      address,
      city,
      zipCode,
      uniqueCode,
      selectedCategories,
      paymentIntentId,
      subscriptionType,
      subscriptionPaid,
      cardDetails,
      registeredByAdmin,
      subscription
    } = req.body;

    console.log('[Backend] Registrazione ricevuta:', { name, email, role, businessName, vatNumber });

    // Verifica se l'utente esiste già
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'Utente già registrato' });
    }

    // Prepara i dati utente base
    const userData = {
      name,
      email,
      password,
      role: role || 'buyer'
    };


    // Se è un seller, aggiungi i dati aziendali
    if (role === 'seller') {
      if (businessName) userData.businessName = businessName;
      if (vatNumber) userData.vatNumber = vatNumber;
      if (phoneNumber) userData.phone = phoneNumber;
      // Gestione Codice SDI o PEC
      if (uniqueCode) {
        if (uniqueCode.includes('@')) {
          userData.pec = uniqueCode; // È una PEC
        } else {
          userData.codiceSDI = uniqueCode; // È un codice SDI
        }
      }
      if (selectedCategories && Array.isArray(selectedCategories)) {
        userData.businessCategories = selectedCategories;
      }

      // Se registrato dall'admin, approva automaticamente
      if (registeredByAdmin) {
        userData.isApproved = true;
      }

      // Indirizzo aziendale
      if (address || city || zipCode) {
        userData.businessAddress = {
          street: address || '',
          city: city || '',
          zipCode: zipCode || '',
          country: 'IT'
        };
        // Copia anche in storeAddress
        userData.storeAddress = {
          street: address || '',
          city: city || '',
          zipCode: zipCode || '',
          country: 'IT'
        };
      }

      // Calcola e salva la scadenza abbonamento (Piano unico: 1 anno)
      if (subscriptionType || subscription) {
        const now = new Date();
        const endDate = new Date(now.setFullYear(now.getFullYear() + 1));
        userData.subscriptionEndDate = endDate;
      }

      // Se registrato dall'admin, attiva automaticamente l'abbonamento
      if (registeredByAdmin) {
        userData.subscriptionPaid = true;
        userData.subscriptionPaidAt = new Date();
        userData.subscriptionPaymentId = `ADMIN_REG_${Date.now()}`;
        userData.subscriptionType = subscription || subscriptionType;
      }

      // Salva info abbonamento nei metadata (opzionale, per tracking) - solo se c'è un paymentIntentId
      if (paymentIntentId) {
        userData.subscriptionPaymentId = paymentIntentId;
        userData.subscriptionType = subscriptionType;
        userData.subscriptionPaid = subscriptionPaid;
        if (subscriptionPaid) {
          userData.subscriptionPaidAt = new Date();
        }
      }

      // Salva dati non sensibili della carta se presenti
      if (cardDetails && typeof cardDetails === 'object') {
        console.log('[Backend] cardDetails ricevuti durante registrazione:', cardDetails);
        userData.cardDetails = {
          cardHolder: cardDetails.cardHolder || '',
          cardType: cardDetails.cardType || '',
          cardNumber: cardDetails.cardNumber || '',
          expiryDate: cardDetails.expiryDate || ''
        };
        console.log('[Backend] cardDetails salvati in userData:', userData.cardDetails);
      } else {
        console.log('[Backend] Nessun cardDetails ricevuto durante registrazione');
      }
    }

    console.log('[Backend] Dati utente preparati:', userData);

    // Crea nuovo utente
    const user = await User.create(userData);

    if (user) {
      console.log('[Backend] Utente creato con successo:', user._id);
      
      // Invia email appropriata in base al tipo di registrazione (non blocca la registrazione se fallisce)
      try {
        if (role === 'seller' && registeredByAdmin) {
          // Admin registra azienda: invio email di approvazione (già approvato)
          console.log('[AUTH CONTROLLER] Tentativo invio email di approvazione (registrazione admin)...');
          await sendApprovalEmail(user.email, user.name);
          console.log('[AUTH CONTROLLER] ✅ Email di approvazione inviata');
        } else if (role === 'seller') {
          // Seller si auto-registra: invio email di registrazione in attesa
          console.log('[AUTH CONTROLLER] Tentativo invio email registrazione venditore...');
          await sendVendorRegistrationEmail(user.email, user.businessName || user.name);
          console.log('[AUTH CONTROLLER] ✅ Email registrazione venditore inviata');
        } else {
          // Buyer si registra: invio email di benvenuto
          console.log('[AUTH CONTROLLER] Tentativo invio email di benvenuto...');
          await sendWelcomeEmail(user.email, user.name);
          console.log('[AUTH CONTROLLER] ✅ Email di benvenuto inviata');
        }
      } catch (emailError) {
        console.error('[AUTH CONTROLLER] ❌ ERRORE invio email:', emailError);
        console.error('[AUTH CONTROLLER] Dettagli errore:', {
          message: emailError.message,
          code: emailError.code,
          response: emailError.response?.body
        });
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        businessName: user.businessName,
        vatNumber: user.vatNumber,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Dati utente non validi' });
    }
  } catch (error) {
    console.error('[Backend] Errore registrazione:', error);
    
    // SECURITY: Se c'è un paymentIntentId, il pagamento è stato già effettuato
    // ma la registrazione è fallita (es. validazione password). Rimborsa automaticamente.
    if (paymentIntentId && role === 'seller') {
      console.error('❌ [REGISTER] Registrazione fallita DOPO il pagamento - Rimborso automatico');
      try {
        // Recupera il PaymentIntent per ottenere il chargeId
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.latest_charge) {
          // Crea il rimborso
          const refund = await stripe.refunds.create({
            charge: paymentIntent.latest_charge,
            reason: 'requested_by_customer',
            metadata: {
              reason: 'Registrazione fallita - validazione dati',
              error: error.message
            }
          });
          
          console.log('✅ [REGISTER] Rimborso automatico creato:', refund.id);
          
          return res.status(400).json({ 
            message: error.message,
            refunded: true,
            refundId: refund.id,
            notice: 'Il pagamento è stato rimborsato automaticamente a causa di un errore nella registrazione.'
          });
        }
      } catch (refundError) {
        console.error('❌ [REGISTER] Errore durante il rimborso automatico:', refundError);
        return res.status(500).json({ 
          message: error.message,
          refunded: false,
          notice: 'ATTENZIONE: Il pagamento è stato effettuato ma la registrazione è fallita. Contatta l\'assistenza per un rimborso manuale.',
          paymentIntentId: paymentIntentId
        });
      }
    }
    
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login utente
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) console.log('🔐 [LOGIN] Tentativo di login per email:', email);

    // Trova l'utente e includi la password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      if (isDev) console.log('❌ [LOGIN] Email NON trovata nel database:', email);
      return res.status(401).json({ message: 'Email o password non validi' });
    }

    if (isDev) {
      console.log('✅ [LOGIN] Email trovata. Utente:', {
        id: user._id,
        email: user.email,
        role: user.role,
        hasPassword: !!user.password
      });
    }

    const isPasswordMatch = await user.matchPassword(password);
    
    if (!isPasswordMatch) {
      if (isDev) console.log('❌ [LOGIN] Password NON corrisponde per utente:', user.email);
      return res.status(401).json({ message: 'Email o password non validi' });
    }

    if (isDev) console.log('✅ [LOGIN] Password corretta. Login riuscito per:', user.email);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isApproved: user.isApproved,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('💥 [LOGIN] Errore durante login:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Ottieni profilo utente
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    console.log('📋 [GET PROFILE] Richiesta profilo per utente:', req.user._id);
    const user = await User.findById(req.user._id);

    if (user) {
      console.log('✅ [GET PROFILE] Profilo trovato:', {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      });
      
      res.json({
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        phone: user.phone,
        address: user.address,
        billingAddress: user.billingAddress,
        paymentMethod: user.paymentMethod,
        cardDetails: user.cardDetails,
        avatar: user.avatar,
        createdAt: user.createdAt,
        // Campi venditore
        businessName: user.businessName,
        ragioneSociale: user.ragioneSociale,
        businessDescription: user.businessDescription,
        vatNumber: user.vatNumber,
        codiceSDI: user.codiceSDI,
        businessAddress: user.businessAddress,
        businessPhone: user.businessPhone,
        businessEmail: user.businessEmail,
        businessWhatsapp: user.businessWhatsapp,
        pec: user.pec,
        storeAddress: user.storeAddress,
        website: user.website,
        socialLinks: user.socialLinks,
        logo: user.logo
      });
    } else {
      res.status(404).json({ message: 'Utente non trovato' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
export const googleCallback = async (req, res) => {
  try {
    console.log('🔵 [GOOGLE AUTH] Callback ricevuto');
    console.log('👤 [GOOGLE AUTH] Utente autenticato:', {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name
    });
    
    // L'utente è già stato autenticato da Passport
    const token = generateToken(req.user._id);
    console.log('🔑 [GOOGLE AUTH] Token generato:', token.substring(0, 20) + '...');
    
    // Reindirizza al frontend con il token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/auth/success?token=${token}`;
    console.log('↪️  [GOOGLE AUTH] Redirect a:', redirectUrl);
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ [GOOGLE AUTH] Errore nel callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/error`);
  }
};

// @desc    Ottieni profilo completo venditore
// @route   GET /api/auth/vendor-profile
// @access  Private/Seller
export const getVendorProfile = async (req, res) => {
  try {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso negato. Solo venditori possono accedere a questa risorsa.' });
    }

    const user = await User.findById(req.user._id).select('-password');

    if (user) {
      console.log('[DEBUG VENDOR PROFILE] Dati venditore caricati:', {
        _id: user._id,
        name: user.name,
        businessName: user.businessName,
        subscriptionPaid: user.subscriptionPaid,
        subscriptionPaidAt: user.subscriptionPaidAt,
        subscriptionEndDate: user.subscriptionEndDate,
        subscriptionType: user.subscriptionType,
        subscriptionPaymentId: user.subscriptionPaymentId
      });
      res.json(user);
    } else {
      res.status(404).json({ message: 'Utente non trovato' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Aggiorna profilo venditore
// @route   PUT /api/auth/vendor-profile
// @access  Private/Seller
export const updateVendorProfile = async (req, res) => {
  try {
    console.log('[DEBUG NEWS BACKEND] Body ricevuto:', { news: req.body.news });

    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso negato. Solo venditori possono modificare il profilo aziendale.' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    // Aggiorna informazioni personali
    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    user.avatar = req.body.avatar || user.avatar;

    // Aggiorna password se fornita (richiede verifica password attuale)
    if (req.body.password && req.body.password.length >= 8) {
      console.log('[PASSWORD CHANGE] Tentativo di cambio password');
      console.log('[PASSWORD CHANGE] currentPassword fornita:', !!req.body.currentPassword);
      console.log('[PASSWORD CHANGE] newPassword length:', req.body.password.length);
      console.log('[PASSWORD CHANGE] User ha password esistente:', !!user.password);
      
      // Se l'utente non ha una password esistente, può impostarla senza verifiche
      if (!user.password) {
        console.log('[PASSWORD CHANGE] Prima password - nessuna verifica richiesta');
        user.password = req.body.password;
      } else {
        // Verifica che sia stata fornita la password attuale
        if (!req.body.currentPassword) {
          console.log('[PASSWORD CHANGE] Errore: password attuale non fornita');
          return res.status(400).json({ message: 'Devi fornire la password attuale per cambiarla' });
        }

        console.log('[PASSWORD CHANGE] Verifico password attuale...');
        // Verifica che la password attuale sia corretta
        const isPasswordValid = await user.matchPassword(req.body.currentPassword);
        console.log('[PASSWORD CHANGE] Password valida:', isPasswordValid);
        
        if (!isPasswordValid) {
          console.log('[PASSWORD CHANGE] Errore: password attuale non corretta');
          return res.status(401).json({ message: 'Password attuale non corretta' });
        }

        console.log('[PASSWORD CHANGE] Password verificata, aggiorno...');
        // Aggiorna la password
        user.password = req.body.password;
      }
    }

    // Aggiorna indirizzo personale
    if (req.body.address) {
      user.address = {
        street: req.body.address.street || user.address?.street,
        city: req.body.address.city || user.address?.city,
        state: req.body.address.state || user.address?.state,
        zipCode: req.body.address.zipCode || user.address?.zipCode,
        country: req.body.address.country || user.address?.country
      };
    }

    // Aggiorna informazioni aziendali
    user.businessName = req.body.businessName || user.businessName;
    user.ragioneSociale = req.body.ragioneSociale || user.ragioneSociale;
    user.businessDescription = req.body.businessDescription || user.businessDescription;
    user.vatNumber = req.body.vatNumber || user.vatNumber;
    user.codiceSDI = req.body.codiceSDI || user.codiceSDI;
    user.pec = req.body.pec || user.pec;

    // Aggiorna categorie aziendali
    if (req.body.businessCategories !== undefined) {
      user.businessCategories = req.body.businessCategories;
    }

    // Aggiorna news aziendale
    if (req.body.news !== undefined) {
      user.news = req.body.news;
      console.log('[DEBUG NEWS BACKEND] News ricevuta e impostata:', req.body.news);
    }

    // Aggiorna logo
    if (req.body.logo) {
      user.logo = {
        url: req.body.logo.url || user.logo?.url,
        public_id: req.body.logo.public_id || user.logo?.public_id
      };
    }

    // Aggiorna contatti negozio
    user.businessEmail = req.body.businessEmail || user.businessEmail;
    user.businessPhone = req.body.businessPhone || user.businessPhone;
    user.businessWhatsapp = req.body.businessWhatsapp || user.businessWhatsapp;
    user.website = req.body.website || user.website;

    // Aggiorna social links
    if (req.body.socialLinks) {
      user.socialLinks = {
        facebook: req.body.socialLinks.facebook || user.socialLinks?.facebook,
        instagram: req.body.socialLinks.instagram || user.socialLinks?.instagram,
        twitter: req.body.socialLinks.twitter || user.socialLinks?.twitter,
        linkedin: req.body.socialLinks.linkedin || user.socialLinks?.linkedin,
        tiktok: req.body.socialLinks.tiktok || user.socialLinks?.tiktok
      };
    }

    // Aggiorna indirizzo punto vendita
    if (req.body.storeAddress) {
      user.storeAddress = {
        street: req.body.storeAddress.street || user.storeAddress?.street,
        city: req.body.storeAddress.city || user.storeAddress?.city,
        state: req.body.storeAddress.state || user.storeAddress?.state,
        zipCode: req.body.storeAddress.zipCode || user.storeAddress?.zipCode,
        country: req.body.storeAddress.country || user.storeAddress?.country,
        coordinates: req.body.storeAddress.coordinates || user.storeAddress?.coordinates
      };
    }

    // Aggiorna indirizzo aziendale
    if (req.body.businessAddress) {
      user.businessAddress = {
        street: req.body.businessAddress.street || user.businessAddress?.street,
        city: req.body.businessAddress.city || user.businessAddress?.city,
        state: req.body.businessAddress.state || user.businessAddress?.state,
        zipCode: req.body.businessAddress.zipCode || user.businessAddress?.zipCode,
        country: req.body.businessAddress.country || user.businessAddress?.country
      };
    }

    // Aggiorna dati bancari
    if (req.body.bankAccount) {
      user.bankAccount = {
        iban: req.body.bankAccount.iban || user.bankAccount?.iban,
        bankName: req.body.bankAccount.bankName || user.bankAccount?.bankName
      };
    }

    // Aggiorna impostazioni negozio
    if (req.body.shopSettings) {
      user.shopSettings = {
        ...user.shopSettings,
        ...req.body.shopSettings
      };
    }


    // Invio email di approvazione se lo stato passa a true
    if (!user.isApproved && req.body.isApproved === true) {
      // Approvazione appena avvenuta
      try {
        const { sendApprovalEmail } = await import('../utils/emailTemplates.js');
        await sendApprovalEmail(user.email, user.name);
      } catch (emailError) {
        console.error('Errore invio email di approvazione:', emailError);
      }
    }

    const updatedUser = await user.save();

    console.log('[DEBUG NEWS BACKEND] News salvata nel database:', updatedUser.news);
    if (updatedUser?.shopSettings?.shipping?.shippingRates) {
      updatedUser.shopSettings.shipping.shippingRates.forEach((rate, i) => {
        console.log(`💾 [BACKEND SAVE] Tariffa ${i} salvata - shippingOptions:`, rate.shippingOptions);
      });
    }

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      address: updatedUser.address,
      avatar: updatedUser.avatar,
      businessName: updatedUser.businessName,
      ragioneSociale: updatedUser.ragioneSociale,
      businessDescription: updatedUser.businessDescription,
      businessCategories: updatedUser.businessCategories,
      vatNumber: updatedUser.vatNumber,
      codiceSDI: updatedUser.codiceSDI,
      pec: updatedUser.pec,
      logo: updatedUser.logo,
      businessEmail: updatedUser.businessEmail,
      businessPhone: updatedUser.businessPhone,
      businessWhatsapp: updatedUser.businessWhatsapp,
      website: updatedUser.website,
      socialLinks: updatedUser.socialLinks,
      storeAddress: updatedUser.storeAddress,
      businessAddress: updatedUser.businessAddress,
      bankAccount: updatedUser.bankAccount,
      shopSettings: updatedUser.shopSettings,
      isApproved: updatedUser.isApproved
    });
  } catch (error) {
    console.error('[UPDATE VENDOR PROFILE] Errore:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Richiedi reset password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Inserisci la tua email' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Per sicurezza, non rivelare se l'email esiste o meno
      return res.json({ 
        message: 'Se l\'email esiste nel sistema, riceverai un link per il reset della password' 
      });
    }

    // Genera token di reset
    const resetToken = user.getResetPasswordToken();

    // Salva l'utente con il token (senza validazione password)
    await user.save({ validateBeforeSave: false });

    // Crea URL di reset
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    try {
      // Invia email
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

      res.json({ 
        message: 'Se l\'email esiste nel sistema, riceverai un link per il reset della password' 
      });
    } catch (error) {
      console.error('[FORGOT PASSWORD] Errore invio email:', error);
      
      // Se l'invio email fallisce, rimuovi il token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({ 
        message: 'Errore nell\'invio dell\'email. Riprova più tardi.' 
      });
    }
  } catch (error) {
    console.error('[FORGOT PASSWORD] Errore:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset password con token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Validazione password robusta
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    
    if (!password) {
      return res.status(400).json({ 
        message: 'La password è obbligatoria' 
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        message: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola, un numero e un simbolo' 
      });
    }

    // Hash il token ricevuto per confrontarlo con quello nel database
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Trova l'utente con il token valido e non scaduto
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Token non valido o scaduto' 
      });
    }

    // Imposta la nuova password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ 
      message: 'Password reimpostata con successo. Ora puoi effettuare il login.' 
    });
  } catch (error) {
    console.error('[RESET PASSWORD] Errore:', error);
    res.status(500).json({ message: error.message });
  }
};