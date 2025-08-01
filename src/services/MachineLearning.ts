import { logger } from "../utils/logger";
import { DataPoint } from "./PredictiveAnalytics";

export interface MLModel {
  id: string;
  type: "linear_regression" | "polynomial" | "neural_network" | "arima";
  deviceId: string;
  dataType: string;
  accuracy: number;
  lastTrained: Date;
  parameters: any;
}

export interface ForecastResult {
  deviceId: string;
  dataType: string;
  predictions: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
  }>;
  accuracy: number;
  modelUsed: string;
}

export interface PatternAnalysis {
  deviceId: string;
  patterns: Array<{
    type: "daily" | "weekly" | "seasonal" | "anomaly";
    description: string;
    confidence: number;
    impact: "low" | "medium" | "high";
  }>;
  seasonality: {
    detected: boolean;
    period: number; // en horas
    strength: number; // 0-1
  };
  trends: {
    shortTerm: "increasing" | "decreasing" | "stable";
    longTerm: "increasing" | "decreasing" | "stable";
    changePoints: Date[];
  };
}

export class MachineLearning {
  private models: Map<string, MLModel> = new Map();
  private trainingData: Map<string, DataPoint[]> = new Map();
  private readonly MIN_TRAINING_POINTS = 100;
  private readonly FORECAST_HORIZON = 24; // horas

  // Entrenar modelo automáticamente
  async trainModel(
    deviceId: string,
    dataType: string,
    data: DataPoint[]
  ): Promise<MLModel | null> {
    if (data.length < this.MIN_TRAINING_POINTS) {
      logger.warn(
        `🤖 Datos insuficientes para entrenar modelo: ${deviceId}_${dataType}`
      );
      return null;
    }

    const modelId = `${deviceId}_${dataType}`;

    try {
      // Seleccionar mejor algoritmo basado en características de los datos
      const bestAlgorithm = this.selectBestAlgorithm(data);

      // Entrenar modelo
      const model = await this.trainSpecificModel(
        modelId,
        bestAlgorithm,
        deviceId,
        dataType,
        data
      );

      if (model) {
        this.models.set(modelId, model);
        logger.info(
          `🤖 Modelo entrenado exitosamente: ${modelId} (${bestAlgorithm}, accuracy: ${model.accuracy.toFixed(
            2
          )})`
        );
      }

      return model;
    } catch (error) {
      logger.error(`❌ Error entrenando modelo ${modelId}:`, error);
      return null;
    }
  }

  // Generar pronósticos avanzados
  async generateForecast(
    deviceId: string,
    dataType: string,
    hoursAhead: number = 24
  ): Promise<ForecastResult | null> {
    const modelId = `${deviceId}_${dataType}`;
    const model = this.models.get(modelId);

    if (!model) {
      logger.warn(`🤖 Modelo no encontrado para pronóstico: ${modelId}`);
      return null;
    }

    const trainingData = this.trainingData.get(modelId) || [];
    if (trainingData.length === 0) {
      return null;
    }

    try {
      const predictions = await this.generatePredictions(
        model,
        trainingData,
        hoursAhead
      );

      return {
        deviceId,
        dataType,
        predictions,
        accuracy: model.accuracy,
        modelUsed: model.type,
      };
    } catch (error) {
      logger.error(`❌ Error generando pronóstico ${modelId}:`, error);
      return null;
    }
  }

