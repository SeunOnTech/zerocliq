/**
 * Logger Utility
 * 
 * Simple console-based logger for Next.js API routes.
 * Provides consistent logging format without external dependencies.
 */

const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
}

function formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    return `[${timestamp}] ${levelStr} ${message}`;
}

/**
 * Simple logger compatible with Next.js API routes
 * Uses console methods with formatted output
 */
export const logger: Logger = {
    debug: (message: string, ...args: any[]) => {
        if (isDev) {
            console.debug(formatMessage("debug", message), ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        console.info(formatMessage("info", message), ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(formatMessage("warn", message), ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(formatMessage("error", message), ...args);
    },
};
