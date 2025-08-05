import { logger } from "../utils/logger";

export interface DataPoint {
  timestamp: Date;
  value: number;
  deviceId: string;
  type: "voltage" | "current" | "power" | "temperature" | "cpu" | "memory";
}

export interface PredictionResult {
  deviceId: string;
  type: string;
  currentValue: number;
  predictedValue: number;
  trend: "increasing" | "decreasing" | "stable";
  confidence: number; // 0-1
  timeToThreshold?: number; // minutos hasta alcanzar umbral crítico
  recommendation: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface EfficiencyMetrics {
  deviceId: string;
  energyEfficiency: number; // 0-100%
  powerFactor: number;
  harmonicDistortion: number;
  loadBalance: number;
  costPerKwh: number;
  carbonFootprint: number; // kg CO2
  recommendations: string[];
}

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export class PredictiveAnalytics {
  private dataHistory: Map<string, DataPoint[]> = new Map();
  private readonly MAX_HISTORY_POINTS = 1000;
  private readonly PREDICTION_WINDOW = 30; // minutos

  // Agregar punto de datos al historial
  addDataPoint(dataPoint: DataPoint) {
    const key = `${dataPoint.deviceId}_${dataPoint.type}`;

    if (!this.dataHistory.has(key)) {
      this.dataHistory.set(key, []);
    }

    const history = this.dataHistory.get(key)!;
    history.push(dataPoint);

    // Mantener solo los últimos N puntos
    if (history.length > this.MAX_HISTORY_POINTS) {
      history.shift();
    }

    // Ordenar por timestamp
    history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Limpiar datos antiguos (más viejos que hoursToKeep)
  cleanOldData(hoursToKeep: number): void {
    const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);

    this.dataHistory.forEach((points, key) => {
      const filteredPoints = points.filter(
        (point) => point.timestamp.getTime() > cutoffTime.getTime()
      );
      this.dataHistory.set(key, filteredPoints);
    });

    logger.debug(
      `Datos antiguos eliminados (>${hoursToKeep} horas)`,
      "PredictiveAnalytics"
    );
  }

  // Análisis predictivo usando regresión lineal simple
  predictTrend(deviceId: string, type: string): PredictionResult | null {
    const key = `${deviceId}_${type}`;
    const history = this.dataHistory.get(key);

    if (!history || history.length < 10) {
      return null; // Necesitamos al menos 10 puntos para predicción
    }

    // Tomar los últimos 50 puntos para análisis
    const recentData = history.slice(-50);
    const currentValue = recentData[recentData.length - 1].value;

    // Calcular regresión lineal
    const regression = this.calculateLinearRegression(recentData);
    const predictedValue = this.extrapolateValue(
      regression,
      this.PREDICTION_WINDOW
    );

    // Determinar tendencia
    const trend = this.determineTrend(regression.slope);

    // Calcular confianza basada en R²
    const confidence = Math.max(0, Math.min(1, regression.rSquared));

    // Calcular tiempo hasta umbral crítico
    const timeToThreshold = this.calculateTimeToThreshold(
      currentValue,
      regression,
      type
    );

    // Generar recomendación
    const recommendation = this.generateRecommendation(
      type,
      currentValue,
      predictedValue,
      trend
    );

    // Determinar severidad
    const severity = this.determineSeverity(
      type,
      currentValue,
      predictedValue,
      timeToThreshold
    );

    return {
      deviceId,
      type,
      currentValue,
      predictedValue,
      trend,
      confidence,
      timeToThreshold,
      recommendation,
      severity,
    };
  }

  // Calcular métricas de eficiencia energética
  calculateEfficiencyMetrics(deviceId: string): EfficiencyMetrics | null {
    const voltageHistory = this.dataHistory.get(`${deviceId}_voltage`) || [];
    const currentHistory = this.dataHistory.get(`${deviceId}_current`) || [];
    const powerHistory = this.dataHistory.get(`${deviceId}_power`) || [];

    if (
      voltageHistory.length < 10 ||
      currentHistory.length < 10 ||
      powerHistory.length < 10
    ) {
      return null;
    }

    // Tomar datos recientes (última hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentVoltage = voltageHistory.filter(
      (d) => d.timestamp >= oneHourAgo
    );
    const recentCurrent = currentHistory.filter(
      (d) => d.timestamp >= oneHourAgo
    );
    const recentPower = powerHistory.filter((d) => d.timestamp >= oneHourAgo);

    if (
      recentVoltage.length === 0 ||
      recentCurrent.length === 0 ||
      recentPower.length === 0
    ) {
      return null;
    }

    // Calcular promedios
    const avgVoltage = this.calculateAverage(recentVoltage.map((d) => d.value));
    const avgCurrent = this.calculateAverage(recentCurrent.map((d) => d.value));
    const avgPower = this.calculateAverage(recentPower.map((d) => d.value));

    // Calcular factor de potencia
    const apparentPower = avgVoltage * avgCurrent;
    const powerFactor = apparentPower > 0 ? avgPower / apparentPower : 0;

    // Calcular eficiencia energética (simplificado)
    const theoreticalPower = avgVoltage * avgCurrent;
    const energyEfficiency =
      theoreticalPower > 0 ? (avgPower / theoreticalPower) * 100 : 0;

    // Calcular distorsión armónica (simulado)
    const harmonicDistortion = this.calculateHarmonicDistortion(
      recentVoltage,
      recentCurrent
    );

    // Calcular balance de carga (simulado)
    const loadBalance = this.calculateLoadBalance(recentCurrent);

    // Calcular costo por kWh (tarifa promedio Chile)
    const costPerKwh = 148.3; // CLP/kWh

    // Calcular huella de carbono (factor emisión Chile: 0.4 kg CO2/kWh)
    const carbonFootprint = (avgPower / 1000) * 0.4;

    // Generar recomendaciones
    const recommendations = this.generateEfficiencyRecommendations(
      energyEfficiency,
      powerFactor,
      harmonicDistortion,
      loadBalance
    );

    return {
      deviceId,
      energyEfficiency: Math.max(0, Math.min(100, energyEfficiency)),
      powerFactor: Math.max(0, Math.min(1, powerFactor)),
      harmonicDistortion,
      loadBalance,
      costPerKwh,
      carbonFootprint,
      recommendations,
    };
  }