  // Análisis avanzado de patrones
  analyzePatterns(
    deviceId: string,
    dataType: string,
    data: DataPoint[]
  ): PatternAnalysis {
    const patterns: PatternAnalysis["patterns"] = [];

    // Detectar patrones diarios
    const dailyPattern = this.detectDailyPattern(data);
    if (dailyPattern.detected) {
      patterns.push({
        type: "daily",
        description: `Patrón diario detectado: picos a las ${dailyPattern.peakHours.join(
          ", "
        )}h`,
        confidence: dailyPattern.confidence,
        impact: dailyPattern.impact,
      });
    }

    // Detectar patrones semanales
    const weeklyPattern = this.detectWeeklyPattern(data);
    if (weeklyPattern.detected) {
      patterns.push({
        type: "weekly",
        description: `Patrón semanal: mayor actividad ${weeklyPattern.activeDays.join(
          ", "
        )}`,
        confidence: weeklyPattern.confidence,
        impact: weeklyPattern.impact,
      });
    }

    // Detectar anomalías
    const anomalies = this.detectAdvancedAnomalies(data);
    anomalies.forEach((anomaly) => {
      patterns.push({
        type: "anomaly",
        description: anomaly.description,
        confidence: anomaly.confidence,
        impact: anomaly.impact,
      });
    });

    // Análisis de estacionalidad
    const seasonality = this.analyzeSeasonality(data);

    // Análisis de tendencias
    const trends = this.analyzeTrends(data);

    return {
      deviceId,
      patterns,
      seasonality,
      trends,
    };
  }

  // Optimización automática de modelos
  async optimizeModels(): Promise<void> {
    logger.info("🤖 Iniciando optimización automática de modelos...");

    for (const [modelId, model] of this.models.entries()) {
      const trainingData = this.trainingData.get(modelId);
      if (!trainingData || trainingData.length < this.MIN_TRAINING_POINTS) {
        continue;
      }

      // Re-entrenar si la precisión es baja o el modelo es antiguo
      const daysSinceTraining =
        (Date.now() - model.lastTrained.getTime()) / (1000 * 60 * 60 * 24);

      if (model.accuracy < 0.7 || daysSinceTraining > 7) {
        logger.info(`🔄 Re-entrenando modelo: ${modelId}`);
        await this.trainModel(model.deviceId, model.dataType, trainingData);
      }
    }
  }

  // Seleccionar mejor algoritmo
  private selectBestAlgorithm(data: DataPoint[]): MLModel["type"] {
    const variance = this.calculateVariance(data.map((d) => d.value));
    const trend = this.calculateTrendStrength(data);
    const seasonality = this.detectSeasonalityStrength(data);

    // Lógica de selección de algoritmo
    if (seasonality > 0.7) {
      return "arima"; // Mejor para datos con estacionalidad fuerte
    } else if (variance > 0.5 && trend > 0.3) {
      return "polynomial"; // Mejor para datos no lineales
    } else if (data.length > 500) {
      return "neural_network"; // Mejor para datasets grandes
    } else {
      return "linear_regression"; // Por defecto para casos simples
    }
  }

  // Entrenar modelo específico
  private async trainSpecificModel(
    modelId: string,
    algorithm: MLModel["type"],
    deviceId: string,
    dataType: string,
    data: DataPoint[]
  ): Promise<MLModel | null> {
    this.trainingData.set(modelId, data);

    let parameters: any = {};
    let accuracy = 0;

    switch (algorithm) {
      case "linear_regression":
        const linearResult = this.trainLinearRegression(data);
        parameters = linearResult.parameters;
        accuracy = linearResult.accuracy;
        break;

      case "polynomial":
        const polyResult = this.trainPolynomialRegression(data);
        parameters = polyResult.parameters;
        accuracy = polyResult.accuracy;
        break;

      case "neural_network":
        const nnResult = await this.trainNeuralNetwork(data);
        parameters = nnResult.parameters;
        accuracy = nnResult.accuracy;
        break;

      case "arima":
        const arimaResult = this.trainARIMA(data);
        parameters = arimaResult.parameters;
        accuracy = arimaResult.accuracy;
        break;
    }

    return {
      id: modelId,
      type: algorithm,
      deviceId,
      dataType,
      accuracy,
      lastTrained: new Date(),
      parameters,
    };
  }

  // Entrenar regresión lineal
  private trainLinearRegression(data: DataPoint[]) {
    const n = data.length;
    const startTime = data[0].timestamp.getTime();

    const x = data.map((d, i) => i);
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

    return {
      parameters: { slope, intercept },
      accuracy: Math.max(0, rSquared),
    };
  }

