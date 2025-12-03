-- Agregar columna para medir latencia del dashboard
ALTER TABLE device_events ADD COLUMN IF NOT EXISTS server_received_at TIMESTAMP;

-- Crear tabla para métricas de latencia del dashboard
CREATE TABLE IF NOT EXISTS dashboard_latency_metrics (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES device_events(id) ON DELETE CASCADE,
    latency_ms INTEGER NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_dashboard_latency_recorded_at ON dashboard_latency_metrics(recorded_at DESC);

-- Comentarios
COMMENT ON TABLE dashboard_latency_metrics IS 'Métricas de latencia entre servidor y dashboard frontend';
COMMENT ON COLUMN dashboard_latency_metrics.latency_ms IS 'Tiempo en milisegundos desde server_received_at hasta client_received_at';
