import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import { PredictiveAnalytics, DataPoint } from "./PredictiveAnalytics";
import {
  UserSocket,
  DeviceConnectionData,
  VoltageReadingData,
  CurrentReadingData,
  PowerConsumptionData,
  DeviceReconnectionData,
  AlertData,
  PowerOutageAlertData,
  VoltageAnomalyAlertData,
  SwitchStateData,
  EmergencyStopData,
  AlertSeverity,
} from "../types/websocket";

export class IoTEventHandler {
  private connectionManager: ConnectionManager;
  private predictiveAnalytics: PredictiveAnalytics;

  constructor(
    connectionManager: ConnectionManager,
    predictiveAnalytics: PredictiveAnalytics
  ) {
    this.connectionManager = connectionManager;
    this.predictiveAnalytics = predictiveAnalytics;
  }

  // Configurar event handlers para un socket
  setupEventHandlers(socket: UserSocket): void {
    // Eventos de conexión de dispositivos
    socket.on("device:connection_status", (data: DeviceConnectionData) => {
      this.handleDeviceConnection(socket, data);
    });

    // Eventos de lecturas eléctricas
    socket.on("device:voltage_reading", (data: VoltageReadingData) => {
      this.handleVoltageReading(socket, data);
    });

    socket.on("device:current_reading", (data: CurrentReadingData) => {
      this.handleCurrentReading(socket, data);
    });

    socket.on("device:power_consumption", (data: PowerConsumptionData) => {
      this.handlePowerConsumption(socket, data);
    });

    socket.on("device:reconnection", (data: DeviceReconnectionData) => {
      this.handleDeviceReconnection(socket, data);
    });

    // Eventos de alertas
    socket.on("alert:power_outage", (data: PowerOutageAlertData) => {
      this.handlePowerOutageAlert(socket, data);
    });

    socket.on("alert:voltage_anomaly", (data: VoltageAnomalyAlertData) => {
      this.handleVoltageAnomalyAlert(socket, data);
    });

    // Eventos de control
    socket.on("control:switch_state", (data: SwitchStateData) => {
      this.handleSwitchState(socket, data);
    });

    socket.on("control:emergency_stop", (data: EmergencyStopData) => {
      this.handleEmergencyStop(socket, data);
    });

    // Eventos genéricos (compatibilidad)
    socket.on("iot:data", (data: Record<string, unknown>) => {
      this.handleGenericIoTData(socket, data);
    });

    socket.on("iot:alert", (alert: Record<string, unknown>) => {
      this.handleGenericIoTAlert(socket, alert);
    });
  }

  // Manejar estado de conexión de dispositivo
  private handleDeviceConnection(
    socket: UserSocket,
    data: DeviceConnectionData
  ): void {
    logger.info(
      `Estado de conexión de dispositivo: ${data.deviceId}`,
      "IoTEventHandler",
      {
        status: data.status,
        userId: socket.userId,
      }
    );

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "device:status_update", {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.connectionManager.sendToType("empresa", "device:status_update", {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Crear alerta si el dispositivo se desconecta
    if (data.status === "disconnected") {
      this.createAutoAlert({
        type: "warning",
        title: "Dispositivo Desconectado",
        message: `El dispositivo ${data.deviceId} se ha desconectado`,
        deviceId: data.deviceId,
        severity: "medium",
        source: "IoT Connection Monitor",
      });
    }
  }

  // Manejar lectura de voltaje
  private handleVoltageReading(
    socket: UserSocket,
    data: VoltageReadingData
  ): void {
    logger.debug(`Lectura de voltaje: ${data.deviceId}`, "IoTEventHandler", {
      voltage: data.voltage,
      quality: data.quality,
    });

    // Agregar a análisis predictivo
    const dataPoint: DataPoint = {
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      type: "voltage",
      value: data.voltage,
    };
    this.predictiveAnalytics.addDataPoint(dataPoint);

    // Verificar umbrales
    this.checkVoltageThresholds(data, socket.userId);

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "iot:voltage_update", data);
    this.connectionManager.sendToType("empresa", "iot:voltage_update", data);
  }

  // Manejar lectura de corriente
  private handleCurrentReading(
    socket: UserSocket,
    data: CurrentReadingData
  ): void {
    logger.debug(`Lectura de corriente: ${data.deviceId}`, "IoTEventHandler", {
      current: data.current,
      powerFactor: data.powerFactor,
    });

    // Agregar a análisis predictivo
    const dataPoint: DataPoint = {
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      type: "current",
      value: data.current,
    };
    this.predictiveAnalytics.addDataPoint(dataPoint);

    // Verificar umbrales
    this.checkCurrentThresholds(data, socket.userId);

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "iot:current_update", data);
    this.connectionManager.sendToType("empresa", "iot:current_update", data);
  }

  // Manejar consumo de energía
  private handlePowerConsumption(
    socket: UserSocket,
    data: PowerConsumptionData
  ): void {
    logger.debug(`Consumo de energía: ${data.deviceId}`, "IoTEventHandler", {
      activePower: data.activePower,
      energy: data.energy,
    });

    // Agregar a análisis predictivo
    const dataPoint: DataPoint = {
      deviceId: data.deviceId,
      timestamp: data.timestamp,
      type: "power",
      value: data.activePower,
    };
    this.predictiveAnalytics.addDataPoint(dataPoint);

    // Verificar umbrales de potencia
    this.checkPowerThresholds(data, socket.userId);

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "iot:power_update", data);
    this.connectionManager.sendToType("empresa", "iot:power_update", data);
  }

