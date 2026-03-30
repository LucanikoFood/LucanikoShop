/**
 * 🔥 SCRIPT DIAGNOSTICA PERFORMANCE PRODUZIONE
 * Esegui questo script per identificare colli di bottiglia critici
 * 
 * Uso: node scripts/production-diagnostics.js
 */

import mongoose from 'mongoose';
import { Product, Category, Experience, User } from '../models/index.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI;

// Colori per output console
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}🔍 ============================================${colors.reset}`);
console.log(`${colors.blue}   DIAGNOSTICA PERFORMANCE PRODUZIONE${colors.reset}`);
console.log(`${colors.blue}============================================${colors.reset}\n`);

async function connect() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`${colors.green}✅ Connesso a MongoDB${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Errore connessione MongoDB:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// 1. Verifica indici MongoDB
async function checkIndexes() {
  console.log(`${colors.blue}📊 1. VERIFICA INDICI MONGODB${colors.reset}`);
  console.log('─'.repeat(50));
  
  const collections = [
    { name: 'Products', model: Product },
    { name: 'Categories', model: Category },
    { name: 'Experiences', model: Experience },
    { name: 'Users', model: User }
  ];

  for (const { name, model } of collections) {
    try {
      const indexes = await model.collection.getIndexes();
      const indexCount = Object.keys(indexes).length;
      
      console.log(`${colors.green}✅ ${name}:${colors.reset} ${indexCount} indici`);
      
      // Mostra indici principali
      Object.entries(indexes).forEach(([indexName, indexDef]) => {
        if (indexName !== '_id_') {
          const keys = Object.keys(indexDef.key || {}).join(', ');
          console.log(`   └─ ${indexName}: [${keys}]`);
        }
      });
    } catch (error) {
      console.log(`${colors.red}❌ ${name}: Errore${colors.reset}`, error.message);
    }
  }
  console.log('');
}

// 2. Verifica query lente (slow queries)
async function checkSlowQueries() {
  console.log(`${colors.blue}🐌 2. ANALISI QUERY LENTE${colors.reset}`);
  console.log('─'.repeat(50));
  
  try {
    // Test query critiche con explain
    const queries = [
      {
        name: 'Prodotti in sconto (random)',
        test: async () => {
          const start = Date.now();
          await Product.aggregate([
            { $match: { hasActiveDiscount: true, isActive: true } },
            { $sample: { size: 12 } }
          ]).explain('executionStats');
          return Date.now() - start;
        }
      },
      {
        name: 'Prodotti in sconto (ordinati)',
        test: async () => {
          const start = Date.now();
          await Product.find({
            hasActiveDiscount: true,
            isActive: true
          })
          .sort({ discountPercentage: -1 })
          .limit(12)
          .explain('executionStats');
          return Date.now() - start;
        }
      },
      {
        name: 'Ricerca prodotti per nome (regex)',
        test: async () => {
          const start = Date.now();
          await Product.find({
            hasActiveDiscount: true,
            isActive: true,
            name: { $regex: 'pasta', $options: 'i' }
          })
          .limit(12)
          .explain('executionStats');
          return Date.now() - start;
        }
      },
      {
        name: 'Esperienze simili',
        test: async () => {
          const firstExp = await Experience.findOne({ status: 'active' }).lean();
          if (!firstExp) return 0;
          
          const start = Date.now();
          await Experience.find({
            _id: { $ne: firstExp._id },
            status: 'active',
            categories: { $in: firstExp.categories || [] }
          })
          .limit(6)
          .explain('executionStats');
          return Date.now() - start;
        }
      },
      {
        name: 'Categorie principali',
        test: async () => {
          const start = Date.now();
          await Category.find({ parentCategory: null })
            .sort({ name: 1 })
            .explain('executionStats');
          return Date.now() - start;
        }
      }
    ];

    for (const query of queries) {
      try {
        const time = await query.test();
        const status = time < 100 ? colors.green : time < 300 ? colors.yellow : colors.red;
        const icon = time < 100 ? '✅' : time < 300 ? '⚠️' : '❌';
        console.log(`${status}${icon} ${query.name}: ${time}ms${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}❌ ${query.name}: ERRORE${colors.reset}`, error.message);
      }
    }
  } catch (error) {
    console.error(`${colors.red}❌ Errore analisi query:${colors.reset}`, error.message);
  }
  console.log('');
}

// 3. Verifica dimensione collezioni
async function checkCollectionSizes() {
  console.log(`${colors.blue}💾 3. DIMENSIONE COLLEZIONI${colors.reset}`);
  console.log('─'.repeat(50));
  
  const collections = [
    { name: 'products', model: Product },
    { name: 'categories', model: Category },
    { name: 'experiences', model: Experience },
    { name: 'users', model: User }
  ];

  for (const { name, model } of collections) {
    try {
      const count = await model.countDocuments();
      const stats = await model.collection.stats();
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`${colors.green}✅ ${name}:${colors.reset} ${count} documenti (${sizeMB} MB)`);
    } catch (error) {
      console.log(`${colors.red}❌ ${name}: Errore${colors.reset}`, error.message);
    }
  }
  console.log('');
}

