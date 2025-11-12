# 🚀 Deploy WebSocket API en AWS

## Opciones de Deployment

### ⚡ Opción 1: AWS App Runner (RÁPIDO - Para Probar)

**Ventajas:**
- ✅ Deploy en 5 minutos
- ✅ Muy fácil de configurar
- ✅ Auto-scaling automático
- ✅ Económico para empezar (~$25/mes)

**Desventajas:**
- ⚠️ No ideal para WebSocket persistente
- ⚠️ Puede tener timeouts en conexiones largas
- ⚠️ Sin sticky sessions nativo

**Cuándo usar:** Para probar rápidamente en producción

---

### 🎯 Opción 2: AWS ECS Fargate + ALB (RECOMENDADO)

**Ventajas:**
- ✅ Diseñado para WebSocket
- ✅ Sticky sessions nativo
- ✅ Auto-scaling sin perder conexiones
- ✅ Health checks robustos
- ✅ Integración con Redis

**Desventajas:**
- ⚠️ Más complejo de configurar
- ⚠️ Requiere VPC y ALB
- ⚠️ Costo ~$80/mes

**Cuándo usar:** Para producción seria

---

## 🚀 Deploy Rápido en App Runner (Para Probar)

### 1. Preparar el Código

Asegúrate de tener `apprunner.yaml` en la raíz del proyecto:

```yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    pre-build:
      - npm ci
    build:
      - npm run build
run:
  command: npm start
  network:
    port: 5000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
```

### 2. Crear Servicio en App Runner

```bash
# Desde AWS Console:
# 1. Ir a App Runner
# 2. Create Service
# 3. Source: GitHub
# 4. Repository: tu-repo/Websocket-api
# 5. Branch: main
# 6. Build settings: Use configuration file (apprunner.yaml)
```

### 3. Configurar Variables de Entorno

En App Runner Console → Configuration → Environment variables:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=tu-jwt-secret-aqui
MAIN_API_URL=https://api.tudominio.com
FRONTEND_URL=https://tudominio.com
CORS_ORIGINS=https://tudominio.com,https://api.tudominio.com
REDIS_URL=redis://tu-redis-endpoint:6379
```

### 4. Configurar Dominio Personalizado

```bash
# En App Runner Console:
# 1. Custom domains
# 2. Link domain
# 3. Agregar: ws.tudominio.com
# 4. Copiar CNAME a Route 53
```

### 5. Verificar

```bash
curl https://ws.tudominio.com/health
```

---

## 🎯 Migrar a ECS Fargate (Producción)

Cuando estés listo para producción seria, sigue estos pasos:

### 1. Crear Infraestructura

Ya tienes los archivos en `infrastructure/`:
- `cloudformation-ecs.yaml`
- `deploy-ecs.sh`

### 2. Ejecutar Deploy

```bash
cd Websocket-api
chmod +x deploy-ecs.sh
./deploy-ecs.sh production
```

### 3. Configurar DNS

Apuntar `ws.tudominio.com` al ALB creado.

---

## 📊 Comparación de Costos

| Servicio | Configuración | Costo Mensual |
|----------|--------------|---------------|
| **App Runner** | 1 vCPU, 2GB RAM | ~$25 |
| **ECS Fargate** | 2 tasks (1 vCPU, 2GB) + ALB + Redis | ~$80 |

---

## 🔧 Configuración de Redis

### Opción 1: Redis en ElastiCache (Recomendado)

```bash
# Crear cluster en AWS Console:
# 1. ElastiCache → Redis
# 2. Cluster mode: Disabled
# 3. Node type: cache.t3.micro
# 4. Number of replicas: 0 (para empezar)
```

### Opción 2: Redis en Upstash (Serverless)

```bash
# 1. Ir a https://upstash.com
# 2. Crear Redis database
# 3. Copiar REDIS_URL
# 4. Agregar a variables de entorno
```

---

## ⚠️ Limitaciones de App Runner para WebSocket

App Runner tiene algunas limitaciones:

1. **Timeout de 120 segundos** en conexiones idle
2. **No hay sticky sessions** nativo
3. **Puede cerrar conexiones** durante deploys

**Solución temporal:**
- Implementar reconnection automática en el cliente
- Usar heartbeat/ping cada 30 segundos
- Aceptar que puede haber desconexiones ocasionales

**Solución definitiva:**
- Migrar a ECS Fargate cuando tengas más usuarios

---

## 🚀 Recomendación

### Para Probar (Ahora):
```
✅ Usa App Runner
✅ Configura Redis en Upstash (gratis)
✅ Implementa reconnection en el cliente
✅ Monitorea el comportamiento
```

### Para Producción (Después):
```
✅ Migra a ECS Fargate
✅ Usa ElastiCache Redis
✅ Configura ALB con sticky sessions
✅ Implementa auto-scaling
```

---

## 📝 Checklist de Deploy

### App Runner (Rápido)
- [ ] Crear `apprunner.yaml`
- [ ] Configurar variables de entorno
- [ ] Crear servicio en App Runner
- [ ] Configurar dominio personalizado
- [ ] Configurar Redis (Upstash o ElastiCache)
- [ ] Probar conexión WebSocket
- [ ] Implementar reconnection en cliente

### ECS Fargate (Producción)
- [ ] Crear VPC y subnets
- [ ] Crear certificado SSL en ACM
- [ ] Ejecutar CloudFormation stack
- [ ] Configurar secretos en Secrets Manager
- [ ] Ejecutar deploy script
- [ ] Configurar DNS en Route 53
- [ ] Configurar auto-scaling
- [ ] Configurar alarmas en CloudWatch

---

## 🆘 Troubleshooting

### WebSocket se desconecta cada 2 minutos
**Causa:** Timeout de App Runner  
**Solución:** Implementar ping/pong cada 30 segundos

### Error de CORS
**Causa:** CORS_ORIGINS mal configurado  
**Solución:** Verificar que incluya todas las URLs necesarias

### Redis connection failed
**Causa:** Redis no accesible  
**Solución:** Verificar security groups y REDIS_URL

---

## 📚 Recursos

- [AWS App Runner Docs](https://docs.aws.amazon.com/apprunner/)
- [AWS ECS Fargate Docs](https://docs.aws.amazon.com/ecs/)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Upstash Redis](https://upstash.com/)

---

**Última actualización:** Noviembre 2, 2025
