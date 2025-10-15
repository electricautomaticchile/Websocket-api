# Deployment - WebSocket API

## AWS App Runner

### 1. Configuración

El proyecto incluye `apprunner.yaml` para deployment automático.

### 2. Variables de Entorno en AWS

Configurar en AWS App Runner:

```bash
NODE_ENV=production
PORT=5000
LOG_LEVEL=info
JWT_SECRET=<mismo_que_backend_api>
MAIN_API_URL=<backend_api_url>
FRONTEND_URL=<frontend_url>
CORS_ORIGINS=<frontend_urls_separadas_por_coma>
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000
WS_MAX_CONNECTIONS=1000
```

**IMPORTANTE:** `JWT_SECRET` debe ser exactamente el mismo que en Backend API.

### 3. Build

```bash
npm ci
npm run build
```

### 4. Start

```bash
npm start
```

## Health Check

AWS App Runner verificará `/health` cada 30 segundos.

## CORS Configuration

Asegúrate de incluir todas las URLs del frontend en `CORS_ORIGINS`:

```bash
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com
```

## Load Balancer (si aplica)

Si usas un Load Balancer:
- Habilitar sticky sessions
- Timeout: 3600 segundos mínimo
- Permitir upgrade HTTP → WebSocket

## Logs

Los logs están disponibles en AWS CloudWatch.

## Escalabilidad

Para múltiples instancias, configurar Redis:

```bash
REDIS_URL=<redis_url>
REDIS_ENABLED=true
```
