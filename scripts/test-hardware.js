#!/usr/bin/env node

/**
 * Script de prueba para control hardware en tiempo real
 * Simula dispositivos Arduino, sensores y relés
 */

const axios = require('axios');

const WEBSOCKET_API_URL = process.env.WEBSOCKET_API_URL || 'http://localhost:5000';

// Configuración de dispositivos hardware simulados
const HARDWARE_DEVICES = [
  {
    id: 'ARD001',
    name: 'Arduino Control Principal',
    type: 'arduino',
    location: 'Sala de Control',
    hasLED: true,
    hasRelays: ['relay1', 'relay2'],
    hasSensors: ['temperature', 'humidity']
  },
  {
    id: 'ARD002',
    name: 'Arduino Monitoreo',
    type: 'arduino',
    location: 'Edificio Norte',
    hasLED: true,
    hasRelays: ['main_relay'],
    hasSensors: ['temperature', 'light']
  },
  {
    id: 'CTRL001',
    name: 'Controlador Industrial',
    type: 'controller',
    location: 'Planta Principal',
    hasRelays: ['pump1', 'pump2', 'valve1'],
    hasSensors: ['pressure', 'temperature', 'motion']
  }
];

// Función para enviar comando Arduino
async function sendArduinoCommand(device, command, target = 'led') {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/hardware/arduino`, {
      deviceId: device.id,
      command: command,
      target: target,
      parameters: {
        location: device.location,
        deviceType: device.type
      }
    });

    console.log(`🎛️ ${device.name}: Comando ${command} ${target} - ${response.data.message}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error enviando comando Arduino para ${device.name}:`, error.message);
  }
}

// Función para control de relés
async function controlRelay(device, relayId, action, priority = 'normal') {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/hardware/relay`, {
      deviceId: device.id,
      relayId: relayId,
      action: action,
      priority: priority,
      duration: action === 'pulse' ? 5000 : undefined // 5 segundos para pulsos
    });

    console.log(`🔌 ${device.name}: Relé ${relayId} ${action} - ${response.data.message}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error controlando relé para ${device.name}:`, error.message);
  }
}

// Función para enviar lecturas de sensores
async function sendSensorReading(device, sensorType, value, unit) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/hardware/sensor`, {
      deviceId: device.id,
      sensorType: sensorType,
      value: value,
      unit: unit,
      location: device.location,
      calibrated: true
    });

    console.log(`🌡️ ${device.name}: Sensor ${sensorType} ${value}${unit} - ${response.data.message}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error enviando lectura de sensor para ${device.name}:`, error.message);
  }
}

// Función para enviar métricas de performance
async function sendPerformanceMetrics(device) {
  try {
    const metrics = {
      deviceId: device.id,
      cpuUsage: Math.floor(Math.random() * 100),
      memoryUsage: Math.floor(Math.random() * 100),
      temperature: 20 + Math.random() * 40, // 20-60°C
      uptime: Math.floor(Math.random() * 86400 * 7), // Hasta 7 días
      networkLatency: Math.floor(Math.random() * 200), // 0-200ms
      errorCount: Math.floor(Math.random() * 20)
    };

    const response = await axios.post(`${WEBSOCKET_API_URL}/api/hardware/metrics`, metrics);

    console.log(`📊 ${device.name}: Métricas - CPU ${metrics.cpuUsage}%, RAM ${metrics.memoryUsage}%, Temp ${metrics.temperature.toFixed(1)}°C`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error enviando métricas para ${device.name}:`, error.message);
  }
}

// Función para configurar dispositivo
async function configureDevice(device, configType, configuration) {
  try {
    const response = await axios.post(`${WEBSOCKET_API_URL}/api/hardware/config`, {
      deviceId: device.id,
      configType: configType,
      configuration: configuration,
      applyImmediately: true
    });

    console.log(`⚙️ ${device.name}: Configuración ${configType} aplicada - ${response.data.message}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error configurando ${device.name}:`, error.message);
  }
}

// Función para generar datos realistas de sensores
function generateSensorData(sensorType) {
  switch (sensorType) {
    case 'temperature':
      return {
        value: 15 + Math.random() * 25, // 15-40°C
        unit: '°C'
      };
    case 'humidity':
      return {
        value: 30 + Math.random() * 50, // 30-80%
        unit: '%'
      };
    case 'pressure':
      return {
        value: 950 + Math.random() * 100, // 950-1050 hPa
        unit: 'hPa'
      };
    case 'light':
      return {
        value: Math.random() * 50000, // 0-50000 lux
        unit: 'lux'
      };
    case 'motion':
      return {
        value: Math.random() > 0.8 ? 1 : 0, // 20% probabilidad de movimiento
        unit: 'bool'
      };
    default:
      return {
        value: Math.random() * 100,
        unit: 'units'
      };
  }
}

