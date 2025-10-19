// ========================================
// 🚨 SISTEMA DE ALARMA IoT - V3.0
// ========================================
// ESP32 con PIR + MPU6050 + Backend Integration
// Autor: Diego C.
// Fecha: 18 de octubre de 2025
// ========================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "config.h"  // 🔐 Archivo de configuración (credenciales)

// --- Instancia del sensor MPU6050 ---
Adafruit_MPU6050 mpu;

// --- Pines de los componentes ---
const int ledRojoPin = 19;      // LED para Movimiento (PIR)
const int ledVibracionPin = 18; // LED para Vibración (MPU-6050)
const int sensorPirPin = 23;
const int buzzerPin = 13;

// --- Parámetros de Sensores y Alarma ---
#define VIBRATION_THRESHOLD 12
const long alarmDuration = 3000; // Duración mínima de la alarma en ms

// --- Variables para el control de tiempo ---
unsigned long previousCheckTime = 0;
const long checkInterval = 100;
unsigned long lastBackendSend = 0;
const long backendSendInterval = 2000;  // Enviar al backend cada 2 segundos máximo

// --- Variables para la lógica de confirmación (PIR) ---
bool motionDetected = false;
unsigned long firstMotionTime = 0;
const long confirmationDelay = 750;

// --- Estados de los componentes ---
bool isAlarmActive = false;
unsigned long alarmStartTime = 0;
bool alarmTriggeredByMotion = false;
bool alarmTriggeredByVibration = false;

// --- Variables para backend ---
bool wifiConnected = false;
int failedRequests = 0;
const int maxFailedRequests = 5;

// ========================================
// 📡 FUNCIONES DE COMUNICACIÓN
// ========================================

// Función para obtener la fecha y hora formateada
String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "Hora no sincronizada";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

// Función para verificar y reconectar WiFi
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi desconectado. Reconectando...");
    wifiConnected = false;
    WiFi.reconnect();
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ WiFi reconectado");
      Serial.print("📡 IP: ");
      Serial.println(WiFi.localIP());
      wifiConnected = true;
      failedRequests = 0;
    } else {
      Serial.println("\n❌ No se pudo reconectar WiFi");
    }
  }
}

// Función para enviar evento al backend
bool sendEventToBackend(String eventType, String sensorType, int sensorValue, JsonObject additionalData = JsonObject()) {
  if (!wifiConnected || failedRequests >= maxFailedRequests) {
    return false;
  }
  
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);  // Timeout de 5 segundos
  
  // Crear JSON del evento
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["event_type"] = eventType;
  doc["sensor_type"] = sensorType;
  doc["timestamp"] = getFormattedTime();
  doc["sensor_value"] = sensorValue;
  
  // Agregar datos adicionales si existen
  if (!additionalData.isNull()) {
    doc["additional_data"] = additionalData;
  }
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("📤 Enviando evento: ");
  Serial.println(jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("✅ Respuesta del servidor (");
    Serial.print(httpResponseCode);
    Serial.print("): ");
    Serial.println(response);
    failedRequests = 0;
    http.end();
    return true;
  } else {
    Serial.print("❌ Error enviando evento: ");
    Serial.println(http.errorToString(httpResponseCode));
    failedRequests++;
    
    if (failedRequests >= maxFailedRequests) {
      Serial.println("⚠️  Demasiados errores. Pausando envío al backend.");
    }
    
    http.end();
    return false;
  }
}

// Enviar evento de movimiento
void sendMotionEvent(bool confirmed) {
  if (confirmed) {
    sendEventToBackend("motion_confirmed", "PIR", 1);
  } else {
    sendEventToBackend("motion_started", "PIR", 1);
  }
}

// Enviar evento de vibración
void sendVibrationEvent(float accel) {
  StaticJsonDocument<128> additionalData;
  additionalData["acceleration"] = accel;
  additionalData["threshold"] = VIBRATION_THRESHOLD;
  
  sendEventToBackend("vibration_detected", "MPU6050", (int)accel, additionalData.as<JsonObject>());
}

// Enviar evento de alarma
void sendAlarmEvent(bool activated) {
  if (activated) {
    StaticJsonDocument<128> additionalData;
    JsonArray triggeredBy = additionalData.createNestedArray("triggered_by");
    
    if (alarmTriggeredByMotion) triggeredBy.add("PIR");
    if (alarmTriggeredByVibration) triggeredBy.add("MPU6050");
    additionalData["duration_ms"] = alarmDuration;
    
    sendEventToBackend("alarm_activated", "SYSTEM", 1, additionalData.as<JsonObject>());
  } else {
    sendEventToBackend("alarm_deactivated", "SYSTEM", 0);
  }
}

