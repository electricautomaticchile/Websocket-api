// Tipos específicos para WebSocket API

// Tipos base
export interface BaseEventData {
  timestamp: Date;
  userId?: string;
  deviceId?: string;
}

// Tipos de usuario
export type UserRole = "cliente" | "empresa" | "superadmin";
export type UserType = "cliente" | "empresa" | "superadmin";

// Tipos de conexión
import { Socket } from "socket.io";

export interface UserSocket extends Socket {
  userId?: string;
  userRole?: UserRole;
  userType?: UserType;
}

// Tipos de dispositivos IoT
export interface DeviceConnectionData extends BaseEventData {
  deviceId: string;
  status: "connected" | "disconnected" | "reconnecting";
  lastSeen?: Date;
  metadata?: DeviceMetadata;
}

export interface DeviceMetadata {
  signalStrength?: number;
  batteryLevel?: number;
  firmwareVersion?: string;
  location?: string;
  installationDate?: Date;
  lastMaintenance?: Date;
}

// Tipos de datos IoT
export interface VoltageReadingData extends BaseEventData {
  deviceId: string;
  voltage: number;
  phase?: "L1" | "L2" | "L3";
  quality: "good" | "warning" | "critical";
  location?: string;
}

export interface CurrentReadingData extends BaseEventData {
  deviceId: string;
  current: number;
  phase?: "L1" | "L2" | "L3";
  powerFactor?: number;
  location?: string;
}

export interface PowerConsumptionData extends BaseEventData {
  deviceId: string;
  activePower: number;
  reactivePower?: number;
  apparentPower?: number;
  energy: number;
  cost?: number;
  location?: string;
}

export interface DeviceReconnectionData extends BaseEventData {
  deviceId: string;
  previousStatus: string;
  reconnectionTime: number;
  attempts: number;
  success: boolean;
}

// Tipos de alertas
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertType = "error" | "warning" | "info" | "success";

export interface AlertData extends BaseEventData {
  type: AlertType;
  title: string;
  message: string;
  deviceId: string;
  severity: AlertSeverity;
  source?: string;
}

export interface PowerOutageAlertData extends BaseEventData {
  deviceId: string;
  location: string;
  affectedDevices?: string[];
  estimatedDuration?: number;
}

export interface VoltageAnomalyAlertData extends BaseEventData {
  deviceId: string;
  currentVoltage: number;
  expectedVoltage: number;
  deviation: number;
  phase?: string;
}

// Tipos de control
export interface SwitchStateData extends BaseEventData {
  deviceId: string;
  switchId: string;
  state: "on" | "off" | "auto";
  controlledBy?: string;
  reason?: string;
}

export interface EmergencyStopData extends BaseEventData {
  deviceId: string;
  reason: string;
  triggeredBy: string;
  affectedSystems: string[];
}

// Tipos de hardware
export type HardwareCommand = "on" | "off" | "toggle" | "status" | "reset";
export type HardwareTarget = "led" | "relay" | "sensor" | "system";

export interface ArduinoCommandData extends BaseEventData {
  deviceId: string;
  command: HardwareCommand;
  target?: HardwareTarget;
  parameters?: HardwareParameters;
}

export interface HardwareParameters {
  duration?: number;
  intensity?: number;
  mode?: string;
  config?: Record<string, unknown>;
}

export interface CommandResultData extends BaseEventData {
  commandId: string;
  deviceId: string;
  success: boolean;
  result?: CommandResult;
  error?: string;
  executionTime?: number;
}

export interface CommandResult {
  status: string;
  data?: Record<string, unknown>;
  message?: string;
}

export interface SensorReadingData extends BaseEventData {
  deviceId: string;
  sensorType: "temperature" | "humidity" | "pressure" | "light";
  value: number;
  unit: string;
  location?: string;
}

export interface RelayControlData extends BaseEventData {
  deviceId: string;
  relayId: string;
  action: "on" | "off" | "toggle";
  duration?: number;
  priority?: "low" | "medium" | "high";
}

export interface DeviceConfigurationData extends BaseEventData {
  deviceId: string;
  configType: "device" | "network" | "security" | "performance";
  configuration: ConfigurationSettings;
  applyImmediately?: boolean;
}

export interface ConfigurationSettings {
  [key: string]: unknown;
}

export interface PerformanceMetricsData extends BaseEventData {
  deviceId: string;
  cpuUsage?: number;
  memoryUsage?: number;
  temperature?: number;
  uptime: number;
  networkLatency?: number;
  errorCount?: number;
}