// Función para simular secuencia de comandos Arduino
async function simulateArduinoSequence(device) {
  console.log(`\n🎯 Iniciando secuencia Arduino para ${device.name}...`);

  // Encender LED
  await sendArduinoCommand(device, 'on', 'led');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Activar relés si los tiene
  if (device.hasRelays) {
    for (const relayId of device.hasRelays) {
      await controlRelay(device, relayId, 'activate');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Esperar un poco
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Apagar LED
  await sendArduinoCommand(device, 'off', 'led');

  // Desactivar relés
  if (device.hasRelays) {
    for (const relayId of device.hasRelays) {
      await controlRelay(device, relayId, 'deactivate');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`✅ Secuencia completada para ${device.name}`);
}

// Función para simular emergencia
async function simulateEmergency() {
  if (Math.random() > 0.95) { // 5% probabilidad
    const device = HARDWARE_DEVICES[Math.floor(Math.random() * HARDWARE_DEVICES.length)];
    console.log(`\n🚨 SIMULANDO EMERGENCIA en ${device.name}...`);

    if (device.hasRelays && device.hasRelays.length > 0) {
      const relayId = device.hasRelays[0];
      await controlRelay(device, relayId, 'activate', 'emergency');
      console.log(`🛑 Relé de emergencia ${relayId} activado en ${device.name}`);
    }
  }
}

// Función principal de simulación
async function runHardwareSimulation() {
  console.log('🚀 Iniciando simulación de control hardware...');
  console.log(`📡 Conectando a WebSocket API: ${WEBSOCKET_API_URL}`);
  console.log(`🏭 Dispositivos hardware simulados: ${HARDWARE_DEVICES.length}`);
  console.log('─'.repeat(80));

  // Configurar dispositivos inicialmente
  for (const device of HARDWARE_DEVICES) {
    await configureDevice(device, 'thresholds', {
      temperature: { min: 0, max: 50, critical: 70 },
      humidity: { min: 20, max: 80, critical: 95 },
      cpu: { warning: 80, critical: 95 },
      memory: { warning: 85, critical: 95 }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ Todos los dispositivos configurados');
  console.log('📊 Iniciando monitoreo y control en tiempo real...\n');

  // Ciclo principal de simulación
  let iteration = 0;
  const interval = setInterval(async () => {
    iteration++;
    console.log(`\n📈 Iteración ${iteration} - ${new Date().toLocaleTimeString()}`);

    // Enviar métricas de performance para todos los dispositivos
    for (const device of HARDWARE_DEVICES) {
      await sendPerformanceMetrics(device);

      // Enviar lecturas de sensores si los tiene
      if (device.hasSensors) {
        for (const sensorType of device.hasSensors) {
          const sensorData = generateSensorData(sensorType);
          setTimeout(() =>
            sendSensorReading(device, sensorType, sensorData.value, sensorData.unit),
            Math.random() * 2000
          );
        }
      }
    }

    // Simular emergencias ocasionales
    await simulateEmergency();

    console.log(`✅ Métricas enviadas para ${HARDWARE_DEVICES.length} dispositivos`);

  }, 15000); // Cada 15 segundos

  // Simular secuencias de comandos Arduino ocasionales
  const commandInterval = setInterval(async () => {
    if (Math.random() > 0.7) { // 30% probabilidad cada minuto
      const arduinoDevices = HARDWARE_DEVICES.filter(d => d.type === 'arduino');
      if (arduinoDevices.length > 0) {
        const device = arduinoDevices[Math.floor(Math.random() * arduinoDevices.length)];
        await simulateArduinoSequence(device);
      }
    }
  }, 60000); // Cada minuto

  // Simular control de relés aleatorio
  const relayInterval = setInterval(async () => {
    if (Math.random() > 0.8) { // 20% probabilidad cada 30 segundos
      const devicesWithRelays = HARDWARE_DEVICES.filter(d => d.hasRelays && d.hasRelays.length > 0);
      if (devicesWithRelays.length > 0) {
        const device = devicesWithRelays[Math.floor(Math.random() * devicesWithRelays.length)];
        const relayId = device.hasRelays[Math.floor(Math.random() * device.hasRelays.length)];
        const action = Math.random() > 0.5 ? 'activate' : 'deactivate';

        console.log(`\n🔌 Control aleatorio de relé: ${device.name}/${relayId} -> ${action}`);
        await controlRelay(device, relayId, action);
      }
    }
  }, 30000); // Cada 30 segundos

  // Manejar cierre graceful
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo simulación hardware...');
    clearInterval(interval);
    clearInterval(commandInterval);
    clearInterval(relayInterval);

    // Apagar todos los LEDs y desactivar relés
    Promise.all(HARDWARE_DEVICES.map(async device => {
      if (device.hasLED) {
        await sendArduinoCommand(device, 'off', 'led');
      }
      if (device.hasRelays) {
        for (const relayId of device.hasRelays) {
          await controlRelay(device, relayId, 'deactivate');
        }
      }
    })).then(() => {
      console.log('✅ Todos los dispositivos apagados');
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
    await runHardwareSimulation();
  } else {
    process.exit(1);
  }
}

main().catch(console.error);