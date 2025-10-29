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

// Run diagnostics immediately
logBootDiagnostics();

const app = express();

// ============================================================
// RAILWAY HEALTHCHECK - PRIMERO, ANTES DE TODO
// ============================================================
// Este endpoint DEBE responder inmediatamente sin dependencias
// Railway lo usa para determinar si el servicio está vivo
app.get("/health", (_req, res) => {
  try {
    // Respuesta mínima y rápida - sin dependencias
    res.status(200).json({ 
      status: "healthy",
      service: "kpis-grupo-orsega",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Si algo falla, aún así responder 200 para no bloquear Railway
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  }
});

// Configure trust proxy for .replit.app domain in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  console.log("🔒 Trust proxy enabled for production (.replit.app domain)");
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🔒 SECURITY MONITORING (SIN RIESGO - Solo monitoreo)
app.use('/api', securityMonitorMiddleware);
app.use('/api/login', loginMonitorMiddleware);
app.use('/api/upload', uploadMonitorMiddleware);
app.use('/api', apiAccessMonitorMiddleware);

// 🔒 SECURITY HEADERS (Mejora seguridad sin afectar funcionalidad)
app.use((req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy básico
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  
  next();
});

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

(async () => {
  // Register API routes BEFORE Vite middleware
  // ============================================
  // HEALTH CHECK ENDPOINTS (antes de autenticación)
  // ============================================
  app.get("/api/health", healthCheck);
  app.get("/api/health/ready", readinessCheck);
  app.get("/api/health/live", livenessCheck);

  registerRoutes(app);
  
  // Create HTTP server for proper WebSocket support
  const server = createServer(app);

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
      console.error("❌ Failed to load Vite middleware:", error);
    }
  } else {
    console.log("📦 Setting up static file serving for production...");
    try {
      const { serveStatic } = await import("./vite");
      serveStatic(app);
      console.log("✅ Static file serving configured");
    } catch (error) {
      console.error("❌ CRITICAL ERROR setting up static files:", error);
      throw error;
    }
  }

  // Error handling middleware MUST be added AFTER all other middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error for debugging but don't crash the server
    console.error(`[Server Error ${status}]:`, err.message);
    if (status >= 500) {
      console.error('Full error stack:', err.stack);
    }

    res.status(status).json({ message });
    // ✅ No throwing - let the server continue running
  });

  // Use Railway's PORT environment variable or fallback to 8080
  // Railway injects PORT environment variable for health checks
  const port = process.env.PORT || 8080;
  
  // Log port configuration for debugging
  console.log(`🚀 Starting server on port: ${port}`);
  console.log(`🔍 PORT environment variable: ${process.env.PORT || 'not set'}`);
  console.log(`🌐 Server will listen on: 0.0.0.0:${port}`);
  console.log(`📊 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`🗄️ DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
  console.log(`🔑 JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
  
  server.listen(port, "0.0.0.0", () => {
    console.log(`serving on port ${port}`);
    
    // Inicializar el scheduler de auto-cierre mensual
    // DESACTIVADO: Auto-cierre automático removido por solicitud del usuario
    // Los números de ventas a veces llegan 1 semana después del cierre del mes
    // Omar ahora manejará el cierre manualmente cuando tenga todos los datos
    console.log("⏸️  Auto-cierre automático DESACTIVADO - cierre manual requerido");
    // monthlyScheduler.start(); // <- COMENTADO
    console.log("✅ Sistema configurado para cierre manual");
    
    // Inicializar el scheduler de actualización automática del DOF
    initializeDOFScheduler();
  });

})();
