const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: '../.env' });

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isAvailable = false;
    this.initPromise = null;
    this.initialize();
  }

  initialize() {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'iot_dashboard',
      user: process.env.DB_USER || 'iot_user',
      password: process.env.DB_PASSWORD || 'iot_password123',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    console.log('🔧 Configuración DB:', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password ? '***' + config.password.slice(-3) : 'NO DEFINIDA'
    });

    this.pool = new Pool(config);
    this.initPromise = this.testInitialConnection();
  }

  async testInitialConnection() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW() as time, version()');
      client.release();
      
      this.isAvailable = true;
      console.log('✅ Conexión a PostgreSQL OK (Back/database.js)');
      return true;
    } catch (err) {
      this.isAvailable = false;
      console.error('❌ Falló conexión a PostgreSQL (Back/database.js):', err.message);
      console.log('💡 Verifica que DB_PORT sea 5433 en tu .env');
      return false;
    }
  }

  async waitForConnection() {
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.isAvailable;
  }

  async query(text, params) {
    if (!this.pool) {
      throw new Error('Pool de base de datos no inicializado');
    }
    return this.pool.query(text, params);
  }

  async testConnection() {
    if (!this.pool) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (err) {
      return false;
    }
  }


  async healthCheck() {
    try {
      if (!this.pool) {
        return {
          status: 'unhealthy',
          connected: false,
          message: 'Pool de conexiones no inicializado'
        };
      }

      const result = await this.pool.query('SELECT NOW() as server_time, version()');
      
      return {
        status: 'healthy',
        connected: true,
        timestamp: new Date().toISOString(),
        serverTime: result.rows[0].server_time,
        version: result.rows[0].version.split(' ')[1],
        message: 'PostgreSQL respondiendo correctamente'
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        timestamp: new Date().toISOString(),
        message: error.message
      };
    }
  }

  async getDevices() {
    if (!this.isAvailable || !this.pool) {
      return [];
    }
    try {
      const result = await this.pool.query('SELECT * FROM devices ORDER BY last_seen DESC');
      return result.rows;
    } catch (err) {
      console.error('Error obteniendo dispositivos:', err.message);
      return [];
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔒 Pool de conexiones cerrado');
    }
  }
}


const dbManager = new DatabaseManager();


module.exports = dbManager;
module.exports.pool = dbManager.pool;
module.exports.isAvailable = () => dbManager.isAvailable;