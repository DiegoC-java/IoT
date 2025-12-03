const db = require('../database');


async function saveAuthBenchmark(metricData) {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            console.warn('⚠️ BD no disponible para guardar benchmark');
            return null;
        }

        const { metric_type, mfa, time_ms, username } = metricData;

        const result = await db.pool.query(
            `INSERT INTO benchmark_metrics (metric_type, mfa, time_ms, username, created_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING *`,
            [metric_type, mfa, time_ms, username]
        );

        console.log(`📊 Benchmark guardado: ${metric_type} (${mfa ? 'MFA' : 'sin MFA'}): ${time_ms}ms`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error guardando benchmark de auth:', error);
        return null;
    }
}


async function saveEmailBenchmark(metricData) {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            console.warn('⚠️ BD no disponible para guardar benchmark de email');
            return null;
        }

        const { email_type, time_ms } = metricData;

        const result = await db.pool.query(
            `INSERT INTO email_metrics (email_type, time_ms, created_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             RETURNING *`,
            [email_type, time_ms]
        );

        console.log(`📧 Benchmark email guardado: ${email_type}: ${time_ms}ms`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error guardando benchmark de email:', error);
        return null;
    }
}


async function markEventAsRealOrFalse(eventId, isFalsePositive) {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            console.warn('⚠️ BD no disponible para actualizar evento');
            return null;
        }

        const result = await db.pool.query(
            `UPDATE device_events 
             SET is_false_positive = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [isFalsePositive, eventId]
        );

        console.log(`✅ Evento ${eventId} marcado como ${isFalsePositive ? 'falso positivo' : 'real'}`);
        return result.rows[0];
    } catch (error) {
        console.error('❌ Error actualizando evento:', error);
        return null;
    }
}


// Obtiene estadísticas de benchmarks

async function getBenchmarkStats() {
    try {
        if (!db || !db.isAvailable || !db.pool) {
            return null;
        }

        // Login/Registro sin MFA
        const loginWithoutMFA = await db.pool.query(
            `SELECT AVG(time_ms) as avg_time, COUNT(*) as total
             FROM benchmark_metrics
             WHERE metric_type = 'login' AND mfa = false`
        );

        // Login/Registro con MFA
        const loginWithMFA = await db.pool.query(
            `SELECT AVG(time_ms) as avg_time, COUNT(*) as total
             FROM benchmark_metrics
             WHERE metric_type = 'login' AND mfa = true`
        );

        // Email metrics
        const emailMetrics = await db.pool.query(
            `SELECT AVG(time_ms) as avg_time, COUNT(*) as total
             FROM email_metrics`
        );

        // Falsos positivos por sensor
        const falsePositivesPIR = await db.pool.query(
            `SELECT COUNT(*) as false_count
             FROM device_events
             WHERE sensor_type = 'PIR' AND is_false_positive = true`
        );

        const totalPIR = await db.pool.query(
            `SELECT COUNT(*) as total
             FROM device_events
             WHERE sensor_type = 'PIR'`
        );

        const falsePositivesMPU = await db.pool.query(
            `SELECT COUNT(*) as false_count
             FROM device_events
             WHERE sensor_type = 'MPU6050' AND is_false_positive = true`
        );

        const totalMPU = await db.pool.query(
            `SELECT COUNT(*) as total
             FROM device_events
             WHERE sensor_type = 'MPU6050'`
        );

        return {
            login: {
                withoutMFA: {
                    avg_time: Math.round(loginWithoutMFA.rows[0].avg_time || 0),
                    total: loginWithoutMFA.rows[0].total || 0
                },
                withMFA: {
                    avg_time: Math.round(loginWithMFA.rows[0].avg_time || 0),
                    total: loginWithMFA.rows[0].total || 0
                }
            },
            email: {
                avg_time: Math.round(emailMetrics.rows[0].avg_time || 0),
                total: emailMetrics.rows[0].total || 0
            },
            falsePositives: {
                PIR: {
                    false_count: falsePositivesPIR.rows[0].false_count || 0,
                    total: totalPIR.rows[0].total || 0,
                    percentage: totalPIR.rows[0].total > 0 
                        ? ((falsePositivesPIR.rows[0].false_count / totalPIR.rows[0].total) * 100).toFixed(2)
                        : 0
                },
                MPU6050: {
                    false_count: falsePositivesMPU.rows[0].false_count || 0,
                    total: totalMPU.rows[0].total || 0,
                    percentage: totalMPU.rows[0].total > 0
                        ? ((falsePositivesMPU.rows[0].false_count / totalMPU.rows[0].total) * 100).toFixed(2)
                        : 0
                }
            }
        };
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return null;
    }
}

module.exports = {
    saveAuthBenchmark,
    saveEmailBenchmark,
    markEventAsRealOrFalse,
    getBenchmarkStats
};
