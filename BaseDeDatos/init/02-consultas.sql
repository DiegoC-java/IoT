-- Este script se ejecuta como segundo paso
-- Ya conectado a la base de datos iot_dashboard

-- Crear tabla de usuarios si no existe
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
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

-- Crear tabla para eventos de dispositivos (para ESP32)
CREATE TABLE IF NOT EXISTS device_events (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    sensor_type VARCHAR(50),
    timestamp TIMESTAMP NOT NULL,
    sensor_value INTEGER,
    is_false_positive BOOLEAN DEFAULT NULL,
    updated_at TIMESTAMP,
    additional_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_events_timestamp ON device_events(timestamp DESC);
CREATE INDEX idx_device_events_device_id ON device_events(device_id);
CREATE INDEX idx_device_events_type ON device_events(event_type);
CREATE INDEX idx_device_events_sensor ON device_events(sensor_type);

-- Crear tabla de dispositivos registrados
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    device_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP,
    firmware_version VARCHAR(20),
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL PRIVILEGES ON TABLE device_events TO iot_user;
GRANT USAGE, SELECT ON SEQUENCE device_events_id_seq TO iot_user;
GRANT ALL PRIVILEGES ON TABLE devices TO iot_user;

-- ========================================================
-- TABLAS PARA BENCHMARKS Y MÉTRICAS
-- ========================================================

-- Tabla para guardar métricas de login/registro
CREATE TABLE IF NOT EXISTS benchmark_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,  
    mfa BOOLEAN NOT NULL,              
    time_ms NUMERIC(10,2) NOT NULL,    
    username VARCHAR(50),              
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_benchmark_metrics_type ON benchmark_metrics(metric_type);
CREATE INDEX idx_benchmark_metrics_mfa ON benchmark_metrics(mfa);
CREATE INDEX idx_benchmark_metrics_timestamp ON benchmark_metrics(created_at DESC);

-- Tabla para guardar tiempos de envío de email
CREATE TABLE IF NOT EXISTS email_metrics (
    id SERIAL PRIMARY KEY,
    email_type VARCHAR(50) NOT NULL,
    time_ms NUMERIC(10,2) NOT NULL,  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_metrics_type ON email_metrics(email_type);
CREATE INDEX idx_email_metrics_timestamp ON email_metrics(created_at DESC);

-- Dar permisos sobre las nuevas tablas de benchmarks
GRANT ALL PRIVILEGES ON TABLE benchmark_metrics TO iot_user;
GRANT USAGE, SELECT ON SEQUENCE benchmark_metrics_id_seq TO iot_user;
GRANT ALL PRIVILEGES ON TABLE email_metrics TO iot_user;
GRANT USAGE, SELECT ON SEQUENCE email_metrics_id_seq TO iot_user;

-- Insertar usuarios de ejemplo con contraseñas hasheadas (bcrypt)
-- Contraseñas originales: admin123, user123, demo123, operator123
INSERT INTO users (username, password, email, role)
SELECT * FROM (VALUES
    ('admin', '$2b$10$rT8FJvXQxPxqYZN.kxG5ROxJ9EYmhLPBj5q5aQ0N3FzZRqGQh9Kqy', 'admin@iot.local', 'admin'),
    ('user', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'user@iot.local', 'user'),
    ('demo', '$2b$10$3euPcmQFCiblsZeEu5s7p.ahCOZFEkY6zVsP0RgXFkxvVZPNQvXOi', 'demo@iot.local', 'demo'),
    ('operator', '$2b$10$K0xE9TkGr8g9eQ7YOYXk1.5V5J5v5J5v5J5v5J5v5J5v5J5v5J5v5', 'operator@iot.local', 'operator')
) AS t(username, password, email, role)
WHERE NOT EXISTS (SELECT 1 FROM users);

-- Confirmar inserción
SELECT 'Usuarios creados correctamente. Total: ' || COUNT(*) FROM users;

-- Mostrar usuarios creados
SELECT username, role, email, created_at FROM users ORDER BY created_at;