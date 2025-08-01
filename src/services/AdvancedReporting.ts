import { logger } from "../utils/logger";
import {
  DataPoint,
  PredictiveAnalytics,
  EfficiencyMetrics,
} from "./PredictiveAnalytics";
import {
  MachineLearning,
  ForecastResult,
  PatternAnalysis,
} from "./MachineLearning";

export interface ReportConfig {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly" | "custom";
  devices: string[];
  metrics: string[];
  format: "pdf" | "excel" | "json" | "html";
  schedule?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    time: string; // HH:MM
    recipients: string[];
  };
  filters?: {
    dateRange?: { start: Date; end: Date };
    thresholds?: { [metric: string]: { min?: number; max?: number } };
    includeAnomalies?: boolean;
    includePredictions?: boolean;
  };
}

export interface ComprehensiveReport {
  id: string;
  title: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: {
    totalDevices: number;
    totalDataPoints: number;
    averageEfficiency: number;
    criticalAlerts: number;
    energyConsumption: number; // kWh
    estimatedCost: number; // CLP
    carbonFootprint: number; // kg CO2
  };
  deviceReports: DeviceReport[];
  systemAnalysis: SystemAnalysis;
  predictions: ForecastResult[];
  recommendations: Recommendation[];
  charts: ChartData[];
}

export interface DeviceReport {
  deviceId: string;
  deviceName: string;
  status: "online" | "offline" | "warning" | "critical";
  uptime: number; // porcentaje
  metrics: {
    voltage: MetricSummary;
    current: MetricSummary;
    power: MetricSummary;
    temperature?: MetricSummary;
  };
  efficiency: EfficiencyMetrics;
  patterns: PatternAnalysis;
  alerts: Alert[];
  maintenance: MaintenanceInfo;
}

export interface MetricSummary {
  current: number;
  average: number;
  min: number;
  max: number;
  trend: "increasing" | "decreasing" | "stable";
  anomalies: number;
  thresholdViolations: number;
}

export interface SystemAnalysis {
  overallHealth: "excellent" | "good" | "fair" | "poor" | "critical";
  loadDistribution: {
    balanced: boolean;
    imbalance: number; // porcentaje
    recommendations: string[];
  };
  powerQuality: {
    harmonicDistortion: number;
    powerFactor: number;
    voltageStability: number;
    rating: "excellent" | "good" | "fair" | "poor";
  };
  networkTopology: {
    totalNodes: number;
    activeConnections: number;
    communicationErrors: number;
    latency: number; // ms
  };
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: "low" | "medium" | "high" | "critical";
  type: "threshold" | "anomaly" | "prediction" | "system";
  message: string;
  deviceId: string;
  metric: string;
  value: number;
  threshold?: number;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface MaintenanceInfo {
  lastMaintenance?: Date;
  nextScheduled?: Date;
  hoursOfOperation: number;
  maintenanceScore: number; // 0-100
  predictedFailure?: {
    probability: number;
    timeframe: string;
    component: string;
  };
  recommendations: string[];
}

export interface Recommendation {
  id: string;
  category: "efficiency" | "maintenance" | "safety" | "cost" | "environmental";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  impact: {
    energySavings?: number; // kWh/mes
    costSavings?: number; // CLP/mes
    co2Reduction?: number; // kg CO2/mes
    reliabilityImprovement?: number; // porcentaje
  };
  implementation: {
    effort: "low" | "medium" | "high";
    cost: "low" | "medium" | "high";
    timeframe: string;
    steps: string[];
  };
  devices: string[];
}

export interface ChartData {
  id: string;
  title: string;
  type: "line" | "bar" | "pie" | "scatter" | "heatmap";
  data: any;
  config: any;
}

export class AdvancedReporting {
  private predictiveAnalytics: PredictiveAnalytics;
  private machineLearning: MachineLearning;
  private reportConfigs: Map<string, ReportConfig> = new Map();
  private generatedReports: Map<string, ComprehensiveReport> = new Map();

  constructor(
    predictiveAnalytics: PredictiveAnalytics,
    machineLearning: MachineLearning
  ) {
    this.predictiveAnalytics = predictiveAnalytics;
    this.machineLearning = machineLearning;
  }

