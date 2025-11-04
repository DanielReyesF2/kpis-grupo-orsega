import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
// Vite imports will be loaded dynamically in development only
import { monthlyScheduler } from "./scheduler";
import { initializeDOFScheduler } from "./dof-scheduler";
import { securityMonitorMiddleware, loginMonitorMiddleware, uploadMonitorMiddleware, apiAccessMonitorMiddleware } from "./security-monitor";
import { healthCheck, readinessCheck, livenessCheck } from "./health-check";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";

// Initialize Sentry before anything else
import * as Sentry from "@sentry/node";

// Initialize Helmet for security headers
import helmet from "helmet";

// Configure Sentry - only if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    
    // Session Replay (optional, only in production)
    replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter errors
    beforeSend(event, hint) {
      // Don't send errors from healthcheck endpoints
      if (hint.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },
    
    // Configure release
    release: process.env.RAILWAY_GIT_COMMIT_SHA || "local",
    
    // Configure integrations
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  });
  
  console.log("✅ Sentry error tracking initialized");
} else {
  console.log("⚠️  Sentry DSN not configured - error tracking disabled");
}

// ====================
// BOOT DIAGNOSTICS - PRODUCTION DEBUGGING
// ====================
function logBootDiagnostics() {
  try {
    const nodeEnv = process.env.NODE_ENV || 'undefined';
    const appEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    
    console.log("\n🔍 === BOOT DIAGNOSTICS ===");
    console.log(`📊 NODE_ENV: ${nodeEnv}`);
    console.log(`📊 Express env will be: ${appEnv}`);
    console.log(`📊 Current working directory: ${process.cwd()}`);
    
    // Safe dirname calculation for both dev and production
    const currentFileUrl = import.meta.url;
    const currentFileDir = path.dirname(fileURLToPath(currentFileUrl));
    console.log(`📊 Script directory: ${currentFileDir}`);
  
    // Check critical paths for production
    const distIndexPath = path.resolve(currentFileDir, "index.js");
    const distPublicPath = path.resolve(currentFileDir, "public");
    const distPublicIndexPath = path.resolve(distPublicPath, "index.html");
    
    // Alternative paths (current build location)
    const altDistIndexPath = path.resolve(currentFileDir, "..", "server", "dist", "index.js");
    const altDistPublicPath = path.resolve(currentFileDir, "..", "dist", "public");
    const altDistPublicIndexPath = path.resolve(altDistPublicPath, "index.html");
  
  console.log(`📂 Expected dist/index.js: ${distIndexPath}`);
  console.log(`📂 Expected dist/public: ${distPublicPath}`);
  console.log(`📂 Expected dist/public/index.html: ${distPublicIndexPath}`);
  
  console.log(`✅ dist/index.js exists: ${fs.existsSync(distIndexPath)} (expected for production)`);
  console.log(`✅ dist/public exists: ${fs.existsSync(distPublicPath)} (expected for production)`);
  console.log(`✅ dist/public/index.html exists: ${fs.existsSync(distPublicIndexPath)} (expected for production)`);
  
  console.log(`📦 Build artifacts in current locations:`);
  console.log(`   backend (server/dist/index.js): ${fs.existsSync(altDistIndexPath)}`);
  console.log(`   frontend (dist/public/index.html): ${fs.existsSync(altDistPublicIndexPath)}`);
  
  // Check environment variables (without exposing values)
  const criticalEnvs = [
    'DATABASE_URL',
    'JWT_SECRET', 
    'SENDGRID_API_KEY',
    'REPL_ID',
    'REPL_SLUG'
  ];
  
  console.log("🔒 Environment variables status:");
  criticalEnvs.forEach(envVar => {
    const exists = !!process.env[envVar];
    const length = process.env[envVar]?.length || 0;
    console.log(`   ${envVar}: ${exists ? '✅ SET' : '❌ MISSING'} ${exists ? `(${length} chars)` : ''}`);
  });
  
    console.log("=== END BOOT DIAGNOSTICS ===\n");
  } catch (error) {
    console.error("⚠️ Error in boot diagnostics:", error);
    console.log("Continuing server startup...\n");
  }
}

