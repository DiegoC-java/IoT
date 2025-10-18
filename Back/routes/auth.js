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

// Usuarios válidos locales (fallback) - con contraseñas hasheadas
const validUsers = [
    { 
        username: 'admin', 
        password: '$2b$10$rT8FJvXQxPxqYZN.kxG5ROxJ9EYmhLPBj5q5aQ0N3FzZRqGQh9Kqy', // admin123
        role: 'admin',
        email: 'admin@iot.local',
        created_at: new Date()
    },
    { 
        username: 'user', 
        password: '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', // user123
        role: 'user',
        email: 'user@iot.local',
        created_at: new Date()
    }
];

// POST - Login
router.post('/auth/login', async (req, res) => {
    try {
        console.log('🔐 Intento de login recibido');
        
        const { username, password } = req.body;
        
        // Validaciones básicas
        if (!username || !password) {
            console.log('❌ Credenciales faltantes');
            return res.status(400).json({
                success: false,
                message: 'Usuario y contraseña son requeridos'
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
        
        let user = null;
        let authSource = 'local';
        
        // Intentar autenticar con la base de datos primero
        if (db && db.isAvailable && db.pool) {
            try {
                console.log('🔍 Buscando usuario en base de datos...');
                
                const result = await db.pool.query(
                    'SELECT id, username, password, role, email, created_at FROM users WHERE username = $1',
                    [username]
                );
                
                if (result.rows.length > 0) {
                    const dbUser = result.rows[0];
                    
                    // Usar bcrypt para verificar la contraseña
                    const validPassword = await bcrypt.compare(password, dbUser.password);
                    
                    if (validPassword) {
                        user = {
                            id: dbUser.id,
                            username: dbUser.username,
                            role: dbUser.role,
                            email: dbUser.email,
                            created_at: dbUser.created_at
                        };
                        authSource = 'database';
                        console.log('✅ Usuario autenticado desde base de datos');
                    }
                }
            } catch (dbError) {
                console.log('⚠️  Error en base de datos, usando autenticación local:', dbError.message);
            }
        }
        
        // Fallback a autenticación local si no se encontró en BD
        if (!user) {
            console.log('🔍 Buscando usuario en datos locales...');
            const localUser = validUsers.find(u => u.username === username);
            
            if (localUser) {
                // Usar bcrypt para verificar la contraseña local
                const validPassword = await bcrypt.compare(password, localUser.password);
                
                if (validPassword) {
                    user = {
                        username: localUser.username,
                        role: localUser.role,
                        email: localUser.email,
                        created_at: localUser.created_at
                    };
                    authSource = 'local';
                    console.log('✅ Usuario autenticado localmente');
                }
            }
        }
        
        if (user) {
            // Registrar el login exitoso
            await logLoginAttempt(username, true, req.ip);
            
            res.json({
                success: true,
                message: 'Login exitoso',
                user: {
                    username: user.username,
                    role: user.role,
                    email: user.email
                },
                authSource: authSource,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log('❌ Credenciales inválidas para:', username);
            
            // Registrar el intento fallido
            await logLoginAttempt(username, false, req.ip);
            
            res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }
        
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
        
        // Insertar usuario en la base de datos
        const result = await db.pool.query(
            `INSERT INTO users (username, password, email, role, active, created_at)
             VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
             RETURNING id, username, email, role, created_at`,
            [username, hashedPassword, email, role]
        );
        
        console.log(`✅ Usuario registrado: ${username}`);
        
        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            user: {
                id: result.rows[0].id,
                username: result.rows[0].username,
                email: result.rows[0].email,
                role: result.rows[0].role,
                created_at: result.rows[0].created_at
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