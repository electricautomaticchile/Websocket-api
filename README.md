# WebSocket API - Electric Automatic Chile

API de comunicación en tiempo real usando Socket.IO para notificaciones y eventos instantáneos.

## 🎯 ¿Para qué sirve?

Este servicio maneja **toda la comunicación en tiempo real**:
- Notificaciones instantáneas a usuarios
- Eventos de dispositivos IoT en tiempo real
- Alertas del sistema
- Actualizaciones de estado en vivo

## 🔌 ¿Cómo se conecta con los otros proyectos?

```
Frontend (Puerto 3000)
    ↓ WebSocket
WebSocket API (Puerto 5000) ← Tú estás aquí
    ↑ HTTP
Backend API (Puerto 4000)
```

- **Frontend ↔ WebSocket**: Mantiene conexión WebSocket abierta para comunicación bidireccional
- **Backend → WebSocket**: Envía eventos HTTP para que se transmitan a los clientes conectados
- **WebSocket → Frontend**: Envía notificaciones y eventos en tiempo real

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env.local
# Editar .env.local con tus valores
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. Build para producción
```bash
npm run build
npm start
```

## 📡 Eventos WebSocket

### Cliente → Servidor
- `user:join` - Usuario se une con autenticación
- `room:join` - Unirse a una sala específica
- `iot:data` - Enviar datos de dispositivo IoT

### Servidor → Cliente
- `connection:confirmed` - Confirmación de conexión
- `notification:received` - Nueva notificación
- `iot:data:update` - Actualización de datos IoT
- `iot:alert:new` - Nueva alerta

## 🔐 Autenticación

El WebSocket API valida tokens JWT del Backend API:
- Cada conexión debe incluir un token JWT válido
- El `JWT_SECRET` debe ser **exactamente el mismo** que en el Backend API

## ⚙️ Variables de Entorno Importantes

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `JWT_SECRET` | Secret para validar tokens (debe ser igual al Backend) | ✅ Sí |
| `MAIN_API_URL` | URL del Backend API | ✅ Sí |
| `FRONTEND_URL` | URL del Frontend | ✅ Sí |
| `CORS_ORIGINS` | URLs permitidas para CORS | ✅ Sí |

## 📊 Health Check

```bash
curl http://localhost:5000/health
```

## 📚 Documentación Adicional

Ver carpeta `docs/` para documentación detallada.
