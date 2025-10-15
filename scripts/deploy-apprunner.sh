#!/bin/bash

# ============================================
# AWS App Runner Deployment Script
# WebSocket API - Electric Automatic Chile
# ============================================

echo "🚀 Deployment a AWS App Runner"
echo "================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Variables
SERVICE_NAME="websocket-api-electricautomaticchile"
REGION="us-east-1"

# ============================================
# 1. Verificar AWS CLI
# ============================================
echo "🔍 Verificando AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI no está instalado${NC}"
    echo "Instalar desde: https://aws.amazon.com/cli/"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI instalado${NC}"
echo ""

# ============================================
# 2. Verificar credenciales AWS
# ============================================
echo "🔐 Verificando credenciales AWS..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ No hay credenciales AWS configuradas${NC}"
    echo "Ejecuta: aws configure"
    exit 1
fi
echo -e "${GREEN}✅ Credenciales AWS configuradas${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"
echo ""

# ============================================
# 3. Verificar pre-requisitos
# ============================================
echo "📋 Verificando pre-requisitos..."
if [ ! -f "apprunner.yaml" ]; then
    echo -e "${RED}❌ apprunner.yaml no encontrado${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json no encontrado${NC}"
    exit 1
fi

if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile no encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Archivos necesarios presentes${NC}"
echo ""

# ============================================
# 4. Solicitar variables de entorno
# ============================================
echo "🔐 Configuración de Variables de Entorno"
echo "========================================="
echo ""
echo -e "${YELLOW}Por favor ingresa las siguientes variables:${NC}"
echo ""

read -p "JWT_SECRET (debe ser el mismo que en el backend): " JWT_SECRET
read -p "MAIN_API_URL (ej: https://api.electricautomaticchile.com): " MAIN_API_URL
read -p "FRONTEND_URL (ej: https://electricautomaticchile.com): " FRONTEND_URL
read -p "CORS_ORIGINS (separados por coma): " CORS_ORIGINS

echo ""
echo -e "${YELLOW}Variables opcionales (presiona Enter para usar valores por defecto):${NC}"
read -p "REDIS_URL (opcional): " REDIS_URL
read -p "REDIS_ENABLED (true/false, default: false): " REDIS_ENABLED
REDIS_ENABLED=${REDIS_ENABLED:-false}

echo ""

# ============================================
# 5. Crear archivo de configuración
# ============================================
echo "📝 Creando configuración de App Runner..."

cat > /tmp/apprunner-config.json <<EOF
{
  "ServiceName": "$SERVICE_NAME",
  "SourceConfiguration": {
    "AutoDeploymentsEnabled": true,
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/tu-usuario/tu-repo",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "main"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "API",
        "CodeConfigurationValues": {
          "Runtime": "NODEJS_20",
          "BuildCommand": "npm ci && npm run build",
          "StartCommand": "npm start",
          "Port": "5000",
          "RuntimeEnvironmentVariables": {
            "NODE_ENV": "production",
            "PORT": "5000",
            "LOG_LEVEL": "info",
            "JWT_SECRET": "$JWT_SECRET",
            "MAIN_API_URL": "$MAIN_API_URL",
            "FRONTEND_URL": "$FRONTEND_URL",
            "CORS_ORIGINS": "$CORS_ORIGINS",
            "REDIS_URL": "$REDIS_URL",
            "REDIS_ENABLED": "$REDIS_ENABLED",
            "WS_PING_TIMEOUT": "60000",
            "WS_PING_INTERVAL": "25000",
            "WS_MAX_CONNECTIONS": "1000"
          }
        }
      }
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  },
  "HealthCheckConfiguration": {
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }
}
EOF

echo -e "${GREEN}✅ Configuración creada${NC}"
echo ""

# ============================================
# 6. Información de deployment
# ============================================
echo "================================================"
echo "📊 RESUMEN DE DEPLOYMENT"
echo "================================================"
echo ""
echo "Service Name: $SERVICE_NAME"
echo "Region: $REGION"
echo "Runtime: Node.js 20"
echo "CPU: 1 vCPU"
echo "Memory: 2 GB"
echo "Port: 5000"
echo ""
echo "Variables de Entorno:"
echo "  - NODE_ENV: production"
echo "  - JWT_SECRET: ***"
echo "  - MAIN_API_URL: $MAIN_API_URL"
echo "  - FRONTEND_URL: $FRONTEND_URL"
echo "  - CORS_ORIGINS: $CORS_ORIGINS"
echo "  - REDIS_ENABLED: $REDIS_ENABLED"
echo ""

# ============================================
# 7. Confirmar deployment
# ============================================
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "1. Asegúrate de que el repositorio GitHub esté configurado"
echo "2. Verifica que JWT_SECRET sea el mismo que en el backend"
echo "3. El deployment puede tardar 5-10 minutos"
echo ""
read -p "¿Continuar con el deployment? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelado"
    exit 0
fi

echo ""
echo "🚀 Iniciando deployment..."
echo ""

# ============================================
# 8. Instrucciones manuales
# ============================================
echo "================================================"
echo "📋 INSTRUCCIONES DE DEPLOYMENT MANUAL"
echo "================================================"
echo ""
echo "Debido a que App Runner requiere conexión con GitHub,"
echo "sigue estos pasos en la AWS Console:"
echo ""
echo "1. Ve a AWS App Runner Console:"
echo "   https://console.aws.amazon.com/apprunner/home?region=$REGION"
echo ""
echo "2. Click en 'Create service'"
echo ""
echo "3. Source:"
echo "   - Repository type: Source code repository"
echo "   - Connect to GitHub (primera vez)"
echo "   - Selecciona tu repositorio"
echo "   - Branch: main"
echo "   - Deployment trigger: Automatic"
echo ""
echo "4. Build settings:"
echo "   - Configuration file: Use apprunner.yaml"
echo ""
echo "5. Service settings:"
echo "   - Service name: $SERVICE_NAME"
echo "   - Port: 5000"
echo "   - CPU: 1 vCPU"
echo "   - Memory: 2 GB"
echo ""
echo "6. Environment variables (copiar y pegar):"
echo "   NODE_ENV=production"
echo "   PORT=5000"
echo "   LOG_LEVEL=info"
echo "   JWT_SECRET=$JWT_SECRET"
echo "   MAIN_API_URL=$MAIN_API_URL"
echo "   FRONTEND_URL=$FRONTEND_URL"
echo "   CORS_ORIGINS=$CORS_ORIGINS"
echo "   REDIS_URL=$REDIS_URL"
echo "   REDIS_ENABLED=$REDIS_ENABLED"
echo "   WS_PING_TIMEOUT=60000"
echo "   WS_PING_INTERVAL=25000"
echo "   WS_MAX_CONNECTIONS=1000"
echo ""
echo "7. Health check:"
echo "   - Protocol: HTTP"
echo "   - Path: /health"
echo ""
echo "8. Click 'Create & deploy'"
echo ""
echo "================================================"
echo ""
echo -e "${GREEN}✅ Configuración lista para deployment${NC}"
echo ""
echo "Una vez desplegado, obtendrás una URL como:"
echo "https://xxxxx.us-east-1.awsapprunner.com"
echo ""
echo "Actualiza esta URL en:"
echo "  - Frontend: NEXT_PUBLIC_WS_URL"
echo "  - Backend: WS_API_URL"
echo ""
echo "Para verificar el deployment:"
echo "  curl https://tu-url.awsapprunner.com/health"
echo ""
