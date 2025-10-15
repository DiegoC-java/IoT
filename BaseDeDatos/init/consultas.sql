-- Crear usuario y base de datos (solo si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'iot_user') THEN
        CREATE USER iot_user WITH PASSWORD 'iot_password123';
    END IF;
END
$$;

-- Crear base de datos si no existe
SELECT 'CREATE DATABASE iot_dashboard OWNER iot_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iot_dashboard')\gexec

-- Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE iot_dashboard TO iot_user;

-- Conectar a la base de datos iot_dashboard
\c iot_dashboard;

-- Otorgar permisos al usuario
GRANT ALL PRIVILEGES ON SCHEMA public TO iot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO iot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO iot_user;

-- Crear tabla de dispositivos
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline',
    last_reading TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    value DECIMAL(10,2),
    unit VARCHAR(20),
    battery INTEGER,
    signal VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de ejemplo
INSERT INTO devices (id, name, type, location, status, value, unit, battery, signal) VALUES
('DEV-001', 'Sensor Temperatura Exterior', 'Sensor Temperatura', 'Jardín', 'online', 24.3, '°C', 85, 'excelente'),
('DEV-002', 'Sensor Humedad Invernadero', 'Sensor Humedad', 'Invernadero', 'online', 68.5, '%', 92, 'buena'),
('DEV-003', 'Cámara Seguridad Principal', 'Cámara', 'Entrada', 'online', 1080, 'p', NULL, 'excelente');