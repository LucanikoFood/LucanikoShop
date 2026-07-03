import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    // Campi separati per nome e cognome
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'Il nome non può superare 50 caratteri']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Il cognome non può superare 50 caratteri']
    },
    // Campo name legacy per retrocompatibilità
    name: {
      type: String,
      required: [true, 'Il nome è obbligatorio'],
      trim: true,
      maxlength: [100, 'Il nome completo non può superare 100 caratteri']
    },
    email: {
      type: String,
      required: [true, 'L\'email è obbligatoria'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Inserisci un\'email valida']
    },
    password: {
      type: String,
      required: [true, 'La password è obbligatoria'],
        minlength: [8, 'La password deve essere di almeno 8 caratteri'], // Modificato per la lunghezza minima
        validate: {
          validator: function (v) {
            // Almeno una maiuscola, una minuscola, un numero, un simbolo
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(v);
          },
          message: 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo'
        },
        select: false // Non restituisce la password nelle query di default
    },
    role: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      default: 'buyer'
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      taxCode: String // Codice fiscale
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      taxCode: String
    },
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150'
    },

    // Metodo di pagamento preferito (acquirente)
    paymentMethod: {
      type: String,
      enum: ['carta', ''],
      default: ''
    },
    // Dati carta di credito (salvati in modo sicuro, criptati)
    cardDetails: {
      cardHolder: String,
      cardNumber: String, // Salvare solo ultime 4 cifre in produzione
      expiryDate: String,
      cardType: String // Visa, Mastercard, etc.
    },
    // Campi specifici per i seller (aziende)
    businessName: {
      type: String,
      trim: true
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // Permette null ma deve essere unico se presente
      index: true
    },
    ragioneSociale: {
      type: String,
      trim: true
    },
    businessDescription: {
      type: String,
      maxlength: [500, 'La descrizione non può superare 500 caratteri']
    },
    businessCategories: [{
      type: String,
      trim: true
    }], // Macrocategorie di vendita per i seller
    news: {
      type: String,
      maxlength: [80, 'La news non può superare 80 caratteri'],
      default: ''
    },
    logo: {
      url: String,
      public_id: String // Per Cloudinary
    },
    // Contatti negozio
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    businessPhone: String,
    businessWhatsapp: String,
    website: String,
    socialLinks: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String,
      tiktok: String
    },
    // Indirizzo punto vendita fisico
    storeAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    vatNumber: { // Partita IVA
      type: String,
      trim: true,
      sparse: true // Permette null ma deve essere unico se presente
    },
    codiceSDI: { // Codice SDI per fatturazione elettronica
      type: String,
      trim: true,
      maxlength: [7, 'Il codice SDI non può superare 7 caratteri']
    },
    pec: { // PEC per fatturazione elettronica (alternativa al codice SDI)
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Campo opzionale
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Inserisci un indirizzo PEC valido'
      }
    },
    businessAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    bankAccount: {
      iban: String,
      bankName: String
    },
    // Configurazioni negozio (per seller)
    shopSettings: {
      // Metodi di pagamento
      paymentMethods: {
        bankTransfer: {
          enabled: {
            type: Boolean,
            default: true
          },
          iban: String,
          bankName: String,
          accountHolder: String
        },
        paypal: {
          enabled: {
            type: Boolean,
            default: false
          },
          email: String
        },
        stripe: {
          enabled: {
            type: Boolean,
            default: false
          },
          accountId: String, // Stripe Connect Account ID
          onboardingComplete: {
            type: Boolean,
            default: false
          }
        },
        cashOnDelivery: {
          enabled: {
            type: Boolean,
            default: false
          },
          extraFee: Number
        }
      },
      // Termini e condizioni personalizzati
      termsAndConditions: {
        content: String,
        lastUpdated: Date,
        version: {
          type: Number,
          default: 1
        }
      },
      // Configurazioni spedizioni
      shipping: {
        freeShipping: {
          type: Boolean,
          default: false
        },
        freeShippingThreshold: { // Spedizione gratuita sopra questo importo
          type: Number,
          min: [0, 'La soglia non può essere negativa']
        },
        allowStorePickup: { // Permette ritiro in negozio
          type: Boolean,
          default: false
        },
        shippingRates: [{
          name: String, // Es: "Standard", "Express"
          description: String,
          calculationType: {
            type: String,
            enum: ['fixed', 'weight', 'price', 'zone'], // fisso, peso, prezzo, zona geografica
            default: 'fixed'
          },
          baseRate: Number, // Tariffa base
          ratePerUnit: Number, // Tariffa per kg o per euro
          estimatedDays: String, // Es: "3-5 giorni"
          zones: [{ // Zone geografiche per spedizioni
            name: String, // Es: "Nord Italia", "Sud Italia", "Isole", "Estero UE"
            regions: [String], // Es: ["Lombardia", "Piemonte"], oppure ["IT", "FR", "DE"]
            rate: Number,
            estimatedDays: String
          }],
          // Flag specifici per Italia
          italiaIsoleEscluse: {
            type: Boolean,
            default: false
          },
          italiaSardegnaSicilia: {
            type: Boolean,
            default: false
          },
          // Campi per tariffe avanzate (a livello rate)
          country: String, // Paese (es: "Francia", "Italia")
          anyCartTotal: Boolean, // Se vale per qualsiasi totale carrello
          cartWeightFrom: String, // Peso minimo carrello (kg)
          cartWeightTo: String, // Peso massimo carrello (kg)
          cartTotalFrom: String, // Totale minimo carrello
          cartTotalTo: String, // Totale massimo carrello
          // Opzioni spedizione multiple per questa tariffa
          shippingOptions: [{
            shippingName: String, // Nome opzione (es: "Corriere", "Standard")
            shippingPrice: String, // Prezzo spedizione
            shippingDays: String // Tempo stimato
          }]
        }],
        defaultShippingRate: Number // Tariffa predefinita
      },
      // Configurazioni prodotti e varianti
      productSettings: {
        // Per abbigliamento
        enableColors: {
          type: Boolean,
          default: false
        },
        availableColors: [String], // Es: ["Rosso", "Blu", "Nero"]
        enableSizes: {
          type: Boolean,
          default: false
        },
        availableSizes: [String], // Es: ["XS", "S", "M", "L", "XL"]
        // Per calzature
        enableShoeNumbers: {
          type: Boolean,
          default: false
        },
        availableShoeNumbers: [String], // Es: ["38", "39", "40"]
        // Altre varianti personalizzate
        customVariants: [{
          name: String, // Es: "Materiale"
          values: [String] // Es: ["Cotone", "Lino"]
        }]
      },
      // Configurazioni resi e garanzie
      returnPolicy: {
        enabled: {
          type: Boolean,
          default: false
        },
        days: Number, // Giorni per il reso
        description: String
      },
      // Altre impostazioni
      minOrderAmount: { // Importo minimo ordine
        type: Number,
        min: [0, 'L\'importo minimo non può essere negativo'],
        default: 0
      },
      currency: {
        type: String,
        default: 'EUR'
      },
      taxRate: { // Aliquota IVA
        type: Number,
        min: [0, 'L\'aliquota IVA non può essere negativa'],
        max: [100, 'L\'aliquota IVA non può superare 100'],
        default: 22
      },
      vacationMode: { // Modalità vacanza - disattiva tutti i prodotti
        type: Boolean,
        default: false
      }
    },    // Sistema earnings per venditori (multivendor payouts)
    totalEarnings: {
      type: Number,
      default: 0.0,
      min: [0, 'I guadagni totali non possono essere negativi']
    },
    pendingEarnings: {
      type: Number,
      default: 0.0,
      min: [0, 'I guadagni in attesa non possono essere negativi']
    },
    paidEarnings: {
      type: Number,
      default: 0.0,
      min: [0, 'I guadagni pagati non possono essere negativi']
    },
    // Debiti da rimborsi post-pagamento (Fase 6.2)
    debtBalance: {
      type: Number,
      default: 0.0,
      min: [0, 'Il saldo debito non può essere negativo']
    },
    
    // Stripe Connect Express (per venditori aziende)
    stripeConnectAccountId: {
      type: String,
      default: null,
      sparse: true, // Permette null ma deve essere unico se presente
      index: true
    },
    stripeAccountStatus: {
      type: String,
      enum: ['not_created', 'pending', 'active', 'restricted', 'disabled'],
      default: 'not_created'
    },
    stripeOnboardingCompleted: {
      type: Boolean,
      default: false
    },
    stripeChargesEnabled: {
      type: Boolean,
      default: false
    },
    stripePayoutsEnabled: {
      type: Boolean,
      default: false
    },
    stripeDetailsSubmitted: {
      type: Boolean,
      default: false
    },
    stripeOnboardingUrl: {
      type: String,
      default: null
    },
    stripeConnectedAt: {
      type: Date,
      default: null
    },
    
    // Status e verifiche
    isVerified: {
      type: Boolean,
      default: false
    },
    isApproved: { // Approvazione admin per i seller
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    // Data di scadenza abbonamento venditore
    subscriptionEndDate: {
      type: Date
    },
    // Flag per indicare se l'abbonamento è stato pagato
    subscriptionPaid: {
      type: Boolean,
      default: false
    },
    // Data dell'ultimo pagamento abbonamento
    subscriptionPaidAt: {
      type: Date
    },
    // ID del pagamento Stripe per riferimento
    subscriptionPaymentId: {
      type: String
    },
    // Tipo di abbonamento (1anno)
    subscriptionType: {
      type: String,
      enum: ['1anno']
    },
    // Flag per sospendere rinnovo automatico abbonamento (solo admin)
    subscriptionSuspended: {
      type: Boolean,
      default: false
    },
    // Documenti allegati per i venditori (es: fatture, contratti)
    vendorDocuments: [{
      name: String, // Nome originale del file
      url: String, // URL pubblico su Cloudinary
      public_id: String, // ID Cloudinary per eliminazione
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    resetPasswordToken: String,
    resetPasswordExpire: Date
  },
  {
    timestamps: true
  }
);

// Funzione per generare slug unico da businessName
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Spazi in trattini
    .replace(/[^\w\-]+/g, '')       // Rimuovi caratteri non alfanumerici
    .replace(/\-\-+/g, '-')         // Trattini multipli in uno solo
    .replace(/^-+/, '')             // Rimuovi trattini all'inizio
    .replace(/-+$/, '');            // Rimuovi trattini alla fine
}

