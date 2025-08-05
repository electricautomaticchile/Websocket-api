import { logger } from "../utils/logger";
import { UserSocket } from "../types/websocket";

export interface EventPermission {
  event: string;
  data: any;
  deviceId?: string;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

export class PermissionFilter {
  /**
   * Filtrar eventos según permisos del usuario
   */
  static filterEventByPermissions(
    socket: UserSocket,
    eventPermission: EventPermission
  ): boolean {
    const { userRole, userId } = socket;
    const { event, data, deviceId, requiredRoles, requiredPermissions } =
      eventPermission;

    try {
      // Superadmin siempre tiene acceso
      if (userRole === "superadmin") {
        return true;
      }

      // Verificar roles requeridos
      if (requiredRoles && !requiredRoles.includes(userRole || "")) {
        logger.debug(
          `Evento ${event} filtrado por rol: ${userRole}`,
          "PermissionFilter"
        );
        return false;
      }

      // Verificar permisos específicos por tipo de evento
      switch (event) {
        case "device:connection_update":
        case "device:voltage_update":
        case "device:current_update":
        case "device:power_update":
          return this.checkDevicePermission(socket, deviceId);

        case "alert:new":
        case "alert:critical":
          return this.checkAlertPermission(socket, data);

        case "command:result":
        case "command:executed":
          return this.checkCommandPermission(socket, data);

        case "ml:model_trained":
        case "ml:forecast_generated":
        case "ml:patterns_analyzed":
          return this.checkMLPermission(socket, data);

        case "reporting:report_generated":
        case "reporting:scheduled_report_generated":
          return this.checkReportPermission(socket, data);

        default:
          // Por defecto, permitir eventos generales
          return true;
      }
    } catch (error) {
      logger.error(`Error filtering event ${event} for user ${userId}:`, error);
      return false; // En caso de error, denegar acceso
    }
  }

  /**
   * Verificar permisos sobre un dispositivo
   */
  private static checkDevicePermission(
    socket: UserSocket,
    deviceId?: string
  ): boolean {
    const { userRole, userId } = socket;

    if (!deviceId) {
      return userRole === "superadmin";
    }

    switch (userRole) {
      case "superadmin":
        return true;

      case "empresa":
        // En una implementación real, se verificaría si el dispositivo
        // pertenece a un cliente asignado a esta empresa
        return true; // Simplificado por ahora

      case "cliente":
        // En una implementación real, se verificaría si el dispositivo
        // pertenece a este cliente
        return true; // Simplificado por ahora

      default:
        return false;
    }
  }

  /**
   * Verificar permisos sobre alertas
   */
  private static checkAlertPermission(
    socket: UserSocket,
    alertData: any
  ): boolean {
    const { userRole, userId } = socket;
    const { visibleToRoles, assignedUsers, severity } = alertData;

    // Alertas críticas son visibles para todos los roles autorizados
    if (severity === "critical") {
      return ["superadmin", "empresa", "cliente"].includes(userRole || "");
    }

    // Verificar si el rol está en la lista de roles visibles
    if (visibleToRoles && visibleToRoles.includes(userRole)) {
      return true;
    }

    // Verificar si el usuario está específicamente asignado
    if (assignedUsers && assignedUsers.includes(userId)) {
      return true;
    }

    return false;
  }

  /**
   * Verificar permisos sobre comandos
   */
  private static checkCommandPermission(
    socket: UserSocket,
    commandData: any
  ): boolean {
    const { userRole, userId } = socket;
    const { executedBy, deviceId, userRole: commandUserRole } = commandData;

    // El usuario que ejecutó el comando siempre puede ver el resultado
    if (executedBy === userId) {
      return true;
    }

    // Superadmin puede ver todos los comandos
    if (userRole === "superadmin") {
      return true;
    }

    // Verificar permisos sobre el dispositivo
    return this.checkDevicePermission(socket, deviceId);
  }

  /**
   * Verificar permisos sobre Machine Learning
   */
  private static checkMLPermission(socket: UserSocket, mlData: any): boolean {
    const { userRole } = socket;
    const { deviceId } = mlData;

    // Solo superadmin y empresa pueden acceder a ML
    if (!["superadmin", "empresa"].includes(userRole || "")) {
      return false;
    }

    // Verificar permisos sobre el dispositivo
    return this.checkDevicePermission(socket, deviceId);
  }

  /**
   * Verificar permisos sobre reportes
   */
  private static checkReportPermission(
    socket: UserSocket,
    reportData: any
  ): boolean {
    const { userRole } = socket;
    const { reportType, scope } = reportData;

    switch (userRole) {
      case "superadmin":
        return true; // Acceso a todos los reportes

      case "empresa":
        // Empresa puede ver reportes de sus clientes
        return scope !== "global";

      case "cliente":
        // Cliente solo puede ver sus reportes personales
        return scope === "personal";

      default:
        return false;
    }
  }

