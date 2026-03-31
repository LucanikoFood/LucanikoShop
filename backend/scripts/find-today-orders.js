import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../models/Order.js';

// Script per trovare gli ordini di oggi
async function findTodayOrders(useProduction = false) {
  try {
    console.log('🔍 [FIND] Connessione MongoDB...');
    
    const mongoUri = useProduction 
      ? (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI)
      : (process.env.MONGODB_URI || process.env.MONGODB_URI_PROD);
    
    if (!mongoUri) {
      throw new Error('❌ MONGODB_URI non trovato nel file .env');
    }
    
    const dbName = useProduction ? 'PRODUZIONE' : 'SVILUPPO';
    console.log(`📦 [FIND] Database: ${dbName}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ [FIND] Connesso a MongoDB');

    // Data di inizio giornata (00:00:00)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    // Data di fine giornata (23:59:59)
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`\n🔍 [FIND] Ricerca ordini tra ${startOfDay.toISOString()} e ${endOfDay.toISOString()}`);

    // Cerca ordini di oggi
    const orders = await Order.find({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .sort({ createdAt: -1 }) // Ordina dal più recente
    .select('_id orderNumber createdAt totalPrice guestEmail emailsSent isPaid buyer')
    .populate('buyer', 'email name')
    .lean();

    if (orders.length === 0) {
      console.log('\n❌ Nessun ordine trovato oggi');
      return;
    }

    console.log(`\n✅ Trovati ${orders.length} ordine/i oggi:\n`);
    
    orders.forEach((order, index) => {
      const orderRef = order.orderNumber || order._id;
      const customerEmail = order.guestEmail || order.buyer?.email || 'N/A';
      const emailStatus = order.emailsSent ? '✅ Inviate' : '❌ NON inviate';
      const paymentStatus = order.isPaid ? '✅ Pagato' : '❌ Non pagato';
      
      console.log(`${index + 1}. Ordine: ${orderRef}`);
      console.log(`   ID: ${order._id}`);
      console.log(`   Data: ${new Date(order.createdAt).toLocaleString('it-IT')}`);
      console.log(`   Totale: €${order.totalPrice.toFixed(2)}`);
      console.log(`   Cliente: ${customerEmail}`);
      console.log(`   Email: ${emailStatus}`);
      console.log(`   Pagamento: ${paymentStatus}`);
      console.log('');
    });

    // Mostra l'ultimo ordine
    const lastOrder = orders[0];
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 ULTIMO ORDINE (più recente):');
    console.log(`   ID: ${lastOrder._id}`);
    console.log(`   Email inviate: ${lastOrder.emailsSent ? '✅ SI' : '❌ NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!lastOrder.emailsSent) {
      console.log('\n💡 Per inviare le email per questo ordine, esegui:');
      console.log(`   node backend/sendOrderEmails.js ${lastOrder._id} ${useProduction ? '--prod' : ''}`);
    }

  } catch (error) {
    console.error('\n❌ [FIND] ERRORE:', error.message);
    console.error(error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 [FIND] Disconnesso da MongoDB');
  }
}

// Uso: node scripts/find-today-orders.js [--prod]
const args = process.argv.slice(2);
const useProduction = args.includes('--prod') || args.includes('-p');

console.log('\n🚀 [FIND] ========== CERCA ORDINI DI OGGI ==========');
console.log(`🌍 [FIND] Ambiente: ${useProduction ? 'PRODUZIONE' : 'SVILUPPO'}\n`);

findTodayOrders(useProduction)
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Errore fatale:', err);
    process.exit(1);
  });
