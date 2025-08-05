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

  // Unir a salas automáticas con filtrado por rol
  private async joinAutomaticRooms(socket: UserSocket): Promise<void> {
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

    // Salas específicas según el rol
    await this.joinRoleSpecificRooms(socket);

    // Sala general (solo para superadmin y empresa)
    if (userRole === "superadmin" || userRole === "empresa") {
      this.joinRoom(socket, "general");
    }
  }

  // Unir a salas específicas según el rol del usuario
  private async joinRoleSpecificRooms(socket: UserSocket): Promise<void> {
    const { userId, userRole } = socket;

    try {
      switch (userRole) {
        case "superadmin":
          // Superadmin se une a todas las salas de monitoreo
          this.joinRoom(socket, "admin:global");
          this.joinRoom(socket, "admin:alerts");
          this.joinRoom(socket, "admin:commands");
          this.joinRoom(socket, "admin:ml");
          this.joinRoom(socket, "admin:reports");
          break;

        case "empresa":
          // Empresa se une a salas de sus clientes asignados
          await this.joinEmpresaRooms(socket, userId!);
          break;

        case "cliente":
          // Cliente se une solo a salas de sus dispositivos
          this.joinRoom(socket, `cliente:${userId}`);
          this.joinRoom(socket, `devices:cliente:${userId}`);
          break;
      }
    } catch (error) {
      logger.error(
        `Error joining role-specific rooms for user ${userId}:`,
        error
      );
    }
  }

  // Unir empresa a salas de sus clientes asignados
  private async joinEmpresaRooms(
    socket: UserSocket,
    empresaId: string
  ): Promise<void> {
    try {
      // Aquí se haría una consulta a la base de datos para obtener los clientes asignados
      // Por ahora simulamos la lógica
      this.joinRoom(socket, `empresa:${empresaId}`);
      this.joinRoom(socket, `empresa:alerts:${empresaId}`);
      this.joinRoom(socket, `empresa:devices:${empresaId}`);

      // En una implementación real, se consultarían los clientes asignados
      // const empresa = await Empresa.findById(empresaId).populate('clientesAsignados');
      // if (empresa?.clientesAsignados) {
      //   empresa.clientesAsignados.forEach((cliente: any) => {
      //     this.joinRoom(socket, `devices:cliente:${cliente._id}`);
      //   });
      // }

      logger.debug(
        `Empresa ${empresaId} joined specific rooms`,
        "ConnectionManager"
      );
    } catch (error) {
      logger.error(`Error joining empresa rooms for ${empresaId}:`, error);
    }
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

  // Métodos públicos para enviar mensajes con filtrado por permisos
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

  // Nuevos métodos para envío filtrado por permisos
  sendToAuthorizedUsers(event: string, data: any, deviceId?: string): void {
    if (!deviceId) {
      // Si no hay deviceId, enviar solo a superadmin
      this.sendToRole("superadmin", event, data);
      return;
    }

    // Enviar a superadmin (siempre autorizado)
    this.sendToRole("superadmin", event, data);

    // Enviar a empresa si el dispositivo está asignado
    // En una implementación real, se consultaría la base de datos
    this.sendToRoom(`devices:${deviceId}`, event, data);

    logger.debug(
      `Mensaje enviado a usuarios autorizados para dispositivo ${deviceId}`,
      "ConnectionManager",
      {
        event,
      }
    );
  }

  sendDeviceAlert(alert: any): void {
    const { deviceId, severity, visibleToRoles } = alert;

    // Enviar según la severidad y roles visibles
    if (severity === "critical") {
      // Alertas críticas van a todos los roles autorizados
      this.broadcastToAll("alert:critical", alert);
    } else {
      // Alertas normales van según permisos
      if (visibleToRoles?.includes("superadmin")) {
        this.sendToRole("superadmin", "alert:new", alert);
      }
      if (visibleToRoles?.includes("empresa")) {
        this.sendToRoom(`devices:${deviceId}`, "alert:new", alert);
      }
      if (visibleToRoles?.includes("cliente")) {
        this.sendToRoom(`devices:cliente:${deviceId}`, "alert:new", alert);
      }
    }

    logger.debug(
      `Alerta de dispositivo enviada: ${deviceId}`,
      "ConnectionManager",
      {
        severity,
        visibleToRoles,
      }
    );
  }

  sendCommandResult(result: any): void {
    const { executedBy, deviceId, userRole } = result;

    // Enviar resultado al usuario que ejecutó el comando
    this.sendToUser(executedBy, "command:result", result);

    // Enviar a superadmin si no fue ejecutado por superadmin
    if (userRole !== "superadmin") {
      this.sendToRole("superadmin", "command:executed", result);
    }

    // Enviar a usuarios con permisos sobre el dispositivo
    this.sendToRoom(`devices:${deviceId}`, "command:executed", result);

    logger.debug(
      `Resultado de comando enviado: ${result.commandId}`,
      "ConnectionManager",
      {
        executedBy,
        deviceId,
      }
    );
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

