#!/usr/bin/env node

/**
 * Script de prueba para análisis predictivo y métricas de eficiencia
 * Genera datos históricos y ejecuta análisis en tiempo real
 */

const axios = require('axios');

const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL || 'http://localhost:5000';

// Configuración de dispositivos para análisis
const ANALYTICS_DEVICES = [
  {
    id: 'DEV001',
    name: 'Medidor Principal',
    location: 'Edificio Central',
    baseVoltage: 220,
    baseCurrent: 25,
    basePower: 5000,
    efficiency: 85
  },
  {
    id: 'DEV002',
    name: 'Medidor Secundario',
    location: 'Edificio Norte',
    baseVoltage: 220,
    baseCurrent: 20,
    basePower: 4000,
    efficiency: 78
  },
  {
    id: 'DEV003',
    name: 'Medidor Crítico',
    location: 'Sala de Servidores',
    baseVoltage: 220,
    baseCurrent: 35,
    basePower: 7000,
    efficiency: 92
  }
];

// Función para generar datos con tendencias realistas
function generateTrendingData(device, type, iteration) {
  const time = iteration * 5; // 5 minutos por iteración
  let baseValue, trend, noise;

  switch (type) {
    case 'voltage':
      baseValue = device.baseVoltage;
      // Tendencia: ligera caída durante el día
      trend = -0.1 * Math.sin(time / 60) - 0.05 * (time / 1440); // Caída gradual
      noise = (Math.random() - 0.5) * 5; // ±2.5V de ruido
      break;

    case 'current':
      baseValue = device.baseCurrent;
      // Tendencia: aumento gradual por calentamiento
      trend = 0.02 * time / 60 + 0.5 * Math.sin(time / 120); // Aumento gradual + ciclos
      noise = (Math.random() - 0.5) * 2; // ±1A de ruido
      break;

    case 'power':
      baseValue = device.basePower;
      // Tendencia: aumento por demanda creciente
      trend = 10 * Math.sin(time / 180) + 2 * (time / 1440); // Ciclos + crecimiento
      noise = (Math.random() - 0.5) * 200; // ±100W de ruido
      break;

    case 'temperature':
      baseValue = 35;
      // Tendencia: calentamiento gradual
      trend = 0.1 * (time / 60) + 5 * Math.sin(time / 240); // Calentamiento + ciclos térmicos
      noise = (Math.random() - 0.5) * 3; // ±1.5°C de ruido
      break;

    default:
      baseValue = 50;
      trend = 0;
      noise = (Math.random() - 0.5) * 10;
  }

  return Math.max(0, baseValue + trend + noise);
}

