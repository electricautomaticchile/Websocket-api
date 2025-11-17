import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { logger } from "../utils/logger";
import axios from "axios";

interface ArduinoData {
  type: string;
  deviceId: string;
  clienteId: string;
  voltage: number;
  current: number;
  activePower: number;
  energy: number;
  cost: number;
  uptime: number;
  led1: boolean;
  led2: boolean;
  timestamp: number;
}

export class ArduinoSerialBridge {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private apiUrl: string;
  private wsManager: any;
  private deviceRegistry: Map<string, any> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000; // 5 segundos
  private lastConnectedPort: string | null = null;
  private isReconnecting: boolean = false;
  private restoredDevices: Set<string> = new Set(); // Dispositivos ya restaurados en esta sesión

  constructor(wsManager: any) {
    this.wsManager = wsManager;
    this.apiUrl = process.env.API_URL || "http://localhost:4000/api";
  }

  // Listar puertos disponibles
  async listPorts(): Promise<void> {
    try {
      const ports = await SerialPort.list();
      logger.info("Puertos seriales disponibles:", "ArduinoSerialBridge");
      ports.forEach((port, index) => {
        logger.info(
          `${index + 1}. ${port.path} - ${port.manufacturer || "Desconocido"}`,
          "ArduinoSerialBridge"
        );
      });
    } catch (error) {
      logger.error("Error listando puertos:", error);
    }
  }

