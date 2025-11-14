# Configuración del Arduino

## 🔌 Hardware Requerido

- Arduino Uno/Mega/Nano
- Cable USB
- Sensor de corriente (opcional: ACS712)
- Sensor de voltaje (opcional: ZMPT101B)
- LEDs indicadores (opcional)

## 📝 Código Arduino

### Sketch Básico

```cpp
#include <ArduinoJson.h>

// Configuración
const int LED1_PIN = 13;
const int LED2_PIN = 12;
const String DEVICE_ID = "629903-3";
const String CLIENT_ID = "688e5ee1233c78b3e47c7155";

// Variables
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000; // 5 segundos
unsigned long startTime = 0;

void setup() {
  Serial.begin(9600);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  startTime = millis();

  // Esperar conexión serial
  while (!Serial) {
    delay(10);
  }
}

void loop() {
  unsigned long currentTime = millis();

  // Enviar datos cada 5 segundos
  if (currentTime - lastSend >= SEND_INTERVAL) {
    sendData();
    lastSend = currentTime;

    // Toggle LEDs
    digitalWrite(LED1_PIN, !digitalRead(LED1_PIN));
    digitalWrite(LED2_PIN, !digitalRead(LED2_PIN));
  }
}

void sendData() {
  // Crear documento JSON
  StaticJsonDocument<256> doc;

  doc["type"] = "data";
  doc["deviceId"] = DEVICE_ID;
  doc["clienteId"] = CLIENT_ID;

  // Simular lecturas (reemplazar con sensores reales)
  doc["voltage"] = 220.0;
  doc["current"] = random(1, 10) / 10.0;
  doc["activePower"] = doc["voltage"].as<float>() * doc["current"].as<float>();

  // Calcular energía (kWh)
  float hours = (millis() - startTime) / 3600000.0;
  doc["energy"] = doc["activePower"].as<float>() * hours / 1000.0;

  // Calcular costo (tarifa: $150/kWh)
  doc["cost"] = doc["energy"].as<float>() * 150.0;

  // Uptime en segundos
  doc["uptime"] = (millis() - startTime) / 1000;

  // Estado de LEDs
  doc["led1"] = digitalRead(LED1_PIN);
  doc["led2"] = digitalRead(LED2_PIN);

  // Serializar y enviar
  serializeJson(doc, Serial);
  Serial.println();
}
```

### Con Sensores Reales

```cpp
#include <ArduinoJson.h>

// Pines de sensores
const int VOLTAGE_SENSOR_PIN = A0;
const int CURRENT_SENSOR_PIN = A1;

// Calibración
const float VOLTAGE_CALIBRATION = 220.0 / 1023.0;
const float CURRENT_CALIBRATION = 30.0 / 1023.0;

float readVoltage() {
  int raw = analogRead(VOLTAGE_SENSOR_PIN);
  return raw * VOLTAGE_CALIBRATION;
}

float readCurrent() {
  int raw = analogRead(CURRENT_SENSOR_PIN);
  // ACS712 offset: 512 (2.5V)
  return abs(raw - 512) * CURRENT_CALIBRATION;
}

void sendData() {
  StaticJsonDocument<256> doc;

  doc["type"] = "data";
  doc["deviceId"] = DEVICE_ID;
  doc["clienteId"] = CLIENT_ID;

  // Leer sensores
  float voltage = readVoltage();
  float current = readCurrent();

  doc["voltage"] = voltage;
  doc["current"] = current;
  doc["activePower"] = voltage * current;

  // ... resto del código

  serializeJson(doc, Serial);
  Serial.println();
}
```

## 📚 Librerías Requeridas

### ArduinoJson

```
Sketch > Include Library > Manage Libraries
Buscar: ArduinoJson
Instalar versión 6.x
```

O descargar desde: https://arduinojson.org/

## 🔧 Configuración

### 1. Configurar IDs

```cpp
const String DEVICE_ID = "TU_NUMERO_CLIENTE";
const String CLIENT_ID = "ID_MONGODB_DEL_CLIENTE";
```

Para obtener el CLIENT_ID:

1. Crear cliente en la API
2. Copiar el `_id` de MongoDB
3. Pegar en el código Arduino

### 2. Configurar Baudrate

```cpp
Serial.begin(9600);
```

Debe coincidir con `BAUD_RATE` en `.env` del WebSocket API

### 3. Configurar Intervalo de Envío

```cpp
const unsigned long SEND_INTERVAL = 5000; // 5 segundos
```

## 📤 Formato de Datos

El Arduino debe enviar JSON en este formato:

```json
{
  "type": "data",
  "deviceId": "629903-3",
  "clienteId": "688e5ee1233c78b3e47c7155",
  "voltage": 220.0,
  "current": 0.5,
  "activePower": 110.0,
  "energy": 0.055,
  "cost": 8.25,
  "uptime": 3600,
  "led1": true,
  "led2": false
}
```

## 🔍 Testing

### Monitor Serial Arduino IDE

1. Abrir: Tools > Serial Monitor
2. Configurar baudrate: 9600
3. Verificar que se envían datos JSON cada 5 segundos

### Testing con Python

```python
import serial
import json

ser = serial.Serial('/dev/ttyUSB0', 9600)

while True:
    line = ser.readline().decode('utf-8').strip()
    try:
        data = json.loads(line)
        print(f"Voltage: {data['voltage']}V")
        print(f"Current: {data['current']}A")
        print(f"Power: {data['activePower']}W")
        print(f"Cost: ${data['cost']}")
        print("---")
    except:
        pass
```

## 🚨 Troubleshooting

### JSON malformado

- Verificar que `serializeJson` termina con `Serial.println()`
- No enviar otros `Serial.print()` que interfieran
- Usar `StaticJsonDocument` del tamaño correcto

### Datos no llegan al servidor

1. Verificar conexión USB
2. Verificar puerto serial correcto
3. Verificar baudrate coincide
4. Ver logs del WebSocket API

### Valores incorrectos

- Calibrar sensores correctamente
- Verificar conexiones de sensores
- Usar promedios de múltiples lecturas
