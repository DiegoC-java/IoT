const express = require('express');
const router = express.Router();

// Importar el servicio de correo
const { sendAlertEmail } = require('../services/emailService');
const benchmarkService = require('../Benchmark/benchmarkService');

const { pool } = require('../database');
console.log('routes/devices loaded — pool available:', !!pool);

// POST - Registrar latencia del dashboard
router.post('/events/record-latency', async (req, res) => {
    try {
        const { event_id, latency_ms } = req.body;
        
        if (!event_id || typeof latency_ms !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'event_id y latency_ms son requeridos' 
            });
        }

        await pool.query(
            'INSERT INTO dashboard_latency_metrics (event_id, latency_ms) VALUES ($1, $2)',
            [event_id, latency_ms]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error registrando latencia:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Histograma de activaciones de alarma por hora
router.get('/events/histograma-horas', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'Base de datos no disponible' });

        // Consulta: cuenta activaciones de alarma por hora (0-23)
        const result = await pool.query(`
            SELECT
                EXTRACT(HOUR FROM timestamp) AS hora,
                COUNT(*) AS activaciones
            FROM device_events
            WHERE event_type = 'alarma_activada'
            GROUP BY hora
            ORDER BY hora
        `);

        // Inicializar array de 24 horas en 0
        const histograma = Array(24).fill(0);
        result.rows.forEach(row => {
            const h = parseInt(row.hora);
            histograma[h] = parseInt(row.activaciones);
        });

        res.json({ success: true, data: histograma, message: 'Histograma de activaciones por hora' });
    } catch (error) {
        console.error('Error obteniendo histograma:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// (Tus datos simulados y funciones de mapeo se mantienen igual)
const simulatedDevices = [
    {
        id: 'DEV-001', name: 'Sensor Temperatura Exterior', type: 'Sensor Temperatura',
        location: 'Jardín', status: 'online', value: 24.3, unit: '°C',
        battery: 85, signal: 'excelente', last_reading: new Date(),
        created_at: new Date(), updated_at: new Date()
    },
];

function buildSimulatedEvents() {
    const now = Date.now();
    return [
        {
            id: 'SIM-001',
            device_id: 'DEV-001',
            event_type: 'motion_detected',
            sensor_type: 'pir',
            sensor_value: 1,
            timestamp: new Date(now - 2 * 60 * 1000).toISOString()
        },
        {
            id: 'SIM-002',
            device_id: 'DEV-002',
            event_type: 'vibration_detected',
            sensor_type: 'mpu6050',
            sensor_value: 0.87,
            timestamp: new Date(now - 7 * 60 * 1000).toISOString()
        },
        {
            id: 'SIM-003',
            device_id: 'DEV-001',
            event_type: 'alarma_activada',
            sensor_type: 'pir',
            sensor_value: 1,
            timestamp: new Date(now - 15 * 60 * 1000).toISOString()
        }
    ];
}

function mapRowToDevice(row) {
    const lastReadingRaw = row.last_event_time || row.last_seen || row.updated_at || null;
    const lastReadingIso = lastReadingRaw ? new Date(lastReadingRaw).toISOString() : null;
    const lastValue = (row.last_event_value !== null && row.last_event_value !== undefined)
        ? row.last_event_value
        : (row.value ?? null);

    return {
        id: row.id,
        name: row.name || row.device_name || 'Sin nombre',
        type: row.type || row.device_type || 'Desconocido',
        location: row.location || row.ubicacion || 'N/A',
        status: (row.status || 'offline').toLowerCase(),
        battery: typeof row.battery === 'number' ? row.battery : (row.bateria || null),
        value: lastValue,
        lastValue,
        unit: row.unit || null,
        last_reading: lastReadingIso,
        lastReading: lastReadingIso,
        lastEventType: row.last_event_type || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
    };
}

// (Tus rutas GET /devices y GET /devices/:id se mantienen igual)
router.get('/devices', async (req, res) => {
    try {
        // Query params to filter results from frontend or clients:
        // - device_id: return only that device
        // - onlineOnly=true: return only devices with status 'online'
        // - recentMinutes=N: return devices with last_reading/last_seen within the last N minutes
        const { device_id, onlineOnly, recentMinutes } = req.query;

        if (!pool) {
            console.warn('No DB pool — using simulatedDevices');
            let fallback = simulatedDevices;
            if (device_id) fallback = fallback.filter(d => d.id === device_id);
            if (onlineOnly === 'true') fallback = fallback.filter(d => (d.status || '').toLowerCase() === 'online');
            return res.json({ success: true, data: fallback, count: fallback.length });
        }

        // Build dynamic SQL with safe parameter bindings
        let baseQuery = `
            SELECT d.*,
                   last_event.timestamp AS last_event_time,
                   last_event.sensor_value AS last_event_value,
                   last_event.event_type AS last_event_type
            FROM devices d
            LEFT JOIN LATERAL (
                SELECT timestamp, sensor_value, event_type
                FROM device_events de
                WHERE de.device_id = d.id
                ORDER BY timestamp DESC
                LIMIT 1
            ) last_event ON TRUE
        `;
        const conditions = [];
        const params = [];

        if (device_id) {
            params.push(device_id);
            conditions.push(`d.id = $${params.length}`);
        }

        if (onlineOnly === 'true') {
            conditions.push(`LOWER(d.status) = 'online'`);
        }

        if (recentMinutes) {
            // convert to integer minutes and compute timestamp in JS to avoid SQL interval parsing issues
            const mins = parseInt(recentMinutes, 10) || 5;
            const since = new Date(Date.now() - mins * 60 * 1000).toISOString();
            params.push(since);
            conditions.push(`COALESCE(last_event.timestamp, d.last_seen) IS NOT NULL AND COALESCE(last_event.timestamp, d.last_seen) >= $${params.length}`);
        }

        const where = conditions.length ? (' WHERE ' + conditions.join(' AND ')) : '';
        const finalQuery = `${baseQuery}${where} ORDER BY COALESCE(last_event.timestamp, d.last_seen, d.created_at) DESC`;

        const result = await pool.query(finalQuery, params);
        const devices = result.rows.map(mapRowToDevice);
        devices.forEach((device, index) => {
            device.displayId = index + 1;
        });
        res.json({ success: true, data: devices, count: devices.length, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Unhandled error in /devices:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/devices/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (!pool) {
            const sim = simulatedDevices.find(d => d.id === id);
            if (sim) return res.json({ success: true, data: sim });
            return res.status(404).json({ success: false, message: 'Device not found (no DB)' });
        }
        const result = await pool.query(`
            SELECT d.*,
                   last_event.timestamp AS last_event_time,
                   last_event.sensor_value AS last_event_value,
                   last_event.event_type AS last_event_type
            FROM devices d
            LEFT JOIN LATERAL (
                SELECT timestamp, sensor_value, event_type
                FROM device_events de
                WHERE de.device_id = d.id
                ORDER BY timestamp DESC
                LIMIT 1
            ) last_event ON TRUE
            WHERE d.id = $1
            LIMIT 1
        `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        return res.json({ success: true, data: mapRowToDevice(result.rows[0]) });
    } catch (err) {
        console.error('Unhandled error in /devices/:id:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});



// Refactor: Validar datos del evento
function validateEventData(body) {
    const requiredFields = ['device_id', 'event_type', 'sensor_type', 'sensor_value', 'timestamp'];
    for (const field of requiredFields) {
        if (!body[field]) {
            return `Falta el campo requerido: ${field}`;
        }
    }
    return null;
}

// Refactor: Manejo de errores
function handleError(res, error, message = 'Error interno') {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
}

// POST - Recibir eventos de sensores (refactorizado)
router.post('/events', async (req, res) => {
    try {
        console.log('📥 Evento recibido:', req.body);
        const validationError = validateEventData(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }
        const { device_id, event_type, sensor_type, sensor_value, timestamp } = req.body;

        // --- UPSERT device: crear o actualizar fila en `devices` para que el dashboard
        // --- tenga información del dispositivo en tiempo real (last_seen, status, ip)
        try {
            const deviceId = device_id;
            const deviceName = req.body.device_name || device_id;
            const deviceType = (sensor_type || 'unknown').toLowerCase();
            // Preferir timestamp enviado por el dispositivo, si viene en formato ISO; si no, usar NOW()
            const lastSeen = timestamp ? timestamp : new Date().toISOString();
            // Obtener IP del remitente (si está detrás de proxy, X-Forwarded-For debería ir en headers)
            const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().replace('::ffff:', '');

            const upsertSql = `
                INSERT INTO devices (id, name, device_type, status, last_seen, ip_address, created_at, updated_at)
                VALUES ($1, $2, $3, 'online', $4, $5, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    last_seen = EXCLUDED.last_seen,
                    status = EXCLUDED.status,
                    ip_address = EXCLUDED.ip_address,
                    updated_at = NOW();
            `;

            await pool.query(upsertSql, [deviceId, deviceName, deviceType, lastSeen, ipAddress]);
        } catch (upsertErr) {
            // No queremos cancelar la inserción del evento si el upsert falla, solo loguearlo
            console.error('❌ Error al upsertear device en /events:', upsertErr.message);
        }

        // Insertar evento en la base de datos con server_received_at para medir latencia
        const serverReceivedAt = new Date().toISOString();
        const eventResult = await pool.query(
            'INSERT INTO device_events (device_id, event_type, sensor_type, sensor_value, timestamp, server_received_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [device_id, event_type, sensor_type, sensor_value, timestamp, serverReceivedAt]
        );

        // Notificación por correo
        const recipientEmail = process.env.ALERT_EMAIL_RECIPIENT;
        if (recipientEmail) {
            console.log(`📬 Preparando notificación para la dirección fija: ${recipientEmail}...`);
            sendAlertEmail(recipientEmail, eventResult.rows[0]);
        } else {
            console.warn(`⚠️ La variable ALERT_EMAIL_RECIPIENT no está definida en el archivo .env. No se enviará correo.`);
        }

        // Responder al ESP32
        res.status(201).json({
            success: true,
            message: 'Evento registrado y notificación en proceso',
            data: eventResult.rows[0]
        });

    } catch (error) {
        handleError(res, error, 'Error guardando evento:');
    }
});

// GET - Historial de eventos recientes
router.get('/events/history', async (req, res) => {
    try {
        const limitParam = parseInt(req.query.limit, 10);
        const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 100);

        if (!pool) {
            const fallback = buildSimulatedEvents().slice(0, limit);
            return res.json({ success: true, data: fallback, count: fallback.length, source: 'simulated' });
        }

        const result = await pool.query(`
            SELECT id, device_id, event_type, sensor_type, sensor_value, timestamp
            FROM device_events
            ORDER BY timestamp DESC
            LIMIT $1
        `, [limit]);

        res.json({ success: true, data: result.rows, count: result.rowCount, limit });
    } catch (error) {
        console.error('Error obteniendo historial de eventos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// GET - Obtener el último evento para el dashboard (Sin cambios)
router.get('/events/latest', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'Base de datos no disponible' });

        const result = await pool.query('SELECT * FROM device_events ORDER BY id DESC LIMIT 1');

        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'No hay eventos recientes', data: null });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error obteniendo el último evento:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET - Contar eventos recientes (hoy completo o últimas X horas)
router.get('/events/count', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'Base de datos no disponible' });

        const parseDate = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const startDate = parseDate(req.query.start);
        const endDate = parseDate(req.query.end);
        const countToday = String(req.query.today).toLowerCase() === 'true';
        let query = '';
        let params = [];

        if (startDate && endDate) {
            if (endDate <= startDate) {
                return res.status(400).json({ success: false, message: 'El parámetro "end" debe ser mayor que "start"' });
            }
            query = 'SELECT COUNT(*) as count FROM device_events WHERE timestamp >= $1 AND timestamp <= $2';
            params = [startDate, endDate];
        } else if (countToday) {
            query = `SELECT COUNT(*) as count
                     FROM device_events
                     WHERE timestamp >= date_trunc('day', NOW())
                     AND timestamp < date_trunc('day', NOW()) + INTERVAL '1 day'`;
        } else {
            const hours = parseInt(req.query.hours, 10);
            const safeHours = Number.isNaN(hours) ? 24 : Math.max(1, hours);
            query = 'SELECT COUNT(*) as count FROM device_events WHERE timestamp >= NOW() - INTERVAL \'1 hour\' * $1';
            params = [safeHours];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, count: parseInt(result.rows[0].count) || 0 });
    } catch (error) {
        console.error('Error contando eventos:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
 
// ========================================================
// Heartbeat HTTP: mantener dispositivos "online"
// ========================================================
router.post('/devices/heartbeat', async (req, res) => {
    try {
        const { device_id, device_name, device_type } = req.body || {};
        if (!device_id) {
            return res.status(400).json({ success: false, message: 'Falta device_id' });
        }

        const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().replace('::ffff:', '');
        const upsertSql = `
            INSERT INTO devices (id, name, device_type, status, last_seen, ip_address, created_at, updated_at)
            VALUES ($1, $2, $3, 'online', NOW(), $4, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                status = 'online',
                last_seen = NOW(),
                ip_address = EXCLUDED.ip_address,
                updated_at = NOW();
        `;

        await pool.query(upsertSql, [
            device_id,
            device_name || device_id,
            (device_type || 'esp32').toLowerCase(),
            ipAddress
        ]);

        res.json({ success: true, message: 'Heartbeat recibido', device_id });
    } catch (err) {
        console.error('Error en /devices/heartbeat:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

