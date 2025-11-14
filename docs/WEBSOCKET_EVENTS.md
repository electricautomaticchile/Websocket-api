# Eventos WebSocket

## 🔌 Conexión

### Cliente → Servidor

#### Autenticación

```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "eyJhbGciOiJIUzI1NiIs...",
  },
});
```

El token JWT debe incluir:

```json
{
  "userId": "688e5ee1233c78b3e47c7155",
  "role": "cliente",
  "type": "cliente"
}
```

## 📡 Eventos del Servidor

### connection:confirmed

Confirmación de conexión exitosa

**Payload:**

```json
{
  "socketId": "eKuQ0nPigjLSFHGaAAAQ",
  "userId": "688e5ee1233c78b3e47c7155",
  "userRole": "cliente",
  "userType": "cliente",
  "timestamp": "2025-11-13T23:59:34.177Z"
}
```

**Ejemplo:**

```javascript
socket.on("connection:confirmed", (data) => {
  console.log("Conectado:", data.socketId);
});
```

### room:joined

Confirmación de unión a sala

**Payload:**

```json
{
  "room": "user:688e5ee1233c78b3e47c7155",
  "timestamp": "2025-11-13T23:59:34.177Z"
}
```

**Ejemplo:**

```javascript
socket.on("room:joined", (data) => {
  console.log("Unido a sala:", data.room);
});
```

### dispositivo:actualizacion_potencia

Actualización de datos de consumo en tiempo real

**Payload:**

```json
{
  "dispositivoId": "629903-3",
  "potenciaActiva": 110.0,
  "energia": 0.055,
  "costo": 8.25,
  "marcaTiempo": "2025-11-13T23:57:36.785Z",
  "metadata": {
    "led1": true,
    "led2": false,
    "uptime": 3600
  }
}
```

**Ejemplo:**

```javascript
socket.on("dispositivo:actualizacion_potencia", (data) => {
  console.log("Potencia:", data.potenciaActiva, "W");
  console.log("Energía:", data.energia, "kWh");
  console.log("Costo:", data.costo, "CLP");
});
```

### device:power_consumption

Evento alternativo con más detalles

**Payload:**

```json
{
  "deviceId": "629903-3",
  "clienteId": "688e5ee1233c78b3e47c7155",
  "voltage": 220.0,
  "current": 0.5,
  "activePower": 110.0,
  "energy": 0.055,
  "cost": 8.25,
  "uptime": 3600,
  "timestamp": "2025-11-13T23:57:36.785Z",
  "metadata": {
    "led1": true,
    "led2": false
  }
}
```

### alert:new

Nueva alerta del sistema

**Payload:**

```json
{
  "deviceId": "629903-3",
  "severity": "warning",
  "message": "Consumo elevado detectado",
  "timestamp": "2025-11-13T23:57:36.785Z"
}
```

### command:result

Resultado de comando ejecutado

**Payload:**

```json
{
  "commandId": "cmd_123",
  "deviceId": "629903-3",
  "status": "success",
  "result": "LED encendido",
  "timestamp": "2025-11-13T23:57:36.785Z"
}
```

## 📤 Eventos del Cliente

### ping

Heartbeat para mantener conexión activa

```javascript
socket.emit("ping", { timestamp: Date.now() });
```

**Response:**

```javascript
socket.on("pong", (data) => {
  const latency = Date.now() - data.timestamp;
  console.log("Latencia:", latency, "ms");
});
```

### command:execute

Ejecutar comando en dispositivo

```javascript
socket.emit("command:execute", {
  deviceId: "629903-3",
  command: "toggle_led",
  params: { led: 1 },
});
```

## 🏠 Salas (Rooms)

Los clientes se unen automáticamente a estas salas:

### Sala Personal

```
user:{userId}
```

Recibe eventos específicos del usuario

### Sala por Rol

```
role:{userRole}
```

Recibe eventos para todos los usuarios del mismo rol

### Sala por Tipo

```
type:{userType}
```

Recibe eventos para todos los usuarios del mismo tipo

### Sala de Cliente

```
cliente:{clienteId}
```

Solo para clientes

### Sala de Dispositivos del Cliente

```
devices:cliente:{clienteId}
```

Eventos de dispositivos del cliente

## 🔐 Autenticación

### Middleware de Autenticación

El servidor valida el JWT en cada conexión:

```typescript
socket.handshake.auth.token; // Token JWT
socket.handshake.auth.userId; // ID del usuario
socket.handshake.auth.userRole; // Rol del usuario
socket.handshake.auth.userType; // Tipo de usuario
```

### Reconexión

El cliente debe reautenticarse en cada reconexión:

```javascript
socket.on("disconnect", () => {
  console.log("Desconectado");
});

socket.on("connect", () => {
  console.log("Reconectado");
  // El token se envía automáticamente
});
```

## 🔄 Manejo de Errores

### Error de Autenticación

```javascript
socket.on("connect_error", (error) => {
  if (error.message === "Token inválido") {
    // Redirigir a login
  }
});
```

### Error de Conexión

```javascript
socket.on("error", (error) => {
  console.error("Error:", error);
});
```

## 📊 Ejemplo Completo

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: localStorage.getItem("auth_token"),
  },
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Conexión establecida
socket.on("connection:confirmed", (data) => {
  console.log("✅ Conectado:", data.socketId);
});

// Unido a sala
socket.on("room:joined", (data) => {
  console.log("🏠 Sala:", data.room);
});

// Datos de consumo
socket.on("dispositivo:actualizacion_potencia", (data) => {
  updateUI({
    power: data.potenciaActiva,
    energy: data.energia,
    cost: data.costo,
  });
});

// Heartbeat
setInterval(() => {
  socket.emit("ping", { timestamp: Date.now() });
}, 25000);

// Manejo de errores
socket.on("connect_error", (error) => {
  console.error("❌ Error de conexión:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Desconectado:", reason);
});
```
