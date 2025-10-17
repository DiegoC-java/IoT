const express = require('express');
const cors = require('cors');
const { pool, testConnection, healthCheck } = require('./database');

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'file://', '*'],
    credentials: true
}));
app.use(express.json());

// Middleware para logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Ruta de prueba
app.get('/api/health', async (req, res) => {
    try {
        // Usar el health check mejorado
        const dbHealth = await healthCheck();
        
        res.json({ 
            status: 'OK', 
            message: 'Backend IoT funcionando correctamente',
            timestamp: new Date().toISOString(),
            database: dbHealth,
            environment: {
                nodeVersion: process.version,
                port: PORT,
                env: process.env.NODE_ENV || 'development'
            }
        });
    } catch (error) {
        console.error('Error en health check:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'Error de conexión a la base de datos',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Importar rutas DESPUÉS de configurar la base de datos
const devicesRoutes = require('./routes/devices');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// Usar rutas
app.use('/api', devicesRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', authRoutes);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta ${req.originalUrl} no encontrada`,
        availableRoutes: [
            'GET /api/health',
            'POST /api/auth/login',
            'GET /api/devices',
            'GET /api/devices/:id',
            'POST /api/devices',
            'PUT /api/devices/:id',
            'DELETE /api/devices/:id',
            'GET /api/dashboard'
        ]
    });
});

// Middleware para manejo de errores
app.use((error, req, res, next) => {
    console.error('Error no manejado:', error);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('\n🚀 ========================================');
    console.log(`   Backend IoT Server iniciado exitosamente`);
    console.log('🚀 ========================================');
    console.log(`📡 Servidor corriendo en: http://localhost:${PORT}`);
    console.log(`🔗 API endpoints disponibles en: http://localhost:${PORT}/api`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Dashboard data: http://localhost:${PORT}/api/dashboard`);
    console.log(`🔧 Dispositivos: http://localhost:${PORT}/api/devices`);
    console.log('========================================\n');
    
    // Verificar conexión a la base de datos
    testConnection().catch(error => {
        console.error('Error en conexión inicial:', error.message);
    });
});

// Manejar cierre graceful del servidor
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await pool.end();
    console.log('✅ Conexiones de base de datos cerradas');
    process.exit(0);
});