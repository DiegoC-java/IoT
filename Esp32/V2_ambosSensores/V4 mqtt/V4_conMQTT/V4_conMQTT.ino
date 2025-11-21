// ========================================
// 🚨 SISTEMA DE ALARMA IoT - V4.0
// ========================================
// Integración con MQTT para control remoto (Armar/Desarmar)
// sin modificar la lógica de detección existente.

#include <WiFi.h>
#include <PubSubClient.h> // <-- LIBRERÍA MQTT
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include "config.h" // 🔐 Archivo de configuración

// --- Instancias ---
Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- ESTADO GLOBAL DEL SISTEMA ---
bool isAlarmSystemArmed = true; // El sistema empieza armado por defecto

// --- Heartbeat MQTT ---
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 2000;

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
// 📡 FUNCIONES MQTT
// ========================================

// Esta función se ejecuta cada vez que llega un mensaje en un tema al que estamos suscritos
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("Mensaje MQTT recibido en [%s]: %s\n", topic, message.c_str());

  if (String(topic) == "esp32/alarm/set") {
    if (message == "active") {
      isAlarmSystemArmed = true;
      Serial.println(">>> SISTEMA DE ALARMA ARMADO <<<");
    } else if (message == "inactive") {
      isAlarmSystemArmed = false;
      Serial.println(">>> SISTEMA DE ALARMA DESARMADO <<<");
      // Forzar el apagado de la alarma si estaba activa
      isAlarmActive = false;
      digitalWrite(ledRojoPin, LOW);
      digitalWrite(ledVibracionPin, LOW);
      noTone(buzzerPin);
      alarmTriggeredByMotion = false;
      alarmTriggeredByVibration = false;
    }
  }
}

void publishStatus(const char* status) {
  if (!mqttClient.connected()) return;
  String topic = String("esp32/") + DEVICE_ID + "/status";
  mqttClient.publish(topic.c_str(), status, true);
}

void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  String topic = String("esp32/") + DEVICE_ID + "/heartbeat";
  mqttClient.publish(topic.c_str(), "ping");
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Intentando conexión MQTT...");
    String clientId = String(DEVICE_ID) + "_client";
    String willTopic = String("esp32/") + DEVICE_ID + "/status";
    if (mqttClient.connect(clientId.c_str(), nullptr, nullptr, willTopic.c_str(), 1, true, "offline")) {
      Serial.println(" ¡conectado!");
      mqttClient.subscribe("esp32/alarm/set");
      Serial.println("Suscrito al tema 'esp32/alarm/set'");
      publishStatus("online");
      sendHeartbeat();
      lastHeartbeat = millis();
    } else {
      Serial.printf(" falló, rc=%d. Reintentando en 5 segundos\n", mqttClient.state());
      delay(5000);
    }
  }
}

// ========================================
// 📡 FUNCIONES DE COMUNICACIÓN (HTTP)
// (Tus funciones getFormattedTime, sendMotionEvent y sendVibrationEvent se mantienen aquí sin cambios)
// ========================================

String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) { return "Hora no sincronizada"; }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

void sendMotionEvent() {
  if (!wifiConnected) return;
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.setTimeout(1000); // Timeout de 1 segundo
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
  if (httpResponseCode > 0) { Serial.printf("✅ Confirmación del servidor (Movimiento): %d\n", httpResponseCode); } 
  else { Serial.printf("❌ Error enviando evento (Movimiento): %s\n", http.errorToString(httpResponseCode).c_str()); }
  http.end();
}

void sendVibrationEvent(float accelValue) {
  if (!wifiConnected) return;
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.setTimeout(1000); // Timeout de 1 segundo
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
  if (httpResponseCode > 0) { Serial.printf("✅ Confirmación del servidor (Vibración): %d\n", httpResponseCode); } 
  else { Serial.printf("❌ Error enviando evento (Vibración): %s\n", http.errorToString(httpResponseCode).c_str()); }
  http.end();
}


// ========================================
// 🔧 SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println("🚨 SISTEMA DE ALARMA IoT - V4.0");
  Serial.println("========================================");
  
  pinMode(ledRojoPin, OUTPUT);
  pinMode(ledVibracionPin, OUTPUT);
  pinMode(sensorPirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  // (Inicialización de MPU6050, WiFi y NTP se mantiene igual que en tu V3.4)
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

  // --- NUEVO: CONFIGURACIÓN DE MQTT ---
  mqttClient.setServer(MQTT_BROKER_URL, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("\n========================================");
  Serial.println("✅ Sistema iniciado. Esperando eventos...");
  Serial.println("========================================\n");
}

// ========================================
// 🔄 LOOP PRINCIPAL
// ========================================

void loop() {
  // --- MANTENER CONEXIONES ---
  if (WiFi.status() != WL_CONNECTED) {
      // Aquí podrías añadir una lógica de reconexión de WiFi si es necesario
  }
  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop(); // Esencial para procesar mensajes MQTT entrantes

  unsigned long now = millis();
  if (mqttClient.connected() && now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // --- LÓGICA PRINCIPAL DE LA ALARMA ---
  unsigned long currentTime = millis();

  if (currentTime - previousCheckTime >= checkInterval) {
    previousCheckTime = currentTime;
    
    // --- ¡CAMBIO CLAVE! SOLO EJECUTAR LA LÓGICA SI EL SISTEMA ESTÁ ARMADO ---
    if (!isAlarmSystemArmed) {
      return; // Si está desarmado, no hacer nada más y salir del ciclo de comprobación
    }

    // A partir de aquí, toda tu lógica del loop V3.4 se ejecuta sin cambios.
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
      }
    }
  }
}