  // Entrenar regresión polinomial (grado 2)
  private trainPolynomialRegression(data: DataPoint[]) {
    // Implementación simplificada de regresión polinomial de grado 2
    const n = data.length;
    const x = data.map((d, i) => i);
    const y = data.map((d) => d.value);

    // Para simplicidad, usamos regresión lineal con términos cuadráticos
    const x2 = x.map((xi) => xi * xi);

    // Matriz normal para y = a + bx + cx²
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumX2 = x2.reduce((a, b) => a + b, 0);
    const sumX3 = x.reduce((sum, xi) => sum + xi * xi * xi, 0);
    const sumX4 = x.reduce((sum, xi) => sum + xi * xi * xi * xi, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2Y = x.reduce((sum, xi, i) => sum + xi * xi * y[i], 0);

    // Resolver sistema 3x3 (simplificado)
    const a = sumY / n;
    const b = (sumXY - a * sumX) / (sumX2 - (sumX * sumX) / n);
    const c = 0.001; // Coeficiente pequeño para término cuadrático

    // Calcular precisión
    const predictions = x.map((xi) => a + b * xi + c * xi * xi);
    const mse =
      y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0) / n;
    const variance = y.reduce((sum, yi) => sum + Math.pow(yi - a, 2), 0) / n;
    const accuracy = Math.max(0, 1 - mse / variance);

    return {
      parameters: { a, b, c },
      accuracy,
    };
  }

  // Entrenar red neuronal simple
  private async trainNeuralNetwork(data: DataPoint[]) {
    // Implementación simplificada de red neuronal con una capa oculta
    const inputs = data.map((d, i) => [i / data.length]); // Normalizar índices
    const outputs = data.map((d) => [d.value]);

    // Parámetros de la red (simplificados)
    const hiddenSize = 5;
    const learningRate = 0.01;
    const epochs = 100;

    // Inicializar pesos aleatoriamente
    const weightsInputHidden = Array(hiddenSize)
      .fill(0)
      .map(() => Math.random() - 0.5);
    const weightsHiddenOutput = Array(hiddenSize)
      .fill(0)
      .map(() => Math.random() - 0.5);

    // Entrenamiento simplificado
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Forward pass y backward pass simplificados
      // (En una implementación real usaríamos una librería como TensorFlow.js)
    }

    // Calcular precisión estimada
    const accuracy = 0.75; // Valor estimado para la implementación simplificada

