import { Request, Response } from 'express';
import { db } from './db';
import { logger } from './logger';

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
    // Verificar base de datos
    try {
      await db.execute('SELECT 1');
      health.services.database = 'up';
      logger.debug('Database health check passed');
    } catch (error) {
      health.services.database = 'down';
      health.status = 'unhealthy';
      logger.error('Database health check failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Verificar OpenAI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      health.services.openai = 'up';
    } else {
      health.services.openai = 'not_configured';
      if (health.status === 'healthy') health.status = 'degraded';
    }

    // Verificar SendGrid
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key') {
      health.services.sendgrid = 'up';
    } else {
      health.services.sendgrid = 'not_configured';
      if (health.status === 'healthy') health.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    logger.info('Health check completed', { 
      status: health.status, 
      responseTime: `${responseTime}ms`,
      services: health.services 
    });

    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) });
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
}

export async function readinessCheck(req: Request, res: Response) {
  try {
    // Verificar que la base de datos esté disponible
    await db.execute('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    logger.error('Readiness check failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({ status: 'not_ready' });
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


