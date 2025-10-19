const express = require('express');
const router = express.Router();

const { pool } = require('../database');
console.log('routes/devices loaded — pool available:', !!pool);

const simulatedDevices = [
    {
        id: 'DEV-001',
        name: 'Sensor Temperatura Exterior',
        type: 'Sensor Temperatura',
        location: 'Jardín',
        status: 'online',
        value: 24.3,
        unit: '°C',
        battery: 85,
        signal: 'excelente',
        last_reading: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        id: 'DEV-002',
        name: 'Sensor Humedad Invernadero',
        type: 'Sensor Humedad',
        location: 'Invernadero',
        status: 'online',
        value: 68.5,
        unit: '%',
        battery: 92,
        signal: 'buena',
        last_reading: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        id: 'DEV-003',
        name: 'Cámara Seguridad Principal',
        type: 'Cámara',
        location: 'Entrada',
        status: 'warning',
        value: null,
        unit: null,
        battery: 15,
        signal: 'regular',
        last_reading: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    }
];

// Helper para mapear fila DB a objeto esperado por frontend
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

// GET - Obtener todos los dispositivos
router.get('/devices', async (req, res) => {
    try {
        console.log('GET /api/devices — pool available:', !!pool);
        let devices = [];

        if (pool) {
            try {
                const result = await pool.query('SELECT * FROM devices');
                console.log('DB query returned', result.rows.length, 'rows');
                devices = result.rows.map(mapRowToDevice);
            } catch (dbErr) {
                console.error('DB query error, using simulatedDevices:', dbErr.message);
                devices = simulatedDevices;
            }
        } else {
            console.warn('No DB pool — using simulatedDevices');
            devices = simulatedDevices;
        }

        res.json({
            success: true,
            data: devices,
            count: devices.length,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Unhandled error in /devices:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET - Obtener dispositivo por ID
router.get('/devices/:id', async (req, res) => {
    const id = req.params.id;
    try {
        console.log(`GET /api/devices/${id} — pool available:`, !!pool);

        if (pool) {
            try {
                const result = await pool.query('SELECT * FROM devices WHERE id = $1 LIMIT 1', [id]);
                if (result.rows.length === 0) {
                    const sim = simulatedDevices.find(d => d.id === id);
                    if (sim) return res.json({ success: true, data: sim });
                    return res.status(404).json({ success: false, message: 'Device not found' });
                }
                return res.json({ success: true, data: mapRowToDevice(result.rows[0]) });
            } catch (dbErr) {
                console.error('DB query error for /devices/:id, using simulated fallback:', dbErr.message);
                const sim = simulatedDevices.find(d => d.id === id);
                if (sim) return res.json({ success: true, data: sim });
                return res.status(500).json({ success: false, message: dbErr.message });
            }
        } else {
            const sim = simulatedDevices.find(d => d.id === id);
            if (sim) return res.json({ success: true, data: sim });
            return res.status(404).json({ success: false, message: 'Device not found (no DB)' });
        }
    } catch (err) {
        console.error('Unhandled error in /devices/:id:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST - Recibir eventos de sensores
router.post('/events', async (req, res) => {
    try {
        console.log('📥 Evento recibido:', req.body);
        const { device_id, event_type, sensor_type, sensor_value, timestamp } = req.body;

        // Insertar evento
        const result = await pool.query(
            'INSERT INTO device_events (device_id, event_type, sensor_type, sensor_value, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [device_id, event_type, sensor_type, sensor_value, timestamp]
        );

        // Actualizar estado del dispositivo
        await pool.query(
            'UPDATE devices SET status = $1, last_seen = $2 WHERE id = $3',
            ['online', new Date(), device_id]
        );

        res.json({
            success: true,
            message: 'Evento registrado',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error guardando evento:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;