// ========================================
// 🔧 SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("🚨 SISTEMA DE ALARMA IoT - V3.0");
  Serial.println("========================================");
  
  // Configurar pines
  pinMode(ledRojoPin, OUTPUT);
  pinMode(ledVibracionPin, OUTPUT);
  pinMode(sensorPirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  
  // Test inicial de LEDs
  digitalWrite(ledRojoPin, HIGH);
  digitalWrite(ledVibracionPin, HIGH);
  delay(500);
  digitalWrite(ledRojoPin, LOW);
  digitalWrite(ledVibracionPin, LOW);

  // --- Inicialización del MPU6050 ---
  Serial.print("🔧 Inicializando MPU-6050... ");
  if (!mpu.begin()) {
    Serial.println("❌ FALLO");
    Serial.println("⚠️  Revisa las conexiones del MPU-6050");
    while (1) { 
      digitalWrite(ledVibracionPin, HIGH);
      delay(200);
      digitalWrite(ledVibracionPin, LOW);
      delay(200);
    }
  }
  Serial.println("✅ OK");
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // --- Conexión a Wi-Fi ---
  Serial.println("\n📡 Conectando a WiFi...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi CONECTADO");
    Serial.print("📡 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Señal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    wifiConnected = true;
  } else {
    Serial.println("\n❌ WiFi NO CONECTADO");
    Serial.println("⚠️  Sistema funcionará sin backend");
    wifiConnected = false;
  }
  
  // --- Sincronización de Hora (NTP) ---
  if (wifiConnected) {
    Serial.print("⏰ Sincronizando hora... ");
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    delay(2000);
    
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      Serial.println("✅ OK");
      Serial.print("🕐 Hora actual: ");
      Serial.println(getFormattedTime());
    } else {
      Serial.println("⚠️  No sincronizado");
    }
  }
  
  Serial.println("\n========================================");
  Serial.println("✅ Sistema iniciado correctamente");
  Serial.println("🎯 Esperando eventos...");
  Serial.println("========================================\n");
}

// ========================================
// 🔄 LOOP PRINCIPAL
// ========================================

void loop() {
  unsigned long currentTime = millis();
  
  // Verificar WiFi cada 30 segundos
  if (currentTime % 30000 < 100) {
    checkWiFiConnection();
  }

  if (currentTime - previousCheckTime >= checkInterval) {
    previousCheckTime = currentTime;
    
    // --- LECTURA DE SENSORES ---
    int sensorStatePIR = digitalRead(sensorPirPin);
    
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    float totalAccel = sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
    
    // --- DETERMINAR LAS CONDICIONES DE DISPARO ---
    if (sensorStatePIR == HIGH) {
      if (!motionDetected) {
        motionDetected = true;
        firstMotionTime = currentTime;
        Serial.print("[");
        Serial.print(getFormattedTime());
        Serial.println("] 👀 Posible movimiento detectado...");
        
        // Enviar evento de movimiento iniciado
        if (wifiConnected && currentTime - lastBackendSend >= backendSendInterval) {
          sendMotionEvent(false);
          lastBackendSend = currentTime;
        }
      }
    } else {
      motionDetected = false;
    }
    
    bool triggerByMotionNow = motionDetected && (currentTime - firstMotionTime >= confirmationDelay);
    bool triggerByVibrationNow = (totalAccel > VIBRATION_THRESHOLD);

    // --- LÓGICA DE LA ALARMA ---

    // 1. CONDICIÓN PARA ACTIVAR LA ALARMA
    if (triggerByMotionNow || triggerByVibrationNow) {
      if (!isAlarmActive) {
        isAlarmActive = true;
        alarmStartTime = currentTime;
        tone(buzzerPin, 1000);

        Serial.print("[");
        Serial.print(getFormattedTime());
        Serial.print("] 🚨 ¡ALARMA ACTIVADA! Motivo: ");
        
        // Enviar evento de alarma activada
        if (wifiConnected && currentTime - lastBackendSend >= backendSendInterval) {
          sendAlarmEvent(true);
          lastBackendSend = currentTime;
        }
      }
      
      // "Memoriza" la causa del disparo
      if (triggerByMotionNow) { 
        if (!alarmTriggeredByMotion) { 
          Serial.print("Movimiento ");
          if (wifiConnected && currentTime - lastBackendSend >= backendSendInterval) {
            sendMotionEvent(true);
            lastBackendSend = currentTime;
          }
        }
        alarmTriggeredByMotion = true; 
      }
      
      if (triggerByVibrationNow) { 
        if (!alarmTriggeredByVibration) { 
          Serial.print("Vibración ");
          if (wifiConnected && currentTime - lastBackendSend >= backendSendInterval) {
            sendVibrationEvent(totalAccel);
            lastBackendSend = currentTime;
          }
        }
        alarmTriggeredByVibration = true; 
      }
    }

    // 2. LÓGICA MIENTRAS LA ALARMA ESTÁ ACTIVA
    if (isAlarmActive) {
      digitalWrite(ledRojoPin, alarmTriggeredByMotion);
      digitalWrite(ledVibracionPin, alarmTriggeredByVibration);

      // CONDICIÓN PARA DESACTIVAR LA ALARMA
      if (!triggerByMotionNow && !triggerByVibrationNow && (currentTime - alarmStartTime >= alarmDuration)) {
        isAlarmActive = false;
        noTone(buzzerPin);
        digitalWrite(ledRojoPin, LOW);
        digitalWrite(ledVibracionPin, LOW);
        
        // Resetea la memoria de las causas
        alarmTriggeredByMotion = false;
        alarmTriggeredByVibration = false;

        Serial.print("\n[");
        Serial.print(getFormattedTime());
        Serial.println("] ✅ Alarma desactivada. Sistema en reposo.");
        
        // Enviar evento de alarma desactivada
        if (wifiConnected && currentTime - lastBackendSend >= backendSendInterval) {
          sendAlarmEvent(false);
          lastBackendSend = currentTime;
        }
      }
    }
  }
}
