const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { sendAlertEmail, sendMFACode } = require('../services/emailService');

// Importar database con manejo de errores
let db = null;
try {
    db = require('../database');
    console.log('🔐 Módulo database cargado para auth');
} catch (error) {
    console.log('⚠️  Database no disponible para auth, usando usuarios locales');
}

// Almacén temporal de códigos MFA (demo, en memoria)
const mfaCodes = {};

// Configuración de nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.ALERT_EMAIL_RECIPIENT || 'admin@iot.local',
        pass: process.env.EMAIL_PASSWORD || 'admin123'
    }
});

// Refactor: Validación de login
function validateLoginData(username, password) {
    if (!username || !password) {
        return 'Usuario y contraseña son requeridos';
    }
    if (username.length < 3) {
        return 'El usuario debe tener al menos 3 caracteres';
    }
    if (password.length < 6) {
        return 'La contraseña debe tener al menos 6 caracteres';
    }
    return null;
}

// Refactor: Manejo de errores
function handleError(res, error, message = 'Error interno del servidor') {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
}

// ==================== LOGIN ====================
router.post('/auth/login', async (req, res) => {
    const start = Date.now();
    try {
        const { username, password } = req.body;
        console.log('🔐 Intento de login recibido:', username);
        const validationError = validateLoginData(username, password);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }
        let user = null;
        // Autenticar contra la base de datos
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
                timestamp: new Date().toISOString(),
                loginTime: duration
            });
        } else {
            console.log('❌ Credenciales inválidas para:', username);
            await logLoginAttempt(username, false, req.ip);
            const duration = Date.now() - start;
            console.log(`⏱️ Tiempo de login para ${username}: ${duration} ms`);
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        handleError(res, error, 'Error en endpoint de login:');
    }
});

// ==================== REGISTRO ====================
router.post('/auth/register', async (req, res) => {
    try {
        const startRegister = Date.now();
        console.log('📝 Solicitud de registro recibida');
        
        const { username, password, email, role = 'user', registerType = 'simple' } = req.body;
        
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
        
        // Hash de la contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log('🔒 Contraseña hasheada automáticamente');
        
        const registerTimeMs = Date.now() - startRegister;
        console.log(`⏱️ Tiempo de registro: ${registerTimeMs} ms`);
        
        if (registerType === 'mfa') {
            // Generar código MFA y enviar email
            const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos
            mfaCodes[email] = { code: mfaCode, expiresAt, username, hashedPassword, role };

            const startMail = Date.now();
            try {
                // Usar emailService para enviar el código de verificación
                await sendMFACode(email, mfaCode);
                const mailTimeMs = Date.now() - startMail;
                console.log(`📧 Código MFA enviado a ${email}: ${mfaCode}`);
                console.log(`⏱️ Tiempo en enviar correo: ${mailTimeMs} ms`);
                return res.status(201).json({
                    success: true,
                    message: 'Se envió un código de verificación al correo.',
                    mfaRequired: true,
                    email,
                    registerTimeMs,
                    mailTimeMs
                });
            } catch (mailErr) {
                console.error('❌ Error enviando email MFA:', mailErr);
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo enviar el código de verificación.'
                });
            }
        } else {
            // Registro simple
            try {
                const result = await db.pool.query(
                    `INSERT INTO users (username, password, email, role, active, created_at)
                     VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
                     RETURNING id, username, email, role, created_at`,
                    [username, hashedPassword, email, role]
                );
                
                return res.status(201).json({
                    success: true,
                    message: 'Usuario registrado exitosamente',
                    user: {
                        id: result.rows[0].id,
                        username: result.rows[0].username,
                        email: result.rows[0].email,
                        role: result.rows[0].role,
                        created_at: result.rows[0].created_at
                    },
                    mfaRequired: false,
                    registerTimeMs
                });
            } catch (err) {
                console.error('Error insertando usuario:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Error al registrar el usuario.' 
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// ==================== VERIFICAR MFA (LOGIN) ====================
router.post('/auth/verify-mfa', async (req, res) => {
    const start = Date.now();
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email y código son requeridos.' 
        });
    }
    
    const mfa = mfaCodes[email];
    if (!mfa) {
        return res.status(400).json({ 
            success: false, 
            message: 'No se solicitó autenticación para este correo.' 
        });
    }
    
    if (Date.now() > mfa.expiresAt) {
        delete mfaCodes[email];
        return res.status(400).json({ 
            success: false, 
            message: 'El código ha expirado.' 
        });
    }
    
    if (code !== mfa.code) {
        return res.status(401).json({ 
            success: false, 
            message: 'Código incorrecto.' 
        });
    }
    
    delete mfaCodes[email];
    const duration = Date.now() - start;
    
    return res.json({ 
        success: true, 
        message: 'Autenticación completada.',
        tiempo: duration 
    });
});

// ==================== VERIFICAR MFA (REGISTRO) ====================
router.post('/auth/verify-mfa-register', async (req, res) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email y código son requeridos.' 
        });
    }
    
    const mfa = mfaCodes[email];
    if (!mfa) {
        return res.status(400).json({ 
            success: false, 
            message: 'No se solicitó verificación para este correo.' 
        });
    }
    
    if (Date.now() > mfa.expiresAt) {
        delete mfaCodes[email];
        return res.status(400).json({ 
            success: false, 
            message: 'El código ha expirado.' 
        });
    }
    
    if (code !== mfa.code) {
        return res.status(401).json({ 
            success: false, 
            message: 'Código incorrecto.' 
        });
    }
    
    try {
        const startRegister = Date.now();
        const result = await db.pool.query(
            `INSERT INTO users (username, password, email, role, active, created_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
             RETURNING id, username, email, role, created_at`,
            [mfa.username, mfa.hashedPassword, email, mfa.role]
        );
        
        delete mfaCodes[email];
        const registerTimeMs = Date.now() - startRegister;
        
        return res.json({
            success: true,
            message: 'Usuario activado exitosamente',
            user: {
                id: result.rows[0].id,
                username: result.rows[0].username,
                email: result.rows[0].email,
                role: result.rows[0].role,
                created_at: result.rows[0].created_at
            },
            registerTimeMs
        });
    } catch (err) {
        console.error('Error activando usuario:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Error al activar el usuario.' 
        });
    }
});

// ==================== OTROS ENDPOINTS ====================
router.get('/auth/verify', (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de verificación disponible'
    });
});

router.post('/auth/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logout exitoso'
    });
});

// ==================== FUNCIONES AUXILIARES ====================
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

module.exports = router;