import { logger } from "../utils/logger";
import { ConnectionManager } from "./ConnectionManager";
import { AdvancedReporting } from "./AdvancedReporting";
import { PermissionFilter } from "./PermissionFilter";
import { UserSocket } from "../types/websocket";

interface ReportGenerationRequest {
  id: string;
  name: string;
  type: string;
  devices: string[];
  metrics: string[];
  format: string;
  filters?: Record<string, unknown>;
}

interface AutoReportConfiguration {
  id: string;
  name: string;
  type: string;
  devices: string[];
  metrics: string[];
  format: string;
  schedule: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    time: string;
    recipients: string[];
  };
}

export class ReportingEventHandler {
  private connectionManager: ConnectionManager;
  private advancedReporting: AdvancedReporting;

  constructor(
    connectionManager: ConnectionManager,
    advancedReporting: AdvancedReporting
  ) {
    this.connectionManager = connectionManager;
    this.advancedReporting = advancedReporting;
  }

  setupEventHandlers(socket: UserSocket): void {
    // Verificar permisos básicos para reportes
    if (!["superadmin", "empresa"].includes(socket.userRole || "")) {
      logger.warn(
        `Acceso a reportes denegado para rol ${socket.userRole}`,
        "ReportingEventHandler"
      );
      return;
    }

    // Generación de reportes
    socket.on("reporting:generate", (data: ReportGenerationRequest) => {
      this.handleReportGeneration(socket, data);
    });

    // Configuración de reportes automáticos (solo superadmin)
    socket.on("reporting:configure", (data: AutoReportConfiguration) => {
      if (socket.userRole === "superadmin") {
        this.handleAutoReportConfiguration(socket, data);
      } else {
        socket.emit("reporting:access_denied", {
          action: "configure",
          reason: "Solo superadmin puede configurar reportes automáticos",
        });
      }
    });
  }

