const { Pool } = require('pg');
require('dotenv').config();

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isAvailable = false;
    this.init();
  }

  async init() {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'iot_dashboard',
        user: process.env.DB_USER || 'iot_user',
        password: process.env.DB_PASSWORD || 'iot_password123'
      });
      await this.pool.query('SELECT 1');
      this.isAvailable = true;
      console.log('✅ Conexión a PostgreSQL OK (Back/database.js)');
    } catch (err) {
      this.isAvailable = false;
      this.pool = null;
      console.error('❌ Falló conexión a PostgreSQL (Back/database.js):', err.message);
    }
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
}

const dbManager = new DatabaseManager();

module.exports = dbManager;