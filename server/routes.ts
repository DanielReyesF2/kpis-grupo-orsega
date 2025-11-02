import express from "express";
import { hash as bcryptHash } from "bcryptjs";
import { z } from "zod";
import type { Request } from "express";
import rateLimit from "express-rate-limit";

// Extended Request type for authenticated routes
interface AuthRequest extends Request {
  user: {
    id: number;
    role: string;
    email: string;
    name: string;
    areaId?: number | null;
    companyId?: number | null;
  };
}
import { storage } from "./storage";
import { jwtAuthMiddleware, jwtAdminMiddleware, loginUser } from "./auth";
import { insertCompanySchema, insertAreaSchema, insertKpiSchema, insertKpiValueSchema, insertUserSchema, updateShipmentStatusSchema, insertShipmentSchema, updateKpiSchema, kpiValues, insertClientSchema, insertProviderSchema, type InsertPaymentVoucher, kpisDura, kpisOrsega, kpiValuesDura, kpiValuesOrsega } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { getSourceSeries, getComparison } from "./fx-analytics";
import { emailService } from "./email-service";

// Helper to get authenticated user with proper type narrowing
function getAuthUser(req: AuthRequest): NonNullable<AuthRequest['user']> {
  if (!req.user) {
    throw new Error('Unauthorized');
  }
  return req.user;
}
import { updateWeeklySales, autoCloseMonth } from "../scripts/weekly_sales_update";
import { sendEmail, createTeamMessageTemplate } from "./email";
import { sendEmail as sendGridEmail, getShipmentStatusEmailTemplate, getPaymentReceiptEmailTemplate } from "./sendgrid";
import { catalogRouter } from './routes-catalog';
import { logisticsRouter } from './routes-logistics';
import path from "path";
import fs from "fs";
import { neon } from '@neondatabase/serverless';
import multer from "multer";

// Database connection for client preferences queries
const sql = neon(process.env.DATABASE_URL!);

// Security helpers: Remove sensitive data from user objects
function sanitizeUser(user: any) {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser;
}

function sanitizeUsers(users: any[]) {
  return users.map(sanitizeUser);
}

// Security helper: Redact sensitive data from logs
function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitive = ['password', 'token', 'authorization', 'apiKey', 'secret', 'jwt'];
  const result: Record<string, any> | any[] = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      (result as Record<string, any>)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, any>)[key] = redactSensitiveData(value);
    } else {
      (result as Record<string, any>)[key] = value;
    }
  }
  
  return result;
}

// Funciones utilitarias mejoradas para validación de KPIs
function extractNumericValue(value: string | number): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  
  // Remover caracteres no numéricos excepto punto decimal y signo negativo
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned);
}

function isLowerBetterKPI(kpiName: string): boolean {
  const lowerBetterPatterns = [
    'rotación de cuentas por cobrar',
    'velocidad de rotación',
    'tiempo de',
    'días de',
    'plazo de',
    'demora'
  ];
  
  const lowerKpiName = kpiName.toLowerCase();
  return lowerBetterPatterns.some(pattern => 
    lowerKpiName.includes(pattern) && !lowerKpiName.includes('entrega')
  );
}

// Función para crear notificaciones automáticas en cambios de estado críticos
async function createKPIStatusChangeNotification(kpi: any, user: any, previousStatus: string, newStatus: string, storage: any) {
  try {
    // Solo notificar en cambios críticos
    const criticalChanges = [
      { from: 'complies', to: 'not_compliant' },
      { from: 'alert', to: 'not_compliant' },
      { from: 'not_compliant', to: 'complies' }
    ];
    
    const isCriticalChange = criticalChanges.some(change => 
      change.from === previousStatus && change.to === newStatus
    );
    
    if (isCriticalChange) {
      const statusMap: Record<'complies' | 'alert' | 'not_compliant', string> = {
        'complies': 'En cumplimiento',
        'alert': 'En alerta',
        'not_compliant': 'No cumple'
      };
      
      const notification = {
        userId: user.id,
        title: `Cambio de estado en KPI: ${kpi.name}`,
        message: `El KPI "${kpi.name}" ha cambiado de "${statusMap[previousStatus as keyof typeof statusMap]}" a "${statusMap[newStatus as keyof typeof statusMap]}"`,
        type: newStatus === 'complies' ? 'success' : 'warning',
        isRead: false
      };
      
      await storage.createNotification(notification);
      console.log(`[KPI Notification] Notificación creada para cambio de estado: ${kpi.name}`);
    }
  } catch (error) {
    console.error('Error creating KPI status change notification:', error);
    // No fallar la operación por un error de notificación
  }
}

