const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const dbManager = require('./database');
const pool = dbManager.pool;

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// CORS 
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para login
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================================
// --- CONFIGURACIÓN Y CONEXIÓN MQTT ---
// ========================================================
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on('connect', () => {
    console.log('✅ Conectado al broker MQTT');
});

mqttClient.on('error', (error) => {
    console.error('❌ Error en la conexión MQTT:', error);
});

app.get('/api/health', async (req, res) => {
    try {

        const dbHealth = await dbManager.healthCheck();
        
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


const devicesRoutes = require('./routes/devices');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const benchmarkRoutes = require('./Benchmark/benchmarkRoutes');

app.use('/api', devicesRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', authRoutes);
app.use('/api', benchmarkRoutes);

// ========================================================
// --- RUTA PARA CONTROLAR LA ALARMA ---
// ========================================================
app.post('/api/alarm/set-state', (req, res) => {
    const { state } = req.body; 
    
    if (state !== 'active' && state !== 'inactive') {
        return res.status(400).json({ success: false, message: 'Estado inválido. Debe ser "active" o "inactive".' });
    }

    const topic = 'esp32/alarm/set'; 
    const message = state;

    // Publica el comando en el broker MQTT
    mqttClient.publish(topic, message, (err) => {
        if (err) {
            console.error(`❌ Error publicando mensaje MQTT en ${topic}:`, err);
            return res.status(500).json({ success: false, message: 'Error al enviar comando al ESP32.' });
        }
        console.log(`📤 Comando de alarma "${state}" enviado al ESP32 en el tema "${topic}"`);
        res.json({ success: true, message: `Comando '${state}' enviado al dispositivo.` });
    });
});

// Endpoint de métricas para benchmarks
let benchmarkMetrics = {
    activaciones: {
        PIR: 0,
        MPU6050: 0
    },
    notificaciones: {
        alarma: [], 
        email: []  
    },
    autenticacion: {
        mfa: [],  
        simple: []  
    },
    registro: {
        mfa: [], 
        simple: []  
    }
};

// Endpoint para obtener métricas
app.get('/api/benchmarks', (req, res) => {
    res.json({
        activaciones: {
            PIR: benchmarkMetrics.activaciones.PIR,
            MPU6050: benchmarkMetrics.activaciones.MPU6050
        },
        notificaciones: {
            alarma: benchmarkMetrics.notificaciones.alarma.length ? Math.round(benchmarkMetrics.notificaciones.alarma.reduce((a,b)=>a+b,0)/benchmarkMetrics.notificaciones.alarma.length) : 0,
            email: benchmarkMetrics.notificaciones.email.length ? Math.round(benchmarkMetrics.notificaciones.email.reduce((a,b)=>a+b,0)/benchmarkMetrics.notificaciones.email.length) : 0
        },
        autenticacion: {
            mfa: benchmarkMetrics.autenticacion.mfa.length ? Math.round(benchmarkMetrics.autenticacion.mfa.reduce((a,b)=>a+b,0)/benchmarkMetrics.autenticacion.mfa.length) : 0,
            simple: benchmarkMetrics.autenticacion.simple.length ? Math.round(benchmarkMetrics.autenticacion.simple.reduce((a,b)=>a+b,0)/benchmarkMetrics.autenticacion.simple.length) : 0
        },
        registro: {
            mfa: benchmarkMetrics.registro.mfa.length ? Math.round(benchmarkMetrics.registro.mfa.reduce((a,b)=>a+b,0)/benchmarkMetrics.registro.mfa.length) : 0,
            simple: benchmarkMetrics.registro.simple.length ? Math.round(benchmarkMetrics.registro.simple.reduce((a,b)=>a+b,0)/benchmarkMetrics.registro.simple.length) : 0
        }
    });
});


app.get('/api/events/latest', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM events ORDER BY timestamp DESC LIMIT 1'
        );
        
        if (result.rows.length > 0) {
            res.json({ 
                success: true, 
                data: result.rows[0] 
            });
        } else {
            res.json({ 
                success: true, 
                data: null,
                message: 'No hay eventos registrados'
            });
        }
    } catch (error) {
        console.error('Error obteniendo último evento:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});


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
    dbManager.testConnection().then(connected => {
        if (connected) {
            console.log('✅ Verificación de DB exitosa');
        } else {
            console.error('❌ Error en conexión inicial a la base de datos');
        }
    }).catch(error => {
        console.error('❌ Error verificando conexión:', error.message);
    });
});

// Manejar cierre del servidor
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await pool.end();
    console.log('✅ Conexiones de base de datos cerradas');
    process.exit(0);
});