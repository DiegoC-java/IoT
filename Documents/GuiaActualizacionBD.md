# 🔄 Guía de Actualización del Proyecto IoT

## Para: Compañero de equipo
## Fecha: 17 de noviembre 2025
## Cambios: Sistema de medición de latencia Dashboard (Benchmark #3)

---

## 📥 1. Traer los cambios del repositorio

```bash
git pull origin Diego
```

---

## 🗄️ 2. Actualizar la base de datos

### Opción A: Script automático (RECOMENDADO)
```bash
./update-db.sh
```

### Opción B: Manual
```bash
docker exec -i iot_postgres psql -U iot_user -d iot_dashboard < BaseDeDatos/init/03-dashboard-latency.sql
```

---

## 🔄 3. Reiniciar el backend

Si ya está corriendo, detenerlo (`Ctrl+C`) y reiniciar:

```bash
cd Back
npm run dev
```

---

## ✅ 4. Verificar que funciona

### Prueba 1: Verificar endpoint de benchmarks
```bash
curl http://localhost:3000/api/benchmarks/stats | python3 -m json.tool
```

Deberías ver en la respuesta:
```json
"dashboardLatency": {
    "avg_latency": 0,
    "total": "0"
}
```

### Prueba 2: Ver la página de benchmarks
Abre en el navegador: `http://localhost:8000/benchmarks.html`

Deberías ver una nueva fila en el Benchmark #3:
- 📱 Dashboard (Actualización)
- 📧 Email (Envío Correo)

---

## 🎯 ¿Qué cambió?

### Nuevas tablas/columnas en la BD:
1. **Tabla nueva**: `dashboard_latency_metrics`
   - Guarda el tiempo que tarda el dashboard en mostrar eventos
   
2. **Columna nueva**: `device_events.server_received_at`
   - Timestamp cuando el servidor recibe el evento del ESP32

### Archivos modificados:
- `Back/routes/devices.js` - Nuevo endpoint `/api/events/record-latency`
- `Back/Benchmark/benchmarkService.js` - Incluye métricas de latencia dashboard
- `Front/script.js` - Calcula y envía latencia automáticamente
- `Front/benchmarks.html` - Muestra latencia real del dashboard
- `Front/benchmarks.js` - Renderiza datos de latencia

### Cómo funciona:
1. ESP32 envía evento → Backend guarda `server_received_at`
2. Frontend (cada 5 segundos) consulta eventos nuevos
3. Frontend calcula: `tiempo_actual - server_received_at`
4. Frontend envía esa latencia al backend
5. Benchmark #3 muestra el promedio real (≈2000-5000ms)

---

## 🐛 Troubleshooting

### Error: "docker exec: no such container"
- Solución: `docker-compose up -d`

### Error: "role postgres does not exist"
- Solución: Usa el usuario correcto `iot_user` (el script ya lo hace)

### El backend no inicia
- Verifica que PostgreSQL esté corriendo: `docker ps | grep iot_postgres`
- Verifica puerto 3000 libre: `lsof -i :3000`

### Frontend no muestra datos
- Asegúrate que el backend esté corriendo
- Abre consola del navegador (F12) y busca errores
- Verifica que `http://localhost:3000/api/benchmarks/stats` responda

---

## 📞 Contacto

Si tienes problemas, contacta a Diego.

---

**¡Listo para probar con el ESP32! 🚀**
