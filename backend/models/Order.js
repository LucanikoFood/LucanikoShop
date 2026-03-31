import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false  // Opzionale per ordini guest
    },
    // Campi per ordini guest (quando buyer è null)
    isGuestOrder: {
      type: Boolean,
      default: false
    },
    guestEmail: {
      type: String,
      required: false
    },
    guestName: {
      type: String,
      required: false
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        name: {
          type: String,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'La quantità minima è 1']
        },
        price: {
          type: Number,
          required: true
        },
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        ivaPercent: {
          type: Number,
          default: 22
        },
        selectedVariantSku: {
          type: String,
          required: false
        },
        selectedVariantAttributes: {
          type: Object,
          required: false
        }
      }
    ],
    // Tipo di consegna: spedizione o ritiro in negozio
    deliveryType: {
      type: String,
      enum: ['shipping', 'pickup'],
      default: 'shipping'
    },
    shippingAddress: {
      firstName: {
        type: String,
        required: false
      },
      lastName: {
        type: String,
        required: false
      },
      street: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      },
      city: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      },
      state: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      },
      zipCode: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      },
      country: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      },
      phone: {
        type: String,
        required: function() { return this.deliveryType === 'shipping'; }
      }
    },
    // Indirizzo di fatturazione (può essere diverso da spedizione)
    billingAddress: {
      firstName: String,
      lastName: String,
      codiceFiscale: String,
      ragioneSociale: String,
      partitaIVA: String,
      pecSdi: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phone: String,
      email: String
    },
    // Indirizzo negozio per ritiro (snapshot al momento dell'ordine)
    pickupAddress: {
      businessName: String,
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phone: String,
      email: String,
      notes: String, // Istruzioni per il ritiro
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['card', 'paypal', 'stripe', 'cash_on_delivery']
    },
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0
    },
    // Costi spedizione suddivisi per venditore (per ordini multi-vendor)
    // Formato: { "vendorId1": 6.00, "vendorId2": 7.00 }
    vendorShippingCosts: {
      type: Map,
      of: Number,
      required: false
    },
    taxPrice: {
      type: Number,
      required: true,
      default: 0.0
    },
    // Campi per gestione sconti/coupon
    appliedDiscount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discount'
    },
    discountAmount: {
      type: Number,
      default: 0.0
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paidAt: {
      type: Date
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true, // Permette null values per ordini non Stripe
    },
    isDelivered: {
      type: Boolean,
      default: false
    },
    deliveredAt: {
      type: Date
    },
    trackingInfo: {
      trackingNumber: {
        type: String
      },
      carrier: {
        type: String
      },
      updatedAt: {
        type: Date
      }
    },
    // Tracking separato per ogni venditore in ordini multivendor
    vendorShipments: [
      {
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        trackingNumber: {
          type: String
        },
        carrier: {
          type: String
        },
        status: {
          type: String,
          enum: ['pending', 'processing', 'shipped', 'delivered'],
          default: 'pending'
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // Campi per gestione rimborsi
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundedAt: {
      type: Date
    },
    refundReason: {
      type: String
    },
    // Flag per prevenire invio email duplicate
    emailsSent: {
      type: Boolean,
      default: false
    },
    // Note aggiuntive del cliente sull'ordine
    customerNotes: {
      type: String,
      required: false,
      maxlength: 1000 // Limite ragionevole per note
    },
    // Sistema calcolo earnings per venditori (multivendor)
    vendorEarnings: [
      {
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        productPrice: {
          type: Number,
          required: true,
          default: 0.0
        },
        shippingPrice: {
          type: Number,
          required: true,
          default: 0.0
        },
        stripeFee: {
          type: Number,
          required: true,
          default: 0.0
        },
        transferFee: {
          type: Number,
          required: true,
          default: 0.30
        },
        netAmount: {
          type: Number,
          required: true,
          default: 0.0
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indici per query comuni
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ 'items.seller': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'vendorShipments.vendorId': 1 }); // Performance per tracking multivendor

const Order = mongoose.model('Order', orderSchema);

export default Order;
