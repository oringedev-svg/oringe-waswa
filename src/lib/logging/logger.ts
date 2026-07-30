/**
 * Structured logging for production observability.
 * All logs are JSON; queryable and parsed by log aggregation systems.
 */

export interface LogContext {
  [key: string]: unknown
}

class StructuredLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  info(message: string, context: LogContext = {}): void {
    this.log('INFO', message, context)
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('WARN', message, context)
  }

  error(message: string, error: Error | unknown, context: LogContext = {}): void {
    const errorContext: LogContext = {
      ...context,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error && this.isDevelopment ? error.stack : undefined,
    }
    this.log('ERROR', message, errorContext)
  }

  debug(message: string, context: LogContext = {}): void {
    if (this.isDevelopment) {
      this.log('DEBUG', message, context)
    }
  }

  private log(level: string, message: string, context: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }

    const output = JSON.stringify(logEntry)

    // In production, always use console.log (captured by container logs)
    // In development, use console.* for better readability in terminal
    if (this.isDevelopment) {
      switch (level) {
        case 'ERROR':
          console.error(output)
          break
        case 'WARN':
          console.warn(output)
          break
        default:
          console.log(output)
      }
    } else {
      console.log(output)
    }
  }
}

export const logger = new StructuredLogger()