  // Generar reporte completo
  async generateComprehensiveReport(
    config: ReportConfig,
    deviceData: Map<string, DataPoint[]>
  ): Promise<ComprehensiveReport> {
    logger.info(`📊 Generando reporte completo: ${config.name}`);

    const reportId = `report_${Date.now()}`;
    const now = new Date();
    const period = this.calculateReportPeriod(
      config.type,
      config.filters?.dateRange
    );

    // Generar resumen ejecutivo
    const summary = await this.generateExecutiveSummary(deviceData, period);

    // Generar reportes por dispositivo
    const deviceReports = await this.generateDeviceReports(
      config.devices,
      deviceData,
      period
    );

    // Análisis del sistema
    const systemAnalysis = await this.generateSystemAnalysis(deviceData);

    // Predicciones
    const predictions = await this.generatePredictions(config.devices);

    // Recomendaciones
    const recommendations = await this.generateRecommendations(
      deviceReports,
      systemAnalysis
    );

    // Gráficos
    const charts = await this.generateCharts(deviceData, config);

    const report: ComprehensiveReport = {
      id: reportId,
      title: config.name,
      generatedAt: now,
      period,
      summary,
      deviceReports,
      systemAnalysis,
      predictions,
      recommendations,
      charts,
    };

    this.generatedReports.set(reportId, report);
    logger.info(`✅ Reporte generado exitosamente: ${reportId}`);

    return report;
  }

  // Generar resumen ejecutivo
  private async generateExecutiveSummary(
    deviceData: Map<string, DataPoint[]>,
    period: { start: Date; end: Date }
  ) {
    let totalDataPoints = 0;
    let totalEnergyConsumption = 0;
    let totalEfficiency = 0;
    let criticalAlerts = 0;
    const devices = Array.from(deviceData.keys());

    for (const [deviceId, data] of deviceData.entries()) {
      totalDataPoints += data.length;

      // Calcular consumo energético
      const powerData = data.filter((d) => d.type === "power");
      if (powerData.length > 0) {
        const avgPower =
          powerData.reduce((sum, d) => sum + d.value, 0) / powerData.length;
        const hoursInPeriod =
          (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60);
        totalEnergyConsumption += (avgPower * hoursInPeriod) / 1000; // kWh
      }

      // Calcular eficiencia
      const efficiency =
        this.predictiveAnalytics.calculateEfficiencyMetrics(deviceId);
      if (efficiency) {
        totalEfficiency += efficiency.energyEfficiency;
      }

      // Contar alertas críticas
      const voltageData = data.filter((d) => d.type === "voltage");
      const currentData = data.filter((d) => d.type === "current");

      criticalAlerts += voltageData.filter(
        (d) => d.value > 250 || d.value < 200
      ).length;
      criticalAlerts += currentData.filter((d) => d.value > 50).length;
    }

    const averageEfficiency =
      devices.length > 0 ? totalEfficiency / devices.length : 0;
    const costPerKwh = 148.3; // CLP/kWh
    const estimatedCost = totalEnergyConsumption * costPerKwh;
    const carbonFootprint = totalEnergyConsumption * 0.4; // kg CO2/kWh

    return {
      totalDevices: devices.length,
      totalDataPoints,
      averageEfficiency,
      criticalAlerts,
      energyConsumption: totalEnergyConsumption,
      estimatedCost,
      carbonFootprint,
    };
  }

  // Generar reportes por dispositivo
  private async generateDeviceReports(
    deviceIds: string[],
    deviceData: Map<string, DataPoint[]>,
    period: { start: Date; end: Date }
  ): Promise<DeviceReport[]> {
    const reports: DeviceReport[] = [];

    for (const deviceId of deviceIds) {
      const data = deviceData.get(deviceId) || [];
      if (data.length === 0) continue;

      // Calcular métricas
      const metrics = this.calculateDeviceMetrics(data);

      // Obtener eficiencia
      const efficiency =
        this.predictiveAnalytics.calculateEfficiencyMetrics(deviceId);

      // Analizar patrones
      const patterns = this.machineLearning.analyzePatterns(
        deviceId,
        "power",
        data
      );

      // Generar alertas
      const alerts = this.generateDeviceAlerts(deviceId, data);

      // Información de mantenimiento
      const maintenance = this.generateMaintenanceInfo(deviceId, data);

      // Calcular uptime
      const uptime = this.calculateUptime(data, period);

      // Determinar estado
      const status = this.determineDeviceStatus(metrics, alerts);

      reports.push({
        deviceId,
        deviceName: `Dispositivo ${deviceId}`,
        status,
        uptime,
        metrics,
        efficiency: efficiency || this.getDefaultEfficiency(deviceId),
        patterns,
        alerts,
        maintenance,
      });
    }

    return reports;
  }