  // Conectar al Arduino
  async connect(portPath?: string): Promise<void> {
    try {
      // Si no se especifica puerto, buscar Arduino automáticamente
      if (!portPath) {
        const foundPort = await this.findArduinoPort();
        if (!foundPort) {
          throw new Error("No se encontró ningún Arduino conectado");
        }
        portPath = foundPort;
      }

      logger.info(
        `Conectando a Arduino en ${portPath}...`,
        "ArduinoSerialBridge"
      );

      // Guardar el puerto para reconexión
      this.lastConnectedPort = portPath;

      this.port = new SerialPort({
        path: portPath,
        baudRate: 115200,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      // Eventos del puerto serial
      this.port.on("open", async () => {
        logger.info(
          `✅ Conectado a Arduino en ${portPath}`,
          "ArduinoSerialBridge"
        );
        // Resetear contador de reconexión al conectar exitosamente
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        // Limpiar intervalo de reconexión si existe
        if (this.reconnectInterval) {
          clearTimeout(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        
        // Esperar 3 segundos para que Arduino inicialice y luego restaurar todos los dispositivos conocidos
        setTimeout(async () => {
          logger.info(
            `🔄 Restaurando estado de dispositivos conocidos...`,
            "ArduinoSerialBridge"
          );
          
          // Restaurar todos los dispositivos que tenemos registrados
          for (const [deviceId, device] of this.deviceRegistry.entries()) {
            if (!this.restoredDevices.has(deviceId)) {
              logger.info(
                `🔄 Restaurando ${deviceId} al conectar puerto...`,
                "ArduinoSerialBridge"
              );
              this.restoredDevices.add(deviceId);
              await this.restoreDeviceState(deviceId);
            }
          }
        }, 3000); // 3 segundos para que Arduino esté listo
      });

      this.port.on("error", (err) => {
        logger.error(`❌ Error en puerto serial: ${err.message}`, err);
        // Limpiar puerto
        this.port = null;
        this.parser = null;
        // Intentar reconectar en caso de error
        this.scheduleReconnect();
      });

      this.port.on("close", async () => {
        logger.warn("⚠️ Puerto serial cerrado - Arduino desconectado", "ArduinoSerialBridge");
        
        // Guardar última lectura de todos los dispositivos antes de desconectar
        // NOTA: Esto es diferente al historial. Solo actualiza ultimaLectura del dispositivo
        await this.saveAllDevicesState();
        
        // Limpiar el set de dispositivos restaurados para que se restauren al reconectar
        this.restoredDevices.clear();
        logger.info("🔄 Set de dispositivos restaurados limpiado", "ArduinoSerialBridge");
        
        // Limpiar puerto
        this.port = null;
        this.parser = null;
        // Intentar reconectar automáticamente
        this.scheduleReconnect();
      });

      // Procesar datos recibidos
      this.parser.on("data", (line: string) => {
        this.processArduinoData(line);
      });
    } catch (error) {
      logger.error("❌ Error conectando a Arduino:", error);
      // Limpiar puerto en caso de error
      this.port = null;
      this.parser = null;
      throw error;
    }
  }

  // Buscar puerto Arduino automáticamente
  private async findArduinoPort(): Promise<string | null> {
    try {
      const ports = await SerialPort.list();

      // Filtrar puertos virtuales (ttyS*)
      const realPorts = ports.filter(
        (port) => !port.path.includes("/dev/ttyS")
      );

      // Buscar Arduino por fabricante
      const arduinoPort = realPorts.find(
        (port) =>
          port.manufacturer?.toLowerCase().includes("arduino") ||
          port.manufacturer?.toLowerCase().includes("ch340") ||
          port.manufacturer?.toLowerCase().includes("ftdi") ||
          port.manufacturer?.toLowerCase().includes("usb")
      );

      if (arduinoPort) {
        logger.info(
          `✅ Arduino encontrado en ${arduinoPort.path} (${arduinoPort.manufacturer})`,
          "ArduinoSerialBridge"
        );
        return arduinoPort.path;
      }

      // Buscar puertos USB reales (ttyUSB*, ttyACM*)
      const usbPort = realPorts.find(
        (port) =>
          port.path.includes("/dev/ttyUSB") ||
          port.path.includes("/dev/ttyACM") ||
          port.path.includes("COM")
      );

      if (usbPort) {
        logger.info(
          `⚠️ Puerto USB encontrado en ${usbPort.path}, intentando conectar...`,
          "ArduinoSerialBridge"
        );
        return usbPort.path;
      }

      logger.warn(
        "❌ No se encontró ningún Arduino conectado por USB",
        "ArduinoSerialBridge"
      );
      logger.info(
        "💡 Conecta el Arduino por USB y reinicia el servidor",
        "ArduinoSerialBridge"
      );

      return null;
    } catch (error) {
      logger.error("Error buscando puerto Arduino:", error);
      return null;
    }
  }

  // Procesar datos del Arduino
  private async processArduinoData(line: string): Promise<void> {
    try {
      // Limpiar la línea
      line = line.trim();

      // Ignorar líneas vacías
      if (!line) {
        return;
      }

      // Ignorar líneas que no son JSON
      if (!line.startsWith("{")) {
        logger.debug(`Arduino: ${line}`, "ArduinoSerialBridge");
        return;
      }

      // Intentar parsear JSON
      let data: ArduinoData;
      try {
        data = JSON.parse(line);
      } catch (parseError) {
        logger.warn(
          `JSON incompleto o malformado: ${line.substring(0, 100)}...`,
          "ArduinoSerialBridge"
        );
        return;
      }

      // Solo procesar datos de tipo "data"
      if (data.type !== "data") {
        return;
      }

      logger.info(
        `📊 Datos recibidos de dispositivo ${data.deviceId}`,
        "ArduinoSerialBridge",
        {
          power: data.activePower,
          energy: data.energy,
          led1: data.led1,
          led2: data.led2,
        }
      );

      // Registrar dispositivo si es nuevo
      if (!this.deviceRegistry.has(data.deviceId)) {
        await this.registerDevice(data);
        
        // Si es un dispositivo nuevo que no conocíamos, restaurar su estado
        if (!this.restoredDevices.has(data.deviceId)) {
          logger.info(
            `🔄 Dispositivo nuevo ${data.deviceId}, restaurando estado...`,
            "ArduinoSerialBridge"
          );
          this.restoredDevices.add(data.deviceId);
          await this.restoreDeviceState(data.deviceId);
        }
      }

      // Actualizar última lectura en el registro
      const device = this.deviceRegistry.get(data.deviceId);
      if (device) {
        device.lastReading = data;
        this.deviceRegistry.set(data.deviceId, device);
      }

      // Enviar datos al WebSocket
      await this.sendToWebSocket(data);

      // NOTA: El guardado en BD ahora lo maneja HistorialConsumoService cada 60 segundos
      // Esto evita duplicados y reduce el almacenamiento en un 92%
      // await this.saveToDatabase(data);
    } catch (error) {
      logger.error("Error procesando datos del Arduino:", error);
    }
  }

  // Registrar dispositivo nuevo
  private async registerDevice(data: ArduinoData): Promise<void> {
    try {
      logger.info(
        `🔍 Nuevo dispositivo detectado: ${data.deviceId}`,
        "ArduinoSerialBridge"
      );

      // Verificar si el dispositivo ya existe en la base de datos
      const checkResponse = await axios.get(
        `${this.apiUrl}/dispositivos/numero/${data.deviceId}`
      );

      if (checkResponse.data.success) {
        // Dispositivo ya existe
        const dispositivo = checkResponse.data.data;
        this.deviceRegistry.set(data.deviceId, dispositivo);
        logger.info(
          `✅ Dispositivo ${data.deviceId} ya registrado`,
          "ArduinoSerialBridge"
        );
        return;
      }
    } catch (error: any) {
      // Si es 404, el dispositivo no existe, lo creamos
      if (error.response?.status === 404) {
        try {
          // Buscar cliente por número
          const clienteResponse = await axios.get(
            `${this.apiUrl}/clientes/numero/${data.deviceId}`
          );

          if (clienteResponse.data.success) {
            const cliente = clienteResponse.data.data;

            // Crear dispositivo
            const nuevoDispositivo: any = {
              numeroDispositivo: data.deviceId,
              nombre: `Arduino ${data.deviceId}`,
              tipo: "arduino_uno",
              estado: "activo",
              clienteAsignado: cliente._id,
              ubicacion: cliente.direccion || "Sin ubicación",
              configuracion: {
                voltajeNominal: 5,
                corrienteMaxima: 0.5,
                potenciaMaxima: 2.5,
                tarifaKwh: 150,
              },
              activo: true,
            };

            // Solo agregar empresaAsignada si existe
            if (cliente.empresa) {
              nuevoDispositivo.empresaAsignada = cliente.empresa;
            }

            const createResponse = await axios.post(
              `${this.apiUrl}/dispositivos`,
              nuevoDispositivo
            );

            if (createResponse.data.success) {
              const dispositivo = createResponse.data.data;
              this.deviceRegistry.set(data.deviceId, dispositivo);

              // Asignar dispositivo al cliente
              await axios.put(
                `${this.apiUrl}/clientes/${cliente._id}/dispositivo`,
                {
                  dispositivoId: data.deviceId,
                }
              );

              logger.info(
                `✅ Dispositivo ${data.deviceId} registrado y asignado a cliente ${cliente.nombre}`,
                "ArduinoSerialBridge"
              );
            }
          } else {
            logger.warn(
              `⚠️ No se encontró cliente con número ${data.deviceId}`,
              "ArduinoSerialBridge"
            );
          }
        } catch (registerError) {
          logger.error("Error registrando dispositivo:", registerError);
        }
      } else {
        logger.error("Error verificando dispositivo:", error);
      }
    }
  }

  // Enviar datos al WebSocket
  private async sendToWebSocket(data: ArduinoData): Promise<void> {
    try {
      // Formato para el WebSocket
      const wsData = {
        deviceId: data.deviceId,
        clienteId: data.clienteId,
        voltage: data.voltage,
        current: data.current,
        activePower: data.activePower,
        energy: data.energy,
        cost: data.cost,
        uptime: data.uptime,
        timestamp: new Date().toISOString(),
        metadata: {
          led1: data.led1,
          led2: data.led2,
        },
      };

      // Enviar a la sala del cliente
      this.wsManager.sendToRoom(
        `devices:cliente:${data.clienteId}`,
        "device:power_consumption",
        wsData
      );

      // También enviar evento genérico (formato español para frontend)
      const datosActualizacion = {
        idDispositivo: data.deviceId, // Cambiado de dispositivoId a idDispositivo
        potenciaActiva: data.activePower,
        energia: data.energy,
        voltaje: data.voltage, // Agregado
        corriente: data.current, // Agregado
        costo: data.cost,
        marcaTiempo: new Date().toISOString(),
        metadata: {
          led1: data.led1,
          led2: data.led2,
          uptime: data.uptime,
        },
      };

      this.wsManager.sendToRoom(
        `user:${data.clienteId}`,
        "dispositivo:actualizacion_potencia",
        datosActualizacion
      );

      console.log(
        `📤 [ArduinoSerialBridge] Datos enviados al WebSocket:`,
        JSON.stringify(
          {
            sala: `user:${data.clienteId}`,
            evento: "dispositivo:actualizacion_potencia",
            datos: datosActualizacion,
          },
          null,
          2
        )
      );

      logger.info(
        `📤 Datos enviados al WebSocket para cliente ${data.clienteId}`,
        "ArduinoSerialBridge"
      );
    } catch (error) {
      logger.error("Error enviando datos al WebSocket:", error);
    }
  }

  // DESHABILITADO: El guardado histórico ahora lo maneja HistorialConsumoService
  // Esto evita duplicados y reduce el almacenamiento en un 92%
  // La función saveAllDevicesState() sigue activa para guardar el último estado al desconectar
  private async saveToDatabase(data: ArduinoData): Promise<void> {
    // Función deshabilitada - Ver HistorialConsumoService para guardado histórico
    return;
    
    /* CÓDIGO ORIGINAL COMENTADO
    try {
      const payload = {
        voltaje: data.voltage,
        corriente: data.current,
        potencia: data.activePower,
        energia: data.energy,
        costo: data.cost,
        timestamp: new Date(),
      };
      
      logger.info(
        `💾 Guardando en BD para ${data.deviceId}:`,
        "ArduinoSerialBridge",
        payload
      );
      
      const response = await axios.put(
        `${this.apiUrl}/dispositivos/numero/${data.deviceId}/ultima-lectura`,
        payload
      );
      
      logger.info(
        `✅ Guardado exitoso en BD para ${data.deviceId}`,
        "ArduinoSerialBridge"
      );
    } catch (error: any) {
      logger.error(
        `❌ Error guardando en base de datos para ${data.deviceId}:`,
        error.response?.data || error.message
      );
    }
    */
  }

  // Guardar estado de todos los dispositivos registrados
  private async saveAllDevicesState(): Promise<void> {
    try {
      logger.info(
        `💾 Guardando estado de ${this.deviceRegistry.size} dispositivo(s)...`,
        "ArduinoSerialBridge"
      );

      const savePromises = Array.from(this.deviceRegistry.entries()).map(
        async ([deviceId, device]) => {
          try {
            // Obtener última lectura conocida del dispositivo
            const lastData = device.lastReading;
            
            logger.info(
              `📋 Última lectura de ${deviceId}:`,
              "ArduinoSerialBridge",
              {
                hasData: !!lastData,
                energy: lastData?.energy,
                cost: lastData?.cost,
                voltage: lastData?.voltage,
                power: lastData?.activePower
              }
            );
            
            if (lastData) {
              const payload = {
                voltaje: lastData.voltage || 0,
                corriente: lastData.current || 0,
                potencia: lastData.activePower || 0,
                energia: lastData.energy || 0,
                costo: lastData.cost || 0,
                timestamp: new Date(),
              };
              
              logger.info(
                `📤 Guardando en BD para ${deviceId}:`,
                "ArduinoSerialBridge",
                payload
              );
              
              await axios.put(
                `${this.apiUrl}/dispositivos/numero/${deviceId}/ultima-lectura`,
                payload
              );
              
              logger.info(
                `✅ Estado guardado para dispositivo ${deviceId}`,
                "ArduinoSerialBridge"
              );
            } else {
              logger.warn(
                `⚠️ No hay última lectura para ${deviceId}`,
                "ArduinoSerialBridge"
              );
            }
          } catch (error: any) {
            logger.error(
              `❌ Error guardando estado del dispositivo ${deviceId}:`,
              error.response?.data || error.message
            );
          }
        }
      );

      await Promise.all(savePromises);
      logger.info(
        `✅ Estado de dispositivos guardado exitosamente`,
        "ArduinoSerialBridge"
      );
    } catch (error) {
      logger.error("Error guardando estado de dispositivos:", error);
    }
  }

  // Restaurar estado de un dispositivo al reconectar
  private async restoreDeviceState(deviceId: string): Promise<void> {
    try {
      logger.info(
        `🔄 Restaurando estado del dispositivo ${deviceId}...`,
        "ArduinoSerialBridge"
      );

      // Obtener última lectura de la base de datos
      const response = await axios.get(
        `${this.apiUrl}/dispositivos/numero/${deviceId}`
      );

      if (response.data.success && response.data.data) {
        const dispositivo = response.data.data;
        const ultimaLectura = dispositivo.ultimaLectura;

        if (ultimaLectura && ultimaLectura.energia) {
          // Enviar comando al Arduino para restaurar valores
          const comando = `RESTORE:${ultimaLectura.energia}:${ultimaLectura.costo || 0}`;
          this.sendCommand(comando);

          logger.info(
            `✅ Estado restaurado para ${deviceId}: Energía=${ultimaLectura.energia} kWh, Costo=$${ultimaLectura.costo}`,
            "ArduinoSerialBridge"
          );
        } else {
          logger.info(
            `ℹ️ No hay estado previo para ${deviceId}, iniciando desde cero`,
            "ArduinoSerialBridge"
          );
        }
      }
    } catch (error) {
      logger.warn(
        `⚠️ No se pudo restaurar estado del dispositivo ${deviceId}`,
        "ArduinoSerialBridge"
      );
    }
  }

  // Enviar comando al Arduino
  sendCommand(command: string): void {
    if (this.port && this.port.isOpen) {
      logger.info(`📤 Enviando comando al Arduino: ${command}`, "ArduinoSerialBridge");
      this.port.write(`${command}\n`, (err) => {
        if (err) {
          logger.error(`❌ Error enviando comando: ${err.message}`, err);
        } else {
          logger.info(`✅ Comando enviado exitosamente: ${command}`, "ArduinoSerialBridge");
        }
      });
    } else {
      logger.warn("⚠️ Puerto serial no está abierto, no se puede enviar comando", "ArduinoSerialBridge");
    }
  }

  // Desconectar
  disconnect(): void {
    if (this.port && this.port.isOpen) {
      this.port.close((err) => {
        if (err) {
          logger.error(`Error cerrando puerto: ${err.message}`, err);
        } else {
          logger.info("Puerto serial cerrado", "ArduinoSerialBridge");
        }
      });
    }
  }

  // Obtener estado
  isConnected(): boolean {
    return this.port !== null && this.port.isOpen;
  }

  // Obtener dispositivos registrados
  getRegisteredDevices(): any[] {
    return Array.from(this.deviceRegistry.values());
  }

  // Programar reconexión
  private scheduleReconnect(): void {
    // Evitar múltiples intentos de reconexión simultáneos
    if (this.isReconnecting || this.reconnectInterval) {
      return;
    }

    // Verificar si hemos excedido el máximo de intentos
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        `❌ Máximo de intentos de reconexión alcanzado (${this.maxReconnectAttempts}). Deteniendo intentos.`,
        "ArduinoSerialBridge"
      );
      logger.info(
        "💡 Para reconectar: 1) Verifica que el Arduino esté conectado, 2) Reinicia el servidor",
        "ArduinoSerialBridge"
      );
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    logger.info(
      `🔄 Programando reconexión (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts}) en ${this.reconnectDelay / 1000} segundos...`,
      "ArduinoSerialBridge"
    );

    this.reconnectInterval = setTimeout(() => {
      this.attemptReconnect();
    }, this.reconnectDelay);
  }

  // Intentar reconectar
  private async attemptReconnect(): Promise<void> {
    try {
      logger.info(
        `🔌 Intentando reconectar al Arduino (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
        "ArduinoSerialBridge"
      );

      // Limpiar puerto anterior si existe
      if (this.port) {
        try {
          if (this.port.isOpen) {
            this.port.close();
          }
        } catch (error) {
          // Ignorar errores al cerrar
        }
        this.port = null;
        this.parser = null;
      }

      // Limpiar intervalo
      if (this.reconnectInterval) {
        clearTimeout(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      // SIEMPRE buscar el puerto nuevamente (no confiar en el último puerto)
      logger.info("🔍 Buscando Arduino en puertos disponibles...", "ArduinoSerialBridge");
      const portToUse = await this.findArduinoPort();

      if (!portToUse) {
        logger.warn(
          `⚠️ No se encontró Arduino conectado. Reintentando en ${this.reconnectDelay / 1000} segundos...`,
          "ArduinoSerialBridge"
        );
        this.isReconnecting = false;
        this.scheduleReconnect();
        return;
      }

      // Verificar que el puerto existe antes de intentar conectar
      const ports = await SerialPort.list();
      const portExists = ports.some(p => p.path === portToUse);
      
      if (!portExists) {
        logger.warn(
          `⚠️ Puerto ${portToUse} no está disponible. Reintentando...`,
          "ArduinoSerialBridge"
        );
        this.isReconnecting = false;
        this.scheduleReconnect();
        return;
      }

      // Intentar conectar
      await this.connect(portToUse);

      logger.info(
        `✅ Reconexión exitosa al Arduino en ${portToUse}`,
        "ArduinoSerialBridge"
      );
    } catch (error) {
      logger.error(
        `❌ Error en reconexión (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`,
        error
      );
      this.isReconnecting = false;
      this.scheduleReconnect();
    }
  }

  // Resetear contador de reconexión (útil para llamar manualmente)
  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
    logger.info(
      "🔄 Contador de reconexión reseteado",
      "ArduinoSerialBridge"
    );
  }

  // Obtener estado de reconexión
  getReconnectStatus(): {
    isReconnecting: boolean;
    attempts: number;
    maxAttempts: number;
  } {
    return {
      isReconnecting: this.isReconnecting,
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    };
  }
}
