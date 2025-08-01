import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import { MachineLearning } from "./MachineLearning";
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
    // Entrenamiento de modelos
    socket.on("ml:train", (data: MLTrainingData) => {
      this.handleModelTraining(socket, data);
    });

    // Generación de pronósticos
    socket.on("ml:forecast", (data: MLForecastData) => {
      this.handleForecastGeneration(socket, data);
    });

    // Análisis de patrones
    socket.on("ml:analyze_patterns", (data: MLPatternAnalysisData) => {
      this.handlePatternAnalysis(socket, data);
    });

    // Optimización de modelos
    socket.on("ml:optimize", () => {
      this.handleModelOptimization(socket);
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

        // Notificar a administradores
        this.connectionManager.sendToRole(
          "admin",
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

        // Notificar a administradores
        this.connectionManager.sendToRole(
          "admin",
          "ml:forecast_generated",
          eventData
        );

        // Notificar al usuario que solicitó el pronóstico
        if (socket.userId) {
          this.connectionManager.sendToUser(
            socket.userId,
            "ml:forecast_ready",
            eventData
          );
        }

        // Enviar predicciones críticas si las hay
        const criticalPredictions = forecast.predictions.filter(
          (p) => p.confidence > 0.8
        );
        if (criticalPredictions.length > 0) {
          this.connectionManager.broadcastToAll("ml:critical_predictions", {
            deviceId: data.deviceId,
            dataType: data.dataType,
            predictions: criticalPredictions,
            timestamp: new Date().toISOString(),
          });
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

      // Notificar a administradores
      this.connectionManager.sendToRole(
        "admin",
        "ml:patterns_analyzed",
        eventData
      );

      // Notificar al usuario que solicitó el análisis
      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "ml:analysis_ready",
          eventData
        );
      }

      // Alertar sobre patrones críticos
      const criticalPatterns = patterns.patterns.filter(
        (p) => p.impact === "high"
      );
      if (criticalPatterns.length > 0) {
        this.connectionManager.sendToRole("admin", "ml:critical_patterns", {
          deviceId: data.deviceId,
          dataType: data.dataType,
          patterns: criticalPatterns,
          timestamp: new Date().toISOString(),
        });
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
        "admin",
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

      // Notificar a administradores sobre optimización automática
      this.connectionManager.sendToRole(
        "admin",
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
}
