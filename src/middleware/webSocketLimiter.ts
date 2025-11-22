import { Socket } from 'socket.io';

interface RateLimitConfig {
    windowMs: number; // Ventana de tiempo en ms
    maxRequests: number; // Máximo de requests en la ventana
    message?: string; // Mensaje de error
}

interface ThrottleConfig {
    minInterval: number; // Intervalo mínimo entre eventos en ms
    maxBurst?: number; // Máximo de eventos en burst
}

/**
 * Rate Limiter para WebSocket
 * 
 * Limita la cantidad de eventos que un socket puede emitir en una ventana de tiempo
 */
export class WebSocketRateLimiter {
    private requests: Map<string, number[]> = new Map();
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;

        // Limpiar requests antiguos cada minuto
        setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Verificar si el socket puede hacer una request
     */
    check(socketId: string): boolean {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // Obtener requests del socket
        let socketRequests = this.requests.get(socketId) || [];

        // Filtrar solo requests dentro de la ventana
        socketRequests = socketRequests.filter(timestamp => timestamp > windowStart);

        // Verificar si excede el límite
        if (socketRequests.length >= this.config.maxRequests) {
            return false;
        }

        // Agregar nueva request
        socketRequests.push(now);
        this.requests.set(socketId, socketRequests);

        return true;
    }

    /**
     * Obtener info de rate limit para el socket
     */
    getInfo(socketId: string): {
        remaining: number;
        resetAt: Date;
        limit: number;
    } {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;
        const socketRequests = (this.requests.get(socketId) || [])
            .filter(timestamp => timestamp > windowStart);

        const remaining = Math.max(0, this.config.maxRequests - socketRequests.length);
        const resetAt = new Date(now + this.config.windowMs);

        return {
            remaining,
            resetAt,
            limit: this.config.maxRequests,
        };
    }

    /**
     * Resetear rate limit para un socket
     */
    reset(socketId: string): void {
        this.requests.delete(socketId);
    }

    /**
     * Limpiar requests antiguos
     */
    private cleanup(): void {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        for (const [socketId, requests] of this.requests.entries()) {
            const validRequests = requests.filter(timestamp => timestamp > windowStart);

            if (validRequests.length === 0) {
                this.requests.delete(socketId);
            } else {
                this.requests.set(socketId, validRequests);
            }
        }
    }
}

/**
 * Event Throttler para WebSocket
 * 
 * Previene que eventos se emitan muy frecuentemente
 */
export class WebSocketThrottler {
    private lastEventTime: Map<string, number> = new Map();
    private burstQueue: Map<string, any[]> = new Map();
    private processingQueue: Map<string, boolean> = new Map();
    private config: ThrottleConfig;

    constructor(config: ThrottleConfig) {
        this.config = config;
    }

    /**
     * Verificar si se puede emitir un evento
     */
    canEmit(socketId: string, eventKey: string): boolean {
        const key = `${socketId}:${eventKey}`;
        const now = Date.now();
        const lastTime = this.lastEventTime.get(key) || 0;

        if (now - lastTime >= this.config.minInterval) {
            this.lastEventTime.set(key, now);
            return true;
        }

        return false;
    }

    /**
     * Throttle con función de callback
     */
    throttle<T>(
        socketId: string,
        eventKey: string,
        data: T,
        callback: (data: T) => void
    ): void {
        if (this.canEmit(socketId, eventKey)) {
            callback(data);
        }
    }

