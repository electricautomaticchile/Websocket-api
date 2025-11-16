import { Router, Request, Response } from "express";
import { logger } from "../utils/logger";

const router = Router();

// Referencia al ArduinoSerialBridge (se inyectará desde index.ts)
let arduinoBridge: any = null;

export function setArduinoBridge(bridge: any) {
  arduinoBridge = bridge;
}

// Endpoint para enviar comandos al Arduino
router.post("/comando", async (req: Request, res: Response) => {
  try {
    const { clienteId, comando } = req.body;

    if (!clienteId || !comando) {
      return res.status(400).json({
        success: false,
        message: "clienteId y comando son requeridos",
      });
    }

    if (!arduinoBridge) {
      return res.status(503).json({
        success: false,
        message: "Arduino no está conectado",
      });
    }

    logger.info(
      `📡 Recibido comando para cliente ${clienteId}: ${comando}`,
      "ArduinoRoutes"
    );

    // Enviar comando al Arduino
    arduinoBridge.sendCommand(comando);

    return res.json({
      success: true,
      message: `Comando ${comando} enviado al Arduino`,
    });
  } catch (error) {
    logger.error("Error enviando comando al Arduino:", error);
    return res.status(500).json({
      success: false,
      message: "Error al enviar comando",
    });
  }
});

export default router;
