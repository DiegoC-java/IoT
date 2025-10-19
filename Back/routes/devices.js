const express = require('express');
const router = express.Router();

// Importar database con manejo de errores
let db = null;
try {
    db = require('../database');
    console.log('🔧 Módulo database cargado para devices');
} catch (error) {
    console.log('⚠️  Database no disponible para devices, usando datos simulados');
}

// Datos simulados como constante
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

// GET - Obtener todos los dispositivos
router.get('/devices', async (req, res) => {
    try {
        let devices = [];
        let dataSource = 'simulated';
        
        // Intentar obtener datos de la BD si está disponible
        if (db && db.isAvailable && db.pool) {
            try {
                const result = await db.pool.query(`
                    SELECT 
                        id, name, location, device_type, status, last_seen, firmware_version, ip_address, created_at, updated_at
                    FROM devices 
                    ORDER BY created_at DESC
                `);
                devices = result.rows;
                dataSource = 'database';
                console.log(`🔧 Dispositivos obtenidos de BD: ${devices.length}`);
            } catch (dbError) {
                console.log('⚠️  Error BD en devices:', dbError.message);
                return res.status(500).json({ success: false, message: 'Error al consultar la base de datos', error: dbError.message });
            }
        } else {
            return res.status(500).json({ success: false, message: 'Base de datos no disponible' });
        }
        
        res.json({
            success: true,
            count: devices.length,
            data: devices,
            message: `${devices.length} dispositivos encontrados`,
            dataSource: dataSource,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error obteniendo dispositivos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al obtener dispositivos',
            error: error.message
        });
    }
});

// GET - Obtener dispositivo por ID
router.get('/devices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let device = null;
        let dataSource = 'simulated';
        
        if (db && db.isAvailable && db.pool) {
            try {
                const result = await db.pool.query('SELECT * FROM devices WHERE id = $1', [id]);
                device = result.rows[0];
                dataSource = 'database';
            } catch (dbError) {
                console.log('⚠️  Error BD, buscando en datos simulados:', dbError.message);
                device = simulatedDevices.find(d => d.id === id);
                dataSource = 'simulated_fallback';
            }
        } else {
            device = simulatedDevices.find(d => d.id === id);
        }
        
        if (!device) {
            return res.status(404).json({ 
                success: false, 
                message: `Dispositivo con ID ${id} no encontrado` 
            });
        }
        
        res.json({
            success: true,
            data: device,
            message: `Dispositivo ${id} encontrado`,
            dataSource: dataSource,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error obteniendo dispositivo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al obtener dispositivo',
            error: error.message
        });
    }
});