export function registerRoutes(app: express.Application) {
  const server = app.listen;

  // ========================================
  // REGISTER CATALOG ROUTES FIRST (NO AUTH REQUIRED)
  // ========================================
  app.use("/api", catalogRouter);
  // IMPORTANTE: logisticsRouter tiene POST /api/shipments que entra en conflicto
  // con el endpoint principal de shipments en esta misma línea 1949.
  // El endpoint principal usa insertShipmentSchema y maneja items, fechas, etc.
  // El endpoint de logisticsRouter usa createShipmentSchema (schema legacy diferente).
  // Se mantiene montado pero debería deshabilitarse si causa conflictos.
  // app.use("/api", logisticsRouter); // Temporalmente deshabilitado - causa conflictos con POST /api/shipments
  app.use("/api/logistics-legacy", logisticsRouter); // Montado en ruta diferente para evitar conflictos

  // ========================================
  // RATE LIMITERS - Protección contra abuso
  // ========================================
  
  // Rate limiter para login - Previene fuerza bruta
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por IP
    message: 'Demasiados intentos de login. Por favor, intenta de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter para registro - Previene spam
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 registros por hora por IP
    message: 'Demasiados intentos de registro. Por favor, intenta más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter para uploads - Controla uso de OpenAI API
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20, // 20 archivos por hora por IP
    message: 'Límite de uploads alcanzado. Por favor, intenta en 1 hora.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ========================================
  // PRODUCTION DEBUGGING ENDPOINTS (ADMIN ONLY)
  // ========================================
  
  // Health check endpoint - 🔒 Solo administradores
  // COMENTADO: Interfiere con Railway healthcheck
  // app.get('/health', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
  //   const nodeEnv = process.env.NODE_ENV || 'undefined';
  //   const expressEnv = app.get('env');
  //   
  //   const health = {
  //     status: 'ok',
  //     timestamp: new Date().toISOString(),
  //     environment: {
  //       NODE_ENV: nodeEnv,
  //       express_env: expressEnv,
  //       is_production: expressEnv === 'production'
  //     },
  //     server: {
  //       uptime: process.uptime(),
  //       memory: process.memoryUsage(),
  //       port: 5000
  //     }
  //   };
  //   
  //   res.json(health);
  // });
  
  // Environment check endpoint (más detallado) - 🔒 Solo administradores
  app.get('/env-check', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
    const nodeEnv = process.env.NODE_ENV || 'undefined';
    const expressEnv = app.get('env');
    
    // Paths críticos
    const paths = {
      cwd: process.cwd(),
      script_dir: import.meta.dirname,
      dist_index: path.resolve(import.meta.dirname, "index.js"),
      dist_public: path.resolve(import.meta.dirname, "public"),
      dist_public_index: path.resolve(import.meta.dirname, "public", "index.html")
    };
    
    // Verificar existencia de archivos
    const fileChecks = {
      dist_index_exists: false,
      dist_public_exists: false, 
      dist_public_index_exists: false
    };
    
    try {
      fileChecks.dist_index_exists = fs.existsSync(paths.dist_index);
      fileChecks.dist_public_exists = fs.existsSync(paths.dist_public);
      fileChecks.dist_public_index_exists = fs.existsSync(paths.dist_public_index);
    } catch (error) {
      // Handle potential permission errors
    }
    
    // Environment variables status (sin exponer valores)
    const envVars = [
      'DATABASE_URL',
      'JWT_SECRET', 
      'SENDGRID_API_KEY',
      'REPL_ID',
      'REPL_SLUG'
    ];
    
    const envStatus: Record<string, {exists: boolean; length: number; status: string}> = {};
    envVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      const length = process.env[envVar]?.length || 0;
      envStatus[envVar] = {
        exists,
        length: exists ? length : 0,
        status: exists ? 'SET' : 'MISSING'
      };
    });
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: nodeEnv,
        express_env: expressEnv,
        is_production: expressEnv === 'production'
      },
      paths,
      file_checks: fileChecks,
      env_variables: envStatus,
      critical_issues: [] as string[]
    };
    
    // Detectar problemas críticos
    if (!envStatus['JWT_SECRET']?.exists) {
      diagnostics.critical_issues.push('JWT_SECRET missing - auth will fail');
    }
    
    if (expressEnv === 'production' && !fileChecks.dist_public_index_exists) {
      diagnostics.critical_issues.push('dist/public/index.html missing in production');
    }
    
    res.json(diagnostics);
  });

  // API Health check endpoint - 🔒 Solo administradores
  app.get('/api/healthz', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
    res.json({ 
      status: 'ok', 
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // ====================
  // ADMIN ENDPOINTS
  // ====================

  // POST /api/admin/seed-clients - Crear clientes de prueba
  app.post("/api/admin/seed-clients", jwtAuthMiddleware, jwtAdminMiddleware, async (req, res) => {
    try {
      const { seedClients } = await import('./seed-clients');
      const result = await seedClients();
      
      res.json(result);
    } catch (error) {
      console.error('[Admin] Error seeding clients:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error seeding clients',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ====================
  // TREASURY AUTOMATION ENDPOINTS
  // ====================

  // POST /api/treasury/send-reminder - Enviar recordatorio manual
  app.post("/api/treasury/send-reminder", jwtAuthMiddleware, async (req, res) => {
    try {
      const { voucherId, clientId } = req.body;
      
      if (!voucherId || !clientId) {
        return res.status(400).json({ error: 'voucherId y clientId son requeridos' });
      }

      const { TreasuryAutomation } = await import('./treasury-automation');
      const result = await TreasuryAutomation.sendComplementReminder(voucherId, clientId);
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error) {
      console.error('[Treasury] Error sending reminder:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/treasury/resend-receipt - Reenviar comprobante
  app.post("/api/treasury/resend-receipt", jwtAuthMiddleware, async (req, res) => {
    try {
      const { voucherId, clientId, companyId } = req.body;
      
      if (!voucherId || !clientId || !companyId) {
        return res.status(400).json({ error: 'voucherId, clientId y companyId son requeridos' });
      }

      const { TreasuryAutomation } = await import('./treasury-automation');
      const result = await TreasuryAutomation.sendPaymentReceiptToSupplier(voucherId, clientId, companyId);
      
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error) {
      console.error('[Treasury] Error resending receipt:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // SPA fallback check endpoint - 🔒 Solo administradores
  app.get('/api/spa-check', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => {
    const indexPath = path.resolve(import.meta.dirname, 'public', 'index.html');
    const exists = fs.existsSync(indexPath);
    res.json({ 
      spaFallback: exists ? 'OK' : 'FAIL',
      indexPath,
      exists
    });
  });

  // Login route - 🔒 Con rate limiting
  app.post("/api/login", loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const result = await loginUser(username, password);
      
      if (!result) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("[POST /api/login] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/user - Obtener información del usuario autenticado
  app.get("/api/user", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      res.json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Admin: Resetear contraseña de un usuario específico
  app.post("/api/admin/reset-user-password", jwtAuthMiddleware, jwtAdminMiddleware, async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: "email y password son requeridos" });
      }
      // Buscar usuario por email (case-insensitive)
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const hash = await bcryptHash(password, 10);
      const updated = await storage.updateUser(user.id, { password: hash });
      if (!updated) {
        return res.status(500).json({ message: "No fue posible actualizar la contraseña" });
      }
      res.json({ success: true, userId: user.id });
    } catch (error) {
      console.error("[POST /api/admin/reset-user-password] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Registro público de usuarios - 🔒 Con rate limiting
  app.post("/api/register", registerLimiter, async (req, res) => {
    try {
      console.log("[POST /api/register] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));
      
      // Normalizar y coercionar datos antes de validación
      const { area, ...userData } = req.body;
      
      // Coercionar companyId de string a number
      const companyId = userData.companyId != null ? Number(userData.companyId) : undefined;
      
      // Mapear el área string a areaId integer
      let areaId = null;
      if (area && companyId) {
        const areaMapping: Record<string, Record<number, number>> = {
          'Sales': { 1: 1, 2: 4 },      // Ventas: Dura=1, Orsega=4
          'Logistics': { 1: 2, 2: 5 },  // Logística: Dura=2, Orsega=5
          'Purchasing': { 1: 7, 2: 10 }, // Compras: Dura=7, Orsega=10
          'Accounting': { 1: 3, 2: 6 }   // Contabilidad: Dura=3, Orsega=6
        };
        
        areaId = areaMapping[area]?.[companyId] || null;
        console.log(`[POST /api/register] Área mapeada: ${area} + Company ${companyId} = areaId ${areaId}`);
      }
      
      // Usar safeParse en lugar de parse para manejar errores apropiadamente
      const validationResult = insertUserSchema.safeParse({
        ...userData,
        companyId,
        areaId,
        email: userData.email?.toLowerCase(), // Normalizar email
      });
      
      if (!validationResult.success) {
        console.log("[POST /api/register] Error de validación:", validationResult.error.issues);
        return res.status(400).json({ 
          message: "Error de validación", 
          code: 'VALIDATION_ERROR',
          errors: validationResult.error.issues 
        });
      }
      
      const validatedData = validationResult.data;
      console.log("[POST /api/register] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));
      
      // Verificar que el email no esté ya en uso
      try {
        const existingUser = await storage.getUserByUsername(validatedData.email);
        if (existingUser) {
          return res.status(409).json({ 
            message: "El email ya está registrado" 
          });
        }
      } catch (error) {
        // Si no encuentra el usuario, está bien, podemos continuar
        console.log("[POST /api/register] Email disponible");
      }
      
      // Hash password (obligatorio para registro público)
      if (!validatedData.password) {
        return res.status(400).json({ 
          message: "La contraseña es obligatoria" 
        });
      }
      
      validatedData.password = await bcryptHash(validatedData.password, 10);
      
      // Asignar role por defecto para usuarios que se registran públicamente
      if (!validatedData.role) {
        validatedData.role = 'collaborator'; // Role por defecto
      }
      
      console.log("[POST /api/register] Datos después del hash:", JSON.stringify({ ...validatedData, password: '[HASHED]' }, null, 2));
      
      const user = await storage.createUser(validatedData);
      console.log("[POST /api/register] Usuario registrado exitosamente:", sanitizeUser(user));
      
      // Solo retornar 201 en caso de éxito real
      res.status(201).json({ 
        message: "Usuario registrado exitosamente",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("[POST /api/register] Error completo:", error);
      
      // Manejo específico de errores de base de datos
      if (error instanceof Error) {
        console.error("[POST /api/register] Stack trace:", error.stack);
        
        // Error de email duplicado (unique constraint)
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          return res.status(409).json({ 
            message: "El email ya está registrado",
            code: 'EMAIL_EXISTS'
          });
        }
      }
      
      // Error de validación Zod (aunque ya se maneja arriba)
      if (error instanceof z.ZodError) {
        console.error("[POST /api/register] Errores de validación:", error.errors);
        return res.status(400).json({ 
          message: "Error de validación", 
          code: 'VALIDATION_ERROR',
          errors: error.errors 
        });
      }
      
      // Error genérico del servidor
      res.status(500).json({ 
        message: "Error interno del servidor", 
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // User routes
  app.get("/api/user", jwtAuthMiddleware, async (req, res) => {
    try {
      const tokenUser = (req as any).user;
      
      // Obtener datos actualizados del usuario desde la base de datos
      const user = await storage.getUser(tokenUser.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove sensitive data from response
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users", jwtAuthMiddleware, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(sanitizeUsers(users));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[POST /api/users] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));
      
      // Validar datos con Zod
      const validatedData = insertUserSchema.parse(req.body);
      console.log("[POST /api/users] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));
      
      // Hash password if provided
      if (validatedData.password) {
        validatedData.password = await bcryptHash(validatedData.password, 10);
      }
      
      console.log("[POST /api/users] Datos después del hash:", JSON.stringify({ ...validatedData, password: '[HASHED]' }, null, 2));
      
      const user = await storage.createUser(validatedData);
      console.log("[POST /api/users] Usuario creado:", user);
      
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      console.error("[POST /api/users] Error completo:", error);
      if (error instanceof Error) {
        console.error("[POST /api/users] Stack trace:", error.stack);
      }
      
      if (error instanceof z.ZodError) {
        console.error("[POST /api/users] Errores de validación:", error.errors);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("[PUT /api/users/:id] Datos recibidos:", redactSensitiveData(req.body));
      
      // Validar datos con Zod (usando partial para permitir actualizaciones parciales)
      const validatedData = insertUserSchema.partial().parse(req.body);
      
      // Hash password if provided
      if (validatedData.password) {
        validatedData.password = await bcryptHash(validatedData.password, 10);
      }
      
      console.log("[PUT /api/users/:id] Datos validados:", redactSensitiveData(validatedData));
      
      const user = await storage.updateUser(id, validatedData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log("[PUT /api/users/:id] Usuario actualizado:", user);
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("[PUT /api/users/:id] Error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Company routes
  app.get("/api/companies", jwtAuthMiddleware, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/companies/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      console.log(`[GET /api/companies/:id] Buscando empresa con ID: ${id}`);
      console.log(`[GET /api/companies/:id] Empresa encontrada: ${company ? 'Sí' : 'No'}`);
      console.log(`[GET /api/companies/:id] Enviando empresa: { id: ${company.id}, name: '${company.name}' }`);
      
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/companies", jwtAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Area routes
  app.get("/api/areas", jwtAuthMiddleware, async (req, res) => {
    try {
      if (req.query.companyId && req.query.companyId !== 'undefined' && req.query.companyId !== 'null') {
        const companyIdNum = parseInt(req.query.companyId as string);
        if (!isNaN(companyIdNum) && companyIdNum > 0) {
          const areas = await storage.getAreasByCompany(companyIdNum);
          res.json(areas);
        } else {
          console.warn(`Invalid companyId received: ${req.query.companyId}`);
          const areas = await storage.getAreas();
          res.json(areas);
        }
      } else {
        const areas = await storage.getAreas();
        res.json(areas);
      }
    } catch (error) {
      console.error('Error getting areas:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/areas/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const area = await storage.getArea(id);
      
      if (!area) {
        return res.status(404).json({ message: "Area not found" });
      }
      
      res.json(area);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/areas", jwtAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertAreaSchema.parse(req.body);
      const area = await storage.createArea(validatedData);
      res.status(201).json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // KPI routes
  app.get("/api/kpis", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
      
      console.log('🔵 [GET /api/kpis] Endpoint llamado');
      console.log(`📊 Usuario: ${user.name}, Company ID: ${companyId}`);
      
      // Usar tabla unificada kpis con companyId
      let result: any[] = [];
      
      if (companyId === 1 || companyId === 2) {
        // Filtrar por companyId específico
        result = await sql(`
          SELECT 
            k.id,
            a.name as area,
            k.name as "kpiName",
            k.description,
            k.calculation_method as "calculationMethod",
            k.target as goal,
            k.unit,
            k.frequency,
            NULL as source,
            k.responsible,
            NULL as period,
            NULL as "createdAt",
            k.company_id as "companyId"
          FROM kpis k
          LEFT JOIN areas a ON a.id = k.area_id
          WHERE k.company_id = ${companyId}
          ORDER BY a.name, k.name
        `);
      } else if (!companyId) {
        // Sin filtro - obtener todos los KPIs
        result = await sql(`
          SELECT 
            k.id,
            a.name as area,
            k.name as "kpiName",
            k.description,
            k.calculation_method as "calculationMethod",
            k.target as goal,
            k.unit,
            k.frequency,
            NULL as source,
            k.responsible,
            NULL as period,
            NULL as "createdAt",
            k.company_id as "companyId"
          FROM kpis k
          LEFT JOIN areas a ON a.id = k.area_id
          ORDER BY k.company_id, a.name, k.name
        `);
      } else {
        return res.status(400).json({ error: 'Invalid company ID. Use 1 for Dura or 2 for Orsega' });
      }
      
      // Convertir al formato esperado por el frontend
      const formattedResult = result.map(kpi => ({
        id: kpi.id,
        area: kpi.area,
        kpiName: kpi.kpiName,
        name: kpi.kpiName, // Mantener compatibilidad
        description: kpi.description,
        calculationMethod: kpi.calculationMethod,
        goal: kpi.goal,
        target: kpi.goal,
        unit: kpi.unit,
        frequency: kpi.frequency,
        source: kpi.source || null,
        responsible: kpi.responsible || null,
        period: kpi.period || null,
        createdAt: kpi.createdAt,
        companyId: kpi.companyId,
        areaId: null // No hay areaId en kpis_dura/kpis_orsega
      }));
      
      console.log(`📊 [GET /api/kpis] Retornando ${formattedResult.length} KPIs desde tabla unificada kpis`);
      res.json(formattedResult);
    } catch (error: any) {
      console.error('❌ Error fetching KPIs:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  // ==============================
  // Admin: Fix Dura KPI goal/meta
  // ==============================
  app.post("/api/admin/fix-dura-kpi-goal", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo administradores' });
      }

      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL!);

      // KPI de Volumen de Ventas de Dura: id 39 por convención; si cambia, intentamos también por nombre
      const MONTHLY_GOAL = 53480; // en KG
      const UNIT = 'KG';

      const resultById = await sql`
        UPDATE kpis_dura
        SET goal = ${MONTHLY_GOAL}, unit = ${UNIT}
        WHERE id = 39
        RETURNING id, kpi_name, goal, unit
      `;

      let updatedRows = resultById.length;

      if (updatedRows === 0) {
        const resultByName = await sql`
          UPDATE kpis_dura
          SET goal = ${MONTHLY_GOAL}, unit = ${UNIT}
          WHERE lower(kpi_name) LIKE '%ventas%'
          RETURNING id, kpi_name, goal, unit
        `;
        updatedRows = resultByName.length;
      }

      return res.json({ ok: true, updated: updatedRows });
    } catch (error) {
      console.error('[POST /api/admin/fix-dura-kpi-goal] Error:', error);
      return res.status(500).json({ ok: false, error: 'Error interno' });
    }
  });

  app.get("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const kpi = await storage.getKpi(id);
      
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      // All collaborators can access all KPIs from both companies since they work for both
      // No access restrictions by company
      
      // Determinar si este KPI se trata de un indicador donde un valor menor es mejor
      const isLowerBetter = kpi.name.includes("Rotación de cuentas por cobrar") ||
                           kpi.name.includes("Velocidad de rotación") || 
                          (kpi.name.includes("Tiempo") && !kpi.name.includes("entrega"));
      
      console.log(`[GET KPI/${id}] Calculando para "${kpi.name}". ¿Es invertido?: ${isLowerBetter}`);
      
      // Añadir propiedad isLowerBetter al KPI para facilitar cálculos en el front
      res.json({
        ...kpi,
        isLowerBetter
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kpis", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      // 🔒 SEGURO: Solo administradores y gerentes pueden crear KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para crear KPIs" });
      }
      
      const validatedData = insertKpiSchema.parse(req.body);
      const kpi = await storage.createKpi(validatedData);
      res.status(201).json(kpi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      // 🔒 SEGURO: Solo administradores y gerentes pueden actualizar KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para actualizar KPIs" });
      }
      
      const id = parseInt(req.params.id);
      const validatedData = updateKpiSchema.parse(req.body);
      
      console.log(`[PUT /api/kpis/${id}] Datos validados:`, validatedData);
      
      const kpi = await storage.updateKpi(id, validatedData);
      
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      console.log(`[PUT /api/kpis/${id}] KPI actualizado:`, kpi);
      res.json(kpi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[PUT /api/kpis] Error de validación:`, error.errors);
        return res.status(400).json({ message: error.errors });
      }
      console.error(`[PUT /api/kpis] Error interno:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      // 🔒 SEGURO: Solo administradores y gerentes pueden eliminar KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para eliminar KPIs" });
      }
      
      const id = parseInt(req.params.id);
      const success = await storage.deleteKpi(id);
      
      if (!success) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      res.json({ message: "KPI eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // ENDPOINTS ESPECÍFICOS PARA KPIs POR EMPRESA
  // ========================================

  // GET /api/kpis-dura - Obtener KPIs de Dura
  app.get("/api/kpis-dura", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log('🔵 [GET /api/kpis-dura] Endpoint llamado');
      
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql(`
        SELECT 
          id,
          area,
          kpi_name as "kpiName",
          description,
          calculation_method as "calculationMethod",
          goal,
          unit,
          frequency,
          source,
          responsible,
          period,
          created_at as "createdAt"
        FROM kpis_dura 
        ORDER BY area, kpi_name
      `);
      
      console.log(`📊 [GET /api/kpis-dura] Retornando ${result.length} KPIs de Dura`);
      res.json(result);
    } catch (error) {
      console.error('❌ Error fetching Dura KPIs:', error);
      res.status(500).json({ error: 'Failed to fetch Dura KPIs' });
    }
  });

  // GET /api/kpis-orsega - Obtener KPIs de Orsega
  app.get("/api/kpis-orsega", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log('🔵 [GET /api/kpis-orsega] Endpoint llamado');
      
      const sql = neon(process.env.DATABASE_URL!);
      const result = await sql(`
        SELECT 
          id,
          area,
          kpi_name as "kpiName",
          description,
          calculation_method as "calculationMethod",
          goal,
          unit,
          frequency,
          source,
          responsible,
          period,
          created_at as "createdAt"
        FROM kpis_orsega 
        ORDER BY area, kpi_name
      `);
      
      console.log(`📊 [GET /api/kpis-orsega] Retornando ${result.length} KPIs de Orsega`);
      res.json(result);
    } catch (error) {
      console.error('❌ Error fetching Orsega KPIs:', error);
      res.status(500).json({ error: 'Failed to fetch Orsega KPIs' });
    }
  });

  // GET /api/kpis-by-company/:companyId - Obtener KPIs por empresa (1=Dura, 2=Orsega)
  app.get("/api/kpis-by-company/:companyId", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      console.log(`🔵 [GET /api/kpis-by-company/${companyId}] Endpoint llamado`);
      
      const sql = neon(process.env.DATABASE_URL!);
      let result;
      
      if (companyId === 1) {
        // Dura
        result = await sql(`
          SELECT 
            id,
            area,
            kpi_name as "kpiName",
            description,
            calculation_method as "calculationMethod",
            goal,
            unit,
            frequency,
            source,
            responsible,
            period,
            created_at as "createdAt",
            'Dura' as "company"
          FROM kpis_dura 
          ORDER BY area, kpi_name
        `);
      } else if (companyId === 2) {
        // Orsega
        result = await sql(`
          SELECT 
            id,
            area,
            kpi_name as "kpiName",
            description,
            calculation_method as "calculationMethod",
            goal,
            unit,
            frequency,
            source,
            responsible,
            period,
            created_at as "createdAt",
            'Orsega' as "company"
          FROM kpis_orsega 
          ORDER BY area, kpi_name
        `);
      } else {
        return res.status(400).json({ error: 'Invalid company ID. Use 1 for Dura or 2 for Orsega' });
      }
      
      console.log(`📊 [GET /api/kpis-by-company/${companyId}] Retornando ${result.length} KPIs`);
      res.json(result);
    } catch (error) {
      console.error('❌ Error fetching KPIs by company:', error);
      res.status(500).json({ error: 'Failed to fetch KPIs by company' });
    }
  });

  // GET /api/kpis-by-user/:userId - Obtener KPIs específicos de un usuario
  app.get("/api/kpis-by-user/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      console.log(`🔵 [GET /api/kpis-by-user/${userId}] Endpoint llamado`);
      
      // Primero obtener información del usuario
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const sql = neon(process.env.DATABASE_URL!);
      let result: any[] = [];
      
      // Determinar qué tabla usar basado en el nombre del usuario
      if (user.name.toLowerCase().includes('omar') || user.name.toLowerCase().includes('thalia')) {
        // Buscar en ambas tablas y filtrar por responsable
        const duraKpis = await sql(`
          SELECT 
            id,
            area,
            kpi_name as "kpiName",
            description,
            calculation_method as "calculationMethod",
            goal,
            unit,
            frequency,
            source,
            responsible,
            period,
            created_at as "createdAt",
            'Dura' as "company"
          FROM kpis_dura 
          WHERE responsible ILIKE '%${user.name.split(' ')[0]}%'
          ORDER BY area, kpi_name
        `);
        
        const orsegaKpis = await sql(`
          SELECT 
            id,
            area,
            kpi_name as "kpiName",
            description,
            calculation_method as "calculationMethod",
            goal,
            unit,
            frequency,
            source,
            responsible,
            period,
            created_at as "createdAt",
            'Orsega' as "company"
          FROM kpis_orsega 
          WHERE responsible ILIKE '%${user.name.split(' ')[0]}%'
          ORDER BY area, kpi_name
        `);
        
        result = [...duraKpis, ...orsegaKpis];
      }
      
      console.log(`📊 [GET /api/kpis-by-user/${userId}] Retornando ${result.length} KPIs para ${user.name}`);
      res.json(result);
    } catch (error) {
      console.error('❌ Error fetching KPIs by user:', error);
      res.status(500).json({ error: 'Failed to fetch KPIs by user' });
    }
  });

  // ========================================

  // Nueva ruta para eliminar KPI específico del usuario
  app.delete("/api/user-kpis/:kpiId", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const kpiId = parseInt(req.params.kpiId);
      
      // Verificar que el KPI existe
      const kpi = await storage.getKpi(kpiId);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      // Eliminar solo los valores de este KPI para este usuario específico
      const success = await storage.deleteKpiValuesByUser(user.id, kpiId);
      
      if (!success) {
        // Si no se encontraron valores, significa que el usuario no tiene este KPI
        // Esto no es un error, simplemente no había nada que eliminar
        return res.json({ message: "No había valores de KPI para este usuario (ya estaba eliminado)" });
      }
      
      res.json({ message: "KPI eliminado para el usuario específico" });
    } catch (error) {
      console.error("Error eliminating user-specific KPI:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // KPI Value routes
  // Endpoint para obtener top performers por área
  app.get("/api/top-performers", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId } = req.query;
      
      if (!companyId) {
        return res.status(400).json({ message: 'companyId es requerido' });
      }

      const query = `
        SELECT 
          a.name as area_name,
          a.id as area_id,
          COUNT(k.id) as total_kpis,
          COUNT(CASE WHEN kv.status = 'complies' THEN 1 END) as compliant_kpis,
          COALESCE(ROUND(COUNT(CASE WHEN kv.status = 'complies' THEN 1 END) * 100.0 / NULLIF(COUNT(k.id), 0), 2), 0) as compliance_percentage
        FROM areas a 
        LEFT JOIN kpis k ON a.id = k.area_id 
        LEFT JOIN kpi_values kv ON k.id = kv.kpi_id 
        WHERE k.company_id = $1
        GROUP BY a.id, a.name 
        HAVING COUNT(k.id) > 0
        ORDER BY compliance_percentage DESC, total_kpis DESC
        LIMIT 5
      `;

      const result = await sql(query, [companyId]);
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching top performers:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  app.get("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      
      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId as string);
        const kpi = await storage.getKpi(kpiId);
        
        if (!kpi) {
          return res.status(404).json({ message: "KPI not found" });
        }
        
        // Para colaboradores, mostrar solo sus propios KPIs
        // Para managers/admins, mostrar todos los KPIs
        if (user.role === 'collaborator') {
          const kpiValues = await storage.getKpiValuesByKpi(kpiId);
          const userKpiValues = kpiValues.filter(kv => kv.userId === user.id);
          res.json(userKpiValues);
        } else {
          const kpiValues = await storage.getKpiValuesByKpi(kpiId);
          res.json(kpiValues);
        }
      } else {
        // Usar la tabla nueva kpi_values directamente (las tablas legacy no existen)
        const allValues = await storage.getKpiValues();
        
        console.log(`[GET /api/kpi-values] Retornando ${allValues.length} valores de la tabla kpi_values`);
        
        if (allValues.length > 0) {
          console.log(`[GET /api/kpi-values] Primeros 3 valores de ejemplo:`, allValues.slice(0, 3).map(v => ({ kpiId: v.kpiId, value: v.value, period: v.period })));
        }
        
        if (user.role === 'collaborator') {
          // Colaboradores solo ven sus propios KPIs
          const userKpiValues = allValues.filter(kv => kv.userId === user.id);
          res.json(userKpiValues);
        } else {
          // Managers/admins ven todos los KPIs
          res.json(allValues);
        }
      }
    } catch (error) {
      console.error("[GET /api/kpi-values] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const validatedData = insertKpiValueSchema.parse({
        ...req.body,
        userId: user.id // Asegurar que el KPI se asocie al usuario actual
      });
      
      console.log(`[POST /api/kpi-values] Actualizando KPI ${validatedData.kpiId} para usuario ${user.id}`);
      
      // Buscar el KPI primero en la tabla nueva (kpis)
      let kpi: any = await storage.getKpi(validatedData.kpiId);
      let kpiSource: 'kpis' | 'kpis_dura' | 'kpis_orsega' = 'kpis';
      
      // Si no se encuentra en la tabla nueva, buscar en las tablas antiguas
      if (!kpi && typeof db !== 'undefined') {
        try {
          // Buscar en kpis_dura
          const duraKpi = await db
            .select()
            .from(kpisDura)
            .where(eq(kpisDura.id, validatedData.kpiId))
            .limit(1);
          
          if (duraKpi.length > 0) {
            kpi = {
              id: duraKpi[0].id,
              name: duraKpi[0].kpiName,
              description: duraKpi[0].description,
              target: duraKpi[0].goal,
              unit: duraKpi[0].unit,
              frequency: duraKpi[0].frequency,
              calculationMethod: duraKpi[0].calculationMethod,
              responsible: duraKpi[0].responsible,
              area: duraKpi[0].area,
              company: 'Dura'
            };
            kpiSource = 'kpis_dura';
            console.log(`[POST /api/kpi-values] KPI encontrado en kpis_dura: ${kpi.name}`);
          } else {
            // Buscar en kpis_orsega
            const orsegaKpi = await db
              .select()
              .from(kpisOrsega)
              .where(eq(kpisOrsega.id, validatedData.kpiId))
              .limit(1);
            
            if (orsegaKpi.length > 0) {
              kpi = {
                id: orsegaKpi[0].id,
                name: orsegaKpi[0].kpiName,
                description: orsegaKpi[0].description,
                target: orsegaKpi[0].goal,
                unit: orsegaKpi[0].unit,
                frequency: orsegaKpi[0].frequency,
                calculationMethod: orsegaKpi[0].calculationMethod,
                responsible: orsegaKpi[0].responsible,
                area: orsegaKpi[0].area,
                company: 'Orsega'
              };
              kpiSource = 'kpis_orsega';
              console.log(`[POST /api/kpi-values] KPI encontrado en kpis_orsega: ${kpi.name}`);
            }
          }
        } catch (error) {
          console.error('[POST /api/kpi-values] Error buscando en tablas antiguas:', error);
        }
      }
      
      if (!kpi) {
        console.error(`[POST /api/kpi-values] KPI ${validatedData.kpiId} no encontrado en ninguna tabla`);
        return res.status(404).json({ message: "KPI not found" });
      }

      // Obtener el último valor para comparar cambios de estado (solo para KPIs nuevos)
      let previousStatus: string | null = null;
      if (kpiSource === 'kpis') {
        const lastValues = await storage.getLatestKpiValues(validatedData.kpiId, 1);
        previousStatus = lastValues.length > 0 ? lastValues[0].status : null;
      }
      
      // Calcular el cumplimiento si hay un objetivo con validación mejorada
      if (kpi.target || kpi.goal) {
        const currentValue = validatedData.value;
        const target = kpi.target || kpi.goal;
        
        // Validación robusta de valores numéricos
        const numericCurrentValue = extractNumericValue(currentValue);
        const numericTarget = extractNumericValue(target);
        
        if (!isNaN(numericCurrentValue) && !isNaN(numericTarget)) {
          let percentage: number;
          
          // Determinar si es una métrica invertida usando lógica mejorada
          const isLowerBetter = isLowerBetterKPI(kpi.name || kpi.kpiName || '');
          
          console.log(`[KPI Calculation] Calculando para "${kpi.name || kpi.kpiName}". ¿Es invertido?: ${isLowerBetter}`);
          
          if (isLowerBetter) {
            // Para métricas donde un valor menor es mejor (como días de cobro)
            percentage = Math.min(numericTarget / numericCurrentValue * 100, 100);
            
            // Determinar estado basado en porcentaje de cumplimiento
            if (numericCurrentValue <= numericTarget) {
              validatedData.status = 'complies';
            } else if (numericCurrentValue <= numericTarget * 1.1) { // 10% de margen para alerta
              validatedData.status = 'alert';
            } else {
              validatedData.status = 'not_compliant';
            }
          } else {
            // Para métricas normales donde un valor mayor es mejor
            percentage = Math.min(numericCurrentValue / numericTarget * 100, 100);
            
            // Determinar estado basado en porcentaje de cumplimiento
            if (numericCurrentValue >= numericTarget) {
              validatedData.status = 'complies';
            } else if (numericCurrentValue >= numericTarget * 0.9) { // 90% del objetivo para alerta
              validatedData.status = 'alert';
            } else {
              validatedData.status = 'not_compliant';
            }
          }
          
          validatedData.compliancePercentage = `${percentage.toFixed(1)}%`;
        }
      }
      
      // Manejar la inserción según la fuente del KPI
      let kpiValue: any;
      
      if (kpiSource === 'kpis_dura' || kpiSource === 'kpis_orsega') {
        // Guardar en tablas antiguas (kpi_values_dura o kpi_values_orsega)
        // Parsear el período para extraer mes y año
        // Puede venir en formato "Semana X - Mes Año" o solo "Mes Año"
        let periodMatch = validatedData.period.match(/Semana\s+\d+\s+-\s+(\w+)\s+(\d{4})/);
        if (!periodMatch) {
          // Intentar formato simple "Mes Año"
          periodMatch = validatedData.period.match(/(\w+)\s+(\d{4})/);
        }
        
        // Extraer valores del match o usar valores por defecto
        let monthName: string;
        let year: number;
        
        if (periodMatch) {
          monthName = periodMatch[1];
          year = parseInt(periodMatch[2]);
        } else {
          // Si no se encuentra, usar el mes y año actual
          const now = new Date();
          const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          monthName = months[now.getMonth()];
          year = now.getFullYear();
          console.log(`[POST /api/kpi-values] No se pudo parsear período "${validatedData.period}", usando período actual: ${monthName} ${year}`);
        }
        
        const numericValue = extractNumericValue(validatedData.value);
        
        if (isNaN(numericValue)) {
          return res.status(400).json({ message: "El valor debe ser numérico" });
        }
        
        // Mapear nombres de meses en español a mayúsculas para coincidir con el formato de la BD
        const monthMap: { [key: string]: string } = {
          'enero': 'ENERO', 'febrero': 'FEBRERO', 'marzo': 'MARZO', 'abril': 'ABRIL',
          'mayo': 'MAYO', 'junio': 'JUNIO', 'julio': 'JULIO', 'agosto': 'AGOSTO',
          'septiembre': 'SEPTIEMBRE', 'octubre': 'OCTUBRE', 'noviembre': 'NOVIEMBRE', 'diciembre': 'DICIEMBRE'
        };
        
        // Convertir nombre de mes a mayúsculas usando el mapa
        const monthLower = monthName.toLowerCase();
        const finalMonth = monthMap[monthLower] || monthName.toUpperCase();
        
        if (kpiSource === 'kpis_dura') {
          // Verificar si ya existe un registro para este período
          const existing = await sql`
            SELECT * FROM kpi_values_dura 
            WHERE kpi_id = ${validatedData.kpiId} 
            AND month = ${finalMonth} 
            AND year = ${year}
            LIMIT 1
          `;
          
          if (existing.length > 0) {
            // Actualizar registro existente
            const updated = await sql`
              UPDATE kpi_values_dura 
              SET value = ${numericValue}, created_at = NOW()
              WHERE id = ${existing[0].id}
              RETURNING *
            `;
            kpiValue = {
              id: updated[0].id,
              kpiId: updated[0].kpi_id,
              value: updated[0].value.toString(),
              period: `${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} ${year}`,
              date: updated[0].created_at,
              compliancePercentage: validatedData.compliancePercentage,
              status: validatedData.status,
              comments: validatedData.comments,
              updatedBy: user.id
            };
          } else {
            // Crear nuevo registro
            const inserted = await sql`
              INSERT INTO kpi_values_dura (kpi_id, month, year, value, created_at)
              VALUES (${validatedData.kpiId}, ${finalMonth}, ${year}, ${numericValue}, NOW())
              RETURNING *
            `;
            kpiValue = {
              id: inserted[0].id,
              kpiId: inserted[0].kpi_id,
              value: inserted[0].value.toString(),
              period: `${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} ${year}`,
              date: inserted[0].created_at,
              compliancePercentage: validatedData.compliancePercentage,
              status: validatedData.status,
              comments: validatedData.comments,
              updatedBy: user.id
            };
          }
        } else {
          // kpis_orsega
          const existing = await sql`
            SELECT * FROM kpi_values_orsega 
            WHERE kpi_id = ${validatedData.kpiId} 
            AND month = ${finalMonth} 
            AND year = ${year}
            LIMIT 1
          `;
          
          if (existing.length > 0) {
            // Actualizar registro existente
            const updated = await sql`
              UPDATE kpi_values_orsega 
              SET value = ${numericValue}, created_at = NOW()
              WHERE id = ${existing[0].id}
              RETURNING *
            `;
            kpiValue = {
              id: updated[0].id,
              kpiId: updated[0].kpi_id,
              value: updated[0].value.toString(),
              period: `${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} ${year}`,
              date: updated[0].created_at,
              compliancePercentage: validatedData.compliancePercentage,
              status: validatedData.status,
              comments: validatedData.comments,
              updatedBy: user.id
            };
          } else {
            // Crear nuevo registro
            const inserted = await sql`
              INSERT INTO kpi_values_orsega (kpi_id, month, year, value, created_at)
              VALUES (${validatedData.kpiId}, ${finalMonth}, ${year}, ${numericValue}, NOW())
              RETURNING *
            `;
            kpiValue = {
              id: inserted[0].id,
              kpiId: inserted[0].kpi_id,
              value: inserted[0].value.toString(),
              period: `${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} ${year}`,
              date: inserted[0].created_at,
              compliancePercentage: validatedData.compliancePercentage,
              status: validatedData.status,
              comments: validatedData.comments,
              updatedBy: user.id
            };
          }
        }
        
        console.log(`[POST /api/kpi-values] Valor guardado en ${kpiSource}:`, kpiValue);
      } else {
        // KPI de tabla nueva (kpis) - usar lógica existente
        // Agregar el ID del usuario que está creando el valor KPI
        const kpiValueWithUser = {
          ...validatedData,
          updatedBy: user.id
        };
        
        // Upsert por periodo: si ya existe un registro del mismo kpiId y period, actualizar en lugar de duplicar
        if (kpiValueWithUser.period) {
          try {
            const existingForKpi = await storage.getKpiValuesByKpi(kpiValueWithUser.kpiId);
            const existingSamePeriod = existingForKpi.find((v: any) => v.period === kpiValueWithUser.period);
            if (existingSamePeriod) {
              // Actualizar el registro existente conservando su id y fecha
              const { id } = existingSamePeriod;
              // Si DatabaseStorage está en uso, hacemos update directo vía drizzle; si es MemStorage, hacemos reemplazo manual
              if (typeof db !== 'undefined') {
                const [updated] = await db
                  .update(kpiValues)
                  .set({
                    value: kpiValueWithUser.value,
                    period: kpiValueWithUser.period,
                    compliancePercentage: kpiValueWithUser.compliancePercentage ?? null,
                    status: kpiValueWithUser.status ?? null,
                    comments: kpiValueWithUser.comments ?? null,
                    updatedBy: kpiValueWithUser.updatedBy ?? null,
                    date: new Date()
                  })
                  .where(eq(kpiValues.id, id))
                  .returning();
                kpiValue = updated;
              } else {
                // Fallback para MemStorage (no BD): eliminar/crear mantiene comportamiento de upsert simple
                await storage.createKpiValue({ ...kpiValueWithUser });
                kpiValue = { ...existingSamePeriod, ...kpiValueWithUser };
              }
            } else {
              kpiValue = await storage.createKpiValue(kpiValueWithUser);
            }
          } catch (e) {
            // Si algo falla en la detección, crear nuevo para no bloquear la operación
            kpiValue = await storage.createKpiValue(kpiValueWithUser);
          }
        } else {
          kpiValue = await storage.createKpiValue(kpiValueWithUser);
        }
        
        // Crear notificación automática si hay cambio de estado crítico (solo para KPIs nuevos)
        if (previousStatus && validatedData.status && previousStatus !== validatedData.status) {
          await createKPIStatusChangeNotification(kpi, user, previousStatus, validatedData.status, storage);
        }
      }
      
      res.status(201).json(kpiValue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error('Error creating KPI value:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Weekly Sales Update Endpoint
  app.post("/api/sales/weekly-update", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/weekly-update] SIMPLIFICADO - Recibida solicitud:`, req.body);
      
      const { value, companyId, weekNumber, month, year, adminOverride } = req.body;
      const user = getAuthUser(req as AuthRequest);
      
      // Validar que se proporcionen los datos mínimos necesarios
      if (!value || !companyId) {
        return res.status(400).json({ 
          message: "Datos insuficientes. Se requiere value y companyId" 
        });
      }
      
      // Preparar datos para la actualización (con soporte para modo administrador)
      const salesData: any = {
        value: parseFloat(value),
        companyId: parseInt(companyId || '1'), // Default a Dura International
        userId: user.id // Usuario autenticado
      };
      
      // Si es administrador y tiene adminOverride, agregar parámetros manuales
      if (user.role === 'admin' && adminOverride && weekNumber && month && year) {
        salesData.adminOverride = true;
        salesData.weekNumber = weekNumber;
        salesData.month = month;
        salesData.year = parseInt(year);
        console.log(`[POST /api/sales/weekly-update] ADMIN OVERRIDE - Período manual: ${weekNumber} - ${month} ${year}`);
      } else {
        console.log(`[POST /api/sales/weekly-update] Modo normal - detección automática`);
      }
      
      // PROTECCIÓN: Verificar si el mes ya está cerrado antes de permitir actualizaciones
      let targetMonth: string, targetYear: number;
      
      if (salesData.adminOverride && salesData.month && salesData.year) {
        // Usar período manual del administrador
        targetMonth = salesData.month;
        targetYear = salesData.year;
      } else {
        // Usar período automático actual
        const today = new Date();
        const monthNames = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        targetMonth = monthNames[today.getMonth()];
        targetYear = today.getFullYear();
      }
      
      // Verificar si el mes está cerrado (solo para usuarios no-admin o admin sin override explícito)
      const shouldCheckClosure = !(user.role === 'admin' && salesData.adminOverride);
      
      if (shouldCheckClosure) {
        const allKpis = await storage.getKpis();
        const volumeKpi = allKpis.find(kpi => 
          kpi.name.includes("Volumen de ventas") && 
          kpi.companyId === salesData.companyId
        );
        
        if (volumeKpi) {
          const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id);
          const monthlyRecord = kpiValues.find(value => 
            value.period === `${targetMonth} ${targetYear}` && !value.period.includes('Semana')
          );
          
          if (monthlyRecord) {
            console.log(`[POST /api/sales/weekly-update] ❌ ACCESO DENEGADO - Mes ${targetMonth} ${targetYear} ya está cerrado`);
            return res.status(409).json({
              success: false,
              message: `El mes ${targetMonth} ${targetYear} ya está cerrado y no se pueden hacer más actualizaciones.`,
              monthStatus: {
                closed: true,
                period: `${targetMonth} ${targetYear}`,
                closedValue: monthlyRecord.value,
                closedDate: monthlyRecord.date
              },
              suggestion: "Contacta a un administrador si necesitas actualizar este período."
            });
          }
        }
      } else {
        console.log(`[POST /api/sales/weekly-update] 🔓 ADMIN OVERRIDE - Permitiendo actualización en período ${targetMonth} ${targetYear}`);
      }
      
      // Llamar a la función de actualización semanal
      const result = await updateWeeklySales(salesData);
      
      if (result.success) {
        console.log(`[POST /api/sales/weekly-update] ✅ Actualización exitosa:`, {
          period: result.currentPeriod?.period,
          monthlyPreview: result.monthlyPreview?.formattedValue
        });
        
        res.status(200).json({
          success: true,
          message: result.message || "Ventas actualizadas exitosamente",
          weeklyRecord: result.weeklyRecord,
          currentPeriod: result.currentPeriod,
          monthlyPreview: result.monthlyPreview
        });
      } else {
        console.error(`[POST /api/sales/weekly-update] ❌ Error:`, result.message);
        res.status(400).json({
          success: false,
          message: result.message || "Error al actualizar datos de ventas"
        });
      }
    } catch (error: any) {
      console.error('[POST /api/sales/weekly-update] ❌ Error crítico:', error);
      res.status(500).json({ 
        success: false,
        message: "Error interno del servidor" 
      });
    }
  });

  // SIMPLIFIED: Monthly Sales Update Endpoint - Direct monthly updates
  app.post("/api/sales/update-month", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/update-month] Recibida solicitud:`, req.body);
      
      const { value, companyId, month, year, period } = req.body;
      const user = getAuthUser(req as AuthRequest);
      
      // Validaciones básicas
      if (!value || !companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos requeridos: valor, compañía, mes y año"
        });
      }

      // Determinar el KPI ID según la compañía
      const kpiId = companyId === 1 ? 39 : 10; // 39=Dura Volumen de ventas, 10=Orsega Volumen de ventas
      
      // Construir el período en formato "Mes Año"
      const periodString = period || `${month} ${year}`;
      
      console.log(`[POST /api/sales/update-month] Actualizando KPI ${kpiId} para período: ${periodString}`);

      // Buscar si ya existe un registro para este período
      const existingRecords = await storage.getKpiValuesByKpi(kpiId);
      const existingRecord = existingRecords.find((r: any) => r.period === periodString);

      if (existingRecord) {
        // Eliminar el registro existente
        await db.delete(kpiValues).where(eq(kpiValues.id, existingRecord.id));
        console.log(`[POST /api/sales/update-month] Registro anterior eliminado: ${periodString}`);
      }

      // Crear el nuevo registro (siempre)
      await storage.createKpiValue({
        kpiId: kpiId,
        value: value.toString(),
        period: periodString,
        userId: user.id
      });
      
      console.log(`[POST /api/sales/update-month] ✅ Registro creado: ${periodString} = ${value}`);


      // Calcular meta mensual
      const monthlyTarget = companyId === 1 ? 55620 : 858373;
      const compliance = Math.round((value / monthlyTarget) * 100);

      res.status(200).json({
        success: true,
        message: `Ventas de ${periodString} actualizadas correctamente`,
        data: {
          period: periodString,
          value: value,
          monthlyTarget: monthlyTarget,
          compliance: compliance
        }
      });

    } catch (error: any) {
      console.error('[POST /api/sales/update-month] ❌ Error:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Error al actualizar ventas mensuales"
      });
    }
  });

  // Manual monthly close endpoint (admin-only) - replaces automatic scheduler
  app.post("/api/sales/auto-close-month", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/auto-close-month] Iniciando auto-cierre mensual:`, req.body);
      
      const { companyId, month, year } = req.body;
      const user = getAuthUser(req as AuthRequest);
      
      // Validar que sea un usuario administrador
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden ejecutar el auto-cierre mensual"
        });
      }
      
      // Si no se especifica companyId, cerrar para ambas empresas
      const companiesToClose = companyId ? [parseInt(companyId)] : [1, 2]; // 1=Dura, 2=Orsega
      
      console.log(`[POST /api/sales/auto-close-month] Procesando empresas:`, companiesToClose);
      
      const results = [];
      for (const compId of companiesToClose) {
        try {
          console.log(`[POST /api/sales/auto-close-month] Procesando empresa ${compId}...`);
          const result = await autoCloseMonth(compId, month, year);
          results.push({
            companyId: compId,
            success: result,
            message: result ? 'Mes cerrado exitosamente' : 'No hay datos para cerrar o ya está cerrado'
          });
        } catch (error: any) {
          console.error(`[POST /api/sales/auto-close-month] Error para empresa ${compId}:`, error);
          results.push({
            companyId: compId,
            success: false,
            message: error.message || 'Error al cerrar mes'
          });
        }
      }
      
      const allSuccessful = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`[POST /api/sales/auto-close-month] ✅ Completado - ${successCount}/${results.length} empresas procesadas`);
      
      res.status(200).json({
        success: allSuccessful,
        message: `Auto-cierre completado: ${successCount}/${results.length} empresas procesadas`,
        results: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('[POST /api/sales/auto-close-month] ❌ Error crítico:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante el auto-cierre"
      });
    }
  });

  // NEW: Manual Monthly Close Endpoint (improved version for manual operations)
  app.post("/api/sales/monthly-close", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/monthly-close] CIERRE MANUAL iniciado:`, req.body);
      
      const { companyId, month, year, override = false } = req.body;
      const user = getAuthUser(req as AuthRequest);
      
      // Validar que sea un usuario administrador
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden cerrar meses manualmente"
        });
      }
      
      // Validar parámetros requeridos
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Parámetros requeridos: companyId, month, year"
        });
      }
      
      // Verificar si el mes ya está cerrado (evitar duplicados)
      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage.getKpis();
      const volumeKpi = allKpis.find(kpi => 
        kpi.name.includes("Volumen de ventas") && 
        kpi.companyId === parseInt(companyId)
      );
      
      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontró KPI de volumen de ventas para la compañía ${companyId}`
        });
      }
      
      // Verificar si ya existe un registro mensual
      const existingKpiValues = await storage.getKpiValuesByKpi(volumeKpi.id);
      const existingMonthlyRecord = existingKpiValues.find(value => 
        value.period === targetPeriod && !value.period.includes('Semana')
      );
      
      if (existingMonthlyRecord && !override) {
        return res.status(409).json({
          success: false,
          message: `El mes ${month} ${year} ya está cerrado. Usa override=true para volver a cerrar.`,
          existingRecord: {
            id: existingMonthlyRecord.id,
            value: existingMonthlyRecord.value,
            date: existingMonthlyRecord.date,
            period: existingMonthlyRecord.period
          }
        });
      }
      
      console.log(`[POST /api/sales/monthly-close] Ejecutando cierre para empresa ${companyId}, período: ${targetPeriod}`);
      
      // Ejecutar cierre manual
      const result = await autoCloseMonth(parseInt(companyId), month, parseInt(year));
      
      if (result) {
        console.log(`[POST /api/sales/monthly-close] ✅ Cierre manual exitoso para compañía ${companyId}`);
        
        const actionText = existingMonthlyRecord && override ? 'actualizado' : 'cerrado';
        res.status(200).json({
          success: true,
          message: `Mes ${month} ${year} ${actionText} exitosamente`,
          companyId: parseInt(companyId),
          period: targetPeriod,
          wasOverride: !!(existingMonthlyRecord && override),
          closedBy: user.name || user.id
        });
      } else {
        console.error(`[POST /api/sales/monthly-close] ❌ Error en cierre manual para compañía ${companyId}`);
        res.status(500).json({
          success: false,
          message: `Error al cerrar el mes ${month} ${year} - posiblemente no hay datos semanales suficientes`
        });
      }
      
    } catch (error: any) {
      console.error('[POST /api/sales/monthly-close] ❌ Error crítico:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante cierre manual",
        error: error.message
      });
    }
  });

  // Check if a month is already closed (utility endpoint)
  app.get("/api/sales/monthly-status", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, month, year } = req.query;
      
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Parámetros requeridos: companyId, month, year"
        });
      }
      
      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage.getKpis();
      const volumeKpi = allKpis.find(kpi => 
        kpi.name.includes("Volumen de ventas") && 
        kpi.companyId === parseInt(companyId as string)
      );
      
      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontró KPI de volumen de ventas para la compañía ${companyId}`
        });
      }
      
      // Buscar registro mensual y semanal
      const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id);
      const monthlyRecord = kpiValues.find(value => 
        value.period === targetPeriod && !value.period.includes('Semana')
      );
      
      const weeklyRecords = kpiValues.filter(value => 
        value.period.includes(month as string) && 
        value.period.includes(year as string) &&
        value.period.includes("Semana")
      );
      
      res.status(200).json({
        success: true,
        closed: !!monthlyRecord,
        period: targetPeriod,
        monthlyRecord: monthlyRecord || null,
        weeklyRecordsCount: weeklyRecords.length,
        weeklyRecords: weeklyRecords.map(w => ({
          period: w.period,
          value: w.value,
          date: w.date
        }))
      });
      
    } catch (error: any) {
      console.error('[GET /api/sales/monthly-status] Error:', error);
      res.status(500).json({
        success: false,
        message: "Error al consultar estado del mes"
      });
    }
  });

  // Shipment routes with pagination and temporal filters
  app.get("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      const { 
        companyId, 
        status, 
        limit = '50', // Default 50 envíos por página
        page = '1',
        since // Filtro temporal: 'YYYY-MM-DD' o días como '30d'
      } = req.query;

      // Parse parameters
      const limitNum = parseInt(limit as string);
      const pageNum = parseInt(page as string);
      const offset = (pageNum - 1) * limitNum;

      // Calculate temporal filter
      let sinceDate: Date | undefined;
      if (since) {
        const sinceStr = since as string;
        if (sinceStr.endsWith('d')) {
          // Format like '30d' = 30 days ago
          const days = parseInt(sinceStr.replace('d', ''));
          sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - days);
        } else {
          // Format like '2025-01-15'
          sinceDate = new Date(sinceStr);
        }
      }

      let shipments: any[];
      
      if (companyId) {
        const companyIdNum = parseInt(companyId as string);
        shipments = await storage.getShipmentsByCompany(companyIdNum);
      } else {
        shipments = await storage.getShipments();
      }

      // Apply status filter
      if (status) {
        shipments = shipments.filter(s => s.status === status);
      }

      // Apply temporal filter
      if (sinceDate) {
        shipments = shipments.filter(s => {
          const shipmentDate = new Date(s.actualDeliveryDate || s.updatedAt || s.createdAt);
          return shipmentDate >= sinceDate!;
        });
      }

      // Sort by date (newest first) - CRITICAL for monthly grouping
      shipments.sort((a, b) => {
        const dateA = new Date(a.actualDeliveryDate || a.updatedAt || a.createdAt);
        const dateB = new Date(b.actualDeliveryDate || b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      // Apply pagination
      const total = shipments.length;
      const paginatedShipments = shipments.slice(offset, offset + limitNum);

      // Response with pagination metadata
      res.json({
        shipments: paginatedShipments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: offset + limitNum < total
        }
      });

    } catch (error) {
      console.error('[GET /api/shipments] Error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint para obtener productos únicos de envíos anteriores
  app.get("/api/shipments/products", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { companyId } = req.query;
      
      console.log("[GET /api/shipments/products] Usuario:", user.name, "Empresa filtro:", companyId);
      
      let whereConditions = ["product IS NOT NULL AND product != ''"];
      let queryParams: any[] = [];
      let paramCount = 0;
      
      // ✅ ACCESO UNIVERSAL: Todos los usuarios ven todos los productos
      // Sin restricciones por empresa o rol
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      const query = `
        SELECT DISTINCT product 
        FROM shipments 
        ${whereClause}
        ORDER BY product ASC
      `;
      
      const result = await sql(query, queryParams);
      const products = result.map((row: any) => row.product);
      
      console.log(`[GET /api/shipments/products] Encontrados ${products.length} productos únicos`);
      res.json(products);
    } catch (error) {
      console.error("[GET /api/shipments/products] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/shipments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const shipment = await storage.getShipment(id);
      
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      
      // Obtener items del embarque
      const items = await storage.getShipmentItems(id);
      
      res.json({ ...shipment, items });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/shipments/tracking/:trackingCode", jwtAuthMiddleware, async (req, res) => {
    try {
      const trackingCode = req.params.trackingCode;
      const shipment = await storage.getShipmentByTrackingCode(trackingCode);
      
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[POST /api/shipments] Datos recibidos:", JSON.stringify(req.body, null, 2));
      
      // Extraer items del body
      const { items, ...shipmentData } = req.body;
      
      // Transformar fechas de string a Date antes de validar
      const transformedData = {
        ...shipmentData,
        estimatedDeliveryDate: shipmentData.estimatedDeliveryDate ? new Date(shipmentData.estimatedDeliveryDate) : null,
        departureDate: shipmentData.departureDate ? new Date(shipmentData.departureDate) : null,
        actualDeliveryDate: shipmentData.actualDeliveryDate ? new Date(shipmentData.actualDeliveryDate) : null
      };
      
      console.log("[POST /api/shipments] Datos transformados:", JSON.stringify(transformedData, null, 2));
      
      // Validar datos con Zod
      const validatedData = insertShipmentSchema.parse(transformedData);
      console.log("[POST /api/shipments] Datos validados:", JSON.stringify(validatedData, null, 2));
      
      // Crear el envío
      const shipment = await storage.createShipment(validatedData);
      console.log("[POST /api/shipments] Envío creado:", shipment);
      
      // Crear items si existen
      if (items && Array.isArray(items) && items.length > 0) {
        const itemsToCreate = items.map((item: any) => ({
          shipmentId: shipment.id,
          product: item.product,
          quantity: item.quantity,
          unit: item.unit,
          description: item.description || null
        }));
        
        await storage.createShipmentItems(itemsToCreate);
        console.log("[POST /api/shipments] Items creados:", itemsToCreate.length);
      }
      
      // Obtener shipment con items
      const shipmentItems = await storage.getShipmentItems(shipment.id);
      
      res.status(201).json({ ...shipment, items: shipmentItems });
    } catch (error) {
      console.error("[POST /api/shipments] Error completo:", error);
      console.error("[POST /api/shipments] Stack trace:", (error as Error)?.stack);
      
      if (error instanceof z.ZodError) {
        console.error("[POST /api/shipments] ❌ Errores de validación:");
        error.errors.forEach((err) => {
          console.error(`  - Campo: ${err.path.join('.')}, Error: ${err.message}`);
        });
        return res.status(400).json({ 
          error: "Validation error",
          message: "Los datos enviados no son válidos",
          errors: error.errors,
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      
      // Si es un error de base de datos, dar más detalles
      if ((error as any)?.code) {
        console.error("[POST /api/shipments] ❌ Error de base de datos:", (error as any).code, (error as any).detail);
      }
      
      res.status(500).json({ 
        error: "Internal server error",
        message: (error as Error).message || "Error al crear el embarque. Por favor, verifica los datos e intenta nuevamente."
      });
    }
  });

  // Editar datos generales del envío
  app.patch("/api/shipments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getShipment(id);
      if (!existing) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      const data = req.body || {};
      // Normalizar fechas si vienen como string
      const patch: any = { ...data };
      if (typeof patch.estimatedDeliveryDate === 'string') {
        patch.estimatedDeliveryDate = patch.estimatedDeliveryDate ? new Date(patch.estimatedDeliveryDate) : null;
      }
      if (typeof patch.departureDate === 'string') {
        patch.departureDate = patch.departureDate ? new Date(patch.departureDate) : null;
      }
      if (typeof patch.actualDeliveryDate === 'string') {
        patch.actualDeliveryDate = patch.actualDeliveryDate ? new Date(patch.actualDeliveryDate) : null;
      }
      const updated = await storage.updateShipment(id, patch);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update shipment" });
      }
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/shipments/:id] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shipment Items routes
  app.get("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const items = await storage.getShipmentItems(shipmentId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add shipment item
  app.post("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const existing = await storage.getShipment(shipmentId);
      if (!existing) return res.status(404).json({ message: "Shipment not found" });
      const { product, quantity, unit, description } = req.body || {};
      if (!product || !quantity || !unit) {
        return res.status(400).json({ message: "product, quantity y unit son requeridos" });
      }
      const created = await storage.createShipmentItem({
        shipmentId,
        product,
        quantity,
        unit,
        description: description || null
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/shipments/:id/items] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete shipment item
  app.delete("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const existing = await storage.getShipment(shipmentId);
      if (!existing) return res.status(404).json({ message: "Shipment not found" });
      const ok = await storage.deleteShipmentItem(itemId);
      if (!ok) return res.status(404).json({ message: "Item not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/shipments/:id/items", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const shipmentId = parseInt(req.params.id);
      
      console.log(`[POST /api/shipments/${shipmentId}/items] Agregando item por ${user.name}:`, req.body);
      
      // Validar datos requeridos
      if (!req.body.product || !req.body.quantity || !req.body.unit) {
        return res.status(400).json({ 
          message: "Product, quantity, and unit are required",
          error: "Missing required fields"
        });
      }
      
      const itemData = {
        shipmentId,
        product: req.body.product,
        quantity: req.body.quantity,
        unit: req.body.unit,
        description: req.body.description || null
      };
      
      const item = await storage.createShipmentItem(itemData);
      
      if (!item) {
        return res.status(500).json({ message: "Error creating item" });
      }
      
      console.log(`[POST /api/shipments/${shipmentId}/items] Item creado exitosamente:`, item.id);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("[POST /api/shipments/:id/items] Error:", error);
      res.status(500).json({ 
        message: error?.message || "Internal server error",
        error: String(error)
      });
    }
  });

  app.patch("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const itemId = parseInt(req.params.itemId);
      
      console.log(`[PATCH /api/shipments/:id/items/${itemId}] Actualizando item por ${user.name}:`, req.body);
      
      // Validar que el item pertenezca al envío
      const shipmentId = parseInt(req.params.id);
      const existingItems = await storage.getShipmentItems(shipmentId);
      const item = existingItems.find((it: any) => it.id === itemId);
      
      if (!item) {
        console.error(`[PATCH /api/shipments/:id/items/${itemId}] Item no encontrado en envío ${shipmentId}`);
        return res.status(404).json({ message: "Item not found in this shipment" });
      }
      
      const updatedItem = await storage.updateShipmentItem(itemId, req.body);
      
      if (!updatedItem) {
        console.error(`[PATCH /api/shipments/:id/items/${itemId}] Error al actualizar item`);
        return res.status(500).json({ message: "Error updating item" });
      }
      
      console.log(`[PATCH /api/shipments/:id/items/${itemId}] Item actualizado exitosamente`);
      res.json(updatedItem);
    } catch (error: any) {
      console.error("[PATCH /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({ 
        message: error?.message || "Internal server error",
        error: String(error)
      });
    }
  });

  app.delete("/api/shipments/:id/items/:itemId", jwtAuthMiddleware, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const success = await storage.deleteShipmentItem(itemId);
      
      if (!success) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/shipments/:id/items/:itemId] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/shipments/:id/updates", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const updates = await storage.getShipmentUpdates(shipmentId);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Action Plan routes
  app.get("/api/action-plans", jwtAuthMiddleware, async (req, res) => {
    try {
      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId as string);
        const actionPlans = await storage.getActionPlansByKpi(kpiId);
        res.json(actionPlans);
      } else {
        // For now, return empty array for general action plans
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/action-plans/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const actionPlan = await storage.getActionPlan(id);
      
      if (!actionPlan) {
        return res.status(404).json({ message: "Action plan not found" });
      }
      
      res.json(actionPlan);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const notifications = await storage.getNotificationsForUser(user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const notificationData = {
        ...req.body,
        fromUserId: user.id
      };
      
      console.log("[POST /api/notifications] Creando notificación:", notificationData);
      
      // Crear notificación en la base de datos
      const notification = await storage.createNotification(notificationData);
      
      // Obtener información del destinatario para enviar el correo
      const recipient = await storage.getUser(notificationData.toUserId);
      
      if (recipient && recipient.email) {
        console.log("[POST /api/notifications] Enviando correo a:", recipient.email);
        
        // Crear template del correo
        const { html, text } = createTeamMessageTemplate(
          user.name,
          recipient.name,
          notificationData.title,
          notificationData.message,
          notificationData.type || 'info',
          notificationData.priority || 'normal'
        );
        
        // Enviar correo electrónico usando el correo de Mario Reynoso
        const emailSent = await sendEmail({
          to: recipient.email,
          from: 'Mario Reynoso <marioreynoso@grupoorsega.com>', // Correo verificado de Mario Reynoso con nombre
          subject: `[Econova] ${notificationData.title}`,
          html,
          text
        });
        
        if (emailSent) {
          console.log("[POST /api/notifications] Correo enviado exitosamente");
        } else {
          console.error("[POST /api/notifications] Error al enviar correo");
        }
      } else {
        console.warn("[POST /api/notifications] Destinatario no encontrado o sin email");
      }
      
      res.status(201).json(notification);
    } catch (error) {
      console.error("[POST /api/notifications] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/:id/read", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getAuthUser(req as AuthRequest);
      
      const notification = await storage.markNotificationAsRead(id, user.id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getAuthUser(req as AuthRequest);
      
      const success = await storage.deleteNotification(id, user.id);
      
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Team Activity routes
  app.get("/api/team-activity", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[GET /api/team-activity] Obteniendo resumen de actividad del equipo");
      const activitySummary = await storage.getTeamActivitySummary();
      console.log("[GET /api/team-activity] Resumen obtenido:", activitySummary);
      res.json(activitySummary);
    } catch (error) {
      console.error("Error getting team activity:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/last-kpi-update", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const lastUpdate = await storage.getLastKpiUpdateByUser(userId);
      res.json(lastUpdate);
    } catch (error) {
      console.error("Error getting last KPI update:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shipment Status Update with Notifications
  app.patch("/api/shipments/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const user = getAuthUser(req as AuthRequest);
      const validatedData = updateShipmentStatusSchema.parse(req.body);
      
      console.log("[PATCH /api/shipments/:id/status] Actualizando estado del envío:", { shipmentId, data: validatedData });
      
      // Obtener el envío actual
      const shipment = await storage.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: "Envío no encontrado" });
      }
      
      // VALIDACIÓN: Si el nuevo estado es in_transit, debe tener número de factura
      if (validatedData.status === 'in_transit') {
        const hasInvoiceNumber = validatedData.invoiceNumber || shipment.invoiceNumber;
        if (!hasInvoiceNumber) {
          return res.status(400).json({ 
            message: "Número de factura requerido",
            error: "Para mover un envío a 'En Tránsito' es necesario proporcionar el número de factura.",
            requiresInvoiceNumber: true
          });
        }
      }
      
      // Verificar si el estado realmente cambió (idempotencia)
      const statusChanged = shipment.status !== validatedData.status;
      
      // Actualizar el envío con el nuevo estado y número de factura (si se proporciona)
      const updateData: any = {
        status: validatedData.status,
        updatedAt: new Date()
      };
      
      // Agregar invoiceNumber si se proporciona
      if (validatedData.invoiceNumber) {
        updateData.invoiceNumber = validatedData.invoiceNumber;
      }
      
      const updatedShipment = await storage.updateShipment(shipmentId, updateData);
      
      if (!updatedShipment) {
        return res.status(404).json({ message: "Error al actualizar el envío" });
      }
      
      // Crear registro de actualización en el historial
      const shipmentUpdate = await storage.createShipmentUpdate({
        shipmentId: shipmentId,
        status: validatedData.status,
        location: validatedData.location || null,
        comments: validatedData.comments || null,
        updatedBy: user.id
      });
      
      // Recalculate cycle times automatically after status update
      try {
        await storage.recalculateShipmentCycleTime(shipmentId);
        console.log(`[Cycle Times] Recalculated for shipment ${shipmentId}`);
      } catch (cycleTimeError) {
        console.error(`[Cycle Times] Error recalculating for shipment ${shipmentId}:`, cycleTimeError);
        // Don't fail the status update for a cycle time calculation error
      }
      
      // Sistema de notificaciones automáticas por email
      let emailNotificationSent = false;
      let emailWarning: string | null = null;
      
      if (statusChanged && validatedData.sendNotification !== false) {
        try {
          // Determinar destinatario y preferencias
          let recipientEmail: string | null = null;
          let emailNotificationsEnabled = true;
          let clientId: number | null = null;
          
          // Prioridad 1: customerId (relación con tabla clients)
          if (updatedShipment.customerId) {
            const clientQuery = await sql(
              `SELECT id, email, email_notifications FROM clients WHERE id = $1 LIMIT 1`,
              [updatedShipment.customerId]
            );
            
            if (clientQuery.length > 0) {
              const client = clientQuery[0];
              recipientEmail = client.email;
              emailNotificationsEnabled = client.email_notifications !== false;
              clientId = client.id;
              console.log(`[Notification] Cliente encontrado: ${recipientEmail}, notificaciones: ${emailNotificationsEnabled}`);
            }
          }
          
          // Prioridad 2: customerEmail (legacy/fallback)
          if (!recipientEmail && updatedShipment.customerEmail) {
            recipientEmail = updatedShipment.customerEmail;
            emailNotificationsEnabled = true; // Por defecto activado para legacy
            console.log(`[Notification] Usando customerEmail legacy: ${recipientEmail}`);
          }
          
          // Verificar idempotencia: ¿Ya se envió notificación para este estado?
          if (recipientEmail && emailNotificationsEnabled) {
            const existingNotificationQuery = await sql(
              `SELECT id FROM shipment_notifications 
               WHERE shipment_id = $1 AND shipment_status = $2 AND status = 'sent' LIMIT 1`,
              [shipmentId, validatedData.status]
            );
            
            if (existingNotificationQuery.length > 0) {
              console.log(`[Notification] Ya existe notificación enviada para estado ${validatedData.status}, omitiendo duplicado`);
              emailWarning = 'Notificación ya enviada previamente para este estado';
            } else {
              // Enviar notificación usando la nueva función
              const { sendShipmentStatusNotification } = await import('./email-logistics.js');
              
              const emailResult = await sendShipmentStatusNotification({
                to: recipientEmail,
                shipment: updatedShipment,
                status: validatedData.status
              });
              
              // Registrar notificación en historial
              await storage.createShipmentNotification({
                shipmentId: shipmentId,
                emailTo: recipientEmail,
                subject: `Actualización de Envío - ${validatedData.status}`,
                status: 'sent',
                sentBy: user.id,
                shipmentStatus: validatedData.status,
                errorMessage: null
              });
              
              emailNotificationSent = true;
              console.log(`[Notification] Email enviado exitosamente a ${recipientEmail} (${emailResult.provider})`);
            }
          } else if (!recipientEmail) {
            emailWarning = 'No hay email de cliente configurado';
            console.log(`[Notification] Sin email de cliente para enviar notificación`);
          } else if (!emailNotificationsEnabled) {
            emailWarning = 'Cliente tiene notificaciones deshabilitadas';
            console.log(`[Notification] Cliente ${recipientEmail} tiene notificaciones deshabilitadas`);
          }
        } catch (emailError) {
          console.error("[Notification] Error al enviar notificación:", emailError);
          emailWarning = emailError instanceof Error ? emailError.message : 'Error desconocido';
          
          // Registrar fallo en historial
          if (updatedShipment.customerEmail) {
            try {
              await storage.createShipmentNotification({
                shipmentId: shipmentId,
                emailTo: updatedShipment.customerEmail,
                subject: `Actualización de Envío - ${validatedData.status}`,
                status: 'failed',
                sentBy: user.id,
                shipmentStatus: validatedData.status,
                errorMessage: emailWarning
              });
            } catch (logError) {
              console.error("[Notification] Error al registrar fallo:", logError);
            }
          }
        }
      }
      
      res.json({
        shipment: updatedShipment,
        update: shipmentUpdate,
        emailNotificationSent,
        emailWarning
      });
    } catch (error) {
      console.error("[PUT /api/shipments/:id/status] Error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Get shipment notification history
  app.get("/api/shipments/:id/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const notifications = await storage.getShipmentNotificationsByShipment(shipmentId);
      res.json(notifications);
    } catch (error) {
      console.error("[GET /api/shipments/:id/notifications] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Cycle Times API routes
  app.get("/api/shipments/:id/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      
      // Recalculate cycle times for this shipment to ensure freshness
      const cycleTime = await storage.recalculateShipmentCycleTime(shipmentId);
      
      if (!cycleTime) {
        return res.status(404).json({ message: "Envío no encontrado" });
      }
      
      res.json(cycleTime);
    } catch (error) {
      console.error("[GET /api/shipments/:id/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  
  app.get("/api/metrics/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      const metrics = await storage.getAggregateCycleTimes(companyId, startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("[GET /api/metrics/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Job Profile routes
  app.get("/api/job-profiles/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = await storage.getJobProfileWithDetails(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Perfil de trabajo no encontrado" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("[GET /api/job-profiles/:userId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/user-kpis/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userKpis = await storage.getUserKpis(userId);
      res.json(userKpis);
    } catch (error) {
      console.error("[GET /api/user-kpis/:userId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // KPI Overview - Vista consolidada para ejecutivos
  app.get("/api/kpi-overview", jwtAuthMiddleware, async (req, res) => {
    try {
      const kpiOverview = await storage.getKPIOverview();
      res.json(kpiOverview);
    } catch (error) {
      console.error("[GET /api/kpi-overview] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // KPI History - Historial mensual de un KPI específico
  app.get("/api/kpi-history/:kpiId", jwtAuthMiddleware, async (req, res) => {
    try {
      const kpiId = parseInt(req.params.kpiId);
      const months = parseInt(req.query.months as string) || 12;
      const kpiHistory = await storage.getKPIHistory(kpiId, months);
      res.json(kpiHistory);
    } catch (error) {
      console.error("[GET /api/kpi-history/:kpiId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // User KPI History - Historial de todos los KPIs de un usuario  
  app.get("/api/user-kpi-history/:userId", async (req, res) => {
    try {
      const requestedUserId = parseInt(req.params.userId);
      const months = parseInt(req.query.months as string) || 6;

      console.log(`[GET /api/user-kpi-history/:userId] Requested userId: ${requestedUserId}, months: ${months}`);

      const userHistory = await storage.getUserKPIHistory(requestedUserId, months);
      console.log(`[GET /api/user-kpi-history/:userId] Returning ${userHistory?.length || 0} records for user ${requestedUserId}`);
      res.json(userHistory);
    } catch (error) {
      console.error("[GET /api/user-kpi-history/:userId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // KPI History by Users - Historial de un KPI con todos los usuarios
  app.get("/api/kpi-history-by-users/:kpiId", jwtAuthMiddleware, async (req, res) => {
    try {
      const kpiId = parseInt(req.params.kpiId);
      const months = parseInt(req.query.months as string) || 6;

      const kpiHistory = await storage.getKPIHistoryByUsers(kpiId, months);
      
      if (!kpiHistory) {
        return res.status(404).json({ message: "KPI no encontrado" });
      }

      res.json(kpiHistory);
    } catch (error) {
      console.error("[GET /api/kpi-history-by-users/:kpiId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Endpoint para verificar duplicados (solo lectura)
  app.get("/api/check-kpi-duplicates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "No autorizado" });
      }

      const sql = neon(process.env.DATABASE_URL!);

      // Verificar duplicados (company-level: userId IS NULL)
      const companyDuplicates = await sql`
        SELECT kpi_id, period, COUNT(*) as count, ARRAY_AGG(id ORDER BY id DESC) as ids
        FROM kpi_values
        WHERE user_id IS NULL
        GROUP BY kpi_id, period
        HAVING COUNT(*) > 1
      `;

      console.log("[CHECK KPI DUPLICATES] Found:", companyDuplicates);
      res.json({
        duplicatesFound: companyDuplicates,
        totalDuplicateGroups: companyDuplicates.length
      });
    } catch (error) {
      console.error("[GET /api/check-kpi-duplicates] Error:", error);
      res.status(500).json({ message: "Error interno del servidor", error: String(error) });
    }
  });

  // Endpoint temporal para limpiar duplicados en kpi_values y crear índices únicos
  // ADMIN ONLY - Se ejecuta una sola vez para limpiar la base de datos
  app.post("/api/fix-kpi-duplicates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Solo administradores pueden ejecutar este endpoint
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "No autorizado" });
      }

      const sql = neon(process.env.DATABASE_URL!);
      const results: any = {
        duplicatesFound: [],
        duplicatesDeleted: 0,
        indexesCreated: [],
        errors: []
      };

      // 1. Identificar duplicados (company-level: userId IS NULL)
      const companyDuplicates = await sql`
        SELECT kpi_id, period, COUNT(*) as count, ARRAY_AGG(id ORDER BY id DESC) as ids
        FROM kpi_values
        WHERE user_id IS NULL
        GROUP BY kpi_id, period
        HAVING COUNT(*) > 1
      `;

      results.duplicatesFound = companyDuplicates;

      // 2. Eliminar duplicados manteniendo el registro con ID más alto (más reciente)
      for (const dup of companyDuplicates) {
        const idsToDelete = dup.ids.slice(1); // Mantener el primero (ID más alto), eliminar el resto
        if (idsToDelete.length > 0) {
          // Convertir array a formato PostgreSQL
          const idsArray = `{${idsToDelete.join(',')}}`;
          const deleted = await sql`
            DELETE FROM kpi_values
            WHERE id = ANY(${idsArray}::integer[])
          `;
          results.duplicatesDeleted += idsToDelete.length;
        }
      }

      // 3. Crear índices únicos (si no existen)
      try {
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS user_kpi_unique 
          ON kpi_values (kpi_id, user_id, period) 
          WHERE user_id IS NOT NULL
        `;
        results.indexesCreated.push('user_kpi_unique');
      } catch (error: any) {
        results.errors.push({ index: 'user_kpi_unique', error: error.message });
      }

      try {
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS company_kpi_unique 
          ON kpi_values (kpi_id, period) 
          WHERE user_id IS NULL
        `;
        results.indexesCreated.push('company_kpi_unique');
      } catch (error: any) {
        results.errors.push({ index: 'company_kpi_unique', error: error.message });
      }

      console.log("[FIX KPI DUPLICATES] Results:", results);
      res.json({
        success: true,
        message: "Duplicados eliminados e índices creados correctamente",
        details: results
      });
    } catch (error) {
      console.error("[POST /api/fix-kpi-duplicates] Error:", error);
      res.status(500).json({ message: "Error interno del servidor", error: String(error) });
    }
  });

  // Clients Database API - Nueva tabla de clientes
  const sql = neon(process.env.DATABASE_URL!);

  // GET /api/clients-db - Obtener todos los clientes
  app.get("/api/clients-db", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, search } = req.query;
      
      let whereClause = "WHERE is_active = true";
      const params: any[] = [];
      let paramIndex = 1;
      
      // ✅ ACCESO UNIVERSAL: Todos los usuarios ven todos los clientes
      // Sin restricciones por empresa
      
      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR client_code ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      const result = await sql(`
        SELECT 
          id, name, email, phone, contact_person, company, address,
          company_id as "companyId", client_code as "clientCode", city, state, postal_code, country,
          requires_receipt as "requiresReceipt", email_notifications as "emailNotifications", customer_type as "customerType",
          payment_terms as "paymentTerms", is_active as "isActive", created_at as "createdAt"
        FROM clients 
        ${whereClause}
        ORDER BY name
      `, params);
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching clients from database:', error);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  // GET /api/clients-db/:id - Obtener cliente específico
  app.get("/api/clients-db/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      
      const result = await sql(`
        SELECT 
          id, name, email, phone, contact_person, company, address,
          company_id as "companyId", client_code as "clientCode", city, state, postal_code, country,
          requires_receipt as "requiresReceipt", email_notifications as "emailNotifications", customer_type as "customerType",
          payment_terms as "paymentTerms", is_active as "isActive", notes, created_at as "createdAt", updated_at as "updatedAt"
        FROM clients 
        WHERE id = $1 AND is_active = true
      `, [clientId]);
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Failed to fetch client' });
    }
  });

  // GET /api/clients - Alias para LogisticsPage (retorna clientes activos)
  app.get("/api/clients", jwtAuthMiddleware, async (req, res) => {
    try {
      const result = await sql(`
        SELECT 
          id, name, email, phone, contact_person as contact_name,
          address as billing_addr, address as shipping_addr,
          client_code as rfc, is_active, company_id,
          email_notifications
        FROM clients 
        WHERE is_active = true
        ORDER BY name
      `);
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching clients for logistics:', error);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  // GET /api/products - Obtener productos activos
  app.get("/api/products", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId } = req.query;
      console.log(`🔵 [GET /api/products] companyId recibido:`, companyId);
      
      let whereClause = "WHERE is_active = true";
      const params: any[] = [];
      
      if (companyId) {
        const companyIdNum = parseInt(companyId as string);
        whereClause += " AND company_id = $1";
        params.push(companyIdNum);
        console.log(`🔵 [GET /api/products] Filtrando por company_id = ${companyIdNum}`);
      } else {
        console.log(`⚠️  [GET /api/products] No se recibió companyId, retornando todos los productos activos`);
      }
      
      const result = await sql(`
        SELECT id, name, company_id, is_active
        FROM products 
        ${whereClause}
        ORDER BY name
      `, params);
      
      console.log(`📊 [GET /api/products] Retornando ${result.length} productos`);
      res.json(result);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // POST /api/products - Crear nuevo producto
  app.post("/api/products", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { name, companyId } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del producto es requerido' });
      }

      // Verificar que no exista un producto con el mismo nombre para la misma compañía
      const existing = await sql(`
        SELECT id FROM products 
        WHERE LOWER(name) = LOWER($1) AND company_id = $2 AND is_active = true
      `, [name.trim(), companyId || null]);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Ya existe un producto con ese nombre' });
      }

      const result = await sql(`
        INSERT INTO products (name, company_id, is_active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        RETURNING id, name, company_id, is_active
      `, [name.trim(), companyId || null]);
      
      console.log(`✅ [POST /api/products] Producto creado por ${user.name}:`, result[0]);
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('[POST /api/products] Error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  // PUT /api/products/:id - Actualizar producto
  app.put("/api/products/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const id = parseInt(req.params.id);
      const { name, is_active, companyId } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del producto es requerido' });
      }

      // Verificar que no exista otro producto con el mismo nombre
      const existing = await sql(`
        SELECT id FROM products 
        WHERE LOWER(name) = LOWER($1) AND company_id = $2 AND id != $3 AND is_active = true
      `, [name.trim(), companyId || null, id]);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Ya existe otro producto con ese nombre' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name.trim());
      }
      
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (companyId !== undefined) {
        updates.push(`company_id = $${paramIndex++}`);
        values.push(companyId === '' || companyId === null ? null : companyId);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id); // El id va al final para el WHERE

      const result = await sql(`
        UPDATE products 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, company_id, is_active
      `, values);
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      console.log(`✅ [PUT /api/products/${id}] Producto actualizado por ${user.name}`);
      res.json(result[0]);
    } catch (error) {
      console.error(`[PUT /api/products/:id] Error:`, error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // DELETE /api/products/:id - Eliminar producto (soft delete)
  app.delete("/api/products/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const id = parseInt(req.params.id);
      
      const result = await sql(`
        UPDATE products 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name
      `, [id]);
      
      if (result.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      console.log(`✅ [DELETE /api/products/${id}] Producto desactivado por ${user.name}:`, result[0].name);
      res.json({ success: true, message: 'Producto eliminado exitosamente' });
    } catch (error) {
      console.error(`[DELETE /api/products/:id] Error:`, error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // GET /api/providers - Obtener proveedores de transporte (COMENTADO: usando catalogRouter)
  // app.get("/api/providers", jwtAuthMiddleware, async (req, res) => {
  //   try {
  //     const result = await sql(`
  //       SELECT 
  //         id, name, email, phone, contact_name, rating, is_active
  //       FROM provider 
  //       WHERE is_active = true
  //       ORDER BY name
  //     `);
  //     
  //     res.json(result);
  //   } catch (error) {
  //     console.error('Error fetching providers:', error);
  //     res.status(500).json({ error: 'Failed to fetch providers' });
  //   }
  // });

  // POST /api/clients - Crear un nuevo cliente
  app.post("/api/clients", jwtAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      
      const result = await sql(`
        INSERT INTO clients (
          name, email, phone, contact_person, company, address,
          payment_terms, requires_receipt, reminder_frequency, is_active,
          notes, company_id, client_code, secondary_email, city, state,
          postal_code, country, email_notifications, customer_type
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        RETURNING *
      `, [
        validatedData.name,
        validatedData.email || null,
        validatedData.phone || null,
        validatedData.contactPerson || null,
        validatedData.company || null,
        validatedData.address || null,
        validatedData.paymentTerms || null,
        validatedData.requiresReceipt ?? true,
        validatedData.reminderFrequency || null,
        validatedData.isActive ?? true,
        validatedData.notes || null,
        validatedData.companyId || null,
        validatedData.clientCode || null,
        validatedData.secondaryEmail || null,
        validatedData.city || null,
        validatedData.state || null,
        validatedData.postalCode || null,
        validatedData.country || 'México',
        validatedData.emailNotifications ?? true,
        validatedData.customerType || null,
      ]);
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating client:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create client' });
    }
  });

  // POST /api/providers - Crear un nuevo proveedor de transporte (COMENTADO: usando catalogRouter)
  // app.post("/api/providers", jwtAuthMiddleware, async (req, res) => {
  //   try {
  //     const validatedData = insertProviderSchema.parse(req.body);
  //     const providerId = crypto.randomUUID(); // Generate UUID in Node.js
  //     
  //     const result = await sql(`
  //       INSERT INTO provider (
  //         id, name, email, phone, contact_name, notes, rating, is_active
  //       ) VALUES (
  //         $1, $2, $3, $4, $5, $6, $7, $8
  //       )
  //       RETURNING *
  //     `, [
  //       providerId,
  //       validatedData.name,
  //       validatedData.email || null,
  //       validatedData.phone || null,
  //       validatedData.contactName || null,
  //       validatedData.notes || null,
  //       validatedData.rating || null,
  //       validatedData.isActive ?? true,
  //     ]);
  //     
  //     res.status(201).json(result[0]);
  //   } catch (error) {
  //     console.error('Error creating provider:', error);
  //     if (error instanceof z.ZodError) {
  //       return res.status(400).json({ error: 'Validación fallida', details: error.errors });
  //     }
  //     res.status(500).json({ error: 'Failed to create provider' });
  //   }
  // });

  // =============================================
  // 🔐 USER ACTIVATION SYSTEM ENDPOINTS
  // =============================================

  // Generate and send activation emails to all users (Admin only)
  app.post("/api/admin/send-activation-emails", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      
      // 🔒 SEGURO: Solo administradores pueden enviar emails de activación masiva
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Solo administradores pueden enviar emails de activación masiva" });
      }

      // Get all users
      const users = await storage.getUsers();
      let successCount = 0;
      let errorCount = 0;

      for (const targetUser of users) {
        try {
          // Generate activation token
          const activationToken = await storage.createActivationToken(targetUser.email);
          
          // Create activation URL
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'user'}.replit.app`
            : 'http://localhost:5000';
          
          const activationUrl = `${baseUrl}/activate/${activationToken.token}`;

          // Send activation email
          const emailSent = await sendEmail({
            to: targetUser.email,
            from: 'daniel@econova.com.mx',
            subject: '🔐 Activa tu cuenta en ECONOVA KPI Dashboard',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
                  <h1 style="margin: 0; font-size: 28px;">¡Bienvenido a ECONOVA!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">KPI Dashboard - Sistema de Gestión</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <h2 style="color: #273949; margin-top: 0;">Hola ${targetUser.name},</h2>
                  
                  <p>Tu cuenta ha sido creada en el Sistema ECONOVA KPI Dashboard. Para completar la configuración y acceder al sistema, necesitas establecer tu contraseña personal.</p>
                  
                  <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1976d2;">📧 Tu información de acceso:</h3>
                    <p style="margin: 0;"><strong>Email:</strong> ${targetUser.email}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Rol:</strong> ${targetUser.role}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${activationUrl}" style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                      🔐 Activar mi cuenta
                    </a>
                  </div>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Información importante:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #856404;">
                      <li>Este enlace es válido por <strong>24 horas</strong></li>
                      <li>Solo puedes usarlo <strong>una vez</strong></li>
                      <li>Elige una contraseña segura (mínimo 8 caracteres)</li>
                      <li>Nunca compartas tus credenciales de acceso</li>
                    </ul>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
                  <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px; color: #666;">${activationUrl}</p>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 12px;">
                  <p>© 2025 ECONOVA - KPI Dashboard</p>
                  <p>Sistema de Gestión de Indicadores de Rendimiento</p>
                </div>
              </div>
            `
          });

          if (emailSent) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error sending activation email to ${targetUser.email}:`, error);
          errorCount++;
        }
      }

      // Clean up expired tokens
      await storage.deleteExpiredTokens();

      res.json({
        message: `Emails de activación enviados`,
        totalUsers: users.length,
        successful: successCount,
        failed: errorCount
      });

    } catch (error) {
      console.error("[POST /api/admin/send-activation-emails] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Validate activation token and show activation page
  app.get("/api/activate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Get token from database
      const activationToken = await storage.getActivationToken(token);
      
      if (!activationToken) {
        return res.status(404).json({ 
          error: "Token no válido",
          message: "El enlace de activación no es válido o ha expirado"
        });
      }

      // Check if token is expired
      if (new Date() > activationToken.expiresAt) {
        return res.status(400).json({ 
          error: "Token expirado",
          message: "El enlace de activación ha expirado. Solicita uno nuevo al administrador"
        });
      }

      // Check if token is already used
      if (activationToken.used) {
        return res.status(400).json({ 
          error: "Token ya utilizado",
          message: "Este enlace de activación ya fue utilizado"
        });
      }

      // Get user to validate email exists
      const user = await storage.getUserByEmail(activationToken.email);
      if (!user) {
        return res.status(404).json({ 
          error: "Usuario no encontrado",
          message: "No se encontró un usuario asociado a este token"
        });
      }

      // Return success with user info (without password)
      res.json({
        valid: true,
        email: activationToken.email,
        user: sanitizeUser(user),
        expiresAt: activationToken.expiresAt
      });

    } catch (error) {
      console.error("[GET /api/activate/:token] Error:", error);
      res.status(500).json({ 
        error: "Error interno",
        message: "Error interno del servidor" 
      });
    }
  });

  // Set password with activation token
  app.post("/api/activate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!password || password.length < 8) {
        return res.status(400).json({ 
          message: "La contraseña debe tener al menos 8 caracteres" 
        });
      }

      // Get token from database
      const activationToken = await storage.getActivationToken(token);
      
      if (!activationToken) {
        return res.status(404).json({ 
          message: "Token no válido o expirado" 
        });
      }

      // Check if token is expired
      if (new Date() > activationToken.expiresAt) {
        return res.status(400).json({ 
          message: "El enlace de activación ha expirado" 
        });
      }

      // Check if token is already used
      if (activationToken.used) {
        return res.status(400).json({ 
          message: "Este enlace de activación ya fue utilizado" 
        });
      }

      // Get user
      const user = await storage.getUserByEmail(activationToken.email);
      if (!user) {
        return res.status(404).json({ 
          message: "Usuario no encontrado" 
        });
      }

      // Hash the new password
      const hashedPassword = await bcryptHash(password, 10);

      // Update user password
      await storage.updateUser(user.id, { password: hashedPassword });

      // Mark token as used
      await storage.markTokenAsUsed(token);

      // Clean up expired tokens
      await storage.deleteExpiredTokens();

      res.json({
        message: "¡Contraseña establecida exitosamente! Ya puedes iniciar sesión",
        user: sanitizeUser(user)
      });

    } catch (error) {
      console.error("[POST /api/activate/:token] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Integrate Logistics Routes
  // app.use("/api", catalogRouter);
  // app.use("/api", logisticsRouter);

  // TEMPORARY: Production database seeding endpoint
  app.post("/api/seed-production", async (req, res) => {
    try {
      const { seedProductionData } = await import("./seed-production");
      const result = await seedProductionData();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Seeding failed", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // TEMPORARY: Database diagnostics endpoint
  app.get("/api/debug-database", async (req, res) => {
    try {
      const allCompanies = await storage.getCompanies();
      const allAreas = await storage.getAreas();
      const allKpis = await storage.getKpis();
      
      res.json({
        companies: allCompanies,
        areas: allAreas,
        kpis: allKpis,
        totalCompanies: allCompanies.length,
        totalAreas: allAreas.length,
        totalKpis: allKpis.length
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ============================================
  // MÓDULO TESORERÍA - API Routes
  // ============================================

  // GET /api/treasury/payments - Listar pagos programados
  app.get("/api/treasury/payments", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, status } = req.query;
      let whereClause = "WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (companyId) {
        whereClause += ` AND company_id = $${paramIndex}`;
        params.push(parseInt(companyId as string));
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const result = await sql(`
        SELECT * FROM scheduled_payments
        ${whereClause}
        ORDER BY due_date ASC
      `, params);

      res.json(result);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  // POST /api/treasury/payments - Crear pago programado
  app.post("/api/treasury/payments", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const data = { ...req.body, createdBy: user.id };
      
      const result = await sql(`
        INSERT INTO scheduled_payments (
          company_id, supplier_name, amount, currency, due_date,
          status, reference, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        data.companyId,
        data.supplierName,
        data.amount,
        data.currency || 'MXN',
        data.dueDate,
        data.status || 'pending',
        data.reference || null,
        data.notes || null,
        data.createdBy
      ]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({ error: 'Failed to create payment' });
    }
  });

  // PUT /api/treasury/payments/:id/pay - Marcar pago como pagado
  app.put("/api/treasury/payments/:id/pay", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const paymentId = parseInt(req.params.id);

      const result = await sql(`
        UPDATE scheduled_payments
        SET status = 'paid', paid_at = NOW(), paid_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [user.id, paymentId]);

      if (result.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      res.status(500).json({ error: 'Failed to mark payment as paid' });
    }
  });

  // GET /api/treasury/exchange-rates - Listar tipos de cambio
  app.get("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const { limit = 30 } = req.query;
      
      const result = await sql(`
        SELECT 
          er.*,
          u.name as created_by_name,
          u.email as created_by_email
        FROM exchange_rates er
        LEFT JOIN users u ON er.created_by = u.id
        ORDER BY er.date DESC
        LIMIT $1
      `, [parseInt(limit as string)]);

      res.json(result);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
  });

  // POST /api/treasury/exchange-rates - Registrar tipo de cambio
  app.post("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { buyRate, sellRate, source, notes } = req.body;

      const result = await sql(`
        INSERT INTO exchange_rates (buy_rate, sell_rate, source, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [buyRate, sellRate, source || null, notes || null, user.id]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating exchange rate:', error);
      res.status(500).json({ error: 'Failed to create exchange rate' });
    }
  });

  // POST /api/treasury/request-purchase - Solicitar compra de dólares a Lolita
  app.post("/api/treasury/request-purchase", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { source, amountUsd, amountMxn, rate, notes } = req.body;

      if (!source || !amountUsd || !amountMxn || !rate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Buscar el email de Lolita o usar un email por defecto
      const lolitaEmail = 'dolores@grupoorsega.com'; // Email de Lolita
      
      // Crear el mensaje de email
      const emailSubject = `💰 Solicitud de Compra de Dólares - ${source}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
            💰 Solicitud de Compra de Dólares
          </h2>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;"><strong>Hola Lolita,</strong></p>
            <p style="margin: 10px 0; font-size: 14px;">
              Por favor compra <strong style="color: #2563eb; font-size: 18px;">${parseFloat(amountUsd).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> 
              a precio de <strong style="color: #2563eb;">$${parseFloat(rate).toFixed(4)} MXN</strong> (${source}).
            </p>
            <p style="margin: 10px 0; font-size: 14px;">
              <strong>Total a pagar:</strong> <span style="color: #16a34a; font-size: 18px;">$${parseFloat(amountMxn).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
            </p>
            ${notes ? `<p style="margin: 10px 0; font-size: 14px;"><strong>Nota:</strong> ${notes}</p>` : ''}
          </div>
          
          <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
            <p style="margin: 0; font-size: 12px; color: #1e40af;">
              📧 Esta solicitud fue enviada desde el sistema por ${user.name || user.email}
            </p>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px;">
            Gracias,<br>
            <strong>${user.name || 'Emilio'}</strong>
          </p>
        </div>
      `;

      // Enviar email a Lolita
      const emailResult = await emailService.sendEmail({
        to: lolitaEmail,
        subject: emailSubject,
        html: emailBody,
      }, 'treasury');

      if (!emailResult.success) {
        console.error('Error sending email:', emailResult.error);
        // No fallar la solicitud si falla el email, pero loguear el error
      }

      res.status(200).json({
        success: true,
        message: 'Solicitud enviada exitosamente a Lolita',
        emailSent: emailResult.success,
        requestId: Date.now(),
      });
    } catch (error) {
      console.error('Error processing purchase request:', error);
      res.status(500).json({ error: 'Failed to process purchase request' });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'application/xml', 'text/xml'];
      if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xml')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF y XML'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // POST /api/treasury/payments/:id/receipts - Subir comprobante
  app.post("/api/treasury/payments/:id/receipts", jwtAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const paymentId = parseInt(req.params.id);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileUrl = `/uploads/receipts/${file.filename}`;
      const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'xml';

      const result = await sql(`
        INSERT INTO payment_receipts (payment_id, file_name, file_url, file_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [paymentId, file.originalname, fileUrl, fileType, user.id]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      res.status(500).json({ error: 'Failed to upload receipt' });
    }
  });

  // GET /api/treasury/payments/:id/receipts - Listar comprobantes de un pago
  app.get("/api/treasury/payments/:id/receipts", jwtAuthMiddleware, async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);
      
      const result = await sql(`
        SELECT * FROM payment_receipts
        WHERE payment_id = $1
        ORDER BY uploaded_at DESC
      `, [paymentId]);

      res.json(result);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      res.status(500).json({ error: 'Failed to fetch receipts' });
    }
  });

  // POST /api/treasury/receipts/send - Enviar comprobantes por email
  app.post("/api/treasury/receipts/send", jwtAuthMiddleware, async (req, res) => {
    try {
      const { receiptIds, emails } = req.body;

      if (!receiptIds || !emails || emails.length === 0) {
        return res.status(400).json({ error: 'receiptIds and emails are required' });
      }

      // Obtener los comprobantes y datos del pago
      const receipts = await sql(`
        SELECT pr.*, sp.supplier_name, sp.amount, sp.currency, sp.reference
        FROM payment_receipts pr
        JOIN scheduled_payments sp ON pr.payment_id = sp.id
        WHERE pr.id = ANY($1)
      `, [receiptIds]);

      if (receipts.length === 0) {
        return res.status(404).json({ error: 'No receipts found' });
      }

      // Preparar archivos adjuntos
      const attachments = [];
      for (const receipt of receipts) {
        const filePath = path.join(process.cwd(), receipt.file_url);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath);
          const base64Content = fileContent.toString('base64');
          
          attachments.push({
            content: base64Content,
            filename: receipt.file_name,
            type: receipt.file_type === 'pdf' ? 'application/pdf' : 'application/xml',
            disposition: 'attachment'
          });
        }
      }

      // Obtener template de email
      const payment = receipts[0];
      const emailTemplate = getPaymentReceiptEmailTemplate(payment, receipts);

      // Enviar email a cada destinatario
      for (const email of emails) {
        await sendGridEmail({
          to: email,
          from: 'marioreynoso@grupoorsega.com',
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
          attachments: attachments
        });
      }

      // Actualizar registro
      await sql(`
        UPDATE payment_receipts
        SET sent_to = $1, sent_at = NOW()
        WHERE id = ANY($2)
      `, [emails, receiptIds]);

      res.json({ success: true, message: `Comprobantes enviados a ${emails.join(', ')}` });
    } catch (error) {
      console.error('Error sending receipts:', error);
      res.status(500).json({ error: 'Failed to send receipts' });
    }
  });

  // GET /api/treasury/complements - Listar complementos de pago
  app.get("/api/treasury/complements", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, status } = req.query;
      let whereClause = "WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (companyId) {
        whereClause += ` AND company_id = $${paramIndex}`;
        params.push(parseInt(companyId as string));
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const result = await sql(`
        SELECT * FROM payment_complements
        ${whereClause}
        ORDER BY created_at DESC
      `, params);

      res.json(result);
    } catch (error) {
      console.error('Error fetching complements:', error);
      res.status(500).json({ error: 'Failed to fetch complements' });
    }
  });

  // POST /api/treasury/complements - Crear complemento de pago
  app.post("/api/treasury/complements", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { companyId, clientName, invoiceReference, amount, currency } = req.body;

      const result = await sql(`
        INSERT INTO payment_complements (
          company_id, client_name, invoice_reference, amount, currency, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [companyId, clientName, invoiceReference, amount, currency || 'MXN', user.id]);

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating complement:', error);
      res.status(500).json({ error: 'Failed to create complement' });
    }
  });

  // PUT /api/treasury/complements/:id/generate - Generar complemento
  app.put("/api/treasury/complements/:id/generate", jwtAuthMiddleware, async (req, res) => {
    try {
      const complementId = parseInt(req.params.id);

      // TODO: Implementar generación de PDF del complemento
      const complementUrl = `/uploads/complements/complement-${complementId}.pdf`;

      const result = await sql(`
        UPDATE payment_complements
        SET status = 'generated', generated_at = NOW(), complement_url = $1
        WHERE id = $2
        RETURNING *
      `, [complementUrl, complementId]);

      if (result.length === 0) {
        return res.status(404).json({ error: 'Complement not found' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Error generating complement:', error);
      res.status(500).json({ error: 'Failed to generate complement' });
    }
  });


  // ============================================
  // PAYMENT VOUCHERS API - Sistema Kanban
  // ============================================

  // GET /api/payment-vouchers - Listar comprobantes
  app.get("/api/payment-vouchers", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, status } = req.query;
      
      let vouchers;
      if (status && companyId) {
        vouchers = await storage.getPaymentVouchersByStatus(status as string, parseInt(companyId as string));
      } else if (companyId) {
        vouchers = await storage.getPaymentVouchersByCompany(parseInt(companyId as string));
      } else if (status) {
        vouchers = await storage.getPaymentVouchersByStatus(status as string);
      } else {
        vouchers = await storage.getPaymentVouchers();
      }
      
      res.json(vouchers);
    } catch (error) {
      console.error('Error fetching payment vouchers:', error);
      res.status(500).json({ error: 'Failed to fetch payment vouchers' });
    }
  });

  // Configurar multer para payment vouchers
  const voucherUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'payment-vouchers');
        // Crear directorio si no existe
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `voucher-${uniqueSuffix}-${file.originalname}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF, PNG, JPG, JPEG'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // POST /api/payment-vouchers/upload - Subir comprobante con análisis automático OpenAI - 🔒 Con rate limiting
  app.post("/api/payment-vouchers/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
    voucherUpload.single('voucher')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err.message);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      // Validar request body
      const uploadSchema = z.object({
        companyId: z.string().transform((val) => {
          const num = Number(val);
          if (!num || num <= 0) {
            throw new Error("CompanyId inválido");
          }
          return num;
        }),
        clientId: z.string().transform((val) => {
          const num = Number(val);
          if (!num || num <= 0) {
            throw new Error("ClientId inválido");
          }
          return num;
        }),
        scheduledPaymentId: z.string().optional().transform(v => v ? Number(v) : undefined),
        notes: z.string().optional(),
      });

      const validatedData = uploadSchema.parse(req.body);

      console.log(`📤 [Upload] Procesando comprobante: ${file.originalname}`);

      // Obtener información del cliente usando storage
      const client = await storage.getClient(validatedData.clientId);

      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      // Analizar el documento con OpenAI
      const { analyzePaymentDocument } = await import("./document-analyzer");
      const fs = await import('fs');
      const fileBuffer = fs.readFileSync(file.path);
      
      const analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);

      // Determinar estado inicial automáticamente
      const initialStatus = client.requiresPaymentComplement 
        ? 'pendiente_complemento' 
        : 'factura_pagada';

      // Crear comprobante usando storage
      const newVoucher: InsertPaymentVoucher = {
        companyId: validatedData.companyId,
        clientId: validatedData.clientId,
        clientName: client.name,
        scheduledPaymentId: validatedData.scheduledPaymentId || null,
        status: initialStatus,
        voucherFileUrl: file.path,
        voucherFileName: file.originalname,
        voucherFileType: file.mimetype,
        extractedAmount: analysis.extractedAmount,
        extractedDate: analysis.extractedDate,
        extractedBank: analysis.extractedBank,
        extractedReference: analysis.extractedReference,
        extractedCurrency: analysis.extractedCurrency,
        ocrConfidence: analysis.ocrConfidence,
        notes: validatedData.notes || null,
        uploadedBy: user.id,
      };

      const voucher = await storage.createPaymentVoucher(newVoucher);

      // 🏦 AUTOMATIZACIÓN: Enviar comprobante automáticamente al proveedor
      try {
        const { TreasuryAutomation } = await import('./treasury-automation');
        const automationResult = await TreasuryAutomation.processAutomaticFlow(
          voucher.id, 
          validatedData.clientId, 
          validatedData.companyId
        );
        
        console.log(`🤖 [Automation] Flujo automático: ${automationResult.message}`);
        
        // Actualizar estado si cambió y es válido
        const validStatuses = ['factura_pagada', 'pendiente_complemento', 'complemento_recibido', 'cierre_contable'];
        if (automationResult.nextStatus !== initialStatus && validStatuses.includes(automationResult.nextStatus)) {
          await storage.updatePaymentVoucherStatus(voucher.id, automationResult.nextStatus);
          voucher.status = automationResult.nextStatus as any;
        }
      } catch (automationError) {
        console.error('🤖 [Automation] Error en flujo automático:', automationError);
        // No fallar el upload si la automatización falla
      }

      console.log(`✅ [Upload] Comprobante creado con ID: ${voucher.id}, estado: ${voucher.status}`);

      res.status(201).json({
        voucher,
        analysis,
        autoStatus: initialStatus,
        requiresComplement: client.requiresPaymentComplement
      });
    } catch (error) {
      console.error('Error uploading payment voucher:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Error al subir comprobante' });
    }
  });

  // PUT /api/payment-vouchers/:id/status - Actualizar estado del comprobante (Kanban)
  app.put("/api/payment-vouchers/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const voucherId = parseInt(req.params.id);

      // Validar request body
      const statusSchema = z.object({
        status: z.enum(['factura_pagada', 'pendiente_complemento', 'complemento_recibido', 'cierre_contable']),
      });

      const validatedData = statusSchema.parse(req.body);

      // Actualizar usando storage
      const updatedVoucher = await storage.updatePaymentVoucherStatus(voucherId, validatedData.status);

      if (!updatedVoucher) {
        return res.status(404).json({ error: 'Payment voucher not found' });
      }

      res.json(updatedVoucher);
    } catch (error) {
      console.error('Error updating payment voucher status:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update payment voucher status' });
    }
  });

  // PUT /api/payment-vouchers/:id - Actualizar comprobante (para agregar factura o complemento)
  app.put("/api/payment-vouchers/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const voucherId = parseInt(req.params.id);

      // Validar request body
      const updateSchema = z.object({
        invoiceFileUrl: z.string().optional(),
        invoiceFileName: z.string().optional(),
        invoiceFileType: z.string().optional(),
        complementFileUrl: z.string().optional(),
        complementFileName: z.string().optional(),
        complementFileType: z.string().optional(),
        notes: z.string().optional(),
      });

      const validatedData = updateSchema.parse(req.body);

      // Verificar que hay algo para actualizar
      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Actualizar usando storage
      const updatedVoucher = await storage.updatePaymentVoucher(voucherId, validatedData);

      if (!updatedVoucher) {
        return res.status(404).json({ error: 'Payment voucher not found' });
      }

      res.json(updatedVoucher);
    } catch (error) {
      console.error('Error updating payment voucher:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update payment voucher' });
    }
  });

  // FX Analytics Endpoints
  // GET /api/fx/source-series - Obtener serie temporal por fuente
  app.get("/api/fx/source-series", jwtAuthMiddleware, async (req, res) => {
    try {
      const source = req.query.source as string || "MONEX";
      const days = parseInt(req.query.days as string) || 30;

      const result = await getSourceSeries(source, days);
      res.json(result);
    } catch (error) {
      console.error('Error fetching source series:', error);
      res.status(500).json({ error: 'Failed to fetch source series' });
    }
  });

  // GET /api/fx/compare - Obtener comparación entre fuentes
  app.get("/api/fx/compare", jwtAuthMiddleware, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const usdMonthly = parseFloat(req.query.usd_monthly as string) || 25000;

      const result = await getComparison(days, usdMonthly);
      res.json(result);
    } catch (error) {
      console.error('Error fetching comparison:', error);
      res.status(500).json({ error: 'Failed to fetch comparison' });
    }
  });

  // POST /api/fx/import-historical - Importar datos históricos de Banxico
  app.post("/api/fx/import-historical", jwtAuthMiddleware, async (req, res) => {
    try {
      const { importBanxicoHistoricalData } = await import("./banxico-importer");
      
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      const result = await importBanxicoHistoricalData(startDate, endDate);
      res.json(result);
    } catch (error) {
      console.error('Error importing historical data:', error);
      res.status(500).json({ error: 'Failed to import historical data' });
    }
  });

  // POST /api/admin/seed-fx-rates - Importar tipos de cambio históricos de Banxico
  app.post("/api/admin/seed-fx-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo administradores pueden ejecutar este endpoint' });
      }

      const { startDate, endDate } = req.body;
      const start = startDate || '2025-09-01';
      const end = endDate || '2025-10-31';

      console.log(`📥 Importando tipos de cambio de Banxico: ${start} a ${end}`);

      const { importBanxicoHistoricalData } = await import("./banxico-importer");
      const result = await importBanxicoHistoricalData(start, end);

      console.log(`✅ Importación completada: ${result.imported} registros nuevos`);

      res.json({
        message: `Importados ${result.imported} tipos de cambio (${result.skipped} ya existían)`,
        ...result
      });

    } catch (error) {
      console.error('❌ Error al importar tipos de cambio:', error);
      res.status(500).json({ 
        error: 'Error al importar tipos de cambio',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ============================================
  // IDRALL INTEGRATION - Procesamiento de Excel
  // ============================================

  // Configurar multer para archivos Excel de IDRALL
  const idrallUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/idrall/');
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `idrall-${uniqueSuffix}-${file.originalname}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // POST /api/idrall/upload - Procesar Excel de IDRALL y crear pagos
  app.post("/api/idrall/upload", jwtAuthMiddleware, idrallUpload.single('excel'), async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo Excel' });
      }

      // Validar request body
      const uploadSchema = z.object({
        companyId: z.string().transform((val) => {
          const num = Number(val);
          if (!num || num <= 0) {
            throw new Error("CompanyId inválido");
          }
          return num;
        }),
        createAsPending: z.string().optional().transform(v => v === 'true'),
      });

      const validatedData = uploadSchema.parse(req.body);

      console.log(`📊 [IdrallUpload] Procesando Excel: ${file.originalname} para empresa ${validatedData.companyId}`);

      // Crear directorio si no existe
      const fs = await import('fs');
      const path = await import('path');
      const idrallDir = path.join(process.cwd(), 'uploads', 'idrall');
      if (!fs.existsSync(idrallDir)) {
        fs.mkdirSync(idrallDir, { recursive: true });
      }

      // Procesar Excel con IdrallParser
      const { IdrallParser } = await import('./idrall-parser');
      const parseResult = await IdrallParser.parseExcel(file.path);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Error procesando archivo Excel',
          details: parseResult.errors,
          totalRows: parseResult.totalRows
        });
      }

      console.log(`✅ [IdrallUpload] Excel procesado: ${parseResult.payments.length} pagos válidos`);

      // Crear pagos programados en la base de datos
      const { storage } = await import('./storage');
      const createdPayments = [];
      const errors = [];

      for (const payment of parseResult.payments) {
        try {
          // Buscar cliente/proveedor coincidente
          const clientMatch = await IdrallParser.findMatchingClient(payment, validatedData.companyId);
          
          let clientId = null;
          let clientName = payment.proveedor || payment.cliente || 'Proveedor IDRALL';

          if (clientMatch.found) {
            clientId = clientMatch.client.id;
            clientName = clientMatch.client.name;
            console.log(`🔗 [IdrallUpload] Cliente encontrado: ${clientName} (${clientMatch.matchType})`);
          } else {
            console.log(`⚠️ [IdrallUpload] Cliente no encontrado para: ${clientName}`);
          }

          // Crear pago programado
          const scheduledPayment = {
            companyId: validatedData.companyId,
            clientId: clientId,
            clientName: clientName,
            amount: payment.monto || payment.importe || 0,
            currency: payment.moneda || 'MXN',
            description: payment.concepto || payment.descripcion || 'Pago IDRALL',
            dueDate: payment.fecha_pago || payment.fecha ? new Date(payment.fecha_pago || payment.fecha || new Date()) : new Date(),
            reference: payment.referencia || payment.factura || payment.folio || '',
            bank: payment.banco || '',
            account: payment.cuenta || '',
            status: validatedData.createAsPending ? 'pending' : 'scheduled',
            source: 'idrall',
            originalData: payment,
            createdBy: user.id,
          };

          const createdPayment = await storage.createScheduledPayment(scheduledPayment);
          createdPayments.push(createdPayment);

        } catch (error) {
          const errorMsg = `Error creando pago para ${payment.proveedor || payment.cliente}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
          errors.push(errorMsg);
          console.error(`❌ [IdrallUpload] ${errorMsg}`);
        }
      }

      // Limpiar archivo temporal
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn('⚠️ [IdrallUpload] Error limpiando archivo temporal:', cleanupError);
      }

      console.log(`🎉 [IdrallUpload] Procesamiento completado: ${createdPayments.length} pagos creados, ${errors.length} errores`);

      res.json({
        success: true,
        message: `Excel procesado exitosamente`,
        summary: {
          totalRows: parseResult.totalRows,
          validPayments: parseResult.payments.length,
          createdPayments: createdPayments.length,
          errors: errors.length
        },
        createdPayments: createdPayments.map(p => ({
          id: p.id,
          clientName: p.clientName,
          amount: p.amount,
          dueDate: p.dueDate,
          status: p.status
        })),
        errors: errors
      });

    } catch (error) {
      console.error('❌ [IdrallUpload] Error procesando Excel:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ 
        error: 'Error procesando archivo Excel de IDRALL',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ============================================
  // EMAIL TEST ENDPOINT (para probar Resend)
  // ============================================
  app.post("/api/test-email", jwtAuthMiddleware, async (req, res) => {
    try {
      const { to, department = 'treasury', useTestEmail = true } = req.body;
      
      if (!to) {
        return res.status(400).json({ error: 'Email destination required' });
      }

      // Para pruebas, usar email de Resend por defecto
      const fromEmail = useTestEmail 
        ? 'onboarding@resend.dev' 
        : undefined; // Si no usar test email, el servicio usará el dominio configurado

      console.log(`[TEST EMAIL] Enviando prueba a ${to} desde ${fromEmail || 'dominio configurado'}`);

      const testResult = await emailService.sendEmail({
        to,
        from: fromEmail,
        subject: 'Prueba de Email - Sistema Econova',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">✅ Email de Prueba Exitoso</h2>
            <p>Este es un email de prueba del sistema de Econova.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Departamento:</strong> ${department}</p>
              <p><strong>Remitente:</strong> ${fromEmail || 'Dominio configurado'}</p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString('es-MX')}</p>
              <p><strong>Estado:</strong> ✅ Funcionando correctamente</p>
            </div>
            <p>El sistema de emails está configurado y funcionando.</p>
            <p>Saludos,<br>Equipo de Desarrollo - Econova</p>
          </div>
        `
      }, department as 'treasury' | 'logistics');

      if (!testResult.success) {
        console.error('[TEST EMAIL] Error:', testResult.error);
      }

      res.json({
        success: testResult.success,
        message: testResult.success 
          ? 'Email enviado exitosamente. Revisa tu bandeja de entrada (y spam).' 
          : `Error enviando email: ${testResult.error}`,
        messageId: testResult.messageId,
        error: testResult.error,
        from: fromEmail || 'dominio configurado'
      });

    } catch (error: any) {
      console.error('[TEST EMAIL] Error en test de email:', error);
      res.status(500).json({ 
        success: false, 
        error: `Error interno del servidor: ${error?.message || String(error)}` 
      });
    }
  });

  console.log("✅ All routes have been configured successfully");
  return app;
}