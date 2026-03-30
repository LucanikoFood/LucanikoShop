import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️ REDIS_URL non configurato - Cache disabilitata');
    return null;
  }

  try {
    // Configurazione per Upstash (supporta TLS con rediss://)
    const redisConfig = {
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: troppi tentativi di riconnessione');
            return new Error('Redis max retries reached');
          }
          return retries * 500; // Retry dopo 500ms, 1s, 1.5s, etc.
        }
      }
    };

    // Se URL usa rediss:// (TLS), aggiungi configurazione TLS per Upstash
    if (process.env.REDIS_URL?.startsWith('rediss://')) {
      redisConfig.socket.tls = true;
      redisConfig.socket.rejectUnauthorized = false; // Necessario per Upstash
    }

    redisClient = createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔄 Redis: Connessione in corso...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Connesso e pronto!');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Riconnessione...');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error('❌ Errore connessione Redis:', error);
    redisClient = null;
    return null;
  }
};

// Funzione helper per ottenere il client
const getRedisClient = () => redisClient;

// Funzione helper per verificare se Redis è disponibile
const isRedisAvailable = () => redisClient && redisClient.isReady;

export { connectRedis, getRedisClient, isRedisAvailable };