  // Manejar reconexión de dispositivo
  private handleDeviceReconnection(
    socket: UserSocket,
    data: DeviceReconnectionData
  ): void {
    logger.info(
      `Reconexión de dispositivo: ${data.deviceId}`,
      "IoTEventHandler",
      {
        success: data.success,
        attempts: data.attempts,
        reconnectionTime: data.reconnectionTime,
      }
    );

    // Crear alerta de reconexión
    this.createAutoAlert({
      type: data.success ? "success" : "error",
      title: data.success ? "Dispositivo Reconectado" : "Fallo en Reconexión",
      message: `Dispositivo ${data.deviceId} ${
        data.success ? "reconectado exitosamente" : "falló al reconectar"
      } después de ${data.attempts} intentos`,
      deviceId: data.deviceId,
      severity: data.success ? "low" : "high",
      source: "IoT Reconnection Monitor",
    });

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole(
      "admin",
      "device:reconnection_update",
      data
    );
    this.connectionManager.sendToType(
      "empresa",
      "device:reconnection_update",
      data
    );
  }

  // Manejar alerta de corte de suministro
  private handlePowerOutageAlert(
    socket: UserSocket,
    data: PowerOutageAlertData
  ): void {
    logger.warn(
      `Alerta de corte de suministro: ${data.deviceId}`,
      "IoTEventHandler",
      {
        location: data.location,
        affectedDevices: data.affectedDevices?.length || 0,
      }
    );

    // Crear alerta crítica
    this.createAutoAlert({
      type: "error",
      title: "Corte de Suministro Eléctrico",
      message: `Corte de suministro detectado en ${
        data.location
      }. Dispositivos afectados: ${data.affectedDevices?.length || 1}`,
      deviceId: data.deviceId,
      severity: "critical",
      source: "Power Outage Monitor",
    });

    // Broadcast inmediato a todos los usuarios relevantes
    this.connectionManager.broadcastToAll("alert:power_outage", data);
  }

