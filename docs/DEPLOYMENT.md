# Deployment - WebSocket API

## 🚀 Deployment en Producción

### VPS con Arduino Conectado (Recomendado)

El WebSocket API debe estar en el mismo servidor donde está conectado el Arduino físicamente.

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar repositorio
git clone <repo-url>
cd Websocket-api

# Instalar dependencias
npm install

# Build
npm run build

# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start dist/index.js --name "websocket-api"
pm2 save
pm2 startup
```

### Permisos del Puerto Serial

```bash
# Agregar usuario al grupo dialout
sudo usermod -a -G dialout $USER

# Reiniciar sesión o ejecutar
newgrp dialout

# Verificar permisos
ls -l /dev/ttyUSB0
```

### Docker (Sin Arduino físico)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

**Nota:** Para usar Arduino con Docker, necesitas pasar el dispositivo:

```bash
docker run -p 5000:5000 --device=/dev/ttyUSB0 --env-file .env websocket-api
```

## 🔧 Variables de Entorno

### Producción

```env
PORT=5000
API_URL=https://api.tudominio.com/api
JWT_SECRET=mismo_secret_que_api_backend
NODE_ENV=production
SERIAL_PORT=/dev/ttyUSB0
BAUD_RATE=9600
CORS_ORIGIN=https://tudominio.com,https://www.tudominio.com
```

## 🔌 Configuración del Arduino

### Conexión Física

1. Conectar Arduino al puerto USB del servidor
2. Verificar puerto: `ls /dev/ttyUSB*` o `ls /dev/ttyACM*`
3. Configurar variable `SERIAL_PORT` con el puerto correcto

### Verificar Conexión

```bash
# Instalar screen
sudo apt-get install screen

# Leer datos del puerto
screen /dev/ttyUSB0 9600

# Salir: Ctrl+A, luego K
```

## 🔒 Seguridad

- WebSocket con autenticación JWT
- CORS configurado para dominios específicos
- Validación de datos del Arduino
- Rate limiting por socket

## 📊 Monitoreo

```bash
# Logs con PM2
pm2 logs websocket-api

# Monitoreo en tiempo real
pm2 monit

# Status
pm2 status

# Restart
pm2 restart websocket-api
```

## 🔄 Auto-restart en Errores

PM2 reinicia automáticamente si:

- El proceso crashea
- Hay un error no capturado
- Se pierde conexión con Arduino

## 🌐 Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name ws.tudominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔐 SSL con Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d ws.tudominio.com
```

## 🚨 Troubleshooting

### Arduino no detectado

```bash
# Verificar dispositivos USB
lsusb

# Verificar puertos seriales
ls -l /dev/tty*

# Ver logs del kernel
dmesg | grep tty
```

### Permisos denegados

```bash
sudo chmod 666 /dev/ttyUSB0
# O agregar usuario al grupo
sudo usermod -a -G dialout $USER
```

### WebSocket no conecta

1. Verificar firewall: `sudo ufw allow 5000`
2. Verificar CORS en variables de entorno
3. Verificar logs: `pm2 logs websocket-api`
