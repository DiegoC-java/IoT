const express = require('express');
const router = express.Router();

// Health check
router.get('/health', async (req, res) => {
    const dbManager = require('../database');
    
    try {
        const dbHealth = await dbManager.healthCheck();
        
        res.json({
            status: dbHealth.connected ? 'OK' : 'ERROR',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbHealth,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Importar otras rutas
router.use('/', require('./auth'));
router.use('/', require('./devices'));
router.use('/', require('./dashboard'));

module.exports = router;