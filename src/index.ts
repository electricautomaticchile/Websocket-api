import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
// Comentamos temporalmente las importaciones problemáticas
// import { WebSocketManager } from "./services/WebSocketManager";
// import { AuthMiddleware } from "./middleware/authMiddleware";
// import { setupRoutes } from "./routes";

// Cargar variables de entorno
dotenv.config({ path: ".env.local" });

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Configurar CORS
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "https://electricautomaticchile.com",
];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.use(express.json());

// Configurar Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || "60000"),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || "25000"),
});

// Comentamos temporalmente la inicialización de WebSocket Manager
// const wsManager = new WebSocketManager(io);
// const authMiddleware = new AuthMiddleware();

// Middleware de autenticación para WebSocket
// io.use(authMiddleware.authenticate);

// Configurar eventos de WebSocket básicos
io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// Configurar rutas HTTP básicas
// setupRoutes(app, wsManager);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "WebSocket API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`🚀 WebSocket API ejecutándose en puerto ${PORT}`);
  logger.info(`🌐 CORS habilitado para: ${corsOrigins.join(", ")}`);
  logger.info(`📊 Modo: ${process.env.NODE_ENV || "development"}`);
});

// Manejo de errores
process.on("uncaughtException", (error) => {
  logger.error("Error no capturado:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Promesa rechazada no manejada:", { reason, promise });
});

// Exportamos el servidor io en lugar de wsManager
export { io };

