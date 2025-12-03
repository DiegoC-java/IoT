// ========================================
// 🚨 SISTEMA DE ALARMA IoT - V3.4
// ========================================
// Lógica de envío al backend actualizada:
// - Se elimina el evento "alarm_deactivated".
// - Se añade confirmación de respuesta del servidor.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "config.h" // 🔐 Archivo de configuración con tus credenciales

// --- Instancia del sensor MPU6050 ---
Adafruit_MPU6050 mpu;

// --- Pines de los componentes ---
const int ledRojoPin = 19;
const int ledVibracionPin = 18;
const int sensorPirPin = 23;
const int buzzerPin = 13;

// --- Parámetros de Sensores y Alarma ---
#define VIBRATION_THRESHOLD 12
const long alarmDuration = 3000;

// --- Variables para el control de tiempo ---
unsigned long previousCheckTime = 0;
const long checkInterval = 100;

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

// ========================================
// 📡 FUNCIONES DE COMUNICACIÓN
// ========================================

String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) { return "Hora no sincronizada"; }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

// --- FUNCIONES DE ENVÍO CON CONFIRMACIÓN ---

void sendMotionEvent() {
  if (!wifiConnected) return;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["event_type"] = "motion_detected";
  doc["sensor_type"] = "PIR";
  doc["timestamp"] = getFormattedTime();
  doc["sensor_value"] = 1;

  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    Serial.printf("✅ Confirmación del servidor (Movimiento): %d\n", httpResponseCode);
  } else {
    Serial.printf("❌ Error enviando evento (Movimiento): %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

void sendVibrationEvent(float accelValue) {
  if (!wifiConnected) return;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["event_type"] = "vibration_detected";
  doc["sensor_type"] = "MPU6050";
  doc["timestamp"] = getFormattedTime();
  doc["sensor_value"] = (int)accelValue;

  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    Serial.printf("✅ Confirmación del servidor (Vibración): %d\n", httpResponseCode);
  } else {
    Serial.printf("❌ Error enviando evento (Vibración): %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// ========================================
// 🔧 SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println("🚨 SISTEMA DE ALARMA IoT - V3.4");
  Serial.println("========================================");
  
  pinMode(ledRojoPin, OUTPUT);
  pinMode(ledVibracionPin, OUTPUT);
  pinMode(sensorPirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  Serial.print("🔧 Inicializando MPU-6050... ");
  if (!mpu.begin()) {
    Serial.println("❌ FALLO");
    while (1) { /* Bucle infinito */ }
  }
  Serial.println("✅ OK");
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.printf("📡 Conectando a %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi CONECTADO");
  wifiConnected = true;

  Serial.print("⏰ Sincronizando hora... ");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  delay(2000); 

  Serial.println("\n========================================");
  Serial.println("✅ Sistema iniciado. Esperando eventos...");
  Serial.println("========================================\n");
}

// ========================================
// 🔄 LOOP PRINCIPAL
// ========================================

void loop() {
  unsigned long currentTime = millis();

  if (currentTime - previousCheckTime >= checkInterval) {
    previousCheckTime = currentTime;
    
    int sensorStatePIR = digitalRead(sensorPirPin);
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    float totalAccel = sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
    
    if (sensorStatePIR == HIGH) {
      if (!motionDetected) {
        motionDetected = true;
        firstMotionTime = currentTime;
      }
    } else {
      motionDetected = false;
    }
    
    bool triggerByMotionNow = motionDetected && (currentTime - firstMotionTime >= confirmationDelay);
    bool triggerByVibrationNow = (totalAccel > VIBRATION_THRESHOLD);

    // --- LÓGICA DE LA ALARMA ---

    if (triggerByMotionNow || triggerByVibrationNow) {
      if (!isAlarmActive) {
        isAlarmActive = true;
        alarmStartTime = currentTime;
        
        alarmTriggeredByMotion = triggerByMotionNow;
        alarmTriggeredByVibration = triggerByVibrationNow;

        tone(buzzerPin, 1000);
        digitalWrite(ledRojoPin, alarmTriggeredByMotion);
        digitalWrite(ledVibracionPin, alarmTriggeredByVibration);

        Serial.print("[");
        Serial.print(getFormattedTime());
        Serial.print("] 🚨 ¡ALARMA ACTIVADA! Motivo: ");
        
        if (alarmTriggeredByMotion) {
          Serial.print("Movimiento ");
          sendMotionEvent();
        }
        if (alarmTriggeredByVibration) {
          Serial.print("Vibración ");
          sendVibrationEvent(totalAccel);
        }
        Serial.println();
      } else {
        bool newMotion = triggerByMotionNow && !alarmTriggeredByMotion;
        bool newVibration = triggerByVibrationNow && !alarmTriggeredByVibration;

        if (newMotion) {
            alarmTriggeredByMotion = true;
            digitalWrite(ledRojoPin, true);
            sendMotionEvent();
        }
        if (newVibration) {
            alarmTriggeredByVibration = true;
            digitalWrite(ledVibracionPin, true);
            sendVibrationEvent(totalAccel);
        }
      }
    }

    if (isAlarmActive) {
      if (!triggerByMotionNow && !triggerByVibrationNow && (currentTime - alarmStartTime >= alarmDuration)) {
        isAlarmActive = false;
        noTone(buzzerPin);
        digitalWrite(ledRojoPin, LOW);
        digitalWrite(ledVibracionPin, LOW);
        
        alarmTriggeredByMotion = false;
        alarmTriggeredByVibration = false;

        Serial.print("\n[");
        Serial.print(getFormattedTime());
        Serial.println("] ✅ Alarma desactivada. Sistema en reposo.");
        
        // La llamada a sendStatusEvent("alarm_deactivated") ha sido eliminada.
      }
    }
  }
}

