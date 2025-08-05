import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import { MachineLearning } from "./MachineLearning";
import { PermissionFilter } from "./PermissionFilter";
import {
  UserSocket,
  MLTrainingData,
  MLForecastData,
  MLPatternAnalysisData,
} from "../types/websocket";

export class MLEventHandler {
  private connectionManager: ConnectionManager;
  private machineLearning: MachineLearning;

  constructor(
    connectionManager: ConnectionManager,
    machineLearning: MachineLearning
  ) {
    this.connectionManager = connectionManager;
    this.machineLearning = machineLearning;
  }

  setupEventHandlers(socket: UserSocket): void {
    // Solo superadmin y empresa pueden acceder a funciones ML
    if (!["superadmin", "empresa"].includes(socket.userRole || "")) {
      logger.warn(
        `Acceso ML denegado para rol ${socket.userRole}`,
        "MLEventHandler"
      );
      return;
    }

    // Entrenamiento de modelos (solo superadmin)
    socket.on("ml:train", (data: MLTrainingData) => {
      if (socket.userRole === "superadmin") {
        this.handleModelTraining(socket, data);
      } else {
        socket.emit("ml:access_denied", {
          action: "train",
          reason: "Solo superadmin puede entrenar modelos",
        });
      }
    });

    // Generación de pronósticos
    socket.on("ml:forecast", (data: MLForecastData) => {
      this.handleForecastGeneration(socket, data);
    });

    // Análisis de patrones
    socket.on("ml:analyze_patterns", (data: MLPatternAnalysisData) => {
      this.handlePatternAnalysis(socket, data);
    });

    // Optimización de modelos (solo superadmin)
    socket.on("ml:optimize", () => {
      if (socket.userRole === "superadmin") {
        this.handleModelOptimization(socket);
      } else {
        socket.emit("ml:access_denied", {
          action: "optimize",
          reason: "Solo superadmin puede optimizar modelos",
        });
      }
    });
  }

