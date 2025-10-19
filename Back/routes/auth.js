const nodemailer = require('nodemailer');

// Almacén temporal de códigos MFA (demo, en memoria)
const mfaCodes = {};

// Configuración de nodemailer (puedes ajustar según tu proveedor)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Cambia si usas otro proveedor
    auth: {
        user: process.env.PGADMIN_EMAIL || 'admin@iot.local',
        pass: process.env.PGADMIN_PASSWORD || 'admin123'
    }
});
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Importar database con manejo de errores
let db = null;
try {
    db = require('../database');
    console.log('🔐 Módulo database cargado para auth');
} catch (error) {
    console.log('⚠️  Database no disponible para auth, usando usuarios locales');
}



// POST - Login
router.post('/auth/login', async (req, res) => {
    const start = Date.now();
    try {
        const { username, password } = req.body;
        console.log('🔐 Intento de login recibido:', username);
        
        
        // Validaciones básicas
        if (!username || !password) {
            console.log('❌ Credenciales faltantes');
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username || 'N/A'}: ${duration} ms`);
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
            });
        }
        
        if (username.length < 3) {
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username}: ${duration} ms`);
            return res.status(400).json({
                success: false,
                message: 'El usuario debe tener al menos 3 caracteres'
            });
        }
        
        if (password.length < 6) {
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username}: ${duration} ms`);
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
        }
        
        let user = null;
        // Solo autenticar contra la base de datos real
        if (db && db.isAvailable && db.pool) {
            try {
                console.log('🔍 Buscando usuario en base de datos...');
                const result = await db.pool.query(
                    'SELECT id, username, password, role, email, created_at FROM users WHERE username = $1',
                    [username]
                );
                if (result.rows.length > 0) {
                    const dbUser = result.rows[0];
                    const validPassword = await bcrypt.compare(password, dbUser.password);
                    if (validPassword) {
                        user = {
                            id: dbUser.id,
                            username: dbUser.username,
                            role: dbUser.role,
                            email: dbUser.email,
                            created_at: dbUser.created_at
                        };
                        console.log('✅ Usuario autenticado desde base de datos');
                    }
                }
            } catch (dbError) {
                console.log('❌ Error en base de datos:', dbError.message);
            }
        }
        if (user) {
            await logLoginAttempt(username, true, req.ip);
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username}: ${duration} ms`);
            return res.json({
                success: true,
                message: 'Login exitoso',
                user: {
                    username: user.username,
                    role: user.role,
                    email: user.email
                },
                authSource: 'database',
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('❌ Credenciales inválidas para:', username);
            await logLoginAttempt(username, false, req.ip);
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username}: ${duration} ms`);
            res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
// Endpoint para validar código MFA
router.post('/auth/verify-mfa', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email y código son requeridos.' });
    }
    const mfa = mfaCodes[email];
    if (!mfa) {
        return res.status(400).json({ success: false, message: 'No se solicitó autenticación para este correo.' });
    }
    if (Date.now() > mfa.expiresAt) {
        delete mfaCodes[email];
        return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
    }
    if (code !== mfa.code) {
        return res.status(401).json({ success: false, message: 'Código incorrecto.' });
    }
    // MFA correcto, eliminar código y permitir acceso
    delete mfaCodes[email];
    return res.json({ success: true, message: 'Autenticación completada.' });
});
        
    } catch (error) {
        console.error('❌ Error en endpoint de login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Función para registrar intentos de login
async function logLoginAttempt(username, success, ip) {
    try {
        if (db && db.isAvailable && db.pool) {
            await db.pool.query(
                `INSERT INTO login_attempts (username, success, ip_address, attempt_time) 
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [username, success, ip]
            );
        }
    } catch (error) {
        console.log('⚠️  No se pudo registrar el intento de login:', error.message);
    }
}

// GET - Verificar sesión (endpoint adicional)
router.get('/auth/verify', (req, res) => {
    // Este endpoint podría verificar tokens JWT en el futuro
    res.json({
        success: true,
        message: 'Endpoint de verificación disponible'
    });
});