  // Calcular métricas del dispositivo
  private calculateDeviceMetrics(data: DataPoint[]) {
    const metrics: DeviceReport["metrics"] = {
      voltage: this.calculateMetricSummary(data, "voltage"),
      current: this.calculateMetricSummary(data, "current"),
      power: this.calculateMetricSummary(data, "power"),
    };

    const temperatureData = data.filter((d) => d.type === "temperature");
    if (temperatureData.length > 0) {
      metrics.temperature = this.calculateMetricSummary(data, "temperature");
    }

    return metrics;
  }

  // Calcular resumen de métrica
  private calculateMetricSummary(
    data: DataPoint[],
    type: string
  ): MetricSummary {
    const filteredData = data.filter((d) => d.type === type);
    if (filteredData.length === 0) {
      return {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        trend: "stable",
        anomalies: 0,
        thresholdViolations: 0,
      };
    }

    const values = filteredData.map((d) => d.value);
    const current = values[values.length - 1];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calcular tendencia
    const recentValues = values.slice(-10);
    const trend = this.calculateTrend(recentValues);

    // Contar anomalías
    const mean = average;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
    const anomalies = values.filter(
      (v) => Math.abs(v - mean) > 2 * stdDev
    ).length;

    // Contar violaciones de umbral
    const thresholds = this.getThresholds(type);
    const thresholdViolations = values.filter(
      (v) =>
        (thresholds.min && v < thresholds.min) ||
        (thresholds.max && v > thresholds.max)
    ).length;

    return {
      current,
      average,
      min,
      max,
      trend,
      anomalies,
      thresholdViolations,
    };
  }

  // Calcular tendencia
  private calculateTrend(
    values: number[]
  ): "increasing" | "decreasing" | "stable" {
    if (values.length < 2) return "stable";

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < 0.05) return "stable";
    return change > 0 ? "increasing" : "decreasing";
  }

  // Obtener umbrales
  private getThresholds(type: string): { min?: number; max?: number } {
    const thresholds: { [key: string]: { min?: number; max?: number } } = {
      voltage: { min: 200, max: 250 },
      current: { max: 50 },
      power: { max: 5000 },
      temperature: { max: 70 },
    };

    return thresholds[type] || {};
  }

  // Generar alertas del dispositivo
  private generateDeviceAlerts(deviceId: string, data: DataPoint[]): Alert[] {
    const alerts: Alert[] = [];
    let alertId = 1;

    // Verificar umbrales para cada tipo de métrica
    const metricTypes = ["voltage", "current", "power", "temperature"];

    for (const type of metricTypes) {
      const typeData = data.filter((d) => d.type === type);
      const thresholds = this.getThresholds(type);

      for (const point of typeData) {
        let severity: Alert["severity"] | null = null;
        let message = "";
        let threshold: number | undefined;

        if (thresholds.max && point.value > thresholds.max) {
          severity = point.value > thresholds.max * 1.2 ? "critical" : "high";
          message = `${type} excede límite máximo: ${point.value} > ${thresholds.max}`;
          threshold = thresholds.max;
        } else if (thresholds.min && point.value < thresholds.min) {
          severity = point.value < thresholds.min * 0.8 ? "critical" : "high";
          message = `${type} por debajo del límite mínimo: ${point.value} < ${thresholds.min}`;
          threshold = thresholds.min;
        }

        if (severity) {
          alerts.push({
            id: `alert_${deviceId}_${alertId++}`,
            timestamp: point.timestamp,
            severity,
            type: "threshold",
            message,
            deviceId,
            metric: type,
            value: point.value,
            threshold,
            resolved: false,
          });
        }
      }

      // Detectar anomalías
      if (this.predictiveAnalytics.detectAnomalies(deviceId, type)) {
        alerts.push({
          id: `alert_${deviceId}_${alertId++}`,
          timestamp: new Date(),
          severity: "medium",
          type: "anomaly",
          message: `Anomalía detectada en ${type}`,
          deviceId,
          metric: type,
          value: typeData[typeData.length - 1]?.value || 0,
          resolved: false,
        });
      }
    }

    return alerts.slice(-10); // Últimas 10 alertas
  }

