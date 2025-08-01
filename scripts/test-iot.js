#!/usr/bin/env node

/**
 * Script de prueba para eventos IoT eléctricos
 * Simula dispositivos enviando datos en tiempo real
 */

const axios = require('axios');

const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL || 'http://localhost:5000';

// Configuración de dispositivos simulados
const DEVICES = [
  {
    id: 'DEV001',
    name: 'Medidor Principal',
    location: 'Edificio Central - Piso 1',
    nominalVoltage: 220,
    maxCurrent: 30
  },
  {
    id: 'DEV002',
    name: 'Medidor Secundario',
    location: 'Edificio Norte - Piso 2',
    nominalVoltage: 220,
    maxCurrent: 25
  },
  {
    id: 'DEV003',
    name: 'Medidor Emergencia',
    location: 'Edificio Este - Planta Baja',
    nominalVoltage: 220,
    maxCurrent: 40
  }
];

// Función para generar datos realistas
function generateRealisticData(device) {
  const baseVoltage = device.nominalVoltage;
  const baseCurrent = Math.random() * device.maxCurrent * 0.7; // 70% de capacidad máxima

  return {
    voltage: baseVoltage + (Math.random() - 0.5) * 20, // ±10V de variación
    current: baseCurrent + (Math.random() - 0.5) * 5, // ±2.5A de variación
    activePower: baseVoltage * baseCurrent * (0.85 + Math.random() * 0.15), // Factor de potencia 0.85-1.0
    energy: Math.random() * 100, // kWh acumulados
    quality: Math.random() > 0.9 ? 'warning' : 'good' // 10% probabilidad de warning
  };
}

// Función para enviar datos de voltaje
async function sendVoltageData(device, data) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/iot/voltage`, {
      deviceId: device.id,
      voltage: data.voltage,
      phase: 'L1',
      quality: data.quality,
      location: device.location
    });

    console.log(`⚡ ${device.name}: ${data.voltage.toFixed(1)}V - ${response.data.message}`);
  } catch (error) {
    console.error(`❌ Error enviando voltaje para ${device.name}:`, error.message);
  }
}

// Función para enviar datos de corriente
async function sendCurrentData(device, data) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/iot/current`, {
      deviceId: device.id,
      current: data.current,
      phase: 'L1',
      powerFactor: 0.85 + Math.random() * 0.15,
      location: device.location
    });

    console.log(`🔋 ${device.name}: ${data.current.toFixed(1)}A - ${response.data.message}`);
  } catch (error) {
    console.error(`❌ Error enviando corriente para ${device.name}:`, error.message);
  }
}

// Función para enviar datos de potencia
async function sendPowerData(device, data) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/iot/power`, {
      deviceId: device.id,
      activePower: data.activePower,
      energy: data.energy,
      cost: data.energy * 148.3, // Tarifa promedio Chile
      location: device.location
    });

    console.log(`📊 ${device.name}: ${data.activePower.toFixed(0)}W, ${data.energy.toFixed(2)}kWh - ${response.data.message}`);
  } catch (error) {
    console.error(`❌ Error enviando potencia para ${device.name}:`, error.message);
  }
}

// Función para reportar estado de conexión
async function reportConnectionStatus(device, status) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/iot/connection`, {
      deviceId: device.id,
      status: status,
      lastSeen: new Date().toISOString(),
      metadata: {
        deviceName: device.name,
        location: device.location,
        signalStrength: Math.floor(Math.random() * 100),
        firmwareVersion: '1.2.3'
      }
    });

    console.log(`🔌 ${device.name}: ${status} - ${response.data.message}`);
  } catch (error) {
    console.error(`❌ Error reportando conexión para ${device.name}:`, error.message);
  }
}

// Función para simular anomalías ocasionales
async function simulateAnomalies() {
  if (Math.random() > 0.95) { // 5% probabilidad
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const anomalyType = Math.random() > 0.5 ? 'voltage' : 'current';

    if (anomalyType === 'voltage') {
      // Simular anomalía de voltaje
      const anomalousVoltage = device.nominalVoltage + (Math.random() > 0.5 ? 50 : -50);
      await sendVoltageData(device, {
        voltage: anomalousVoltage,
        quality: 'critical'
      });
      console.log(`⚠️ ANOMALÍA: Voltaje anómalo en ${device.name}: ${anomalousVoltage.toFixed(1)}V`);
    } else {
      // Simular sobrecorriente
      const anomalousCurrent = device.maxCurrent * 1.2; // 120% de capacidad
      await sendCurrentData(device, {
        current: anomalousCurrent
      });
      console.log(`⚠️ ANOMALÍA: Sobrecorriente en ${device.name}: ${anomalousCurrent.toFixed(1)}A`);
    }
  }
}

// Función principal de simulación
async function runSimulation() {
  console.log('🚀 Iniciando simulación de dispositivos IoT eléctricos...');
  console.log(`📡 Conectando a WebSocket API: ${WEBSOCKET_API_URL}`);
  console.log(`🏭 Dispositivos simulados: ${DEVICES.length}`);
  console.log('─'.repeat(80));

  // Reportar todos los dispositivos como conectados
  for (const device of DEVICES) {
    await reportConnectionStatus(device, 'connected');
    await new Promise(resolve => setTimeout(resolve, 500)); // Esperar 500ms entre dispositivos
  }

  console.log('✅ Todos los dispositivos reportados como conectados');
  console.log('📊 Iniciando envío de datos en tiempo real...\n');

  // Ciclo principal de simulación
  let iteration = 0;
  const interval = setInterval(async () => {
    iteration++;
    console.log(`\n📈 Iteración ${iteration} - ${new Date().toLocaleTimeString()}`);

    // Enviar datos de todos los dispositivos
    for (const device of DEVICES) {
      const data = generateRealisticData(device);

      // Enviar datos con pequeños delays para simular llegada escalonada
      setTimeout(() => sendVoltageData(device, data), Math.random() * 1000);
      setTimeout(() => sendCurrentData(device, data), Math.random() * 1000 + 500);
      setTimeout(() => sendPowerData(device, data), Math.random() * 1000 + 1000);
    }

    // Simular anomalías ocasionales
    await simulateAnomalies();

    console.log(`✅ Datos enviados para ${DEVICES.length} dispositivos`);

  }, 10000); // Cada 10 segundos

  // Simular desconexiones ocasionales
  const disconnectionInterval = setInterval(async () => {
    if (Math.random() > 0.9) { // 10% probabilidad cada minuto
      const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
      console.log(`\n🔌 Simulando desconexión temporal de ${device.name}...`);

      await reportConnectionStatus(device, 'disconnected');

      // Reconectar después de 5-15 segundos
      const reconnectTime = 5000 + Math.random() * 10000;
      setTimeout(async () => {
        console.log(`🔄 Reconectando ${device.name}...`);
        await reportConnectionStatus(device, 'reconnecting');

        setTimeout(async () => {
          await reportConnectionStatus(device, 'connected');
          console.log(`✅ ${device.name} reconectado exitosamente`);
        }, 2000);
      }, reconnectTime);
    }
  }, 60000); // Cada minuto

  // Manejar cierre graceful
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo simulación...');
    clearInterval(interval);
    clearInterval(disconnectionInterval);

    // Reportar todos los dispositivos como desconectados
    Promise.all(DEVICES.map(device =>
      reportConnectionStatus(device, 'disconnected')
    )).then(() => {
      console.log('✅ Todos los dispositivos desconectados');
      process.exit(0);
    });
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
    await runSimulation();
  } else {
    process.exit(1);
  }
}

main().catch(console.error);