import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';

dotenv.config();

const isProd = process.argv.includes('--prod');
const orderId = process.argv[2];
const MONGODB_URI = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;

if (!orderId || orderId.startsWith('--')) {
  console.error('❌ Uso: node checkOrderNotes.js <order_id> [--prod]');
  process.exit(1);
}

console.log(`🔧 Ambiente: ${isProd ? 'PRODUZIONE' : 'SVILUPPO'}`);

async function checkOrderNotes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connesso al database\n');

    // Recupera TUTTI i campi dell'ordine come oggetto puro
    const order = await Order.findById(orderId).lean();

    if (!order) {
      console.error(`❌ Ordine ${orderId} non trovato`);
      process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA CAMPI NOTE NELL\'ORDINE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Controlla tutti i possibili campi per note
    const notesFields = {
      'customerNotes': order.customerNotes,
      'notes': order.notes,
      'orderNotes': order.orderNotes,
      'additionalNotes': order.additionalNotes,
      'specialInstructions': order.specialInstructions,
      'comment': order.comment,
      'comments': order.comments,
      'pickupAddress.notes': order.pickupAddress?.notes,
      'deliveryNotes': order.deliveryNotes,
      'buyerNotes': order.buyerNotes,
    };

    console.log('📝 CAMPI NOTE TROVATI:\n');
    
    let foundNotes = false;
    for (const [field, value] of Object.entries(notesFields)) {
      if (value !== undefined && value !== null && value !== '') {
        console.log(`✅ ${field}:`);
        console.log(`   "${value}"\n`);
        foundNotes = true;
      }
    }

    if (!foundNotes) {
      console.log('❌ Nessun campo note trovato nell\'ordine\n');
    }

    // Mostra TUTTI i campi top-level dell'ordine (per debug)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 TUTTI I CAMPI TOP-LEVEL DELL\'ORDINE:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const allFields = Object.keys(order).sort();
    console.log(allFields.join(', '));
    console.log('\n');

    // Mostra i campi dell'ordine in JSON (sample)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🗂️ STRUTTURA COMPLETA ORDINE (JSON):');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(order, null, 2));

    await mongoose.connection.close();
    console.log('\n✅ Disconnesso dal database');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkOrderNotes();
