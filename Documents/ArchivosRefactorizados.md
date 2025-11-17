# Funciones refactorizadas de Front/script.js

## Archivo: Front/script.js

### Funciones modificadas

---

#### showUserInfo(userData)

- Se dividió la lógica en utilidades para crear botones y elementos pequeños, mejorando la legibilidad y reutilización:

```js
function showUserInfo(userData) {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;
    headerControls.innerHTML = '';

    // Botón Salir
    const logoutBtn = createButton({ ... });
    // Fecha y hora actual
    let datetimeElement = document.getElementById('datetime') || createSmall({ ... });
    // Botón Actualizar
    const refreshBtn = createButton({ ... });
    // Indicador de última actualización
    let updateIndicator = document.getElementById('lastUpdate') || createSmall({ ... });

    // Estructura visual
    const headerRow = document.createElement('div');
    headerRow.appendChild(logoutBtn);
    headerRow.appendChild(datetimeElement);
    headerRow.appendChild(refreshBtn);
    headerRow.appendChild(updateIndicator);
    headerControls.appendChild(headerRow);
}
```

---

#### initializeDashboard()

- Se simplificó la función eliminando duplicidad y asegurando que la inicialización sea clara y secuencial:

```js
async function initializeDashboard() {
    try {
        await loadData();
        await fetchLatestEvent();
        updateDateTime();
        initializeCharts();
        populateDevicesTable();
        setupEventListeners();
        setupAlarmControls();
        updateAlarmUI();
        setInterval(refreshData, 30000);
        setInterval(fetchLatestEvent, 5000);
        console.log('✅ Dashboard inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando dashboard:', error);
    }
}
```

---

#### Utilidades nuevas

```js
function createButton({ id, className, style, html, onClick }) { ... }
function createSmall({ id, style }) { ... }
```

- Estas utilidades permiten crear elementos HTML de forma más limpia y reutilizable.

---

**Todas las funciones mantienen la misma funcionalidad original, pero ahora el código es más legible y modular.**

---

## Archivo: Back/routes/devices.js

### Funciones modificadas

#### router.post('/events', ...)

- Se separó la validación de datos y el manejo de errores en funciones auxiliares para mejorar la legibilidad y robustez:

```js
// Refactor: Validar datos del evento
function validateEventData(body) {
    const requiredFields = ['device_id', 'event_type', 'sensor_type', 'sensor_value', 'timestamp'];
    for (const field of requiredFields) {
        if (!body[field]) {
            return `Falta el campo requerido: ${field}`;
        }
    }
    return null;
}

// Refactor: Manejo de errores
function handleError(res, error, message = 'Error interno') {
    console.error(message, error);
    res.status(500).json({ success: false, message: error.message || message });
}

// POST - Recibir eventos de sensores (refactorizado)
router.post('/events', async (req, res) => {
    try {
        console.log('📥 Evento recibido:', req.body);
        const validationError = validateEventData(req.body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }
        const { device_id, event_type, sensor_type, sensor_value, timestamp } = req.body;

        // Insertar evento en la base de datos
        const eventResult = await pool.query(
            'INSERT INTO device_events (device_id, event_type, sensor_type, sensor_value, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [device_id, event_type, sensor_type, sensor_value, timestamp]
        );

        // Notificación por correo
        const recipientEmail = process.env.ALERT_EMAIL_RECIPIENT;
        if (recipientEmail) {
            console.log(`📬 Preparando notificación para la dirección fija: ${recipientEmail}...`);
            sendAlertEmail(recipientEmail, eventResult.rows[0]);
        } else {
            console.warn(`⚠️ La variable ALERT_EMAIL_RECIPIENT no está definida en el archivo .env. No se enviará correo.`);
        }

        // Responder al ESP32
        res.status(201).json({
            success: true,
            message: 'Evento registrado y notificación en proceso',
            data: eventResult.rows[0]
        });

    } catch (error) {
        handleError(res, error, 'Error guardando evento:');
    }
});
```

---

**La funcionalidad se mantiene igual, pero ahora el código es más legible, seguro y modular.**

---

## Archivo: Back/routes/auth.js

### Funciones modificadas

#### router.post('/auth/login', ...)

- Se separó la validación de datos y el manejo de errores en funciones auxiliares para mejorar la legibilidad y robustez:

```js
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
```

---

**La funcionalidad se mantiene igual, pero ahora el código es más legible, seguro y modular.**

---

## Archivo: Back/routes/dashboard.js

### Funciones modificadas

#### router.get('/dashboard', ...)

- Se separó el procesamiento de datos en una función auxiliar para mejorar la legibilidad y modularidad:

```js
// Refactor: Procesamiento de datos del dashboard
function processDashboardData(devices) {
    // ...cálculo de KPIs, historial y estructura de datos...
}

router.get('/dashboard', async (req, res) => {
    try {
        // ...obtención de datos de la BD...
        // Procesar datos con función auxiliar
        const dashboardData = processDashboardData(devices);
        res.json({
            success: true,
            data: dashboardData,
            timestamp: new Date().toISOString(),
            message: `Dashboard cargado con ${devices.length} dispositivos`,
            dataSource: dataSource
        });
    } catch (error) {
        // ...manejo de errores...
    }
});
```

---

**La funcionalidad se mantiene igual, pero ahora el código es más legible y modular.**

---

## Archivo: Back/services/emailService.js

### Funciones modificadas

#### sendAlertEmail(recipientEmail, eventData)

Se separó la validación del destinatario y la construcción de las opciones de correo en funciones auxiliares para mejorar la legibilidad y modularidad:

```js
// Refactor: Validar destinatario
function validateRecipient(recipientEmail) {
    if (!recipientEmail) {
        console.error('❌ No se proporcionó un destinatario para la alerta.');
        return false;
    }
    return true;
}

// Refactor: Construir opciones de correo
function buildMailOptions(recipientEmail, eventData) {
    // ...construcción de asunto y cuerpo HTML...
}

async function sendAlertEmail(recipientEmail, eventData) {
    try {
        if (!validateRecipient(recipientEmail)) return;
        const mailOptions = buildMailOptions(recipientEmail, eventData);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo de alerta enviado a ${recipientEmail}: ${info.messageId}`);
    } catch (error) {
        console.error('❌ Error enviando correo de alerta:', error);
    }
}
```

---

**La funcionalidad se mantiene igual, pero ahora el código es más legible y modular.**
