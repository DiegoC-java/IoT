let postgresManager = null;
let pool = null;

try {
    const pgModule = require('../BaseDeDatos/postgresql');
    postgresManager = pgModule.postgresManager;
    pool = pgModule.pool;
    console.log('✅ Módulo PostgreSQL cargado correctamente');
} catch (error) {
    console.error('❌ Error cargando módulo PostgreSQL:', error.message);
    console.log('💡 El sistema funcionará sin base de datos');
}

// Re-exportar para compatibilidad con manejo de errores
module.exports = {
    pool: pool,
    testConnection: postgresManager ? postgresManager.testConnection.bind(postgresManager) : async () => false,
    query: postgresManager ? postgresManager.query.bind(postgresManager) : async () => { throw new Error('BD no disponible'); },
    getClient: postgresManager ? postgresManager.getClient?.bind(postgresManager) : async () => { throw new Error('BD no disponible'); },
    transaction: postgresManager ? postgresManager.transaction?.bind(postgresManager) : async () => { throw new Error('BD no disponible'); },
    healthCheck: postgresManager ? postgresManager.healthCheck.bind(postgresManager) : async () => ({ status: 'unavailable', connected: false, message: 'PostgreSQL no disponible' }),
    close: postgresManager ? postgresManager.close.bind(postgresManager) : async () => {},
    isAvailable: !!postgresManager
};