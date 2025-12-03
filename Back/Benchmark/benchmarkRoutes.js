const express = require('express');
const router = express.Router();
const benchmarkService = require('./benchmarkService');



 // Obtiene todas las estadísticas de benchmarks

router.get('/benchmarks/stats', async (req, res) => {
    try {
        const stats = await benchmarkService.getBenchmarkStats();
        
        if (!stats) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible'
            });
        }

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas'
        });
    }
});


// Guarda métrica de login/registro
 
router.post('/benchmarks/auth', async (req, res) => {
    try {
        const { metric_type, mfa, time_ms, username } = req.body;

        if (!metric_type || typeof mfa !== 'boolean' || !time_ms || !username) {
            return res.status(400).json({
                success: false,
                message: 'Datos incompletos: metric_type, mfa, time_ms, username requeridos'
            });
        }

        const result = await benchmarkService.saveAuthBenchmark({
            metric_type,
            mfa,
            time_ms,
            username
        });

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Error guardando métrica'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Métrica guardada',
            data: result
        });
    } catch (error) {
        console.error('❌ Error en endpoint de auth benchmark:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
});


// Guarda métrica de envío de email

router.post('/benchmarks/email', async (req, res) => {
    try {
        const { email_type, time_ms } = req.body;

        if (!email_type || !time_ms) {
            return res.status(400).json({
                success: false,
                message: 'Datos incompletos: email_type, time_ms requeridos'
            });
        }

        const result = await benchmarkService.saveEmailBenchmark({
            email_type,
            time_ms
        });

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Error guardando métrica'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Métrica de email guardada',
            data: result
        });
    } catch (error) {
        console.error('❌ Error en endpoint de email benchmark:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
});


// Marca un evento como real o falso positivo

router.put('/benchmarks/event/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { is_false_positive } = req.body;

        if (typeof is_false_positive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'is_false_positive debe ser true o false'
            });
        }

        const result = await benchmarkService.markEventAsRealOrFalse(
            parseInt(eventId),
            is_false_positive
        );

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Error actualizando evento'
            });
        }

        res.json({
            success: true,
            message: `Evento marcado como ${is_false_positive ? 'falso positivo' : 'real'}`,
            data: result
        });
    } catch (error) {
        console.error('❌ Error en endpoint de evento:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno'
        });
    }
});

module.exports = router;
