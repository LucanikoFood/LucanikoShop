import { Discount, Product } from '../models/index.js';

/**
 * Verifica e aggiorna gli sconti scaduti o da attivare
 * Questa funzione dovrebbe essere eseguita periodicamente (es: ogni ora o ogni giorno)
 */
export const updateExpiredDiscounts = async () => {
  try {
    const now = new Date();
    
    // 1. Trova gli sconti che devono essere disattivati (scaduti)
    const expiredDiscounts = await Discount.find({
      isActive: true,
      endDate: { $lt: now }
    });

    for (const discount of expiredDiscounts) {
      // Disattiva lo sconto
      discount.isActive = false;
      await discount.save();

      // Rimuovi lo sconto dai prodotti
      if (discount.applicationType === 'product' && discount.products.length > 0) {
        await removeDiscountFromProducts(discount);
      } else if (discount.applicationType === 'category' && discount.categories.length > 0) {
        await removeDiscountFromCategories(discount);
      }
    }

    // 2. Trova gli sconti che devono essere attivati (periodo valido ma non ancora attivi)
    const discountsToActivate = await Discount.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    for (const discount of discountsToActivate) {
      // Applica lo sconto ai prodotti
      if (discount.applicationType === 'product' && discount.products.length > 0) {
        await applyDiscountToProducts(discount);
      } else if (discount.applicationType === 'category' && discount.categories.length > 0) {
        await applyDiscountToCategories(discount);
      }
    }

    return {
      expired: expiredDiscounts.length,
      activated: discountsToActivate.length
    };
  } catch (error) {
    console.error('❌ Errore nell\'aggiornamento degli sconti:', error);
    throw error;
  }
};

/**
 * Calcola il miglior sconto applicabile a un prodotto
 */
export const getBestDiscountForProduct = async (productId, sellerId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return null;

    const now = new Date();

    // Trova tutti gli sconti validi per questo prodotto
    const discounts = await Discount.find({
      seller: sellerId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { applicationType: 'product', products: productId },
        { applicationType: 'category', categories: product.category }
      ]
    });

    if (discounts.length === 0) return null;

    // Trova lo sconto che offre il maggior risparmio
    let bestDiscount = null;
    let maxSavings = 0;

    for (const discount of discounts) {
      const discountedPrice = discount.calculateDiscountedPrice(product.price);
      const savings = product.price - discountedPrice;

      if (savings > maxSavings) {
        maxSavings = savings;
        bestDiscount = discount;
      }
    }

    return bestDiscount;
  } catch (error) {
    console.error('❌ Errore nel calcolo del miglior sconto:', error);
    throw error;
  }
};

/**
 * Applica il miglior sconto disponibile a un prodotto
 */
export const applyBestDiscountToProduct = async (productId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return null;

    const bestDiscount = await getBestDiscountForProduct(productId, product.seller);
    
    if (bestDiscount) {
      product.applyDiscount(bestDiscount);
      await product.save();
      return product;
    }

    return product;
  } catch (error) {
    console.error('❌ Errore nell\'applicazione dello sconto:', error);
    throw error;
  }
};

/**
 * Ricalcola tutti gli sconti per un seller
 */
export const recalculateSellerDiscounts = async (sellerId) => {
  try {
    // Trova tutti i prodotti del seller
    const products = await Product.find({ seller: sellerId });

    for (const product of products) {
      // Rimuovi lo sconto attuale
      product.removeDiscount();
      
      // Applica il miglior sconto disponibile
      const bestDiscount = await getBestDiscountForProduct(product._id, sellerId);
      if (bestDiscount) {
        product.applyDiscount(bestDiscount);
      }
      
      await product.save();
    }

    return products.length;
  } catch (error) {
    console.error('❌ Errore nel ricalcolo degli sconti:', error);
    throw error;
  }
};

/**
 * Valida se un coupon può essere usato
 */
export const validateCouponForCart = async (couponCode, cart, userId) => {
  try {
    const discount = await Discount.findOne({
      couponCode: couponCode.toUpperCase(),
      applicationType: 'coupon',
      isActive: true
    });

    if (!discount || !discount.isValidNow()) {
      return {
        valid: false,
        message: 'Codice coupon non valido o scaduto'
      };
    }

    // Calcola il totale del carrello
    // DISCOUNT FIX: Usa sempre il prezzo scontato se disponibile
    const cartTotal = cart.reduce((total, item) => {
      const itemPrice = (item.hasActiveDiscount && item.discountedPrice) 
        ? item.discountedPrice 
        : item.price || 0;
      return total + (itemPrice * item.quantity);
    }, 0);

    // Verifica l'importo minimo
    if (cartTotal < discount.minPurchaseAmount) {
      return {
        valid: false,
        message: `L'importo minimo per questo coupon è €${discount.minPurchaseAmount}`
      };
    }

    // Calcola lo sconto
    let discountAmount = 0;
    if (discount.discountType === 'percentage') {
      discountAmount = (cartTotal * discount.discountValue) / 100;
      if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
        discountAmount = discount.maxDiscountAmount;
      }
    } else {
      discountAmount = discount.discountValue;
    }

    const finalTotal = Math.max(0, cartTotal - discountAmount);

    return {
      valid: true,
      discount: discount,
      originalTotal: cartTotal,
      discountAmount: discountAmount,
      finalTotal: finalTotal
    };
  } catch (error) {
    console.error('❌ Errore nella validazione del coupon:', error);
    return {
      valid: false,
      message: 'Errore nella validazione del coupon'
    };
  }
};

// Funzioni helper
async function applyDiscountToProducts(discount) {
  const products = await Product.find({
    _id: { $in: discount.products },
    seller: discount.seller
  });

  for (const product of products) {
    product.applyDiscount(discount);
    await product.save();
  }
}

async function applyDiscountToCategories(discount) {
  const products = await Product.find({
    $or: [
      { category: { $in: discount.categories } },
      { subcategory: { $in: discount.categories } }
    ],
    seller: discount.seller
  });

  for (const product of products) {
    // Applica il miglior sconto disponibile
    const currentDiscount = product.activeDiscount;
    if (!currentDiscount) {
      product.applyDiscount(discount);
      await product.save();
    } else {
      // Confronta con lo sconto corrente e applica il migliore
      const existingDiscount = await Discount.findById(currentDiscount);
      const currentSavings = product.price - product.discountedPrice;
      const newSavings = product.price - discount.calculateDiscountedPrice(product.price);
      
      if (newSavings > currentSavings) {
        product.applyDiscount(discount);
        await product.save();
      }
    }
  }
}

async function removeDiscountFromProducts(discount) {
  const products = await Product.find({
    _id: { $in: discount.products },
    seller: discount.seller,
    activeDiscount: discount._id
  });

  for (const product of products) {
    product.removeDiscount();
    await product.save();
  }
}

async function removeDiscountFromCategories(discount) {
  const products = await Product.find({
    $or: [
      { category: { $in: discount.categories } },
      { subcategory: { $in: discount.categories } }
    ],
    seller: discount.seller,
    activeDiscount: discount._id
  });

  for (const product of products) {
    product.removeDiscount();
    
    // Riapplica il miglior sconto disponibile
    const bestDiscount = await getBestDiscountForProduct(product._id, discount.seller);
    if (bestDiscount) {
      product.applyDiscount(bestDiscount);
    }
    
    await product.save();
  }
}