  private async handleReportGeneration(
    socket: UserSocket,
    data: ReportGenerationRequest
  ): Promise<void> {
    logger.info(`Generando reporte: ${data.name}`, "ReportingEventHandler", {
      type: data.type,
      devices: data.devices.length,
      userId: socket.userId,
    });

    try {
      // En una implementación real, aquí se obtendría los datos de dispositivos
      const deviceData = new Map(); // Placeholder

      const report = await this.advancedReporting.generateComprehensiveReport(
        data as any,
        deviceData
      );

      if (report) {
        const eventData = {
          reportId: report.id,
          title: report.title,
          summary: report.summary,
          timestamp: new Date().toISOString(),
        };

        // Filtrar datos del reporte según permisos
        const filteredEventData = this.filterReportDataByRole(
          socket,
          eventData
        );

        // Notificar según rol
        if (socket.userRole === "superadmin") {
          this.connectionManager.sendToRole(
            "superadmin",
            "reporting:report_generated",
            eventData
          );
        } else {
          this.connectionManager.sendToRole(
            "empresa",
            "reporting:report_generated",
            filteredEventData
          );
        }

        // Notificar al usuario que solicitó el reporte
        if (socket.userId) {
          this.connectionManager.sendToUser(
            socket.userId,
            "reporting:report_ready",
            {
              ...filteredEventData,
              downloadUrl: `/api/reports/${report.id}`,
            }
          );
        }

        // Enviar recomendaciones críticas solo a usuarios autorizados
        const criticalRecommendations = report.recommendations.filter(
          (r) => r.priority === "critical"
        );
        if (criticalRecommendations.length > 0) {
          const criticalAlert = {
            reportId: report.id,
            recommendations: criticalRecommendations,
            timestamp: new Date().toISOString(),
            scope: socket.userRole === "superadmin" ? "global" : "empresa",
          };

          if (socket.userRole === "superadmin") {
            this.connectionManager.broadcastToAll(
              "reporting:critical_recommendations",
              criticalAlert
            );
          } else {
            this.connectionManager.sendToRole(
              "empresa",
              "reporting:critical_recommendations",
              criticalAlert
            );
          }
        }

        logger.info(
          `Reporte generado exitosamente: ${report.id}`,
          "ReportingEventHandler",
          {
            title: report.title,
            devices: report.summary.totalDevices,
            recommendations: report.recommendations.length,
          }
        );
      }
    } catch (error) {
      logger.error("Error generando reporte", "ReportingEventHandler", {
        error,
      });

      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "reporting:generation_failed",
          {
            reportName: data.name,
            error: error instanceof Error ? error.message : "Error desconocido",
            timestamp: new Date().toISOString(),
          }
        );
      }
    }
  }

  private handleAutoReportConfiguration(
    socket: UserSocket,
    data: AutoReportConfiguration
  ): void {
    logger.info(
      `Configurando reporte automático: ${data.name}`,
      "ReportingEventHandler",
      {
        frequency: data.schedule.frequency,
        enabled: data.schedule.enabled,
        userId: socket.userId,
      }
    );

    try {
      this.advancedReporting.configureAutomaticReport(data as any);

      const eventData = {
        configId: data.id,
        name: data.name,
        schedule: data.schedule,
        timestamp: new Date().toISOString(),
      };

      // Solo superadmin puede configurar reportes automáticos
      this.connectionManager.sendToRole(
        "superadmin",
        "reporting:auto_report_configured",
        eventData
      );

      // Notificar al usuario que configuró el reporte
      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "reporting:configuration_saved",
          eventData
        );
      }

      logger.info(
        `Reporte automático configurado: ${data.name}`,
        "ReportingEventHandler",
        {
          configId: data.id,
          frequency: data.schedule.frequency,
        }
      );
    } catch (error) {
      logger.error(
        "Error configurando reporte automático",
        "ReportingEventHandler",
        { error }
      );

      if (socket.userId) {
        this.connectionManager.sendToUser(
          socket.userId,
          "reporting:configuration_failed",
          {
            configName: data.name,
            error: error instanceof Error ? error.message : "Error desconocido",
            timestamp: new Date().toISOString(),
          }
        );
      }
    }
  }

  // Método público para generar reportes automáticos programados
  public async generateScheduledReports(): Promise<void> {
    try {
      const configs = this.advancedReporting.getReportConfigs();
      const now = new Date();

      for (const config of configs) {
        if (!config.schedule?.enabled) continue;

        // Lógica para determinar si es hora de generar el reporte
        // (En una implementación real, esto sería más sofisticado)
        const shouldGenerate = this.shouldGenerateReport(config, now);

        if (shouldGenerate) {
          logger.info(
            `Generando reporte automático: ${config.name}`,
            "ReportingEventHandler"
          );

          // En una implementación real, aquí se obtendría los datos de dispositivos
          const deviceData = new Map(); // Placeholder

          const report =
            await this.advancedReporting.generateComprehensiveReport(
              config,
              deviceData
            );

          if (report) {
            // Notificar sobre reporte automático según el scope
            const reportNotification = {
              reportId: report.id,
              title: report.title,
              configId: config.id,
              automatic: true,
              timestamp: new Date().toISOString(),
            };

            // Determinar a quién notificar según el tipo de reporte
            if ((config as any).type === "global") {
              this.connectionManager.sendToRole(
                "superadmin",
                "reporting:scheduled_report_generated",
                reportNotification
              );
            } else {
              this.connectionManager.sendToRole(
                "empresa",
                "reporting:scheduled_report_generated",
                reportNotification
              );
            }

            // Enviar por email a los destinatarios (en una implementación real)
            logger.info(
              `Reporte automático generado: ${report.id}`,
              "ReportingEventHandler"
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        "Error generando reportes automáticos",
        "ReportingEventHandler",
        { error }
      );
    }
  }

  private shouldGenerateReport(config: any, now: Date): boolean {
    // Lógica simplificada para determinar si es hora de generar el reporte
    // En una implementación real, esto sería más sofisticado con cron jobs o similar

    if (!config.schedule?.enabled) return false;

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const [scheduleHour, scheduleMinute] = config.schedule.time
      .split(":")
      .map(Number);

    // Solo generar si es la hora exacta (simplificado)
    return currentHour === scheduleHour && currentMinute === scheduleMinute;
  }

  // Filtrar datos del reporte según el rol del usuario
  private filterReportDataByRole(socket: UserSocket, reportData: any): any {
    const { userRole } = socket;

    switch (userRole) {
      case "superadmin":
        return reportData; // Acceso completo

      case "empresa":
        // Empresa ve reportes sin datos sensibles globales
        return {
          reportId: reportData.reportId,
          title: reportData.title,
          summary: {
            ...reportData.summary,
            // Remover estadísticas globales sensibles
            globalMetrics: undefined,
            systemWideAnalysis: undefined,
          },
          timestamp: reportData.timestamp,
        };

      default:
        return null;
    }
  }
}
