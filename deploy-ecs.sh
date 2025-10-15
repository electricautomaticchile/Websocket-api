#!/bin/bash

# Script de despliegue para ECS Fargate
# Uso: ./deploy-ecs.sh [environment]

set -e

ENVIRONMENT=${1:-production}
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="electricautomaticchile-websocket"
CLUSTER_NAME="electricautomaticchile-cluster"
SERVICE_NAME="websocket-service"
TASK_FAMILY="electricautomaticchile-websocket"

echo "🚀 Desplegando WebSocket API a ECS Fargate"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"

# 1. Login a ECR
echo "📦 Autenticando con ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 2. Build de la imagen Docker
echo "🔨 Construyendo imagen Docker..."
docker build -t $ECR_REPOSITORY:latest .
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$(git rev-parse --short HEAD)

# 3. Push a ECR
echo "⬆️  Subiendo imagen a ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$(git rev-parse --short HEAD)

# 4. Actualizar task definition con el account ID correcto
echo "📝 Actualizando task definition..."
sed "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" ecs-task-definition.json > ecs-task-definition-temp.json

# 5. Registrar nueva task definition
echo "📋 Registrando nueva task definition..."
TASK_DEFINITION_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition-temp.json \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Task definition registrada: $TASK_DEFINITION_ARN"

# 6. Actualizar servicio ECS
echo "🔄 Actualizando servicio ECS..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $TASK_FAMILY \
  --force-new-deployment \
  --region $AWS_REGION

# 7. Esperar a que el servicio esté estable
echo "⏳ Esperando a que el servicio esté estable..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION

# Limpiar archivo temporal
rm ecs-task-definition-temp.json

echo "✅ Despliegue completado exitosamente!"
echo "🔗 Verifica el estado en: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$CLUSTER_NAME/services/$SERVICE_NAME"
