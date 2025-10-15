# ============================================
# Etapa 1: Construcción
# ============================================
FROM node:20-slim AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Limpiar devDependencies
RUN npm prune --production

# ============================================
# Etapa 2: Producción
# ============================================
FROM node:20-slim

# Establecer directorio de trabajo
WORKDIR /app

# Crear usuario y grupo no-root para seguridad
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser

# Copiar archivos compilados desde la etapa de construcción
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Establecer variables de entorno
ENV NODE_ENV=production
ENV PORT=5000

# Exponer puerto
EXPOSE 5000

# Cambiar a usuario no-root
USER appuser

# Health check - verifica que el servidor responda en /health
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { \
    let data = ''; \
    r.on('data', chunk => data += chunk); \
    r.on('end', () => { \
      try { \
        const json = JSON.parse(data); \
        process.exit(json.status === 'OK' ? 0 : 1); \
      } catch(e) { \
        process.exit(1); \
      } \
    }); \
  }).on('error', () => process.exit(1))"

# Comando de inicio
CMD ["npm", "start"]
