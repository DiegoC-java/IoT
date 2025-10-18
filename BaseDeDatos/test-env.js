// Script de prueba desde BaseDeDatos
const dotenv = require('dotenv');
const path = require('path');

// Cargar igual que postgresql.js
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

console.log('🔍 Verificando desde BaseDeDatos:');
console.log('Ruta .env:', path.join(__dirname, '..', '..', '.env'));
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
