import Stripe from "stripe";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { calculateMultiVendorShipping } from "../utils/shippingCalculator.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc    Crea sessione Stripe per il checkout
// @route   POST /api/checkout/create-session
// @access  Public (supporta guest checkout)
export const createCheckoutSession = async (req, res) => {
    console.log('🚀 [CHECKOUT] ========== INIZIO SESSIONE ==========');
    console.log('🚀 [CHECKOUT] req.body ricevuto:', JSON.stringify(req.body, null, 2));
    console.log('🚀 [CHECKOUT] req.user:', req.user ? req.user._id : 'guest');
    
    try {
        const { cartItems, guestEmail, appliedCoupon, discountAmount, deliveryType = 'shipping', billingData } = req.body;

        console.log('🚀 [CHECKOUT] cartItems estratto:', Array.isArray(cartItems) ? cartItems.length : 'non è array');
        console.log('🚀 [CHECKOUT] guestEmail:', guestEmail);
        console.log('🚀 [CHECKOUT] billingData ricevuto:', billingData ? 'SÌ' : 'NO');

        if (!cartItems || cartItems.length === 0) {
            console.log('❌ [CHECKOUT] Carrello vuoto');
            return res.status(400).json({ message: 'Il carrello è vuoto' });
        }

        console.log('🛒 [CHECKOUT] Ricevuti', cartItems.length, 'prodotti');
        console.log('🎫 [CHECKOUT] appliedCoupon ricevuto:', JSON.stringify(appliedCoupon));
        console.log('🎫 [CHECKOUT] discountAmount ricevuto:', discountAmount, 'tipo:', typeof discountAmount);
        console.log('📦 [CHECKOUT] deliveryType:', deliveryType);

        // Calcola totale carrello
        console.log('💰 [CHECKOUT] Calcolo totale carrello...');
        const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountedTotal = cartTotal - (discountAmount || 0);

        console.log('💰 [CHECKOUT] Totale: €' + cartTotal.toFixed(2), '| Dopo sconto: €' + discountedTotal.toFixed(2));

        // Raggruppa items per venditore
        console.log('🔍 [CHECKOUT] Inizio loop prodotti...');
        const itemsByVendor = {};
        // SECURITY FIX: Mappa prodotti con sellerId dal database (non dal frontend)
        const productsWithSeller = {};

        for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            console.log(`🔍 [CHECKOUT] Prodotto ${i + 1}/${cartItems.length}: ${item._id}`);
            
            const product = await Product.findById(item._id).populate('seller', 'shopSettings name businessName storeAddress businessPhone businessEmail paymentMethods');
            
            console.log(`🔍 [CHECKOUT] Prodotto trovato: ${product ? product.name : 'NULL'}`);
            
            if (!product) {
                console.log(`❌ [CHECKOUT] Prodotto non trovato in DB: ${item._id}`);
                return res.status(404).json({ message: `Prodotto non trovato: ${item._id}` });
            }

            // Controllo sicurezza: verifica che seller sia popolato
            console.log(`🔍 [CHECKOUT] Verifica seller per ${product.name}...`);
            console.log(`🔍 [CHECKOUT] product.seller:`, product.seller ? 'EXISTS' : 'NULL');
            
            if (!product.seller || !product.seller._id) {
                console.error('❌ [CHECKOUT] Prodotto senza seller valido:', {
                    productId: item._id,
                    productName: product.name,
                    seller: product.seller
                });
                return res.status(500).json({ 
                    message: `Il prodotto "${product.name}" non ha un venditore valido associato. Contatta l'assistenza.` 
                });
            }

            const vendorId = product.seller._id.toString();

            // SECURITY FIX: Salva sellerId corretto dal database
            productsWithSeller[item._id] = vendorId;

            if (!itemsByVendor[vendorId]) {
                itemsByVendor[vendorId] = {
                    vendorId,
                    vendorName: product.seller.name,
                    businessName: product.seller.businessName,
                    items: [],
                    vendorShippingSettings: product.seller.shopSettings?.shipping || null,
                    storeAddress: product.seller.storeAddress,
                    businessPhone: product.seller.businessPhone,
                    businessEmail: product.seller.businessEmail
                };
            }

            // Assicurati che il peso sia sempre un numero
            const productWeight = typeof product.weight === 'string' 
                ? parseFloat(product.weight.replace(',', '.')) || 0
                : (typeof product.weight === 'number' ? product.weight : 0);

            itemsByVendor[vendorId].items.push({
                product: {
                    _id: product._id,
                    name: product.name,
                    weight: productWeight,
                    price: product.price
                },
                quantity: item.quantity,
                price: item.price
            });
        }

        // Log carrello multivendor
        const vendorCount = Object.keys(itemsByVendor).length;
        console.log(`🏪 [CHECKOUT] Carrello multivendor: ${vendorCount} venditore/i`);

        // Verifica per ritiro in negozio: solo carrelli single-vendor
        if (deliveryType === 'pickup' && vendorCount > 1) {
            return res.status(400).json({ 
                message: 'Il ritiro in negozio è disponibile solo per ordini da un singolo venditore. Rimuovi i prodotti di altri venditori o scegli la spedizione.' 
            });
        }

        let shippingResult = { totalShipping: 0 };
        let pickupInfo = null;

        if (deliveryType === 'pickup') {
            // Recupera info negozio del venditore per il ritiro
            const vendor = Object.values(itemsByVendor)[0];
            if (!vendor.storeAddress || !vendor.storeAddress.street) {
                return res.status(400).json({ 
                    message: 'Questo venditore non ha configurato un indirizzo per il ritiro in negozio. Scegli la spedizione a domicilio.' 
                });
            }
            
            pickupInfo = {
                businessName: vendor.businessName || vendor.vendorName,
                street: vendor.storeAddress.street,
                city: vendor.storeAddress.city,
                state: vendor.storeAddress.state,
                zipCode: vendor.storeAddress.zipCode,
                country: vendor.storeAddress.country,
                phone: vendor.businessPhone || '',
                email: vendor.businessEmail || '',
            };
            
            console.log('🏪 [CHECKOUT] Ritiro in negozio - Indirizzo:', pickupInfo.businessName);
        } else {
            // Calcola spedizione usando il totale SCONTATO per i range
            const vendorShippingArray = Object.values(itemsByVendor);
            shippingResult = calculateMultiVendorShipping(
                vendorShippingArray,
                { country: 'Italia', state: '' },
                discountedTotal // Passa il totale scontato
            );

            console.log('📦 [CHECKOUT] Costo spedizione calcolato: €' + shippingResult.totalShipping.toFixed(2));
        }

        console.log('💳 [CHECKOUT] Tutti i pagamenti vanno a Lucaniko Shop');

        // Converti i prodotti del carrello in formato Stripe
        // STRIPE FIX: Valida tutti i campi per evitare null/undefined
        const lineItems = cartItems.map(item => {
            const price = item.price || 0;
            const categoryDescription = typeof item.category === 'string' 
                ? item.category 
                : item.category?.name || 'Prodotto';
            
            // Valida campi obbligatori
            if (!item._id || !item.name || !item.quantity) {
                console.error('❌ [CHECKOUT] Item carrello non valido:', item);
                throw new Error('Prodotto nel carrello mancante di dati obbligatori');
            }
            
            return {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: String(item.name), // STRIPE FIX: Converti sempre a stringa
                        description: String(categoryDescription),
                        images: item.images && item.images.length > 0 && item.images[item.images.length - 1]?.url
                            ? [String(item.images[item.images.length - 1].url)]
                            : [],
                        metadata: {
                            productId: String(item._id), // STRIPE FIX: Converti a stringa
                            sellerId: String(productsWithSeller[item._id] || ''), // STRIPE FIX: Fallback a stringa vuota
                        },
                    },
                    unit_amount: Math.round(price * 100),
                },
                quantity: parseInt(item.quantity) || 1, // STRIPE FIX: Assicura numero intero
            };
        });

        // Aggiungi spedizione come line item SOLO se spedizione a domicilio
        if (deliveryType === 'shipping' && shippingResult.totalShipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Spedizione',
                        description: 'Costo di spedizione per il tuo ordine',
                    },
                    unit_amount: Math.round(shippingResult.totalShipping * 100),
                },
                quantity: 1,
            });
        } else if (deliveryType === 'pickup') {
            console.log('🏪 [CHECKOUT] Ritiro in negozio - Nessun costo di spedizione');
        }

        // Determina l'email del cliente (VALIDAZIONE RIGOROSA)
        const customerEmail = req.user?.email || guestEmail;

        if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
            console.error('❌ [CHECKOUT] Email non valida:', customerEmail);
            return res.status(400).json({ message: 'Email cliente valida richiesta per il checkout' });
        }

        // Prepara le opzioni per la sessione Stripe
        console.log('📝 [CHECKOUT] Preparazione metadata...');
        console.log('👤 [CHECKOUT] req.user:', req.user ? 'Present' : 'Missing');
        if (req.user) {
            console.log('👤 [CHECKOUT] req.user._id:', req.user._id);
            console.log('👤 [CHECKOUT] req.user._id.toString():', req.user._id.toString());
        }
        
        // SOLUZIONE DEFINITIVA: Spezza cartItems in chunk da max 450 caratteri per rispettare limite Stripe 500
        // Questo permette carrelli ILLIMITATI (fino a 50 chiavi metadata Stripe = 200 prodotti max)
        // STRIPE FIX: Valida tutti i valori prima di JSON.stringify
        const cartItemsCompact = cartItems.map(item => {
            const compactItem = {
                productId: String(item._id || ''), // STRIPE FIX: Converti a stringa con fallback
                sellerId: String(productsWithSeller[item._id] || ''), // STRIPE FIX: Dal database con fallback
                quantity: parseInt(item.quantity) || 1, // STRIPE FIX: Numero intero valido
                price: parseFloat(item.price) || 0, // STRIPE FIX: Numero valido
            };
            
            // Aggiungi varianti solo se presenti, in formato COMPATTO
            if (item.selectedVariantSku) {
                compactItem.vSku = String(item.selectedVariantSku);
            }
            
            // Compatta selectedVariantAttributes rimuovendo campi superflui (_id, id)
            if (item.selectedVariantAttributes && Array.isArray(item.selectedVariantAttributes) && item.selectedVariantAttributes.length > 0) {
                compactItem.vAttrs = item.selectedVariantAttributes.map(attr => ({
                    k: String(attr.key || ''),  // STRIPE FIX: Converti a stringa
                    v: String(attr.value || '') // STRIPE FIX: Converti a stringa
                }));
            }
            
            return compactItem;
        });
        
        const chunkSize = 3; // Ridotto da 4 a 3 per sicurezza con varianti
        const chunks = [];
        for (let i = 0; i < cartItemsCompact.length; i += chunkSize) {
            chunks.push(cartItemsCompact.slice(i, i + chunkSize));
        }
        
        console.log(`📦 [CHECKOUT] Prodotti divisi in ${chunks.length} chunk (${chunkSize} prodotti/chunk)`);
        
        // Costruisci metadata con billingData suddiviso in campi separati per evitare limite 500 caratteri
        // OPTIMIZATION: NON salvare nomi prodotti (possono superare 500 char), recuperali dal DB
        // STRIPE FIX: Assicurati che TUTTI i valori siano stringhe (mai null/undefined)
        const metadata = {
            userId: req.user ? req.user._id.toString() : 'guest',
            guestEmail: guestEmail?.toString() || '',
            deliveryType: deliveryType?.toString() || 'shipping',
            shippingCost: (shippingResult.totalShipping || 0).toString(),
            // Salva breakdown shipping per venditore (formato compatto)
            vendorShippingCosts: JSON.stringify(
                Object.entries(shippingResult.vendorShippingCosts || {}).reduce((acc, [vendorId, data]) => {
                    acc[vendorId] = data.shippingCost || 0;
                    return acc;
                }, {})
            ),
            appliedCouponCode: appliedCoupon?.couponCode?.toString() || '',
            appliedCouponId: appliedCoupon?._id?.toString() || '',
            discountAmount: (discountAmount || 0).toString(),
            // Salva info ritiro in negozio se presente
            pickupInfo: pickupInfo ? JSON.stringify(pickupInfo) : '',
        };

        // Salva numero di chunk e i chunk individuali
        metadata.cartItems_count = chunks.length.toString();
        chunks.forEach((chunk, index) => {
            metadata[`cartItems_${index}`] = JSON.stringify(chunk);
        });


        // Aggiungi dati di fatturazione come campi separati (evita limite 500 caratteri Stripe)
        if (billingData) {
            // Tronca campi se superano 500 caratteri (limite Stripe per metadata)
            // STRIPE FIX: Gestione esplicita di null/undefined per evitare StripeInvalidRequestError
            const truncate = (str, maxLen = 500) => {
                if (str === null || str === undefined) return '';
                const strValue = String(str); // Converti sempre a stringa
                return strValue.length > maxLen ? strValue.substring(0, maxLen) : strValue;
            };
            
            metadata.billing_buyerType = truncate(billingData.buyerType);
            metadata.billing_nome = truncate(billingData.nome);
            metadata.billing_cognome = truncate(billingData.cognome);
            metadata.billing_codiceFiscale = truncate(billingData.codiceFiscale);
            metadata.billing_ragioneSociale = truncate(billingData.ragioneSociale);
            metadata.billing_partitaIVA = truncate(billingData.partitaIVA);
            metadata.billing_pecSdi = truncate(billingData.pecSdi);
            metadata.billing_indirizzo = truncate(billingData.indirizzo);
            metadata.billing_cap = truncate(billingData.cap);
            metadata.billing_citta = truncate(billingData.citta);
            metadata.billing_provincia = truncate(billingData.provincia);
            metadata.billing_nazione = truncate(billingData.nazione);
            metadata.billing_telefono = truncate(billingData.telefono);
            metadata.billing_email = truncate(billingData.email);
            metadata.billing_useAltShipping = billingData.useAltShipping ? 'true' : 'false';
            // Dati indirizzo alternativo (se presente)
            if (billingData.useAltShipping) {
                metadata.billing_altDestinatario = truncate(billingData.altDestinatario);
                metadata.billing_altIndirizzo = truncate(billingData.altIndirizzo);
                metadata.billing_altCap = truncate(billingData.altCap);
                metadata.billing_altCitta = truncate(billingData.altCitta);
                metadata.billing_altProvincia = truncate(billingData.altProvincia);
                metadata.billing_altNazione = truncate(billingData.altNazione || billingData.nazione || 'Italia');
                metadata.billing_altTelefono = truncate(billingData.altTelefono);
                metadata.billing_altEmail = truncate(billingData.altEmail);
            }
        }

        const sessionOptions = {
            payment_method_types: ['card'], // Solo card - altri metodi (klarna, paypal) devono essere attivati in Stripe Dashboard
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
            // NON raccogliamo billing/shipping in Stripe perché già raccolti in BillingInfo.jsx
            // billing_address_collection: 'auto', // RIMOSSO - dati già nei metadata
            customer_email: customerEmail, // STRIPE FIX: Usa la variabile validata sopra (garantisce email valida)
            phone_number_collection: {
                enabled: false // Non chiediamo telefono, già in BillingInfo
            },
            metadata: metadata,
        };

        // NON aggiungiamo shipping_address_collection - dati già raccolti in BillingInfo.jsx
        // La spedizione viene gestita dai metadata billing_* campi
        // Tutti i dati necessari (fatturazione, spedizione, pickup) sono già nei metadata
        
        // Log diagnostico dimensione metadata chunks
        console.log('📦 [CHECKOUT] Metadata preparati:', {
            userId: sessionOptions.metadata.userId,
            isGuest: sessionOptions.metadata.userId === 'guest',
            deliveryType: deliveryType,
            itemsCount: cartItems.length,
            chunksCount: chunks.length
        });

        // STRIPE FIX: Log di debug pre-invio per diagnosi errori
        console.log('🔍 [CHECKOUT] Validazione pre-Stripe:');
        console.log('  - customer_email:', customerEmail ? 'OK' : 'MISSING');
        console.log('  - line_items:', lineItems.length, 'items');
        console.log('  - metadata keys:', Object.keys(metadata).length);
        
        // Valida che tutti i metadata values siano stringhe
        const invalidMetadata = Object.entries(metadata).filter(([key, value]) => 
            value !== null && value !== undefined && typeof value !== 'string'
        );
        if (invalidMetadata.length > 0) {
            console.error('❌ [CHECKOUT] Metadata non validi (devono essere stringhe):', invalidMetadata);
            throw new Error('Metadata validation failed: alcuni valori non sono stringhe');
        }

        // Se c'è uno sconto, crea un Coupon Stripe al volo e applicalo
        if (discountAmount && discountAmount > 0) {
            console.log('🎫 [CHECKOUT] Condizione sconto verificata - discountAmount:', discountAmount);
            console.log('🎫 [CHECKOUT] Creazione coupon Stripe per:', appliedCoupon?.couponCode, '- Sconto: €' + discountAmount.toFixed(2));
            
            try {
                // Crea un coupon Stripe temporaneo
                // STRIPE FIX: Assicura che amount_off sia valido e name sia stringa
                const stripeCoupon = await stripe.coupons.create({
                    amount_off: Math.round(Math.abs(discountAmount) * 100), // Assicura valore positivo
                    currency: 'eur',
                    duration: 'once',
                    name: String(appliedCoupon?.couponCode || 'Sconto'),
                });

                console.log('✅ [CHECKOUT] Coupon Stripe creato:', stripeCoupon.id, '| amount_off:', stripeCoupon.amount_off);

                // Applica il coupon alla sessione
                sessionOptions.discounts = [{
                    coupon: stripeCoupon.id
                }];

                console.log('✅ [CHECKOUT] Discount applicato a sessionOptions');
            } catch (couponError) {
                console.error('⚠️ [CHECKOUT] Errore creazione coupon Stripe:', couponError.message);
                console.error('⚠️ [CHECKOUT] Stack:', couponError.stack);
                // Fallback: usa line item negativo
                // STRIPE FIX: Converti nome coupon a stringa valida
                const discountName = appliedCoupon?.couponCode 
                    ? `Sconto (${String(appliedCoupon.couponCode)})` 
                    : 'Sconto';
                
                lineItems.push({
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: discountName,
                            description: 'Sconto applicato al carrello',
                        },
                        unit_amount: -Math.round(discountAmount * 100),
                    },
                    quantity: 1,
                });
                console.log('⚠️ [CHECKOUT] Fallback: aggiunto line item negativo');
            }
        } else {
            console.log('⚠️ [CHECKOUT] Nessuno sconto da applicare - discountAmount:', discountAmount);
        }

        // Crea la sessione Stripe
        console.log('🔧 [CHECKOUT] Creazione sessione con discounts:', sessionOptions.discounts);
        const session = await stripe.checkout.sessions.create(sessionOptions);

        console.log('✅ [CHECKOUT] Sessione Stripe creata con successo - ID:', session.id);
        console.log('✅ [CHECKOUT] Sessione amount_total:', session.amount_total, '(centesimi)');

        res.status(200).json({
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('❌ [CHECKOUT] ========== ERRORE CRITICO ==========');
        console.error('❌ [CHECKOUT] Message:', error.message);
        console.error('❌ [CHECKOUT] Stack:', error.stack);
        console.error('❌ [CHECKOUT] Name:', error.name);
        
        // STRIPE FIX: Log dettagliato errori Stripe per debug
        if (error.type === 'StripeInvalidRequestError') {
            console.error('❌ [CHECKOUT] STRIPE ERROR DETAILS:');
            console.error('  - Type:', error.type);
            console.error('  - Code:', error.code);
            console.error('  - Param:', error.param);
            console.error('  - StatusCode:', error.statusCode);
            console.error('  - RequestId:', error.requestId);
        }
        
        console.error('❌ [CHECKOUT] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error('❌ [CHECKOUT] =====================================');
        
        res.status(500).json({ 
            message: error.message || 'Errore durante il checkout',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};