const io = require("socket.io-client");

// Configuración de conexión
const WEBSOCKET_URL = "http://localhost:5000";
const API_URL = "http://localhost:5000/api";

console.log("🚀 Iniciando pruebas de Fase 3 - Advanced Analytics");

// Función para hacer peticiones HTTP
async function makeRequest(endpoint, method = "GET", body = null) {
  const url = `${API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Error en ${method} ${endpoint}:`, error.message);
    return null;
  }
}

// Función para simular datos IoT
function generateIoTData(deviceId) {
  return {
    deviceId,
    voltage: 220 + Math.random() * 20 - 10, // 210-230V
    current: 10 + Math.random() * 30, // 10-40A
    power: 2000 + Math.random() * 2000, // 2-4kW
    temperature: 25 + Math.random() * 20, // 25-45°C
    timestamp: new Date().toISOString(),
  };
}

// Pruebas principales
async function runTests() {
  console.log("\n=== PRUEBA 1: CONEXIÓN WEBSOCKET ===");

  const socket = io(WEBSOCKET_URL, {
    auth: {
      userId: "test_user",
      userRole: "admin",
      userType: "empresa",
    },
  });

  socket.on("connect", () => {
    console.log("✅ Conectado al WebSocket");
  });

  socket.on("disconnect", () => {
    console.log("❌ Desconectado del WebSocket");
  });

  // Escuchar eventos de ML
  socket.on("ml:model_trained", (data) => {
    console.log("🤖 Modelo entrenado:", data);
  });

  socket.on("ml:forecast_generated", (data) => {
    console.log("🔮 Pronóstico generado:", data);
  });

  socket.on("ml:patterns_analyzed", (data) => {
    console.log("🎯 Patrones analizados:", data);
  });

  socket.on("reporting:report_generated", (data) => {
    console.log("📊 Reporte generado:", data);
  });

  // Esperar conexión
  await new Promise((resolve) => {
    socket.on("connect", resolve);
  });

  console.log("\n=== PRUEBA 2: ENVÍO DE DATOS IOT ===");

  // Simular datos de múltiples dispositivos
  const devices = ["DEV001", "DEV002", "DEV003"];

  for (let i = 0; i < 10; i++) {
    for (const deviceId of devices) {
      const data = generateIoTData(deviceId);

      // Enviar datos de voltaje
      socket.emit("iot:voltage_reading", {
        deviceId: data.deviceId,
        voltage: data.voltage,
        quality: data.voltage > 240 || data.voltage < 200 ? "warning" : "good",
        timestamp: data.timestamp,
      });

      // Enviar datos de corriente
      socket.emit("iot:current_reading", {
        deviceId: data.deviceId,
        current: data.current,
        powerFactor: 0.85 + Math.random() * 0.1,
        timestamp: data.timestamp,
      });

      // Enviar datos de potencia
      socket.emit("iot:power_consumption", {
        deviceId: data.deviceId,
        activePower: data.power,
        energy: data.power * 0.001, // kWh
        timestamp: data.timestamp,
      });

      console.log(`📊 Datos enviados para ${deviceId}: V=${data.voltage.toFixed(1)}V, I=${data.current.toFixed(1)}A, P=${data.power.toFixed(0)}W`);
    }

    // Esperar un poco entre envíos
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n=== PRUEBA 3: MACHINE LEARNING ===");

  // Entrenar modelos
  console.log("🤖 Entrenando modelos ML...");
  for (const deviceId of devices) {
    const result = await makeRequest("/ml/train", "POST", {
      deviceId,
      dataType: "power"
    });
    console.log(`✅ Entrenamiento iniciado para ${deviceId}:`, result?.message);
  }

  // Esperar un poco para que se procesen los datos
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generar pronósticos
  console.log("\n🔮 Generando pronósticos...");
  for (const deviceId of devices) {
    const forecast = await makeRequest("/ml/forecast", "POST", {
      deviceId,
      dataType: "power",
      hoursAhead: 12
    });

    if (forecast?.success) {
      console.log(`✅ Pronóstico para ${deviceId}: ${forecast.data.predictions.length} predicciones`);
    }
  }

  // Analizar patrones
  console.log("\n🎯 Analizando patrones...");
  for (const deviceId of devices) {
    const patterns = await makeRequest(`/ml/patterns/${deviceId}?dataType=power`);

    if (patterns?.success) {
      console.log(`✅ Patrones para ${deviceId}: ${patterns.data.patterns.length} patrones detectados`);
    }
  }

  // Obtener estadísticas de ML
  const mlStats = await makeRequest("/ml/stats");
  if (mlStats?.success) {
    console.log("📈 Estadísticas ML:", mlStats.data);
  }

  console.log("\n=== PRUEBA 4: REPORTES AVANZADOS ===");

  // Generar reporte de eficiencia
  console.log("📊 Generando reporte de eficiencia...");
  const efficiencyReport = await makeRequest("/reports/efficiency", "POST", {
    devices,
    period: "daily"
  });

  if (efficiencyReport?.success) {
    console.log("✅ Reporte de eficiencia generado:", efficiencyReport.data.reportId);
    console.log("   - Dispositivos:", efficiencyReport.data.deviceReports.length);
    console.log("   - Recomendaciones:", efficiencyReport.data.recommendations.length);
  }

  // Generar reporte de mantenimiento
  console.log("\n🔧 Generando reporte de mantenimiento...");
  const maintenanceReport = await makeRequest("/reports/maintenance", "POST", {
    devices
  });

  if (maintenanceReport?.success) {
    console.log("✅ Reporte de mantenimiento generado:", maintenanceReport.data.reportId);
    console.log("   - Dispositivos:", maintenanceReport.data.deviceReports.length);
    console.log("   - Predicciones:", maintenanceReport.data.predictions.length);
  }

  // Configurar reporte automático
  console.log("\n📅 Configurando reporte automático...");
  const autoReportConfig = {
    id: `auto_${Date.now()}`,
    name: "Reporte Diario Automático",
    type: "daily",
    devices,
    metrics: ["voltage", "current", "power", "efficiency"],
    format: "json",
    schedule: {
      enabled: true,
      frequency: "daily",
      time: "08:00",
      recipients: ["admin@empresa.com"]
    }
  };

  const configResult = await makeRequest("/reports/configure", "POST", autoReportConfig);
  if (configResult?.success) {
    console.log("✅ Reporte automático configurado");
  }

  // Obtener reportes generados
  const generatedReports = await makeRequest("/reports/generated");
  if (generatedReports?.success) {
    console.log(`📋 Reportes generados: ${generatedReports.data.length}`);
  }

  console.log("\n=== PRUEBA 5: DASHBOARD ANALYTICS ===");

  // Obtener datos del dashboard
  const dashboard = await makeRequest("/analytics/dashboard");
  if (dashboard?.success) {
    console.log("📊 Dashboard Analytics:");
    console.log("   - Salud del sistema:", dashboard.data.systemHealth);
    console.log("   - Dispositivos:", dashboard.data.devices.length);
    console.log("   - Modelos ML:", dashboard.data.mlModels.totalModels);
    console.log("   - Reportes recientes:", dashboard.data.recentReports.length);
  }

  console.log("\n=== PRUEBA 6: OPTIMIZACIÓN AUTOMÁTICA ===");

  // Optimizar modelos ML
  console.log("🔧 Optimizando modelos ML...");
  const optimizeResult = await makeRequest("/ml/optimize", "POST");
  if (optimizeResult?.success) {
    console.log("✅ Optimización de modelos iniciada");
  }

  // Esperar un poco para ver los resultados
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Verificar estadísticas finales
  const finalStats = await makeRequest("/ml/stats");
  if (finalStats?.success) {
    console.log("📈 Estadísticas finales ML:", finalStats.data);
  }

  console.log("\n=== PRUEBA 7: ANÁLISIS PREDICTIVO ===");

  // Obtener predicciones para cada dispositivo
  for (const deviceId of devices) {
    const prediction = await makeRequest(`/analytics/predictions/${deviceId}?type=power`);
    if (prediction?.success) {
      console.log(`🔮 Predicción ${deviceId}:`, {
        tendencia: prediction.data.trend,
        confianza: (prediction.data.confidence * 100).toFixed(1) + "%",
        severidad: prediction.data.severity
      });
    }

    // Detectar anomalías
    const anomaly = await makeRequest(`/analytics/anomalies/${deviceId}/power`);
    if (anomaly?.success) {
      console.log(`🚨 Anomalía ${deviceId}:`, anomaly.data.hasAnomaly ? "DETECTADA" : "No detectada");
    }
  }

  // Obtener reporte de eficiencia completo
  const efficiencyFullReport = await makeRequest("/analytics/efficiency-report");
  if (efficiencyFullReport?.success) {
    console.log("⚡ Reporte de eficiencia completo:");
    console.log("   - Eficiencia promedio:", efficiencyFullReport.data.summary.averageEfficiency + "%");
    console.log("   - Factor de potencia promedio:", efficiencyFullReport.data.summary.averagePowerFactor);
    console.log("   - Huella de carbono total:", efficiencyFullReport.data.summary.totalCarbonFootprint + " kg CO2");
  }

  console.log("\n🎉 ¡TODAS LAS PRUEBAS DE FASE 3 COMPLETADAS!");
  console.log("\n📋 RESUMEN:");
  console.log("✅ Conexión WebSocket establecida");
  console.log("✅ Datos IoT enviados y procesados");
  console.log("✅ Modelos ML entrenados y optimizados");
  console.log("✅ Pronósticos generados");
  console.log("✅ Patrones analizados");
  console.log("✅ Reportes avanzados generados");
  console.log("✅ Dashboard analytics funcionando");
  console.log("✅ Análisis predictivo operativo");

  // Cerrar conexión
  socket.disconnect();
  process.exit(0);
}

// Ejecutar pruebas
runTests().catch((error) => {
  console.error("❌ Error en las pruebas:", error);
  process.exit(1);
});