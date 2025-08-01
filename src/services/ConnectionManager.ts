import { Server as SocketIOServer } from "socket.io";
import { logger } from "../utils/logger";
import { UserSocket, UserRole, UserType } from "../types/websocket";

export class ConnectionManager {
  private io: SocketIOServer;
  private connectedUsers: Map<string, UserSocket> = new Map();
  private userRooms: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // Manejar nueva conexión
  handleConnection(socket: UserSocket): void {
    const userId = socket.handshake.auth.userId;
    const userRole = socket.handshake.auth.userRole;
    const userType = socket.handshake.auth.userType;

    logger.info(`Nueva conexión WebSocket: ${socket.id}`, "ConnectionManager", {
      userId,
      userRole,
      userType,
    });

    // Configurar socket
    socket.userId = userId;
    socket.userRole = userRole;
    socket.userType = userType;

    // Agregar a usuarios conectados
    if (userId) {
      this.connectedUsers.set(userId, socket);
    }

    // Unir a salas automáticas
    this.joinAutomaticRooms(socket);

    // Confirmar conexión
    socket.emit("connection:confirmed", {
      socketId: socket.id,
      userId,
      userRole,
      userType,
      timestamp: new Date().toISOString(),
    });

    // Configurar eventos de desconexión
    socket.on("disconnect", (reason) => {
      this.handleDisconnection(socket, reason);
    });
  }

  // Manejar desconexión
  private handleDisconnection(socket: UserSocket, reason: string): void {
    logger.info(`Desconexión WebSocket: ${socket.id}`, "ConnectionManager", {
      userId: socket.userId,
      reason,
    });

    // Remover de usuarios conectados
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
    }

    // Limpiar salas
    this.leaveAllRooms(socket);
  }

  // Unir a salas automáticas
  private joinAutomaticRooms(socket: UserSocket): void {
    const { userId, userRole, userType } = socket;

    // Sala personal del usuario
    if (userId) {
      this.joinRoom(socket, `user:${userId}`);
    }

    // Sala por rol
    if (userRole) {
      this.joinRoom(socket, `role:${userRole}`);
    }

    // Sala por tipo
    if (userType) {
      this.joinRoom(socket, `type:${userType}`);
    }

    // Sala general
    this.joinRoom(socket, "general");
  }

  // Unir a sala específica
  joinRoom(socket: UserSocket, room: string): void {
    socket.join(room);

    // Actualizar registro de salas
    if (!this.userRooms.has(socket.id)) {
      this.userRooms.set(socket.id, new Set());
    }
    this.userRooms.get(socket.id)!.add(room);

    logger.debug(
      `Usuario ${socket.userId} unido a sala: ${room}`,
      "ConnectionManager"
    );

    socket.emit("room:joined", {
      room,
      timestamp: new Date().toISOString(),
    });
  }

  // Salir de sala específica
  leaveRoom(socket: UserSocket, room: string): void {
    socket.leave(room);

    // Actualizar registro de salas
    const userRooms = this.userRooms.get(socket.id);
    if (userRooms) {
      userRooms.delete(room);
    }

    logger.debug(
      `Usuario ${socket.userId} salió de sala: ${room}`,
      "ConnectionManager"
    );

    socket.emit("room:left", {
      room,
      timestamp: new Date().toISOString(),
    });
  }

  // Salir de todas las salas
  private leaveAllRooms(socket: UserSocket): void {
    const userRooms = this.userRooms.get(socket.id);
    if (userRooms) {
      userRooms.forEach((room) => {
        socket.leave(room);
      });
      this.userRooms.delete(socket.id);
    }
  }

  // Métodos públicos para enviar mensajes
  sendToUser(userId: string, event: string, data: unknown): void {
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Mensaje enviado a usuario ${userId}`, "ConnectionManager", {
      event,
    });
  }

  sendToRole(role: UserRole, event: string, data: unknown): void {
    this.io.to(`role:${role}`).emit(event, data);
    logger.debug(`Mensaje enviado a rol ${role}`, "ConnectionManager", {
      event,
    });
  }

  sendToType(type: UserType, event: string, data: unknown): void {
    this.io.to(`type:${type}`).emit(event, data);
    logger.debug(`Mensaje enviado a tipo ${type}`, "ConnectionManager", {
      event,
    });
  }

  sendToRoom(room: string, event: string, data: unknown): void {
    this.io.to(room).emit(event, data);
    logger.debug(`Mensaje enviado a sala ${room}`, "ConnectionManager", {
      event,
    });
  }

  broadcastToAll(event: string, data: unknown): void {
    this.io.emit(event, data);
    logger.debug("Mensaje broadcast a todos", "ConnectionManager", { event });
  }

  // Obtener estadísticas de conexión
  getConnectionStats(): {
    totalConnections: number;
    connectedUsers: number;
    roomsCount: number;
    usersByRole: Record<string, number>;
    usersByType: Record<string, number>;
  } {
    const usersByRole: Record<string, number> = {};
    const usersByType: Record<string, number> = {};

    this.connectedUsers.forEach((socket) => {
      if (socket.userRole) {
        usersByRole[socket.userRole] = (usersByRole[socket.userRole] || 0) + 1;
      }
      if (socket.userType) {
        usersByType[socket.userType] = (usersByType[socket.userType] || 0) + 1;
      }
    });

    return {
      totalConnections: this.io.engine.clientsCount,
      connectedUsers: this.connectedUsers.size,
      roomsCount: this.userRooms.size,
      usersByRole,
      usersByType,
    };
  }

  // Obtener usuarios conectados
  getConnectedUsers(): Array<{
    socketId: string;
    userId?: string;
    userRole?: UserRole;
    userType?: UserType;
  }> {
    return Array.from(this.connectedUsers.values()).map((socket) => ({
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      userType: socket.userType,
    }));
  }

  // Verificar si un usuario está conectado
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Obtener socket de usuario específico
  getUserSocket(userId: string): UserSocket | undefined {
    return this.connectedUsers.get(userId);
  }
}
