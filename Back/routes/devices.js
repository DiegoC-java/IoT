const express = require('express');
const router = express.Router();

// Importar el servicio de correo
const { sendAlertEmail } = require('../services/emailService');

const { pool } = require('../database');
console.log('routes/devices loaded — pool available:', !!pool);

// (Tus datos simulados y funciones de mapeo se mantienen igual)
const simulatedDevices = [
    {
        id: 'DEV-001', name: 'Sensor Temperatura Exterior', type: 'Sensor Temperatura',
        location: 'Jardín', status: 'online', value: 24.3, unit: '°C',
        battery: 85, signal: 'excelente', last_reading: new Date(),
        created_at: new Date(), updated_at: new Date()
    },
];

function mapRowToDevice(row) {
    return {
        id: row.id,
        name: row.name || row.device_name || 'Sin nombre',
        type: row.type || row.device_type || 'Desconocido',
        location: row.location || row.ubicacion || 'N/A',
        status: (row.status || 'offline').toLowerCase(),
        battery: typeof row.battery === 'number' ? row.battery : (row.bateria || null),
        value: row.value ?? null,
        unit: row.unit || null,
        last_reading: row.last_reading || row.updated_at || new Date(),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
    };
}

// (Tus rutas GET /devices y GET /devices/:id se mantienen igual)
router.get('/devices', async (req, res) => {
    try {
        if (!pool) {
            console.warn('No DB pool — using simulatedDevices');
            return res.json({ success: true, data: simulatedDevices, count: simulatedDevices.length });
        }
        const result = await pool.query('SELECT * FROM devices');
        const devices = result.rows.map(mapRowToDevice);
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
        const result = await pool.query('SELECT * FROM devices WHERE id = $1 LIMIT 1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        return res.json({ success: true, data: mapRowToDevice(result.rows[0]) });
    } catch (err) {
        console.error('Unhandled error in /devices/:id:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// POST - Recibir eventos de sensores (VERSIÓN SIMPLIFICADA PARA PRUEBAS)
router.post('/events', async (req, res) => {
    try {
        console.log('📥 Evento recibido:', req.body);
        const { device_id, event_type, sensor_type, sensor_value, timestamp } = req.body;

        // 1. Insertar evento en la base de datos
        const eventResult = await pool.query(
            'INSERT INTO device_events (device_id, event_type, sensor_type, sensor_value, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [device_id, event_type, sensor_type, sensor_value, timestamp]
        );

        // --- LÓGICA DE NOTIFICACIÓN SIMPLIFICADA ---
        // 2. Obtener el correo de destino directamente desde el archivo .env
        const recipientEmail = process.env.ALERT_EMAIL_RECIPIENT;

        if (recipientEmail) {
            console.log(`📬 Preparando notificación para la dirección fija: ${recipientEmail}...`);
            // 3. Enviar correo de alerta (no bloqueante)
            sendAlertEmail(recipientEmail, eventResult.rows[0]);
        } else {
            console.warn(`⚠️ La variable ALERT_EMAIL_RECIPIENT no está definida en el archivo .env. No se enviará correo.`);
        }

        // 4. Responder al ESP32
        res.status(201).json({
            success: true,
            message: 'Evento registrado y notificación en proceso',
            data: eventResult.rows[0]
        });

    } catch (error) {
        console.error('Error guardando evento:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});


// GET - Obtener el último evento para el dashboard (Sin cambios)
router.get('/events/latest', async (req, res) => {
    try {
        if (!pool) return res.status(503).json({ success: false, message: 'Base de datos no disponible' });

        const result = await pool.query('SELECT * FROM device_events ORDER BY timestamp DESC LIMIT 1');

        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'No hay eventos recientes', data: null });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error obteniendo el último evento:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;

