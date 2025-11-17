import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import { PermissionFilter } from "./PermissionFilter";
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
    // Verificar permisos antes de ejecutar el comando
    if (
      !PermissionFilter.canExecuteCommand(socket, data.command, data.deviceId)
    ) {
      logger.warn(
        `Comando ${data.command} denegado para usuario ${socket.userId}`,
        "HardwareEventHandler"
      );
      socket.emit("hardware:comando_denegado", {
        commandId: `cmd_${Date.now()}`,
        reason: "Permisos insuficientes",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Comando Arduino: ${data.command}`, "HardwareEventHandler", {
      deviceId: data.deviceId,
      target: data.target,
      userId: socket.userId,
    });

    const commandData = {
      ...data,
      sentBy: socket.userId,
      userRole: socket.userRole,
      timestamp: new Date().toISOString(),
    };

    // Broadcast a usuarios autorizados
    this.connectionManager.sendToAuthorizedUsers(
      "hardware:comando_enviado",
      commandData,
      data.deviceId
    );

    // Enviar comando al dispositivo específico si está conectado
    this.connectionManager.sendToRoom(
      `device:${data.deviceId}`,
      "hardware:execute_command",
      commandData
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

    // Enviar resultado usando el sistema de permisos
    this.connectionManager.sendCommandResult({
      ...data,
      executedBy: socket.userId,
      userRole: socket.userRole,
    });
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

    // Broadcast a usuarios autorizados
    this.connectionManager.sendToAuthorizedUsers(
      "hardware:actualizacion_sensor",
      data,
      data.deviceId
    );
  }

  private handleRelayControl(socket: UserSocket, data: RelayControlData): void {
    // Verificar permisos para control de relé
    if (
      !PermissionFilter.canExecuteCommand(socket, data.action, data.deviceId)
    ) {
      logger.warn(
        `Control de relé ${data.action} denegado para usuario ${socket.userId}`,
        "HardwareEventHandler"
      );
      socket.emit("hardware:rele_denegado", {
        relayId: data.relayId,
        reason: "Permisos insuficientes",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Control de relé: ${data.action}`, "HardwareEventHandler", {
      deviceId: data.deviceId,
      relayId: data.relayId,
      priority: data.priority,
    });

    // Broadcast a usuarios autorizados
    this.connectionManager.sendToAuthorizedUsers(
      "hardware:actualizacion_rele",
      {
        ...data,
        controlledBy: socket.userId,
        userRole: socket.userRole,
      },
      data.deviceId
    );
  }

  private handleDeviceConfiguration(
    socket: UserSocket,
    data: DeviceConfigurationData
  ): void {
    // Solo superadmin puede configurar dispositivos
    if (socket.userRole !== "superadmin") {
      logger.warn(
        `Configuración de dispositivo denegada para usuario ${socket.userId}`,
        "HardwareEventHandler"
      );
      socket.emit("hardware:config_denegada", {
        deviceId: data.deviceId,
        reason: "Solo superadmin puede configurar dispositivos",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(
      `Configuración de dispositivo: ${data.configType}`,
      "HardwareEventHandler",
      {
        deviceId: data.deviceId,
        applyImmediately: data.applyImmediately,
      }
    );

    // Broadcast solo a superadmin (configuraciones sensibles)
    this.connectionManager.sendToRole("superadmin", "hardware:actualizacion_config", {
      ...data,
      configuredBy: socket.userId,
    });
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

    // Filtrar métricas según el rol del usuario
    const filteredData = this.filterMetricsByRole(socket, data);

    // Broadcast a usuarios autorizados
    this.connectionManager.sendToAuthorizedUsers(
      "hardware:actualizacion_metricas",
      filteredData,
      data.deviceId
    );
  }

  // Filtrar métricas según el rol del usuario
  private filterMetricsByRole(
    socket: UserSocket,
    data: PerformanceMetricsData
  ): any {
    const { userRole } = socket;

    switch (userRole) {
      case "superadmin":
        return data; // Acceso completo a todas las métricas

      case "empresa":
        // Empresa ve métricas básicas sin detalles sensibles
        return {
          deviceId: data.deviceId,
          cpuUsage: data.cpuUsage,
          memoryUsage: data.memoryUsage,
          temperature: data.temperature,
          uptime: data.uptime,
          timestamp: data.timestamp,
          // Omitir métricas sensibles como networkLatency, errorCount
        };

      case "cliente":
        // Cliente ve solo métricas básicas de estado
        return {
          deviceId: data.deviceId,
          temperature: data.temperature,
          uptime: data.uptime,
          timestamp: data.timestamp,
          status: data.cpuUsage && data.cpuUsage < 80 ? "normal" : "high_load",
        };

      default:
        return null;
    }
  }
}
