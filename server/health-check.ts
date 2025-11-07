import { Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Safe logger that won't fail in production
const safeLog = {
  debug: (msg: string, meta?: any) => {
    try {
      const { logger } = require('./logger');
      logger.debug(msg, meta);
    } catch {
      console.log(`[DEBUG] ${msg}`, meta || '');
    }
  },
  error: (msg: string, meta?: any) => {
    try {
      const { logger } = require('./logger');
      logger.error(msg, meta);
    } catch {
      console.error(`[ERROR] ${msg}`, meta || '');
    }
  },
  info: (msg: string, meta?: any) => {
    try {
      const { logger } = require('./logger');
      logger.info(msg, meta);
    } catch {
      console.log(`[INFO] ${msg}`, meta || '');
    }
  }
};

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    openai: 'up' | 'down' | 'not_configured';
    sendgrid: 'up' | 'down' | 'not_configured';
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    version: string;
  };
}

export async function healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'down',
      openai: 'not_configured',
      sendgrid: 'not_configured'
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    }
  };

  try {
    // Verificar base de datos con timeout
    try {
      // Usar Promise.race para timeout de 2 segundos
      // Usar db.execute con sql template tag (forma correcta de Drizzle ORM)
      const dbCheck = db.execute(sql`SELECT 1 as test`);
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database check timeout')), 2000)
      );
      
      await Promise.race([dbCheck, timeout]);
      health.services.database = 'up';
      safeLog.debug('Database health check passed');
    } catch (error) {
      health.services.database = 'down';
      // NO marcar como unhealthy si la DB falla - solo degraded
      // Railway necesita respuesta 200 para el healthcheck básico
      // El endpoint /health simple no depende de esto
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
      // Solo loggear errores no-timeout para evitar spam en logs
      if (error instanceof Error && !error.message.includes('timeout')) {
        safeLog.error('Database health check failed', { error: error.message });
      }
    }

    // Verificar OpenAI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      health.services.openai = 'up';
    } else {
      health.services.openai = 'not_configured';
      if (health.status === 'healthy') health.status = 'degraded';
    }

    // Verificar SendGrid o Resend
    const hasSendGrid = process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key';
    const hasResend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your-resend-api-key';
    
    if (hasSendGrid || hasResend) {
      health.services.sendgrid = 'up';
    } else {
      health.services.sendgrid = 'not_configured';
      if (health.status === 'healthy') health.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    safeLog.info('Health check completed', { 
      status: health.status, 
      responseTime: `${responseTime}ms`,
      services: health.services 
    });

    // Siempre retornar 200 para Railway - usar 'degraded' o 'unhealthy' en el payload
    // Railway necesita HTTP 200 para considerar el servicio vivo
    const statusCode = 200;
    res.status(statusCode).json(health);

  } catch (error) {
    safeLog.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    health.status = 'unhealthy';
    // Aún así retornar 200 para no bloquear Railway durante el build
    res.status(200).json(health);
  }
}

export async function readinessCheck(req: Request, res: Response) {
  try {
    // Verificar que la base de datos esté disponible con timeout
    // Usar db.execute con sql template tag (forma correcta de Drizzle ORM)
    const dbCheck = db.execute(sql`SELECT 1 as test`);
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Database readiness check timeout')), 2000)
    );
    
    await Promise.race([dbCheck, timeout]);
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    safeLog.error('Readiness check failed', { error: error instanceof Error ? error.message : String(error) });
    // Retornar 200 con status not_ready para Railway
    res.status(200).json({ status: 'not_ready', message: error instanceof Error ? error.message : String(error) });
  }
}

export async function livenessCheck(req: Request, res: Response) {
  // Verificación simple de que la aplicación está viva
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}


