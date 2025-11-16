import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { WebSocketManager } from "./services/WebSocketManager";
import { AuthMiddleware } from "./middleware/authMiddleware";
import { setupRoutes } from "./routes";
import { ArduinoSerialBridge } from "./services/ArduinoSerialBridge";

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

// Inicializar WebSocket Manager y middleware de autenticación
const wsManager = new WebSocketManager(io);
const authMiddleware = new AuthMiddleware();

// Inicializar puente serial Arduino
const arduinoSerial = new ArduinoSerialBridge(wsManager);

// Inyectar arduinoBridge en las rutas
import { setArduinoBridge } from "./routes/arduinoRoutes";
setArduinoBridge(arduinoSerial);

// Conectar Arduino automáticamente si está habilitado
if (process.env.ARDUINO_SERIAL_ENABLED === "true") {
  setTimeout(async () => {
    try {
      await arduinoSerial.listPorts();
      await arduinoSerial.connect();
      logger.info("✅ Arduino Serial Bridge iniciado", "Main");
    } catch (error) {
      logger.warn(
        "⚠️ No se pudo conectar al Arduino. El servidor continuará funcionando sin él.",
        "Main"
      );
      logger.info(
        "💡 Para conectar Arduino: 1) Conecta el Arduino por USB, 2) Reinicia el servidor",
        "Main"
      );
    }
  }, 2000); // Esperar 2 segundos después de iniciar el servidor
} else {
  logger.info(
    "ℹ️ Arduino Serial deshabilitado. Para habilitarlo: ARDUINO_SERIAL_ENABLED=true",
    "Main"
  );
}

// Middleware de autenticación para WebSocket
io.use(authMiddleware.authenticate);

// Configurar rutas HTTP
setupRoutes(app, wsManager);

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

// Exportar tanto io como wsManager para uso externo
export { io, wsManager, arduinoSerial };
