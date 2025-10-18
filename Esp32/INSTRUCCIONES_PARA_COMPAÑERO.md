# 🎯 INSTRUCCIONES PARA EL COMPAÑERO CON EL ESP32

## 📦 ARCHIVOS QUE NECESITAS

Todos están en la carpeta: `Esp32/V2_ambosSensores/`

- ✅ `V3_ConBackend.ino` - Código principal
- ✅ `config.h` - Configuración (WiFi y Backend)

---

## 🔧 PASO 1: Instalar Librerías (Solo una vez)

1. Abre **Arduino IDE**
2. Ve a: `Sketch` → `Include Library` → `Manage Libraries`
3. Instala estas **3 librerías**:
   - **ArduinoJson** by Benoit Blanchon (versión 6.x)
   - **Adafruit MPU6050** by Adafruit
   - **Adafruit Unified Sensor** by Adafruit (se instala automáticamente con MPU6050)

---

## 📝 PASO 2: Configurar WiFi

1. Abre el archivo `config.h`
2. Busca esta línea:
   ```cpp
   const char* WIFI_PASSWORD = "TU_CONTRASEÑA_WIFI";
   ```
3. Cámbiala por tu contraseña real del WiFi:
   ```cpp
   const char* WIFI_PASSWORD = "MiContraseñaReal123";
   ```

**IMPORTANTE:** La IP del backend ya está configurada: `192.168.1.138`

---

## 🚀 PASO 3: Subir el Código

1. Conecta el ESP32 a tu computadora con USB
2. Abre **Arduino IDE**
3. Abre el archivo `V3_ConBackend.ino`
4. Selecciona:
   - **Placa:** ESP32 Dev Module (o la que uses)
   - **Puerto:** El puerto COM donde está el ESP32
5. Click en **Upload** (botón ➡️)

---

## 🔍 PASO 4: Ver si Funciona

1. Abre el **Serial Monitor** en Arduino IDE (botón 🔍)
2. Configura velocidad a: **115200 baud**
3. Deberías ver algo así:

```
========================================
🚨 SISTEMA DE ALARMA IoT - V3.0
========================================
🔧 Inicializando MPU-6050... ✅ OK

📡 Conectando a WiFi...
SSID: Altro52.4G
..........
✅ WiFi CONECTADO
📡 IP: 192.168.1.XXX
📶 Señal: -45 dBm

⏰ Sincronizando hora... ✅ OK
🕐 Hora actual: 2025-10-18 17:30:45

========================================
✅ Sistema iniciado correctamente
🎯 Esperando eventos...
========================================
```

---

## 🧪 PASO 5: Probar Sensores

### Sensor PIR (Movimiento):
1. Mueve tu mano frente al sensor PIR
2. Deberías ver:
   - 🔴 LED rojo encendido
   - 🔊 Buzzer sonando
   - En Serial Monitor: `🚨 ¡ALARMA ACTIVADA! Motivo: Movimiento`

### Sensor MPU6050 (Vibración):
1. Golpea suavemente la mesa
2. Deberías ver:
   - 🟡 LED amarillo encendido
   - 🔊 Buzzer sonando
   - En Serial Monitor: `🚨 ¡ALARMA ACTIVADA! Motivo: Vibración`

---

## ⚠️ PROBLEMAS COMUNES

### ❌ "WiFi NO CONECTADO"
**Solución:**
- Verifica que la contraseña en `config.h` sea correcta
- Asegúrate de estar cerca del router WiFi
- Verifica que el SSID sea "Altro52.4G"

### ❌ "Error enviando evento: -1"
**Solución:**
- El backend en la computadora de Diego NO está corriendo
- Dile a Diego que ejecute: `node server.js` en la carpeta `Back/`

### ❌ "Error: MPU-6050 FALLO"
**Solución:**
- Verifica las conexiones del sensor MPU6050
- Revisa que esté bien conectado en los pines I2C (SDA/SCL)

---

## 📊 ¿QUÉ HACE EL CÓDIGO?

1. **Conecta al WiFi** "Altro52.4G"
2. **Lee los sensores** cada 100ms:
   - PIR (movimiento)
   - MPU6050 (vibración)
3. **Detecta alarmas** cuando:
   - Hay movimiento confirmado (750ms)
   - Hay vibración mayor a 12
4. **Envía eventos al backend** de Diego:
   - `motion_started` - Movimiento inicial
   - `motion_confirmed` - Movimiento confirmado
   - `vibration_detected` - Vibración detectada
   - `alarm_activated` - Alarma activada
   - `alarm_deactivated` - Alarma desactivada

---

## 📞 CONTACTO

Si algo no funciona:
1. Toma captura del Serial Monitor
2. Envíasela a Diego
3. Él revisará el backend

---

## ✅ CHECKLIST RÁPIDO

- [ ] Librerías instaladas (ArduinoJson + Adafruit MPU6050)
- [ ] WiFi configurado en config.h
- [ ] Backend de Diego corriendo (él debe hacer esto)
- [ ] Código subido al ESP32
- [ ] Serial Monitor abierto (115200 baud)
- [ ] WiFi conectado (IP obtenida)
- [ ] Sensores respondiendo (PIR y MPU6050)

---

**¡Éxito con las pruebas! 🚀**