// Función para enviar datos con tendencias
async function sendTrendingData(device, type, iteration) {
  try {
    const value = generateTrendingData(device, type, iteration);
    let endpoint, payload;

    switch (type) {
      case 'voltage':
        endpoint = '/api/iot/voltage';
        payload = {
          deviceId: device.id,
          voltage: value,
          phase: 'L1',
          quality: value > 200 && value < 250 ? 'good' : 'warning',
          location: device.location
        };
        break;

      case 'current':
        endpoint = '/api/iot/current';
        payload = {
          deviceId: device.id,
          current: value,
          phase: 'L1',
          powerFactor: 0.85 + Math.random() * 0.15,
          location: device.location
        };
        break;

      case 'power':
        endpoint = '/api/iot/power';
        payload = {
          deviceId: device.id,
          activePower: value,
          energy: value / 1000, // kWh
          cost: (value / 1000) * 148.3,
          location: device.location
        };
        break;

      case 'temperature':
        endpoint = '/api/hardware/sensor';
        payload = {
          deviceId: device.id,
          sensorType: 'temperature',
          value: value,
          unit: '°C',
          location: device.location,
          calibrated: true
        };
        break;
    }

    const response = await axios.post(`${WEBSOCKET_API_URL}${endpoint}`, payload);

    console.log(`📊 ${device.name}: ${type} = ${value.toFixed(2)} (Iteración ${iteration})`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error enviando ${type} para ${device.name}:`, error.message);
  }
}

// Función para generar datos históricos rápidamente
async function generateHistoricalData(device, iterations = 50) {
  console.log(`📈 Generando ${iterations} puntos históricos para ${device.name}...`);

  const types = ['voltage', 'current', 'power', 'temperature'];

  for (let i = 0; i < iterations; i++) {
    // Enviar todos los tipos de datos para esta iteración
    const promises = types.map(type => sendTrendingData(device, type, i));
    await Promise.all(promises);

    // Pequeña pausa para no saturar
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Datos históricos generados para ${device.name}`);
}

// Función para obtener y mostrar predicciones
async function getPredictions(device) {
  const types = ['voltage', 'current', 'power', 'temperature'];

  console.log(`\n🔮 Obteniendo predicciones para ${device.name}:`);

  for (const type of types) {
    try {
      const response = await axios.get(
        `${WEBSOCKET_API_URL}/api/analytics/prediction/${device.id}/${type}`
      );

      const prediction = response.data.data;
      const trendIcon = prediction.trend === 'increasing' ? '📈' :
                       prediction.trend === 'decreasing' ? '📉' : '➡️';

      console.log(`  ${trendIcon} ${type}: ${prediction.currentValue.toFixed(2)} → ${prediction.predictedValue.toFixed(2)}`);
      console.log(`     Confianza: ${(prediction.confidence * 100).toFixed(0)}%, Severidad: ${prediction.severity}`);

      if (prediction.timeToThreshold) {
        console.log(`     ⚠️ Umbral crítico en ${Math.round(prediction.timeToThreshold)} minutos`);
      }

      console.log(`     💡 ${prediction.recommendation}`);

    } catch (error) {
      console.log(`  ❌ ${type}: Sin datos suficientes para predicción`);
    }
  }
}

// Función para obtener métricas de eficiencia
async function getEfficiencyMetrics(device) {
  try {
    const response = await axios.get(
      `${WEBSOCKET_API_URL}/api/analytics/efficiency/${device.id}`
    );

    const metrics = response.data.data;

    console.log(`\n⚡ Métricas de eficiencia para ${device.name}:`);
    console.log(`  🎯 Eficiencia energética: ${metrics.energyEfficiency.toFixed(1)}%`);
    console.log(`  ⚡ Factor de potencia: ${metrics.powerFactor.toFixed(2)}`);
    console.log(`  📊 Balance de carga: ${metrics.loadBalance.toFixed(1)}%`);
    console.log(`  🌊 Distorsión armónica: ${metrics.harmonicDistortion.toFixed(1)}%`);
    console.log(`  🌱 Huella de carbono: ${metrics.carbonFootprint.toFixed(3)} kg CO₂/h`);
    console.log(`  💰 Costo: $${metrics.costPerKwh} CLP/kWh`);

    console.log(`  📋 Recomendaciones:`);
    metrics.recommendations.forEach((rec, index) => {
      console.log(`     ${index + 1}. ${rec}`);
    });

  } catch (error) {
    console.log(`❌ No se pudieron obtener métricas de eficiencia para ${device.name}`);
  }
}

// Función para detectar anomalías
async function detectAnomalies(device) {
  const types = ['voltage', 'current', 'power', 'temperature'];

  console.log(`\n🚨 Detectando anomalías para ${device.name}:`);

  let anomaliesFound = false;

  for (const type of types) {
    try {
      const response = await axios.get(
        `${WEBSOCKET_API_URL}/api/analytics/anomalies/${device.id}/${type}`
      );

      const result = response.data.data;

      if (result.hasAnomaly) {
        console.log(`  ⚠️ ${type}: ANOMALÍA DETECTADA`);
        anomaliesFound = true;
      } else {
        console.log(`  ✅ ${type}: Normal`);
      }

    } catch (error) {
      console.log(`  ❓ ${type}: Sin datos para análisis`);
    }
  }

  if (!anomaliesFound) {
    console.log(`  🎉 No se detectaron anomalías en ${device.name}`);
  }
}

// Función para obtener reporte de eficiencia global
async function getGlobalEfficiencyReport() {
  try {
    const response = await axios.get(`${WEBSOCKET_API_URL}/api/analytics/efficiency-report`);
    const report = response.data.data;

    console.log(`\n📊 REPORTE GLOBAL DE EFICIENCIA:`);
    console.log(`  📈 Dispositivos analizados: ${report.summary.totalDevices}`);
    console.log(`  ⚡ Eficiencia promedio: ${report.summary.averageEfficiency}%`);
    console.log(`  🔋 Factor de potencia promedio: ${report.summary.averagePowerFactor}`);
    console.log(`  🌱 Huella de carbono total: ${report.summary.totalCarbonFootprint} kg CO₂/h`);
    console.log(`  💰 Ahorro estimado mensual: $${report.summary.estimatedMonthlySavings} CLP`);

  } catch (error) {
    console.error('❌ Error obteniendo reporte global:', error.message);
  }
}

// Función para ejecutar análisis predictivo manual
async function triggerAnalysis() {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/analytics/trigger`);
    console.log('🔮 Análisis predictivo ejecutado manualmente');
    return response.data;
  } catch (error) {
    console.error('❌ Error ejecutando análisis:', error.message);
  }
}

// Función principal de simulación
async function runAnalyticsSimulation() {
  console.log('🚀 Iniciando simulación de análisis predictivo...');
  console.log(`📡 Conectando a WebSocket API: ${WEBSOCKET_API_URL}`);
  console.log(`🏭 Dispositivos para análisis: ${ANALYTICS_DEVICES.length}`);
  console.log('─'.repeat(80));

  // Fase 1: Generar datos históricos para cada dispositivo
  console.log('\n📈 FASE 1: Generando datos históricos...');
  for (const device of ANALYTICS_DEVICES) {
    await generateHistoricalData(device, 100); // 100 puntos históricos
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre dispositivos
  }

  // Fase 2: Ejecutar análisis predictivo
  console.log('\n🔮 FASE 2: Ejecutando análisis predictivo...');
  await triggerAnalysis();
  await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar procesamiento

  // Fase 3: Obtener y mostrar resultados
  console.log('\n📊 FASE 3: Analizando resultados...');

  for (const device of ANALYTICS_DEVICES) {
    await getPredictions(device);
    await getEfficiencyMetrics(device);
    await detectAnomalies(device);
    console.log('\n' + '─'.repeat(50));
  }

  // Fase 4: Reporte global
  await getGlobalEfficiencyReport();

  // Fase 5: Simulación continua con nuevos datos
  console.log('\n🔄 FASE 5: Iniciando simulación continua...');

  let iteration = 100; // Continuar desde donde terminamos
  const continuousInterval = setInterval(async () => {
    iteration++;
    console.log(`\n📊 Iteración continua ${iteration} - ${new Date().toLocaleTimeString()}`);

    // Enviar nuevos datos para todos los dispositivos
    for (const device of ANALYTICS_DEVICES) {
      const types = ['voltage', 'current', 'power', 'temperature'];
      for (const type of types) {
        setTimeout(() => sendTrendingData(device, type, iteration), Math.random() * 2000);
      }
    }

    // Ejecutar análisis cada 10 iteraciones
    if (iteration % 10 === 0) {
      console.log('🔮 Ejecutando análisis predictivo automático...');
      await triggerAnalysis();
    }

  }, 30000); // Cada 30 segundos

  // Manejar cierre graceful
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo simulación de análisis...');
    clearInterval(continuousInterval);
    console.log('✅ Simulación detenida');
    process.exit(0);
  });
}

// Verificar conectividad antes de iniciar
async function checkConnectivity() {
  try {
    const response = await axios.get(`${WEBSOCKET_API_URL}/health`);
    console.log(`✅ WebSocket API disponible: ${response.data.message}`);
    return true;
  } catch (error) {
    console.error(`❌ No se puede conectar a WebSocket API: ${error.message}`);
    console.log('💡 Asegúrate de que la WebSocket API esté ejecutándose en el puerto 5000');
    return false;
  }
}

// Ejecutar simulación
async function main() {
  const isConnected = await checkConnectivity();
  if (isConnected) {
    await runAnalyticsSimulation();
  } else {
    process.exit(1);
  }
}

main().catch(console.error);