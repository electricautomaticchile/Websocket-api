# WebSocket API - Electric Automatic Chile

API WebSocket independiente para comunicación en tiempo real entre el backend principal y el frontend.

## 🚀 Características

- **Comunicación en tiempo real** con Socket.IO
- **Autenticación JWT** integrada
- **Gestión de salas** por usuario, rol y tipo
- **Datos IoT en tiempo real**
- **Sistema de notificaciones**
- **API HTTP** para integración externa
- **Logging avanzado** con Winston

## 📦 Instalación

```bash
npm install
```

## 🔧 Configuración

Copia `.env.local` y configura las variables:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=tu_jwt_secret
MAIN_API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
```

## 🏃‍♂️ Ejecución

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## 🔌 Conexión desde Frontend

```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "tu_jwt_token",
  },
});

// Unirse como usuario
socket.emit("user:join", {
  userId: "user123",
  userRole: "admin",
  userType: "empresa",
});
```

## 📡 Eventos WebSocket

### Cliente → Servidor

- `user:join` - Unirse como usuario autenticado
- `room:join` - Unirse a una sala específica
- `room:leave` - Salir de una sala
- `iot:data` - Enviar datos IoT
- `iot:alert` - Enviar alerta IoT
- `notification:send` - Enviar notificación

### Servidor → Cliente

- `connection:confirmed` - Confirmación de conexión
- `room:joined` - Confirmación de unión a sala
- `room:left` - Confirmación de salida de sala
- `iot:data:update` - Actualización de datos IoT
- `iot:alert:new` - Nueva alerta IoT
- `notification:received` - Notificación recibida

## 🌐 API HTTP

### POST `/api/notify`

Enviar notificación via HTTP

```json
{
  "targetUserId": "user123",
  "event": "notification:received",
  "data": { "message": "Hola!" }
}
```

### GET `/api/stats`

Obtener estadísticas de conexiones

### GET `/api/user/:userId/status`

Verificar si un usuario está conectado

### POST `/api/iot/data`

Recibir datos IoT de dispositivos externos

### POST `/api/iot/alert`

Recibir alertas IoT de dispositivos externos

## 🏗️ Arquitectura

```
WebSocket API (Puerto 5000)
├── Autenticación JWT
├── Gestión de Salas
│   ├── user:userId
│   ├── role:userRole
│   └── type:userType
├── Eventos IoT
├── Notificaciones
└── API HTTP para integración
```

## 🔗 Integración con otros servicios

### Backend Principal (Puerto 4000)

```typescript
// Enviar notificación desde el backend
await fetch("http://localhost:5000/api/notify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    targetRole: "admin",
    event: "new:cotizacion",
    data: { cotizacionId: "123" },
  }),
});
```

### Frontend (Puerto 3000)

```typescript
// Hook personalizado para WebSocket
const { socket, isConnected } = useWebSocket({
  url: "http://localhost:5000",
  token: authToken,
});
```

## 🧪 Testing

### Tests Unitarios

```bash
npm test
```

### Simulación IoT Eléctrica

```bash
# Ejecutar simulación de dispositivos IoT
node scripts/test-iot.js
```

La simulación incluye:

- 3 dispositivos eléctricos simulados
- Lecturas de voltaje, corriente y potencia en tiempo real
- Anomalías ocasionales (sobrevoltaje, sobrecorriente)
- Desconexiones y reconexiones automáticas
- Alertas críticas simuladas

### Simulación Control Hardware

```bash
# Ejecutar simulación de control hardware
node scripts/test-hardware.js
```

La simulación incluye:

- 3 dispositivos hardware (Arduino, controladores)
- Control de LEDs y relés en tiempo real
- Lecturas de sensores (temperatura, humedad, presión)
- Métricas de performance (CPU, memoria, temperatura)
- Secuencias automáticas de comandos
- Simulación de emergencias

## 📝 Logs

Los logs se guardan en:

- Consola (desarrollo)
- `logs/websocket-error.log` (errores en producción)
- `logs/websocket-combined.log` (todos los logs en producción)
