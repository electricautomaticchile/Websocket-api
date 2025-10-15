#!/bin/bash

# ============================================
# Pre-Deployment Check Script
# WebSocket API - Electric Automatic Chile
# ============================================

echo "🔍 Verificando configuración pre-deployment..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ============================================
# 1. Verificar Node.js version
# ============================================
echo "📦 Verificando Node.js..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"
else
    echo -e "${RED}❌ Node.js version debe ser >= 18. Actual: $(node -v)${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================
# 2. Verificar dependencias
# ============================================
echo "📚 Verificando dependencias..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules existe${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules no existe. Ejecutando npm install...${NC}"
    npm install
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ============================================
# 3. Verificar TypeScript build
# ============================================
echo "🔨 Verificando build de TypeScript..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build exitoso${NC}"
else
    echo -e "${RED}❌ Build falló. Ejecuta 'npm run build' para ver errores${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================
# 4. Verificar archivos críticos
# ============================================
echo "📄 Verificando archivos críticos..."
CRITICAL_FILES=(
    "src/index.ts"
    "package.json"
    "tsconfig.json"
    "Dockerfile"
    "apprunner.yaml"
    ".env.example"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# ============================================
# 5. Verificar variables de entorno
# ============================================
echo "🔐 Verificando configuración de variables de entorno..."

if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local existe${NC}"
    
    # Verificar variables críticas
    REQUIRED_VARS=(
        "NODE_ENV"
        "PORT"
        "JWT_SECRET"
        "MAIN_API_URL"
        "FRONTEND_URL"
        "CORS_ORIGINS"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env.local; then
            VALUE=$(grep "^${var}=" .env.local | cut -d'=' -f2)
            if [ -z "$VALUE" ]; then
                echo -e "${YELLOW}⚠️  $var está vacío${NC}"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "${GREEN}✅ $var configurado${NC}"
            fi
        else
            echo -e "${RED}❌ $var no encontrado en .env.local${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${YELLOW}⚠️  .env.local no existe. Copia .env.example a .env.local${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ============================================
# 6. Verificar Dockerfile
# ============================================
echo "🐳 Verificando Dockerfile..."
if docker build -t websocket-api-test . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker build exitoso${NC}"
    docker rmi websocket-api-test > /dev/null 2>&1
else
    echo -e "${RED}❌ Docker build falló${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================
# 7. Verificar apprunner.yaml
# ============================================
echo "☁️  Verificando apprunner.yaml..."
if [ -f "apprunner.yaml" ]; then
    if grep -q "runtime: nodejs20" apprunner.yaml; then
        echo -e "${GREEN}✅ apprunner.yaml configurado correctamente${NC}"
    else
        echo -e "${YELLOW}⚠️  Verificar runtime en apprunner.yaml${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ apprunner.yaml no encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================
# 8. Verificar estructura de directorios
# ============================================
echo "📁 Verificando estructura de directorios..."
REQUIRED_DIRS=(
    "src"
    "src/services"
    "src/middleware"
    "src/routes"
    "src/types"
    "src/utils"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $dir${NC}"
    else
        echo -e "${RED}❌ $dir no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# ============================================
# 9. Verificar package.json scripts
# ============================================
echo "📜 Verificando scripts en package.json..."
REQUIRED_SCRIPTS=(
    "start"
    "build"
    "dev"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if grep -q "\"$script\":" package.json; then
        echo -e "${GREEN}✅ Script '$script' existe${NC}"
    else
        echo -e "${RED}❌ Script '$script' no encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# ============================================
# 10. Verificar health check endpoint
# ============================================
echo "🏥 Verificando health check endpoint..."
if grep -q "/health" src/index.ts; then
    echo -e "${GREEN}✅ Health check endpoint configurado${NC}"
else
    echo -e "${RED}❌ Health check endpoint no encontrado en src/index.ts${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================
# Resumen
# ============================================
echo "================================================"
echo "📊 RESUMEN DE VERIFICACIÓN"
echo "================================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ TODO CORRECTO - Listo para deployment${NC}"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS advertencias encontradas${NC}"
    echo -e "${YELLOW}Se recomienda revisar las advertencias antes del deployment${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS errores encontrados${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS advertencias encontradas${NC}"
    fi
    echo ""
    echo "Por favor corrige los errores antes del deployment"
    echo ""
    exit 1
fi
