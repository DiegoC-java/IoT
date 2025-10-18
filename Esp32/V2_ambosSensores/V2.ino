#include <WiFi.h>
#include "time.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

// --- Instancia del sensor MPU6050 ---
Adafruit_MPU6050 mpu;

// --- CONFIGURACIÓN DE RED ---
const char* ssid = "Altro52.4G";
const char* password = "*****";

// --- CONFIGURACIÓN DE HORA (NTP) ---
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -10800; // UTC-3 para Chile
const int daylightOffset_sec = 0;

// --- Pines de los componentes ---
const int ledRojoPin = 19;      // LED para Movimiento (PIR)
const int ledVibracionPin = 18; // LED para Vibración (MPU-6050)
const int sensorPirPin = 23;
const int buzzerPin = 13;

// --- Parámetros de Sensores y Alarma ---
#define VIBRATION_THRESHOLD 12
const long alarmDuration = 3000; // Duración mínima de la alarma en ms (3 segundos)

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
// --- NUEVAS VARIABLES DE MEMORIA ---
bool alarmTriggeredByMotion = false;
bool alarmTriggeredByVibration = false;

// --- Función para obtener la fecha y hora formateada ---
String getFormattedTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "Hora no sincronizada";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeStringBuff);
}

void setup() {
  Serial.begin(115200);

  pinMode(ledRojoPin, OUTPUT);
  pinMode(ledVibracionPin, OUTPUT);
  pinMode(sensorPirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  // --- Inicialización del MPU6050 ---
  if (!mpu.begin()) {
    Serial.println("Fallo al encontrar el sensor MPU-6050. Revisa las conexiones.");
    while (1) { delay(10); }
  }
  Serial.println("Sensor MPU-6050 inicializado.");
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // --- Conexión a Wi-Fi y Sincronización de Hora ---
  Serial.printf("Conectando a %s ", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" CONECTADO");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Hora sincronizada.");

  Serial.println("Sistema de alarma V2.3 iniciado. Esperando eventos...");
}

void loop() {
  unsigned long currentTime = millis();

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
      }
    } else {
      motionDetected = false;
    }
    
    bool triggerByMotionNow = motionDetected && (currentTime - firstMotionTime >= confirmationDelay);
    bool triggerByVibrationNow = (totalAccel > VIBRATION_THRESHOLD);

    // --- LÓGICA DE LA ALARMA ---

    // 1. CONDICIÓN PARA ACTIVAR LA ALARMA
    if (triggerByMotionNow || triggerByVibrationNow) {
      if (!isAlarmActive) { // Si la alarma está apagada, la enciende
        isAlarmActive = true;
        alarmStartTime = currentTime;
        tone(buzzerPin, 1000);

        Serial.print("[" + getFormattedTime() + "] ");
        Serial.print("¡ALARMA ACTIVADA! Motivo: ");
      }
      
      // "Memoriza" la causa del disparo. Si una causa ya estaba, añade la nueva.
      if (triggerByMotionNow) { 
        if (!alarmTriggeredByMotion) { Serial.print("Movimiento. "); }
        alarmTriggeredByMotion = true; 
      }
      if (triggerByVibrationNow) { 
        if (!alarmTriggeredByVibration) { Serial.print("Vibración."); }
        alarmTriggeredByVibration = true; 
      }
    }

    // 2. LÓGICA MIENTRAS LA ALARMA ESTÁ ACTIVA
    if (isAlarmActive) {
      // Enciende los LEDs correspondientes a la causa "memorizada"
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

        Serial.println("\n[" + getFormattedTime() + "] Condiciones de alarma finalizadas. Sistema en reposo.");
      }
    }
  }
}