  // Generar información de mantenimiento
  private generateMaintenanceInfo(
    deviceId: string,
    data: DataPoint[]
  ): MaintenanceInfo {
    const hoursOfOperation = data.length; // Simplificado
    const lastDataPoint = data[data.length - 1];

    // Calcular score de mantenimiento basado en métricas
    let maintenanceScore = 100;

    // Reducir score por alertas
    const alerts = this.generateDeviceAlerts(deviceId, data);
    maintenanceScore -=
      alerts.filter((a) => a.severity === "critical").length * 20;
    maintenanceScore -= alerts.filter((a) => a.severity === "high").length * 10;
    maintenanceScore -=
      alerts.filter((a) => a.severity === "medium").length * 5;

    maintenanceScore = Math.max(0, Math.min(100, maintenanceScore));

    // Generar recomendaciones de mantenimiento
    const recommendations: string[] = [];

    if (maintenanceScore < 70) {
      recommendations.push("Programar inspección técnica inmediata");
    }
    if (maintenanceScore < 50) {
      recommendations.push("Revisar conexiones eléctricas");
      recommendations.push("Verificar sistema de refrigeración");
    }
    if (hoursOfOperation > 8760) {
      // Más de un año
      recommendations.push("Mantenimiento preventivo anual requerido");
    }

    // Predicción de falla (simplificada)
    let predictedFailure;
    if (maintenanceScore < 40) {
      predictedFailure = {
        probability: (100 - maintenanceScore) / 100,
        timeframe: maintenanceScore < 20 ? "1-2 semanas" : "1-3 meses",
        component: "Sistema eléctrico principal",
      };
    }

    return {
      lastMaintenance: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Hace 30 días
      nextScheduled: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // En 60 días
      hoursOfOperation,
      maintenanceScore,
      predictedFailure,
      recommendations,
    };
  }

  // Calcular uptime
  private calculateUptime(
    data: DataPoint[],
    period: { start: Date; end: Date }
  ): number {
    if (data.length === 0) return 0;

    const totalPeriodHours =
      (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60);
    const dataHours = data.length; // Simplificado: asumimos 1 punto por hora

    return Math.min(100, (dataHours / totalPeriodHours) * 100);
  }

  // Determinar estado del dispositivo
  private determineDeviceStatus(
    metrics: DeviceReport["metrics"],
    alerts: Alert[]
  ): DeviceReport["status"] {
    const criticalAlerts = alerts.filter(
      (a) => a.severity === "critical"
    ).length;
    const highAlerts = alerts.filter((a) => a.severity === "high").length;

    if (criticalAlerts > 0) return "critical";
    if (highAlerts > 2) return "warning";
    if (alerts.length > 5) return "warning";

    return "online";
  }