// POST - Logout (endpoint adicional)
router.post('/auth/logout', (req, res) => {
    // Aquí podrías invalidar tokens, registrar logout, etc.
    res.json({
        success: true,
        message: 'Logout exitoso'
    });
});

// POST - Registro de nuevo usuario (auto-hash)
router.post('/auth/register', async (req, res) => {
    try {
        const startRegister = Date.now();
        console.log('📝 Solicitud de registro recibida');
        const { username, password, email, role = 'user' } = req.body;
        // Validaciones básicas
        if (!username || !password || !email) {
            return res.status(400).json({
                success: false,
                message: 'Usuario, contraseña y email son requeridos'
            });
        }
        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'El usuario debe tener al menos 3 caracteres'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            });
        }
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido'
            });
        }
        if (!db || !db.isAvailable || !db.pool) {
            return res.status(503).json({
                success: false,
                message: 'Base de datos no disponible. No se pueden registrar usuarios.'
            });
        }
        // Verificar si el usuario ya existe
        const existingUser = await db.pool.query(
            'SELECT username FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El usuario o email ya existe'
            });
        }
        // 🔐 AUTO-HASH de la contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log('🔒 Contraseña hasheada automáticamente');
    // Medir tiempo hasta aquí (registro)
    const registerTimeMs = Date.now() - startRegister;
    console.log(`⏱️ Tiempo de registro (sin correo): ${registerTimeMs} ms (${(registerTimeMs/1000).toFixed(3)} s)`);
        // Generar código MFA y enviar email
        const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
        mfaCodes[email] = { code: mfaCode, expiresAt, username, hashedPassword, role };
        const startMail = Date.now();
        try {
            await transporter.sendMail({
                from: 'IoT Dashboard <admin@iot.local>',
                to: email,
                subject: 'Tu código de verificación IoT',
                text: `Tu código de verificación es: ${mfaCode}\nEste código expira en 5 minutos.`
            });
            const mailTimeMs = Date.now() - startMail;
            console.log(`📧 Código MFA enviado a ${email}: ${mfaCode}`);
            console.log(`⏱️ Tiempo en enviar correo: ${mailTimeMs} ms (${(mailTimeMs/1000).toFixed(3)} s)`);
            res.status(201).json({
                success: true,
                message: 'Se envió un código de verificación al correo. Ingresa el código para activar tu cuenta.',
                mfaRequired: true,
                email,
                registerTimeMs,
                mailTimeMs
            });
        } catch (mailErr) {
            console.error('❌ Error enviando email MFA:', mailErr);
            return res.status(500).json({
                success: false,
                message: 'No se pudo enviar el código de verificación al correo.'
            });
        }
// Endpoint para validar código MFA y activar usuario
router.post('/auth/verify-mfa-register', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email y código son requeridos.' });
    }
    const mfa = mfaCodes[email];
    if (!mfa) {
        return res.status(400).json({ success: false, message: 'No se solicitó verificación para este correo.' });
    }
    if (Date.now() > mfa.expiresAt) {
        delete mfaCodes[email];
        return res.status(400).json({ success: false, message: 'El código ha expirado. Regístrate de nuevo.' });
    }
    if (code !== mfa.code) {
        return res.status(401).json({ success: false, message: 'Código incorrecto.' });
    }
    // Insertar usuario en la base de datos
    try {
        const result = await db.pool.query(
            `INSERT INTO users (username, password, email, role, active, created_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
             RETURNING id, username, email, role, created_at`,
            [mfa.username, mfa.hashedPassword, email, mfa.role]
        );
        delete mfaCodes[email];
        return res.json({
            success: true,
            message: 'Usuario activado exitosamente',
            user: {
                id: result.rows[0].id,
                username: result.rows[0].username,
                email: result.rows[0].email,
                role: result.rows[0].role,
                created_at: result.rows[0].created_at
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error al activar el usuario.' });
    }
});
        
    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

module.exports = router;