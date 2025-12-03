# 3 Benchmarks del Sistema IoT

## 1. Login MFA vs Login Sin MFA

**Login Sin MFA:**
- diego: 74 ms
- victor: 68 ms
- diego: 69 ms
- diego: 69 ms
- jesus: 93 ms
- victor: 74 ms
- **Promedio: ~74.5 ms**

**Login Con MFA (login + envío código):**
- Tiempo login: ~75 ms
- Tiempo envío código: ~2500 ms
- **Total: ~2575 ms**

**Diferencia: ~34.6x más lento con MFA**

---

## 2. Tasa de Falsos Positivos (MPU6050 vs PIR)

**PIR (Sensor de Movimiento):**
- Alertas totales: [PENDIENTE MEDIR]
- Alertas falsas: [PENDIENTE MEDIR]
- **Tasa de falsos positivos: ?%**

**MPU6050 (Sensor de Vibración):**
- Alertas totales: [PENDIENTE MEDIR]
- Alertas falsas: [PENDIENTE MEDIR]
- **Tasa de falsos positivos: ?%**

---

## 3. Velocidad Dashboard vs Correo (Demora en Notificación de Alerta)

**Dashboard (Tiempo Real):**
- API `/api/dashboard`: ~50-200 ms
- Actualización gráficos: ~100-300 ms
- **Total: ~150-500 ms**

**Correo (Email):**
- Detección sensor → BD: ~10-50 ms
- Envío email: ~2000-3000 ms
- **Total: ~2050-3050 ms**

**Diferencia: Dashboard es ~13.7x más rápido que correo**