  // Generar análisis del sistema
  private async generateSystemAnalysis(
    deviceData: Map<string, DataPoint[]>
  ): Promise<SystemAnalysis> {
    const devices = Array.from(deviceData.keys());
    let totalPowerFactor = 0;
    let totalHarmonicDistortion = 0;
    let totalVoltageStability = 0;
    let deviceCount = 0;

    // Calcular métricas del sistema
    for (const [deviceId, data] of deviceData.entries()) {
      const efficiency =
        this.predictiveAnalytics.calculateEfficiencyMetrics(deviceId);
      if (efficiency) {
        totalPowerFactor += efficiency.powerFactor;
        totalHarmonicDistortion += efficiency.harmonicDistortion;
        deviceCount++;
      }

      // Calcular estabilidad de voltaje
      const voltageData = data.filter((d) => d.type === "voltage");
      if (voltageData.length > 0) {
        const values = voltageData.map((d) => d.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(
          values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
            values.length
        );
        const stability = Math.max(0, 100 - (stdDev / mean) * 100);
        totalVoltageStability += stability;
      }
    }

    const avgPowerFactor = deviceCount > 0 ? totalPowerFactor / deviceCount : 0;
    const avgHarmonicDistortion =
      deviceCount > 0 ? totalHarmonicDistortion / deviceCount : 0;
    const avgVoltageStability =
      deviceCount > 0 ? totalVoltageStability / deviceCount : 0;

    // Determinar calidad de energía
    let powerQualityRating: SystemAnalysis["powerQuality"]["rating"] =
      "excellent";
    if (
      avgPowerFactor < 0.9 ||
      avgHarmonicDistortion > 5 ||
      avgVoltageStability < 95
    ) {
      powerQualityRating = "good";
    }
    if (
      avgPowerFactor < 0.8 ||
      avgHarmonicDistortion > 8 ||
      avgVoltageStability < 90
    ) {
      powerQualityRating = "fair";
    }
    if (
      avgPowerFactor < 0.7 ||
      avgHarmonicDistortion > 10 ||
      avgVoltageStability < 85
    ) {
      powerQualityRating = "poor";
    }

    // Análisis de distribución de carga
    const loadDistribution = this.analyzeLoadDistribution(deviceData);

    // Salud general del sistema
    const overallHealth = this.calculateOverallHealth(
      powerQualityRating,
      loadDistribution
    );

    return {
      overallHealth,
      loadDistribution,
      powerQuality: {
        harmonicDistortion: avgHarmonicDistortion,
        powerFactor: avgPowerFactor,
        voltageStability: avgVoltageStability,
        rating: powerQualityRating,
      },
      networkTopology: {
        totalNodes: devices.length,
        activeConnections: devices.length, // Simplificado
        communicationErrors: 0, // Simplificado
        latency: 50, // ms, simplificado
      },
    };
  }

  // Analizar distribución de carga
  private analyzeLoadDistribution(deviceData: Map<string, DataPoint[]>) {
    const deviceLoads: number[] = [];

    for (const [deviceId, data] of deviceData.entries()) {
      const powerData = data.filter((d) => d.type === "power");
      if (powerData.length > 0) {
        const avgPower =
          powerData.reduce((sum, d) => sum + d.value, 0) / powerData.length;
        deviceLoads.push(avgPower);
      }
    }

    if (deviceLoads.length === 0) {
      return {
        balanced: true,
        imbalance: 0,
        recommendations: [],
      };
    }

    const mean = deviceLoads.reduce((a, b) => a + b, 0) / deviceLoads.length;
    const maxDeviation = Math.max(
      ...deviceLoads.map((load) => Math.abs(load - mean))
    );
    const imbalance = mean > 0 ? (maxDeviation / mean) * 100 : 0;
    const balanced = imbalance < 20;

    const recommendations: string[] = [];
    if (!balanced) {
      recommendations.push("Redistribuir cargas entre dispositivos");
      recommendations.push("Considerar balanceadores de carga automáticos");
    }

    return {
      balanced,
      imbalance,
      recommendations,
    };
  }

  // Calcular salud general del sistema
  private calculateOverallHealth(
    powerQuality: SystemAnalysis["powerQuality"]["rating"],
    loadDistribution: SystemAnalysis["loadDistribution"]
  ): SystemAnalysis["overallHealth"] {
    let score = 100;

    // Penalizar por calidad de energía
    switch (powerQuality) {
      case "poor":
        score -= 40;
        break;
      case "fair":
        score -= 25;
        break;
      case "good":
        score -= 10;
        break;
    }

    // Penalizar por desbalance de carga
    if (!loadDistribution.balanced) {
      score -= loadDistribution.imbalance;
    }

    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 60) return "fair";
    if (score >= 40) return "poor";
    return "critical";
  }

  // Generar predicciones
  private async generatePredictions(
    deviceIds: string[]
  ): Promise<ForecastResult[]> {
    const predictions: ForecastResult[] = [];

    for (const deviceId of deviceIds) {
      const dataTypes = ["voltage", "current", "power"];

      for (const dataType of dataTypes) {
        const forecast = await this.machineLearning.generateForecast(
          deviceId,
          dataType,
          24
        );
        if (forecast) {
          predictions.push(forecast);
        }
      }
    }

    return predictions;
  }

