import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";

// Lazy load vite dependencies only in development
let viteLogger: any = null;
let createViteServer: any = null;

async function getViteDeps() {
  if (!viteLogger || !createViteServer) {
    const viteModule = await import("vite");
    viteLogger = viteModule.createLogger();
    createViteServer = viteModule.createServer;
  }
  return { viteLogger, createViteServer };
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import all vite dependencies to avoid bundling in production
  const { viteLogger, createViteServer } = await getViteDeps();
  
  // Dynamically import viteConfig only in development to avoid bundling issues
  let viteConfig;
  try {
    // Try to import dynamically - will only work if vite.config.js exists
    const configPath = "../vite.config.js";
    viteConfig = (await import(/* @vite-ignore */ configPath)).default;
  } catch (error) {
    // If import fails, create a minimal config for development
    console.warn("⚠️ Could not load vite.config, using minimal config");
    viteConfig = {
      root: path.resolve(import.meta.dirname, "..", "client"),
      server: {},
    };
  }
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { 
      server,
      protocol: 'ws',
      host: 'localhost',
    },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        // Log errors but don't kill the server - let Vite handle retries
        viteLogger.error(msg, options);
        // Only exit on critical errors, not on transform errors
        if (msg.includes('Failed to resolve') || msg.includes('Cannot find module')) {
          // These are critical build errors that should be fixed
          console.error('❌ Critical Vite error - check your imports');
        }
        // Don't exit - let the server continue and Vite will retry
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Only apply Vite middleware to non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    vite.middlewares(req, res, next);
  });
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip Vite middleware for API routes - they should be handled by Express routes
    if (url.startsWith("/api/")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  
  // Check alternative paths for production builds
  const altDistPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  const finalDistPath = fs.existsSync(distPath) ? distPath : altDistPath;

  if (!fs.existsSync(finalDistPath)) {
    console.error(`⚠️ WARNING: Could not find build directory at ${distPath} or ${altDistPath}`);
    console.error(`⚠️ Static file serving disabled, but API and /health should still work`);
    // Don't throw - let the server continue running
    // API endpoints and /health should still work
    return;
  }

  console.log(`✅ Serving static files from: ${finalDistPath}`);
  
  // Serve static files with cache control headers
  // Assets with hashes can be cached long-term, but index.html should not be cached
  app.use(express.static(finalDistPath, {
    maxAge: '1y', // Cache assets for 1 year (they have hashes, so safe)
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Don't cache index.html - always get fresh version
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  // This MUST be registered AFTER all API routes
  // Use a more explicit catch-all pattern that works in Express
  app.get('*', (req, res, next) => {
    // Skip API routes - they should be handled by Express routes
    if (req.path.startsWith("/api/")) {
      return next();
    }
    
    // Skip healthcheck endpoints
    if (req.path === '/health' || req.path === '/healthz') {
      return next();
    }
    
    const indexPath = path.resolve(finalDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      console.log(`[serveStatic] Serving index.html for route: ${req.path}`);
      // Ensure index.html is never cached
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath);
    } else {
      console.error(`[serveStatic] index.html not found at: ${indexPath}`);
      // If index.html doesn't exist, at least return 200 for healthcheck
      res.status(200).json({ 
        message: "Server running but frontend not found",
        healthcheck: "Use /health endpoint",
        indexPath: indexPath
      });
    }
  });
  
  // Also handle other HTTP methods (POST, PUT, etc.) for SPA routing
  app.use('*', (req, res, next) => {
    // Skip API routes - they should be handled by Express routes
    if (req.path.startsWith("/api/")) {
      return next();
    }
    
    // Skip healthcheck endpoints
    if (req.path === '/health' || req.path === '/healthz') {
      return next();
    }
    
    // Only handle GET requests with app.get above, let other methods pass through
    if (req.method !== 'GET') {
      return next();
    }
    
    const indexPath = path.resolve(finalDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      console.log(`[serveStatic] Serving index.html for ${req.method} ${req.path}`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}