// Run diagnostics immediately (but don't block if it fails)
try {
  logBootDiagnostics();
} catch (error) {
  console.error('⚠️ Boot diagnostics failed (non-critical):', error);
}

const app = express();

// Configure trust proxy for Railway FIRST (before healthcheck)
// Railway uses healthcheck.railway.app for healthchecks
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============================================================
// RAILWAY HEALTHCHECK - PRIMERO, ANTES DE TODO
// ============================================================
// Este endpoint DEBE responder inmediatamente sin dependencias
// Railway lo usa para determinar si el servicio está vivo
// DEBE estar ANTES de cualquier middleware o inicialización pesada
// Railway usa hostname: healthcheck.railway.app
// ULTRA SIMPLE - solo retorna 200 OK siempre
// NO usar ninguna operación que pueda fallar - responder inmediatamente
app.get("/health", (req, res) => {
  // No usar try-catch para evitar overhead
  // Simplemente responder con 200 OK siempre
  res.status(200).json({ 
    status: "healthy",
    service: "kpis-grupo-orsega"
  });
});

// Healthcheck HEAD method (Railway también puede usar HEAD)
app.head("/health", (req, res) => {
  res.status(200).end();
});

// Healthcheck alternativo para Railway - aún más simple
app.get("/healthz", (req, res) => {
  res.status(200).json({ 
    status: "ok"
  });
});

app.head("/healthz", (req, res) => {
  res.status(200).end();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🔒 SECURITY - Helmet para headers de seguridad modernos
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Permitir inline scripts para Vite HMR
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Compatible con Vite
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  }
}));

// 🔒 RATE LIMITING - VUL-002: Protección global contra DDOS
// === RATE LIMITER CONFIGURACIÓN ADAPTATIVA ===
const baseRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: express.Request, res: express.Response) => {
    res.status(429).json({
      message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
      retryAfter: 900,
    });
  },
  skip: (req: express.Request) => req.path === '/health' || req.path === '/healthz' || req.path === '/api/health',
};

// === CONFIGURACIÓN SEGÚN ENTORNO ===
const globalApiLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        ...baseRateLimit,
        max: 1000, // Producción: hasta 1000 requests cada 15 min por IP
      })
    : rateLimit({
        ...baseRateLimit,
        max: 5000, // Desarrollo: límite mucho más alto
      });

app.use('/api', globalApiLimiter);

// 🔒 SECURITY MONITORING (SIN RIESGO - Solo monitoreo)
app.use('/api', securityMonitorMiddleware);
app.use('/api/login', loginMonitorMiddleware);
app.use('/api/upload', uploadMonitorMiddleware);
app.use('/api', apiAccessMonitorMiddleware);

// Servir específicamente los archivos estáticos de public
app.use(express.static(path.join(process.cwd(), 'public')));

// Security helper: Redact sensitive data from logs
function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitive = ['password', 'token', 'authorization', 'apiKey', 'secret', 'jwt'];
  const result: any = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      (result as any)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (result as any)[key] = redactSensitiveData(value);
    } else {
      (result as any)[key] = value;
    }
  }
  
  return result;
}