// POST - Crear nuevo dispositivo (solo si BD disponible)
router.post('/devices', async (req, res) => {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible. No se pueden crear dispositivos.',
                dataSource: 'none'
            });
        }

        const { id, name, type, location, status = 'offline', value, unit, battery, signal } = req.body;
        
        if (!id || !name || !type || !location) {
            return res.status(400).json({
                success: false,
                message: 'Los campos id, name, type y location son obligatorios'
            });
        }
        
        const existingDevice = await db.pool.query('SELECT id FROM devices WHERE id = $1', [id]);
        if (existingDevice.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Ya existe un dispositivo con ID ${id}`
            });
        }
        
        const result = await db.pool.query(
            `INSERT INTO devices (id, name, type, location, status, value, unit, battery, signal, last_reading) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) 
             RETURNING *`,
            [id, name, type, location, status, value, unit, battery, signal]
        );
        
        res.status(201).json({
            success: true,
            message: 'Dispositivo creado exitosamente',
            data: result.rows[0],
            dataSource: 'database'
        });
    } catch (error) {
        console.error('Error creando dispositivo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al crear dispositivo',
            error: error.message
        });
    }
});

// PUT - Actualizar dispositivo (solo si BD disponible)
router.put('/devices/:id', async (req, res) => {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible. No se pueden actualizar dispositivos.',
                dataSource: 'none'
            });
        }

        const { id } = req.params;
        const { name, type, location, status, value, unit, battery, signal } = req.body;
        
        if (!name || !type || !location) {
            return res.status(400).json({
                success: false,
                message: 'Los campos name, type y location son obligatorios'
            });
        }
        
        const result = await db.pool.query(
            `UPDATE devices 
             SET name = $2, type = $3, location = $4, status = $5, value = $6, 
                 unit = $7, battery = $8, signal = $9, updated_at = CURRENT_TIMESTAMP,
                 last_reading = CASE WHEN $6 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE last_reading END
             WHERE id = $1 
             RETURNING *`,
            [id, name, type, location, status, value, unit, battery, signal]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `Dispositivo con ID ${id} no encontrado` 
            });
        }
        
        res.json({
            success: true,
            message: 'Dispositivo actualizado exitosamente',
            data: result.rows[0],
            dataSource: 'database'
        });
    } catch (error) {
        console.error('Error actualizando dispositivo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al actualizar dispositivo',
            error: error.message
        });
    }
});

// DELETE - Eliminar dispositivo (solo si BD disponible)
router.delete('/devices/:id', async (req, res) => {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible. No se pueden eliminar dispositivos.',
                dataSource: 'none'
            });
        }

        const { id } = req.params;
        
        const result = await db.pool.query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `Dispositivo con ID ${id} no encontrado` 
            });
        }
        
        res.json({
            success: true,
            message: 'Dispositivo eliminado exitosamente',
            data: result.rows[0],
            dataSource: 'database'
        });
    } catch (error) {
        console.error('Error eliminando dispositivo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor al eliminar dispositivo',
            error: error.message
        });
    }
});

// POST - Recibir evento de movimiento del ESP32
router.post('/devices/motion', async (req, res) => {
    try {
        console.log('📡 Evento recibido del ESP32:', req.body);
        
        const { device_id, event_type, sensor_type, timestamp, sensor_value, additional_data } = req.body;
        
        // Validaciones básicas
        if (!device_id || !event_type || !timestamp) {
            return res.status(400).json({
                success: false,
                message: 'device_id, event_type y timestamp son requeridos'
            });
        }
        
        if (!db || !db.isAvailable || !db.pool) {
            console.log('⚠️  Base de datos no disponible, evento no guardado');
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible. Evento recibido pero no guardado.',
                dataSource: 'none'
            });
        }
        
        const query = `
            INSERT INTO device_events (device_id, event_type, sensor_type, timestamp, sensor_value, additional_data)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await db.pool.query(query, [
            device_id, 
            event_type, 
            sensor_type || null,
            timestamp, 
            sensor_value || null,
            additional_data ? JSON.stringify(additional_data) : null
        ]);
        
        // Actualizar última vez visto del dispositivo
        await db.pool.query(
            `INSERT INTO devices (id, name, status, last_seen) 
             VALUES ($1, $2, 'online', CURRENT_TIMESTAMP)
             ON CONFLICT (id) 
             DO UPDATE SET status = 'online', last_seen = CURRENT_TIMESTAMP`,
            [device_id, device_id]
        );
        
        console.log(`✅ Evento guardado: ${event_type} (${sensor_type || 'N/A'}) del dispositivo ${device_id}`);
        
        res.status(201).json({
            success: true,
            message: 'Evento guardado exitosamente',
            event: result.rows[0],
            dataSource: 'database'
        });
    } catch (error) {
        console.error('❌ Error guardando evento:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al guardar evento',
            error: error.message
        });
    }
});

// GET - Obtener eventos de un dispositivo
router.get('/devices/:deviceId/events', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        if (!db || !db.isAvailable || !db.pool) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible.',
                dataSource: 'none'
            });
        }
        
        const query = `
            SELECT * FROM device_events 
            WHERE device_id = $1 
            ORDER BY timestamp DESC 
            LIMIT $2 OFFSET $3
        `;
        
        const result = await db.pool.query(query, [deviceId, limit, offset]);
        
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
            message: `${result.rows.length} eventos encontrados`,
            dataSource: 'database'
        });
    } catch (error) {
        console.error('Error obteniendo eventos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener eventos',
            error: error.message
        });
    }
});

module.exports = router;