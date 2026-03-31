import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';

dotenv.config();

const isProd = process.argv.includes('--prod');
const MONGODB_URI = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;

console.log(`🔧 Ambiente: ${isProd ? 'PRODUZIONE' : 'SVILUPPO'}`);

async function checkRecentOrders() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connesso al database\n');

    // Trova gli ultimi 5 ordini
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('buyer', 'name email')
      .lean();

    console.log(`📦 Ultimi ${orders.length} ordini:\n`);

    orders.forEach((order, index) => {
      const orderRef = order.orderNumber || order._id;
      const customerEmail = order.guestEmail || order.buyer?.email || 'N/A';
      const emailStatus = order.emailsSent ? '✅ Inviate' : '❌ NON inviate';
      const paymentStatus = order.isPaid ? '✅ Pagato' : '❌ Non pagato';
      
      console.log(`═══════════════════════════════════════`);
      console.log(`${index + 1}. Ordine: ${orderRef}`);
      console.log(`   ID: ${order._id}`);
      console.log(`   Data: ${new Date(order.createdAt).toLocaleString('it-IT')}`);
      console.log(`   Totale: €${order.totalPrice.toFixed(2)}`);
      console.log(`   Cliente: ${customerEmail}`);
      console.log(`   Email: ${emailStatus}`);
      console.log(`   Pagamento: ${paymentStatus}`);
      console.log(`   Status: ${order.status}`);
    });

    console.log('\n═══════════════════════════════════════');
    console.log('🎯 ULTIMO ORDINE (più recente):');
    const lastOrder = orders[0];
    console.log(`   ID: ${lastOrder._id}`);
    console.log(`   Email inviate: ${lastOrder.emailsSent ? '✅ SI' : '❌ NO'}`);
    console.log('═══════════════════════════════════════');
    
    if (!lastOrder.emailsSent) {
      console.log('\n💡 Per inviare le email per questo ordine, esegui:');
      console.log(`   cd backend && node sendOrderEmails.js ${lastOrder._id} ${isProd ? '--prod' : ''}`);
    } else {
      console.log('\n✅ Le email per l\'ultimo ordine sono già state inviate');
    }

    await mongoose.connection.close();
    console.log('\n✅ Disconnesso dal database');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkRecentOrders();
