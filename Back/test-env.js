
require('dotenv').config();

console.log('🔍 Verificando variables de entorno:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'undefined');
console.log('DB_PASSWORD hex:', process.env.DB_PASSWORD ? Buffer.from(process.env.DB_PASSWORD).toString('hex') : 'undefined');
