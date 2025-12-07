/**
 * Structured Logging Utility for Agents
 * 
 * Provides consistent, searchable logging across all three agents
 * with categorization by level, agent name, and action type
 */

// ============================================================================
// LOG LEVELS
// ============================================================================

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'VALIDATION';

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    agent: string;
    message: string;
    data?: any;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

/**
 * Formats and outputs a structured log entry
 */
function log(entry: LogEntry): void {
    const logString = JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString()
    });

    // Output to console based on level
    switch (entry.level) {
        case 'ERROR':
            console.error(logString);
            break;
        case 'WARN':
            console.warn(logString);
            break;
        case 'INFO':
        case 'VALIDATION':
        default:
            console.log(logString);
            break;
    }
}

// ============================================================================
// LOGGER EXPORTED INTERFACE
// ============================================================================

export const logger = {
    /**
     * Log informational message
     * Use for: general flow, successful operations, user actions
     */
    info(agent: string, message: string, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            agent,
            message,
            data
        });
    },

    /**
     * Log warning message
     * Use for: recoverable errors, degraded functionality, suspicious data
     */
    warn(agent: string, message: string, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            agent,
            message,
            data
        });
    },

    /**
     * Log error message with optional Error object
     * Use for: failures, exceptions, critical issues
     */
    error(agent: string, message: string, error: Error | null, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            agent,
            message,
            data,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    },

    /**
     * Log validation decision
     * Use for: guardrail enforcement, filtered data, validation outcomes
     */
    validation(agent: string, action: string, reason: string, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'VALIDATION',
            agent,
            message: `${action}: ${reason}`,
            data
        });
    },

    /**
     * Log user action
     * Use for: tracking what users do (compose day, resolve conflict, etc.)
     */
    userAction(agent: string, action: string, userId: string, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            agent,
            message: `User action: ${action}`,
            data: {
                ...data,
                userId
            }
        });
    },

    /**
     * Log performance metric
     * Use for: tracking execution time, resource usage
     */
    performance(agent: string, operation: string, durationMs: number, data?: any): void {
        log({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            agent,
            message: `Performance: ${operation}`,
            data: {
                ...data,
                durationMs,
                durationSeconds: (durationMs / 1000).toFixed(2)
            }
        });
    }
};

// ============================================================================
// PERFORMANCE TIMER HELPER
// ============================================================================

/**
 * Helper class for timing operations
 * 
 * @example
 * const timer = new PerformanceTimer('compose-day', 'schedule-generation');
 * // ... do work ...
 * timer.end({ tasksScheduled: 5 }); // Automatically logs performance
 */
export class PerformanceTimer {
    private startTime: number;

    constructor(
        private agent: string,
        private operation: string
    ) {
        this.startTime = Date.now();
    }

    /**
     * End the timer and log the result
     */
    end(data?: any): number {
        const duration = Date.now() - this.startTime;
        logger.performance(this.agent, this.operation, duration, data);
        return duration;
    }

    /**
     * Get elapsed time without ending the timer
     */
    elapsed(): number {
        return Date.now() - this.startTime;
    }
}