// Genera slug automaticamente prima di salvare
userSchema.pre('save', async function (next) {
  // Genera slug solo per seller con businessName
  if (this.role === 'seller' && this.businessName && (!this.slug || this.isModified('businessName'))) {
    let slug = generateSlug(this.businessName);
    
    // Verifica unicità dello slug
    let slugExists = true;
    let counter = 1;
    let uniqueSlug = slug;
    
    while (slugExists) {
      const existingUser = await this.constructor.findOne({ 
        slug: uniqueSlug,
        _id: { $ne: this._id } // Escludi se stessi
      });
      
      if (!existingUser) {
        slugExists = false;
      } else {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }
    }
    
    this.slug = uniqueSlug;
  }
  
  next();
});

// Indice per query su ruolo e stato approvazione
// NOTA: L'indice unique su email è già creato automaticamente dalla definizione del campo
userSchema.index({ role: 1, isApproved: 1 });

// Hash della password prima di salvare
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Metodo per confrontare la password
userSchema.methods.matchPassword = async function (enteredPassword) {
    // Se non c'è password salvata, non può matchare
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, this.password);
};

// Genera e hash il token di reset password
userSchema.methods.getResetPasswordToken = function () {
  // Genera token random
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash il token e salvalo nel database
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Imposta scadenza a 1 ora
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

export default User;
