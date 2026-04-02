import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

// Usa argomento da CLI per scegliere l'ambiente
const useProduction = process.argv.includes('--prod');

// Carica sempre .env per avere accesso sia a dev che prod
dotenv.config({ path: '.env' });

if (useProduction) {
  console.log('🚨 MODALITÀ PRODUZIONE - Connessione al database di produzione\n');
} else {
  console.log('🔧 MODALITÀ SVILUPPO - Connessione al database di sviluppo\n');
}

const PRODUCTION_URI = 'mongodb+srv://lucanikofood_db_user:m5Qvi9N2DsTHCgF3GZoY6zMuyr0SVEP4@lucanikoshop-production.vocyyy.mongodb.net/lucanikoshop?retryWrites=true&w=majority&appName=lucanikoshop-production';

const resetOlisinPassword = async () => {
  try {
    console.log('🔍 Connessione al database...\n');
    const mongoUri = useProduction ? PRODUCTION_URI : process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connesso al database\n');

    const userId = '69ba8f6fedbea53074e55127';
    const email = 'info@olisin.it';
    const newPassword = 'Ettore.2026';

    // Trova l'utente
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ Utente non trovato con ID:', userId);
      return;
    }

    console.log('📋 UTENTE TROVATO:');
    console.log('  ID:', user._id.toString());
    console.log('  Email:', user.email);
    console.log('  Nome:', user.name);
    console.log('  Role:', user.role);
    console.log();

    // IMPORTANTE: Non fare l'hash manualmente!
    // Il modello User ha un pre-save hook che fa automaticamente l'hash
    console.log(`🔐 Impostazione nuova password: "${newPassword}"`);
    console.log('ℹ️  Il modello User farà automaticamente l\'hash durante il save()');
    console.log();

    // Imposta la password in CHIARO - il pre-save hook la hasherà
    user.password = newPassword;
    await user.save();
    
    console.log('═══════════════════════════════════════════════');
    console.log('✅ PASSWORD AGGIORNATA CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════');
    console.log();
    console.log('📝 Dettagli:');
    console.log(`  Email: ${email}`);
    console.log(`  Nuova password: ${newPassword}`);
    console.log(`  Data aggiornamento: ${new Date().toISOString()}`);
    console.log();

    // Verifica finale - ricarica l'utente e testa il login
    console.log('🔍 VERIFICA FINALE...');
    const verifyUser = await User.findById(userId).select('+password');
    const finalTest = await bcrypt.compare(newPassword, verifyUser.password);
    
    if (finalTest) {
      console.log('✅ VERIFICA COMPLETATA: La password ora funziona correttamente!');
      console.log();
      console.log('👤 L\'utente può ora fare login con:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${newPassword}`);
    } else {
      console.log('❌ ERRORE VERIFICA: Qualcosa è andato storto!');
    }

  } catch (error) {
    console.error('💥 Errore:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Connessione database chiusa');
  }
};

resetOlisinPassword();
