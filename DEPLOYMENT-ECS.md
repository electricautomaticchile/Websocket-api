# Guía de Despliegue - WebSocket API en ECS Fargate

## 📋 Requisitos Previos

1. **AWS CLI configurado** con credenciales apropiadas
2. **Docker** instalado localmente
3. **VPC con subnets públicas y privadas**
4. **Certificado SSL** en AWS Certificate Manager
5. **Dominio** configurado (ej: `ws.electricautomaticchile.com`)

## 🚀 Pasos de Despliegue

### 1. Crear repositorio ECR

```bash
aws ecr create-repository \
  --repository-name electricautomaticchile-websocket \
  --region us-east-1
```

### 2. Crear secretos en Secrets Manager

```bash
# Redis URL (se creará automáticamente con CloudFormation)
aws secretsmanager create-secret \
  --name websocket/redis-url \
  --secret-string "redis://your-redis-endpoint:6379" \
  --region us-east-1

# API URL
aws secretsmanager create-secret \
  --name websocket/api-url \
  --secret-string "https://api.electricautomaticchile.com" \
  --region us-east-1

# JWT Secret
aws secretsmanager create-secret \
  --name websocket/jwt-secret \
  --secret-string "your-super-secret-jwt-key" \
  --region us-east-1
```

### 3. Desplegar infraestructura con CloudFormation

```bash
aws cloudformation create-stack \
  --stack-name electricautomaticchile-websocket \
  --template-body file://infrastructure/cloudformation-ecs.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=production \
    ParameterKey=VpcId,ParameterValue=vpc-xxxxx \
    ParameterKey=PublicSubnetIds,ParameterValue="subnet-xxx\\,subnet-yyy" \
    ParameterKey=PrivateSubnetIds,ParameterValue="subnet-aaa\\,subnet-bbb" \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:xxx:certificate/xxx \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

Espera a que el stack se complete:

```bash
aws cloudformation wait stack-create-complete \
  --stack-name electricautomaticchile-websocket \
  --region us-east-1
```

### 4. Obtener el DNS del ALB

```bash
aws cloudformation describe-stacks \
  --stack-name electricautomaticchile-websocket \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region us-east-1
```

### 5. Configurar DNS (Route 53)

Crea un registro CNAME en Route 53:

```bash
# Ejemplo: ws.electricautomaticchile.com -> ALB-DNS
```

### 6. Desplegar la aplicación

```bash
chmod +x deploy-ecs.sh
./deploy-ecs.sh production
```

## 🔍 Verificación

### Verificar el servicio

```bash
# Ver estado del servicio
aws ecs describe-services \
  --cluster electricautomaticchile-cluster \
  --services websocket-service \
  --region us-east-1

# Ver logs
aws logs tail /ecs/electricautomaticchile-websocket --follow
```

### Probar conexión WebSocket

```bash
# Usando wscat
npm install -g wscat
wscat -c wss://ws.electricautomaticchile.com

# O usando curl para health check
curl https://ws.electricautomaticchile.com/health
```

## 📊 Monitoreo

### CloudWatch Dashboards

El stack crea automáticamente métricas en CloudWatch:

- **CPU Utilization**: Promedio de uso de CPU
- **Memory Utilization**: Promedio de uso de memoria
- **Active Connections**: Número de conexiones WebSocket activas
- **Request Count**: Número de requests al ALB

### Alarmas recomendadas

```bash
# Crear alarma para alta CPU
aws cloudwatch put-metric-alarm \
  --alarm-name websocket-high-cpu \
  --alarm-description "CPU usage above 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 🔧 Configuración de Redis

El stack crea automáticamente un cluster de Redis. Para conectarte:

```bash
# Obtener endpoint de Redis
aws cloudformation describe-stacks \
  --stack-name electricautomaticchile-websocket \
  --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
  --output text
```

## 🔄 Actualizaciones

Para actualizar la aplicación:

```bash
# Opción 1: Usar el script de deploy
./deploy-ecs.sh production

# Opción 2: Manual
# 1. Build y push de nueva imagen
# 2. Forzar nuevo deployment
aws ecs update-service \
  --cluster electricautomaticchile-cluster \
  --service websocket-service \
  --force-new-deployment \
  --region us-east-1
```

## 📈 Escalamiento

### Auto-scaling configurado:

- **Mínimo**: 2 tasks
- **Máximo**: 10 tasks
- **Trigger CPU**: > 70%
- **Trigger Memory**: > 80%

### Escalar manualmente:

```bash
aws ecs update-service \
  --cluster electricautomaticchile-cluster \
  --service websocket-service \
  --desired-count 5 \
  --region us-east-1
```

## 💰 Costos Estimados (us-east-1)

| Recurso | Configuración | Costo Mensual |
|---------|--------------|---------------|
| ECS Fargate (2 tasks) | 1 vCPU, 2GB RAM | ~$30 |
| ALB | Standard | ~$20 |
| ElastiCache Redis | t3.micro | ~$15 |
| Data Transfer | 100GB | ~$9 |
| CloudWatch Logs | 10GB | ~$5 |
| **TOTAL** | | **~$79/mes** |

## 🐛 Troubleshooting

### Tasks no inician

```bash
# Ver eventos del servicio
aws ecs describe-services \
  --cluster electricautomaticchile-cluster \
  --services websocket-service \
  --query 'services[0].events[0:5]'

# Ver logs de la task
aws logs tail /ecs/electricautomaticchile-websocket --follow
```

### Health checks fallan

```bash
# Verificar que el endpoint /health responde
curl -v http://TASK-IP:3001/health

# Ver configuración del target group
aws elbv2 describe-target-health \
  --target-group-arn TARGET-GROUP-ARN
```

### Conexiones WebSocket se pierden

- Verificar que sticky sessions están habilitadas en el ALB
- Aumentar el timeout del ALB a 3600 segundos
- Verificar que Redis está funcionando correctamente

## 🔐 Seguridad

### Mejores prácticas implementadas:

✅ Tasks en subnets privadas (sin IP pública)
✅ ALB en subnets públicas con SSL/TLS
✅ Security groups restrictivos
✅ Secrets en AWS Secrets Manager
✅ IAM roles con permisos mínimos
✅ Container Insights habilitado
✅ Logs centralizados en CloudWatch

## 📚 Recursos Adicionales

- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [WebSocket on ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#websocket-support)
- [Redis Cluster Mode](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/Replication.Redis-RedisCluster.html)

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar logs en CloudWatch
2. Verificar métricas en CloudWatch Dashboard
3. Revisar eventos del servicio ECS
4. Contactar al equipo de DevOps
