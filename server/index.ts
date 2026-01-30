import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import compression from "compression";
import { registerRoutes } from "./routes";
// Vite imports will be loaded dynamically in development only
import { monthlyScheduler } from "./scheduler";
import { initializeDOFScheduler } from "./dof-scheduler";
import { securityMonitorMiddleware, loginMonitorMiddleware, uploadMonitorMiddleware, apiAccessMonitorMiddleware } from "./security-monitor";
import { healthCheck, readinessCheck, livenessCheck } from "./health-check";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { logger } from "./logger";

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

    // Filter errors
    beforeSend(event, hint) {
      // Don't send errors from healthcheck endpoints
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      return event;
    },

    // Configure release
    release: process.env.RAILWAY_GIT_COMMIT_SHA || "local",

    // Express integration for request/tracing
    integrations: [
      Sentry.expressIntegration(),
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
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
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

// Set Express environment explicitly based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
app.set('env', nodeEnv);

// Configure trust proxy for Railway FIRST (before healthcheck)
// Railway uses healthcheck.railway.app for healthchecks
if (nodeEnv === 'production') {
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
  try {
    // Responder inmediatamente sin ninguna verificación
    // Railway solo necesita saber que el servidor está vivo
    res.status(200).json({ 
      status: "healthy",
      service: "kpis-grupo-orsega",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Si algo falla, aún así retornar 200 para no bloquear Railway
    res.status(200).json({ 
      status: "healthy",
      service: "kpis-grupo-orsega",
      error: "healthcheck_error"
    });
  }
});

// Healthcheck HEAD method (Railway también puede usar HEAD)
app.head("/health", (req, res) => {
  try {
    res.status(200).end();
  } catch (error) {
    // Si algo falla, aún así retornar 200
    res.status(200).end();
  }
});

// Healthcheck alternativo para Railway - aún más simple
app.get("/healthz", (req, res) => {
  try {
    res.status(200).json({ 
      status: "ok",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({ status: "ok" });
  }
});

app.head("/healthz", (req, res) => {
  try {
    res.status(200).end();
  } catch (error) {
    res.status(200).end();
  }
});

// VERSION ENDPOINT - PÚBLICO - Para diagnóstico de deployment
// DEBE estar ANTES de cualquier middleware de autenticación
app.get("/api/version", (req, res) => {
  try {
    const gitCommit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VITE_BUILD_VERSION || "unknown";
    const gitBranch = process.env.RAILWAY_GIT_BRANCH || "unknown";
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));

    res.json({
      version: packageJson.version || "1.0.0",
      commit: gitCommit,
      branch: gitBranch,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      dependencies: {
        hasPdfParse: !!packageJson.dependencies["pdf-parse"],
        hasPdfjsDist: !!packageJson.dependencies["pdfjs-dist"],
        pdfParseVersion: packageJson.dependencies["pdf-parse"],
        pdfjsDistVersion: packageJson.dependencies["pdfjs-dist"],
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get version info" });
  }
});

// DEBUG ENDPOINT - Para diagnosticar variables de entorno
// Lista SOLO los nombres de variables (no valores) para debugging
app.get("/api/debug/env-keys", (req, res) => {
  try {
    // Obtener todos los nombres de variables de entorno
    const allEnvKeys = Object.keys(process.env).sort();

    // Filtrar las que contienen ciertos patrones (para encontrar variantes)
    const anthropicKeys = allEnvKeys.filter(k =>
      k.toLowerCase().includes('anthropic') ||
      k.toLowerCase().includes('claude')
    );

    const aiKeys = allEnvKeys.filter(k =>
      k.toLowerCase().includes('api_key') ||
      k.toLowerCase().includes('apikey') ||
      k.toLowerCase().includes('openai') ||
      k.toLowerCase().includes('anthropic')
    );

    // Verificar si ANTHROPIC_API_KEY existe exactamente
    const exactMatch = process.env.ANTHROPIC_API_KEY;
    const exactMatchLength = exactMatch?.length || 0;

    res.json({
      timestamp: new Date().toISOString(),
      totalEnvVars: allEnvKeys.length,
      anthropicRelatedKeys: anthropicKeys,
      aiRelatedKeys: aiKeys,
      exactAnthropicKeyCheck: {
        exists: !!exactMatch,
        length: exactMatchLength,
        firstChars: exactMatch ? `${exactMatch.substring(0, 4)}...` : null
      },
      // Lista de todas las variables que empiezan con A
      keysStartingWithA: allEnvKeys.filter(k => k.startsWith('A')),
      // Lista de variables críticas
      criticalVarsStatus: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get env debug info" });
  }
});

// Compression middleware - reduce tamaño de respuestas
// Skip compression for SSE streams (text/event-stream) to prevent buffering
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ⚠️ IMPORTANTE: Excluir multipart/form-data de body parsers
// Multer necesita acceso directo al stream sin procesamiento previo
app.use((req, res, next) => {
  // Logging temprano para uploads (para debugging)
  if (req.path.includes('/upload') || req.path.includes('/payment-vouchers')) {
    console.log('🔍 [Early] Petición recibida:', req.method, req.path);
    console.log('🔍 [Early] Content-Type:', req.headers['content-type']);
    console.log('🔍 [Early] Content-Length:', req.headers['content-length']);
    console.log('🔍 [Early] Authorization header presente:', !!req.headers['authorization']);
    console.log('🔍 [Early] Authorization header:', req.headers['authorization'] ? `${req.headers['authorization'].substring(0, 30)}...` : 'null');
    console.log('🔍 [Early] Todos los headers:', Object.keys(req.headers));
  }
  
  // Saltar body parsers para multipart/form-data
  // Multer manejará el parsing de estos requests
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    console.log('⏭️ [Early] Saltando body parsers para multipart/form-data');
    return next();
  }
  
  next();
});

// Aplicar body parsers solo para rutas no-multipart
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ SECURITY IMPROVEMENT: Headers de seguridad HTTP robustos (nivel Google)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Permitir inline scripts para Vite HMR
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"], // Permitir blob URLs para previews de imágenes
      connectSrc: ["'self'"], // Nova AI uses same-origin SSE
      fontSrc: ["'self'", "data:"], // Permitir fuentes embebidas (data URIs)
      objectSrc: ["'self'", "blob:"], // ✅ Permitir PDFs embebidos
      mediaSrc: ["'self'", "blob:"], // Permitir blob URLs para videos/audio
      frameSrc: ["'self'", "blob:", "data:"], // ✅ Permitir iframes para PDFs
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"], // ✅ Permitir iframes dentro de la misma app
      upgradeInsecureRequests: [], // Forzar HTTPS
    },
  },
  crossOriginEmbedderPolicy: false, // Compatible con Vite
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // ✅ Permitir recursos cross-origin para PDFs
  hsts: {
    maxAge: 31536000, // 1 año (requerido para preload)
    includeSubDomains: true,
    preload: true
  },
  // Prevenir MIME type sniffing
  noSniff: true,
  // Prevenir que el navegador haga XSS filtering (mejor usar CSP)
  xssFilter: true,
  // Ocultar powered-by header
  hidePoweredBy: true,
  // Prevenir iframe embedding (excepto same-origin)
  frameguard: { action: 'deny' },
  // Habilitar Referrer-Policy estricta
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
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

// ❌ ELIMINADO: Configuración duplicada de archivos estáticos de public/
// Los archivos estáticos de la app se sirven correctamente en server/vite.ts

// ✅ IMPORTANTE: Servir archivos subidos (facturas, comprobantes, etc.)
// Estos archivos son generados por la app y deben ser accesibles
const uploadsPath = path.join(process.cwd(), 'uploads');
console.log(`📂 Configurando servicio de archivos subidos desde: ${uploadsPath}`);

// Crear directorio de uploads si no existe
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log(`📂 Directorio uploads creado: ${uploadsPath}`);
}

// Servir archivos de /uploads sin autenticación (los URLs son privados y únicos)
// NOTA: En producción, considerar agregar tokens de acceso temporales
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d', // Cache de 1 día
  etag: true,
  lastModified: true,
  // Permitir que el navegador maneje PDFs e imágenes
  setHeaders: (res, filePath) => {
    // Permitir que los PDFs se muestren en iframe
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Determinar Content-Type basado en extensión
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    } else if (filePath.match(/\.(jpg|jpeg)$/i)) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));
console.log(`✅ Archivos de /uploads disponibles públicamente`);

// ✅ Servir archivos subidos (facturas, comprobantes, etc.)
// Esta ruta permite acceder a /uploads/facturas/... y /uploads/comprobantes/...
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1d', // Cache por 1 día
  etag: true,
  lastModified: true,
}));
console.log(`📁 [Static] Sirviendo archivos de: ${uploadsDir} en /uploads`);

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

