const express = require('express');
const router = express.Router();

// Importar database con manejo de errores
let db = null;
try {
    db = require('../database');
    console.log('📊 Módulo database cargado para dashboard');
} catch (error) {
    console.log('⚠️  Database no disponible para dashboard, usando datos simulados');
}

// Datos simulados
const generateSimulatedData = () => {
    return [
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
};

// GET - Datos completos del dashboard
router.get('/dashboard', async (req, res) => {
    try {
        let devices = [];
        let dataSource = 'simulated';
        
        // Intentar obtener datos de la BD si está disponible
        if (db && db.isAvailable && db.pool) {
            try {
                const devicesResult = await db.pool.query(`
                    SELECT 
                        id, name, type, location, status, last_reading, 
                        value, unit, battery, signal, created_at, updated_at
                    FROM devices 
                    ORDER BY created_at DESC
                `);
                devices = devicesResult.rows;
                dataSource = 'database';
                console.log(`📊 Datos obtenidos de BD: ${devices.length} dispositivos`);
            } catch (dbError) {
                console.log('⚠️  Error BD, usando datos simulados:', dbError.message);
                devices = generateSimulatedData();
                dataSource = 'simulated_fallback';
            }
        } else {
            console.log('📊 Usando datos simulados (BD no disponible)');
            devices = generateSimulatedData();
        }
        
        // Procesar datos (resto del código existente)
        const totalDevices = devices.length;
        const activeDevices = devices.filter(d => d.status === 'online').length;
        const warningDevices = devices.filter(d => d.status === 'warning').length;
        const offlineDevices = devices.filter(d => d.status === 'offline').length;
        
        const temperatureDevices = devices.filter(d => d.unit === '°C' && d.value !== null);
        const avgTemperature = temperatureDevices.length > 0 
            ? temperatureDevices.reduce((sum, d) => sum + parseFloat(d.value), 0) / temperatureDevices.length 
            : 23.5;
            
        const humidityDevices = devices.filter(d => d.unit === '%' && d.type.toLowerCase().includes('humedad') && d.value !== null);
        const avgHumidity = humidityDevices.length > 0 
            ? humidityDevices.reduce((sum, d) => sum + parseFloat(d.value), 0) / humidityDevices.length 
            : 65.0;
        
        // Generar historial de temperatura
        const generateTemperatureHistory = () => {
            const history = [];
            const now = new Date();
            const baseTemp = avgTemperature;
            
            for (let i = 23; i >= 0; i--) {
                const time = new Date(now.getTime() - i * 60 * 60 * 1000);
                const variation = Math.sin(i * 0.5) * 3 + (Math.random() - 0.5) * 2;
                const temperature = baseTemp + variation;
                const humidity = 65 + Math.sin(i * 0.3) * 10 + (Math.random() - 0.5) * 5;
                
                history.push({
                    time: time.toISOString(),
                    hour: time.getHours(),
                    temperature: Math.round(temperature * 10) / 10,
                    humidity: Math.round(humidity * 10) / 10
                });
            }
            return history;
        };
        
        const dashboardData = {
            kpis: {
                temperature: {
                    current: Math.round(avgTemperature * 10) / 10,
                    unit: '°C',
                    trend: 'positive',
                    change: 1.2
                },
                humidity: {
                    current: Math.round(avgHumidity * 10) / 10,
                    unit: '%',
                    trend: 'positive',
                    change: -2.1
                },
                activeDevices: {
                    current: activeDevices,
                    total: totalDevices,
                    trend: 'positive',
                    change: 0
                },
                alerts: {
                    current: warningDevices + offlineDevices,
                    critical: offlineDevices,
                    warning: warningDevices,
                    trend: warningDevices + offlineDevices === 0 ? 'positive' : 'neutral'
                }
            },
            devices: devices.map(device => ({
                id: device.id,
                name: device.name,
                type: device.type,
                location: device.location,
                status: device.status,
                lastReading: device.last_reading ? new Date(device.last_reading).toLocaleString('es-ES') : 'Nunca',
                value: device.value || 0,
                unit: device.unit || '',
                battery: device.battery,
                signal: device.signal || 'desconocido'
            })),
            temperatureHistory: generateTemperatureHistory(),
            settings: {
                refresh_interval: 30,
                temperature_unit: 'celsius',
                timezone: 'Europe/Madrid'
            }
        };
        
        res.json({
            success: true,
            data: dashboardData,
            timestamp: new Date().toISOString(),
            message: `Dashboard cargado con ${totalDevices} dispositivos`,
            dataSource: dataSource
        });
        
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error del servidor',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;