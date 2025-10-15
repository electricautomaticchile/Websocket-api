#!/bin/bash

# Script de setup inicial para infraestructura AWS
# Uso: ./setup-aws-infrastructure.sh

set -e

echo "🚀 Setup de Infraestructura AWS para WebSocket API"
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
AWS_REGION="us-east-1"
STACK_NAME="electricautomaticchile-websocket"
ECR_REPO="electricautomaticchile-websocket"

# Función para preguntar al usuario
ask_user() {
    local prompt="$1"
    local var_name="$2"
    read -p "$prompt: " value
    eval "$var_name='$value'"
}

# Función para verificar si un recurso existe
resource_exists() {
    local resource_type="$1"
    local resource_name="$2"
    
    case $resource_type in
        "ecr")
            aws ecr describe-repositories --repository-names "$resource_name" --region $AWS_REGION &>/dev/null
            ;;
        "stack")
            aws cloudformation describe-stacks --stack-name "$resource_name" --region $AWS_REGION &>/dev/null
            ;;
        "secret")
            aws secretsmanager describe-secret --secret-id "$resource_name" --region $AWS_REGION &>/dev/null
            ;;
    esac
}

echo ""
echo "📋 Paso 1: Verificar requisitos previos"
echo "========================================"

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI instalado${NC}"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker instalado${NC}"

# Verificar credenciales AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Credenciales AWS no configuradas${NC}"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ Credenciales AWS configuradas (Account: $AWS_ACCOUNT_ID)${NC}"

echo ""
echo "📦 Paso 2: Crear repositorio ECR"
echo "================================="

if resource_exists "ecr" "$ECR_REPO"; then
    echo -e "${YELLOW}⚠️  Repositorio ECR ya existe${NC}"
else
    echo "Creando repositorio ECR..."
    aws ecr create-repository \
        --repository-name $ECR_REPO \
        --region $AWS_REGION \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    echo -e "${GREEN}✅ Repositorio ECR creado${NC}"
fi

echo ""
echo "🔐 Paso 3: Configurar secretos"
echo "==============================="

# API URL
if resource_exists "secret" "websocket/api-url"; then
    echo -e "${YELLOW}⚠️  Secret websocket/api-url ya existe${NC}"
else
    ask_user "Ingresa la URL de tu API REST (ej: https://api.electricautomaticchile.com)" API_URL
    aws secretsmanager create-secret \
        --name websocket/api-url \
        --secret-string "$API_URL" \
        --region $AWS_REGION
    echo -e "${GREEN}✅ Secret websocket/api-url creado${NC}"
fi

# JWT Secret
if resource_exists "secret" "websocket/jwt-secret"; then
    echo -e "${YELLOW}⚠️  Secret websocket/jwt-secret ya existe${NC}"
else
    JWT_SECRET=$(openssl rand -base64 32)
    aws secretsmanager create-secret \
        --name websocket/jwt-secret \
        --secret-string "$JWT_SECRET" \
        --region $AWS_REGION
    echo -e "${GREEN}✅ Secret websocket/jwt-secret creado${NC}"
fi

echo ""
echo "🏗️  Paso 4: Recopilar información de red"
echo "========================================="

# VPC ID
ask_user "Ingresa tu VPC ID (ej: vpc-xxxxx)" VPC_ID

# Subnets públicas
ask_user "Ingresa tus Subnet IDs públicas separadas por coma (ej: subnet-xxx,subnet-yyy)" PUBLIC_SUBNETS

# Subnets privadas
ask_user "Ingresa tus Subnet IDs privadas separadas por coma (ej: subnet-aaa,subnet-bbb)" PRIVATE_SUBNETS

# Certificate ARN
ask_user "Ingresa el ARN de tu certificado SSL (ej: arn:aws:acm:us-east-1:xxx:certificate/xxx)" CERT_ARN

echo ""
echo "🚀 Paso 5: Desplegar infraestructura con CloudFormation"
echo "========================================================"

if resource_exists "stack" "$STACK_NAME"; then
    echo -e "${YELLOW}⚠️  Stack ya existe. ¿Deseas actualizarlo? (y/n)${NC}"
    read -p "> " UPDATE_STACK
    
    if [ "$UPDATE_STACK" = "y" ]; then
        echo "Actualizando stack..."
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://infrastructure/cloudformation-ecs.yaml \
            --parameters \
                ParameterKey=Environment,ParameterValue=production \
                ParameterKey=VpcId,ParameterValue=$VPC_ID \
                ParameterKey=PublicSubnetIds,ParameterValue=\"$PUBLIC_SUBNETS\" \
                ParameterKey=PrivateSubnetIds,ParameterValue=\"$PRIVATE_SUBNETS\" \
                ParameterKey=CertificateArn,ParameterValue=$CERT_ARN \
            --capabilities CAPABILITY_IAM \
            --region $AWS_REGION
        
        echo "Esperando a que el stack se actualice..."
        aws cloudformation wait stack-update-complete \
            --stack-name $STACK_NAME \
            --region $AWS_REGION
        echo -e "${GREEN}✅ Stack actualizado${NC}"
    fi
else
    echo "Creando stack..."
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body file://infrastructure/cloudformation-ecs.yaml \
        --parameters \
            ParameterKey=Environment,ParameterValue=production \
            ParameterKey=VpcId,ParameterValue=$VPC_ID \
            ParameterKey=PublicSubnetIds,ParameterValue=\"$PUBLIC_SUBNETS\" \
            ParameterKey=PrivateSubnetIds,ParameterValue=\"$PRIVATE_SUBNETS\" \
            ParameterKey=CertificateArn,ParameterValue=$CERT_ARN \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION
    
    echo "Esperando a que el stack se cree (esto puede tomar 10-15 minutos)..."
    aws cloudformation wait stack-create-complete \
        --stack-name $STACK_NAME \
        --region $AWS_REGION
    echo -e "${GREEN}✅ Stack creado${NC}"
fi

echo ""
echo "📊 Paso 6: Obtener información del despliegue"
echo "=============================================="

ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text \
    --region $AWS_REGION)

REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
    --output text \
    --region $AWS_REGION)

echo ""
echo -e "${GREEN}✅ Infraestructura desplegada exitosamente!${NC}"
echo ""
echo "📝 Información importante:"
echo "=========================="
echo "ALB DNS: $ALB_DNS"
echo "Redis Endpoint: $REDIS_ENDPOINT"
echo "WebSocket URL: wss://$ALB_DNS"
echo ""
echo "🔄 Próximos pasos:"
echo "=================="
echo "1. Configura un registro CNAME en Route 53:"
echo "   ws.electricautomaticchile.com -> $ALB_DNS"
echo ""
echo "2. Actualiza el secret de Redis con el endpoint:"
echo "   aws secretsmanager update-secret \\"
echo "     --secret-id websocket/redis-url \\"
echo "     --secret-string \"redis://$REDIS_ENDPOINT:6379\""
echo ""
echo "3. Despliega tu aplicación:"
echo "   ./deploy-ecs.sh production"
echo ""
echo "4. Verifica el health check:"
echo "   curl https://ws.electricautomaticchile.com/health"
echo ""
echo -e "${GREEN}🎉 Setup completado!${NC}"
