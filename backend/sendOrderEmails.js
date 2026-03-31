import 'dotenv/config';
import mongoose from 'mongoose';
import Order from './models/Order.js';
import Product from './models/Product.js';
import User from './models/User.js';
import { sendOrderConfirmationEmail, sendNewOrderToVendorEmail } from './utils/emailTemplates.js';

// Script per inviare email per un ordine specifico
async function sendEmailsForOrder(orderId, useProduction = false) {
  try {
    console.log('🔍 [EMAIL] Connessione MongoDB...');
    
    const mongoUri = useProduction 
      ? (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI)
      : (process.env.MONGODB_URI || process.env.MONGODB_URI_PROD);
    
    if (!mongoUri) {
      throw new Error('❌ MONGODB_URI non trovato nel file .env');
    }
    
    const dbName = useProduction ? 'PRODUZIONE' : 'SVILUPPO';
    console.log(`📦 [EMAIL] Database: ${dbName}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ [EMAIL] Connesso a MongoDB');

    // Recupera l'ordine con populate
    console.log(`🔍 [EMAIL] Recupero ordine: ${orderId}`);
    const order = await Order.findById(orderId)
      .populate('buyer', 'name email')
      .populate({
        path: 'items.product',
        populate: { path: 'seller', select: 'name email businessName' }
      });

    if (!order) {
      throw new Error(`❌ Ordine ${orderId} non trovato`);
    }

    console.log('✅ [EMAIL] Ordine trovato');
    console.log(`📋 [EMAIL] Order ID: ${order._id}`);
    console.log(`📋 [EMAIL] Totale: €${order.totalPrice}`);
    console.log(`📋 [EMAIL] Cliente: ${order.guestEmail || order.buyer?.email}`);
    console.log(`📋 [EMAIL] Prodotti: ${order.items.length}`);

    // Verifica che billingAddress esista
    if (!order.billingAddress || !order.billingAddress.email) {
      throw new Error('❌ BillingAddress mancante o incompleto nell\'ordine');
    }

    // Trasforma l'ordine nel formato che i template email si aspettano
    const orderData = {
      products: order.items.map(item => ({
        name: item.product?.name || item.name ||'Prodotto sconosciuto',
        quantity: item.quantity,
        price: item.price,
        selectedVariantAttributes: item.selectedVariantAttributes || [],
        customAttributes: item.product?.customAttributes || [] // Per tradurre i codici varianti
      })),
      itemsPrice: order.itemsPrice,
      shippingPrice: order.shippingPrice,
      totalPrice: order.totalPrice,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      deliveryType: order.deliveryType,
      customerNotes: order.customerNotes || '', // Note cliente
    };

    // Invia email al buyer
    console.log('\n📧 [EMAIL] Invio email al buyer...');
    const buyerEmail = order.isGuestOrder ? order.guestEmail : order.buyer.email;
    const buyerName = order.isGuestOrder 
      ? (order.billingAddress?.firstName || 'Cliente')
      : (order.buyer?.name || 'Cliente');
    
    // Usa orderNumber se esiste, altrimenti l'ID dell'ordine
    const orderReference = order.orderNumber || order._id.toString().toUpperCase();
    
    try {
      await sendOrderConfirmationEmail(
        buyerEmail,
        buyerName,
        orderReference,
        orderData
      );
      console.log('✅ [EMAIL] Email buyer inviata a:', buyerEmail);
    } catch (emailError) {
      console.error('❌ [EMAIL] Errore invio email buyer:', emailError.message);
      console.error(emailError);
    }

    // Raggruppa prodotti per venditore
    console.log('\n📧 [EMAIL] Preparazione email venditori...');
    const vendorGroups = {};
    
    for (const item of order.items) {
      // Assicurati che product esista e sia popolato
      if (!item.product) {
        console.warn(`⚠️ [EMAIL] Prodotto non trovato per item in ordine ${order._id}`);
        continue;
      }

      const product = item.product;
      const seller = product.seller;
      
      if (!seller || !seller._id) {
        console.warn(`⚠️ [EMAIL] Venditore non trovato per prodotto ${product._id}`);
        continue;
      }

      const vendorId = seller._id.toString();
      
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = {
          vendor: seller,
          items: [],
        };
      }
      
      vendorGroups[vendorId].items.push({
        ...item.toObject(),
        product: product,
      });
    }

    console.log(`📦 [EMAIL] Trovati ${Object.keys(vendorGroups).length} venditori`);

    // Invia email a ogni venditore
    for (const [vendorId, vendorGroup] of Object.entries(vendorGroups)) {
      const vendorEmail = vendorGroup.vendor.email;
      const vendorName = vendorGroup.vendor.businessName || vendorGroup.vendor.name;
      
      // Calcola totale per questo venditore (solo i suoi prodotti)
      const vendorItemsPrice = vendorGroup.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Ottieni costo spedizione specifico di questo venditore
      let vendorShippingCost = 0;
      if (order.vendorShippingCosts && order.vendorShippingCosts.get(vendorId)) {
        // Usa il costo specifico salvato nell'ordine
        vendorShippingCost = order.vendorShippingCosts.get(vendorId);
        console.log(`📦 [EMAIL] Spedizione ${vendorName}: €${vendorShippingCost.toFixed(2)} (da vendorShippingCosts)`);
      } else {
        // Fallback: dividi proporzionalmente in base al valore dei prodotti
        const totalItemsValue = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        vendorShippingCost = (vendorItemsPrice / totalItemsValue) * order.shippingPrice;
        console.log(`📦 [EMAIL] Spedizione ${vendorName}: €${vendorShippingCost.toFixed(2)} (proporzionale)`);
      }
      
      // Nome cliente per l'email
      const customerName = order.isGuestOrder 
        ? (order.billingAddress?.firstName + ' ' + order.billingAddress?.lastName || order.guestName || 'Cliente')
        : (order.buyer?.name || 'Cliente');
      
      // Crea orderData specifico per questo venditore
      const vendorOrderData = {
        products: vendorGroup.items.map(item => ({
          name: item.product?.name || 'Prodotto sconosciuto',
          quantity: item.quantity,
          price: item.price,
          selectedVariantAttributes: item.selectedVariantAttributes || [],
          customAttributes: item.product?.customAttributes || [] // Per tradurre i codici varianti
        })),
        itemsPrice: vendorItemsPrice,
        shippingPrice: vendorShippingCost, // Spedizione specifica di questo venditore
        totalPrice: vendorItemsPrice + vendorShippingCost,
        customerName: customerName,
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        deliveryType: order.deliveryType,
        customerNotes: order.customerNotes || '', // Note cliente
      };
      
      try {
        await sendNewOrderToVendorEmail(
          vendorEmail,
          vendorName,
          orderReference,
          vendorOrderData
        );
        console.log(`✅ [EMAIL] Email inviata a venditore: ${vendorName} (${vendorEmail})`);
      } catch (emailError) {
        console.error(`❌ [EMAIL] Errore invio email a ${vendorName}:`, emailError.message);
      }
    }

    console.log('\n🎉 [EMAIL] OPERAZIONE COMPLETATA!');

  } catch (error) {
    console.error('\n❌ [EMAIL] ERRORE:', error.message);
    console.error(error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 [EMAIL] Disconnesso da MongoDB');
  }
}

// Uso: node sendOrderEmails.js <order_id> [--prod]
const args = process.argv.slice(2);
const orderId = args[0];
const useProduction = args.includes('--prod') || args.includes('-p');

if (!orderId || orderId.startsWith('--')) {
  console.error('❌ Uso: node sendOrderEmails.js <order_id> [--prod]');
  console.log('\n💡 Examples:');
  console.log('   node sendOrderEmails.js 69babec16b1c88550245402a --prod');
  console.log('   node sendOrderEmails.js 507f1f77bcf86cd799439011');
  process.exit(1);
}

console.log('\n🚀 [EMAIL] ========== INVIO EMAIL ORDINE ==========');
console.log(`🌍 [EMAIL] Ambiente: ${useProduction ? 'PRODUZIONE' : 'SVILUPPO'}\n`);

sendEmailsForOrder(orderId, useProduction)
  .then(() => {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║           ✅ EMAIL INVIATE CON SUCCESSO!               ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n╔════════════════════════════════════════════════════════╗');
    console.error('║              ❌ OPERAZIONE FALLITA                     ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    console.error('\n💬 Errore:', error.message);
    process.exit(1);
  });
