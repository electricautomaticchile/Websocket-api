import { Server as SocketIOServer } from "socket.io";
import { logger } from "../utils/logger";
import { EventEmitter } from "events";
import { ConnectionManager } from "./ConnectionManager";
import { IoTEventHandler } from "./IoTEventHandler";
import { HardwareEventHandler } from "./HardwareEventHandler";
import { UserSocket } from "../types/websocket";

export class WebSocketManager extends EventEmitter {
  private io: SocketIOServer;
  private connectionManager: ConnectionManager;
  private iotEventHandler: IoTEventHandler;
  private hardwareEventHandler: HardwareEventHandler;

  constructor(io: SocketIOServer) {
    super();
    this.io = io;

    // Inicializar manejadores de eventos
    this.connectionManager = new ConnectionManager(io);
    this.iotEventHandler = new IoTEventHandler(this.connectionManager);
    this.hardwareEventHandler = new HardwareEventHandler(
      this.connectionManager
    );

    // Configurar manejadores de conexión
    this.setupConnectionHandlers();

    logger.info(
      "WebSocketManager inicializado correctamente",
      "WebSocketManager"
    );
  }

  private setupConnectionHandlers(): void {
    this.io.on("connection", (socket: UserSocket) => {
      // Manejar conexión
      this.connectionManager.handleConnection(socket);

      // Configurar event handlers específicos
      this.iotEventHandler.setupEventHandlers(socket);
      this.hardwareEventHandler.setupEventHandlers(socket);

      // Manejar eventos de salas
      socket.on("room:join", (room: string) => {
        this.connectionManager.joinRoom(socket, room);
      });

      socket.on("room:leave", (room: string) => {
        this.connectionManager.leaveRoom(socket, room);
      });

      // Manejar notificaciones
      socket.on(
        "notification:send",
        (data: {
          targetUserId?: string;
          targetRole?: string;
          message: string;
          type: string;
        }) => {
          this.handleNotification(socket, data);
        }
      );
    });
  }

  private handleNotification(
    socket: UserSocket,
    data: {
      targetUserId?: string;
      targetRole?: string;
      message: string;
      type: string;
    }
  ): void {
    logger.info("Enviando notificación", "WebSocketManager", {
      from: socket.userId,
      to: data.targetUserId || data.targetRole,
      type: data.type,
    });

    const notification = {
      ...data,
      id: `notification_${Date.now()}`,
      timestamp: new Date().toISOString(),
      from: socket.userId,
    };

    if (data.targetUserId) {
      this.connectionManager.sendToUser(
        data.targetUserId,
        "notification:received",
        notification
      );
    } else if (data.targetRole) {
      this.connectionManager.sendToRole(
        data.targetRole as any,
        "notification:received",
        notification
      );
    } else {
      this.connectionManager.broadcastToAll(
        "notification:received",
        notification
      );
    }
  }



  // Métodos públicos para acceso externo
  public sendToUser(userId: string, event: string, data: unknown): void {
    this.connectionManager.sendToUser(userId, event, data);
  }

  public sendToRole(role: string, event: string, data: unknown): void {
    this.connectionManager.sendToRole(role as any, event, data);
  }

  public sendToRoom(room: string, event: string, data: unknown): void {
    this.connectionManager.sendToRoom(room, event, data);
  }

  public broadcastToAll(event: string, data: unknown): void {
    this.connectionManager.broadcastToAll(event, data);
  }

  public getConnectionCount(): number {
    return this.connectionManager.getConnectionStats().totalConnections;
  }

  public getConnectedUsers(): Array<{
    socketId: string;
    userId?: string;
    userRole?: string;
    userType?: string;
  }> {
    return this.connectionManager.getConnectedUsers();
  }

  public getConnectionStats(): ReturnType<
    ConnectionManager["getConnectionStats"]
  > {
    return this.connectionManager.getConnectionStats();
  }

  // Métodos para compatibilidad con rutas
  public isUserConnected(userId: string): boolean {
    return this.connectionManager.isUserConnected(userId);
  }

  public sendArduinoCommand(
    deviceId: string,
    command: string,
    parameters: any = {}
  ): string {
    const commandId = `cmd_${Date.now()}`;
    // Implementación básica - se puede expandir
    return commandId;
  }

  public controlRelay(deviceId: string, action: string): string {
    const commandId = `relay_${Date.now()}`;
    // Implementación básica - se puede expandir
    return commandId;
  }

  public updateDeviceConfig(deviceId: string, config: any): string {
    const configId = `config_${Date.now()}`;
    // Implementación básica - se puede expandir
    return configId;
  }

  // Métodos simplificados para analytics (sin ML complejo)
  public getPrediction(deviceId: string, type: string): any {
    return { 
      deviceId, 
      type, 
      prediction: "basic",
      message: "Analytics simplificado - sin ML complejo"
    };
  }

  public getEfficiencyMetrics(deviceId: string): any {
    return { 
      deviceId, 
      efficiency: 0,
      message: "Métricas básicas disponibles"
    };
  }

  public detectDeviceAnomalies(deviceId: string, type: string): boolean {
    return false;
  }

  public getAnalyticsStats(): any {
    return { 
      totalDevices: 0,
      message: "Stats básicas"
    };
  }

  public triggerPredictiveAnalysis(): void {
    logger.info("Análisis predictivo simplificado ejecutado");
  }

  public async trainModels(deviceId: string, dataType: string): Promise<void> {
    logger.info(`Training simplificado para ${deviceId} - ${dataType}`);
  }

  public async generateAdvancedForecast(config: any): Promise<any> {
    return { 
      forecast: "basic_forecast", 
      config,
      message: "Forecast simplificado"
    };
  }

  public async analyzeDevicePatterns(deviceId: string): Promise<any> {
    return { 
      patterns: [], 
      deviceId,
      message: "Análisis de patrones simplificado"
    };
  }

  public async optimizeMLModels(): Promise<void> {
    logger.info("Optimización ML simplificada");
  }

  public getMLStats(): any {
    return { 
      models: 0, 
      accuracy: 0,
      message: "ML stats simplificadas"
    };
  }

  public async generateComprehensiveReport(config: any): Promise<any> {
    return {
      deviceReports: [],
      charts: [],
      summary: "Reporte básico",
      config,
      message: "Reportes simplificados"
    };
  }

  public configureAutomaticReport(config: any): void {
    logger.info("Configuración de reporte automático", config);
  }

  public getGeneratedReports(): any[] {
    return [];
  }

  public getReportConfigs(): any[] {
    return [];
  }
}
