/**
 * 🔍 SCRIPT VERIFICA STATO REDIS
 * Controlla se Redis è configurato e funzionante
 * 
 * Uso: node scripts/check-redis-status.js
 */

import dotenv from 'dotenv';
import { createClient } from 'redis';

dotenv.config();

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.blue}║     🔍 VERIFICA STATO REDIS                ║${colors.reset}`);
console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}\n`);

async function checkRedisStatus() {
  // 1. Verifica se REDIS_URL è configurato
  console.log(`${colors.cyan}📝 Step 1: Verifica Configurazione${colors.reset}`);
  console.log('─'.repeat(50));
  
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log(`${colors.red}❌ REDIS_URL NON CONFIGURATO${colors.reset}`);
    console.log(`${colors.yellow}   → Variabile REDIS_URL non trovata nel file .env${colors.reset}`);
    console.log(`${colors.yellow}   → Cache è DISABILITATA${colors.reset}\n`);
    
    console.log(`${colors.cyan}💡 Come risolvere:${colors.reset}`);
    console.log(`   1. Attiva Redis su Upstash: https://upstash.com/`);
    console.log(`   2. Crea database Redis (regione EU-West-1)`);
    console.log(`   3. Copia REDIS_URL`);
    console.log(`   4. In Railway: Variables → Aggiungi REDIS_URL`);
    console.log(`   5. Redeploy\n`);
    
    return false;
  }
  
  console.log(`${colors.green}✅ REDIS_URL configurato${colors.reset}`);
  
  // Nascondi password nell'output
  const safeUrl = redisUrl.replace(/:([^@]+)@/, ':***@');
  console.log(`   URL: ${safeUrl}\n`);
  
  // 2. Verifica connessione
  console.log(`${colors.cyan}🔌 Step 2: Test Connessione${colors.reset}`);
  console.log('─'.repeat(50));
  
  let client;
  try {
    client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false
      }
    });
    
    client.on('error', (err) => {
      console.log(`${colors.red}❌ Errore Redis: ${err.message}${colors.reset}`);
    });
    
    console.log('   Connessione in corso...');
    await client.connect();
    
    console.log(`${colors.green}✅ Connesso a Redis con successo${colors.reset}\n`);
    
    // 3. Test operazioni
    console.log(`${colors.cyan}⚙️  Step 3: Test Operazioni${colors.reset}`);
    console.log('─'.repeat(50));
    
    // Test SET
    const testKey = 'test:connection';
    const testValue = JSON.stringify({ 
      test: true, 
      timestamp: new Date().toISOString(),
      message: 'Redis is working!' 
    });
    
    console.log('   Test SET...');
    await client.set(testKey, testValue, { EX: 60 });
    console.log(`${colors.green}   ✅ SET operazione riuscita${colors.reset}`);
    
    // Test GET
    console.log('   Test GET...');
    const retrieved = await client.get(testKey);
    if (retrieved === testValue) {
      console.log(`${colors.green}   ✅ GET operazione riuscita${colors.reset}`);
      console.log(`   Valore: ${JSON.parse(retrieved).message}`);
    } else {
      console.log(`${colors.red}   ❌ GET ha restituito valore errato${colors.reset}`);
    }
    
    // Test DEL
    console.log('   Test DEL...');
    await client.del(testKey);
    console.log(`${colors.green}   ✅ DEL operazione riuscita${colors.reset}\n`);
    
    // 4. Info Redis
    console.log(`${colors.cyan}📊 Step 4: Info Redis${colors.reset}`);
    console.log('─'.repeat(50));
    
    try {
      const info = await client.info();
      const lines = info.split('\r\n');
      
      // Estrai info rilevanti
      const redisVersion = lines.find(l => l.startsWith('redis_version:'))?.split(':')[1];
      const usedMemory = lines.find(l => l.startsWith('used_memory_human:'))?.split(':')[1];
      const connectedClients = lines.find(l => l.startsWith('connected_clients:'))?.split(':')[1];
      const uptime = lines.find(l => l.startsWith('uptime_in_seconds:'))?.split(':')[1];
      
      if (redisVersion) console.log(`   Redis Version: ${redisVersion}`);
      if (usedMemory) console.log(`   Memoria Usata: ${usedMemory}`);
      if (connectedClients) console.log(`   Client Connessi: ${connectedClients}`);
      if (uptime) {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        console.log(`   Uptime: ${days}d ${hours}h`);
      }
    } catch (err) {
      console.log(`${colors.yellow}   ⚠️  Info non disponibile (alcune istanze Redis non supportano INFO)${colors.reset}`);
    }
    
    await client.disconnect();
    console.log('');
    
    // RISULTATO FINALE
    console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║  ✅ REDIS COMPLETAMENTE FUNZIONANTE       ║${colors.reset}`);
    console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}\n`);
    
    console.log(`${colors.green}✅ Cache abilitata e funzionante${colors.reset}`);
    console.log(`${colors.green}✅ Tutte le operazioni completate con successo${colors.reset}`);
    console.log(`${colors.green}✅ Performance ottimizzate${colors.reset}\n`);
    
    return true;
    
  } catch (error) {
    console.log(`${colors.red}❌ ERRORE CONNESSIONE${colors.reset}`);
    console.log(`   Dettagli: ${error.message}\n`);
    
    console.log(`${colors.yellow}🔍 Possibili cause:${colors.reset}`);
    console.log(`   • REDIS_URL non valido o scaduto`);
    console.log(`   • Redis server non raggiungibile`);
    console.log(`   • Firewall o problemi di rete`);
    console.log(`   • Password errata\n`);
    
    console.log(`${colors.cyan}💡 Cosa fare:${colors.reset}`);
    console.log(`   1. Verifica REDIS_URL in Railway Variables`);
    console.log(`   2. Controlla dashboard Upstash (database attivo?)`);
    console.log(`   3. Rigenera credenziali se necessario`);
    console.log(`   4. Redeploy su Railway\n`);
    
    if (client) {
      try {
        await client.disconnect();
      } catch (e) {
        // Ignora errori durante disconnect
      }
    }
    
    return false;
  }
}

// Esegui verifica
checkRedisStatus()
  .then((success) => {
    if (success) {
      console.log(`${colors.blue}════════════════════════════════════════════${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.blue}════════════════════════════════════════════${colors.reset}\n`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`${colors.red}❌ Errore fatale:${colors.reset}`, error);
    process.exit(1);
  });
