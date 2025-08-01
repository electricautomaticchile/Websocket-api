import { Express } from "express";
import { WebSocketManager } from "../services/WebSocketManager";
import { logger } from "../utils/logger";

export function setupRoutes(app: Express, wsManager: WebSocketManager) {
  // Ruta para enviar notificaciones via HTTP (para integración con API principal)
  app.post("/api/notify", (req, res) => {
    try {
      const { targetUserId, targetRole, event, data } = req.body;

      if (!event || !data) {
        return res.status(400).json({
          success: false,
          message: "Event y data son requeridos",
        });
      }

      if (targetUserId) {
        wsManager.sendToUser(targetUserId, event, data);
        logger.info(`📤 Notificación HTTP enviada a usuario ${targetUserId}`);
      } else if (targetRole) {
        wsManager.sendToRole(targetRole, event, data);
        logger.info(`📤 Notificación HTTP enviada a rol ${targetRole}`);
      } else {
        wsManager.broadcastToAll(event, data);
        logger.info(`📤 Notificación HTTP broadcast a todos`);
      }

      res.json({
        success: true,
        message: "Notificación enviada",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando notificación:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Ruta para obtener estadísticas de conexiones
  app.get("/api/stats", (req, res) => {
    res.json({
      success: true,
      data: {
        totalConnections: wsManager.getConnectionCount(),
        connectedUsers: wsManager.getConnectedUsers(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Ruta para verificar si un usuario está conectado
  app.get("/api/user/:userId/status", (req, res) => {
    const { userId } = req.params;
    const isConnected = wsManager.isUserConnected(userId);

    res.json({
      success: true,
      data: {
        userId,
        isConnected,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // === RUTAS ESPECÍFICAS PARA IoT ELÉCTRICO ===

  // Ruta para recibir lecturas de voltaje
  app.post("/api/iot/voltage", (req, res) => {
    try {
      const { deviceId, voltage, phase, quality, location } = req.body;

      if (!deviceId || voltage === undefined) {
        return res.status(400).json({
          success: false,
          message: "deviceId y voltage son requeridos",
        });
      }

      // Enviar evento de voltaje via WebSocket
      wsManager.sendToRole("admin", "device:voltage_update", {
        deviceId,
        voltage,
        phase,
        quality: quality || "good",
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "voltage_reading",
      });

      wsManager.sendToRole("empresa", "device:voltage_update", {
        deviceId,
        voltage,
        phase,
        quality: quality || "good",
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "voltage_reading",
      });

      logger.info(`⚡ Lectura de voltaje externa - ${deviceId}: ${voltage}V`);

      res.json({
        success: true,
        message: "Lectura de voltaje procesada",
        deviceId,
        voltage,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando lectura de voltaje:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando lectura de voltaje",
      });
    }
  });

  // Ruta para recibir lecturas de corriente
  app.post("/api/iot/current", (req, res) => {
    try {
      const { deviceId, current, phase, powerFactor, location } = req.body;

      if (!deviceId || current === undefined) {
        return res.status(400).json({
          success: false,
          message: "deviceId y current son requeridos",
        });
      }

      // Enviar evento de corriente via WebSocket
      wsManager.sendToRole("admin", "device:current_update", {
        deviceId,
        current,
        phase,
        powerFactor,
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "current_reading",
      });

      wsManager.sendToRole("empresa", "device:current_update", {
        deviceId,
        current,
        phase,
        powerFactor,
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "current_reading",
      });

      logger.info(`🔋 Lectura de corriente externa - ${deviceId}: ${current}A`);

      res.json({
        success: true,
        message: "Lectura de corriente procesada",
        deviceId,
        current,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando lectura de corriente:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando lectura de corriente",
      });
    }
  });

  // Ruta para recibir datos de consumo de energía
  app.post("/api/iot/power", (req, res) => {
    try {
      const {
        deviceId,
        activePower,
        reactivePower,
        apparentPower,
        energy,
        cost,
        location,
      } = req.body;

      if (!deviceId || activePower === undefined || energy === undefined) {
        return res.status(400).json({
          success: false,
          message: "deviceId, activePower y energy son requeridos",
        });
      }

      // Enviar evento de consumo via WebSocket
      wsManager.sendToRole("admin", "device:power_update", {
        deviceId,
        activePower,
        reactivePower,
        apparentPower,
        energy,
        cost,
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "power_consumption",
      });

      wsManager.sendToRole("empresa", "device:power_update", {
        deviceId,
        activePower,
        reactivePower,
        apparentPower,
        energy,
        cost,
        location,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "power_consumption",
      });

      logger.info(
        `📊 Consumo de energía externo - ${deviceId}: ${activePower}W, ${energy}kWh`
      );

      res.json({
        success: true,
        message: "Datos de consumo procesados",
        deviceId,
        activePower,
        energy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando datos de consumo:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando datos de consumo",
      });
    }
  });

  // Ruta para reportar estado de conexión de dispositivos
  app.post("/api/iot/connection", (req, res) => {
    try {
      const { deviceId, status, lastSeen, metadata } = req.body;

      if (!deviceId || !status) {
        return res.status(400).json({
          success: false,
          message: "deviceId y status son requeridos",
        });
      }

      if (!["connected", "disconnected", "reconnecting"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "status debe ser: connected, disconnected o reconnecting",
        });
      }

      // Enviar evento de conexión via WebSocket
      wsManager.sendToRole("admin", "device:connection_update", {
        deviceId,
        status,
        lastSeen: lastSeen ? new Date(lastSeen) : new Date(),
        metadata,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "connection_status",
      });

      wsManager.sendToRole("empresa", "device:connection_update", {
        deviceId,
        status,
        lastSeen: lastSeen ? new Date(lastSeen) : new Date(),
        metadata,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "connection_status",
      });

      logger.info(`🔌 Estado de conexión externo - ${deviceId}: ${status}`);

      res.json({
        success: true,
        message: "Estado de conexión actualizado",
        deviceId,
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error actualizando estado de conexión:", error);
      res.status(500).json({
        success: false,
        message: "Error actualizando estado de conexión",
      });
    }
  });

  // === RUTAS PARA CONTROL HARDWARE ===

  // Ruta para comandos Arduino
  app.post("/api/hardware/arduino", (req, res) => {
    try {
      const { deviceId, command, target, parameters } = req.body;

      if (!deviceId || !command) {
        return res.status(400).json({
          success: false,
          message: "deviceId y command son requeridos",
        });
      }

      if (!["on", "off", "toggle", "status", "reset"].includes(command)) {
        return res.status(400).json({
          success: false,
          message: "command debe ser: on, off, toggle, status o reset",
        });
      }

      // Enviar comando Arduino via WebSocket
      const commandId = wsManager.sendArduinoCommand(
        deviceId,
        command,
        target,
        parameters
      );

      logger.info(`🎛️ Comando Arduino externo - ${deviceId}: ${command}`);

      res.json({
        success: true,
        message: "Comando Arduino enviado",
        deviceId,
        command,
        commandId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando comando Arduino:", error);
      res.status(500).json({
        success: false,
        message: "Error enviando comando Arduino",
      });
    }
  });

  // Ruta para control de relés
  app.post("/api/hardware/relay", (req, res) => {
    try {
      const { deviceId, relayId, action, duration, priority } = req.body;

      if (!deviceId || !relayId || !action) {
        return res.status(400).json({
          success: false,
          message: "deviceId, relayId y action son requeridos",
        });
      }

      if (!["activate", "deactivate", "pulse", "schedule"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "action debe ser: activate, deactivate, pulse o schedule",
        });
      }

      // Enviar comando de relé via WebSocket
      const commandId = wsManager.controlRelay(
        deviceId,
        relayId,
        action,
        priority || "normal"
      );

      logger.info(
        `🔌 Control relé externo - ${deviceId}/${relayId}: ${action}`
      );

      res.json({
        success: true,
        message: "Comando de relé enviado",
        deviceId,
        relayId,
        action,
        commandId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando comando de relé:", error);
      res.status(500).json({
        success: false,
        message: "Error enviando comando de relé",
      });
    }
  });

  // Ruta para lecturas de sensores
  app.post("/api/hardware/sensor", (req, res) => {
    try {
      const { deviceId, sensorType, value, unit, location, calibrated } =
        req.body;

      if (!deviceId || !sensorType || value === undefined || !unit) {
        return res.status(400).json({
          success: false,
          message: "deviceId, sensorType, value y unit son requeridos",
        });
      }

      const validSensorTypes = [
        "temperature",
        "humidity",
        "pressure",
        "motion",
        "light",
        "custom",
      ];
      if (!validSensorTypes.includes(sensorType)) {
        return res.status(400).json({
          success: false,
          message: `sensorType debe ser uno de: ${validSensorTypes.join(", ")}`,
        });
      }

      // Enviar lectura de sensor via WebSocket
      wsManager.sendToRole("admin", "hardware:sensor_update", {
        deviceId,
        sensorType,
        value,
        unit,
        location,
        calibrated: calibrated !== false,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "sensor_reading",
      });

      wsManager.sendToRole("empresa", "hardware:sensor_update", {
        deviceId,
        sensorType,
        value,
        unit,
        location,
        calibrated: calibrated !== false,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "sensor_reading",
      });

      logger.info(
        `🌡️ Lectura sensor externa - ${deviceId}/${sensorType}: ${value}${unit}`
      );

      res.json({
        success: true,
        message: "Lectura de sensor procesada",
        deviceId,
        sensorType,
        value,
        unit,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando lectura de sensor:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando lectura de sensor",
      });
    }
  });

  // Ruta para métricas de performance
  app.post("/api/hardware/metrics", (req, res) => {
    try {
      const {
        deviceId,
        cpuUsage,
        memoryUsage,
        temperature,
        uptime,
        networkLatency,
        errorCount,
      } = req.body;

      if (!deviceId || uptime === undefined) {
        return res.status(400).json({
          success: false,
          message: "deviceId y uptime son requeridos",
        });
      }

      // Enviar métricas via WebSocket
      wsManager.sendToRole("admin", "hardware:metrics_update", {
        deviceId,
        cpuUsage,
        memoryUsage,
        temperature,
        uptime,
        networkLatency,
        errorCount,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "performance_metrics",
      });

      wsManager.sendToRole("empresa", "hardware:metrics_update", {
        deviceId,
        cpuUsage,
        memoryUsage,
        temperature,
        uptime,
        networkLatency,
        errorCount,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "performance_metrics",
      });

      logger.info(
        `📊 Métricas performance externas - ${deviceId}: CPU ${cpuUsage}%, Temp ${temperature}°C`
      );

      res.json({
        success: true,
        message: "Métricas de performance procesadas",
        deviceId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando métricas de performance:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando métricas de performance",
      });
    }
  });

  // Ruta para configuración de dispositivos
  app.post("/api/hardware/config", (req, res) => {
    try {
      const { deviceId, configType, configuration, applyImmediately } =
        req.body;

      if (!deviceId || !configType || !configuration) {
        return res.status(400).json({
          success: false,
          message: "deviceId, configType y configuration son requeridos",
        });
      }

      const validConfigTypes = [
        "thresholds",
        "intervals",
        "calibration",
        "network",
        "security",
      ];
      if (!validConfigTypes.includes(configType)) {
        return res.status(400).json({
          success: false,
          message: `configType debe ser uno de: ${validConfigTypes.join(", ")}`,
        });
      }

      // Enviar configuración via WebSocket
      const configId = wsManager.updateDeviceConfig(
        deviceId,
        configType,
        configuration
      );

      logger.info(
        `⚙️ Configuración dispositivo externa - ${deviceId}: ${configType}`
      );

      res.json({
        success: true,
        message: "Configuración de dispositivo enviada",
        deviceId,
        configType,
        configId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando configuración:", error);
      res.status(500).json({
        success: false,
        message: "Error enviando configuración",
      });
    }
  });

  // Ruta para control remoto de dispositivos (mantener compatibilidad)
  app.post("/api/iot/control", (req, res) => {
    try {
      const { deviceId, switchId, action, reason } = req.body;

      if (!deviceId || !action) {
        return res.status(400).json({
          success: false,
          message: "deviceId y action son requeridos",
        });
      }

      if (!["on", "off", "toggle", "auto", "reset"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "action debe ser: on, off, toggle, auto o reset",
        });
      }

      // Enviar comando de control via WebSocket
      wsManager.sendToRole("admin", "control:switch_update", {
        deviceId,
        switchId: switchId || "main",
        state: action === "toggle" ? "auto" : (action as any),
        controlledBy: "external_api",
        reason,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "switch_state",
      });

      wsManager.sendToRole("empresa", "control:switch_update", {
        deviceId,
        switchId: switchId || "main",
        state: action === "toggle" ? "auto" : (action as any),
        controlledBy: "external_api",
        reason,
        timestamp: new Date().toISOString(),
        source: "external_api",
        eventType: "switch_state",
      });

      logger.info(`🎛️ Comando de control externo - ${deviceId}: ${action}`);

      res.json({
        success: true,
        message: "Comando de control enviado",
        deviceId,
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando comando de control:", error);
      res.status(500).json({
        success: false,
        message: "Error enviando comando de control",
      });
    }
  });

  // Ruta genérica para datos IoT (mantener compatibilidad)
  app.post("/api/iot/data", (req, res) => {
    try {
      const iotData = req.body;

      // Validar datos básicos
      if (!iotData.deviceId) {
        return res.status(400).json({
          success: false,
          message: "deviceId es requerido",
        });
      }

      // Enviar datos a usuarios autorizados
      wsManager.sendToRole("admin", "iot:data:external", {
        ...iotData,
        timestamp: new Date().toISOString(),
        source: "external_api",
      });

      wsManager.sendToRole("empresa", "iot:data:external", {
        ...iotData,
        timestamp: new Date().toISOString(),
        source: "external_api",
      });

      logger.info(
        `📊 Datos IoT externos recibidos del dispositivo: ${iotData.deviceId}`
      );

      res.json({
        success: true,
        message: "Datos IoT procesados",
        deviceId: iotData.deviceId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error procesando datos IoT:", error);
      res.status(500).json({
        success: false,
        message: "Error procesando datos IoT",
      });
    }
  });

  // Ruta para enviar alertas IoT
  app.post("/api/iot/alert", (req, res) => {
    try {
      const alertData = req.body;

      if (!alertData.deviceId || !alertData.message) {
        return res.status(400).json({
          success: false,
          message: "deviceId y message son requeridos",
        });
      }

      // Enviar alerta a administradores
      wsManager.sendToRole("admin", "iot:alert:external", {
        ...alertData,
        timestamp: new Date().toISOString(),
        source: "external_api",
        severity: alertData.severity || "medium",
      });

      logger.warn(
        `🚨 Alerta IoT externa del dispositivo: ${alertData.deviceId} - ${alertData.message}`
      );

      res.json({
        success: true,
        message: "Alerta enviada",
        deviceId: alertData.deviceId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error enviando alerta IoT:", error);
      res.status(500).json({
        success: false,
        message: "Error enviando alerta",
      });
    }
  });

  // === RUTAS PARA ANÁLISIS PREDICTIVO ===

  // Obtener predicción para un dispositivo específico
  app.get("/api/analytics/prediction/:deviceId/:type", (req, res) => {
    try {
      const { deviceId, type } = req.params;

      const prediction = wsManager.getPrediction(deviceId, type);

      if (!prediction) {
        return res.status(404).json({
          success: false,
          message: "No hay suficientes datos para generar predicción",
        });
      }

      res.json({
        success: true,
        data: prediction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo predicción:", error);
      res.status(500).json({
        success: false,
        message: "Error obteniendo predicción",
      });
    }
  });

  // Obtener métricas de eficiencia para un dispositivo
  app.get("/api/analytics/efficiency/:deviceId", (req, res) => {
    try {
      const { deviceId } = req.params;

      const efficiency = wsManager.getEfficiencyMetrics(deviceId);

      if (!efficiency) {
        return res.status(404).json({
          success: false,
          message: "No hay suficientes datos para calcular eficiencia",
        });
      }

      res.json({
        success: true,
        data: efficiency,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo métricas de eficiencia:", error);
      res.status(500).json({
        success: false,
        message: "Error obteniendo métricas de eficiencia",
      });
    }
  });

  // Detectar anomalías en un dispositivo
  app.get("/api/analytics/anomalies/:deviceId/:type", (req, res) => {
    try {
      const { deviceId, type } = req.params;

      const hasAnomaly = wsManager.detectDeviceAnomalies(deviceId, type);

      res.json({
        success: true,
        data: {
          deviceId,
          type,
          hasAnomaly,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Error detectando anomalías:", error);
      res.status(500).json({
        success: false,
        message: "Error detectando anomalías",
      });
    }
  });

  // Obtener estadísticas del análisis predictivo
  app.get("/api/analytics/stats", (req, res) => {
    try {
      const stats = wsManager.getAnalyticsStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo estadísticas de análisis:", error);
      res.status(500).json({
        success: false,
        message: "Error obteniendo estadísticas de análisis",
      });
    }
  });

  // Forzar ejecución de análisis predictivo
  app.post("/api/analytics/trigger", (req, res) => {
    try {
      wsManager.triggerPredictiveAnalysis();

      res.json({
        success: true,
        message: "Análisis predictivo ejecutado",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error ejecutando análisis predictivo:", error);
      res.status(500).json({
        success: false,
        message: "Error ejecutando análisis predictivo",
      });
    }
  });

  // Obtener recomendaciones de eficiencia para todos los dispositivos
  app.get("/api/analytics/efficiency-report", (req, res) => {
    try {
      const devices = ["DEV001", "DEV002", "DEV003", "ARD001", "ARD002"];
      const report = [];

      for (const deviceId of devices) {
        const efficiency = wsManager.getEfficiencyMetrics(deviceId);
        if (efficiency) {
          report.push(efficiency);
        }
      }

      // Calcular métricas globales
      const totalEfficiency =
        report.length > 0
          ? report.reduce((sum, e) => sum + e.energyEfficiency, 0) /
            report.length
          : 0;

      const avgPowerFactor =
        report.length > 0
          ? report.reduce((sum, e) => sum + e.powerFactor, 0) / report.length
          : 0;

      const totalCarbonFootprint = report.reduce(
        (sum, e) => sum + e.carbonFootprint,
        0
      );

      res.json({
        success: true,
        data: {
          devices: report,
          summary: {
            totalDevices: report.length,
            averageEfficiency: Math.round(totalEfficiency * 10) / 10,
            averagePowerFactor: Math.round(avgPowerFactor * 100) / 100,
            totalCarbonFootprint: Math.round(totalCarbonFootprint * 100) / 100,
            estimatedMonthlySavings: Math.round(totalEfficiency * 10), // Simulado
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando reporte de eficiencia:", error);
      res.status(500).json({
        success: false,
        message: "Error generando reporte de eficiencia",
      });
    }
  });

  // ===== RUTAS DE MACHINE LEARNING =====

  // Entrenar modelo ML
  app.post("/api/ml/train", async (req, res) => {
    try {
      const { deviceId, dataType } = req.body;

      if (!deviceId || !dataType) {
        return res.status(400).json({
          success: false,
          message: "deviceId y dataType son requeridos",
        });
      }

      await wsManager.trainModels(deviceId, dataType);

      res.json({
        success: true,
        message: "Entrenamiento de modelo iniciado",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error entrenando modelo:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Generar pronóstico avanzado
  app.post("/api/ml/forecast", async (req, res) => {
    try {
      const { deviceId, dataType, hoursAhead = 24 } = req.body;

      if (!deviceId || !dataType) {
        return res.status(400).json({
          success: false,
          message: "deviceId y dataType son requeridos",
        });
      }

      const forecast = await wsManager.generateAdvancedForecast(
        deviceId,
        dataType,
        hoursAhead
      );

      if (!forecast) {
        return res.status(404).json({
          success: false,
          message: "No se pudo generar pronóstico",
        });
      }

      res.json({
        success: true,
        data: forecast,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando pronóstico:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Analizar patrones de dispositivo
  app.get("/api/ml/patterns/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { dataType = "power" } = req.query;

      const patterns = await wsManager.analyzeDevicePatterns(
        deviceId,
        dataType as string
      );

      if (!patterns) {
        return res.status(404).json({
          success: false,
          message: "No se pudieron analizar patrones",
        });
      }

      res.json({
        success: true,
        data: patterns,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error analizando patrones:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Optimizar modelos ML
  app.post("/api/ml/optimize", async (req, res) => {
    try {
      await wsManager.optimizeMLModels();

      res.json({
        success: true,
        message: "Optimización de modelos iniciada",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error optimizando modelos:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Obtener estadísticas de ML
  app.get("/api/ml/stats", (req, res) => {
    try {
      const stats = wsManager.getMLStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo estadísticas ML:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // ===== RUTAS DE REPORTES AVANZADOS =====

  // Generar reporte completo
  app.post("/api/reports/generate", async (req, res) => {
    try {
      const config = req.body;

      if (!config.name || !config.type || !config.devices) {
        return res.status(400).json({
          success: false,
          message: "name, type y devices son requeridos",
        });
      }

      const report = await wsManager.generateComprehensiveReport(config);

      if (!report) {
        return res.status(500).json({
          success: false,
          message: "No se pudo generar el reporte",
        });
      }

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando reporte:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Configurar reporte automático
  app.post("/api/reports/configure", (req, res) => {
    try {
      const config = req.body;

      if (!config.id || !config.name || !config.type) {
        return res.status(400).json({
          success: false,
          message: "id, name y type son requeridos",
        });
      }

      wsManager.configureAutomaticReport(config);

      res.json({
        success: true,
        message: "Reporte automático configurado",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error configurando reporte:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Obtener reportes generados
  app.get("/api/reports/generated", (req, res) => {
    try {
      const reports = wsManager.getGeneratedReports();

      res.json({
        success: true,
        data: reports,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo reportes:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Obtener configuraciones de reportes
  app.get("/api/reports/configs", (req, res) => {
    try {
      const configs = wsManager.getReportConfigs();

      res.json({
        success: true,
        data: configs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo configuraciones:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Obtener reporte específico
  app.get("/api/reports/:reportId", (req, res) => {
    try {
      const { reportId } = req.params;
      const reports = wsManager.getGeneratedReports();
      const report = reports.find((r) => r.id === reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Reporte no encontrado",
        });
      }

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error obteniendo reporte:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Generar reporte de eficiencia energética
  app.post("/api/reports/efficiency", async (req, res) => {
    try {
      const { devices, period = "weekly" } = req.body;

      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({
          success: false,
          message: "devices debe ser un array",
        });
      }

      const config = {
        id: `efficiency_${Date.now()}`,
        name: "Reporte de Eficiencia Energética",
        type: period,
        devices,
        metrics: ["voltage", "current", "power", "efficiency"],
        format: "json",
        filters: {
          includeAnomalies: true,
          includePredictions: true,
        },
      };

      const report = await wsManager.generateComprehensiveReport(config);

      if (!report) {
        return res.status(500).json({
          success: false,
          message: "No se pudo generar el reporte de eficiencia",
        });
      }

      res.json({
        success: true,
        data: {
          reportId: report.id,
          summary: report.summary,
          deviceReports: report.deviceReports.map((d) => ({
            deviceId: d.deviceId,
            efficiency: d.efficiency,
            status: d.status,
            uptime: d.uptime,
          })),
          recommendations: report.recommendations.filter(
            (r) => r.category === "efficiency"
          ),
          charts: report.charts.filter((c) => c.id.includes("efficiency")),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando reporte de eficiencia:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Generar reporte de mantenimiento predictivo
  app.post("/api/reports/maintenance", async (req, res) => {
    try {
      const { devices } = req.body;

      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({
          success: false,
          message: "devices debe ser un array",
        });
      }

      const config = {
        id: `maintenance_${Date.now()}`,
        name: "Reporte de Mantenimiento Predictivo",
        type: "monthly",
        devices,
        metrics: ["voltage", "current", "power", "temperature"],
        format: "json",
        filters: {
          includeAnomalies: true,
          includePredictions: true,
        },
      };

      const report = await wsManager.generateComprehensiveReport(config);

      if (!report) {
        return res.status(500).json({
          success: false,
          message: "No se pudo generar el reporte de mantenimiento",
        });
      }

      res.json({
        success: true,
        data: {
          reportId: report.id,
          summary: report.summary,
          deviceReports: report.deviceReports.map((d) => ({
            deviceId: d.deviceId,
            maintenance: d.maintenance,
            status: d.status,
            alerts: d.alerts.filter(
              (a) => a.severity === "high" || a.severity === "critical"
            ),
          })),
          recommendations: report.recommendations.filter(
            (r) => r.category === "maintenance"
          ),
          predictions: report.predictions,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error generando reporte de mantenimiento:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  // Generar dashboard de analytics en tiempo real
  app.get("/api/analytics/dashboard", (req, res) => {
    try {
      const devices = ["DEV001", "DEV002", "DEV003", "ARD001", "ARD002"];
      const dashboard = {
        timestamp: new Date().toISOString(),
        devices: [],
        systemHealth: "good",
        totalAlerts: 0,
        criticalAlerts: 0,
        mlModels: wsManager.getMLStats(),
        recentReports: wsManager.getGeneratedReports().slice(-5),
      };

      // Obtener datos de cada dispositivo
      for (const deviceId of devices) {
        const efficiency = wsManager.getEfficiencyMetrics(deviceId);
        if (efficiency) {
          dashboard.devices.push({
            deviceId,
            efficiency: efficiency.energyEfficiency,
            powerFactor: efficiency.powerFactor,
            status:
              efficiency.energyEfficiency > 80
                ? "good"
                : efficiency.energyEfficiency > 60
                ? "warning"
                : "critical",
          });
        }
      }

      // Determinar salud del sistema
      const avgEfficiency =
        dashboard.devices.length > 0
          ? dashboard.devices.reduce((sum, d) => sum + d.efficiency, 0) /
            dashboard.devices.length
          : 0;

      if (avgEfficiency > 85) dashboard.systemHealth = "excellent";
      else if (avgEfficiency > 70) dashboard.systemHealth = "good";
      else if (avgEfficiency > 50) dashboard.systemHealth = "warning";
      else dashboard.systemHealth = "critical";

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      logger.error("Error generando dashboard:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  });

  logger.info("🛣️ Rutas avanzadas de Fase 3 configuradas");
}