  // Generar recomendaciones
  private async generateRecommendations(
    deviceReports: DeviceReport[],
    systemAnalysis: SystemAnalysis
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    let recId = 1;

    // Recomendaciones de eficiencia
    const lowEfficiencyDevices = deviceReports.filter(
      (d) => d.efficiency.energyEfficiency < 80
    );
    if (lowEfficiencyDevices.length > 0) {
      recommendations.push({
        id: `rec_${recId++}`,
        category: "efficiency",
        priority: "high",
        title: "Mejorar Eficiencia Energética",
        description: `${lowEfficiencyDevices.length} dispositivos operan con baja eficiencia (<80%)`,
        impact: {
          energySavings: lowEfficiencyDevices.length * 100, // kWh/mes estimado
          costSavings: lowEfficiencyDevices.length * 100 * 148.3, // CLP/mes
          co2Reduction: lowEfficiencyDevices.length * 40, // kg CO2/mes
        },
        implementation: {
          effort: "medium",
          cost: "medium",
          timeframe: "2-4 semanas",
          steps: [
            "Auditoría energética detallada",
            "Optimización de configuraciones",
            "Reemplazo de componentes ineficientes",
          ],
        },
        devices: lowEfficiencyDevices.map((d) => d.deviceId),
      });
    }

    // Recomendaciones de mantenimiento
    const maintenanceDevices = deviceReports.filter(
      (d) => d.maintenance.maintenanceScore < 70
    );
    if (maintenanceDevices.length > 0) {
      recommendations.push({
        id: `rec_${recId++}`,
        category: "maintenance",
        priority: "high",
        title: "Mantenimiento Preventivo Urgente",
        description: `${maintenanceDevices.length} dispositivos requieren mantenimiento inmediato`,
        impact: {
          reliabilityImprovement: 25,
        },
        implementation: {
          effort: "high",
          cost: "medium",
          timeframe: "1-2 semanas",
          steps: [
            "Inspección técnica completa",
            "Reemplazo de componentes desgastados",
            "Calibración de sistemas",
          ],
        },
        devices: maintenanceDevices.map((d) => d.deviceId),
      });
    }

    // Recomendaciones de calidad de energía
    if (
      systemAnalysis.powerQuality.rating === "poor" ||
      systemAnalysis.powerQuality.rating === "fair"
    ) {
      recommendations.push({
        id: `rec_${recId++}`,
        category: "efficiency",
        priority: "medium",
        title: "Mejorar Calidad de Energía",
        description: "La calidad de energía del sistema requiere mejoras",
        impact: {
          energySavings: 200,
          costSavings: 29660,
          reliabilityImprovement: 15,
        },
        implementation: {
          effort: "high",
          cost: "high",
          timeframe: "1-3 meses",
          steps: [
            "Instalar filtros armónicos",
            "Mejorar factor de potencia",
            "Estabilizar voltaje",
          ],
        },
        devices: deviceReports.map((d) => d.deviceId),
      });
    }

    return recommendations;
  }

  // Generar gráficos
  private async generateCharts(
    deviceData: Map<string, DataPoint[]>,
    config: ReportConfig
  ): Promise<ChartData[]> {
    const charts: ChartData[] = [];

    // Gráfico de consumo energético por dispositivo
    const powerChart = this.generatePowerConsumptionChart(deviceData);
    if (powerChart) charts.push(powerChart);

    // Gráfico de eficiencia por dispositivo
    const efficiencyChart = this.generateEfficiencyChart(deviceData);
    if (efficiencyChart) charts.push(efficiencyChart);

    // Gráfico de tendencias temporales
    const trendChart = this.generateTrendChart(deviceData);
    if (trendChart) charts.push(trendChart);

    // Mapa de calor de alertas
    const alertHeatmap = this.generateAlertHeatmap(deviceData);
    if (alertHeatmap) charts.push(alertHeatmap);

    return charts;
  }

  // Generar gráfico de consumo energético
  private generatePowerConsumptionChart(
    deviceData: Map<string, DataPoint[]>
  ): ChartData | null {
    const data: any[] = [];

    for (const [deviceId, points] of deviceData.entries()) {
      const powerData = points.filter((d) => d.type === "power");
      if (powerData.length > 0) {
        const avgPower =
          powerData.reduce((sum, d) => sum + d.value, 0) / powerData.length;
        data.push({
          device: `Dispositivo ${deviceId}`,
          power: avgPower / 1000, // kW
        });
      }
    }

    if (data.length === 0) return null;

    return {
      id: "power_consumption",
      title: "Consumo Energético por Dispositivo",
      type: "bar",
      data,
      config: {
        xAxis: "device",
        yAxis: "power",
        unit: "kW",
      },
    };
  }