// Sentry request/tracing is handled automatically via expressIntegration in init()

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
    console.log(`🌐 Accessible on:`);
    console.log(`   - http://localhost:${port}`);
    console.log(`   - http://127.0.0.1:${port}`);
    console.log(`   - http://0.0.0.0:${port}`);
    console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`🗄️ DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`🔑 JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
    console.log(`🏥 Healthcheck available at: http://localhost:${port}/health`);
    console.log(`✅ Server ready! Open http://localhost:${port} in your browser`);
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
  app.use(Sentry.expressErrorHandler());
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

    // /api/version ya está definido más arriba (línea 177) ANTES de middlewares

    console.log("✅ Health check endpoints registered");

    // Ensure treasury schema is up to date (migrations)
    try {
      const { ensureTreasurySchema } = await import("./treasury-schema");
      await ensureTreasurySchema();
      console.log("✅ Treasury schema migrations applied");
    } catch (error) {
      console.error("⚠️ Warning: Error applying treasury schema migrations (server still running):", error);
      console.error("⚠️ Error details:", error);
    }

    // Ensure sales schema is up to date (migrations)
    try {
      const { ensureSalesSchema } = await import("./sales-schema");
      await ensureSalesSchema();
      console.log("✅ Sales schema migrations applied");
    } catch (error) {
      console.error("⚠️ Warning: Error applying sales schema migrations (server still running):", error);
      console.error("⚠️ Error details:", error);
    }

    // Run KPI data migrations (idempotent)
    try {
      const { runKpiMigrations } = await import("./kpi-migrations");
      await runKpiMigrations();
      console.log("✅ KPI migrations applied");
    } catch (error) {
      console.error("⚠️ Warning: Error applying KPI migrations (server still running):", error);
    }

    // Register routes (this might take time but won't block /health)
    try {
      registerRoutes(app);
      console.log("✅ API routes registered");
    } catch (error) {
      console.error("⚠️ Warning: Error registering routes (server still running):", error);
      console.error("⚠️ Error details:", error);
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
    
    // Add 404 handler for API routes AFTER all routes are registered
    // This ensures API routes return JSON 404 instead of HTML
    app.use("/api/*", (req, res) => {
      console.log(`❌ [404] API route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ 
        error: "API route not found",
        path: req.originalUrl,
        method: req.method
      });
    });
    
    console.log("✅ All server initialization completed");
  } catch (error) {
    console.error("⚠️ CRITICAL: Error during async initialization:", error);
    console.error("⚠️ But server is still running and /health should work");
    // Don't crash - server is already listening and /health works
  }
})();
