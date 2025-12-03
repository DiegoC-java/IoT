# Informe de Cambios (15-16 noviembre 2025)

## Resumen Ejecutivo
- Se consolidó la data de dispositivos mostrando el último evento real desde PostgreSQL y asignando identificadores secuenciales para el dashboard.
- La tabla principal del panel se simplificó: se eliminaron acciones redundantes, se homogeneizaron etiquetas y se añadió una métrica de tiempo transcurrido más clara.
- Se ajustó la configuración de `docker-compose` para evitar reinicios automáticos no deseados durante las pruebas locales.

## Backend (`Back/routes/devices.js`)
1. **Enriquecimiento de dispositivos**
   - La consulta `GET /devices` ahora usa un `LEFT JOIN LATERAL` contra `device_events` para recuperar en una sola llamada el último `timestamp`, `sensor_value` y `event_type` por dispositivo.
   - Se derivan campos `lastReading`, `last_reading`, `lastValue` y `lastEventType`, asegurando que el frontend reciba la misma estructura tanto si viene de la base como del fallback.
   - Se asigna `displayId` en el backend para mantener índices consistentes entre actualizaciones y facilitar el render del dashboard.
2. **Filtro temporal más sólido**
   - El parámetro `recentMinutes` ahora compara contra `COALESCE(last_event.timestamp, d.last_seen)` para cubrir dispositivos sin eventos recientes pero con latidos.
3. **Endpoint `GET /devices/:id`**
   - Replica el mismo `JOIN LATERAL`, proporcionando detalle sincronizado cuando se consulta un dispositivo puntual.
4. **Conteo diario de alertas**
   - `GET /api/events/count` ahora acepta parámetros `start` y `end` (ISO 8601) para contar exactamente el rango enviado —el dashboard envía el inicio y fin del día local—, manteniendo `today=true` como opción retrocompatible y `hours` para ventanas relativas.

## Frontend
### `Front/index.html`
- La tabla de "Dispositivos Conectados" cambió sus columnas a `#, Dispositivo, Estado, Última Lectura, Tiempo transcurrido`.
- El encabezado "Tiempo transcurrido" reemplaza al informal "Hace cuánto" y se eliminó la columna de acciones para reducir ruido visual.
- La tarjeta KPI ahora muestra el título "Alertas detectadas hoy" para comunicar que el conteo es diario.

### `Front/script.js`
1. **Tabla de dispositivos**
   - `populateDevicesTable()` usa `displayId` numéricos, muestra solo el nombre en la segunda columna y refleja tanto la fecha formateada (`formatDateTime`) como el lapso relativo (`formatRelativeTime`).
   - Se retiró el bloque de botones "Ver/Editar" que ya no aportaba en la vista principal.
2. **Helpers nuevos**
   - `formatRelativeTime()` devuelve textos tipo `hace 5m/2h/3d`, habilitando el nuevo encabezado.
   - `formatDeviceValue()` y mejoras en `getUnitForDevice()` estandarizan la presentación en tooltips/alertas.
3. **Carga y KPIs**
   - Al recibir datos del backend se calculan `displayId`, conteos de dispositivos activos y se reutiliza esa estructura para KPIs y gráficas.
   - El KPI de alertas invoca `GET /api/events/count?start=...&end=...` pasando el inicio y fin del día actual calculado en el navegador, asegurando que la cifra corresponda al huso horario del usuario.
4. **Gráfico de estado dinámico**
   - `updateDevicesChart()` vuelve a contar los dispositivos `online/offline/warning` en cada refresco y redibuja el gráfico donut, dejando claro en segundos si algún sensor perdió conexión.
5. **Tiempos relativos pulidos**
   - `formatRelativeTime()` ahora hace `Math.max(0, diff)` para evitar que recién llega una alerta aparezca como "En el futuro"; se muestra inmediatamente `hace 0s`.

### `Front/devices.js`
- La función `formatRelativeTime()` usa la misma lógica de clamp para que el historial de alertas mantenga coherencia (nada aparece "en el futuro").

### `Front/benchmarks.html` / `benchmarks.css` / `benchmarks.js`
- Se igualó el "hero" de Benchmarks con el de Historial de alertas: mismo gradiente, tipografía y controles globales (se eliminó el botón redundante dentro de la tarjeta).
- Se forzó el subtítulo a una sola línea con elipsis para evitar saltos y mantener la lectura limpia.
- Se añadió un botón de refresco dedicado en el hero y luego se retiró cuando se migró la funcionalidad al header, dejando únicamente el timestamp global.

### `Front/styles.css`
- Se añadieron estilos `.device-name` y `.device-id` para reforzar jerarquía visual dentro de la tabla.

### Documentación
- `Documents/DOCUMENTACION_COMPLETA.md` y este informe registran los ajustes del hero, el nuevo KPI diario y la eliminación del estado "En el futuro" para mantener trazabilidad.

## Infraestructura (`docker-compose.yml`)
- Los servicios `postgres` y `pgadmin` pasaron de `restart: always` a `restart: no` para evitar reinicios en caliente durante sesiones de desarrollo.