  // Detectar anomalías usando desviación estándar
  detectAnomalies(deviceId: string, type: string): boolean {
    const key = `${deviceId}_${type}`;
    const history = this.dataHistory.get(key);

    if (!history || history.length < 20) {
      return false;
    }

    const recentData = history.slice(-20);
    const values = recentData.map((d) => d.value);
    const currentValue = values[values.length - 1];

    const mean = this.calculateAverage(values);
    const stdDev = this.calculateStandardDeviation(values, mean);

    // Anomalía si el valor actual está más de 2 desviaciones estándar de la media
    return Math.abs(currentValue - mean) > 2 * stdDev;
  }

  // Interfaces para regresión lineal movidas arriba

  // Calcular regresión lineal
  private calculateLinearRegression(data: DataPoint[]): LinearRegressionResult {
    const n = data.length;
    const startTime = data[0].timestamp.getTime();

    // Convertir timestamps a minutos relativos
    const x = data.map(
      (d) => (d.timestamp.getTime() - startTime) / (1000 * 60)
    );
    const y = data.map((d) => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calcular R²
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, rSquared };
  }

  // Extrapolar valor futuro
  private extrapolateValue(
    regression: LinearRegressionResult,
    minutesAhead: number
  ): number {
    return regression.slope * minutesAhead + regression.intercept;
  }

  // Determinar tendencia
  private determineTrend(
    slope: number
  ): "increasing" | "decreasing" | "stable" {
    if (Math.abs(slope) < 0.01) return "stable";
    return slope > 0 ? "increasing" : "decreasing";
  }

  // Calcular tiempo hasta umbral crítico
  private calculateTimeToThreshold(
    currentValue: number,
    regression: LinearRegressionResult,
    type: string
  ): number | undefined {
    const thresholds = {
      voltage: { min: 200, max: 250 },
      current: { max: 50 },
      power: { max: 5000 },
      temperature: { max: 70 },
      cpu: { max: 95 },
      memory: { max: 95 },
    };

    const threshold = thresholds[type as keyof typeof thresholds];
    if (!threshold || regression.slope === 0) return undefined;

    let targetThreshold: number;
    if ("max" in threshold && regression.slope > 0) {
      targetThreshold = threshold.max;
    } else if ("min" in threshold && regression.slope < 0) {
      targetThreshold = threshold.min;
    } else {
      return undefined;
    }

    const timeToThreshold = (targetThreshold - currentValue) / regression.slope;
    return timeToThreshold > 0 ? timeToThreshold : undefined;
  }