app.use((req, res, next) => {
  // Skip logging for healthcheck endpoints - they need to be fast
  if (req.path === '/health' || req.path === '/healthz') {
    return next();
  }

  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const redactedResponse = redactSensitiveData(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(redactedResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Add Sentry request handler - must be before all routes
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Create HTTP server EARLY for healthchecks
const server = createServer(app);

// Use Railway's PORT environment variable (Railway injects this automatically)
// Do NOT set PORT manually in Railway - it will be injected at runtime
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

if (!port || isNaN(port)) {
  console.error('❌ ERROR: Invalid PORT value:', process.env.PORT);
  process.exit(1);
}

// CRITICAL: Start listening IMMEDIATELY so Railway healthchecks work
// This MUST happen before any async operations
// Wrap in try-catch to prevent crashes during startup
try {
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`🌐 Accessible on 0.0.0.0:${port}`);
    console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`🗄️ DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`🔑 JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
    console.log(`🏥 Healthcheck available at: http://0.0.0.0:${port}/health`);
    console.log(`🏥 Healthcheck alternative: http://0.0.0.0:${port}/healthz`);
    console.log(`✅ Railway healthcheck should work now!`);
  });

  // Handle server errors gracefully
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ ERROR: Port ${port} is already in use`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', error);
      // Don't exit - let it retry
    }
  });
} catch (error) {
  console.error('❌ CRITICAL: Failed to start server:', error);
  process.exit(1);
}

// Add Sentry error handler - must be before other error handlers
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// CRITICAL: Add error handler BEFORE async operations to catch any errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Capture exception with Sentry
  if (process.env.SENTRY_DSN && err) {
    Sentry.captureException(err);
  }
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Skip logging for healthcheck endpoints
  if (_req.path !== '/health' && _req.path !== '/healthz') {
    // Log error for debugging but don't crash the server
    console.error(`[Server Error ${status}]:`, err.message);
    if (status >= 500) {
      console.error('Full error stack:', err.stack);
    }
  }

  res.status(status).json({ message });
  // ✅ No throwing - let the server continue running
});

// Global unhandled error handlers
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Capture with Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
  
  // Don't exit - let the server continue
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  
  // Capture with Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  
  // Don't exit immediately - log and continue
  // Only exit if it's a critical error
  if (error.message.includes('EADDRINUSE') || error.message.includes('PORT')) {
    process.exit(1);
  }
});

// Now setup everything else ASYNCHRONOUSLY after server is listening
// This runs in the background and doesn't block the server from responding
(async () => {
  try {
    console.log("🔄 Starting async initialization...");
    
    // Register API routes BEFORE Vite middleware
    // ============================================
    // HEALTH CHECK ENDPOINTS (antes de autenticación)
    // ============================================
    app.get("/api/health", healthCheck);
    app.get("/api/health/ready", readinessCheck);
    app.get("/api/health/live", livenessCheck);
    console.log("✅ Health check endpoints registered");

    // Register routes (this might take time but won't block /health)
    try {
      registerRoutes(app);
      console.log("✅ API routes registered");
    } catch (error) {
      console.error("⚠️ Warning: Error registering routes (server still running):", error);
    }
    
    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const expressEnv = app.get("env");
    console.log(`🚀 Express environment detected: ${expressEnv}`);
    
    if (expressEnv === "development") {
      console.log("🔧 Setting up Vite middleware for development...");
      try {
        const { setupVite } = await import("./vite");
        await setupVite(app, server);
        console.log("✅ Vite middleware configured");
      } catch (error) {
        console.error("❌ Failed to load Vite middleware (non-critical):", error);
      }
    } else {
      console.log("📦 Setting up static file serving for production...");
      try {
        const { serveStatic } = await import("./vite");
        serveStatic(app);
        console.log("✅ Static file serving configured");
      } catch (error) {
        console.error("⚠️ Warning: Failed to setup static files (non-critical):", error);
        // Don't throw - server is already listening and /health works
      }
    }
    
    // Inicializar el scheduler de auto-cierre mensual
    // DESACTIVADO: Auto-cierre automático removido por solicitud del usuario
    console.log("⏸️  Auto-cierre automático DESACTIVADO - cierre manual requerido");
    // monthlyScheduler.start(); // <- COMENTADO
    console.log("✅ Sistema configurado para cierre manual");
    
    // Inicializar el scheduler de actualización automática del DOF
    try {
      initializeDOFScheduler();
      console.log("✅ DOF scheduler initialized");
    } catch (error) {
      console.error("⚠️ Warning: Failed to initialize DOF scheduler (non-critical):", error);
    }
    
    console.log("✅ All server initialization completed");
  } catch (error) {
    console.error("⚠️ CRITICAL: Error during async initialization:", error);
    console.error("⚠️ But server is still running and /health should work");
    // Don't crash - server is already listening and /health works
  }
})();