    /**
     * Throttle con burst queue (ejecuta el último después del intervalo)
     */
    throttleWithQueue<T>(
        socketId: string,
        eventKey: string,
        data: T,
        callback: (data: T) => void
    ): void {
        const key = `${socketId}:${eventKey}`;

        if (this.canEmit(socketId, eventKey)) {
            callback(data);
            return;
        }

        // Agregar a queue si hay espacio
        const maxBurst = this.config.maxBurst || 1;
        let queue = this.burstQueue.get(key) || [];

        if (queue.length < maxBurst) {
            queue.push(data);
            this.burstQueue.set(key, queue);

            // Programar emisión después del intervalo
            setTimeout(() => {
                const queuedData = this.burstQueue.get(key);
                if (queuedData && queuedData.length > 0) {
                    // Emitir el último elemento de la queue
                    const lastData = queuedData[queuedData.length - 1];
                    callback(lastData);
                    this.burstQueue.delete(key);
                }
            }, this.config.minInterval);
        } else {
            // Reemplazar el último en la queue
            queue[queue.length - 1] = data;
            this.burstQueue.set(key, queue);
        }
    }

    /**
     * Resetear throttle para un socket
     */
    reset(socketId: string): void {
        for (const [key] of this.lastEventTime.entries()) {
            if (key.startsWith(socketId + ':')) {
                this.lastEventTime.delete(key);
                this.burstQueue.delete(key);
            }
        }
    }
}

/**
 * Middleware para Socket.IO que aplica rate limiting y throttling
 */
export function createWebSocketMiddleware(options: {
    rateLimiter?: WebSocketRateLimiter;
    throttler?: WebSocketThrottler;
    onRateLimit?: (socket: Socket) => void;
}) {
    const { rateLimiter, throttler, onRateLimit } = options;

    return (socket: Socket, next: (err?: Error) => void) => {
        // Rate limiting
        if (rateLimiter) {
            const originalEmit = socket.emit.bind(socket);
            const originalOn = socket.on.bind(socket);

            // Interceptar emits
            socket.emit = function (event: string, ...args: any[]): any {
                if (rateLimiter.check(socket.id)) {
                    return originalEmit(event, ...args);
                } else {
                    console.warn(`[WebSocket] Rate limit exceeded for socket ${socket.id}`);
                    if (onRateLimit) {
                        onRateLimit(socket);
                    }
                    socket.emit('error', {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests. Please slow down.',
                    });
                    return true;
                }
            };

            // Limpiar al desconectar
            socket.on('disconnect', () => {
                rateLimiter.reset(socket.id);
                if (throttler) {
                    throttler.reset(socket.id);
                }
            });
        }

        next();
    };
}

/**
 * Helper para aplicar throttling a eventos específicos
 */
export function throttleEvent(
    socket: Socket,
    eventName: string,
    throttler: WebSocketThrottler,
    handler: (data: any) => void
): void {
    socket.on(eventName, (data: any) => {
        throttler.throttleWithQueue(
            socket.id,
            eventName,
            data,
            (throttledData) => handler(throttledData)
        );
    });
}

/**
 * Preset configs comunes
 */
export const RateLimitPresets = {
    // Estricto: 10 requests por minuto
    strict: {
        windowMs: 60000,
        maxRequests: 10,
        message: 'Rate limit exceeded. Maximum 10 requests per minute.',
    },
    // Moderado: 30 requests por minuto
    moderate: {
        windowMs: 60000,
        maxRequests: 30,
        message: 'Rate limit exceeded. Maximum 30 requests per minute.',
    },
    // Permisivo: 100 requests por minuto
    permissive: {
        windowMs: 60000,
        maxRequests: 100,
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
    },
};

export const ThrottlePresets = {
    // Datos en tiempo real (100ms intervalo)
    realtime: {
        minInterval: 100,
        maxBurst: 5,
    },
    // Actualizaciones frecuentes (500ms intervalo)
    frequent: {
        minInterval: 500,
        maxBurst: 3,
    },
    // Actualizaciones normales (1s intervalo)
    normal: {
        minInterval: 1000,
        maxBurst: 2,
    },
    // Actualizaciones lentas (5s intervalo)
    slow: {
        minInterval: 5000,
        maxBurst: 1,
    },
};

export default {
    WebSocketRateLimiter,
    WebSocketThrottler,
    createWebSocketMiddleware,
    throttleEvent,
    RateLimitPresets,
    ThrottlePresets,
};
