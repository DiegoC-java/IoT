const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'iot_dashboard',
  user: process.env.DB_USER || 'iot_user',
  password: process.env.DB_PASSWORD || 'iot_password123'
});

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL OK');
    return true;
  } catch (err) {
    console.error('❌ Falló conexión a PostgreSQL:', err.message);
    throw err;
  }
}

module.exports = {
  pool,
  testConnection
};