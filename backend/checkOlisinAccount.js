import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

// Usa argomento da CLI per scegliere l'ambiente
const useProduction = process.argv.includes('--prod');

if (useProduction) {
  // Connessione diretta al database di produzione
  dotenv.config({ path: '.env' });
  console.log('🚨 MODALITÀ PRODUZIONE - Connessione al database di produzione\n');
} else {
  dotenv.config({ path: '.env.local' });
  console.log('🔧 MODALITÀ SVILUPPO - Connessione al database di sviluppo\n');
}

const PRODUCTION_URI = 'mongodb+srv://lucanikofood_db_user:m5Qvi9N2DsTHCgF3GZoY6zMuyr0SVEP4@lucanikoshop-production.vocyyy.mongodb.net/lucanikoshop?retryWrites=true&w=majority&appName=lucanikoshop-production';

const checkOlisinAccount = async () => {
  try {
    console.log('🔍 Connessione al database...\n');
    const mongoUri = useProduction ? PRODUCTION_URI : process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connesso al database\n');

    const userId = '69ba8f6fedbea53074e55127';
    const email = 'info@olisin.it';
    const expectedPassword = 'Ettore.2026';

    // Trova l'utente
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      console.log('❌ Utente non trovato con ID:', userId);
      return;
    }

    console.log('📋 DATI UTENTE:');
    console.log('  ID:', user._id.toString());
    console.log('  Email:', user.email);
    console.log('  Nome:', user.name);
    console.log('  Role:', user.role);
    console.log('  isApproved:', user.isApproved);
    console.log('  createdAt:', user.createdAt);
    console.log('  updatedAt:', user.updatedAt);
    console.log('  Ha password salvata:', !!user.password);
    
    if (user.password) {
      console.log('  Hash password (primi 60 caratteri):', user.password.substring(0, 60));
      console.log('  Lunghezza hash:', user.password.length);
    }
    
    console.log('\n🔐 TEST PASSWORD:');
    
    // Test con la password che dovrebbe funzionare
    console.log(`\nTesto password attesa: "${expectedPassword}"`);
    
    if (user.password) {
      // Test diretto con bcrypt.compare
      const isMatch = await bcrypt.compare(expectedPassword, user.password);
      console.log(`  bcrypt.compare("${expectedPassword}", hash): ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // Test con il metodo del modello
      const isMatchMethod = await user.matchPassword(expectedPassword);
      console.log(`  user.matchPassword("${expectedPassword}"): ${isMatchMethod ? '✅ MATCH' : '❌ NO MATCH'}`);
      
      // Test con alcune varianti comuni (spazi, maiuscole/minuscole)
      const variants = [
        'ettore.2026',
        'ETTORE.2026',
        ' Ettore.2026',
        'Ettore.2026 ',
        'Ettore2026',
        'ettore2026'
      ];
      
      console.log('\n🧪 Test varianti password:');
      for (const variant of variants) {
        const match = await bcrypt.compare(variant, user.password);
        if (match) {
          console.log(`  ✅ MATCH trovato con: "${variant}"`);
        }
      }
      
      // Verifica se l'hash è valido
      console.log('\n🔬 ANALISI HASH:');
      console.log('  Hash completo:', user.password);
      console.log('  Inizia con $2a$ o $2b$:', user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
      
      // Prova a generare un nuovo hash e confronta
      console.log('\n🔄 GENERAZIONE NUOVO HASH:');
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(expectedPassword, salt);
      console.log('  Nuovo hash generato:', newHash);
      const newHashMatch = await bcrypt.compare(expectedPassword, newHash);
      console.log(`  Test nuovo hash: ${newHashMatch ? '✅ FUNZIONA' : '❌ NON FUNZIONA'}`);
      
    } else {
      console.log('  ⚠️ Nessuna password salvata nel database!');
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('DIAGNOSI:');
    console.log('═══════════════════════════════════════════════\n');
    
    if (!user.password) {
      console.log('❌ PROBLEMA: Password non presente nel database');
      console.log('   SOLUZIONE: Reset password necessario\n');
    } else {
      const isMatch = await bcrypt.compare(expectedPassword, user.password);
      if (!isMatch) {
        console.log('❌ PROBLEMA: La password "Ettore.2026" NON corrisponde all\'hash salvato');
        console.log('   POSSIBILI CAUSE:');
        console.log('   1. La password nel database è stata cambiata/corrotta');
        console.log('   2. La password salvata è diversa da quella comunicata');
        console.log('   3. Problema con l\'encoding della password');
        console.log('   SOLUZIONE: Reset password necessario\n');
      } else {
        console.log('✅ La password "Ettore.2026" è corretta!');
        console.log('   PROBLEMA ALTROVE: Verificare il flusso di login o altri middleware\n');
      }
    }

  } catch (error) {
    console.error('💥 Errore:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connessione database chiusa');
  }
};

checkOlisinAccount();