  // Manejar alerta de anomalía de voltaje
  private handleVoltageAnomalyAlert(
    socket: UserSocket,
    data: VoltageAnomalyAlertData
  ): void {
    logger.warn(`Anomalía de voltaje: ${data.deviceId}`, "IoTEventHandler", {
      currentVoltage: data.currentVoltage,
      expectedVoltage: data.expectedVoltage,
      deviation: data.deviation,
    });

    // Determinar severidad basada en la desviación
    let severity: AlertSeverity = "low";
    if (data.deviation > 30) severity = "critical";
    else if (data.deviation > 15) severity = "high";
    else if (data.deviation > 5) severity = "medium";

    this.createAutoAlert({
      type: "warning",
      title: "Anomalía de Voltaje",
      message: `Voltaje anómalo en dispositivo ${data.deviceId}: ${data.currentVoltage}V (esperado: ${data.expectedVoltage}V, desviación: ${data.deviation}V)`,
      deviceId: data.deviceId,
      severity,
      source: "Voltage Anomaly Detector",
    });

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "alert:voltage_anomaly", data);
    this.connectionManager.sendToType("empresa", "alert:voltage_anomaly", data);
  }

  // Manejar estado de interruptor
  private handleSwitchState(socket: UserSocket, data: SwitchStateData): void {
    logger.info(`Estado de interruptor: ${data.deviceId}`, "IoTEventHandler", {
      switchId: data.switchId,
      state: data.state,
      controlledBy: data.controlledBy,
    });

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "control:switch_update", data);
    this.connectionManager.sendToType("empresa", "control:switch_update", data);
  }

  // Manejar parada de emergencia
  private handleEmergencyStop(
    socket: UserSocket,
    data: EmergencyStopData
  ): void {
    logger.error(`Parada de emergencia: ${data.deviceId}`, "IoTEventHandler", {
      reason: data.reason,
      triggeredBy: data.triggeredBy,
      affectedSystems: data.affectedSystems,
    });

    // Crear alerta crítica
    this.createAutoAlert({
      type: "error",
      title: "Parada de Emergencia Activada",
      message: `Parada de emergencia en dispositivo ${data.deviceId}. Razón: ${
        data.reason
      }. Sistemas afectados: ${data.affectedSystems.join(", ")}`,
      deviceId: data.deviceId,
      severity: "critical",
      source: "Emergency Stop System",
    });

    // Broadcast inmediato a todos
    this.connectionManager.broadcastToAll("alert:emergency_stop", data);
  }

  // Manejar datos IoT genéricos (compatibilidad)
  private handleGenericIoTData(
    socket: UserSocket,
    data: Record<string, unknown>
  ): void {
    logger.info(
      `Datos IoT genéricos de ${socket.userId}`,
      "IoTEventHandler",
      data
    );

    // Broadcast a administradores
    this.connectionManager.sendToRole("admin", "iot:data_update", {
      ...data,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Manejar alertas IoT genéricas (compatibilidad)
  private handleGenericIoTAlert(
    socket: UserSocket,
    alert: Record<string, unknown>
  ): void {
    logger.warn(`Alerta IoT de ${socket.userId}`, "IoTEventHandler", alert);

    // Broadcast a usuarios relevantes
    this.connectionManager.sendToRole("admin", "iot:alert_received", {
      ...alert,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Crear alerta automática
  private createAutoAlert(alertData: AlertData): void {
    const alert = {
      id: `alert_${Date.now()}`,
      ...alertData,
      timestamp: new Date().toISOString(),
      autoGenerated: true,
    };

    // Enviar según severidad
    if (alertData.severity === "critical") {
      this.connectionManager.broadcastToAll("alert:critical", alert);
    } else {
      this.connectionManager.sendToRole("admin", "alert:new", alert);
      this.connectionManager.sendToType("empresa", "alert:new", alert);
    }

    logger.info(
      `Alerta automática creada: ${alertData.title}`,
      "IoTEventHandler",
      {
        deviceId: alertData.deviceId,
        severity: alertData.severity,
      }
    );
  }

  // Verificar umbrales de voltaje
  private checkVoltageThresholds(
    data: VoltageReadingData,
    source?: string
  ): void {
    const VOLTAGE_THRESHOLDS = {
      min: 200,
      max: 250,
      nominal: 220,
    };

    if (
      data.voltage < VOLTAGE_THRESHOLDS.min ||
      data.voltage > VOLTAGE_THRESHOLDS.max
    ) {
      const deviation = Math.abs(data.voltage - VOLTAGE_THRESHOLDS.nominal);
      const severity: AlertSeverity =
        deviation > 30 ? "critical" : deviation > 15 ? "high" : "medium";

      this.createAutoAlert({
        type: "error",
        title: "Voltaje Fuera de Rango",
        message: `Dispositivo ${data.deviceId}: ${data.voltage}V (Rango: ${VOLTAGE_THRESHOLDS.min}-${VOLTAGE_THRESHOLDS.max}V)`,
        deviceId: data.deviceId,
        severity,
        source: source || "Voltage Monitor",
      });
    }
  }

  // Verificar umbrales de corriente
  private checkCurrentThresholds(
    data: CurrentReadingData,
    source?: string
  ): void {
    const CURRENT_THRESHOLDS = {
      max: 50,
      warning: 40,
    };

    if (data.current > CURRENT_THRESHOLDS.max) {
      this.createAutoAlert({
        type: "error",
        title: "Sobrecorriente Detectada",
        message: `Dispositivo ${data.deviceId}: ${data.current}A (Máximo: ${CURRENT_THRESHOLDS.max}A)`,
        deviceId: data.deviceId,
        severity: "critical",
        source: source || "Current Monitor",
      });
    } else if (data.current > CURRENT_THRESHOLDS.warning) {
      this.createAutoAlert({
        type: "warning",
        title: "Corriente Elevada",
        message: `Dispositivo ${data.deviceId}: ${data.current}A (Advertencia: ${CURRENT_THRESHOLDS.warning}A)`,
        deviceId: data.deviceId,
        severity: "medium",
        source: source || "Current Monitor",
      });
    }
  }

  // Verificar umbrales de potencia
  private checkPowerThresholds(
    data: PowerConsumptionData,
    source?: string
  ): void {
    const POWER_THRESHOLDS = {
      max: 5000,
      warning: 4000,
    };

    if (data.activePower > POWER_THRESHOLDS.max) {
      this.createAutoAlert({
        type: "error",
        title: "Consumo Excesivo de Energía",
        message: `Dispositivo ${data.deviceId}: ${data.activePower}W (Máximo: ${POWER_THRESHOLDS.max}W)`,
        deviceId: data.deviceId,
        severity: "high",
        source: source || "Power Monitor",
      });
    } else if (data.activePower > POWER_THRESHOLDS.warning) {
      this.createAutoAlert({
        type: "warning",
        title: "Consumo Elevado de Energía",
        message: `Dispositivo ${data.deviceId}: ${data.activePower}W (Advertencia: ${POWER_THRESHOLDS.warning}W)`,
        deviceId: data.deviceId,
        severity: "medium",
        source: source || "Power Monitor",
      });
    }
  }
}
