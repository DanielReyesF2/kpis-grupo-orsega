import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class Logger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  private writeToFile(level: LogLevel, message: string, meta?: any) {
    const logFile = path.join(this.logDir, `${level.toLowerCase()}.log`);
    const formattedMessage = this.formatMessage(level, message, meta) + '\n';
    
    fs.appendFileSync(logFile, formattedMessage);
  }

  private shouldLog(level: LogLevel): boolean {
    const envLevel = process.env.LOG_LEVEL || 'INFO';
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(envLevel as LogLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`🔴 ${message}`, meta || '');
      this.writeToFile(LogLevel.ERROR, message, meta);
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`🟡 ${message}`, meta || '');
      this.writeToFile(LogLevel.WARN, message, meta);
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`🔵 ${message}`, meta || '');
      this.writeToFile(LogLevel.INFO, message, meta);
    }
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🟢 ${message}`, meta || '');
      this.writeToFile(LogLevel.DEBUG, message, meta);
    }
  }

  // Métodos específicos para la aplicación
  auth(message: string, meta?: any) {
    this.info(`[AUTH] ${message}`, meta);
  }

  upload(message: string, meta?: any) {
    this.info(`[UPLOAD] ${message}`, meta);
  }

  treasury(message: string, meta?: any) {
    this.info(`[TREASURY] ${message}`, meta);
  }

  security(message: string, meta?: any) {
    this.warn(`[SECURITY] ${message}`, meta);
  }
}

export const logger = new Logger();


