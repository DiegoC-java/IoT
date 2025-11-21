const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const cors = require('cors');
const mqtt = require('mqtt');
const dbManager = require('./database');
const pool = dbManager.pool;

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

// Configurar CORS antes de las rutas
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middleware para parsear JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================================
// --- NUEVO: CONFIGURACIÓN Y CONEXIÓN MQTT ---
// ========================================================
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

// Estado global de la alarma (por defecto: armada)
let currentAlarmState = 'active';

mqttClient.on('connect', () => {
    console.log('✅ Conectado al broker MQTT');
    // Suscribirse a estados vía MQTT (opcional si ESP32 publica LWT/heartbeat)
    try {
        mqttClient.subscribe('esp32/+/status', (err) => {
            if (err) {
                console.error('❌ Error suscribiendo a esp32/+/status:', err.message);
            } else {
                console.log('📡 Suscrito a tópicos de estado: esp32/+/status');
            }
        });
        mqttClient.subscribe('esp32/+/heartbeat', (err) => {
            if (err) {
                console.error('❌ Error suscribiendo a esp32/+/heartbeat:', err.message);
            } else {
                console.log('📡 Suscrito a tópicos de heartbeat: esp32/+/heartbeat');
            }
        });
    } catch (e) {
        console.error('❌ Error al suscribirse a tópicos MQTT:', e.message);
    }
});

mqttClient.on('error', (error) => {
    console.error('❌ Error en la conexión MQTT:', error);
});

// Actualizar estado de dispositivos desde mensajes MQTT 'esp32/{deviceId}/status'
mqttClient.on('message', async (topic, payload) => {
    try {
        // Status topic
        let m = topic.match(/^esp32\/([^/]+)\/status$/);
        if (m) {
            const deviceId = m[1];
            const statusMsg = payload.toString().trim().toLowerCase(); // 'online' | 'offline'
            if (statusMsg !== 'online' && statusMsg !== 'offline') return;

            const lastSeenValue = statusMsg === 'online' ? new Date() : null;
            const upsertSql = `
                INSERT INTO devices (id, name, device_type, status, last_seen, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    last_seen = COALESCE(EXCLUDED.last_seen, devices.last_seen),
                    updated_at = NOW();
            `;
            await pool.query(upsertSql, [deviceId, deviceId, 'esp32', statusMsg, lastSeenValue]);
            console.log(`🔄 Estado MQTT actualizado: ${deviceId} -> ${statusMsg}`);
            return;
        }

        // Heartbeat topic
        m = topic.match(/^esp32\/([^/]+)\/heartbeat$/);
        if (m) {
            const deviceId = m[1];
            const upsertSql = `
                INSERT INTO devices (id, name, device_type, status, last_seen, created_at, updated_at)
                VALUES ($1, $2, $3, 'online', NOW(), NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    status = 'online',
                    last_seen = NOW(),
                    updated_at = NOW();
            `;
            await pool.query(upsertSql, [deviceId, deviceId, 'esp32']);
            console.log(`💓 Heartbeat MQTT recibido: ${deviceId}`);
        }
    } catch (e) {
        console.error('❌ Error procesando mensaje MQTT de estado:', e.message);
    }
});

// ========================================================
// --- MARCADOR AUTOMÁTICO OFFLINE POR INACTIVIDAD ---
// ========================================================
const OFFLINE_THRESHOLD_SECONDS = parseInt(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS || '120', 10); // 2 min por defecto
const STATUS_SWEEP_SECONDS = parseInt(process.env.DEVICE_STATUS_SWEEP_SECONDS || '30', 10); // cada 30s

async function runOfflineSweep() {
    const sql = `
        UPDATE devices
        SET status = 'offline', updated_at = NOW()
        WHERE status IS DISTINCT FROM 'offline'
          AND (last_seen IS NULL OR last_seen < NOW() - ($1 || ' seconds')::interval);
    `;
    try {
        const result = await pool.query(sql, [OFFLINE_THRESHOLD_SECONDS]);
        if (result.rowCount > 0) {
            console.log(`⏱️  Marcados offline por inactividad: ${result.rowCount}`);
        }
    } catch (e) {
        console.error('❌ Error en sweep de estados:', e.message);
    }
}

setInterval(runOfflineSweep, STATUS_SWEEP_SECONDS * 1000);
// Ruta de prueba
app.get('/api/health', async (req, res) => {
    try {
        // Usar el health check mejorado
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

// Importar rutas DESPUÉS de configurar la base de datos
const devicesRoutes = require('./routes/devices');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const benchmarkRoutes = require('./Benchmark/benchmarkRoutes');

// Usar rutas
app.use('/api', devicesRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', authRoutes);
app.use('/api', benchmarkRoutes);

// ========================================================
// --- NUEVA RUTA PARA CONTROLAR LA ALARMA ---
// ========================================================
app.post('/api/alarm/set-state', (req, res) => {
    const { state } = req.body; // El frontend enviará 'active' o 'inactive'
    
    if (state !== 'active' && state !== 'inactive') {
        return res.status(400).json({ success: false, message: 'Estado inválido. Debe ser "active" o "inactive".' });
    }

    const topic = 'esp32/alarm/set'; // El "canal" al que el ESP32 escuchará
    const message = state;

    // Actualizar estado global
    currentAlarmState = state;

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

// Endpoint para obtener el estado actual de la alarma
app.get('/api/alarm/get-state', (req, res) => {
    res.json({ 
        success: true, 
        state: currentAlarmState,
        timestamp: new Date().toISOString()
    });
});

// Endpoint de métricas para benchmarks
let benchmarkMetrics = {
    activaciones: {
        PIR: 0,
        MPU6050: 0
    },
    notificaciones: {
        alarma: [], // array de ms
        email: []   // array de ms
    },
    autenticacion: {
        mfa: [],    // array de ms
        simple: []  // array de ms
    },
    registro: {
        mfa: [],    // array de ms
        simple: []  // array de ms
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

// Después de las rutas existentes y antes de la ruta de alarma
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

// Manejar cierre graceful del servidor
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando servidor...');
    await pool.end();
    console.log('✅ Conexiones de base de datos cerradas');
    process.exit(0);
});