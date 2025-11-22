import { EventEmitter } from "events";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
    failureThreshold: number; // Número de fallos antes de abrir el circuito
    successThreshold: number; // Número de éxitos antes de cerrar desde HALF_OPEN
    timeout: number; // Tiempo en ms antes de intentar HALF_OPEN desde OPEN
    resetTimeout?: number; // Tiempo en ms para resetear contadores en estado CLOSED
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    totalCalls: number;
    lastFailureTime: Date | null;
    lastSuccessTime: Date | null;
    nextAttemptTime: Date | null;
}

/**
 * Circuit Breaker Pattern Implementation
 * 
 * Estados:
 * - CLOSED: Funcionamiento normal, permite todas las operaciones
 * - OPEN: Demasiados fallos, rechaza operaciones inmediatamente
 * - HALF_OPEN: Prueba si el servicio se ha recuperado
 * 
 * @example
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 * 
 * breaker.on('open', () => console.log('Circuit opened!'));
 * breaker.on('halfOpen', () => console.log('Circuit half-open, testing...'));
 * breaker.on('close', () => console.log('Circuit closed, back to normal'));
 * 
 * try {
 *   await breaker.execute(() => arduinoOperation());
 * } catch (error) {
 *   console.error('Operation failed or circuit is open');
 * }
 */
export class CircuitBreaker extends EventEmitter {
    private state: CircuitState = "CLOSED";
    private failureCount = 0;
    private successCount = 0;
    private totalCalls = 0;
    private nextAttemptTime: Date | null = null;
    private lastFailureTime: Date | null = null;
    private lastSuccessTime: Date | null = null;
    private resetTimer: NodeJS.Timeout | null = null;

    constructor(private options: CircuitBreakerOptions) {
        super();
    }

    /**
     * Ejecutar una función a través del circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalCalls++;

        if (this.state === "OPEN") {
            if (this.shouldAttemptReset()) {
                this.moveToHalfOpen();
            } else {
                const error = new Error(
                    `Circuit breaker is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`
                );
                (error as any).code = "CIRCUIT_OPEN";
                throw error;
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Ejecutar función con fallback si el circuito está abierto
     */
    async executeWithFallback<T>(
        fn: () => Promise<T>,
        fallback: () => T | Promise<T>
    ): Promise<T> {
        try {
            return await this.execute(fn);
        } catch (error: any) {
            if (error.code === "CIRCUIT_OPEN") {
                return await Promise.resolve(fallback());
            }
            throw error;
        }
    }

    /**
     * Manejar éxito de operación
     */
    private onSuccess(): void {
        this.lastSuccessTime = new Date();
        this.failureCount = 0;

        if (this.state === "HALF_OPEN") {
            this.successCount++;
            if (this.successCount >= this.options.successThreshold) {
                this.close();
            }
        }

        // Reset timer para CLOSED state
        if (this.state === "CLOSED" && this.options.resetTimeout) {
            this.scheduleReset();
        }
    }

    /**
     * Manejar fallo de operación
     */
    private onFailure(): void {
        this.lastFailureTime = new Date();
        this.failureCount++;
        this.successCount = 0;

        if (
            this.state === "CLOSED" &&
            this.failureCount >= this.options.failureThreshold
        ) {
            this.open();
        } else if (this.state === "HALF_OPEN") {
            this.open();
        }
    }

    /**
     * Verificar si debemos intentar resetear desde OPEN
     */
    private shouldAttemptReset(): boolean {
        return (
            this.nextAttemptTime !== null &&
            Date.now() >= this.nextAttemptTime.getTime()
        );
    }

    /**
     * Mover a estado HALF_OPEN
     */
    private moveToHalfOpen(): void {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        this.emit("halfOpen", this.getStats());
    }

    /**
     * Abrir el circuito
     */
    private open(): void {
        this.state = "OPEN";
        this.nextAttemptTime = new Date(Date.now() + this.options.timeout);
        this.clearResetTimer();
        this.emit("open", this.getStats());
    }

    /**
     * Cerrar el circuito
     */
    private close(): void {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;
        this.emit("close", this.getStats());

        if (this.options.resetTimeout) {
            this.scheduleReset();
        }
    }

    /**
     * Programar reset de contadores
     */
    private scheduleReset(): void {
        this.clearResetTimer();
        if (this.options.resetTimeout) {
            this.resetTimer = setTimeout(() => {
                this.failureCount = 0;
                this.successCount = 0;
            }, this.options.resetTimeout);
        }
    }

    /**
     * Limpiar timer de reset
     */
    private clearResetTimer(): void {
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }
    }

    /**
     * Resetear manualmente el circuit breaker
     */
    reset(): void {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.totalCalls = 0;
        this.nextAttemptTime = null;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.clearResetTimer();
        this.emit("reset", this.getStats());
    }

    /**
     * Forzar apertura del circuito (para testing o mantenimiento)
     */
    forceOpen(): void {
        this.open();
    }

    /**
     * Forzar cierre del circuito
     */
    forceClose(): void {
        this.close();
    }

    /**
     * Obtener estado actual
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Verificar si el circuito está cerrado
     */
    isClosed(): boolean {
        return this.state === "CLOSED";
    }

    /**
     * Verificar si el circuito está abierto
     */
    isOpen(): boolean {
        return this.state === "OPEN";
    }

    /**
     * Verificar si el circuito está medio abierto
     */
    isHalfOpen(): boolean {
        return this.state === "HALF_OPEN";
    }

    /**
     * Obtener estadísticas del circuit breaker
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failureCount,
            successes: this.successCount,
            totalCalls: this.totalCalls,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            nextAttemptTime: this.nextAttemptTime,
        };
    }

    /**
     * Limpiar recursos
     */
    destroy(): void {
        this.clearResetTimer();
        this.removeAllListeners();
    }
}

export default CircuitBreaker;