  private async handleModelTraining(
    socket: UserSocket,
    data: MLTrainingData
  ): Promise<void> {
    logger.info(`Iniciando entrenamiento de modelo ML`, "MLEventHandler", {
      deviceId: data.deviceId,
      dataType: data.dataType,
      userId: socket.userId,
    });

    try {
      // En una implementación real, aquí se obtendría los datos históricos
      const historicalData: any[] = []; // Placeholder

      const model = await this.machineLearning.trainModel(
        data.deviceId,
        data.dataType,
        historicalData
      );

      if (model) {
        const eventData = {
          deviceId: data.deviceId,
          dataType: data.dataType,
          modelType: model.type,
          accuracy: model.accuracy,
          timestamp: new Date().toISOString(),
        };

        // Notificar según permisos
        this.connectionManager.sendToRole(
          "superadmin",
          "ml:model_trained",
          eventData
        );

        // Notificar al usuario que inició el entrenamiento
        if (socket.userId) {
          this.connectionManager.sendToUser(
            socket.userId,
            "ml:training_completed",
            eventData
          );
        }

        logger.info(`Modelo ML entrenado exitosamente`, "MLEventHandler", {
          deviceId: data.deviceId,
          dataType: data.dataType,
          modelType: model.type,
          accuracy: model.accuracy,
        });
      }
    } catch (error) {
      logger.error("Error entrenando modelo ML", "MLEventHandler", { error });

      if (socket.userId) {
        this.connectionManager.sendToUser(socket.userId, "ml:training_failed", {
          deviceId: data.deviceId,
          dataType: data.dataType,
          error: error instanceof Error ? error.message : "Error desconocido",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async handleForecastGeneration(
    socket: UserSocket,
    data: MLForecastData
  ): Promise<void> {
    logger.info(`Generando pronóstico ML`, "MLEventHandler", {
      deviceId: data.deviceId,
      dataType: data.dataType,
      hoursAhead: data.hoursAhead,
    });

    try {
      const forecast = await this.machineLearning.generateForecast(
        data.deviceId,
        data.dataType,
        data.hoursAhead
      );

      if (forecast) {
        const eventData = {
          deviceId: data.deviceId,
          dataType: data.dataType,
          forecast,
          timestamp: new Date().toISOString(),
        };

        // Filtrar datos según permisos del usuario
        const filteredEventData = this.filterMLDataByRole(socket, eventData);

        // Notificar según rol
        if (socket.userRole === "superadmin") {
          this.connectionManager.sendToRole(
            "superadmin",
            "ml:forecast_generated",
            eventData
          );
        } else {
          this.connectionManager.sendToRole(
            "empresa",
            "ml:forecast_generated",
            filteredEventData
          );
        }

        // Notificar al usuario que solicitó el pronóstico
        if (socket.userId) {
          this.connectionManager.sendToUser(
            socket.userId,
            "ml:forecast_ready",
            filteredEventData
          );
        }

        // Enviar predicciones críticas solo a usuarios autorizados
        const criticalPredictions = forecast.predictions.filter(
          (p) => p.confidence > 0.8
        );
        if (criticalPredictions.length > 0) {
          this.connectionManager.sendToAuthorizedUsers(
            "ml:critical_predictions",
            {
              deviceId: data.deviceId,
              dataType: data.dataType,
              predictions: criticalPredictions,
              timestamp: new Date().toISOString(),
            },
            data.deviceId
          );
        }
      }
    } catch (error) {
      logger.error("Error generando pronóstico ML", "MLEventHandler", {
        error,
      });

      if (socket.userId) {
        this.connectionManager.sendToUser(socket.userId, "ml:forecast_failed", {
          deviceId: data.deviceId,
          dataType: data.dataType,
          error: error instanceof Error ? error.message : "Error desconocido",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async handlePatternAnalysis(
    socket: UserSocket,
    data: MLPatternAnalysisData
  ): Promise<void> {
    logger.info(`Analizando patrones ML`, "MLEventHandler", {
      deviceId: data.deviceId,
      dataType: data.dataType,
    });

    try {
      // En una implementación real, aquí se obtendría los datos históricos
      const historicalData: any[] = []; // Placeholder

      const patterns = this.machineLearning.analyzePatterns(
        data.deviceId,
        data.dataType,
        historicalData
      );

      const eventData = {
        deviceId: data.deviceId,
        dataType: data.dataType,
        patterns,
        timestamp: new Date().toISOString(),
      };

      // Filtrar datos según permisos
      const filteredEventData = this.filterMLDataByRole(socket, eventData);

      // Notificar según rol
      if (socket.userRole === "superadmin") {
        this.connectionManager.sendToRole(
          "superadmin",
          "ml:patterns_analyzed",
          eventData
        );
      } else {
        this.connectionManager.sendToRole(
          "empresa",
          "ml:patterns_analyzed",
          filteredEventData
        );
      }

      // Notificar al usuario que solicitó el análisis
      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "ml:analysis_ready",
          filteredEventData
        );
      }

      // Alertar sobre patrones críticos solo a usuarios autorizados
      const criticalPatterns = patterns.patterns.filter(
        (p) => p.impact === "high"
      );
      if (criticalPatterns.length > 0) {
        this.connectionManager.sendToAuthorizedUsers(
          "ml:critical_patterns",
          {
            deviceId: data.deviceId,
            dataType: data.dataType,
            patterns: criticalPatterns,
            timestamp: new Date().toISOString(),
          },
          data.deviceId
        );
      }
    } catch (error) {
      logger.error("Error analizando patrones ML", "MLEventHandler", { error });

      if (socket.userId) {
        this.connectionManager.sendToUser(socket.userId, "ml:analysis_failed", {
          deviceId: data.deviceId,
          dataType: data.dataType,
          error: error instanceof Error ? error.message : "Error desconocido",
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private async handleModelOptimization(socket: UserSocket): Promise<void> {
    logger.info(`Optimizando modelos ML`, "MLEventHandler", {
      userId: socket.userId,
    });

    try {
      await this.machineLearning.optimizeModels();

      const stats = this.machineLearning.getModelStats();

      const eventData = {
        stats,
        timestamp: new Date().toISOString(),
      };

      // Notificar a administradores
      this.connectionManager.sendToRole(
        "superadmin",
        "ml:models_optimized",
        eventData
      );

      // Notificar al usuario que inició la optimización
      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "ml:optimization_completed",
          eventData
        );
      }

      logger.info("Modelos ML optimizados exitosamente", "MLEventHandler", {
        stats,
      });
    } catch (error) {
      logger.error("Error optimizando modelos ML", "MLEventHandler", { error });

      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "ml:optimization_failed",
          {
            error: error instanceof Error ? error.message : "Error desconocido",
            timestamp: new Date().toISOString(),
          }
        );
      }
    }
  }

  // Método público para optimización automática
  public async optimizeModels(): Promise<void> {
    try {
      await this.machineLearning.optimizeModels();

      const stats = this.machineLearning.getModelStats();

      // Notificar solo a superadmin sobre optimización automática
      this.connectionManager.sendToRole(
        "superadmin",
        "ml:auto_optimization_completed",
        {
          stats,
          timestamp: new Date().toISOString(),
          automatic: true,
        }
      );

      logger.info(
        "Optimización automática de modelos ML completada",
        "MLEventHandler",
        { stats }
      );
    } catch (error) {
      logger.error(
        "Error en optimización automática de modelos ML",
        "MLEventHandler",
        { error }
      );
    }
  }

  // Filtrar datos ML según el rol del usuario
  private filterMLDataByRole(socket: UserSocket, data: any): any {
    const { userRole } = socket;

    switch (userRole) {
      case "superadmin":
        return data; // Acceso completo

      case "empresa":
        // Empresa ve datos agregados sin detalles técnicos sensibles
        return {
          deviceId: data.deviceId,
          dataType: data.dataType,
          timestamp: data.timestamp,
          // Para forecasts
          forecast: data.forecast
            ? {
                predictions: data.forecast.predictions?.map((p: any) => ({
                  timestamp: p.timestamp,
                  value: p.value,
                  confidence: Math.min(p.confidence, 0.8), // Limitar confianza mostrada
                })),
                accuracy: data.forecast.accuracy
                  ? Math.round(data.forecast.accuracy * 100) / 100
                  : undefined,
              }
            : undefined,
          // Para patterns
          patterns: data.patterns
            ? {
                patterns: data.patterns.patterns?.filter(
                  (p: any) => p.impact !== "critical"
                ), // Filtrar patrones críticos
                summary: data.patterns.summary,
              }
            : undefined,
        };

      default:
        return null;
    }
  }
}