  /**
   * Filtrar datos según permisos del usuario
   */
  static filterDataByPermissions(
    socket: UserSocket,
    data: any,
    dataType: string
  ): any {
    const { userRole, userId } = socket;

    try {
      switch (dataType) {
        case "device_list":
          return this.filterDeviceList(socket, data);

        case "alert_list":
          return this.filterAlertList(socket, data);

        case "command_history":
          return this.filterCommandHistory(socket, data);

        case "statistics":
          return this.filterStatistics(socket, data);

        default:
          return data;
      }
    } catch (error) {
      logger.error(
        `Error filtering data type ${dataType} for user ${userId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Filtrar lista de dispositivos
   */
  private static filterDeviceList(socket: UserSocket, devices: any[]): any[] {
    const { userRole, userId } = socket;

    if (userRole === "superadmin") {
      return devices; // Superadmin ve todos
    }

    return devices.filter((device) => {
      switch (userRole) {
        case "empresa":
          // En una implementación real, se verificaría si el dispositivo
          // pertenece a un cliente asignado a esta empresa
          return true; // Simplificado

        case "cliente":
          // Cliente solo ve sus propios dispositivos
          return device.cliente === userId || device.cliente?._id === userId;

        default:
          return false;
      }
    });
  }

  /**
   * Filtrar lista de alertas
   */
  private static filterAlertList(socket: UserSocket, alerts: any[]): any[] {
    const { userRole, userId } = socket;

    return alerts.filter((alert) => {
      return this.checkAlertPermission(socket, alert);
    });
  }

  /**
   * Filtrar historial de comandos
   */
  private static filterCommandHistory(
    socket: UserSocket,
    commands: any[]
  ): any[] {
    const { userRole, userId } = socket;

    if (userRole === "superadmin") {
      return commands; // Superadmin ve todos
    }

    return commands.filter((command) => {
      // Usuario puede ver sus propios comandos
      if (command.executedBy === userId) {
        return true;
      }

      // Verificar permisos sobre el dispositivo
      return this.checkDevicePermission(socket, command.deviceId);
    });
  }

  /**
   * Filtrar estadísticas
   */
  private static filterStatistics(socket: UserSocket, stats: any): any {
    const { userRole } = socket;

    switch (userRole) {
      case "superadmin":
        return stats; // Acceso completo

      case "empresa":
        // Empresa ve estadísticas agregadas sin detalles sensibles
        return {
          ...stats,
          globalStats: undefined, // Remover estadísticas globales
          detailedBreakdown: undefined, // Remover desglose detallado
        };

      case "cliente":
        // Cliente solo ve sus estadísticas personales
        return {
          personalStats: stats.personalStats,
          deviceCount: stats.deviceCount,
          consumption: stats.consumption,
        };

      default:
        return null;
    }
  }

  /**
   * Verificar si un usuario puede ejecutar un comando específico
   */
  static canExecuteCommand(
    socket: UserSocket,
    command: string,
    deviceId: string
  ): boolean {
    const { userRole } = socket;

    // Comandos críticos solo para superadmin
    const criticalCommands = [
      "reset",
      "configure",
      "update_firmware",
      "factory_reset",
    ];
    if (criticalCommands.includes(command) && userRole !== "superadmin") {
      return false;
    }

    // Comandos avanzados para superadmin y empresa
    const advancedCommands = ["restart", "calibrate", "diagnostic"];
    if (
      advancedCommands.includes(command) &&
      !["superadmin", "empresa"].includes(userRole || "")
    ) {
      return false;
    }

    // Comandos básicos para todos los roles autorizados
    const basicCommands = ["on", "off", "status"];
    if (basicCommands.includes(command)) {
      return this.checkDevicePermission(socket, deviceId);
    }

    return false;
  }

  /**
   * Obtener salas a las que un usuario debe unirse según sus permisos
   */
  static getRoomsForUser(socket: UserSocket): string[] {
    const { userRole, userId } = socket;
    const rooms: string[] = [];

    // Sala personal
    if (userId) {
      rooms.push(`user:${userId}`);
    }

    // Salas por rol
    switch (userRole) {
      case "superadmin":
        rooms.push(
          "role:superadmin",
          "admin:global",
          "admin:alerts",
          "admin:commands"
        );
        break;

      case "empresa":
        rooms.push(
          "role:empresa",
          `empresa:${userId}`,
          `empresa:alerts:${userId}`
        );
        // En una implementación real, se agregarían salas de clientes asignados
        break;

      case "cliente":
        rooms.push(
          "role:cliente",
          `cliente:${userId}`,
          `devices:cliente:${userId}`
        );
        break;
    }

    return rooms;
  }
}
