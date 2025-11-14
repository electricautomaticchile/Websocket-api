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

      this.port = new SerialPort({
        path: portPath,
        baudRate: 115200,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      // Eventos del puerto serial
      this.port.on("open", () => {
        logger.info(
          `✅ Conectado a Arduino en ${portPath}`,
          "ArduinoSerialBridge"
        );
      });

      this.port.on("error", (err) => {
        logger.error(`Error en puerto serial: ${err.message}`, err);
      });

      this.port.on("close", () => {
        logger.warn("Puerto serial cerrado", "ArduinoSerialBridge");
      });

      // Procesar datos recibidos
      this.parser.on("data", (line: string) => {
        this.processArduinoData(line);
      });
    } catch (error) {
      logger.error("Error conectando a Arduino:", error);
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
      }

      // Enviar datos al WebSocket
      await this.sendToWebSocket(data);

      // Guardar en base de datos (opcional)
      await this.saveToDatabase(data);
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

      // También enviar evento genérico
      const datosActualizacion = {
        dispositivoId: data.deviceId,
        potenciaActiva: data.activePower,
        energia: data.energy,
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

  // Guardar en base de datos (opcional - para histórico)
  private async saveToDatabase(data: ArduinoData): Promise<void> {
    try {
      // Aquí podrías guardar los datos en una colección de lecturas
      // Por ahora solo actualizamos la última lectura del dispositivo
      await axios.put(
        `${this.apiUrl}/dispositivos/numero/${data.deviceId}/ultima-lectura`,
        {
          voltaje: data.voltage,
          corriente: data.current,
          potencia: data.activePower,
          energia: data.energy,
          timestamp: new Date(),
        }
      );
    } catch (error) {
      // No es crítico si falla
      logger.debug("Error guardando en base de datos:", error);
    }
  }

  // Enviar comando al Arduino
  sendCommand(command: string): void {
    if (this.port && this.port.isOpen) {
      this.port.write(`${command}\n`, (err) => {
        if (err) {
          logger.error(`Error enviando comando: ${err.message}`, err);
        } else {
          logger.info(`Comando enviado: ${command}`, "ArduinoSerialBridge");
        }
      });
    } else {
      logger.warn("Puerto serial no está abierto", "ArduinoSerialBridge");
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
}