  // Generar recomendación
  private generateRecommendation(
    type: string,
    current: number,
    predicted: number,
    trend: string
  ): string {
    const recommendations: Record<string, Record<string, string>> = {
      voltage: {
        increasing: "Monitorear regulador de voltaje. Posible sobrevoltaje.",
        decreasing: "Verificar conexiones. Posible caída de tensión.",
        stable: "Voltaje estable dentro de parámetros normales.",
      },
      current: {
        increasing: "Revisar carga eléctrica. Posible sobrecarga.",
        decreasing: "Carga reducida. Verificar funcionamiento de equipos.",
        stable: "Corriente estable. Funcionamiento normal.",
      },
      power: {
        increasing: "Optimizar consumo energético. Revisar equipos.",
        decreasing: "Consumo reducido. Verificar operación normal.",
        stable: "Consumo estable. Eficiencia adecuada.",
      },
      temperature: {
        increasing: "Mejorar ventilación. Riesgo de sobrecalentamiento.",
        decreasing: "Temperatura descendente. Monitorear funcionamiento.",
        stable: "Temperatura estable. Condiciones normales.",
      },
      cpu: {
        increasing: "Optimizar procesos. Alto uso de CPU detectado.",
        decreasing: "Uso de CPU reducido. Funcionamiento eficiente.",
        stable: "Uso de CPU estable. Rendimiento adecuado.",
      },
      memory: {
        increasing: "Liberar memoria. Posible fuga de memoria.",
        decreasing: "Uso de memoria optimizado.",
        stable: "Uso de memoria estable.",
      },
    };

    const typeRecommendations = recommendations[type];
    if (typeRecommendations && typeRecommendations[trend]) {
      return typeRecommendations[trend];
    }

    return "Monitorear parámetro para mantener funcionamiento óptimo.";
  }

  // Determinar severidad
  private determineSeverity(
    type: string,
    current: number,
    predicted: number,
    timeToThreshold?: number
  ): "low" | "medium" | "high" | "critical" {
    if (timeToThreshold && timeToThreshold < 30) return "critical";
    if (timeToThreshold && timeToThreshold < 120) return "high";

    const change = Math.abs(predicted - current);
    const percentChange = current > 0 ? (change / current) * 100 : 0;

    if (percentChange > 50) return "high";
    if (percentChange > 25) return "medium";
    return "low";
  }

  // Calcular promedio
  private calculateAverage(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Calcular desviación estándar
  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  // Calcular distorsión armónica (simulado)
  private calculateHarmonicDistortion(
    voltage: DataPoint[],
    current: DataPoint[]
  ): number {
    // Simulación simplificada de THD
    const voltageVariation = this.calculateVariation(
      voltage.map((d) => d.value)
    );
    const currentVariation = this.calculateVariation(
      current.map((d) => d.value)
    );
    return Math.min(10, (voltageVariation + currentVariation) / 2);
  }

  // Calcular balance de carga (simulado)
  private calculateLoadBalance(current: DataPoint[]): number {
    const values = current.map((d) => d.value);
    const mean = this.calculateAverage(values);
    const maxDeviation = Math.max(...values.map((v) => Math.abs(v - mean)));
    return Math.max(0, 100 - (maxDeviation / mean) * 100);
  }

  // Calcular variación
  private calculateVariation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateAverage(values);
    const stdDev = this.calculateStandardDeviation(values, mean);
    return mean > 0 ? (stdDev / mean) * 100 : 0;
  }

  // Generar recomendaciones de eficiencia
  private generateEfficiencyRecommendations(
    efficiency: number,
    powerFactor: number,
    harmonicDistortion: number,
    loadBalance: number
  ): string[] {
    const recommendations: string[] = [];

    if (efficiency < 80) {
      recommendations.push(
        "Mejorar eficiencia energética: revisar equipos y conexiones"
      );
    }

    if (powerFactor < 0.9) {
      recommendations.push(
        "Instalar capacitores para mejorar factor de potencia"
      );
    }

    if (harmonicDistortion > 5) {
      recommendations.push(
        "Considerar filtros armónicos para reducir distorsión"
      );
    }

    if (loadBalance < 85) {
      recommendations.push(
        "Redistribuir cargas para mejorar balance del sistema"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Sistema operando con eficiencia óptima");
    }

    return recommendations;
  }

  // Obtener estadísticas del historial
  getHistoryStats(): { [key: string]: number } {
    const totalDataPoints = Array.from(this.dataHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    const deviceCount = new Set(
      Array.from(this.dataHistory.keys()).map((key) => key.split("_")[0])
    ).size;

    return {
      totalDataPoints,
      deviceCount,
      historyKeys: this.dataHistory.size,
    };
  }

  // Función duplicada eliminada - usar la implementación anterior
}