// 4. Verifica connessioni MongoDB
async function checkConnections() {
  console.log(`${colors.blue}🔌 4. STATO CONNESSIONI${colors.reset}`);
  console.log('─'.repeat(50));
  
  try {
    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();
    
    console.log(`${colors.green}✅ Connessioni correnti:${colors.reset} ${serverStatus.connections.current}`);
    console.log(`${colors.green}✅ Connessioni disponibili:${colors.reset} ${serverStatus.connections.available}`);
    console.log(`${colors.green}✅ Uptime:${colors.reset} ${Math.floor(serverStatus.uptime / 3600)} ore`);
    
    if (serverStatus.connections.current > serverStatus.connections.available * 0.8) {
      console.log(`${colors.red}⚠️  ATTENZIONE: Troppe connessioni attive!${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Errore verifica connessioni:${colors.reset}`, error.message);
  }
  console.log('');
}

// 5. Verifica prodotti con problemi
async function checkProblematicProducts() {
  console.log(`${colors.blue}🔍 5. PRODOTTI CON POTENZIALI PROBLEMI${colors.reset}`);
  console.log('─'.repeat(50));
  
  try {
    // Prodotti senza immagini
    const noImages = await Product.countDocuments({
      $or: [
        { images: { $exists: false } },
        { images: null },
        { images: [] }
      ]
    });
    console.log(`${noImages > 0 ? colors.yellow : colors.green}${noImages > 0 ? '⚠️' : '✅'} Prodotti senza immagini: ${noImages}${colors.reset}`);
    
    // Prodotti con molte immagini (>10)
    const tooManyImages = await Product.countDocuments({
      $expr: { $gt: [{ $size: { $ifNull: ['$images', []] } }, 10] }
    });
    console.log(`${tooManyImages > 0 ? colors.yellow : colors.green}${tooManyImages > 0 ? '⚠️' : '✅'} Prodotti con >10 immagini: ${tooManyImages}${colors.reset}`);
    
    // Prodotti con descrizioni molto lunghe (>5000 caratteri)
    const longDescriptions = await Product.countDocuments({
      $expr: { $gt: [{ $strLenCP: { $ifNull: ['$description', ''] } }, 5000] }
    });
    console.log(`${longDescriptions > 0 ? colors.yellow : colors.green}${longDescriptions > 0 ? '⚠️' : '✅'} Prodotti con descrizione >5000 caratteri: ${longDescriptions}${colors.reset}`);
    
    // Prodotti con varianti molto complesse (>20 varianti)
    const complexVariants = await Product.countDocuments({
      hasVariants: true,
      $expr: { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 20] }
    });
    console.log(`${complexVariants > 0 ? colors.yellow : colors.green}${complexVariants > 0 ? '⚠️' : '✅'} Prodotti con >20 varianti: ${complexVariants}${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Errore verifica prodotti:${colors.reset}`, error.message);
  }
  console.log('');
}

// 6. Raccomandazioni finali
function printRecommendations() {
  console.log(`${colors.blue}💡 6. RACCOMANDAZIONI IMMEDIATE${colors.reset}`);
  console.log('─'.repeat(50));
  
  const recommendations = [
    {
      priority: 'CRITICO',
      color: colors.red,
      text: '🔥 Attiva Redis su Upstash (gratuito) - Cache disabilitata causa 10x query'
    },
    {
      priority: 'ALTO',
      color: colors.yellow,
      text: '⚡ Verifica Railway: risorse CPU/RAM potrebbero essere al limite'
    },
    {
      priority: 'ALTO',
      color: colors.yellow,
      text: '🔍 Controlla log Railway per errori MongoDB connection pool'
    },
    {
      priority: 'MEDIO',
      color: colors.yellow,
      text: '📊 Monitora query lente > 300ms e ottimizza indici'
    },
    {
      priority: 'MEDIO',
      color: colors.yellow,
      text: '🖼️  Verifica immagini Cloudinary: dimensioni ottimali per delivery'
    }
  ];

  recommendations.forEach(rec => {
    console.log(`${rec.color}[${rec.priority}] ${rec.text}${colors.reset}`);
  });
  
  console.log('');
}

// Main execution
async function main() {
  await connect();
  await checkIndexes();
  await checkSlowQueries();
  await checkCollectionSizes();
  await checkConnections();
  await checkProblematicProducts();
  printRecommendations();
  
  console.log(`${colors.blue}============================================${colors.reset}`);
  console.log(`${colors.green}✅ Diagnostica completata${colors.reset}`);
  console.log(`${colors.blue}============================================${colors.reset}\n`);
  
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(error => {
  console.error(`${colors.red}❌ Errore fatale:${colors.reset}`, error);
  process.exit(1);
});
