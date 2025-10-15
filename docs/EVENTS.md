# WebSocket Events - WebSocket API

## Eventos del Cliente al Servidor

### user:join
Usuario se une con autenticación.

**Payload:**
```javascript
{
  userId: "user_id",
  userRole: "admin",
  userType: "empresa"
}
```

### room:join
Unirse a una sala específica.

**Payload:**
```javascript
{
  roomId: "room_name"
}
```

### room:leave
Salir de una sala.

**Payload:**
```javascript
{
  roomId: "room_name"
}
```

### iot:data
Enviar datos de dispositivo IoT.

**Payload:**
```javascript
{
  deviceId: "device_id",
  data: {
    voltage: 220,
    current: 10,
    power: 2200
  }
}
```

## Eventos del Servidor al Cliente

### connection:confirmed
Confirmación de conexión exitosa.

**Payload:**
```javascript
{
  socketId: "socket_id",
  userId: "user_id",
  timestamp: "2025-10-10T..."
}
```

### notification:received
Nueva notificación para el usuario.

**Payload:**
```javascript
{
  id: "notification_id",
  type: "info",
  title: "Título",
  message: "Mensaje",
  timestamp: "2025-10-10T..."
}
```

### iot:data:update
Actualización de datos de dispositivo IoT.

**Payload:**
```javascript
{
  deviceId: "device_id",
  data: {
    voltage: 220,
    current: 10,
    power: 2200
  },
  timestamp: "2025-10-10T..."
}
```

### iot:alert:new
Nueva alerta de dispositivo IoT.

**Payload:**
```javascript
{
  deviceId: "device_id",
  alertType: "overvoltage",
  severity: "high",
  message: "Sobrevoltaje detectado",
  timestamp: "2025-10-10T..."
}
```

### room:joined
Confirmación de unión a sala.

**Payload:**
```javascript
{
  roomId: "room_name",
  userId: "user_id"
}
```

### room:left
Confirmación de salida de sala.

**Payload:**
```javascript
{
  roomId: "room_name",
  userId: "user_id"
}
```

## Conexión desde el Cliente

### JavaScript/TypeScript

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'jwt_token_aqui'
  }
});

// Escuchar eventos
socket.on('connect', () => {
  console.log('Conectado:', socket.id);
});

socket.on('notification:received', (data) => {
  console.log('Notificación:', data);
});

// Emitir eventos
socket.emit('user:join', {
  userId: 'user123',
  userRole: 'admin',
  userType: 'empresa'
});
```

## Autenticación

Todas las conexiones requieren un token JWT válido en el handshake:

```javascript
{
  auth: {
    token: 'jwt_token'
  }
}
```

El token debe ser generado por el Backend API y validado con el mismo `JWT_SECRET`.
