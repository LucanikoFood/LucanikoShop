import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Product from './models/Product.js';
import User from './models/User.js';

dotenv.config();

const isProd = process.argv.includes('--prod');
const orderId = process.argv[2];
const MONGODB_URI = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;

if (!orderId || orderId.startsWith('--')) {
  console.error('❌ Uso: node inspectOrderDetails.js <order_id> [--prod]');
  process.exit(1);
}

console.log(`🔧 Ambiente: ${isProd ? 'PRODUZIONE' : 'SVILUPPO'}`);

async function inspectOrder() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connesso al database\n');

    const order = await Order.findById(orderId)
      .populate('buyer', 'name email')
      .populate({
        path: 'items.product',
        populate: { path: 'seller', select: 'name email businessName' }
      })
      .lean();

    if (!order) {
      console.error(`❌ Ordine ${orderId} non trovato`);
      process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📦 DETTAGLI ORDINE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🆔 Order ID: ${order._id}`);
    console.log(`📋 Order Number: ${order.orderNumber || 'N/A'}`);
    console.log(`📅 Data: ${new Date(order.createdAt).toLocaleString('it-IT')}`);
    console.log(`💰 Totale: €${order.totalPrice.toFixed(2)}`);
    console.log(`📊 Status: ${order.status}`);
    console.log(`💳 Pagato: ${order.isPaid ? '✅ SI' : '❌ NO'}`);
    console.log(`📧 Email Inviate: ${order.emailsSent ? '✅ SI' : '❌ NO'}`);
    console.log(`🚚 Tipo Consegna: ${order.deliveryType || 'N/A'}`);
    
    console.log('\n👤 CLIENTE:');
    if (order.isGuestOrder) {
      console.log(`   Guest Email: ${order.guestEmail || 'N/A'}`);
      console.log(`   Guest Nome: ${order.guestName || 'N/A'}`);
    } else {
      console.log(`   Nome: ${order.buyer?.name || 'N/A'}`);
      console.log(`   Email: ${order.buyer?.email || 'N/A'}`);
    }

    console.log('\n📦 PRODOTTI:');
    order.items.forEach((item, index) => {
      console.log(`\n   ${index + 1}. ${item.name}`);
      console.log(`      Quantità: ${item.quantity}`);
      console.log(`      Prezzo: €${item.price.toFixed(2)}`);
      console.log(`      Totale: €${(item.price * item.quantity).toFixed(2)}`);
      
      if (item.selectedVariantSku) {
        console.log(`      Variante SKU: ${item.selectedVariantSku}`);
      }
      
      if (item.selectedVariantAttributes && item.selectedVariantAttributes.length > 0) {
        console.log(`      Varianti:`);
        item.selectedVariantAttributes.forEach(attr => {
          console.log(`        - ${attr.key}: ${attr.value}`);
        });
      }
      
      if (item.product?.seller) {
        console.log(`      Venditore: ${item.product.seller.businessName || item.product.seller.name}`);
        console.log(`      Email Venditore: ${item.product.seller.email}`);
      }
    });

    console.log('\n💰 PREZZI:');
    console.log(`   Subtotale Prodotti: €${order.itemsPrice.toFixed(2)}`);
    console.log(`   Spedizione: €${(order.shippingPrice || 0).toFixed(2)}`);
    console.log(`   TOTALE: €${order.totalPrice.toFixed(2)}`);

    if (order.billingAddress) {
      console.log('\n📋 INDIRIZZO FATTURAZIONE:');
      const b = order.billingAddress;
      console.log(`   ${b.firstName || ''} ${b.lastName || ''}`);
      if (b.ragioneSociale) console.log(`   Ragione Sociale: ${b.ragioneSociale}`);
      if (b.partitaIVA) console.log(`   P.IVA: ${b.partitaIVA}`);
      if (b.codiceFiscale) console.log(`   CF: ${b.codiceFiscale}`);
      console.log(`   ${b.street || ''}`);
      console.log(`   ${b.city || ''}, ${b.state || ''} ${b.zipCode || ''}`);
      console.log(`   ${b.country || 'Italia'}`);
      console.log(`   Email: ${b.email || 'N/A'}`);
      console.log(`   Tel: ${b.phone || 'N/A'}`);
    }

    if (order.shippingAddress && order.deliveryType !== 'pickup') {
      console.log('\n📮 INDIRIZZO SPEDIZIONE:');
      const s = order.shippingAddress;
      console.log(`   ${s.firstName || ''} ${s.lastName || ''}`);
      console.log(`   ${s.street || ''}`);
      console.log(`   ${s.city || ''}, ${s.state || ''} ${s.zipCode || ''}`);
      console.log(`   ${s.country || 'Italia'}`);
      if (s.phone) console.log(`   Tel: ${s.phone}`);
    }

    if (order.pickupAddress && order.deliveryType === 'pickup') {
      console.log('\n🏪 INDIRIZZO RITIRO:');
      const p = order.pickupAddress;
      console.log(`   ${p.businessName || ''}`);
      console.log(`   ${p.street || ''}`);
      console.log(`   ${p.city || ''}, ${p.state || ''} ${p.zipCode || ''}`);
      console.log(`   ${p.country || 'Italia'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    await mongoose.connection.close();
    console.log('\n✅ Disconnesso dal database');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error);
    process.exit(1);
  }
}

inspectOrder();
