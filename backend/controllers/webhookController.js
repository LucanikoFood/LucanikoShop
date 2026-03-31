import Stripe from 'stripe';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import VendorPayout from '../models/VendorPayout.js';
import Notification from '../models/Notification.js';
import { sendOrderConfirmationEmail, sendNewOrderToVendorEmail } from '../utils/emailTemplates.js';
import { calculateVendorEarnings } from '../utils/vendorEarningsCalculator.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Gestisce il webhook di Stripe
export const handleStripeWebhook = async (req, res) => {
  console.log('\n🔔 [WEBHOOK] ================ WEBHOOK RICEVUTO ================ ');
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  console.log('🔑 [WEBHOOK] Webhook secret presente:', webhookSecret ? '✅ SI' : '❌ NO');
  if (!webhookSecret) {
    console.error('❌ [WEBHOOK] STRIPE_WEBHOOK_SECRET non configurato nel file .env!');
    console.error('❌ [WEBHOOK] Leggi il file WEBHOOK_DEBUG_INSTRUCTIONS.md per la configurazione');
    return res.status(500).send('Webhook secret non configurato');
  }

  let event;

  try {
    // Verifica che il webhook provenga davvero da Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log('✅ [WEBHOOK] Evento verificato:', event.type);
  } catch (err) {
    console.error('⚠️ Errore verifica webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gestisci l'evento checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    console.log('💳 [WEBHOOK] Processando checkout.session.completed');
    const session = event.data.object;
    console.log('📋 [WEBHOOK] Session ID:', session.id);

    try {
      // Recupera i dettagli completi della sessione con line_items e payment_intent
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'payment_intent'],
      });

      // Estrai charge ID per source_transaction nei transfer
      const paymentIntentId = session.payment_intent;
      let chargeId = null;
      if (paymentIntentId) {
        // Se payment_intent è già expanded (è un oggetto), usa direttamente
        if (typeof fullSession.payment_intent === 'object' && fullSession.payment_intent.latest_charge) {
          chargeId = fullSession.payment_intent.latest_charge;
        } else {
          // Altrimenti recupera il payment_intent
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          chargeId = paymentIntent.latest_charge;
        }
        console.log('💳 [WEBHOOK] Charge ID per transfer:', chargeId);
      }

      // Estrai userId dai metadata
      console.log('📦 [WEBHOOK] Metadata completi:', JSON.stringify(session.metadata, null, 2));
      const userId = session.metadata.userId;
      const guestEmail = session.metadata.guestEmail || session.customer_details?.email;
      const isGuestOrder = !userId || userId === 'guest';
      console.log('👤 [WEBHOOK] userId estratto:', userId, 'typeof:', typeof userId);
      console.log('👤 [WEBHOOK] isGuestOrder:', isGuestOrder);
      console.log('📧 [WEBHOOK] guestEmail:', guestEmail);

      // Recupera utente solo se non è guest
      let buyerUser = null;
      if (!isGuestOrder) {
        buyerUser = await User.findById(userId);
        console.log('👤 [WEBHOOK] Utente registrato trovato:', buyerUser ? '✅' : '❌');
      }

      console.log('✅ [WEBHOOK] Procedo con creazione ordine');
      
      // SUPPORTO CHUNK: Leggi cartItems da chunk multipli (supporto carrelli illimitati)
      let cartItemsData = [];
      if (session.metadata.cartItems_count) {
        // Nuovo formato con chunk
        const chunkCount = parseInt(session.metadata.cartItems_count);
        console.log(`📦 [WEBHOOK] Caricamento ${chunkCount} chunk di prodotti`);
        for (let i = 0; i < chunkCount; i++) {
          const chunkData = JSON.parse(session.metadata[`cartItems_${i}`]);
          cartItemsData = cartItemsData.concat(chunkData);
        }
        console.log(`📦 [WEBHOOK] Totale prodotti caricati: ${cartItemsData.length}`);
      } else if (session.metadata.cartItems) {
        // Vecchio formato (backward compatibility)
        cartItemsData = JSON.parse(session.metadata.cartItems);
        console.log(`📦 [WEBHOOK] Caricamento formato legacy: ${cartItemsData.length} prodotti`);
      } else {
        console.error('❌ [WEBHOOK] Nessun dato cartItems trovato nei metadata');
        return res.status(400).send('Dati carrello mancanti nei metadata');
      }

      // SECURITY FIX: Recupera prodotti completi dal database con seller
      const productsMap = {}; // Mappa per accedere ai customAttributes nelle email
      const orderItems = [];
      for (const item of cartItemsData) {
        const product = await Product.findById(item.productId).populate('seller');
        if (!product) {
          console.error(`⚠️ [WEBHOOK] Prodotto ${item.productId} non trovato`);
          continue;
        }
        
        // Salva product nella mappa per usarlo nelle email
        productsMap[item.productId] = product;

        // SECURITY FIX: Usa seller e nome dal database, non dai metadata
        // Decompatta varianti dal formato compatto dei metadata
        const variantSku = item.vSku || item.selectedVariantSku || undefined;
        let variantAttributes = undefined;
        
        // Decompatta vAttrs (formato compatto) in selectedVariantAttributes
        if (item.vAttrs && Array.isArray(item.vAttrs)) {
          variantAttributes = item.vAttrs.map(attr => ({
            key: attr.k,
            value: attr.v
          }));
        } else if (item.selectedVariantAttributes) {
          variantAttributes = item.selectedVariantAttributes;
        }
        
        orderItems.push({
          product: item.productId,
          name: product.name, // <-- Recuperato dal DB invece che dai metadata
          quantity: item.quantity,
          price: item.price,
          seller: product.seller._id, // <-- Dal database!
          ivaPercent: product.ivaPercent || 22,
          selectedVariantSku: variantSku,
          selectedVariantAttributes: variantAttributes,
        });
      }

      // Ottieni indirizzo di spedizione e fatturazione da BillingInfo (nei metadata)
      const deliveryType = session.metadata.deliveryType || 'shipping';
      
      // Recupera i dati di fatturazione/spedizione dal form BillingInfo (metadata separati)
      let billingData = null;
      const metadata = session.metadata;
      
      // Ricostruisci billingData dai campi metadata separati (billing_*)
      if (metadata.billing_buyerType) {
        billingData = {
          buyerType: metadata.billing_buyerType,
          nome: metadata.billing_nome || '',
          cognome: metadata.billing_cognome || '',
          codiceFiscale: metadata.billing_codiceFiscale || '',
          ragioneSociale: metadata.billing_ragioneSociale || '',
          partitaIVA: metadata.billing_partitaIVA || '',
          pecSdi: metadata.billing_pecSdi || '',
          indirizzo: metadata.billing_indirizzo || '',
          cap: metadata.billing_cap || '',
          citta: metadata.billing_citta || '',
          provincia: metadata.billing_provincia || '',
          nazione: metadata.billing_nazione || '',
          telefono: metadata.billing_telefono || '',
          email: metadata.billing_email || '',
          useAltShipping: metadata.billing_useAltShipping === 'true',
        };
        
        // Aggiungi dati indirizzo alternativo se presente
        if (billingData.useAltShipping) {
          billingData.altDestinatario = metadata.billing_altDestinatario || '';
          billingData.altIndirizzo = metadata.billing_altIndirizzo || '';
          billingData.altCap = metadata.billing_altCap || '';
          billingData.altCitta = metadata.billing_altCitta || '';
          billingData.altProvincia = metadata.billing_altProvincia || '';
          billingData.altNazione = metadata.billing_altNazione || billingData.nazione || 'Italia';
          billingData.altTelefono = metadata.billing_altTelefono || '';
          billingData.altEmail = metadata.billing_altEmail || '';
        }
        
        console.log('📋 [WEBHOOK] Dati fatturazione/spedizione recuperati da BillingInfo:', billingData);
      }
      
      // Fallback: se non ci sono dati da BillingInfo, usa quelli di Stripe (backward compatibility)
      const stripeShippingAddress = session.shipping_details?.address || session.customer_details?.address;
      const stripeShippingName = session.shipping_details?.name || session.customer_details?.name;
      const stripeShippingPhone = session.shipping_details?.phone || session.customer_details?.phone;

      console.log('📍 [WEBHOOK] deliveryType:', deliveryType);
      console.log('📍 [WEBHOOK] billingData presente:', billingData ? 'SÌ' : 'NO');
      console.log('📍 [WEBHOOK] Stripe shipping_details (fallback):', session.shipping_details);
      console.log('📍 [WEBHOOK] User address nel DB (fallback):', buyerUser?.address);
      
      // Prepara indirizzo spedizione (obbligatorio solo per shipping)
      let finalShippingAddress = null;
      let finalBillingAddress = null;
      let pickupAddress = null;

      if (deliveryType === 'pickup') {
        // Per il ritiro, recupera info negozio dai metadata
        const pickupInfo = JSON.parse(session.metadata.pickupInfo || '{}');
        pickupAddress = {
          businessName: pickupInfo.businessName || 'Negozio',
          street: pickupInfo.street || 'N/A',
          city: pickupInfo.city || 'N/A',
          state: pickupInfo.state || 'N/A',
          zipCode: pickupInfo.zipCode || 'N/A',
          country: pickupInfo.country || 'IT',
          phone: pickupInfo.phone || 'N/A',
          email: pickupInfo.email || 'N/A',
          notes: 'Ritiro in negozio - contattare il venditore prima del ritiro'
        };
        console.log('🏪 [WEBHOOK] Ritiro in negozio:', pickupAddress.businessName);
        
        // Per pickup, indirizzo spedizione minimale (compatibilità)
        if (billingData) {
          finalShippingAddress = {
            firstName: billingData.nome || billingData.aziendaNome || 'N/A',
            lastName: billingData.cognome || billingData.aziendaCognome || 'N/A',
            street: 'Ritiro in negozio',
            city: pickupAddress.city,
            state: pickupAddress.state,
            zipCode: pickupAddress.zipCode,
            country: pickupAddress.country,
            phone: billingData.telefono || 'N/A'
          };
          
          // Costruisci anche billingAddress per pickup
          finalBillingAddress = {
            firstName: billingData.nome || billingData.aziendaNome || 'N/A',
            lastName: billingData.cognome || billingData.aziendaCognome || 'N/A',
            codiceFiscale: billingData.codiceFiscale,
            ragioneSociale: billingData.ragioneSociale,
            partitaIVA: billingData.partitaIVA,
            pecSdi: billingData.pecSdi,
            street: billingData.indirizzo,
            city: billingData.citta,
            state: billingData.provincia || billingData.nazione,
            zipCode: billingData.cap,
            country: billingData.nazione,
            phone: billingData.telefono,
            email: billingData.email,
          };
        } else {
          // Fallback Stripe
          const fullName = buyerUser?.name || guestEmail || 'Cliente';
          const nameParts = fullName.split(' ');
          finalShippingAddress = {
            firstName: nameParts[0] || 'N/A',
            lastName: nameParts.slice(1).join(' ') || 'N/A',
            street: 'Ritiro in negozio',
            city: pickupAddress.city,
            state: pickupAddress.state,
            zipCode: pickupAddress.zipCode,
            country: pickupAddress.country,
            phone: session.customer_details?.phone || buyerUser?.phone || 'N/A'
          };
        }
      } else {
        // SPEDIZIONE A DOMICILIO: usa i dati da BillingInfo se disponibili
        if (billingData) {
          // Determina se usa indirizzo alternativo o principale
          const useAlt = billingData.useAltShipping;
          
          finalShippingAddress = {
            firstName: useAlt ? (billingData.altDestinatario?.split(' ')[0] || 'N/A') : (billingData.nome || billingData.aziendaNome || 'N/A'),
            lastName: useAlt ? (billingData.altDestinatario?.split(' ').slice(1).join(' ') || 'N/A') : (billingData.cognome || billingData.aziendaCognome || 'N/A'),
            street: useAlt ? billingData.altIndirizzo : billingData.indirizzo,
            city: useAlt ? billingData.altCitta : billingData.citta,
            state: useAlt ? (billingData.altProvincia || billingData.altNazione) : (billingData.provincia || billingData.nazione),
            zipCode: useAlt ? billingData.altCap : billingData.cap,
            country: useAlt ? billingData.altNazione : billingData.nazione,
            phone: useAlt ? billingData.altTelefono : billingData.telefono,
          };
          
          // Indirizzo fatturazione (sempre dall'indirizzo principale di BillingInfo)
          finalBillingAddress = {
            firstName: billingData.nome || billingData.aziendaNome || 'N/A',
            lastName: billingData.cognome || billingData.aziendaCognome || 'N/A',
            codiceFiscale: billingData.codiceFiscale,
            ragioneSociale: billingData.ragioneSociale,
            partitaIVA: billingData.partitaIVA,
            pecSdi: billingData.pecSdi,
            street: billingData.indirizzo,
            city: billingData.citta,
            state: billingData.provincia || billingData.nazione,
            zipCode: billingData.cap,
            country: billingData.nazione,
            phone: billingData.telefono,
            email: billingData.email,
          };
          
          console.log('✅ [WEBHOOK] Indirizzi costruiti da BillingInfo');
        } else {
          // Fallback: usa dati Stripe (backward compatibility per ordini vecchi)
          const fullName = stripeShippingName || buyerUser?.name || 'N/A';
          const nameParts = fullName.split(' ');
          const firstName = nameParts[0] || 'N/A';
          const lastName = nameParts.slice(1).join(' ') || 'N/A';
          
          finalShippingAddress = {
            firstName: firstName,
            lastName: lastName,
            street: stripeShippingAddress?.line1 || buyerUser?.address?.street || 'N/A',
            city: stripeShippingAddress?.city || buyerUser?.address?.city || 'N/A',
            state: stripeShippingAddress?.state || buyerUser?.address?.state || 'N/A',
            zipCode: stripeShippingAddress?.postal_code || buyerUser?.address?.zipCode || 'N/A',
            country: stripeShippingAddress?.country || buyerUser?.address?.country || 'IT',
            phone: stripeShippingPhone || buyerUser?.phone || 'N/A',
          };
          
          // Fallback: billing = shipping
          finalBillingAddress = { ...finalShippingAddress };
          
          console.log('⚠️ [WEBHOOK] Indirizzi costruiti da Stripe (fallback)');
        }
      }
      
      console.log('📍 [WEBHOOK] Indirizzo spedizione finale:', finalShippingAddress);
      console.log('📍 [WEBHOOK] Indirizzo fatturazione finale:', finalBillingAddress);

      // Ottieni costo spedizione dai metadata
      const shippingCost = parseFloat(session.metadata.shippingCost || '0');
      
      // Ottieni breakdown spedizione per venditore dai metadata
      let vendorShippingBreakdown = null;
      try {
        if (session.metadata.vendorShippingCosts) {
          vendorShippingBreakdown = JSON.parse(session.metadata.vendorShippingCosts);
          console.log('📦 [WEBHOOK] Breakdown spedizione per venditore:', vendorShippingBreakdown);
        }
      } catch (err) {
        console.warn('⚠️ [WEBHOOK] Errore parsing vendorShippingCosts:', err.message);
      }
      
      // Ottieni info sconto dai metadata
      const discountAmount = parseFloat(session.metadata.discountAmount || '0');
      const appliedCouponId = session.metadata.appliedCouponId || null;

      // Calcola importo IVA totale e somma prodotti
      let totalIva = 0;
      let itemsSubtotal = 0;
      for (const item of orderItems) {
        // Calcolo IVA su prezzo lordo (inclusa):
        // iva = prezzo * (ivaPercent / (100 + ivaPercent))
        const ivaItem = (item.price * item.quantity) * (item.ivaPercent / (100 + item.ivaPercent));
        totalIva += ivaItem;
        // Somma prezzo prodotti (senza spedizione)
        itemsSubtotal += item.price * item.quantity;
      }

      // Crea l'ordine nel database
      console.log('💾 [WEBHOOK] Creazione ordine');
      console.log('💾 [WEBHOOK] isGuestOrder:', isGuestOrder);
      console.log('💾 [WEBHOOK] buyer:', isGuestOrder ? 'null (guest)' : userId);
      console.log('💾 [WEBHOOK] Items:', orderItems.length);
      console.log('💾 [WEBHOOK] Items subtotal:', itemsSubtotal);
      console.log('💾 [WEBHOOK] Shipping cost:', shippingCost);
      console.log('💾 [WEBHOOK] Total:', session.amount_total / 100);
      
      const orderData = {
        items: orderItems,
        deliveryType: deliveryType,
        shippingAddress: finalShippingAddress,
        billingAddress: finalBillingAddress || finalShippingAddress, // Se non c'è billing, usa shipping
        pickupAddress: pickupAddress || undefined,
        paymentMethod: 'stripe',
        paymentResult: {
          id: session.payment_intent,
          status: session.payment_status,
          email_address: session.customer_details?.email,
        },
        itemsPrice: Math.round(itemsSubtotal * 100) / 100, // Somma prodotti (senza spedizione)
        shippingPrice: shippingCost,
        vendorShippingCosts: vendorShippingBreakdown || undefined, // Costi spedizione per venditore
        taxPrice: Math.round(totalIva * 100) / 100,
        discountAmount: discountAmount,
        appliedDiscount: appliedCouponId || undefined,
        totalPrice: session.amount_total / 100,
        status: 'processing',
        isPaid: true,
        paidAt: new Date(),
        stripeSessionId: session.id,
      };

      // Aggiungi campi specifici per ordini registrati o guest
      if (isGuestOrder) {
        orderData.isGuestOrder = true;
        orderData.guestEmail = guestEmail;
        orderData.guestName = session.customer_details?.name || 'Guest';
      } else {
        orderData.buyer = userId;
        orderData.isGuestOrder = false;
      }
      
      // Recupera note aggiuntive del cliente dai metadata (se presenti)
      if (session.metadata.customerNotes && session.metadata.customerNotes.trim() !== '') {
        orderData.customerNotes = session.metadata.customerNotes;
        console.log('📝 [WEBHOOK] Note cliente recuperate:', orderData.customerNotes.substring(0, 100));
      }
      
      console.log('💾 [WEBHOOK] Order data completo:', JSON.stringify(orderData, null, 2));
      
      // Controlla se l'ordine esiste già (può essere stato creato dal SUCCESS handler)
      let order = await Order.findOne({ stripeSessionId: session.id });
      
      if (order) {
        console.log('🔄 [WEBHOOK] Ordine già esistente, lo uso per processare earnings:', order._id);
      } else {
        order = await Order.create(orderData);
        console.log('✅ [WEBHOOK] Ordine creato con successo!');
      }

      //console.log('✅ [WEBHOOK] Ordine creato con successo!');
      console.log('✅ [WEBHOOK] Order ID:', order._id);
      console.log('✅ [WEBHOOK] Buyer salvato come:', order.buyer || 'Guest');
      console.log('✅ [WEBHOOK] Guest email:', order.guestEmail);
      console.log('✅ [WEBHOOK] isPaid:', order.isPaid);
      console.log('✅ [WEBHOOK] Total Price:', order.totalPrice);

      // AGGIORNA STOCK PRODOTTI
      console.log('📦 [WEBHOOK] Aggiornamento stock prodotti...');
      for (const item of orderItems) {
        try {
          const product = await Product.findById(item.product);
          if (!product) {
            console.error(`⚠️ [WEBHOOK] Prodotto ${item.product} non trovato per aggiornare stock`);
            continue;
          }

          // Se il prodotto ha varianti, aggiorna lo stock della variante specifica
          if (item.selectedVariantSku && product.variants && product.variants.length > 0) {
            const variantIndex = product.variants.findIndex(v => v.sku === item.selectedVariantSku);
            if (variantIndex !== -1) {
              const oldStock = product.variants[variantIndex].stock;
              product.variants[variantIndex].stock = Math.max(0, oldStock - item.quantity);
              await product.save();
              console.log(`✅ [WEBHOOK] Stock variante aggiornato: ${product.name} - SKU ${item.selectedVariantSku} da ${oldStock} a ${product.variants[variantIndex].stock}`);
            } else {
              console.error(`⚠️ [WEBHOOK] Variante SKU ${item.selectedVariantSku} non trovata nel prodotto ${product.name}`);
            }
          } else {
            // Prodotto senza varianti, aggiorna lo stock principale
            const oldStock = product.stock;
            product.stock = Math.max(0, oldStock - item.quantity);
            await product.save();
            console.log(`✅ [WEBHOOK] Stock aggiornato: ${product.name} da ${oldStock} a ${product.stock}`);
          }
        } catch (stockError) {
          console.error(`❌ [WEBHOOK] Errore aggiornamento stock per prodotto ${item.product}:`, stockError);
        }
      }

      // CALCOLA EARNINGS VENDITORI E CREA VENDOR PAYOUTS
      console.log('💰 [WEBHOOK] Calcolo earnings venditori...');
      console.log('💰 [WEBHOOK] Order ID per earnings:', order._id);
      
      // Controlla se earnings già calcolati
      if (order.vendorEarnings && order.vendorEarnings.length > 0) {
        console.log('⏭️  [WEBHOOK] Earnings già calcolati, skippo per evitare duplicati');
      } else {
        try {
          console.log('🔍 [WEBHOOK] Inizio calcolo vendorEarnings...');
          // Calcola earnings per ogni venditore (include shipping per venditore se disponibile)
          const vendorEarnings = calculateVendorEarnings(order, vendorShippingBreakdown);
        
        console.log(`✅ [WEBHOOK] Earnings calcolati: ${vendorEarnings.length} venditori`);
        
        // Salva earnings nell'ordine
        order.vendorEarnings = vendorEarnings;
        await order.save();
        console.log('✅ [WEBHOOK] Earnings salvati nell\'ordine');

        // Crea record VendorPayout per ogni venditore
        for (const earning of vendorEarnings) {
          try {
            const vendorPayout = await VendorPayout.create({
              vendorId: earning.vendorId,
              orderId: order._id,
              amount: earning.netAmount,
              stripeFee: earning.stripeFee,
              transferFee: earning.transferFee,
              status: 'pending',
              saleDate: new Date()
            });
            
            console.log(`✅ [WEBHOOK] VendorPayout creato per venditore ${earning.vendorId}:`, vendorPayout._id);
            console.log(`   - Prezzo prodotti: €${earning.productPrice}`);
            console.log(`   - Prezzo spedizione: €${earning.shippingPrice}`);
            console.log(`   - Importo netto: €${earning.netAmount}`);
            console.log(`   - Fee Stripe: €${earning.stripeFee}`);
            console.log(`   - Fee Transfer: €${earning.transferFee}`);

            // Aggiorna statistiche del venditore
            try {
              const vendor = await User.findById(earning.vendorId);
              if (vendor) {
                // Incrementa pendingEarnings (in attesa di pagamento)
                vendor.pendingEarnings = (vendor.pendingEarnings || 0) + earning.netAmount;
                // Incrementa totalEarnings (statistica totale)
                vendor.totalEarnings = (vendor.totalEarnings || 0) + earning.netAmount;
                await vendor.save();
                
                console.log(`✅ [WEBHOOK] Statistiche venditore aggiornate:`);
                console.log(`   - Pending Earnings: €${vendor.pendingEarnings.toFixed(2)}`);
                console.log(`   - Total Earnings: €${vendor.totalEarnings.toFixed(2)}`);

                // STRIPE CONNECT EXPRESS: Transfer automatico se account attivo
                if (vendor.stripeConnectAccountId && vendor.stripeChargesEnabled && vendor.stripePayoutsEnabled) {
                  console.log(`\n💸 [STRIPE TRANSFER] Inizio transfer automatico a venditore ${earning.vendorId}`);
                  console.log(`💸 [STRIPE TRANSFER] Account: ${vendor.stripeConnectAccountId}`);
                  console.log(`💸 [STRIPE TRANSFER] Importo: €${earning.netAmount}`);
                  console.log(`💸 [STRIPE TRANSFER] VendorPayout ID: ${vendorPayout._id}`);
                  
                  try {
                    // Converti importo in centesimi (Stripe richiede importi interi)
                    const amountInCents = Math.round(earning.netAmount * 100);
                    
                    console.log(`💸 [STRIPE TRANSFER] Centesimi: ${amountInCents}`);
                    
                    // Crea transfer verso account Connect venditore
                    const transferParams = {
                      amount: amountInCents,
                      currency: 'eur',
                      destination: vendor.stripeConnectAccountId,
                      transfer_group: order._id.toString(),
                      description: `Vendita ordine #${order._id} - ${vendor.businessName || vendor.name}`,
                      metadata: {
                        orderId: order._id.toString(),
                        vendorId: earning.vendorId,
                        payoutId: vendorPayout._id.toString()
                      }
                    };

                    // Aggiungi source_transaction se disponibile (preleva dalla transazione specifica)
                    if (chargeId) {
                      transferParams.source_transaction = chargeId;
                      console.log(`💳 [STRIPE TRANSFER] Usando source_transaction: ${chargeId}`);
                    } else {
                      console.log(`⚠️  [STRIPE TRANSFER] Nessun charge ID disponibile`);
                    }

                    console.log(`📤 [STRIPE TRANSFER] Creazione transfer su Stripe...`);
                    const transfer = await stripe.transfers.create(transferParams);

                    console.log(`✅ [STRIPE TRANSFER] Transfer completato: ${transfer.id}`);
                    console.log(`   - Importo: €${earning.netAmount.toFixed(2)}`);
                    console.log(`   - Destinazione: ${vendor.stripeConnectAccountId}`);
                    console.log(`   - Status: ${transfer.status || 'pending'}`);

                    // Aggiorna VendorPayout con info transfer
                    vendorPayout.status = 'processing';
                    vendorPayout.stripeTransferId = transfer.id;
                    vendorPayout.paymentDate = new Date();
                    await vendorPayout.save();

                    // NOTA: Gli earnings rimangono in pendingEarnings finché il payout non è completato
                    // Lo spostamento da pendingEarnings a paidEarnings avviene solo quando
                    // il payout viene segnato come 'paid' (manualmente dall'admin o via webhook)
                    
                    console.log(`✅ [STRIPE TRANSFER] VendorPayout aggiornato a 'processing'`);
                    console.log(`   - Earnings rimangono in pendingEarnings finché payout completato`);

                  } catch (transferError) {
                    console.error(`❌ [STRIPE TRANSFER] ========== ERRORE TRANSFER CRITICO ==========`);
                    console.error(`❌ [STRIPE TRANSFER] Venditore: ${earning.vendorId}`);
                    console.error(`❌ [STRIPE TRANSFER] VendorPayout ID: ${vendorPayout._id}`);
                    console.error(`❌ [STRIPE TRANSFER] Order ID: ${order._id}`);
                    console.error(`❌ [STRIPE TRANSFER] Messaggio: ${transferError.message}`);
                    console.error(`❌ [STRIPE TRANSFER] Tipo: ${transferError.type}`);
                    console.error(`❌ [STRIPE TRANSFER] Code: ${transferError.code}`);
                    console.error(`❌ [STRIPE TRANSFER] Stack:`, transferError.stack);
                    console.error(`❌ [STRIPE TRANSFER] ==================================================`);
                    
                    // Salva errore nel payout ma non bloccare il flusso
                    vendorPayout.status = 'failed';
                    vendorPayout.failureReason = transferError.message;
                    await vendorPayout.save();
                    
                    // 🚨 IMPORTANTE: Il payout rimane 'failed' e può essere ritentato con lo script retryPendingPayouts.js
                    console.log(`⚠️  [STRIPE TRANSFER] Payout salvato come 'failed' - può essere ritentato con retryPendingPayouts.js`);
                  }
                } else {
                  console.log(`⚠️  [STRIPE TRANSFER] ========== TRANSFER SKIPPED ==========`);
                  console.log(`⚠️  [STRIPE TRANSFER] Venditore ${earning.vendorId} non ha Stripe Connect attivo`);
                  console.log(`⚠️  [STRIPE TRANSFER] VendorPayout ID: ${vendorPayout._id}`);
                  console.log(`⚠️  [STRIPE TRANSFER] Order ID: ${order._id}`);
                  console.log(`⚠️  [STRIPE TRANSFER] Importo: €${earning.netAmount}`);
                  if (!vendor.stripeConnectAccountId) {
                    console.log(`⚠️  [STRIPE TRANSFER] - Nessun account Connect creato`);
                  } else if (!vendor.stripeChargesEnabled || !vendor.stripePayoutsEnabled) {
                    console.log(`⚠️  [STRIPE TRANSFER] - Account Connect non completamente attivato`);
                    console.log(`⚠️  [STRIPE TRANSFER] - Charges enabled: ${vendor.stripeChargesEnabled}`);
                    console.log(`⚠️  [STRIPE TRANSFER] - Payouts enabled: ${vendor.stripePayoutsEnabled}`);
                  }
                  console.log(`⚠️  [STRIPE TRANSFER] Transfer manuale richiesto dall'admin`);
                  console.log(`⚠️  [STRIPE TRANSFER] Il payout rimane 'pending' per transfer manuale`);
                  console.log(`⚠️  [STRIPE TRANSFER] ================================================`);
                }

              } else {
                console.error(`⚠️ [WEBHOOK] Venditore ${earning.vendorId} non trovato per aggiornare statistiche`);
              }
            } catch (vendorUpdateError) {
              console.error(`❌ [WEBHOOK] Errore aggiornamento statistiche venditore ${earning.vendorId}:`, vendorUpdateError);
            }
          } catch (payoutError) {
            console.error(`❌ [WEBHOOK] Errore creazione VendorPayout per ${earning.vendorId}:`, payoutError);
          }
        }
        } catch (earningsError) {
          console.error('❌ [WEBHOOK] ========== ERRORE CALCOLO EARNINGS CRITICO ==========');
          console.error('❌ [WEBHOOK] Order ID:', order._id);
          console.error('❌ [WEBHOOK] Session ID:', session.id);
          console.error('❌ [WEBHOOK] Messaggio:', earningsError.message);
          console.error('❌ [WEBHOOK] Stack:', earningsError.stack);
          console.error('❌ [WEBHOOK] ======================================================');
          // Non bloccare il flusso se il calcolo earnings fallisce
          // L'ordine è comunque creato, ma i payout dovranno essere creati manualmente
        }
      }

      // ⚡ DUPLICATE EMAIL PREVENTION: Verifica se email già inviate
      if (order.emailsSent) {
        console.log('✅ [WEBHOOK] Email già inviate per questo ordine, skippo per evitare duplicati');
        return res.json({ received: true });
      }

      // Invia email di conferma acquisto
      try {
        let recipientEmail, recipientName;
        
        if (isGuestOrder) {
          // Ordine guest: usa email e nome dal guest order
          recipientEmail = order.guestEmail;
          recipientName = order.guestName;
        } else {
          // Ordine registrato: recupera email e nome dal profilo
          const user = await User.findById(userId);
          if (user) {
            recipientEmail = user.email;
            recipientName = user.name;
          }
        }

        if (recipientEmail) {
          // Prepara dati ordine completi per email acquirente
          const orderDataForEmail = {
            products: order.items.map(item => {
              const product = productsMap[item.product.toString()];
              return {
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                selectedVariantSku: item.selectedVariantSku,
                selectedVariantAttributes: item.selectedVariantAttributes,
                customAttributes: product?.customAttributes || [] // Per tradurre i codici varianti
              };
            }),
            itemsPrice: order.itemsPrice,
            shippingPrice: order.shippingPrice || 0,
            totalPrice: order.totalPrice,
            customerName: recipientName,
            billingAddress: finalBillingAddress || order.billingAddress, // Usa dati appena ricostruiti
            shippingAddress: finalShippingAddress || order.shippingAddress, // Usa dati appena ricostruiti
            deliveryType: order.deliveryType,
            pickupAddress: order.pickupAddress ? 
              `${order.pickupAddress.businessName}, ${order.pickupAddress.street}, ${order.pickupAddress.city}` : null,
            customerNotes: order.customerNotes || '' // Note cliente
          };
          
          await sendOrderConfirmationEmail(
            recipientEmail, 
            recipientName, 
            order._id.toString(), 
            orderDataForEmail
          );
        }
      } catch (emailError) {
        console.error('Errore invio email conferma acquisto:', emailError);
      }

      // Invia email ai venditori
      console.log('📧 [WEBHOOK] Invio email ai venditori...');
      try {
        // Raggruppa items per venditore
        const itemsByVendor = {};
        for (const item of order.items) {
          const vendorId = item.seller.toString();
          if (!itemsByVendor[vendorId]) {
            itemsByVendor[vendorId] = [];
          }
          itemsByVendor[vendorId].push(item);
        }

        // Invia email a ciascun venditore
        const vendorEmailPromises = [];
        for (const [vendorId, vendorItems] of Object.entries(itemsByVendor)) {
          const vendor = await User.findById(vendorId).select('email name businessName companyName');
          if (!vendor || !vendor.email) {
            console.log(`⚠️ [WEBHOOK] Venditore ${vendorId} non trovato o senza email`);
            continue;
          }

          const vendorProductsList = vendorItems.map(item => `${item.name} (x${item.quantity})`).join(', ');
          const vendorTotalAmount = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const vendorShippingCost = vendorShippingBreakdown && vendorShippingBreakdown[vendorId] ? vendorShippingBreakdown[vendorId] : 0;
          const companyName = vendor.businessName || vendor.companyName || vendor.name;
          const customerName = isGuestOrder ? (order.guestName || 'Cliente Guest') : (buyerUser?.name || 'Cliente');
          
          // Prepara dati ordine completi per email venditore
          const orderDataForVendor = {
            products: vendorItems.map(item => {
              const product = productsMap[item.product.toString()];
              return {
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                selectedVariantSku: item.selectedVariantSku,
                selectedVariantAttributes: item.selectedVariantAttributes,
                customAttributes: product?.customAttributes || [] // Per tradurre i codici varianti
              };
            }),
            itemsPrice: vendorTotalAmount,
            shippingPrice: vendorShippingCost,
            totalPrice: vendorTotalAmount + vendorShippingCost,
            customerName: customerName,
            billingAddress: finalBillingAddress || order.billingAddress, // Usa dati appena ricostruiti
            shippingAddress: finalShippingAddress || order.shippingAddress, // Usa dati appena ricostruiti
            deliveryType: order.deliveryType,
            pickupAddress: order.pickupAddress ? 
              `${order.pickupAddress.businessName}, ${order.pickupAddress.street}, ${order.pickupAddress.city}` : null,
            customerNotes: order.customerNotes || '' // Note cliente
          };

          const emailPromise = sendNewOrderToVendorEmail(
            vendor.email,
            companyName,
            order._id.toString(),
            orderDataForVendor
          ).catch(err => {
            console.error(`❌ [WEBHOOK] Errore invio email a venditore ${vendor.email}:`, err.message);
          });

          vendorEmailPromises.push(emailPromise);
          console.log(`✅ [WEBHOOK] Email preparata per venditore: ${vendor.email}`);
        }

        // Attendi tutte le email ai venditori
        await Promise.all(vendorEmailPromises);
        console.log('✅ [WEBHOOK] Tutte le email ai venditori sono state inviate');
        
        // ⚡ DUPLICATE EMAIL PREVENTION: Marca email come inviate
        order.emailsSent = true;
        await order.save();
        console.log('✅ [WEBHOOK] Flag emailsSent salvato su ordine');
      } catch (vendorEmailError) {
        console.error('❌ [WEBHOOK] Errore invio email ai venditori:', vendorEmailError);
        // Non bloccare il webhook se le email ai venditori falliscono
      }

      // Crea notifiche per i venditori
      console.log('🔔 [WEBHOOK] Creazione notifiche per i venditori...');
      try {
        const notificationPromises = [];
        const itemsByVendor = {};
        for (const item of order.items) {
          const vendorId = item.seller.toString();
          if (!itemsByVendor[vendorId]) {
            itemsByVendor[vendorId] = [];
          }
          itemsByVendor[vendorId].push(item);
        }

        for (const [vendorId, vendorItems] of Object.entries(itemsByVendor)) {
          const vendorProductsList = vendorItems.map(item => `${item.name} (x${item.quantity})`).join(', ');
          const vendorTotalAmount = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          const notificationPromise = Notification.create({
            userId: vendorId,
            type: 'new_order',
            message: `🎉 Nuovo ordine ricevuto! ${vendorProductsList} - Totale: €${vendorTotalAmount.toFixed(2)}`,
            data: {
              orderId: order._id,
              orderNumber: order._id.toString(),
              totalAmount: vendorTotalAmount,
              items: vendorItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
              }))
            }
          }).catch(err => {
            console.error(`❌ [WEBHOOK] Errore creazione notifica per venditore ${vendorId}:`, err.message);
          });

          notificationPromises.push(notificationPromise);
        }

        await Promise.all(notificationPromises);
        console.log('✅ [WEBHOOK] Tutte le notifiche ai venditori sono state create');
      } catch (notificationError) {
        console.error('❌ [WEBHOOK] Errore creazione notifiche ai venditori:', notificationError);
        // Non bloccare il webhook se le notifiche falliscono
      }

      // Crea recensioni automatiche per ordini guest
      if (isGuestOrder) {
        console.log('⭐ [WEBHOOK] Creazione recensioni automatiche per ordine guest...');
        try {
          const reviewPromises = [];
          
          for (const item of order.items) {
            // Evita recensioni duplicate - controlla se esiste già una recensione automatica per questo prodotto e ordine
            const existingReview = await Review.findOne({
              product: item.product,
              guestOrderId: order._id,
              isAutomatic: true
            });

            if (!existingReview) {
              const reviewPromise = Review.create({
                product: item.product,
                rating: 5,
                comment: 'Recensione automatica da acquisto verificato',
                isVerified: true,
                isAutomatic: true,
                guestOrderId: order._id,
                helpful: 0
              }).catch(err => {
                console.error(`❌ [WEBHOOK] Errore creazione recensione automatica per prodotto ${item.product}:`, err.message);
              });

              reviewPromises.push(reviewPromise);
            } else {
              console.log(`ℹ️ [WEBHOOK] Recensione automatica già esistente per prodotto ${item.product}`);
            }
          }

          const createdReviews = await Promise.all(reviewPromises);
          const successfulReviews = createdReviews.filter(r => r !== undefined);
          console.log(`✅ [WEBHOOK] Create ${successfulReviews.length} recensioni automatiche per ordine guest`);
          
          // Aggiorna rating e numReviews dei prodotti
          if (successfulReviews.length > 0) {
            console.log('🔄 [WEBHOOK] Aggiornamento rating prodotti...');
            for (const review of successfulReviews) {
              try {
                const product = await Product.findById(review.product);
                if (product) {
                  const allReviews = await Review.find({ product: review.product });
                  const numReviews = allReviews.length;
                  const avgRating = numReviews > 0 
                    ? allReviews.reduce((acc, r) => acc + r.rating, 0) / numReviews 
                    : 0;
                  
                  product.rating = avgRating;
                  product.numReviews = numReviews;
                  await product.save();
                  
                  console.log(`  ✅ ${product.name}: rating ${avgRating.toFixed(1)}, ${numReviews} recensioni`);
                }
              } catch (updateError) {
                console.error(`❌ [WEBHOOK] Errore aggiornamento rating prodotto ${review.product}:`, updateError.message);
              }
            }
          }
        } catch (reviewError) {
          console.error('❌ [WEBHOOK] Errore creazione recensioni automatiche:', reviewError);
          // Non bloccare il webhook se le recensioni automatiche falliscono
        }
      }

    } catch (error) {
      console.error('❌ [WEBHOOK] ================ ERRORE WEBHOOK CRITICO ================');
      console.error('❌ [WEBHOOK] Session ID:', session?.id || 'N/A');
      console.error('❌ [WEBHOOK] Messaggio:', error.message);
      console.error('❌ [WEBHOOK] Stack:', error.stack);
      console.error('❌ [WEBHOOK] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error('❌ [WEBHOOK] ================================================================');
      return res.status(500).send('Errore creazione ordine');
    }
  }

  // ========== GESTIONE PAYOUT.PAID - PAYOUT STRIPE CONNECT COMPLETATO ==========
  // Questo evento si attiva quando i soldi arrivono EFFETTIVAMENTE nel conto Stripe Connect del venditore
  if (event.type === 'payout.paid') {
    console.log('💳 [WEBHOOK] Processando payout.paid - Payout completato');
    const stripePayout = event.data.object;
    console.log('📋 [WEBHOOK] Payout ID:', stripePayout.id);
    console.log('📋 [WEBHOOK] Importo:', (stripePayout.amount / 100).toFixed(2), 'EUR');
    console.log('📋 [WEBHOOK] Destinazione (Connect Account):', stripePayout.destination || 'N/A');
    console.log('📋 [WEBHOOK] Arrival date:', stripePayout.arrival_date);

    try {
      // Trova il venditore tramite l'account Stripe Connect
      // Nota: payout.paid viene emesso nel contesto dell'account Connect, 
      // quindi possiamo cercare i payout per data/importo o usare metadata se disponibile
      
      // Strategia: Trova tutti i VendorPayout in processing che potrebbero appartenere a questo payout
      // basandoci sulla finestra temporale e che hanno transfer ID
      const threeDaysAgo = new Date(stripePayout.created * 1000 - 3 * 24 * 60 * 60 * 1000);
      
      const payouts = await VendorPayout.find({ 
        stripeTransferId: { $exists: true, $ne: null },
        status: { $in: ['processing'] },
        createdAt: { $gte: threeDaysAgo }
      });

      console.log('📊 [WEBHOOK] Trovati ' + payouts.length + ' payout recenti in processing');

      let updatedCount = 0;

      for (const payout of payouts) {
        try {
          // Recupera il transfer per verificare se appartiene al Connect account corretto
          const transfer = await stripe.transfers.retrieve(payout.stripeTransferId);
          
          // Verifica se il transfer è verso lo stesso account del payout
          if (transfer && transfer.destination) {
            console.log('🔍 [WEBHOOK] Verificando transfer ' + transfer.id + ' → ' + transfer.destination);

            // Recupera il venditore
            const vendor = await User.findById(payout.vendorId);
            
            if (vendor && vendor.stripeConnectAccountId === transfer.destination) {
              console.log('✅ [WEBHOOK] Match trovato per venditore: ' + vendor.email);

              // Aggiorna status del payout a 'paid'
              payout.status = 'paid';
              payout.paymentDate = new Date(stripePayout.arrival_date * 1000);
              await payout.save();

              // Aggiorna statistiche del venditore
              console.log('📊 [WEBHOOK] Prima - Pending: €' + (vendor.pendingEarnings || 0).toFixed(2) + ', Paid: €' + (vendor.paidEarnings || 0).toFixed(2));
              
              vendor.pendingEarnings = Math.max(0, (vendor.pendingEarnings || 0) - payout.amount);
              vendor.paidEarnings = (vendor.paidEarnings || 0) + payout.amount;
              await vendor.save();

              console.log('📊 [WEBHOOK] Dopo - Pending: €' + vendor.pendingEarnings.toFixed(2) + ', Paid: €' + vendor.paidEarnings.toFixed(2));

              // Crea notifica per il venditore
              try {
                await Notification.create({
                  userId: vendor._id,
                  type: 'payment_received',
                  message: `💰 Pagamento completato! €${payout.amount.toFixed(2)} sono stati trasferiti sul tuo account.`,
                  data: {
                    payoutId: payout._id,
                    amount: payout.amount,
                    stripePayoutId: stripePayout.id
                  }
                });
                console.log('✅ [WEBHOOK] Notifica inviata al venditore');
              } catch (notifError) {
                console.error('❌ [WEBHOOK] Errore creazione notifica:', notifError.message);
              }

              updatedCount++;
            }
          }
        } catch (transferError) {
          console.log('⚠️ [WEBHOOK] Transfer ' + payout.stripeTransferId + ' non recuperabile:', transferError.message);
        }
      }

      console.log('✅ [WEBHOOK] Processamento completato: ' + updatedCount + ' payout aggiornati a "paid"');

    } catch (error) {
      console.error('❌ [WEBHOOK] Errore processando payout.paid:', error);
      // Non bloccare il webhook
    }
  }

  // Rispondi a Stripe che il webhook è stato ricevuto
  res.json({ received: true });
};