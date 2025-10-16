#include <WiFi.h>
#include "time.h"

// --- CONFIGURACIÓN DE RED ---
const char* ssid = "Altro52.4G";
const char* password = "victor19";

// --- CONFIGURACIÓN DE HORA (NTP) ---
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -10800; // Offset GMT en segundos (UTC-3 para Chile = -3 * 3600)
const int daylightOffset_sec = 0;  // Horario de verano (0 si no aplica)

// --- Pines de los componentes ---
const int ledRojoPin = 22;
const int sensorPirPin = 23;
const int buzzerPin = 13;

// --- Variables para el control de tiempo ---
unsigned long previousCheckTime = 0;
const long checkInterval = 100;

// --- Variables para la lógica de confirmación ---
bool motionDetected = false;
unsigned long firstMotionTime = 0;
const long confirmationDelay = 750;

// --- Estados de los componentes ---
int ledRojoState = LOW;
bool isBuzzerOn = false;

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
  pinMode(sensorPirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  // --- Conexión a Wi-Fi ---
  Serial.printf("Conectando a %s ", ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" CONECTADO");

  // --- Sincronización de Hora ---
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Hora sincronizada.");

  Serial.println("Sistema de alarma V1.0 iniciado. Esperando movimiento...");
}

void loop() {
  unsigned long currentTime = millis();

  if (currentTime - previousCheckTime >= checkInterval) {
    previousCheckTime = currentTime;
    int sensorState = digitalRead(sensorPirPin);

    if (sensorState == HIGH) { // Si el sensor ve algo
      if (!motionDetected) {
        motionDetected = true;
        firstMotionTime = currentTime;
        Serial.print("[" + getFormattedTime() + "] ");
        Serial.println("Posible movimiento detectado. Iniciando confirmación...");
      } else {
        if (currentTime - firstMotionTime >= confirmationDelay) {
          if (ledRojoState == LOW) {
            Serial.print("[" + getFormattedTime() + "] ");
            Serial.println("¡MOVIMIENTO CONFIRMADO! Alarma activada.");
            digitalWrite(ledRojoPin, HIGH);
            ledRojoState = HIGH;
          }
          if (!isBuzzerOn) {
            tone(buzzerPin, 1000);
            isBuzzerOn = true;
          }
        }
      }
    } else { // Si el sensor NO ve nada
      if (motionDetected) {
        Serial.print("[" + getFormattedTime() + "] ");
        Serial.println("Movimiento detenido. Reseteando.");
        motionDetected = false;
      }
      if (ledRojoState == HIGH) {
        digitalWrite(ledRojoPin, LOW);
        ledRojoState = LOW;
      }
      if (isBuzzerOn) {
        noTone(buzzerPin);
        isBuzzerOn = false;
      }
    }
  }
}