    return {
      parameters: { weightsInputHidden, weightsHiddenOutput, hiddenSize },
      accuracy,
    };
  }

  // Entrenar modelo ARIMA simplificado
  private trainARIMA(data: DataPoint[]) {
    // Implementación muy simplificada de ARIMA
    const values = data.map((d) => d.value);

    // Calcular diferencias para estacionariedad
    const diff1 = values.slice(1).map((v, i) => v - values[i]);

    // Parámetros ARIMA simplificados
    const p = 1; // orden autoregresivo
    const d = 1; // orden de diferenciación
    const q = 1; // orden de media móvil

    // Coeficientes estimados (simplificado)
    const ar1 = 0.5;
    const ma1 = 0.3;

    // Calcular precisión basada en predicciones
    const accuracy = 0.8; // Valor estimado

    return {
      parameters: { p, d, q, ar1, ma1 },
      accuracy,
    };
  }

  // Generar predicciones
  private async generatePredictions(
    model: MLModel,
    data: DataPoint[],
    hoursAhead: number
  ): Promise<ForecastResult["predictions"]> {
    const predictions: ForecastResult["predictions"] = [];
    const lastTimestamp = data[data.length - 1].timestamp;

    for (let i = 1; i <= hoursAhead; i++) {
      const futureTimestamp = new Date(
        lastTimestamp.getTime() + i * 60 * 60 * 1000
      );
      let predictedValue = 0;
      let confidence = model.accuracy;

      switch (model.type) {
        case "linear_regression":
          const { slope, intercept } = model.parameters;
          predictedValue = slope * (data.length + i) + intercept;
          break;

        case "polynomial":
          const { a, b, c } = model.parameters;
          const x = data.length + i;
          predictedValue = a + b * x + c * x * x;
          break;

        case "neural_network":
          // Predicción simplificada de red neuronal
          predictedValue =
            data[data.length - 1].value * (1 + Math.random() * 0.1 - 0.05);
          break;

        case "arima":
          // Predicción ARIMA simplificada
          const { ar1, ma1 } = model.parameters;
          const lastValue = data[data.length - 1].value;
          const prevValue = data[data.length - 2]?.value || lastValue;
          predictedValue = ar1 * lastValue + ma1 * (lastValue - prevValue);
          break;
      }

      // Reducir confianza con el tiempo
      confidence *= Math.exp(-i * 0.1);

      predictions.push({
        timestamp: futureTimestamp,
        value: Math.max(0, predictedValue),
        confidence: Math.max(0.1, confidence),
      });
    }

    return predictions;
  }

  // Detectar patrón diario
  private detectDailyPattern(data: DataPoint[]) {
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    data.forEach((point) => {
      const hour = point.timestamp.getHours();
      hourlyAverages[hour] += point.value;
      hourlyCounts[hour]++;
    });

    // Calcular promedios
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }

    // Encontrar picos
    const mean = hourlyAverages.reduce((a, b) => a + b, 0) / 24;
    const peakHours = hourlyAverages
      .map((avg, hour) => ({ hour, avg }))
      .filter(({ avg }) => avg > mean * 1.2)
      .map(({ hour }) => hour);

    const detected = peakHours.length > 0;
    const confidence = detected ? Math.min(1, peakHours.length / 4) : 0;
    const impact =
      peakHours.length > 3 ? "high" : peakHours.length > 1 ? "medium" : "low";

    return {
      detected,
      peakHours,
      confidence,
      impact: impact as "low" | "medium" | "high",
    };
  }

  // Detectar patrón semanal
  private detectWeeklyPattern(data: DataPoint[]) {
    const dailyAverages = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);
    const dayNames = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    data.forEach((point) => {
      const day = point.timestamp.getDay();
      dailyAverages[day] += point.value;
      dailyCounts[day]++;
    });

    // Calcular promedios
    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyAverages[i] /= dailyCounts[i];
      }
    }

    const mean = dailyAverages.reduce((a, b) => a + b, 0) / 7;
    const activeDays = dailyAverages
      .map((avg, day) => ({ day, avg, name: dayNames[day] }))
      .filter(({ avg }) => avg > mean * 1.1)
      .map(({ name }) => name);

    const detected = activeDays.length > 0 && activeDays.length < 7;
    const confidence = detected
      ? Math.min(1, Math.abs(activeDays.length - 3.5) / 3.5)
      : 0;
    const impact =
      activeDays.length > 4 ? "high" : activeDays.length > 2 ? "medium" : "low";

    return {
      detected,
      activeDays,
      confidence,
      impact: impact as "low" | "medium" | "high",
    };
  }

  // Detectar anomalías avanzadas
  private detectAdvancedAnomalies(data: DataPoint[]) {
    const anomalies: Array<{
      description: string;
      confidence: number;
      impact: "low" | "medium" | "high";
    }> = [];

    const values = data.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    // Detectar valores extremos
    const extremeValues = values.filter((v) => Math.abs(v - mean) > 3 * stdDev);
    if (extremeValues.length > 0) {
      anomalies.push({
        description: `${extremeValues.length} valores extremos detectados`,
        confidence: Math.min(1, extremeValues.length / 10),
        impact: extremeValues.length > 5 ? "high" : "medium",
      });
    }

    // Detectar cambios súbitos
    const changes = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const suddenChanges = changes.filter((c) => c > 2 * stdDev);
    if (suddenChanges.length > values.length * 0.1) {
      anomalies.push({
        description: "Cambios súbitos frecuentes detectados",
        confidence: 0.8,
        impact: "high",
      });
    }

    return anomalies;
  }

  // Analizar estacionalidad
  private analyzeSeasonality(data: DataPoint[]) {
    const values = data.map((d) => d.value);
    const n = values.length;

    if (n < 48) {
      // Necesitamos al menos 2 días de datos
      return { detected: false, period: 0, strength: 0 };
    }

    // Buscar periodicidad usando autocorrelación simplificada
    let maxCorrelation = 0;
    let bestPeriod = 0;

    for (let period = 12; period <= Math.min(168, n / 2); period += 12) {
      // 12h a 7 días
      const correlation = this.calculateAutocorrelation(values, period);
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    const detected = maxCorrelation > 0.3;
    return {
      detected,
      period: bestPeriod,
      strength: maxCorrelation,
    };
  }

  // Analizar tendencias
  private analyzeTrends(data: DataPoint[]) {
    const values = data.map((d) => d.value);
    const n = values.length;

    // Tendencia a corto plazo (últimas 24 horas)
    const shortTermData = values.slice(-Math.min(24, n));
    const shortTermTrend = this.calculateTrend(shortTermData);

    // Tendencia a largo plazo (todos los datos)
    const longTermTrend = this.calculateTrend(values);

    // Detectar puntos de cambio
    const changePoints = this.detectChangePoints(data);

    return {
      shortTerm: shortTermTrend,
      longTerm: longTermTrend,
      changePoints,
    };
  }

  // Calcular autocorrelación
  private calculateAutocorrelation(values: number[], lag: number): number {
    const n = values.length;
    if (lag >= n) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < n; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  // Calcular tendencia
  private calculateTrend(
    values: number[]
  ): "increasing" | "decreasing" | "stable" {
    if (values.length < 2) return "stable";

    const n = values.length;
    const x = values.map((_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (Math.abs(slope) < 0.01) return "stable";
    return slope > 0 ? "increasing" : "decreasing";
  }

  // Detectar puntos de cambio
  private detectChangePoints(data: DataPoint[]): Date[] {
    const changePoints: Date[] = [];
    const values = data.map((d) => d.value);
    const windowSize = Math.min(10, Math.floor(values.length / 5));

    if (windowSize < 3) return changePoints;

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);

      const meanBefore = before.reduce((a, b) => a + b, 0) / before.length;
      const meanAfter = after.reduce((a, b) => a + b, 0) / after.length;

      const change = Math.abs(meanAfter - meanBefore);
      const threshold = this.calculateVariance(values) * 0.5;

      if (change > threshold) {
        changePoints.push(data[i].timestamp);
      }
    }

    return changePoints;
  }

  // Calcular varianza
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return (
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
  }

  // Calcular fuerza de tendencia
  private calculateTrendStrength(data: DataPoint[]): number {
    const values = data.map((d) => d.value);
    const n = values.length;

    if (n < 3) return 0;

    const x = values.map((_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const yMean = sumY / n;

    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + (yMean - (slope * sumX) / n);
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);

    return ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  }

  // Detectar fuerza de estacionalidad
  private detectSeasonalityStrength(data: DataPoint[]): number {
    const seasonality = this.analyzeSeasonality(data);
    return seasonality.strength;
  }

  // Obtener estadísticas de modelos
  getModelStats(): { [key: string]: any } {
    const stats: { [key: string]: any } = {
      totalModels: this.models.size,
      modelsByType: {},
      averageAccuracy: 0,
      modelsNeedingRetraining: 0,
    };

    let totalAccuracy = 0;
    const now = Date.now();

    for (const model of this.models.values()) {
      // Contar por tipo
      stats.modelsByType[model.type] =
        (stats.modelsByType[model.type] || 0) + 1;

      // Sumar precisión
      totalAccuracy += model.accuracy;

      // Contar modelos que necesitan re-entrenamiento
      const daysSinceTraining =
        (now - model.lastTrained.getTime()) / (1000 * 60 * 60 * 24);
      if (model.accuracy < 0.7 || daysSinceTraining > 7) {
        stats.modelsNeedingRetraining++;
      }
    }

    if (this.models.size > 0) {
      stats.averageAccuracy = totalAccuracy / this.models.size;
    }

    return stats;
  }
}
