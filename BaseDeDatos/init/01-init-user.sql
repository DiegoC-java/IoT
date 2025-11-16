-- Este script se ejecuta como primer paso
-- Crea la base de datos y el usuario si no existen

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS iot_dashboard;

-- Crear usuario si no existe
CREATE USER IF NOT EXISTS iot_user WITH PASSWORD 'iot_password123';

-- Dar permisos al usuario sobre la base de datos
GRANT ALL PRIVILEGES ON DATABASE iot_dashboard TO iot_user;

-- Conectar a la base de datos
\connect iot_dashboard

-- Dar permisos sobre esquemas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO iot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO iot_user;
