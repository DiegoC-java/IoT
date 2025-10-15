const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '..', '.env') });

class PostgreSQLManager {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.connectionConfig = {
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
            ssl: false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };
        
        this.initializeConnection();
    }

    async initializeConnection() {
        try {
            console.log('🔄 Iniciando conexión a PostgreSQL...');
            console.log('📋 Configuración:', {
                host: this.connectionConfig.host,
                port: this.connectionConfig.port,
                database: this.connectionConfig.database,
                user: this.connectionConfig.user
            });

            this.pool = new Pool(this.connectionConfig);
            
            this.pool.on('connect', () => {
                console.log('✅ Nueva conexión establecida con PostgreSQL');
            });
            
            this.pool.on('error', (err) => {
                console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
                this.isConnected = false;
            });

            await this.testConnection();
            
        } catch (error) {
            console.error('❌ Error inicializando PostgreSQL:', error.message);
            console.log('💡 El sistema funcionará con datos simulados');
            // No lanzar error, permitir que el sistema funcione sin BD
        }
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query('SELECT NOW(), version()');
            const serverTime = result.rows[0].now;
            const version = result.rows[0].version;
            
            console.log('✅ Conexión a PostgreSQL establecida exitosamente');
            console.log(`⏰ Hora del servidor: ${serverTime}`);
            console.log(`📦 Versión: ${version.split(' ')[0]} ${version.split(' ')[1]}`);
            
            await this.verifyDatabase(client);
            
            client.release();
            this.isConnected = true;
            
            return true;
            
        } catch (error) {
            console.error('❌ Error en test de conexión:', error.message);
            console.log('💡 Continuando con datos simulados...');
            this.isConnected = false;
            return false;
        }
    }

    async verifyDatabase(client) {
        try {
            const tableCheck = await client.query(`
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'devices'
                ORDER BY ordinal_position
            `);
            
            if (tableCheck.rows.length > 0) {
                console.log('✅ Tabla "devices" encontrada');
                
                const columns = tableCheck.rows.map(row => 
                    `${row.column_name} (${row.data_type})`
                ).join(', ');
                console.log(`📋 Columnas: ${columns}`);
                
                const countResult = await client.query('SELECT COUNT(*) FROM devices');
                const deviceCount = countResult.rows[0].count;
                console.log(`📊 Dispositivos en la base de datos: ${deviceCount}`);
                
                if (parseInt(deviceCount) > 0) {
                    const sampleData = await client.query('SELECT id, name, status FROM devices LIMIT 3');
                    console.log('📝 Datos de ejemplo:');
                    sampleData.rows.forEach(device => {
                        console.log(`   - ${device.id}: ${device.name} (${device.status})`);
                    });
                }
                
            } else {
                console.log('⚠️  Tabla "devices" no encontrada');
                console.log('💡 Ejecuta: docker-compose down && docker-compose up -d');
            }
            
        } catch (error) {
            console.error('❌ Error verificando estructura de BD:', error.message);
        }
    }

    async query(text, params = []) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Base de datos no conectada');
        }
        
        try {
            const result = await this.pool.query(text, params);
            return result;
            
        } catch (error) {
            console.error('❌ Error ejecutando query:', error.message);
            throw error;
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

            const result = await this.query('SELECT 1 as health');
            return {
                status: 'healthy',
                connected: true,
                timestamp: new Date().toISOString(),
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

    async close() {
        if (this.pool) {
            console.log('🔒 Cerrando conexiones de PostgreSQL...');
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ Conexiones cerradas');
        }
    }
}

// Crear instancia singleton
const postgresManager = new PostgreSQLManager();

// Exportar tanto la instancia como la clase
module.exports = {
    postgresManager,
    PostgreSQLManager,
    pool: postgresManager.pool,
    testConnection: () => postgresManager.testConnection()
};