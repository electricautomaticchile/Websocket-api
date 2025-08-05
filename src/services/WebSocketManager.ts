import { Server as SocketIOServer } from "socket.io";
import { logger } from "../utils/logger";
import { EventEmitter } from "events";
import { PredictiveAnalytics } from "./PredictiveAnalytics";
import { MachineLearning } from "./MachineLearning";
import { AdvancedReporting } from "./AdvancedReporting";
import { ConnectionManager } from "./ConnectionManager";
import { IoTEventHandler } from "./IoTEventHandler";
import { HardwareEventHandler } from "./HardwareEventHandler";
import { MLEventHandler } from "./MLEventHandler";
import { ReportingEventHandler } from "./ReportingEventHandler";
import { UserSocket } from "../types/websocket";

export class WebSocketManager extends EventEmitter {
  private io: SocketIOServer;
  private connectionManager: ConnectionManager;
  private iotEventHandler: IoTEventHandler;
  private hardwareEventHandler: HardwareEventHandler;
  private mlEventHandler: MLEventHandler;
  private reportingEventHandler: ReportingEventHandler;
  private predictiveAnalytics: PredictiveAnalytics;
  private machineLearning: MachineLearning;
  private advancedReporting: AdvancedReporting;

  constructor(io: SocketIOServer) {
    super();
    this.io = io;

    // Inicializar servicios de análisis
    this.predictiveAnalytics = new PredictiveAnalytics();
    this.machineLearning = new MachineLearning();
    this.advancedReporting = new AdvancedReporting(
      this.predictiveAnalytics,
      this.machineLearning
    );

    // Inicializar manejadores de eventos
    this.connectionManager = new ConnectionManager(io);
    this.iotEventHandler = new IoTEventHandler(
      this.connectionManager,
      this.predictiveAnalytics
    );
    this.hardwareEventHandler = new HardwareEventHandler(
      this.connectionManager
    );
    this.mlEventHandler = new MLEventHandler(
      this.connectionManager,
      this.machineLearning
    );
    this.reportingEventHandler = new ReportingEventHandler(
      this.connectionManager,
      this.advancedReporting
    );

    // Configurar manejadores de conexión
    this.setupConnectionHandlers();

    // Inicializar tareas periódicas
    this.initializePeriodicTasks();

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
      this.mlEventHandler.setupEventHandlers(socket);
      this.reportingEventHandler.setupEventHandlers(socket);

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

  private initializePeriodicTasks(): void {
    // Limpiar datos antiguos cada hora
    setInterval(() => {
      this.predictiveAnalytics.cleanOldData(24);
    }, 60 * 60 * 1000);

    // Análisis predictivo cada 30 minutos
    setInterval(() => {
      this.runPredictiveAnalysis();
    }, 30 * 60 * 1000);

    // Optimización de modelos ML cada 6 horas
    setInterval(() => {
      this.mlEventHandler.optimizeModels();
    }, 6 * 60 * 60 * 1000);

    logger.info("Tareas periódicas inicializadas", "WebSocketManager");
  }

  private runPredictiveAnalysis(): void {
    // Esta función se ejecutaría con datos reales de dispositivos
    logger.debug(
      "Ejecutando análisis predictivo periódico",
      "WebSocketManager"
    );

    // En una implementación real, aquí se obtendrían los dispositivos activos
    // y se ejecutaría el análisis predictivo para cada uno
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

  // Métodos para acceso a servicios de análisis
  public getPredictiveAnalytics(): PredictiveAnalytics {
    return this.predictiveAnalytics;
  }

  public getMachineLearning(): MachineLearning {
    return this.machineLearning;
  }

  public getAdvancedReporting(): AdvancedReporting {
    return this.advancedReporting;
  }

  // Métodos faltantes para compatibilidad con rutas
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

  public getPrediction(deviceId: string, type: string): any {
    // Implementación básica - usar método existente
    return { deviceId, type, prediction: "basic" };
  }

  public getEfficiencyMetrics(deviceId: string): any {
    return this.predictiveAnalytics.calculateEfficiencyMetrics(deviceId);
  }

  public detectDeviceAnomalies(deviceId: string, type: string): boolean {
    return this.predictiveAnalytics.detectAnomalies(deviceId, type);
  }

  public getAnalyticsStats(): any {
    return this.predictiveAnalytics.getHistoryStats();
  }

  public triggerPredictiveAnalysis(): void {
    // Implementación básica
    console.log("Predictive analysis triggered");
  }

  public async trainModels(deviceId: string, dataType: string): Promise<void> {
    // Implementación básica
    console.log(`Training models for ${deviceId} - ${dataType}`);
  }

  public async generateAdvancedForecast(config: any): Promise<any> {
    // Implementación básica
    return { forecast: "basic_forecast", config };
  }

  public async analyzeDevicePatterns(deviceId: string): Promise<any> {
    // Implementación básica
    return { patterns: [], deviceId };
  }

  public async optimizeMLModels(): Promise<void> {
    // Implementación básica
    console.log("ML models optimized");
  }

  public getMLStats(): any {
    return { models: 0, accuracy: 0 };
  }

  public async generateComprehensiveReport(config: any): Promise<any> {
    return {
      deviceReports: [],
      charts: [],
      summary: "Basic report",
      config,
    };
  }

  public configureAutomaticReport(config: any): void {
    console.log("Automatic report configured", config);
  }

  public getGeneratedReports(): any[] {
    return [];
  }

  public getReportConfigs(): any[] {
    return [];
  }
}
