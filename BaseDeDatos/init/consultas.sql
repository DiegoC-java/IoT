-- Conectar a la base de datos
\c iot_dashboard;

-- Crear tabla de usuarios si no existe
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- En producción usar hash bcrypt
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Crear tabla para registrar intentos de login
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dar permisos sobre las nuevas tablas
GRANT ALL PRIVILEGES ON TABLE users TO iot_user;
GRANT ALL PRIVILEGES ON TABLE login_attempts TO iot_user;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO iot_user;
GRANT USAGE, SELECT ON SEQUENCE login_attempts_id_seq TO iot_user;

-- Insertar usuarios de ejemplo solo si la tabla está vacía
INSERT INTO users (username, password, email, role)
SELECT * FROM (VALUES
    ('admin', 'admin123', 'admin@iot.local', 'admin'),
    ('user', 'user123', 'user@iot.local', 'user'),
    ('demo', 'demo123', 'demo@iot.local', 'demo'),
    ('operator', 'operator123', 'operator@iot.local', 'operator')
) AS t(username, password, email, role)
WHERE NOT EXISTS (SELECT 1 FROM users);

-- Confirmar inserción
SELECT 'Usuarios creados correctamente. Total: ' || COUNT(*) FROM users;

-- Mostrar usuarios creados
SELECT username, role, email, created_at FROM users ORDER BY created_at;