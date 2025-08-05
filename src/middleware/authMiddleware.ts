import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userType?: string;
}

export class AuthMiddleware {
  authenticate = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    try {
      // Obtener token del handshake
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        logger.warn(`🚫 Conexión WebSocket sin token: ${socket.id}`);
        // En desarrollo, permitir conexiones sin token para testing
        if (process.env.NODE_ENV === "development") {
          logger.info(`🔧 Modo desarrollo: Permitiendo conexión sin token`);
          return next();
        }
        return next(new Error("Token de autenticación requerido"));
      }

      // Verificar JWT
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error("🚨 JWT_SECRET no configurado");
        return next(new Error("Configuración de servidor incorrecta"));
      }

      const decoded = jwt.verify(token, jwtSecret) as any;

      // Asignar datos del usuario al socket
      socket.userId = decoded.userId || decoded.sub;
      socket.userRole = decoded.role;
      socket.userType = decoded.tipoUsuario;

      logger.info(
        `✅ WebSocket autenticado: ${socket.userId} (${socket.userRole}/${socket.userType})`
      );
      next();
    } catch (error) {
      logger.error(`❌ Error autenticación WebSocket:`, error);

      // En desarrollo, permitir conexiones con tokens inválidos para testing
      if (process.env.NODE_ENV === "development") {
        logger.info(
          `🔧 Modo desarrollo: Permitiendo conexión con token inválido`
        );
        return next();
      }

      next(new Error("Token inválido"));
    }
  };

  // Middleware para verificar roles específicos
  requireRole = (requiredRoles: string[]) => {
    return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      if (!socket.userRole || !requiredRoles.includes(socket.userRole)) {
        logger.warn(
          `🚫 Acceso denegado: Usuario ${socket.userId} con rol ${
            socket.userRole
          } intentó acceder a recurso que requiere: ${requiredRoles.join(", ")}`
        );
        return next(new Error("Permisos insuficientes"));
      }
      next();
    };
  };

  // Middleware para verificar tipos de usuario
  requireUserType = (requiredTypes: string[]) => {
    return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      if (!socket.userType || !requiredTypes.includes(socket.userType)) {
        logger.warn(
          `🚫 Acceso denegado: Usuario ${socket.userId} con tipo ${
            socket.userType
          } intentó acceder a recurso que requiere: ${requiredTypes.join(", ")}`
        );
        return next(new Error("Tipo de usuario no autorizado"));
      }
      next();
    };
  };
}