// Tipos de notificaciones
export interface NotificationData extends BaseEventData {
  targetUserId?: string;
  targetRole?: UserRole;
  message: string;
  type: string;
  title?: string;
  priority?: "low" | "medium" | "high";
}

// Tipos de Machine Learning
export interface MLTrainingData extends BaseEventData {
  deviceId: string;
  dataType: string;
}

export interface MLForecastData extends BaseEventData {
  deviceId: string;
  dataType: string;
  hoursAhead: number;
}

export interface MLPatternAnalysisData extends BaseEventData {
  deviceId: string;
  dataType: string;
}

export interface MLModelTrainedData extends BaseEventData {
  deviceId: string;
  dataType: string;
  modelType: string;
  accuracy: number;
}

export interface MLForecastGeneratedData extends BaseEventData {
  deviceId: string;
  dataType: string;
  forecast: ForecastResult;
}

export interface ForecastResult {
  predictions: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
  }>;
  accuracy: number;
  modelUsed: string;
}

export interface MLPatternsAnalyzedData extends BaseEventData {
  deviceId: string;
  dataType: string;
  patterns: PatternAnalysisResult;
}

export interface PatternAnalysisResult {
  patterns: Array<{
    type: "daily" | "weekly" | "seasonal" | "anomaly";
    description: string;
    confidence: number;
    impact: "low" | "medium" | "high";
  }>;
  seasonality: {
    detected: boolean;
    period: number;
    strength: number;
  };
  trends: {
    shortTerm: "increasing" | "decreasing" | "stable";
    longTerm: "increasing" | "decreasing" | "stable";
    changePoints: Date[];
  };
}

// Tipos de reportes
export interface ReportGenerationData extends BaseEventData {
  reportId: string;
  title: string;
  summary: ReportSummary;
}

export interface ReportSummary {
  totalDevices: number;
  averageEfficiency: number;
  criticalAlerts: number;
  energyConsumption: number;
  estimatedCost: number;
}

export interface AutoReportConfigData extends BaseEventData {
  configId: string;
  name: string;
  schedule: ReportSchedule;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  recipients: string[];
}

export interface CriticalRecommendationsData extends BaseEventData {
  reportId: string;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  category: "efficiency" | "maintenance" | "safety" | "cost" | "environmental";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  impact: RecommendationImpact;
}

export interface RecommendationImpact {
  energySavings?: number;
  costSavings?: number;
  co2Reduction?: number;
  reliabilityImprovement?: number;
}

// Tipos de eventos WebSocket
export type WebSocketEvent =
  | "connection"
  | "disconnect"
  | "room:join"
  | "room:leave"
  | "iot:data"
  | "iot:alert"
  | "device:connection_status"
  | "device:voltage_reading"
  | "device:current_reading"
  | "device:power_consumption"
  | "device:reconnection"
  | "alert:power_outage"
  | "alert:voltage_anomaly"
  | "control:switch_state"
  | "control:emergency_stop"
  | "hardware:arduino_command"
  | "hardware:command_result"
  | "hardware:sensor_reading"
  | "hardware:relay_control"
  | "hardware:configure"
  | "hardware:performance_metrics"
  | "notification:send"
  | "ml:train"
  | "ml:forecast"
  | "ml:analyze_patterns"
  | "ml:optimize"
  | "ml:model_trained"
  | "ml:forecast_generated"
  | "ml:patterns_analyzed"
  | "ml:models_optimized"
  | "ml:critical_predictions"
  | "reporting:generate"
  | "reporting:configure"
  | "reporting:report_generated"
  | "reporting:auto_report_configured"
  | "reporting:critical_recommendations";

// Tipos de datos de eventos
export type WebSocketEventData =
  | DeviceConnectionData
  | VoltageReadingData
  | CurrentReadingData
  | PowerConsumptionData
  | DeviceReconnectionData
  | AlertData
  | PowerOutageAlertData
  | VoltageAnomalyAlertData
  | SwitchStateData
  | EmergencyStopData
  | ArduinoCommandData
  | CommandResultData
  | SensorReadingData
  | RelayControlData
  | DeviceConfigurationData
  | PerformanceMetricsData
  | NotificationData
  | MLTrainingData
  | MLForecastData
  | MLPatternAnalysisData
  | MLModelTrainedData
  | MLForecastGeneratedData
  | MLPatternsAnalyzedData
  | ReportGenerationData
  | AutoReportConfigData
  | CriticalRecommendationsData;
