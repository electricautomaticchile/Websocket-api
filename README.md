# Electric Automatic Chile - WebSocket API

Servidor WebSocket para comunicación en tiempo real entre dispositivos Arduino y clientes web.

## 🚀 ¿Qué hace este proyecto?

Servidor WebSocket desarrollado con Socket.IO que proporciona:

- **Comunicación Serial con Arduino**: Lee datos del puerto USB en tiempo real
- **Bridge Arduino → WebSocket**: Convierte datos seriales a eventos WebSocket
- **Salas por Usuario**: Cada cliente recibe solo sus datos
- **Autenticación JWT**: Conexiones seguras con validación de tokens
- **Registro Automático de Dispositivos**: Crea dispositivos nuevos automáticamente
- **Actualización en Tiempo Real**: Envía datos de consumo cada 5 segundos

## 🛠️ Tecnologías

- **Node.js + Express** - Framework backend
- **Socket.IO** - WebSocket bidireccional
- **TypeScript** - Tipado estático
- **SerialPort** - Comunicación con Arduino
- **Axios** - Cliente HTTP para API REST
- **Winston** - Logging

## 📦 Instalación

```bash
npm install
```

## 🔧 Configuración

Crea un archivo `.env` con las siguientes variables:

```env
PORT=5000
API_URL=http://localhost:4000/api
JWT_SECRET=tu_secret_key_aqui
NODE_ENV=development
SERIAL_PORT=/dev/ttyUSB0
BAUD_RATE=9600
```

## 🚀 Desarrollo

```bash
npm run dev
```

El servidor WebSocket estará disponible en `http://localhost:5000`

## 🔌 Conexión Arduino

El Arduino debe enviar datos en formato JSON por el puerto serial:

```json
{
  "type": "data",
  "deviceId": "629903-3",
  "clienteId": "688e5ee1233c78b3e47c7155",
  "voltage": 220,
  "current": 0.5,
  "activePower": 110,
  "energy": 0.055,
  "cost": 8.25,
  "uptime": 3600,
  "led1": true,
  "led2": false
}
```

## 📡 Eventos WebSocket

### Cliente → Servidor

- `authenticate` - Autenticación con JWT

### Servidor → Cliente

- `connection:confirmed` - Confirmación de conexión
- `room:joined` - Confirmación de unión a sala
- `dispositivo:actualizacion_potencia` - Datos de consumo en tiempo real

## 📚 Documentación Detallada

Para más información sobre deployment, configuración de Arduino y troubleshooting, consulta la carpeta [`docs/`](./docs/)

## 🔗 Proyectos Relacionados

- [Frontend](../electricautomaticchile/)
- [API Backend](../api-electricautomaticchile/)