  // Generar gráfico de eficiencia
  private generateEfficiencyChart(
    deviceData: Map<string, DataPoint[]>
  ): ChartData | null {
    const data: any[] = [];

    for (const [deviceId] of deviceData.entries()) {
      const efficiency =
        this.predictiveAnalytics.calculateEfficiencyMetrics(deviceId);
      if (efficiency) {
        data.push({
          device: `Dispositivo ${deviceId}`,
          efficiency: efficiency.energyEfficiency,
          powerFactor: efficiency.powerFactor * 100,
        });
      }
    }

    if (data.length === 0) return null;

    return {
      id: "efficiency_chart",
      title: "Eficiencia Energética por Dispositivo",
      type: "bar",
      data,
      config: {
        xAxis: "device",
        yAxis: ["efficiency", "powerFactor"],
        unit: "%",
      },
    };
  }

  // Generar gráfico de tendencias
  private generateTrendChart(
    deviceData: Map<string, DataPoint[]>
  ): ChartData | null {
    const data: any[] = [];

    // Tomar datos de los últimos 7 días
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const [deviceId, points] of deviceData.entries()) {
      const recentData = points.filter(
        (d) => d.timestamp >= sevenDaysAgo && d.type === "power"
      );

      recentData.forEach((point) => {
        data.push({
          timestamp: point.timestamp,
          device: `Dispositivo ${deviceId}`,
          value: point.value / 1000, // kW
        });
      });
    }

    if (data.length === 0) return null;

    return {
      id: "trend_chart",
      title: "Tendencias de Consumo (Últimos 7 días)",
      type: "line",
      data,
      config: {
        xAxis: "timestamp",
        yAxis: "value",
        groupBy: "device",
        unit: "kW",
      },
    };
  }

  // Generar mapa de calor de alertas
  private generateAlertHeatmap(
    deviceData: Map<string, DataPoint[]>
  ): ChartData | null {
    const data: any[] = [];
    const devices = Array.from(deviceData.keys());

    // Crear matriz de alertas por dispositivo y hora del día
    for (const deviceId of devices) {
      const deviceAlerts = this.generateDeviceAlerts(
        deviceId,
        deviceData.get(deviceId) || []
      );

      for (let hour = 0; hour < 24; hour++) {
        const hourAlerts = deviceAlerts.filter(
          (a) => a.timestamp.getHours() === hour
        );
        data.push({
          device: `Dispositivo ${deviceId}`,
          hour,
          alerts: hourAlerts.length,
          severity:
            hourAlerts.length > 0
              ? Math.max(
                  ...hourAlerts.map((a) =>
                    a.severity === "critical"
                      ? 4
                      : a.severity === "high"
                      ? 3
                      : a.severity === "medium"
                      ? 2
                      : 1
                  )
                )
              : 0,
        });
      }
    }

    if (data.length === 0) return null;

    return {
      id: "alert_heatmap",
      title: "Mapa de Calor de Alertas por Hora",
      type: "heatmap",
      data,
      config: {
        xAxis: "hour",
        yAxis: "device",
        value: "severity",
        colorScale: ["#green", "#yellow", "#orange", "#red"],
      },
    };
  }

  // Calcular período del reporte
  private calculateReportPeriod(
    type: ReportConfig["type"],
    customRange?: { start: Date; end: Date }
  ): { start: Date; end: Date } {
    const now = new Date();

    if (customRange) {
      return customRange;
    }

    switch (type) {
      case "daily":
        return {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: now,
        };
      case "weekly":
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case "monthly":
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now,
        };
      default:
        return {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: now,
        };
    }
  }

  // Obtener eficiencia por defecto
  private getDefaultEfficiency(deviceId: string): EfficiencyMetrics {
    return {
      deviceId,
      energyEfficiency: 75,
      powerFactor: 0.85,
      harmonicDistortion: 3,
      loadBalance: 90,
      costPerKwh: 148.3,
      carbonFootprint: 0.4,
      recommendations: ["Monitoreo continuo recomendado"],
    };
  }

  // Configurar reporte automático
  configureAutomaticReport(config: ReportConfig): void {
    this.reportConfigs.set(config.id, config);
    logger.info(`📊 Reporte automático configurado: ${config.name}`);
  }

  // Obtener reportes generados
  getGeneratedReports(): ComprehensiveReport[] {
    return Array.from(this.generatedReports.values());
  }

  // Obtener configuraciones de reportes
  getReportConfigs(): ReportConfig[] {
    return Array.from(this.reportConfigs.values());
  }
}
