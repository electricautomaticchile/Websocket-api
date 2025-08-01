import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import {
  UserSocket,
  ArduinoCommandData,
  CommandResultData,
  SensorReadingData,
  RelayControlData,
  DeviceConfigurationData,
  PerformanceMetricsData,
} from "../types/websocket";

export class HardwareEventHandler {
  private connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  setupEventHandlers(socket: UserSocket): void {
    // Comandos Arduino
    socket.on("hardware:arduino_command", (data: ArduinoCommandData) => {
      this.handleArduinoCommand(socket, data);
    });

    // Resultados de comandos
    socket.on("hardware:command_result", (data: CommandResultData) => {
      this.handleCommandResult(socket, data);
    });

    // Lecturas de sensores
    socket.on("hardware:sensor_reading", (data: SensorReadingData) => {
      this.handleSensorReading(socket, data);
    });

    // Control de relés
    socket.on("hardware:relay_control", (data: RelayControlData) => {
      this.handleRelayControl(socket, data);
    });

    // Configuración de dispositivos
    socket.on("hardware:configure", (data: DeviceConfigurationData) => {
      this.handleDeviceConfiguration(socket, data);
    });

    // Métricas de rendimiento
    socket.on(
      "hardware:performance_metrics",
      (data: PerformanceMetricsData) => {
        this.handlePerformanceMetrics(socket, data);
      }
    );
  }

  private handleArduinoCommand(
    socket: UserSocket,
    data: ArduinoCommandData
  ): void {
    logger.info(`Comando Arduino: ${data.command}`, "HardwareEventHandler", {
      deviceId: data.deviceId,
      target: data.target,
      userId: socket.userId,
    });

    // Broadcast a dispositivos y administradores
    this.connectionManager.sendToRole("admin", "hardware:command_sent", {
      ...data,
      sentBy: socket.userId,
      timestamp: new Date().toISOString(),
    });

    // Enviar comando al dispositivo específico si está conectado
    this.connectionManager.sendToRoom(
      `device:${data.deviceId}`,
      "hardware:execute_command",
      data
    );
  }

  private handleCommandResult(
    socket: UserSocket,
    data: CommandResultData
  ): void {
    logger.info(
      `Resultado de comando: ${data.commandId}`,
      "HardwareEventHandler",
      {
        deviceId: data.deviceId,
        success: data.success,
        executionTime: data.executionTime,
      }
    );

    // Broadcast resultado a administradores
    this.connectionManager.sendToRole(
      "admin",
      "hardware:command_completed",
      data
    );
    this.connectionManager.sendToType(
      "empresa",
      "hardware:command_completed",
      data
    );
  }

  private handleSensorReading(
    socket: UserSocket,
    data: SensorReadingData
  ): void {
    logger.debug(
      `Lectura de sensor: ${data.sensorType}`,
      "HardwareEventHandler",
      {
        deviceId: data.deviceId,
        value: data.value,
        unit: data.unit,
      }
    );

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "hardware:sensor_update", data);
    this.connectionManager.sendToType(
      "empresa",
      "hardware:sensor_update",
      data
    );
  }

  private handleRelayControl(socket: UserSocket, data: RelayControlData): void {
    logger.info(`Control de relé: ${data.action}`, "HardwareEventHandler", {
      deviceId: data.deviceId,
      relayId: data.relayId,
      priority: data.priority,
    });

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "hardware:relay_update", data);
    this.connectionManager.sendToType("empresa", "hardware:relay_update", data);
  }

  private handleDeviceConfiguration(
    socket: UserSocket,
    data: DeviceConfigurationData
  ): void {
    logger.info(
      `Configuración de dispositivo: ${data.configType}`,
      "HardwareEventHandler",
      {
        deviceId: data.deviceId,
        applyImmediately: data.applyImmediately,
      }
    );

    // Broadcast a administradores
    this.connectionManager.sendToRole("admin", "hardware:config_update", data);
  }

  private handlePerformanceMetrics(
    socket: UserSocket,
    data: PerformanceMetricsData
  ): void {
    logger.debug(
      `Métricas de rendimiento: ${data.deviceId}`,
      "HardwareEventHandler",
      {
        cpuUsage: data.cpuUsage,
        memoryUsage: data.memoryUsage,
        temperature: data.temperature,
        uptime: data.uptime,
      }
    );

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "hardware:metrics_update", data);
    this.connectionManager.sendToType(
      "empresa",
      "hardware:metrics_update",
      data
    );
  }
}
