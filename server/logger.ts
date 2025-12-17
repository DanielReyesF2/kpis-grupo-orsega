/**
 * ✅ SECURITY FIX: Logger estructurado para producción
 * - Filtra logs innecesarios en producción
 * - Redacta información sensible
 * - Proporciona niveles de logging apropiados
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

// Lista de patrones a redactar en logs
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /apikey/i,
  /authorization/i,
  /bearer/i,
  /jwt/i,
];

// Patrones de logs a filtrar en producción (ruido innecesario)
const NOISE_PATTERNS = [
  /^🔍.*Early/,          // Debug de uploads
  /^⏭️.*Saltando/,       // Debug de body parsers
  /^📂/,                  // Debug de archivos
  /^✅.*exists/i,         // Debug de existencia
  /healthcheck/i,         // Healthchecks
  /^GET \/health/,        // Health requests
];

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private isProduction = process.env.NODE_ENV === 'production';

  private redactSensitive(text: string): string {
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      // Redactar valores después de = o :
      result = result.replace(
        new RegExp(`(${pattern.source}[=:]\\s*)([^\\s,}\\]]+)`, 'gi'),
        '$1[REDACTED]'
      );
    }
    return result;
  }

  private shouldFilter(message: string): boolean {
    if (!this.isProduction) return false;
    return NOISE_PATTERNS.some(pattern => pattern.test(message));
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    let contextStr = context ? ` ${JSON.stringify(context)}` : '';

    // Redactar información sensible en producción
    if (this.isProduction) {
      contextStr = this.redactSensitive(contextStr);
    }

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldFilter(message)) return;
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name
      } : error
    };
    console.error(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    // Debug solo en desarrollo
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

export const logger = new Logger();

/**
 * ✅ SECURITY FIX: Wrapper de console para producción
 * Reemplaza console.log global para filtrar ruido en producción
 *
 * IMPORTANTE: Llamar initProductionConsole() al inicio del servidor
 */
export function initProductionConsole(): void {
  if (process.env.NODE_ENV !== 'production') {
    return; // No modificar console en desarrollo
  }

  const originalLog = console.log;
  const originalInfo = console.info;

  // Wrapper que filtra logs innecesarios
  const filteredLog = (...args: unknown[]) => {
    const message = args.map(a => String(a)).join(' ');

    // Filtrar ruido
    if (NOISE_PATTERNS.some(pattern => pattern.test(message))) {
      return;
    }

    // Redactar información sensible
    const redactedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        let result = arg;
        for (const pattern of SENSITIVE_PATTERNS) {
          result = result.replace(
            new RegExp(`(${pattern.source}[=:]\\s*)([^\\s,}\\]"']+)`, 'gi'),
            '$1[REDACTED]'
          );
        }
        return result;
      }
      return arg;
    });

    originalLog.apply(console, redactedArgs);
  };

  console.log = filteredLog;
  console.info = filteredLog;
}
