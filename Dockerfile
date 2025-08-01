# Dockerfile para WebSocket API
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S websocket -u 1001

# Cambiar propietario de archivos
RUN chown -R websocket:nodejs /app
USER websocket

# Exponer puerto
EXPOSE 5000

# Comando de inicio
CMD ["npm", "start"]