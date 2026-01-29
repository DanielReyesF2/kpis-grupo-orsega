import express from "express";
import { hash as bcryptHash } from "bcrypt";
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
import { storage, type IStorage } from "./storage";
import { jwtAuthMiddleware, jwtAdminMiddleware, loginUser } from "./auth";
import { insertCompanySchema, insertAreaSchema, insertKpiSchema, insertKpiValueSchema, insertUserSchema, updateShipmentStatusSchema, insertShipmentSchema, updateKpiSchema, insertClientSchema, insertProviderSchema, type InsertPaymentVoucher, type Kpi, paymentVouchers, deletedPaymentVouchers } from "@shared/schema";
import { calculateKpiStatus, calculateCompliance, parseNumericValue, isLowerBetterKPI } from "@shared/kpi-utils";
import { db } from "./db";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getSourceSeries, getComparison } from "./fx-analytics";
import { emailService } from "./email-service";
import { logger } from "./logger";

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
import { smartSearch } from './smart-search';
import { econovaSearch } from './econova-agent';
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from '@copilotkit/runtime';
import path from "path";
import fs from "fs";
import { neon } from '@neondatabase/serverless';
import multer from "multer";
import NodeCache from "node-cache";
import { getSalesMetrics } from "./sales-metrics";
import { handleSalesUpload } from "./sales-upload-handler-NEW";
import { handleIDRALLUpload, detectExcelFormat } from "./sales-idrall-handler";
import { calculateSalesKpiValue, calculateSalesKpiHistory } from "./sales-kpi-calculator";
import { calculateRealProfitability } from "./profitability-metrics";
import { getAnnualSummary, getAvailableYears } from "./annual-summary";
import { uploadFile, uploadMulterFile, saveTempFile, moveTempToStorage, isUsingR2, getFile } from "./storage/file-storage";
import * as fileStorage from "./file-storage";
import { generateSalesAnalystInsights } from "./sales-analyst";
import { getAvailableTools, executeTool, generateSystemPrompt, findTool } from "./mcp";

// Tenant validation middleware - VUL-001 fix
import { validateTenantFromBody, validateTenantFromParams, validateTenantAccess } from "./middleware/tenant-validation";

// Database connection for client preferences queries
const sql = neon(process.env.DATABASE_URL!);

// Cache for collaborator performance data (5 minute TTL)
const collaboratorPerformanceCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Security helpers: Remove sensitive data from user objects
interface UserWithPassword {
  password?: string;
  [key: string]: unknown;
}

function sanitizeUser<T extends UserWithPassword>(user: T): Omit<T, 'password'> {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser;
}

function sanitizeUsers<T extends UserWithPassword>(users: T[]): Array<Omit<T, 'password'>> {
  return users.map(sanitizeUser);
}

// Security helper: Redact sensitive data from logs
function redactSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitive = ['password', 'token', 'authorization', 'apiKey', 'secret', 'jwt'];
  const result: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      (result as Record<string, unknown>)[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = redactSensitiveData(value);
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

// Funciones utilitarias de KPI importadas desde @shared/kpi-utils
// - parseNumericValue: Extrae valor numérico de string/number
// - isLowerBetterKPI: Determina si un KPI es "menor es mejor"
// - calculateKpiStatus: Calcula estado (complies/alert/not_compliant)
// - calculateCompliance: Calcula porcentaje de cumplimiento

// Función para crear notificaciones automáticas en cambios de estado críticos
async function createKPIStatusChangeNotification(
  kpi: Pick<Kpi, 'id' | 'name' | 'companyId' | 'areaId'>,
  user: { id: number; name: string; email: string },
  previousStatus: string,
  newStatus: string,
  storage: IStorage
) {
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
        fromUserId: user.id,
        toUserId: user.id, // Notificar al mismo usuario que hizo el cambio
        title: `Cambio de estado en KPI: ${kpi.name}`,
        message: `El KPI "${kpi.name}" ha cambiado de "${statusMap[previousStatus as keyof typeof statusMap]}" a "${statusMap[newStatus as keyof typeof statusMap]}"`,
        type: newStatus === 'complies' ? 'success' : 'warning',
        companyId: kpi.companyId ?? null,
        areaId: kpi.areaId ?? null,
      };
      
      await storage.createNotification(notification);
      logger.info(`[KPI Notification] Notificación creada para cambio de estado: ${kpi.name}`, { kpiId: kpi.id, userId: user.id });
    }
  } catch (error) {
      logger.error('Error creating KPI status change notification', error);
    // No fallar la operación por un error de notificación
  }
}

/**
 * KPIs de Logística: Actualizar automáticamente los KPIs de logística basados en shipments
 * Esta función se ejecuta cuando un envío se marca como "delivered"
 */
async function updateLogisticsKPIs(companyId: number) {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`[KPI Logística] Actualizando KPIs para company ${companyId}, período: ${firstDayOfMonth.toISOString()} - ${lastDayOfMonth.toISOString()}`);

    // 1. Obtener todos los envíos entregados del mes actual para esta empresa
    const monthlyShipments = await sql`
      SELECT * FROM shipments
      WHERE company_id = ${companyId}
      AND status = 'delivered'
      AND delivered_at >= ${firstDayOfMonth.toISOString()}
      AND delivered_at <= ${lastDayOfMonth.toISOString()}
    `;

    console.log(`[KPI Logística] Envíos entregados este mes: ${monthlyShipments.length}`);

    if (monthlyShipments.length === 0) {
      console.log(`[KPI Logística] No hay envíos entregados este mes, usando valores en 0`);
    }

    // 2. CALCULAR COSTO PROMEDIO POR TRANSPORTE
    const transportCosts = monthlyShipments
      .filter(s => s.transportCost && parseFloat(s.transportCost.toString()) > 0)
      .map(s => parseFloat(s.transportCost!.toString()));

    const avgTransportCost = transportCosts.length > 0
      ? transportCosts.reduce((a, b) => a + b, 0) / transportCosts.length
      : 0;

    console.log(`[KPI Logística] Costo promedio por transporte: $${avgTransportCost.toFixed(2)} MXN (${transportCosts.length} muestras)`);

    // 3. CALCULAR TIEMPO PROMEDIO DE PREPARACIÓN (createdAt → inRouteAt)
    const preparationTimes = monthlyShipments
      .filter(s => s.createdAt && s.inRouteAt)
      .map(s => {
        const created = new Date(s.createdAt!);
        const inRoute = new Date(s.inRouteAt!);
        return (inRoute.getTime() - created.getTime()) / (1000 * 60 * 60); // horas
      });

    const avgPreparationTime = preparationTimes.length > 0
      ? preparationTimes.reduce((a, b) => a + b, 0) / preparationTimes.length
      : 0;

    console.log(`[KPI Logística] Tiempo promedio de preparación: ${avgPreparationTime.toFixed(2)} horas (${preparationTimes.length} muestras)`);

    // 4. CALCULAR TIEMPO PROMEDIO DE ENTREGA (inRouteAt → deliveredAt)
    const deliveryTimes = monthlyShipments
      .filter(s => s.inRouteAt && s.deliveredAt)
      .map(s => {
        const inRoute = new Date(s.inRouteAt!);
        const delivered = new Date(s.deliveredAt!);
        return (delivered.getTime() - inRoute.getTime()) / (1000 * 60 * 60); // horas
      });

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0;

    console.log(`[KPI Logística] Tiempo promedio de entrega: ${avgDeliveryTime.toFixed(2)} horas (${deliveryTimes.length} muestras)`);

    // 5. ACTUALIZAR KPIs EN LA BASE DE DATOS
    const kpiUpdates = [
      {
        name: 'Costo de Transporte',
        value: avgTransportCost.toFixed(2),
        goal: 5000 // Meta por defecto: $5,000 MXN por transporte (editable desde UI)
      },
      {
        name: 'Tiempo de Preparación',
        value: avgPreparationTime.toFixed(2),
        goal: 24 // Meta: 24 horas (editable desde UI)
      },
      {
        name: 'Tiempo de Entrega',
        value: avgDeliveryTime.toFixed(2),
        goal: 48 // Meta: 48 horas (editable desde UI)
      }
    ];

    for (const kpiUpdate of kpiUpdates) {
      // Buscar el KPI por nombre y companyId
      const kpiResult = await sql`
        SELECT id, goal FROM "Kpi"
        WHERE name = ${kpiUpdate.name}
        AND "companyId" = ${companyId}
        LIMIT 1
      `;

      if (kpiResult.length === 0) {
        console.log(`[KPI Logística] ⚠️  KPI "${kpiUpdate.name}" no encontrado para company ${companyId}, omitiendo...`);
        continue;
      }

      const kpi = kpiResult[0];
      const kpiGoal = parseFloat(kpi.goal?.toString() || kpiUpdate.goal.toString());
      const actualValue = parseFloat(kpiUpdate.value);

      // Calcular compliance (para costos y tiempos, menor es mejor)
      let compliancePercentage: number;
      if (actualValue === 0) {
        compliancePercentage = 100; // Si no hay datos, asumimos 100%
      } else {
        compliancePercentage = Math.min((kpiGoal / actualValue) * 100, 100);
      }

      // Insertar o actualizar valor del KPI en la tabla KpiValue
      await sql`
        INSERT INTO "KpiValue" (
          "kpiId",
          "companyId",
          value,
          "compliancePercentage",
          date,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${kpi.id},
          ${companyId},
          ${kpiUpdate.value},
          ${compliancePercentage.toFixed(2)},
          ${now},
          ${now},
          ${now}
        )
        ON CONFLICT ("kpiId", date)
        DO UPDATE SET
          value = EXCLUDED.value,
          "compliancePercentage" = EXCLUDED."compliancePercentage",
          "updatedAt" = EXCLUDED."updatedAt"
      `;

      console.log(`[KPI Logística] ✅ KPI "${kpiUpdate.name}" actualizado: ${kpiUpdate.value} (compliance: ${compliancePercentage.toFixed(2)}%)`);
    }

    console.log(`[KPI Logística] ✅ Actualización completa para company ${companyId}`);
  } catch (error) {
    console.error('[KPI Logística] ❌ Error actualizando KPIs:', error);
    throw error;
  }
}

export function registerRoutes(app: express.Application) {
  const server = app.listen;

  // ========================================
  // RATE LIMITERS - Protección contra abuso
  // ========================================
  // NOTA: El globalApiLimiter está configurado en server/index.ts
  // para aplicar a TODA la API antes de que se registren las rutas
  
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
  // RUTAS PÚBLICAS (SIN AUTENTICACIÓN) - DEBEN IR PRIMERO
  // ========================================
  // Login route - 🔒 Con rate limiting pero SIN autenticación JWT
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
      logger.error("[POST /api/login] Error en login", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // ========================================
  // COPILOTKIT AI ASSISTANT (SIN AUTH - debe ir ANTES del middleware global)
  // ========================================
  // CopilotKit Runtime - Endpoint para el asistente AI
  app.all("/api/copilotkit", async (req, res) => {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      const runtime = new CopilotRuntime({
        actions: [
          {
            name: "searchData",
            description: "Busca información en la base de datos del sistema: ventas, clientes, métricas, KPIs, tipos de cambio, embarques. Usa esta acción cuando el usuario pregunte sobre datos del negocio.",
            parameters: [
              {
                name: "query",
                type: "string",
                description: "La pregunta o consulta del usuario sobre los datos del negocio",
                required: true
              }
            ],
            handler: async ({ query }: { query: string }) => {
              try {
                const result = await smartSearch(query);
                return JSON.stringify({
                  answer: result.answer,
                  data: result.data,
                  source: result.source
                });
              } catch (error) {
                console.error('[CopilotKit Action] Error en searchData:', error);
                return JSON.stringify({ error: 'Error al buscar datos' });
              }
            }
          }
        ]
      });

      const serviceAdapter = new OpenAIAdapter({ model: "gpt-4o-mini" });
      const handler = copilotRuntimeNodeHttpEndpoint({
        endpoint: "/api/copilotkit",
        runtime,
        serviceAdapter
      });

      return handler(req, res);
    } catch (error) {
      console.error('[CopilotKit] Error:', error);
      res.status(500).json({ error: 'Error en CopilotKit runtime' });
    }
  });

  // CopilotKit sub-routes (info, etc) - también sin auth
  app.all("/api/copilotkit/*", async (req, res) => {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }

      const runtime = new CopilotRuntime({
        actions: [
          {
            name: "searchData",
            description: "Busca información en la base de datos",
            parameters: [{ name: "query", type: "string", description: "La pregunta", required: true }],
            handler: async ({ query }: { query: string }) => {
              const result = await smartSearch(query);
              return JSON.stringify(result);
            }
          }
        ]
      });

      const serviceAdapter = new OpenAIAdapter({ model: "gpt-4o-mini" });
      const handler = copilotRuntimeNodeHttpEndpoint({
        endpoint: "/api/copilotkit",
        runtime,
        serviceAdapter
      });

      return handler(req, res);
    } catch (error) {
      console.error('[CopilotKit] Error:', error);
      res.status(500).json({ error: 'Error en CopilotKit runtime' });
    }
  });

  // ========================================
  // MCP ECONOVA - Model Context Protocol para Agente AI
  // ========================================

  // Obtener lista de herramientas MCP disponibles
  app.get("/api/mcp/tools", jwtAuthMiddleware, async (req, res) => {
    try {
      const tools = getAvailableTools();
      res.json({
        success: true,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          category: t.category,
          inputSchema: t.inputSchema,
        })),
        count: tools.length,
      });
    } catch (error) {
      console.error('[MCP] Error obteniendo herramientas:', error);
      res.status(500).json({ success: false, error: 'Error obteniendo herramientas MCP' });
    }
  });

  // Ejecutar una herramienta MCP
  app.post("/api/mcp/execute", jwtAuthMiddleware, async (req: Request, res) => {
    try {
      const { tool_name, params } = req.body;
      const authReq = req as AuthRequest;

      if (!tool_name) {
        return res.status(400).json({ success: false, error: 'tool_name es requerido' });
      }

      // Verificar que la herramienta existe
      const tool = findTool(tool_name);
      if (!tool) {
        return res.status(404).json({ success: false, error: `Herramienta no encontrada: ${tool_name}` });
      }

      // Preparar contexto
      const context = {
        userId: authReq.user?.id?.toString(),
        companyId: authReq.user?.companyId || undefined,
        sessionId: req.headers['x-session-id'] as string || undefined,
      };

      console.log(`[MCP] Ejecutando herramienta: ${tool_name}`, { context });

      // Ejecutar herramienta
      const result = await executeTool(tool_name, params || {}, context);

      res.json(result);
    } catch (error) {
      console.error('[MCP] Error ejecutando herramienta:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Error ejecutando herramienta MCP'
      });
    }
  });

  // Obtener prompt del sistema para Econova
  app.get("/api/mcp/system-prompt", jwtAuthMiddleware, async (req: Request, res) => {
    try {
      const authReq = req as AuthRequest;
      const context = {
        userId: authReq.user?.id?.toString(),
        companyId: authReq.user?.companyId || undefined,
        sessionId: req.headers['x-session-id'] as string || undefined,
      };

      const prompt = generateSystemPrompt(context);
      res.json({ success: true, prompt });
    } catch (error) {
      console.error('[MCP] Error generando prompt:', error);
      res.status(500).json({ success: false, error: 'Error generando prompt del sistema' });
    }
  });

  // ========================================
  // REGISTER CATALOG ROUTES WITH AUTH - VUL-001 fix
  // ========================================
  // IMPORTANTE: Estas rutas REQUIEREN autenticación JWT
  // Deben ir DESPUÉS de las rutas públicas (login, register)
  app.use("/api", jwtAuthMiddleware, catalogRouter);
  // IMPORTANTE: logisticsRouter tiene POST /api/shipments que entra en conflicto
  // con el endpoint principal de shipments en esta misma línea 1949.
  // El endpoint principal usa insertShipmentSchema y maneja items, fechas, etc.
  // El endpoint de logisticsRouter usa createShipmentSchema (schema legacy diferente).
  // Se mantiene montado pero debería deshabilitarse si causa conflictos.
  // app.use("/api", logisticsRouter); // Temporalmente deshabilitado - causa conflictos con POST /api/shipments
  app.use("/api/logistics-legacy", logisticsRouter); // Montado en ruta diferente para evitar conflictos

  // ========================================
  // PRODUCTION DEBUGGING ENDPOINTS (ADMIN ONLY)
  // ========================================
  
  // Health check endpoint - 🔒 Solo administradores
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

      // ✅ FIX BUG #2: Removida la verificación previa de email
      // Confiar en el constraint UNIQUE de la base de datos previene race conditions
      // Si el email ya existe, el error será capturado en el catch de más abajo

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
      const rawCompanyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

      console.log("🔵 [GET /api/kpis] Endpoint llamado");
      console.log(`📊 Usuario: ${user.name}, Company ID: ${rawCompanyId ?? "ALL"}`);

      if (rawCompanyId !== undefined) {
        if (rawCompanyId !== 1 && rawCompanyId !== 2) {
          return res.status(400).json({ error: "Invalid company ID. Use 1 for Dura or 2 for Orsega." });
        }
        const result = await storage.getKpis(rawCompanyId);
        return res.json(result);
      }

      const result = await storage.getKpis();
      res.json(result);
    } catch (error: any) {
      console.error("❌ Error fetching KPIs:", error);
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

      // KPI de Volumen de Ventas de Dura: id 39 por convención
      const MONTHLY_GOAL = 53480; // en KG
      const UNIT = 'KG';
      const monthlyGoalStr = MONTHLY_GOAL.toString();

      const resultById = await sql`
        UPDATE kpis_dura
        SET goal = ${monthlyGoalStr}, unit = ${UNIT}
        WHERE id = 39
        RETURNING id, kpi_name, goal, unit
      `;

      let updatedRows = resultById.length;

      if (updatedRows === 0) {
        const resultByName = await sql`
          UPDATE kpis_dura
          SET goal = ${monthlyGoalStr}, unit = ${UNIT}
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
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de KPI inválido" });
      }

      let companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

      // Si no se proporciona companyId, intentar encontrarlo automáticamente
      if (!companyId || (companyId !== 1 && companyId !== 2)) {
        console.log(`[GET /api/kpis/${id}] companyId no proporcionado, buscando automáticamente...`);
        // Buscar en todas las empresas
        const duraKpi = await storage.getKpi(id, 1);
        const orsegaKpi = await storage.getKpi(id, 2);
        
        if (duraKpi) {
          companyId = 1;
        } else if (orsegaKpi) {
          companyId = 2;
        } else {
          // Si no se encuentra en ninguna tabla, intentar buscar en la lista de todos los KPIs
          const allKpis = await storage.getKpis();
          const match = allKpis.find((item) => item.id === id);
          if (match) {
            companyId = match.companyId ?? undefined;
          }
        }
      }

      if (!companyId || (companyId !== 1 && companyId !== 2)) {
        return res.status(404).json({ message: "KPI not found" });
      }

      const kpi = await storage.getKpi(id, companyId);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }

      // Asegurar que el companyId esté presente en la respuesta
      const kpiResponse = {
        ...kpi,
        companyId: kpi.companyId ?? companyId, // Asegurar que companyId esté presente
        isLowerBetter: isLowerBetterKPI(kpi.name || ""),
      };

      console.log(`[GET /api/kpis/${id}] KPI encontrado:`, { id: kpiResponse.id, name: kpiResponse.name, companyId: kpiResponse.companyId });
      res.json(kpiResponse);
    } catch (error) {
      console.error(`[GET /api/kpis/${req.params.id}] Error:`, error);
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
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
      
      // VUL-001: Validar acceso multi-tenant
      if (validatedData.companyId) {
        validateTenantAccess(req as AuthRequest, validatedData.companyId);
      }
      
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
    // Parse ID outside try block to make it available in catch block
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de KPI inválido" });
    }

    try {
      const authReq = req as AuthRequest;

      // 🔒 SEGURO: Solo administradores y gerentes pueden actualizar KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para actualizar KPIs" });
      }

      // Intentar obtener companyId del body, query, o buscarlo automáticamente
      let companyId: number | undefined;
      const bodyCompanyId = req.body?.companyId;
      const queryCompanyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      
      if (bodyCompanyId !== undefined && bodyCompanyId !== null) {
        companyId = typeof bodyCompanyId === 'string' ? parseInt(bodyCompanyId, 10) : bodyCompanyId;
      } else if (queryCompanyId !== undefined) {
        companyId = queryCompanyId;
      } else {
        // Si no se proporciona, intentar encontrarlo automáticamente
        console.log(`[PUT /api/kpis/${id}] companyId no proporcionado, buscando automáticamente...`);
        // El storage.updateKpi intentará encontrarlo automáticamente
      }

      // Validar companyId solo si se proporcionó (si no, se buscará automáticamente)
      if (companyId !== undefined && companyId !== null) {
        if (companyId !== 1 && companyId !== 2) {
          return res.status(400).json({ message: "companyId debe ser 1 (Dura) o 2 (Orsega)" });
        }
      }

      const validatedData = updateKpiSchema.parse({
        ...req.body,
        companyId: companyId,
      });
      
      console.log(`[PUT /api/kpis/${id}] Datos validados:`, validatedData);
      
      // Actualizar el KPI - esto intentará encontrar companyId si no se proporcionó
      const kpi = await storage.updateKpi(id, validatedData);
      
      if (!kpi) {
        return res.status(404).json({ message: "KPI no encontrado o no se pudo actualizar" });
      }

      // Obtener el companyId real del KPI actualizado para validar acceso
      const finalCompanyId = kpi.companyId ?? companyId;
      
      // VUL-001: Validar acceso multi-tenant (después de obtener el companyId real)
      if (finalCompanyId) {
        try {
          validateTenantAccess(req as AuthRequest, finalCompanyId);
        } catch (tenantError) {
          console.error(`[PUT /api/kpis/${id}] Error de validación de tenant:`, tenantError);
          return res.status(403).json({ 
            message: tenantError instanceof Error ? tenantError.message : "Acceso denegado",
            code: 'TENANT_ACCESS_DENIED'
          });
        }
      }
      
      console.log(`[PUT /api/kpis/${id}] KPI actualizado exitosamente:`, kpi.id);
      res.json(kpi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[PUT /api/kpis/${id}] Error de validación:`, error.errors);
        return res.status(400).json({ message: "Error de validación", errors: error.errors });
      }
      if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('Access denied'))) {
        console.error(`[PUT /api/kpis/${id}] Error de acceso:`, error.message);
        return res.status(403).json({ message: error.message });
      }
      // Capturar errores de DatabaseStorage que pueden lanzarse
      if (error instanceof Error && (error.message.includes('No se pudo determinar') || error.message.includes('no encontrado'))) {
        console.error(`[PUT /api/kpis/${id}] Error al encontrar KPI:`, error.message);
        return res.status(404).json({ message: error.message });
      }
      console.error(`[PUT /api/kpis/${id}] Error interno:`, error);
      console.error(`[PUT /api/kpis/${id}] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      // 🔒 SEGURO: Solo administradores y gerentes pueden eliminar KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para eliminar KPIs" });
      }
      
      const id = parseInt(req.params.id, 10);
      let companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

      if (!companyId || (companyId !== 1 && companyId !== 2)) {
      const allKpis = await storage.getKpis();
      const match = allKpis.find((item) => item.id === id);
      if (!match) {
        return res.status(404).json({ message: "KPI not found" });
      }
      companyId = match.companyId ?? undefined;
    }

    // VUL-001: Validar acceso multi-tenant
    if (companyId) {
      validateTenantAccess(req as AuthRequest, companyId);
    }

    const success = companyId ? await storage.deleteKpi(id, companyId) : false;
      
      if (!success) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      res.json({ message: "KPI eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PATCH /api/kpis/:id/transfer - Transferir un KPI a otra persona
  app.patch("/api/kpis/:id/transfer", jwtAuthMiddleware, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID de KPI inválido" });
    }

    try {
      const authReq = req as AuthRequest;

      // 🔒 SEGURO: Solo administradores y gerentes pueden transferir KPIs
      if (authReq.user?.role !== 'admin' && authReq.user?.role !== 'manager') {
        return res.status(403).json({ message: "No tienes permisos para transferir KPIs" });
      }

      const { responsible, companyId: bodyCompanyId } = req.body;

      if (!responsible || typeof responsible !== 'string') {
        return res.status(400).json({ message: "El campo 'responsible' es requerido y debe ser una cadena de texto" });
      }

      // Determinar companyId del body o buscando el KPI
      let companyId: number | undefined;
      if (bodyCompanyId !== undefined && bodyCompanyId !== null) {
        companyId = typeof bodyCompanyId === 'string' ? parseInt(bodyCompanyId, 10) : bodyCompanyId;
      } else {
        // Si no se proporciona, buscar el KPI para obtener su companyId
        console.log(`[PATCH /api/kpis/${id}/transfer] companyId no proporcionado, buscando automáticamente...`);
        const allKpis = await storage.getKpis();
        const match = allKpis.find((item) => item.id === id);
        if (match) {
          companyId = match.companyId ?? undefined;
        }
      }

      if (companyId !== undefined && companyId !== null && companyId !== 1 && companyId !== 2) {
        return res.status(400).json({ message: "companyId debe ser 1 (Dura) o 2 (Orsega)" });
      }

      // VUL-001: Validar acceso multi-tenant
      if (companyId) {
        try {
          validateTenantAccess(req as AuthRequest, companyId);
        } catch (tenantError) {
          console.error(`[PATCH /api/kpis/${id}/transfer] Error de validación de tenant:`, tenantError);
          return res.status(403).json({
            message: tenantError instanceof Error ? tenantError.message : "Acceso denegado",
            code: 'TENANT_ACCESS_DENIED'
          });
        }
      }

      const kpi = await storage.updateKpi(id, { responsible, companyId });

      if (!kpi) {
        return res.status(404).json({ message: "KPI no encontrado o no se pudo transferir" });
      }

      console.log(`[PATCH /api/kpis/${id}/transfer] KPI transferido exitosamente a "${responsible}" por usuario ${authReq.user?.name} (role: ${authReq.user?.role})`);
      res.json(kpi);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('Access denied'))) {
        console.error(`[PATCH /api/kpis/${id}/transfer] Error de acceso:`, error.message);
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof Error && (error.message.includes('No se pudo determinar') || error.message.includes('no encontrado'))) {
        console.error(`[PATCH /api/kpis/${id}/transfer] Error al encontrar KPI:`, error.message);
        return res.status(404).json({ message: error.message });
      }
      console.error(`[PATCH /api/kpis/${id}/transfer] Error interno:`, error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });


  // GET /api/kpis-by-user/:userId - Obtener KPIs específicos de un usuario
  app.get("/api/kpis-by-user/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      console.log(`🔵 [GET /api/kpis-by-user/${userId}] Endpoint llamado`);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userKpis = await storage.getUserKpis(userId);
      const aggregated: any[] = [];
      aggregated.push(...userKpis);

      if (aggregated.length === 0) {
        const companiesToCheck = user.companyId ? [user.companyId] : [1, 2];
        const responsibleKey = (user.name?.split(' ')[0] || '').toLowerCase();

        for (const companyId of companiesToCheck) {
          if (companyId !== 1 && companyId !== 2) continue;
          const kpisByCompany = await storage.getKpis(companyId);
          const matches = kpisByCompany.filter((kpi) =>
            (kpi.responsible ?? '').toLowerCase().includes(responsibleKey)
          );
          aggregated.push(...matches);
        }
      }

      const deduped = Array.from(new Map(aggregated.map((kpi) => [kpi.id, kpi])).values());

      console.log(`📊 [GET /api/kpis-by-user/${userId}] Retornando ${deduped.length} KPIs para ${user.name}`);
      res.json(deduped);
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
      const kpiId = parseInt(req.params.kpiId, 10);
      const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      const companyId = companyIdParam ?? user.companyId ?? null;

      if (!companyId || (companyId !== 1 && companyId !== 2)) {
        return res.status(400).json({ message: "companyId query param es requerido (1=Dura, 2=Orsega)" });
      }

      const kpi = await storage.getKpi(kpiId, companyId);

      res.json({
        message: "Los KPIs se gestionan a nivel de compañía; no existen valores específicos por usuario que eliminar en este esquema.",
      });
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
      const parsedCompanyId = companyId ? parseInt(companyId as string, 10) : NaN;

      if (parsedCompanyId !== 1 && parsedCompanyId !== 2) {
        return res.status(400).json({ message: 'companyId es requerido (1=Dura, 2=Orsega)' });
      }

      const [areasList, kpis, values] = await Promise.all([
        storage.getAreasByCompany(parsedCompanyId),
        storage.getKpis(parsedCompanyId),
        storage.getKpiValues(parsedCompanyId),
      ]);

      const areaById = new Map(areasList.map((area) => [area.id, area]));
      const stats = new Map<number, { areaId: number; areaName: string; total: number; compliant: number }>();

      const valuesByKpi = new Map<number, any[]>();
      for (const value of values) {
        if (!valuesByKpi.has(value.kpiId)) {
          valuesByKpi.set(value.kpiId, []);
        }
        valuesByKpi.get(value.kpiId)!.push(value);
      }

      for (const valueList of valuesByKpi.values()) {
        valueList.sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        });
      }

      for (const kpi of kpis) {
        if (!kpi.areaId) continue;
        const area = areaById.get(kpi.areaId);
        if (!area) continue;

        if (!stats.has(area.id)) {
          stats.set(area.id, { areaId: area.id, areaName: area.name, total: 0, compliant: 0 });
        }

        const areaStats = stats.get(area.id)!;
        areaStats.total += 1;

        const latest = valuesByKpi.get(kpi.id)?.[0];
        if (latest?.status === 'complies') {
          areaStats.compliant += 1;
        }
      }

      const response = Array.from(stats.values())
        .map((stat) => {
          const compliance = stat.total === 0 ? 0 : (stat.compliant * 100) / stat.total;
          return {
            area_name: stat.areaName,
            area_id: stat.areaId,
            total_kpis: stat.total,
            compliant_kpis: stat.compliant,
            compliance_percentage: Number(compliance.toFixed(2)),
          };
        })
        .sort((a, b) => {
          if (b.compliance_percentage === a.compliance_percentage) {
            return b.total_kpis - a.total_kpis;
          }
          return b.compliance_percentage - a.compliance_percentage;
        })
        .slice(0, 5);

      res.json(response);
    } catch (error) {
      console.error('Error fetching top performers:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });


  app.get("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      if (companyIdParam !== undefined && companyIdParam !== 1 && companyIdParam !== 2) {
        return res.status(400).json({ error: "companyId query param inválido (1=Dura, 2=Orsega)" });
      }

      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId as string, 10);
        let kpi: Kpi | undefined;
        let resolvedCompanyId: number;
        
        if (companyIdParam !== undefined) {
          kpi = await storage.getKpi(kpiId, companyIdParam);
          if (!kpi) {
            return res.status(404).json({ message: "KPI not found for this company" });
          }
          resolvedCompanyId = companyIdParam;
        } else {
          const allKpis = await storage.getKpis();
          const match = allKpis.find((item) => item.id === kpiId);
          if (!match?.companyId) {
            return res.status(404).json({ message: "KPI not found" });
          }
          kpi = match;
          resolvedCompanyId = match.companyId;
        }

        // Si es un KPI de ventas, calcular valor en tiempo real desde sales_data
        const kpiName = kpi.name || '';
        if (storage.isSalesKpi(kpiName)) {
          console.log(`[GET /api/kpi-values] KPI de ventas detectado: ${kpiName}, calculando desde sales_data`);
          
          // Obtener período si se especifica en query params
          const year = req.query.year ? parseInt(req.query.year as string) : undefined;
          const month = req.query.month ? parseInt(req.query.month as string) : undefined;
          
          // Calcular valor en tiempo real
          const calculatedValue = await calculateSalesKpiValue(kpiName, resolvedCompanyId, { year, month });
          
          if (calculatedValue) {
            // Obtener historial si se solicita
            const includeHistory = req.query.history === 'true';
            let history: Array<{ period: string; value: number; date: Date }> = [];
            
            if (includeHistory) {
              history = await calculateSalesKpiHistory(kpiName, resolvedCompanyId, 12);
            }
            
            // Formatear respuesta en el formato esperado por KpiValue
            const now = new Date();
            const periodString = year && month 
              ? `${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][month - 1]} ${year}`
              : `${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][now.getMonth()]} ${now.getFullYear()}`;
            
            // Calcular compliance y status usando funciones centralizadas de @shared/kpi-utils
            let compliancePercentage: string | null = null;
            let status: string | null = null;

            if (kpi.target || kpi.goal) {
              const targetReference = kpi.target || kpi.goal;
              const kpiNameForCalc = kpi.name || kpiName || '';
              status = calculateKpiStatus(calculatedValue.value, targetReference, kpiNameForCalc);
              compliancePercentage = calculateCompliance(calculatedValue.value, targetReference, kpiNameForCalc);
            }
            
            const kpiValue = {
              id: 0, // Valor calculado, no tiene ID en BD
              kpiId: kpiId,
              companyId: resolvedCompanyId,
              value: calculatedValue.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
              period: periodString,
              month: month?.toString() || (now.getMonth() + 1).toString(),
              year: year || now.getFullYear(),
              date: now,
              compliancePercentage,
              status,
              comments: 'Valor calculado en tiempo real desde sales_data',
              updatedBy: null
            };
            
            // Si hay historial, incluir también esos valores
            if (includeHistory && history.length > 0) {
              const historyValues = history.map((h, idx) => ({
                id: -(idx + 1), // IDs negativos para valores históricos calculados
                kpiId: kpiId,
                companyId: resolvedCompanyId,
                value: h.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
                period: h.period,
                month: (h.date.getMonth() + 1).toString(),
                year: h.date.getFullYear(),
                date: h.date,
                compliancePercentage: null,
                status: null,
                comments: 'Valor histórico calculado desde sales_data',
                updatedBy: null
              }));
              
              return res.json([kpiValue, ...historyValues]);
            }
            
            return res.json([kpiValue]);
          }
        }
        
        // Si no es KPI de ventas, usar lógica tradicional
        const kpiValues = await storage.getKpiValuesByKpi(kpiId, resolvedCompanyId);
        return res.json(kpiValues);
      }

      // Cuando se consultan todos los valores, calcular en tiempo real los de ventas
      const allValues = await storage.getKpiValues(companyIdParam);
      const allKpis = await storage.getKpis();
      
      // Filtrar KPIs de ventas y calcular sus valores en tiempo real
      const salesKpis = allKpis.filter(kpi => {
        const kpiName = kpi.name || '';
        return storage.isSalesKpi(kpiName);
      });
      
      // Reemplazar valores de KPIs de ventas con valores calculados en tiempo real
      const updatedValues = await Promise.all(
        allValues.map(async (value) => {
          const kpi = salesKpis.find(k => k.id === value.kpiId);
          if (kpi) {
            const kpiName = kpi.name || '';
            const calculatedValue = await calculateSalesKpiValue(
              kpiName,
              value.companyId,
              value.year && value.month ? { year: value.year, month: parseInt(value.month) } : undefined
            );
            
            if (calculatedValue) {
              return {
                ...value,
                value: calculatedValue.value.toString() + (calculatedValue.unit ? ` ${calculatedValue.unit}` : ''),
                comments: value.comments || 'Valor calculado en tiempo real desde sales_data'
              };
            }
          }
          return value;
        })
      );
      
      console.log(`[GET /api/kpi-values] Retornando ${updatedValues.length} valores para companyId=${companyIdParam ?? 'ALL'} (${salesKpis.length} KPIs de ventas calculados en tiempo real)`);
      res.json(updatedValues);
    } catch (error) {
      console.error("[GET /api/kpi-values] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper function: Calcular fecha de inicio del período anterior según frecuencia
  const getPreviousPeriodStart = (frequency: string | null, referenceDate: Date = new Date()): Date => {
    const date = new Date(referenceDate);
    switch (frequency?.toLowerCase()) {
      case 'daily':
        date.setDate(date.getDate() - 1);
        date.setHours(0, 0, 0, 0);
        return date;
      case 'weekly':
        date.setDate(date.getDate() - 7);
        date.setHours(0, 0, 0, 0);
        return date;
      case 'monthly':
        date.setMonth(date.getMonth() - 1);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
      default:
        // Default a monthly si no se especifica
        date.setMonth(date.getMonth() - 1);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date;
    }
  };

  // Helper function: Obtener texto del período de comparación
  const getPeriodText = (frequency: string | null): string => {
    switch (frequency?.toLowerCase()) {
      case 'daily':
        return 'vs día anterior';
      case 'weekly':
        return 'vs semana pasada';
      case 'monthly':
        return 'vs mes anterior';
      default:
        return 'vs período anterior';
    }
  };

  // Helper function: Calcular score para un conjunto de KPIs
  const calculateScore = (kpisWithData: any[]): number => {
    const totalKpis = kpisWithData.length;
    const kpisWithValues = kpisWithData.filter(k => k.latestValue);
    const compliantKpis = kpisWithData.filter(k => k.status === 'complies').length;

    const averageCompliance = kpisWithValues.length > 0
      ? kpisWithData.reduce((sum, k) => sum + k.compliance, 0) / kpisWithValues.length
      : 0;

    const compliantPercentage = totalKpis > 0 ? (compliantKpis / totalKpis) * 100 : 0;
    const updateScore = totalKpis > 0 ? (kpisWithValues.length / totalKpis) * 100 : 0;

    return (averageCompliance * 0.5) + (compliantPercentage * 0.3) + (updateScore * 0.2);
  };

  // Helper function: Rellenar meses faltantes con valores null
  const fillMissingMonths = (data: Array<{ month: string; compliance: number | null }>, monthsCount: number = 12): Array<{ month: string; compliance: number | null }> => {
    const today = new Date();
    const allMonths: Array<{ month: string; compliance: number | null }> = [];

    // Generar array de los últimos N meses
    for (let i = monthsCount - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toISOString().substring(0, 7); // YYYY-MM

      // Buscar si existe data para este mes
      const existing = data.find(d => d.month === monthStr);
      allMonths.push({
        month: monthStr,
        compliance: existing?.compliance ?? null
      });
    }

    return allMonths;
  };

  // Helper function: Calcular tendencia avanzada con regresión lineal
  const calculateAdvancedTrend = (data: Array<{ month: string; compliance: number | null }>): {
    direction: 'up' | 'down' | 'stable' | null;
    strength: number; // 0-100, qué tan fuerte es la tendencia
    slope: number; // pendiente de la regresión
    r2: number; // coeficiente de determinación (0-1)
  } => {
    // Filtrar solo valores no nulos
    const validData = data
      .map((d, idx) => ({ x: idx, y: d.compliance }))
      .filter(d => d.y !== null) as Array<{ x: number; y: number }>;

    if (validData.length < 3) {
      return { direction: null, strength: 0, slope: 0, r2: 0 };
    }

    // Calcular regresión lineal (y = mx + b)
    const n = validData.length;
    const sumX = validData.reduce((sum, d) => sum + d.x, 0);
    const sumY = validData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = validData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = validData.reduce((sum, d) => sum + d.x * d.x, 0);
    const sumY2 = validData.reduce((sum, d) => sum + d.y * d.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calcular R² (coeficiente de determinación)
    const yMean = sumY / n;
    const ssTotal = validData.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
    const ssResidual = validData.reduce((sum, d) => {
      const predicted = slope * d.x + intercept;
      return sum + Math.pow(d.y - predicted, 2);
    }, 0);
    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Determinar dirección y fuerza
    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.5) { // Umbral: cambio > 0.5% por mes
      direction = slope > 0 ? 'up' : 'down';
    }

    // Strength: combinación de pendiente absoluta y R²
    // Normalizar slope a un rango 0-100 (asumiendo max cambio razonable de ±10% por mes)
    const normalizedSlope = Math.min(Math.abs(slope) / 10 * 100, 100);
    const strength = Math.round(normalizedSlope * r2); // Ajustar por qué tan bien se ajusta a la línea

    return {
      direction,
      strength,
      slope: Math.round(slope * 100) / 100,
      r2: Math.round(r2 * 100) / 100
    };
  };

  // GET /api/collaborators-performance - Obtener rendimiento agrupado por colaborador
  app.get("/api/collaborators-performance", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;
      if (companyIdParam !== undefined && companyIdParam !== 1 && companyIdParam !== 2) {
        return res.status(400).json({ error: "companyId query param inválido (1=Dura, 2=Orsega)" });
      }

      console.log(`🔵 [GET /api/collaborators-performance] Endpoint llamado para companyId=${companyIdParam ?? 'ALL'}`);

      // 🚀 OPTIMIZATION: Check cache first
      const cacheKey = `collaborators-performance-${companyIdParam ?? 'ALL'}`;
      const cachedData = collaboratorPerformanceCache.get(cacheKey);
      if (cachedData) {
        console.log(`⚡ [GET /api/collaborators-performance] Retornando datos desde cache`);
        return res.json(cachedData);
      }

      // Obtener KPIs y valores
      const [kpis, kpiValues] = await Promise.all([
        storage.getKpis(companyIdParam),
        storage.getKpiValues(companyIdParam)
      ]);

      // Agrupar KPIs por responsable
      const collaboratorsMap = new Map<string, {
        name: string;
        kpis: any[];
        kpiValues: any[];
      }>();

      // Agrupar KPIs por responsable (solo si está definido y no vacío)
      kpis.forEach((kpi: any) => {
        const responsible = kpi.responsible?.trim();
        if (!responsible || responsible === '') return; // Validación estricta: debe estar definido y no vacío

        if (!collaboratorsMap.has(responsible)) {
          collaboratorsMap.set(responsible, {
            name: responsible,
            kpis: [],
            kpiValues: []
          });
        }

        collaboratorsMap.get(responsible)!.kpis.push(kpi);
      });

      // Agrupar valores por KPI para acceso rápido
      const valuesByKpiId = new Map<number, any[]>();
      kpiValues.forEach((value: any) => {
        if (!valuesByKpiId.has(value.kpiId)) {
          valuesByKpiId.set(value.kpiId, []);
        }
        valuesByKpiId.get(value.kpiId)!.push(value);
      });

      // Ordenar valores por fecha (más reciente primero) para cada KPI
      valuesByKpiId.forEach((values) => {
        values.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
      });

      // Calcular métricas para cada colaborador
      const collaborators = Array.from(collaboratorsMap.values()).map((collab) => {
        const kpisWithData = collab.kpis.map((kpi: any) => {
          const values = valuesByKpiId.get(kpi.id) || [];
          const latestValue = values[0] || null;
          
          // Obtener valor del período anterior
          const frequency = kpi.frequency || 'monthly';
          const previousPeriodStart = getPreviousPeriodStart(frequency, latestValue?.date ? new Date(latestValue.date) : new Date());
          
          // Buscar el último valor del período anterior
          let previousValue = null;
          if (latestValue?.date) {
            const latestDate = new Date(latestValue.date);
            previousValue = values.find((v: any) => {
              if (!v.date) return false;
              const vDate = new Date(v.date);
              return vDate < latestDate && vDate >= previousPeriodStart;
            });
          }

          // Calcular compliance usando funciones centralizadas de @shared/kpi-utils
          let compliance = latestValue
            ? parseFloat(latestValue.compliancePercentage?.toString().replace('%', '') || '0')
            : 0;

          // Si no hay compliancePercentage o es 0, calcularlo con funciones centralizadas
          if (compliance === 0 && latestValue && (kpi.target || kpi.goal)) {
            const targetReference = kpi.target || kpi.goal;
            const complianceStr = calculateCompliance(latestValue.value, targetReference, kpi.name || "");
            compliance = parseFloat(complianceStr.replace('%', '')) || 0;
          }

          // Determinar status usando funciones centralizadas
          let status = latestValue?.status || 'not_compliant';
          if (!latestValue?.status || latestValue.status === 'null' || latestValue.status === null) {
            if (latestValue && (kpi.target || kpi.goal)) {
              const targetReference = kpi.target || kpi.goal;
              status = calculateKpiStatus(latestValue.value, targetReference, kpi.name || "");
            }
          }

          let previousCompliance = previousValue
            ? parseFloat(previousValue.compliancePercentage?.toString().replace('%', '') || '0')
            : null;

          // Si previousCompliance es 0, calcularlo con funciones centralizadas
          if (previousCompliance === 0 && previousValue && (kpi.target || kpi.goal)) {
            const targetReference = kpi.target || kpi.goal;
            const prevCompStr = calculateCompliance(previousValue.value, targetReference, kpi.name || "");
            previousCompliance = parseFloat(prevCompStr.replace('%', '')) || 0;
          }

          // Calcular tendencia de compliance
          let complianceChange: number | null = null;
          let trendDirection: 'up' | 'down' | 'stable' | null = null;
          
          if (previousCompliance !== null && previousCompliance !== 0) {
            complianceChange = Math.round((compliance - previousCompliance) * 10) / 10;
            if (complianceChange > 0.5) trendDirection = 'up';
            else if (complianceChange < -0.5) trendDirection = 'down';
            else trendDirection = 'stable';
          }

          return {
            ...kpi,
            id: kpi.id,
            companyId: kpi.companyId, // Asegurar que companyId se incluya explícitamente
            latestValue,
            previousValue,
            compliance,
            complianceChange,
            trendDirection,
            status,
            lastUpdate: latestValue?.date || null
          };
        });

        const totalKpis = kpisWithData.length;
        const kpisWithValues = kpisWithData.filter(k => k.latestValue);
        const compliantKpis = kpisWithData.filter(k => k.status === 'complies').length;
        const alertKpis = kpisWithData.filter(k => k.status === 'alert').length;
        const notCompliantKpis = kpisWithData.filter(k => k.status === 'not_compliant').length;

        // Promedio de compliance (solo KPIs con valores)
        const averageCompliance = kpisWithValues.length > 0
          ? kpisWithValues.reduce((sum, k) => sum + k.compliance, 0) / kpisWithValues.length
          : 0;

        // Porcentaje de KPIs cumplidos
        const compliantPercentage = totalKpis > 0 ? (compliantKpis / totalKpis) * 100 : 0;

        // Score: 50% promedio compliance + 30% % cumplidos + 20% actualizaciones
        const updateScore = totalKpis > 0 ? (kpisWithValues.length / totalKpis) * 100 : 0;
        const score = (averageCompliance * 0.5) + (compliantPercentage * 0.3) + (updateScore * 0.2);

        // Calcular score del período anterior para comparación
        // Usar la frecuencia más común de los KPIs del colaborador, o default a monthly
        const frequencies = kpisWithData.map(k => k.frequency || 'monthly');
        const mostCommonFrequency = frequencies.length > 0 
          ? frequencies.sort((a, b) => 
              frequencies.filter(v => v === a).length - frequencies.filter(v => v === b).length
            ).pop() || 'monthly'
          : 'monthly';
        
        const previousPeriodStart = getPreviousPeriodStart(mostCommonFrequency);
        const previousPeriodText = getPeriodText(mostCommonFrequency);

        // Calcular score del período anterior
        const previousKpisWithData = kpisWithData.map((kpi: any) => {
          const values = valuesByKpiId.get(kpi.id) || [];
          const latestDate = kpi.latestValue?.date ? new Date(kpi.latestValue.date) : new Date();
          
          // Buscar el último valor del período anterior para este KPI
          const previousValue = values.find((v: any) => {
            if (!v.date) return false;
            const vDate = new Date(v.date);
            return vDate < latestDate && vDate >= previousPeriodStart;
          });

          if (!previousValue) return null;

          const compliance = parseFloat(previousValue.compliancePercentage?.toString().replace('%', '') || '0');
          const status = previousValue.status || 'not_compliant';

          return {
            ...kpi,
            latestValue: previousValue,
            compliance,
            status,
            lastUpdate: previousValue.date || null
          };
        }).filter(k => k !== null);

        const previousScore = previousKpisWithData.length > 0 
          ? calculateScore(previousKpisWithData)
          : null;

        // Calcular cambio de score
        let scoreChange: number | null = null;
        let scoreTrendDirection: 'up' | 'down' | 'stable' | null = null;
        
        if (previousScore !== null) {
          scoreChange = Math.round(score) - Math.round(previousScore);
          if (scoreChange > 0) scoreTrendDirection = 'up';
          else if (scoreChange < 0) scoreTrendDirection = 'down';
          else scoreTrendDirection = 'stable';
        }

        // Clasificación del estado del colaborador (basado en score promedio)
        // Umbrales alineados con kpi-utils.ts: 100% cumple, 90% alerta, <90% no cumple
        let status: 'excellent' | 'good' | 'regular' | 'critical';
        if (score >= 100) status = 'excellent';
        else if (score >= 90) status = 'good';
        else if (score >= 70) status = 'regular';
        else status = 'critical';

        // Última actualización (más reciente de todos los KPIs)
        const lastUpdate = kpisWithData
          .map(k => k.lastUpdate)
          .filter(d => d !== null)
          .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null;

        return {
          name: collab.name,
          score: Math.round(score),
          status,
          averageCompliance: Math.round(averageCompliance * 10) / 10,
          compliantKpis,
          alertKpis,
          notCompliantKpis,
          totalKpis,
          lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
          scoreChange,
          scoreChangePeriod: previousPeriodText,
          trendDirection: scoreTrendDirection,
          kpis: kpisWithData
        };
      }).sort((a, b) => b.score - a.score); // Ordenar por score descendente

      // Calcular promedio del equipo y tendencia
      const teamScores = collaborators.map(c => c.score);
      const teamAverage = teamScores.length > 0
        ? Math.round(teamScores.reduce((sum, s) => sum + s, 0) / teamScores.length)
        : 0;

      // Calcular tendencia promedio del equipo
      const teamScoreChanges = collaborators
        .map(c => c.scoreChange)
        .filter((change): change is number => change !== null);
      
      const teamTrend = teamScoreChanges.length > 0
        ? Math.round((teamScoreChanges.reduce((sum, c) => sum + c, 0) / teamScoreChanges.length) * 10) / 10
        : null;

      const teamTrendDirection: 'up' | 'down' | 'stable' | null = teamTrend !== null
        ? (teamTrend > 0 ? 'up' : teamTrend < 0 ? 'down' : 'stable')
        : null;

      // Determinar período de comparación del equipo (usar el más común)
      const periods = collaborators
        .map(c => c.scoreChangePeriod)
        .filter((p): p is string => p !== null);
      const mostCommonPeriod = periods.length > 0
        ? periods.sort((a, b) => 
            periods.filter(p => p === a).length - periods.filter(p => p === b).length
          ).pop() || null
        : null;

      console.log(`✅ [GET /api/collaborators-performance] Retornando ${collaborators.length} colaboradores`);

      // 📊 FEATURE: Agregar datos históricos (12 meses) para cada colaborador
      const collaboratorsWithHistory = await Promise.all(collaborators.map(async (collaborator) => {
        try {
          // Obtener KPI IDs de este colaborador
          const kpiIds = collaborator.kpis.map(k => k.id);

          if (kpiIds.length === 0) {
            return {
              ...collaborator,
              historicalCompliance: fillMissingMonths([]),
              advancedTrend: { direction: null, strength: 0, slope: 0, r2: 0 }
            };
          }

          // Query SQL optimizada para obtener 12 meses de datos históricos
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

          // Construir query con placeholders seguros
          const startIdx = companyIdParam ? 3 : 2;
          const placeholders = kpiIds.map((_, idx) => `$${idx + startIdx}`).join(', ');
          const query = `
            SELECT
              TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') as month,
              AVG(
                CASE
                  WHEN "compliancePercentage" IS NOT NULL
                  THEN CAST(REPLACE("compliancePercentage", '%', '') AS DECIMAL)
                  ELSE NULL
                END
              ) as avg_compliance
            FROM "KpiValue"
            WHERE "kpiId" IN (${placeholders})
              AND date >= $1
              ${companyIdParam ? 'AND "companyId" = $2' : ''}
            GROUP BY DATE_TRUNC('month', date)
            ORDER BY month ASC
          `;

          const params = companyIdParam
            ? [twelveMonthsAgo.toISOString(), companyIdParam, ...kpiIds]
            : [twelveMonthsAgo.toISOString(), ...kpiIds];

          const historicalData = await sql(query, params);

          // Transformar y rellenar meses faltantes
          const transformedData = historicalData.map((row: any) => ({
            month: row.month,
            compliance: row.avg_compliance ? parseFloat(row.avg_compliance) : null
          }));

          const completeHistory = fillMissingMonths(transformedData, 12);
          const advancedTrend = calculateAdvancedTrend(completeHistory);

          return {
            ...collaborator,
            historicalCompliance: completeHistory,
            advancedTrend
          };
        } catch (error: any) {
          console.error(`❌ Error fetching historical data for ${collaborator.name}:`, error);
          // ✅ FIX CRÍTICO: Agregar flags de error para notificar al frontend
          return {
            ...collaborator,
            historicalCompliance: fillMissingMonths([]),
            advancedTrend: { direction: null, strength: 0, slope: 0, r2: 0 },
            hasHistoryError: true,
            historyErrorMessage: error.message || 'Error desconocido al cargar historial'
          };
        }
      }));

      // Preparar respuesta
      const responseData = {
        collaborators: collaboratorsWithHistory || [],
        teamAverage,
        teamTrend,
        teamTrendDirection,
        teamTrendPeriod: mostCommonPeriod
      };

      // 🚀 OPTIMIZATION: Cache the result
      collaboratorPerformanceCache.set(cacheKey, responseData);
      console.log(`💾 [GET /api/collaborators-performance] Datos almacenados en cache`);

      // Retornar con metadata del equipo
      res.json(responseData);
    } catch (error: any) {
      console.error("❌ [GET /api/collaborators-performance] Error:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  app.post("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const validatedData = insertKpiValueSchema.parse(req.body);
      let companyId = validatedData.companyId;

      if (!companyId) {
        const allKpis = await storage.getKpis();
        const match = allKpis.find((item: any) => item.id === validatedData.kpiId);
        companyId = match?.companyId ?? undefined;
      }

      if (!companyId) {
        return res.status(400).json({ message: "Debe especificarse companyId (1=Dura, 2=Orsega)" });
      }

      const kpi = await storage.getKpi(validatedData.kpiId, companyId);
      if (!kpi) {
        console.error(`[POST /api/kpi-values] KPI ${validatedData.kpiId} no encontrado para companyId=${companyId}`);
        return res.status(404).json({ message: "KPI not found" });
      }

      const [previous] = await storage.getLatestKpiValues(validatedData.kpiId, 1, companyId);
      let status = validatedData.status ?? null;
      let compliancePercentage = validatedData.compliancePercentage ?? null;

      const targetReference = kpi.target ?? kpi.goal;
      const kpiName = kpi.name || "";
      console.log(`[KPI Update] Calculando estado para KPI ${kpi.id} (${kpiName})`);
      console.log(`[KPI Update] Valor: "${validatedData.value}", Target/Goal: "${targetReference}"`);

      // ✅ Usar funciones centralizadas de @shared/kpi-utils
      // Esto garantiza consistencia entre backend y frontend
      if (targetReference) {
        const numericCurrentValue = parseNumericValue(validatedData.value);
        const numericTarget = parseNumericValue(targetReference);

        console.log(`[KPI Update] Valores numéricos - Actual: ${numericCurrentValue}, Target: ${numericTarget}`);
        console.log(`[KPI Update] ¿Métrica invertida (lower is better)? ${isLowerBetterKPI(kpiName)}`);

        if (!isNaN(numericCurrentValue) && !isNaN(numericTarget)) {
          // Calcular estado y compliance usando funciones centralizadas
          status = calculateKpiStatus(validatedData.value, targetReference, kpiName);
          compliancePercentage = calculateCompliance(validatedData.value, targetReference, kpiName).replace('%', '');

          console.log(`[KPI Update] Estado calculado: ${status}, Compliance: ${compliancePercentage}%`);
        } else {
          console.warn(`[KPI Update] No se pudieron convertir valores a números. Actual: ${numericCurrentValue}, Target: ${numericTarget}`);
          status = status || "alert";
          compliancePercentage = compliancePercentage || "0.0";
        }
      } else {
        console.warn(`[KPI Update] No hay target ni goal definido para KPI ${kpi.id}`);
        status = status || "alert";
        compliancePercentage = compliancePercentage || "0.0";
      }

      // Asegurar que siempre haya valores asignados
      status = status || "alert";
      compliancePercentage = compliancePercentage || "0.0";

      const payload = {
        ...validatedData,
        companyId,
        status,
        compliancePercentage,
        updatedBy: user.id,
      };

      console.log('[POST /api/kpi-values] Creando KPI value con payload:', JSON.stringify(payload, null, 2));
      const kpiValue = await storage.createKpiValue(payload);
      console.log('[POST /api/kpi-values] ✅ KPI value creado exitosamente:', kpiValue.id);

      // Intentar crear notificación de cambio de estado (si aplica)
      if (previous?.status && kpiValue.status && previous.status !== kpiValue.status) {
        try {
          console.log(`[POST /api/kpi-values] Creando notificación de cambio de estado: ${previous.status} → ${kpiValue.status}`);
          await createKPIStatusChangeNotification(kpi, user, previous.status, kpiValue.status, storage);
          console.log('[POST /api/kpi-values] ✅ Notificación creada exitosamente');
        } catch (notifError) {
          // No fallar si la notificación falla, solo loguear
          console.error('[POST /api/kpi-values] ⚠️  Error al crear notificación (no crítico):', notifError);
        }
      }

      res.status(201).json(kpiValue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[POST /api/kpi-values] Validation error:', error.errors);
        return res.status(400).json({ message: error.errors });
      }
      // Log detallado del error para debugging
      console.error('[POST /api/kpi-values] ❌ ERROR CRÍTICO:');
      console.error('[POST /api/kpi-values] Error object:', error);
      console.error('[POST /api/kpi-values] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[POST /api/kpi-values] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[POST /api/kpi-values] Request body:', JSON.stringify(req.body, null, 2));

      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Bulk update KPI values endpoint - Para editar historial completo del año
  app.put("/api/kpi-values/bulk", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const { kpiId, companyId, values } = req.body;

      console.log(`[PUT /api/kpi-values/bulk] Iniciando bulk update para KPI ${kpiId}, companyId: ${companyId}`);
      console.log(`[PUT /api/kpi-values/bulk] Usuario: ${user.id}, Valores recibidos: ${values?.length || 0}`);

      // Validación de entrada
      if (!kpiId || !companyId) {
        console.error(`[PUT /api/kpi-values/bulk] ❌ Faltan parámetros requeridos: kpiId=${kpiId}, companyId=${companyId}`);
        return res.status(400).json({ 
          message: "Se requiere kpiId y companyId" 
        });
      }

      if (!Array.isArray(values)) {
        console.error(`[PUT /api/kpi-values/bulk] ❌ 'values' no es un array:`, typeof values);
        return res.status(400).json({ 
          message: "Se requiere un array de values" 
        });
      }

      if (values.length === 0) {
        console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Array de values está vacío`);
        return res.status(400).json({ 
          message: "El array de values no puede estar vacío" 
        });
      }

      // Obtener KPI
      const kpi = await storage.getKpi(kpiId, companyId);
      if (!kpi) {
        console.error(`[PUT /api/kpi-values/bulk] ❌ KPI ${kpiId} no encontrado para companyId ${companyId}`);
        return res.status(404).json({ message: "KPI not found" });
      }

      console.log(`[PUT /api/kpi-values/bulk] KPI encontrado: "${kpi.name}", target: ${kpi.target || kpi.goal}`);

      const targetReference = kpi.target ?? kpi.goal;
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Procesar cada valor
      for (const item of values) {
        const { month, year, value, comments } = item;
        
        // Validar item
        if (!month || !year || value === undefined || value === null) {
          console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Item inválido, saltando:`, { month, year, value });
          errorCount++;
          results.push({ 
            month: month || 'N/A', 
            year: year || 'N/A', 
            success: false, 
            error: "Datos incompletos: falta month, year o value" 
          });
          continue;
        }

        // Validar que year sea un número
        const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
        if (isNaN(yearNum)) {
          console.warn(`[PUT /api/kpi-values/bulk] ⚠️ Año inválido: ${year}`);
          errorCount++;
          results.push({ month, year, success: false, error: `Año inválido: ${year}` });
          continue;
        }

        let status: string | null = null;
        let compliancePercentage: string | null = null;

        // Calcular status y compliancePercentage usando funciones centralizadas de @shared/kpi-utils
        if (targetReference) {
          try {
            const kpiName = kpi.name || "";
            status = calculateKpiStatus(value, targetReference, kpiName);
            compliancePercentage = calculateCompliance(value, targetReference, kpiName).replace('%', '');
          } catch (calcError: any) {
            console.error(`[PUT /api/kpi-values/bulk] ❌ Error calculando status para ${month} ${year}:`, calcError);
            status = "alert";
            compliancePercentage = "0.0";
          }
        } else {
          console.warn(`[PUT /api/kpi-values/bulk] ⚠️ KPI ${kpiId} no tiene target/goal definido`);
          status = "alert";
          compliancePercentage = "0.0";
        }

        // Guardar valor
        try {
          console.log(`[PUT /api/kpi-values/bulk] Guardando ${month} ${yearNum}: value="${value}", status=${status}, compliance=${compliancePercentage}`);
          console.log(`[PUT /api/kpi-values/bulk] Datos completos:`, {
            kpiId,
            companyId,
            month,
            year: yearNum,
            value: value.toString(),
            period: `${month} ${yearNum}`
          });
          
          const kpiValue = await storage.createKpiValue({
            kpiId,
            companyId, // ✅ Asegurar que companyId se pasa explícitamente
            value: value.toString(),
            month,
            year: yearNum,
            period: `${month} ${yearNum}`,
            status,
            compliancePercentage,
            comments: comments || null,
            updatedBy: user.id,
          });

          successCount++;
          results.push({ month, year: yearNum, success: true, kpiValue });
          console.log(`[PUT /api/kpi-values/bulk] ✅ Guardado exitoso: ${month} ${yearNum} (ID: ${kpiValue.id})`);
        } catch (error: any) {
          errorCount++;
          console.error(`[PUT /api/kpi-values/bulk] ❌ Error guardando ${month} ${yearNum}:`, error);
          console.error(`[PUT /api/kpi-values/bulk] Detalles del error:`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail,
            hint: error.hint
          });
          results.push({ 
            month, 
            year: yearNum, 
            success: false, 
            error: error.message || "Error desconocido al guardar" 
          });
        }
      }

      const summary = {
        success: true,
        total: values.length,
        successful: successCount,
        failed: errorCount,
        message: `Se actualizaron ${successCount} de ${values.length} valores${errorCount > 0 ? ` (${errorCount} fallaron)` : ''}`,
        results
      };

      console.log(`[PUT /api/kpi-values/bulk] ✅ Bulk update completado:`, summary);
      
      res.json(summary);
    } catch (error: any) {
      console.error('[PUT /api/kpi-values/bulk] ❌ Error general en bulk update:', error);
      console.error('[PUT /api/kpi-values/bulk] Stack trace:', error.stack);
      res.status(500).json({ 
        message: "Internal server error",
        error: error.message 
      });
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
          const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? salesData.companyId);
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

      const numericCompanyId = Number(companyId);
      const numericYear = Number(year);

      if (!value || isNaN(numericCompanyId) || !month || isNaN(numericYear)) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos requeridos: valor, compañía, mes y año"
        });
      }

      if (numericCompanyId !== 1 && numericCompanyId !== 2) {
        return res.status(400).json({
          success: false,
          message: "companyId debe ser 1 (Dura) o 2 (Orsega)"
        });
      }

      // Buscar el KPI de ventas por nombre en lugar de usar ID hardcodeado
      const allKpis = await storage.getKpis(numericCompanyId);
      const salesKpi = allKpis.find((kpi: any) => {
        const name = (kpi.name || kpi.kpiName || '').toLowerCase();
        return (name.includes('volumen') && name.includes('ventas')) || 
               name.includes('ventas') || 
               name.includes('sales');
      });

      if (!salesKpi) {
        console.error(`[POST /api/sales/update-month] ❌ KPI de ventas no encontrado para companyId ${numericCompanyId}`);
        return res.status(404).json({
          success: false,
          message: `KPI de ventas no encontrado. Por favor, verifica que el KPI de ventas esté configurado para ${numericCompanyId === 1 ? 'Dura International' : 'Grupo Orsega'}.`
        });
      }

      const kpiId = salesKpi.id;
      const periodString = period || `${month} ${numericYear}`;

      console.log(`[POST /api/sales/update-month] KPI encontrado: ID ${kpiId}, nombre "${salesKpi.name}" para companyId ${numericCompanyId}`);
      console.log(`[POST /api/sales/update-month] Actualizando para período: ${periodString}`);

      const createdValue = await storage.createKpiValue({
        companyId: numericCompanyId,
        kpiId,
        value: value.toString(),
        period: periodString,
        month,
        year: numericYear,
        updatedBy: user.id,
      });

      // Calcular monthlyTarget desde annualGoal del KPI (NO hardcodeado)
      let monthlyTarget: number;
      if (salesKpi.annualGoal) {
        // Prioridad 1: Usar annualGoal del KPI
        const annualGoal = parseFloat(String(salesKpi.annualGoal).toString().replace(/[^0-9.-]+/g, ''));
        if (!isNaN(annualGoal) && annualGoal > 0) {
          monthlyTarget = Math.round(annualGoal / 12);
          console.log(`[POST /api/sales/update-month] ✅ Usando annualGoal del KPI: ${annualGoal} → monthlyTarget: ${monthlyTarget}`);
        } else {
          // Fallback a goal mensual * 12 / 12 = goal mensual
          const goalValue = parseFloat(String(salesKpi.goal || '').toString().replace(/[^0-9.-]+/g, ''));
          monthlyTarget = !isNaN(goalValue) && goalValue > 0 ? Math.round(goalValue) : (numericCompanyId === 1 ? 55620 : 858373);
        }
      } else {
        // Prioridad 2: Calcular desde goal mensual del KPI
        const goalValue = parseFloat(String(salesKpi.goal || '').toString().replace(/[^0-9.-]+/g, ''));
        monthlyTarget = !isNaN(goalValue) && goalValue > 0 ? Math.round(goalValue) : (numericCompanyId === 1 ? 55620 : 858373);
      }
      
      const numericValue = parseNumericValue(value);
      const compliance = isNaN(numericValue)
        ? null
        : Math.round((numericValue / monthlyTarget) * 100);

      res.status(200).json({
        success: true,
        message: `Ventas de ${periodString} actualizadas correctamente`,
        data: {
          period: periodString,
          value,
          monthlyTarget,
          compliance,
          record: createdValue,
          kpiId: kpiId, // Incluir el KPI ID en la respuesta para invalidación correcta
          companyId: numericCompanyId,
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
      const existingKpiValues = await storage.getKpiValuesByKpi(
        volumeKpi.id,
        volumeKpi.companyId ?? parseInt(companyId)
      );
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
      const kpiValues = await storage.getKpiValuesByKpi(
        volumeKpi.id,
        volumeKpi.companyId ?? parseInt(companyId as string)
      );
      const monthlyRecord = kpiValues.find(value => 
        value.period === targetPeriod && !value.period.includes('Semana')
      );
      
      const weeklyRecords = kpiValues.filter(value =>
        value.period?.includes(month as string) &&
        value.period?.includes(year as string) &&
        value.period?.includes("Semana")
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
      
      // VUL-001: Validar acceso multi-tenant
      if (validatedData.companyId) {
        validateTenantAccess(req as AuthRequest, validatedData.companyId);
      }
      
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

      // KPIs de Logística: Capturar timestamps automáticamente según el estado
      if (validatedData.status === 'in_transit' && !shipment.inRouteAt) {
        updateData.inRouteAt = new Date();
        console.log(`[KPI Logística] Capturando timestamp inRouteAt para shipment ${shipmentId}`);
      }

      if (validatedData.status === 'delivered' && !shipment.deliveredAt) {
        const deliveryDate = new Date();
        updateData.deliveredAt = deliveryDate;
        updateData.actualDeliveryDate = deliveryDate;
        console.log(`[KPI Logística] Capturando timestamp deliveredAt y actualDeliveryDate para shipment ${shipmentId}`);
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

      // KPIs de Logística: Actualizar automáticamente cuando se marca como entregado
      if (validatedData.status === 'delivered' && statusChanged) {
        try {
          await updateLogisticsKPIs(updatedShipment.companyId);
          console.log(`[KPI Logística] KPIs actualizados automáticamente para company ${updatedShipment.companyId}`);
        } catch (kpiError) {
          console.error(`[KPI Logística] Error actualizando KPIs:`, kpiError);
          // Don't fail the status update for a KPI calculation error
        }
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
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined;

      // ========================================================================
      // DATOS HARDCODEADOS TEMPORALES - PARA PRESENTACIÓN
      // TODO: ELIMINAR ESTE BLOQUE CUANDO SE ARREGLE LA FUNCIÓN DE ACTUALIZAR VENTAS
      // ========================================================================
      const HARDCODED_SALES_DATA_ENABLED = false; // DESACTIVADO - Datos reales en tabla ventas

      if (HARDCODED_SALES_DATA_ENABLED && (companyId === 1 || companyId === 2)) {
        console.log(`[GET /api/kpi-history/:kpiId] ⚠️ USANDO DATOS HARDCODEADOS para companyId=${companyId}`);

        // DURA (companyId=1) - Kilogramos 2024 y 2025
        const duraHardcodedData = [
          // 2024
          { period: "Enero 2024", value: "46407.17", date: "2024-01-15", year: 2024 },
          { period: "Febrero 2024", value: "54955.17", date: "2024-02-15", year: 2024 },
          { period: "Marzo 2024", value: "58170.41", date: "2024-03-15", year: 2024 },
          { period: "Abril 2024", value: "51814.50", date: "2024-04-15", year: 2024 },
          { period: "Mayo 2024", value: "56757.88", date: "2024-05-15", year: 2024 },
          { period: "Junio 2024", value: "45015.50", date: "2024-06-15", year: 2024 },
          { period: "Julio 2024", value: "67090.00", date: "2024-07-15", year: 2024 },
          { period: "Agosto 2024", value: "36533.20", date: "2024-08-15", year: 2024 },
          { period: "Septiembre 2024", value: "57676.50", date: "2024-09-15", year: 2024 },
          { period: "Octubre 2024", value: "70538.00", date: "2024-10-15", year: 2024 },
          { period: "Noviembre 2024", value: "40676.04", date: "2024-11-15", year: 2024 },
          { period: "Diciembre 2024", value: "54120.30", date: "2024-12-15", year: 2024 },
          // 2025
          { period: "Enero 2025", value: "59453.54", date: "2025-01-15", year: 2025 },
          { period: "Febrero 2025", value: "46450.80", date: "2025-02-15", year: 2025 },
          { period: "Marzo 2025", value: "43602.24", date: "2025-03-15", year: 2025 },
          { period: "Abril 2025", value: "55972.80", date: "2025-04-15", year: 2025 },
          { period: "Mayo 2025", value: "36358.64", date: "2025-05-15", year: 2025 },
          { period: "Junio 2025", value: "51156.50", date: "2025-06-15", year: 2025 },
          { period: "Julio 2025", value: "52999.54", date: "2025-07-15", year: 2025 },
          { period: "Agosto 2025", value: "44381.30", date: "2025-08-15", year: 2025 },
          { period: "Septiembre 2025", value: "56763.54", date: "2025-09-15", year: 2025 },
          { period: "Octubre 2025", value: "42939.20", date: "2025-10-15", year: 2025 },
          { period: "Noviembre 2025", value: "44222.00", date: "2025-11-15", year: 2025 },
          { period: "Diciembre 2025", value: "34645.00", date: "2025-12-15", year: 2025 },
        ];

        // ORSEGA (companyId=2) - Unidades 2024 y 2025
        const orsegaHardcodedData = [
          // 2024
          { period: "Enero 2024", value: "871883.98", date: "2024-01-15", year: 2024 },
          { period: "Febrero 2024", value: "471429.00", date: "2024-02-15", year: 2024 },
          { period: "Marzo 2024", value: "983893.00", date: "2024-03-15", year: 2024 },
          { period: "Abril 2024", value: "659319.00", date: "2024-04-15", year: 2024 },
          { period: "Mayo 2024", value: "983283.00", date: "2024-05-15", year: 2024 },
          { period: "Junio 2024", value: "702502.00", date: "2024-06-15", year: 2024 },
          { period: "Julio 2024", value: "674186.00", date: "2024-07-15", year: 2024 },
          { period: "Agosto 2024", value: "528870.00", date: "2024-08-15", year: 2024 },
          { period: "Septiembre 2024", value: "871278.00", date: "2024-09-15", year: 2024 },
          { period: "Octubre 2024", value: "727375.00", date: "2024-10-15", year: 2024 },
          { period: "Noviembre 2024", value: "1312541.00", date: "2024-11-15", year: 2024 },
          { period: "Diciembre 2024", value: "750918.00", date: "2024-12-15", year: 2024 },
          // 2025
          { period: "Enero 2025", value: "1056748.00", date: "2025-01-15", year: 2025 },
          { period: "Febrero 2025", value: "986581.00", date: "2025-02-15", year: 2025 },
          { period: "Marzo 2025", value: "1319150.00", date: "2025-03-15", year: 2025 },
          { period: "Abril 2025", value: "555894.00", date: "2025-04-15", year: 2025 },
          { period: "Mayo 2025", value: "1062785.00", date: "2025-05-15", year: 2025 },
          { period: "Junio 2025", value: "1084950.00", date: "2025-06-15", year: 2025 },
          { period: "Julio 2025", value: "1169659.00", date: "2025-07-15", year: 2025 },
          { period: "Agosto 2025", value: "558525.00", date: "2025-08-15", year: 2025 },
          { period: "Septiembre 2025", value: "404786.00", date: "2025-09-15", year: 2025 },
          { period: "Octubre 2025", value: "583234.00", date: "2025-10-15", year: 2025 },
          { period: "Noviembre 2025", value: "425631.00", date: "2025-11-15", year: 2025 },
          { period: "Diciembre 2025", value: "480458.00", date: "2025-12-15", year: 2025 },
        ];

        const hardcodedData = companyId === 1 ? duraHardcodedData : orsegaHardcodedData;
        return res.json(hardcodedData);
      }
      // ========================================================================
      // FIN DATOS HARDCODEADOS TEMPORALES
      // ========================================================================

      // Resolver companyId si no se proporciona
      let resolvedCompanyId = companyId;
      if (!resolvedCompanyId) {
        const allKpis = await storage.getKpis();
        const kpi = allKpis.find(k => k.id === kpiId);
        if (kpi?.companyId) {
          resolvedCompanyId = kpi.companyId;
        } else {
          // Si no se puede resolver, usar lógica tradicional
          const kpiHistory = await storage.getKPIHistory(kpiId, months, companyId);
          return res.json(kpiHistory);
        }
      }

      // Obtener información del KPI para verificar si es de ventas
      const kpi = await storage.getKpi(kpiId, resolvedCompanyId);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }

      const kpiName = kpi.name || '';

      // Si es un KPI de ventas, calcular historial desde sales_data
      if (storage.isSalesKpi(kpiName)) {
        console.log(`[GET /api/kpi-history/:kpiId] KPI de ventas detectado: ${kpiName}, calculando desde sales_data`);
        
        try {
          const history = await calculateSalesKpiHistory(kpiName, resolvedCompanyId, months);
          
          // Formatear al formato esperado por el frontend (compatible con kpi_values)
          // El formato debe coincidir exactamente con mapKpiValueRecord
          const formattedHistory = history.map(h => {
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const monthIndex = h.date.getMonth();
            const monthName = monthNames[monthIndex];
            const year = h.date.getFullYear();
            // Formato de period debe ser: "Mes Año" (ej: "Enero 2025")
            const periodString = `${monthName} ${year}`;
            // month debe ser el nombre del mes (ej: "Enero"), no el número
            const monthString = monthName;
            
            return {
              id: 0, // Valor calculado, no tiene ID en BD
              kpiId: kpiId,
              companyId: resolvedCompanyId as 1 | 2,
              value: h.value.toString(), // Sin unidad, solo el número como string
              period: periodString,
              month: monthString,
              year: year,
              date: h.date,
              compliancePercentage: null,
              status: null,
              comments: 'Valor histórico calculado desde sales_data',
              updatedBy: null
            };
          });
          
          console.log(`[GET /api/kpi-history/:kpiId] Retornando ${formattedHistory.length} registros calculados desde sales_data`);
          return res.json(formattedHistory);
        } catch (error) {
          console.error(`[GET /api/kpi-history/:kpiId] Error calculando historial desde sales_data:`, error);
          // Fallback a lógica tradicional si hay error
          const kpiHistory = await storage.getKPIHistory(kpiId, months, resolvedCompanyId);
          return res.json(kpiHistory);
        }
      }

      // Si no es KPI de ventas, usar lógica tradicional (leer de kpi_values)
      const kpiHistory = await storage.getKPIHistory(kpiId, months, resolvedCompanyId);
      res.json(kpiHistory);
    } catch (error) {
      console.error("[GET /api/kpi-history/:kpiId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // User KPI History - Historial de todos los KPIs de un usuario (Requiere autenticación)
  app.get("/api/user-kpi-history/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const requestedUserId = parseInt(req.params.userId);
      const months = parseInt(req.query.months as string) || 6;

      // Security: Users can only see their own history unless they are admin/manager
      if (user?.id !== requestedUserId && user?.role !== 'admin' && user?.role !== 'manager') {
        return res.status(403).json({
          error: 'Acceso denegado. Solo puedes ver tu propio historial de KPIs.'
        });
      }

      console.log(`[GET /api/user-kpi-history/:userId] User ${user?.id} requesting userId: ${requestedUserId}, months: ${months}`);

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

  // ADMIN ONLY - Se ejecuta una sola vez para limpiar la base de datos

  // Clients Database API - Nueva tabla de clientes
  const sql = neon(process.env.DATABASE_URL!);

  // GET /api/clients-db - Obtener todos los clientes (Multi-tenant con autenticación)
  app.get("/api/clients-db", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, search } = req.query;

      let whereClause = "WHERE is_active = true";
      const params: any[] = [];
      let paramIndex = 1;

      // Security: Multi-tenant filtering (admins can see all companies)
      if (user?.role !== 'admin') {
        // Non-admin users only see clients from their company
        if (user?.companyId) {
          whereClause += ` AND company_id = $${paramIndex}`;
          params.push(user.companyId);
          paramIndex++;
        } else {
          // User without company cannot see any clients
          return res.json([]);
        }
      } else if (companyId) {
        // Admins can filter by specific company if they want
        whereClause += ` AND company_id = $${paramIndex}`;
        params.push(parseInt(companyId as string));
        paramIndex++;
      }

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

  // POST /api/clients - Crear un nuevo cliente
  app.post("/api/clients", jwtAuthMiddleware, validateTenantFromBody('companyId') as any, async (req, res) => {
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

      // Get token from database para obtener el email
      const activationToken = await storage.getActivationToken(token);

      if (!activationToken) {
        return res.status(404).json({
          message: "Token no válido o expirado"
        });
      }

      // ✅ FIX BUG #1: Marcar token como usado ATÓMICAMENTE primero
      // Esto previene race conditions - si dos requests llegan simultáneamente,
      // solo una podrá marcar el token como usado
      const tokenMarked = await storage.markTokenAsUsed(token);

      if (!tokenMarked) {
        // El token ya fue usado, está expirado, o es inválido
        return res.status(400).json({
          message: "Token no válido, expirado o ya utilizado"
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

  // Database seeding endpoint (Admin only, Development only)
  app.post("/api/seed-production", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;

      // Security: Only admins in development mode
      if (user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado. Solo administradores pueden acceder a este endpoint.'
        });
      }

      // Additional security: Disable in production
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Endpoint deshabilitado en producción por seguridad. No se permite seed de datos en producción.'
        });
      }

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

  // Database diagnostics endpoint (Admin only, Development only)
  app.get("/api/debug-database", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;

      // Security: Only admins in development mode
      if (user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Acceso denegado. Solo administradores pueden acceder a este endpoint.'
        });
      }

      // Additional security: Disable in production
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'Endpoint deshabilitado en producción por seguridad.'
        });
      }

      const allCompanies = await storage.getCompanies();
      const allAreas = await storage.getAreas();
      const allKpis = await storage.getKpis();

      res.json({
        companies: allCompanies,
        areas: allAreas,
        kpis: allKpis,
        totalCompanies: allCompanies.length,
        totalAreas: allAreas.length,
        totalKpis: allKpis.length,
        environment: process.env.NODE_ENV || 'development'
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

      console.log(`📊 [GET /api/treasury/payments] Retornando ${result.length} pagos programados`);
      if (result.length > 0) {
        console.log(`📊 [GET /api/treasury/payments] Ejemplo de pago:`, {
          id: result[0].id,
          supplierName: result[0].supplier_name,
          amount: result[0].amount,
          dueDate: result[0].due_date,
          paymentDate: result[0].payment_date,
          status: result[0].status,
        });
      }

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

  // DELETE /api/treasury/payments/:id - Eliminar pago programado
  app.delete("/api/treasury/payments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const paymentId = parseInt(req.params.id);

      // Verificar que el pago existe
      const existing = await sql(`SELECT * FROM scheduled_payments WHERE id = $1`, [paymentId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }

      // Eliminar el pago
      await sql(`DELETE FROM scheduled_payments WHERE id = $1`, [paymentId]);
      console.log(`🗑️ [Treasury] Pago eliminado: ID ${paymentId}`);

      res.json({ success: true, message: 'Pago eliminado correctamente' });
    } catch (error) {
      console.error('Error deleting payment:', error);
      res.status(500).json({ error: 'Failed to delete payment' });
    }
  });

  // POST /api/treasury/payments/cleanup-duplicates - Limpiar pagos duplicados
  app.post("/api/treasury/payments/cleanup-duplicates", jwtAuthMiddleware, async (req, res) => {
    try {
      const { supplierName } = req.body;

      if (!supplierName) {
        return res.status(400).json({ error: 'supplierName es requerido' });
      }

      // Buscar duplicados por nombre de proveedor
      const duplicates = await sql(`
        SELECT id, supplier_name, amount, due_date, created_at
        FROM scheduled_payments
        WHERE LOWER(supplier_name) LIKE LOWER($1)
        ORDER BY created_at DESC
      `, [`%${supplierName}%`]);

      if (duplicates.length <= 1) {
        return res.json({
          message: 'No se encontraron duplicados',
          count: duplicates.length
        });
      }

      // Mantener el primero (más reciente), eliminar el resto
      const toKeep = duplicates[0];
      const toDelete = duplicates.slice(1);

      for (const payment of toDelete) {
        await sql(`DELETE FROM scheduled_payments WHERE id = $1`, [payment.id]);
        console.log(`🗑️ [Cleanup] Eliminado duplicado: ID ${payment.id} - ${payment.supplier_name}`);
      }

      res.json({
        success: true,
        message: `Eliminados ${toDelete.length} duplicados de "${supplierName}"`,
        kept: toKeep,
        deleted: toDelete.map(p => p.id)
      });
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      res.status(500).json({ error: 'Failed to cleanup duplicates' });
    }
  });

  // POST /api/treasury/payments/repair-voucher-links - Reparar vínculos entre vouchers y payments
  app.post("/api/treasury/payments/repair-voucher-links", jwtAuthMiddleware, async (req, res) => {
    try {
      const { db } = await import('./db');
      const { paymentVouchers, scheduledPayments } = await import('../shared/schema');
      const { eq, isNotNull, isNull } = await import('drizzle-orm');

      // 1. Encontrar todos los vouchers que tienen scheduledPaymentId
      const vouchersWithPayments = await db.select()
        .from(paymentVouchers)
        .where(isNotNull(paymentVouchers.scheduledPaymentId));

      console.log(`🔧 [Repair] Encontrados ${vouchersWithPayments.length} vouchers con scheduledPaymentId`);

      let repaired = 0;
      let alreadyLinked = 0;
      const errors: string[] = [];

      for (const voucher of vouchersWithPayments) {
        if (!voucher.scheduledPaymentId) continue;

        // Verificar si el scheduled_payment ya tiene voucherId
        const [payment] = await db.select()
          .from(scheduledPayments)
          .where(eq(scheduledPayments.id, voucher.scheduledPaymentId));

        if (!payment) {
          errors.push(`Payment ${voucher.scheduledPaymentId} no encontrado para voucher ${voucher.id}`);
          continue;
        }

        if (payment.voucherId === voucher.id) {
          alreadyLinked++;
          continue;
        }

        // Actualizar el scheduled_payment con el voucherId
        await db.update(scheduledPayments)
          .set({
            voucherId: voucher.id,
            updatedAt: new Date(),
          })
          .where(eq(scheduledPayments.id, voucher.scheduledPaymentId));

        console.log(`✅ [Repair] Vinculado voucher ${voucher.id} → payment ${voucher.scheduledPaymentId}`);
        repaired++;
      }

      res.json({
        success: true,
        message: `Reparación completada`,
        stats: {
          totalVouchers: vouchersWithPayments.length,
          repaired,
          alreadyLinked,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Error repairing voucher links:', error);
      res.status(500).json({ error: 'Failed to repair voucher links' });
    }
  });

  // POST /api/scheduled-payments/confirm - Confirmar creación de cuenta por pagar con fecha de pago
  app.post("/api/scheduled-payments/confirm", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      
      // Validar datos recibidos
      const confirmSchema = z.object({
        payerCompanyId: z.number().int().positive(),
        supplierId: z.number().int().positive().nullable().optional(),
        supplierName: z.string().min(1),
        amount: z.number().positive(),
        currency: z.string().default('MXN'),
        dueDate: z.string().or(z.date()), // Fecha de vencimiento
        paymentDate: z.string().or(z.date()), // Fecha de pago (OBLIGATORIA)
        reference: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        invoiceFilePath: z.string(), // Ruta del archivo temporal
        invoiceFileName: z.string(), // Nombre original del archivo
        extractedInvoiceNumber: z.string().nullable().optional(),
        extractedTaxId: z.string().nullable().optional(),
      });

      const validatedData = confirmSchema.parse(req.body);
      
      // Validar que paymentDate esté presente
      if (!validatedData.paymentDate) {
        return res.status(400).json({ 
          error: 'Fecha de pago requerida', 
          details: 'La fecha de pago es obligatoria para confirmar la cuenta por pagar' 
        });
      }

      // Parsear fechas
      const dueDate = validatedData.dueDate instanceof Date 
        ? validatedData.dueDate 
        : new Date(validatedData.dueDate);
      
      const paymentDate = validatedData.paymentDate instanceof Date 
        ? validatedData.paymentDate 
        : new Date(validatedData.paymentDate);

      // Crear cuenta por pagar usando storage
      const scheduledPaymentData = {
        companyId: validatedData.payerCompanyId,
        supplierId: validatedData.supplierId || null,
        supplierName: validatedData.supplierName,
        amount: validatedData.amount,
        currency: validatedData.currency || 'MXN',
        dueDate: dueDate,
        paymentDate: paymentDate, // ✅ Fecha de pago obligatoria
        reference: validatedData.reference || validatedData.extractedInvoiceNumber || `Factura ${Date.now()}`,
        status: 'idrall_imported',
        sourceType: 'manual',
        notes: validatedData.notes || `Factura confirmada desde ${validatedData.invoiceFileName}. ${validatedData.extractedTaxId ? `RFC: ${validatedData.extractedTaxId}` : ''}`,
        createdBy: user.id,
      };

      const createdScheduledPayment = await storage.createScheduledPayment(scheduledPaymentData);
      console.log(`✅ [Confirm Invoice] Cuenta por pagar creada: ID ${createdScheduledPayment.id}`);

      // Mover archivo de temp a storage permanente (R2 o local)
      const fsModule = await import('fs');
      let invoiceFileUrl = '';

      if (fsModule.existsSync(validatedData.invoiceFilePath)) {
        // Detectar MIME type basado en extensión
        const ext = validatedData.invoiceFileName.toLowerCase().split('.').pop();
        const mimeTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'xml': 'application/xml'
        };
        const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

        const uploadResult = await moveTempToStorage(
          validatedData.invoiceFilePath,
          'facturas',
          validatedData.invoiceFileName,
          mimeType
        );
        invoiceFileUrl = uploadResult.url;
        console.log(`✅ [Confirm Invoice] Archivo subido a ${uploadResult.storage}: ${invoiceFileUrl}`);
      } else {
        console.warn(`⚠️ [Confirm Invoice] Archivo temporal no encontrado: ${validatedData.invoiceFilePath}`);
      }

      // Actualizar el scheduled payment con la URL del archivo
      const { db } = await import('./db');
      const { scheduledPayments } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      await db.update(scheduledPayments)
        .set({
          hydralFileUrl: invoiceFileUrl,
          hydralFileName: validatedData.invoiceFileName,
        })
        .where(eq(scheduledPayments.id, createdScheduledPayment.id));

      // Obtener el scheduled payment actualizado
      const [updatedPayment] = await db.select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, createdScheduledPayment.id));

      console.log(`✅ [Confirm Invoice] Cuenta por pagar confirmada y archivo movido: ID ${createdScheduledPayment.id}`);
      console.log(`✅ [Confirm Invoice] Datos del pago creado:`, {
        id: updatedPayment.id,
        supplierName: updatedPayment.supplierName,
        amount: updatedPayment.amount,
        dueDate: updatedPayment.dueDate,
        paymentDate: updatedPayment.paymentDate,
        status: updatedPayment.status,
        companyId: updatedPayment.companyId,
      });

      // ✅ NUEVO: Crear paymentVoucher con status pago_programado para el Kanban
      const voucherData = {
        companyId: validatedData.payerCompanyId,
        payerCompanyId: validatedData.payerCompanyId,
        clientId: validatedData.supplierId || 0, // Usar supplierId si existe
        clientName: validatedData.supplierName,
        scheduledPaymentId: createdScheduledPayment.id,
        status: 'pago_programado' as const, // ✅ Nuevo status para Kanban
        voucherFileUrl: invoiceFileUrl,
        voucherFileName: validatedData.invoiceFileName,
        voucherFileType: validatedData.invoiceFileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        extractedAmount: validatedData.amount,
        extractedDate: dueDate,
        extractedBank: null,
        extractedReference: validatedData.reference || validatedData.extractedInvoiceNumber || null,
        extractedCurrency: validatedData.currency || 'MXN',
        extractedOriginAccount: null,
        extractedDestinationAccount: null,
        extractedTrackingKey: null,
        extractedBeneficiaryName: null,
        ocrConfidence: 0.9, // Alta confianza porque ya fue verificado
        uploadedBy: user.id,
      };

      const createdVoucher = await storage.createPaymentVoucher(voucherData);
      console.log(`✅ [Confirm Invoice] PaymentVoucher creado para Kanban: ID ${createdVoucher.id}, status: pago_programado`);

      res.status(201).json({
        scheduledPayment: updatedPayment,
        paymentVoucher: createdVoucher,
        message: 'Cuenta por pagar creada exitosamente con fecha de pago'
      });
    } catch (error) {
      console.error('❌ [Confirm Invoice] Error confirmando cuenta por pagar:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validación fallida', 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        error: 'Error al confirmar cuenta por pagar', 
        details: error instanceof Error ? error.message : 'Error desconocido' 
      });
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

  // GET /api/scheduled-payments/:id/documents - Obtener repertorio de documentos y detalles del pago
  app.get("/api/scheduled-payments/:id/documents", jwtAuthMiddleware, async (req, res) => {
    try {
      const scheduledPaymentId = parseInt(req.params.id);

      // Obtener scheduled payment
      const { db } = await import('./db');
      const { scheduledPayments, paymentVouchers } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const [payment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));

      if (!payment) {
        return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
      }

      const documents: any[] = [];

      // 1. Factura (hydralFileUrl)
      if (payment.hydralFileUrl && payment.hydralFileName) {
        documents.push({
          type: 'invoice',
          name: payment.hydralFileName,
          url: payment.hydralFileUrl,
          uploadedAt: payment.createdAt,
        });
      }

      // 2. Comprobante (voucherId -> payment_voucher)
      if (payment.voucherId) {
        const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, payment.voucherId));
        if (voucher) {
          documents.push({
            type: 'voucher',
            name: voucher.voucherFileName,
            url: voucher.voucherFileUrl,
            uploadedAt: voucher.createdAt,
            extractedAmount: voucher.extractedAmount,
            extractedDate: voucher.extractedDate,
            extractedBank: voucher.extractedBank,
            extractedReference: voucher.extractedReference,
          });

          // 3. REP (complementFileUrl del voucher)
          if (voucher.complementFileUrl && voucher.complementFileName) {
            documents.push({
              type: 'rep',
              name: voucher.complementFileName,
              url: voucher.complementFileUrl,
              uploadedAt: voucher.updatedAt,
            });
          }
        }
      }

      // Incluir detalles del pago en la respuesta
      res.json({
        scheduledPaymentId,
        payment: {
          id: payment.id,
          supplierName: payment.supplierName,
          amount: payment.amount,
          currency: payment.currency,
          dueDate: payment.dueDate,
          paymentDate: payment.paymentDate,
          status: payment.status,
          reference: payment.reference,
          notes: payment.notes,
          sourceType: payment.sourceType,
          createdAt: payment.createdAt,
        },
        documents,
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Error al obtener documentos' });
    }
  });

  // PUT /api/scheduled-payments/:id/status - Actualizar estado (para drag & drop)
  app.put("/api/scheduled-payments/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const scheduledPaymentId = parseInt(req.params.id);

      const statusSchema = z.object({
        status: z.enum([
          'idrall_imported',
          'pending_approval',
          'approved',
          'payment_scheduled',
          'payment_pending',
          'payment_completed',
          'voucher_uploaded',
          'closed'
        ]),
      });

      const validatedData = statusSchema.parse(req.body);

      // Actualizar usando Drizzle
      const { db } = await import('./db');
      const { scheduledPayments } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const [updated] = await db.update(scheduledPayments)
        .set({
          status: validatedData.status,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPayments.id, scheduledPaymentId))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating scheduled payment status:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  });

  // ============================================
  // IDRALL - Procesamiento de archivos Idrall
  // ============================================

  // Configurar multer para archivos Idrall
  const idrallUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'idrall');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `idrall-${uniqueSuffix}-${file.originalname}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
      if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf') || file.originalname.toLowerCase().endsWith('.zip')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF o ZIP'));
      }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB para ZIPs
  });

  // POST /api/treasury/idrall/upload - Procesar archivos Idrall y crear CxP
  console.log('✅ [Routes] Registrando endpoint POST /api/treasury/idrall/upload');
  app.post("/api/treasury/idrall/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
    idrallUpload.array('files', 10)(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error (Idrall):', err.message);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    const uploadedFiles: Express.Multer.File[] = [];
    
    try {
      const user = getAuthUser(req as AuthRequest);
      const files = req.files as Express.Multer.File[];
      const { companyId } = req.body;

      // Validaciones iniciales
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          error: 'No se subieron archivos',
          details: 'Por favor, selecciona al menos un archivo PDF o ZIP para procesar'
        });
      }

      if (!companyId) {
        return res.status(400).json({ 
          error: 'companyId es requerido',
          details: 'Debes seleccionar una empresa antes de subir archivos'
        });
      }

      // Validar que companyId sea un número válido
      const parsedCompanyId = parseInt(companyId);
      if (isNaN(parsedCompanyId) || parsedCompanyId <= 0) {
        return res.status(400).json({ 
          error: 'companyId inválido',
          details: 'El ID de empresa debe ser un número válido'
        });
      }

      console.log(`📦 [Idrall Upload] Procesando ${files.length} archivo(s) para empresa ${parsedCompanyId}`);

      // Verificar que los archivos existen y tienen tamaño válido
      for (const file of files) {
        if (!file || !file.path) {
          return res.status(400).json({ 
            error: 'Archivo inválido',
            details: `El archivo ${file?.originalname || 'desconocido'} no se subió correctamente`
          });
        }
        
        try {
          const fileStats = await fs.promises.stat(file.path);
          if (fileStats.size === 0) {
            return res.status(400).json({ 
              error: 'Archivo vacío',
              details: `El archivo ${file.originalname} está vacío y no puede ser procesado`
            });
          }
        } catch (statError) {
          console.error(`❌ [Idrall Upload] Error verificando archivo ${file.originalname}:`, statError);
          return res.status(400).json({ 
            error: 'Error accediendo al archivo',
            details: `No se pudo acceder al archivo ${file.originalname}. Por favor, intenta subirlo nuevamente.`
          });
        }
        
        uploadedFiles.push(file);
      }

      // Procesar archivos con el analizador de documentos unificado
      const { analyzePaymentDocument } = await import("./document-analyzer");
      
      const allRecords: any[] = [];
      const processingErrors: string[] = [];
      let processedFiles = 0;
      const fileRecordsMap = new Map<number, Express.Multer.File>(); // Mapear registros a archivos

      // Procesar cada archivo
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        let fileProcessed = false;
        
        try {
          console.log(`📄 [Idrall Upload] Procesando archivo ${i + 1}/${uploadedFiles.length}: ${file.originalname}`);
          
          const fileBuffer = await fs.promises.readFile(file.path);
          const fileType = file.mimetype || path.extname(file.originalname).toLowerCase();
          
          const analysisResult = await analyzePaymentDocument(fileBuffer, fileType);
          const analysisResultAny = analysisResult as any;

          // Si es CxP y tiene registros, agregarlos
          if (analysisResultAny.documentType === "cxp" && analysisResultAny.cxpRecords) {
            for (const record of analysisResultAny.cxpRecords) {
              allRecords.push({
                ...record,
                _sourceFileIndex: i // Guardar índice del archivo origen
              });
              fileRecordsMap.set(allRecords.length - 1, file);
            }
            processedFiles++;
            fileProcessed = true;
          } else if (analysisResultAny.documentType === "cxp") {
            // Si es CxP pero no tiene registros individuales, crear uno del resultado agregado
            if (analysisResult.extractedSupplierName && analysisResult.extractedAmount) {
              const recordIndex = allRecords.length;
              allRecords.push({
                supplierName: analysisResult.extractedSupplierName,
                amount: analysisResult.extractedAmount,
                currency: analysisResult.extractedCurrency || "MXN",
                dueDate: analysisResult.extractedDueDate || analysisResult.extractedDate || new Date(),
                reference: analysisResult.extractedReference,
                status: null,
                notes: analysisResultAny.notes,
                _sourceFileIndex: i
              });
              fileRecordsMap.set(recordIndex, file);
              processedFiles++;
              fileProcessed = true;
            }
          } else {
            processingErrors.push(`El archivo "${file.originalname}" no es un documento CxP válido. Tipo detectado: ${analysisResult.documentType || 'desconocido'}`);
          }
        } catch (error: any) {
          console.error(`❌ [Idrall Upload] Error procesando ${file.originalname}:`, error);
          const errorMessage = error?.message || 'Error desconocido al procesar el archivo';
          processingErrors.push(`Error procesando "${file.originalname}": ${errorMessage}`);
        }
      }

      // Si no se procesó ningún archivo exitosamente
      if (allRecords.length === 0 && processingErrors.length > 0) {
        // Limpiar archivos antes de retornar error
        for (const file of uploadedFiles) {
          try {
            if (fs.existsSync(file.path)) {
              await fs.promises.unlink(file.path);
              console.log(`🗑️ [Idrall Upload] Archivo eliminado: ${file.path}`);
            }
          } catch (cleanupError) {
            console.error(`⚠️ [Idrall Upload] Error al limpiar archivo ${file.originalname}:`, cleanupError);
          }
        }
        
        return res.status(400).json({
          success: false,
          error: 'No se pudo procesar ningún archivo',
          details: 'Ninguno de los archivos subidos pudo ser procesado como documento CxP válido',
          processing: {
            totalRecords: 0,
            processedFiles: 0,
            errors: processingErrors
          }
        });
      }

      // Crear registros de CxP en la base de datos
      const createdPayments = [];
      const errors = [];

      for (let i = 0; i < allRecords.length; i++) {
        const record = allRecords[i];
        const sourceFile = fileRecordsMap.get(i) || uploadedFiles[0]; // Fallback al primer archivo
        
        try {
          // Validar datos del registro antes de insertar
          if (!record.supplierName || !record.amount) {
            errors.push(`Registro inválido: falta información del proveedor o monto`);
            continue;
          }

          // Buscar proveedor por nombre (fuzzy match)
          const supplierResult = await sql(`
            SELECT id FROM suppliers 
            WHERE LOWER(name) LIKE LOWER($1) 
            AND company_id = $2 
            AND is_active = true
            LIMIT 1
          `, [`%${record.supplierName.trim()}%`, parsedCompanyId]);

          const supplierId = supplierResult.length > 0 ? supplierResult[0].id : null;

          // Validar monto
          const amount = parseFloat(record.amount);
          if (isNaN(amount) || amount <= 0) {
            errors.push(`Monto inválido para proveedor "${record.supplierName}": ${record.amount}`);
            continue;
          }

          // Crear registro de scheduled_payment
          const result = await sql(`
            INSERT INTO scheduled_payments (
              company_id, supplier_id, supplier_name, amount, currency, due_date,
              status, reference, notes, source_type, hydral_file_url, hydral_file_name, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
          `, [
            parsedCompanyId,
            supplierId,
            record.supplierName.trim(),
            amount,
            record.currency || 'MXN',
            record.dueDate || new Date(),
            'idrall_imported', // Estado inicial
            record.reference || null,
            record.notes || null,
            'idrall',
            sourceFile.path, // URL del archivo origen
            sourceFile.originalname,
            user.id
          ]);

          createdPayments.push(result[0]);
        } catch (error: any) {
          console.error(`❌ [Idrall Upload] Error creando registro para ${record.supplierName}:`, error);
          const errorDetail = error?.code === '23505' 
            ? 'Ya existe un registro con estos datos'
            : error?.message || 'Error desconocido';
          errors.push(`Error creando CxP para "${record.supplierName}": ${errorDetail}`);
        }
      }

      // Limpiar archivos después de procesar (solo si se crearon registros)
      if (createdPayments.length > 0) {
        console.log(`🗑️ [Idrall Upload] Limpiando archivos temporales después de procesamiento exitoso`);
        for (const file of uploadedFiles) {
          try {
            if (fs.existsSync(file.path)) {
              await fs.promises.unlink(file.path);
              console.log(`🗑️ [Idrall Upload] Archivo eliminado: ${file.path}`);
            }
          } catch (cleanupError) {
            console.error(`⚠️ [Idrall Upload] Error al limpiar archivo ${file.originalname}:`, cleanupError);
            // No fallar el request por errores de limpieza
          }
        }
      }

      console.log(`✅ [Idrall Upload] Procesamiento completado: ${createdPayments.length} CxP creados, ${errors.length} errores`);

      res.status(201).json({
        success: true,
        created: createdPayments.length,
        payments: createdPayments,
        processing: {
          totalRecords: allRecords.length,
          processedFiles: processedFiles,
          errors: [...processingErrors, ...errors]
        }
      });
    } catch (error: any) {
      console.error('❌ [Idrall Upload] Error procesando archivos Idrall:', error);
      
      // Limpiar archivos en caso de error
      for (const file of uploadedFiles) {
        try {
          if (fs.existsSync(file.path)) {
            await fs.promises.unlink(file.path);
            console.log(`🗑️ [Idrall Upload] Archivo eliminado después de error: ${file.path}`);
          }
        } catch (cleanupError) {
          console.error(`⚠️ [Idrall Upload] Error al limpiar archivo después de error:`, cleanupError);
        }
      }
      
      const errorMessage = error?.message || 'Error desconocido al procesar los archivos';
      res.status(500).json({ 
        error: 'Error al procesar archivos Idrall',
        details: errorMessage
      });
    }
  });

  // GET /api/treasury/exchange-rates - Listar tipos de cambio
  app.get("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      // Para el histórico 24h necesitamos más registros, aumentar a 100 por defecto
      const { limit = 100 } = req.query;
      
      const result = await sql(`
        SELECT
          er.id,
          er.buy_rate,
          er.sell_rate,
          er.source,
          -- Interpretar fecha como CDMX y convertir a UTC para enviar al frontend
          (er.date AT TIME ZONE 'America/Mexico_City')::text as date,
          er.notes,
          u.name as created_by_name,
          u.email as created_by_email
        FROM exchange_rates er
        LEFT JOIN users u ON er.created_by = u.id
        ORDER BY er.date DESC
        LIMIT $1
      `, [parseInt(limit as string)]);

      // Las fechas ya vienen con timezone correcto desde PostgreSQL
      const formattedResult = result.map((row: any) => ({
        ...row,
        date: row.date.endsWith('Z') ? row.date : row.date + 'Z'
      }));

      res.json(formattedResult);
    } catch (error) {
      logger.error('Error fetching exchange rates', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/daily - Historial diario (últimas 24 horas por defecto)
  // Compatible hacia atrás: sin parámetros nuevos = comportamiento actual (últimas 24 horas)
  app.get("/api/treasury/exchange-rates/daily", jwtAuthMiddleware, async (req, res) => {
    try {
      const rateType = (req.query.rateType as string) || 'buy'; // 'buy' o 'sell'
      const daysParam = req.query.days ? parseInt(req.query.days as string) : undefined;
      const days = daysParam && daysParam > 0 && daysParam <= 7 ? daysParam : 1; // Default: 1 día (24 horas), máximo: 7 días
      const sourcesParam = req.query.sources;

      // Calcular fecha de inicio según días
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - (days * 24));
      startDate.setMinutes(0, 0, 0);

      // Procesar fuentes filtradas (opcional)
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam) 
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());
        
        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({ 
            error: `Fuentes inválidas: ${invalidSources.join(', ')}. Fuentes válidas: ${validSources.join(', ')}` 
          });
        }
      }

      logger.debug(`[Daily Exchange Rates] Request - rateType: ${rateType}, days: ${days}`, { rateType, days, sources, since: startDate.toISOString() });

      // Construir query SQL con filtro de fuentes (opcional)
      let query = `
        SELECT 
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1
      `;
      
      const params: any[] = [startDate.toISOString()];
      
      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 2}`).join(', ')})`;
        params.push(...sources);
      }
      
      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Daily Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por hora y fuente - tomar el último valor de cada fuente por hora
      const hourMap = new Map<string, {
        hour: string;
        timestamp: string;
        santander?: number;
        monex?: number;
        dof?: number;
      }>();

      // Primero, agrupar todos los registros por hora y fuente, guardando el más reciente de cada combinación
      const recordsByHourSource = new Map<string, { timestamp: Date; rate: number }>();
      
      result.forEach((row: any) => {
        const date = new Date(row.date);
        // Formatear hora en formato HH:mm
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const hourKey = `${hours}:${minutes}`;
        const source = (row.source || '').toLowerCase().trim();
        const sourceKey = `${hourKey}_${source}`;
        
        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
        
        // Guardar el registro más reciente para cada combinación hora-fuente
        if (!recordsByHourSource.has(sourceKey) || date > recordsByHourSource.get(sourceKey)!.timestamp) {
          recordsByHourSource.set(sourceKey, { timestamp: date, rate: rateValue });
        }
      });

      // Ahora construir el mapa final agrupado por hora
      recordsByHourSource.forEach((record, sourceKey) => {
        const [hourKey, source] = sourceKey.split('_');
        
        if (!hourMap.has(hourKey)) {
          hourMap.set(hourKey, {
            hour: hourKey,
            timestamp: record.timestamp.toISOString(),
            santander: undefined,
            monex: undefined,
            dof: undefined,
          });
        }
        
        const hourData = hourMap.get(hourKey)!;
        // Actualizar timestamp si es más reciente
        if (new Date(record.timestamp) > new Date(hourData.timestamp)) {
          hourData.timestamp = record.timestamp.toISOString();
        }
        
        if (source === 'santander') hourData.santander = record.rate;
        else if (source === 'monex') hourData.monex = record.rate;
        else if (source === 'dof') hourData.dof = record.rate;
      });

      // Convertir a array y ordenar por timestamp
      const formattedResult = Array.from(hourMap.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      logger.debug(`[Daily Exchange Rates] Resultado formateado: ${formattedResult.length} puntos de datos`, { 
        count: formattedResult.length,
        firstPoint: formattedResult[0] || null,
        lastPoint: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('❌ [Daily Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch daily exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/monthly - Promedios mensuales por día
  // Compatible hacia atrás: sin parámetros nuevos = comportamiento actual (1 mes)
  app.get("/api/treasury/exchange-rates/monthly", jwtAuthMiddleware, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const rateType = (req.query.rateType as string) || 'buy'; // 'buy' o 'sell'
      const monthsParam = req.query.months ? parseInt(req.query.months as string) : undefined;
      const months = monthsParam && monthsParam > 0 && monthsParam <= 12 ? monthsParam : 1; // Default: 1 mes, máximo: 12 meses
      const sourcesParam = req.query.sources;

      // Calcular inicio y fin según meses
      const startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(year, month - 1 + months, 0, 23, 59, 59);

      // Procesar fuentes filtradas (opcional)
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam) 
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());
        
        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({ 
            error: `Fuentes inválidas: ${invalidSources.join(', ')}. Fuentes válidas: ${validSources.join(', ')}` 
          });
        }
      }

      logger.debug(`[Monthly Exchange Rates] Request`, { year, month, months, rateType, sources, startDate: startDate.toISOString(), endDate: endDate.toISOString() });

      // Construir query SQL con filtro de fuentes (opcional)
      let query = `
        SELECT 
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;
      
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      
      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }
      
      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Monthly Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por día y fuente, calcular promedio
      const dayMap = new Map<number, {
        day: number;
        date: string;
        santander?: { sum: number; count: number };
        monex?: { sum: number; count: number };
        dof?: { sum: number; count: number };
      }>();

      result.forEach((row: any) => {
        const date = new Date(row.date);
        const day = date.getDate();
        const dateKey = date.toISOString().split('T')[0];
        
        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
        const source = (row.source || '').toLowerCase().trim();

        if (!dayMap.has(day)) {
          dayMap.set(day, {
            day,
            date: dateKey,
            santander: undefined,
            monex: undefined,
            dof: undefined,
          });
        }

        const dayData = dayMap.get(day)!;
        if (source === 'santander') {
          if (!dayData.santander) dayData.santander = { sum: 0, count: 0 };
          dayData.santander.sum += rateValue;
          dayData.santander.count += 1;
        } else if (source === 'monex') {
          if (!dayData.monex) dayData.monex = { sum: 0, count: 0 };
          dayData.monex.sum += rateValue;
          dayData.monex.count += 1;
        } else if (source === 'dof') {
          if (!dayData.dof) dayData.dof = { sum: 0, count: 0 };
          dayData.dof.sum += rateValue;
          dayData.dof.count += 1;
        }
      });

      // Calcular promedios y formatear
      const formattedResult = Array.from(dayMap.values())
        .map(dayData => ({
          day: dayData.day,
          date: dayData.date,
          santander: dayData.santander ? dayData.santander.sum / dayData.santander.count : undefined,
          monex: dayData.monex ? dayData.monex.sum / dayData.monex.count : undefined,
          dof: dayData.dof ? dayData.dof.sum / dayData.dof.count : undefined,
        }))
        .sort((a, b) => a.day - b.day);

      logger.debug(`[Monthly Exchange Rates] Resultado formateado: ${formattedResult.length} días con datos`, {
        count: formattedResult.length,
        firstDay: formattedResult[0] || null,
        lastDay: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('❌ [Monthly Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch monthly exchange rates' });
    }
  });

  // GET /api/treasury/exchange-rates/range - Historial para rango de fechas personalizado
  app.get("/api/treasury/exchange-rates/range", jwtAuthMiddleware, async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const rateType = (req.query.rateType as string) || 'buy';
      const sourcesParam = req.query.sources;
      const interval = (req.query.interval as string) || 'day'; // 'hour' | 'day' | 'month'

      // Validar fechas requeridas
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ 
          error: 'startDate y endDate son requeridos',
          example: '/api/treasury/exchange-rates/range?startDate=2025-01-01&endDate=2025-01-07'
        });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Validar fechas válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Fechas inválidas. Use formato ISO 8601 (YYYY-MM-DD)' });
      }

      // Validar rango máximo (1 año)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'El rango máximo es de 365 días (1 año)' });
      }

      if (endDate < startDate) {
        return res.status(400).json({ error: 'endDate debe ser posterior a startDate' });
      }

      // Procesar fuentes filtradas
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam) 
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());
        
        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({ 
            error: `Fuentes inválidas: ${invalidSources.join(', ')}. Fuentes válidas: ${validSources.join(', ')}` 
          });
        }
      }

      logger.debug(`[Range Exchange Rates] Request`, { 
        startDate: startDateStr, 
        endDate: endDateStr, 
        rateType, 
        sources, 
        interval,
        daysDiff 
      });

      // Ajustar fechas para incluir todo el día
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Construir query SQL con filtro de fuentes
      let query = `
        SELECT 
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;
      
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      
      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }
      
      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Range Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar según intervalo
      let formattedResult: any[] = [];

      if (interval === 'hour') {
        // Agrupar por hora
        const hourMap = new Map<string, {
          date: string;
          hour: string;
          timestamp: string;
          santander?: number;
          monex?: number;
          dof?: number;
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const hourKey = `${date.toISOString().split('T')[0]}T${String(date.getHours()).padStart(2, '0')}:00:00Z`;
          
          if (!hourMap.has(hourKey)) {
            hourMap.set(hourKey, {
              date: date.toISOString().split('T')[0],
              hour: `${String(date.getHours()).padStart(2, '0')}:00`,
              timestamp: hourKey,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const hourData = hourMap.get(hourKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') hourData.santander = rateValue;
          else if (source === 'monex') hourData.monex = rateValue;
          else if (source === 'dof') hourData.dof = rateValue;
        });

        formattedResult = Array.from(hourMap.values())
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      } else if (interval === 'day') {
        // Agrupar por día (promedio)
        const dayMap = new Map<string, {
          date: string;
          santander?: { sum: number; count: number };
          monex?: { sum: number; count: number };
          dof?: { sum: number; count: number };
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const dateKey = date.toISOString().split('T')[0];
          
          if (!dayMap.has(dateKey)) {
            dayMap.set(dateKey, {
              date: dateKey,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const dayData = dayMap.get(dateKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') {
            if (!dayData.santander) dayData.santander = { sum: 0, count: 0 };
            dayData.santander.sum += rateValue;
            dayData.santander.count += 1;
          } else if (source === 'monex') {
            if (!dayData.monex) dayData.monex = { sum: 0, count: 0 };
            dayData.monex.sum += rateValue;
            dayData.monex.count += 1;
          } else if (source === 'dof') {
            if (!dayData.dof) dayData.dof = { sum: 0, count: 0 };
            dayData.dof.sum += rateValue;
            dayData.dof.count += 1;
          }
        });

        formattedResult = Array.from(dayMap.values())
          .map(dayData => ({
            date: dayData.date,
            santander: dayData.santander ? dayData.santander.sum / dayData.santander.count : undefined,
            monex: dayData.monex ? dayData.monex.sum / dayData.monex.count : undefined,
            dof: dayData.dof ? dayData.dof.sum / dayData.dof.count : undefined,
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      } else if (interval === 'month') {
        // Agrupar por mes (promedio)
        const monthMap = new Map<string, {
          year: number;
          month: number;
          date: string;
          santander?: { sum: number; count: number };
          monex?: { sum: number; count: number };
          dof?: { sum: number; count: number };
        }>();

        result.forEach((row: any) => {
          const date = new Date(row.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
              year: date.getFullYear(),
              month: date.getMonth() + 1,
              date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
              santander: undefined,
              monex: undefined,
              dof: undefined,
            });
          }

          const monthData = monthMap.get(monthKey)!;
          const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
          const source = (row.source || '').toLowerCase().trim();

          if (source === 'santander') {
            if (!monthData.santander) monthData.santander = { sum: 0, count: 0 };
            monthData.santander.sum += rateValue;
            monthData.santander.count += 1;
          } else if (source === 'monex') {
            if (!monthData.monex) monthData.monex = { sum: 0, count: 0 };
            monthData.monex.sum += rateValue;
            monthData.monex.count += 1;
          } else if (source === 'dof') {
            if (!monthData.dof) monthData.dof = { sum: 0, count: 0 };
            monthData.dof.sum += rateValue;
            monthData.dof.count += 1;
          }
        });

        formattedResult = Array.from(monthMap.values())
          .map(monthData => ({
            year: monthData.year,
            month: monthData.month,
            date: monthData.date,
            santander: monthData.santander ? monthData.santander.sum / monthData.santander.count : undefined,
            monex: monthData.monex ? monthData.monex.sum / monthData.monex.count : undefined,
            dof: monthData.dof ? monthData.dof.sum / monthData.dof.count : undefined,
          }))
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
      }

      logger.debug(`[Range Exchange Rates] Resultado formateado: ${formattedResult.length} puntos`, {
        count: formattedResult.length,
        interval,
        firstPoint: formattedResult[0] || null,
        lastPoint: formattedResult[formattedResult.length - 1] || null
      });

      res.json(formattedResult);
    } catch (error) {
      logger.error('❌ [Range Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates for range' });
    }
  });

  // GET /api/treasury/exchange-rates/stats - Estadísticas para un rango de fechas
  app.get("/api/treasury/exchange-rates/stats", jwtAuthMiddleware, async (req, res) => {
    try {
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;
      const rateType = (req.query.rateType as string) || 'buy';
      const sourcesParam = req.query.sources;

      // Validar fechas requeridas
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ 
          error: 'startDate y endDate son requeridos',
          example: '/api/treasury/exchange-rates/stats?startDate=2025-01-01&endDate=2025-01-31'
        });
      }

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      // Validar fechas válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Fechas inválidas. Use formato ISO 8601 (YYYY-MM-DD)' });
      }

      // Validar rango máximo (1 año)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'El rango máximo es de 365 días (1 año)' });
      }

      if (endDate < startDate) {
        return res.status(400).json({ error: 'endDate debe ser posterior a startDate' });
      }

      // Procesar fuentes filtradas
      let sources: string[] | null = null;
      if (sourcesParam) {
        sources = Array.isArray(sourcesParam) 
          ? (sourcesParam as string[]).map(s => s.toLowerCase().trim())
          : [sourcesParam as string].map(s => s.toLowerCase().trim());
        
        // Validar fuentes permitidas
        const validSources = ['monex', 'santander', 'dof'];
        const invalidSources = sources.filter(s => !validSources.includes(s));
        if (invalidSources.length > 0) {
          return res.status(400).json({ 
            error: `Fuentes inválidas: ${invalidSources.join(', ')}. Fuentes válidas: ${validSources.join(', ')}` 
          });
        }
      }

      logger.debug(`[Stats Exchange Rates] Request`, { 
        startDate: startDateStr, 
        endDate: endDateStr, 
        rateType, 
        sources 
      });

      // Ajustar fechas para incluir todo el día
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Construir query SQL con filtro de fuentes
      let query = `
        SELECT 
          er.buy_rate,
          er.sell_rate,
          er.source,
          er.date::text as date
        FROM exchange_rates er
        WHERE er.date >= $1 AND er.date <= $2
      `;
      
      const params: any[] = [startDate.toISOString(), endDate.toISOString()];
      
      if (sources && sources.length > 0) {
        query += ` AND LOWER(TRIM(er.source)) IN (${sources.map((_, i) => `$${i + 3}`).join(', ')})`;
        params.push(...sources);
      }
      
      query += ` ORDER BY er.date ASC`;

      const result = await sql(query, params) as any[];

      logger.debug(`[Stats Exchange Rates] Resultados de BD: ${result.length} registros`, { count: result.length });

      // Agrupar por fuente y calcular estadísticas
      const sourceMap = new Map<string, number[]>();

      result.forEach((row: any) => {
        const rateValue = rateType === 'buy' ? parseFloat(row.buy_rate) : parseFloat(row.sell_rate);
        const source = (row.source || '').toLowerCase().trim();
        
        if (!sourceMap.has(source)) {
          sourceMap.set(source, []);
        }
        
        sourceMap.get(source)!.push(rateValue);
      });

      // Calcular estadísticas para cada fuente
      const stats = Array.from(sourceMap.entries()).map(([source, values]) => {
        if (values.length === 0) {
          return null;
        }

        // Ordenar valores para calcular min/max
        const sortedValues = [...values].sort((a, b) => a - b);
        const min = sortedValues[0];
        const max = sortedValues[sortedValues.length - 1];
        
        // Calcular promedio
        const sum = values.reduce((acc, val) => acc + val, 0);
        const average = sum / values.length;
        
        // Calcular volatilidad (desviación estándar)
        const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
        const volatility = Math.sqrt(variance);
        
        // Calcular tendencia (comparar primeros y últimos valores)
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const trendThreshold = average * 0.001; // 0.1% del promedio como umbral
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (lastValue > firstValue + trendThreshold) {
          trend = 'up';
        } else if (lastValue < firstValue - trendThreshold) {
          trend = 'down';
        }

        return {
          source: source.charAt(0).toUpperCase() + source.slice(1), // Capitalizar primera letra
          average: Math.round(average * 10000) / 10000, // 4 decimales
          max: Math.round(max * 10000) / 10000,
          min: Math.round(min * 10000) / 10000,
          volatility: Math.round(volatility * 10000) / 10000,
          trend,
          count: values.length
        };
      }).filter((stat): stat is NonNullable<typeof stat> => stat !== null);

      // Ordenar por nombre de fuente
      stats.sort((a, b) => {
        const order = ['Monex', 'Santander', 'Dof'];
        const aIndex = order.indexOf(a.source);
        const bIndex = order.indexOf(b.source);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.source.localeCompare(b.source);
      });

      logger.debug(`[Stats Exchange Rates] Estadísticas calculadas: ${stats.length} fuentes`, {
        count: stats.length,
        sources: stats.map(s => s.source)
      });

      res.json(stats);
    } catch (error) {
      logger.error('❌ [Stats Exchange Rates] Error', error);
      res.status(500).json({ error: 'Failed to calculate exchange rate statistics' });
    }
  });

  // POST /api/treasury/exchange-rates/refresh-dof - Forzar actualización del DOF (admin)
  app.post("/api/treasury/exchange-rates/refresh-dof", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      console.log(`🔄 [Manual DOF Refresh] Solicitado por usuario ${user.id} (${user.email})`);
      
      const { fetchDOFExchangeRate } = await import("./dof-scheduler");
      await fetchDOFExchangeRate();
      
      res.json({ 
        success: true, 
        message: "Actualización del DOF ejecutada correctamente",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error al actualizar DOF manualmente:', error);
      res.status(500).json({ error: 'Failed to refresh DOF exchange rate' });
    }
  });

  // POST /api/treasury/exchange-rates - Registrar tipo de cambio
  app.post("/api/treasury/exchange-rates", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      let { buyRate, sellRate, source, notes } = req.body;

      // Validar que para DOF, buyRate === sellRate
      if (source?.toUpperCase() === 'DOF') {
        if (Math.abs(buyRate - sellRate) > 0.0001) {
          return res.status(400).json({ 
            error: 'Para DOF, el tipo de cambio de compra y venta deben ser iguales' 
          });
        }
        // Normalizar: usar el mismo valor para ambos
        sellRate = buyRate;
      }

      // Usar NOW() con timezone explícito para asegurar que la fecha tenga la hora exacta
      const result = await sql(`
        INSERT INTO exchange_rates (buy_rate, sell_rate, source, notes, created_by, date)
        VALUES ($1, $2, $3, $4, $5, NOW() AT TIME ZONE 'America/Mexico_City')
        RETURNING id, buy_rate, sell_rate, source, date::text as date, notes, created_by
      `, [buyRate, sellRate, source || null, notes || null, user.id]);

      const inserted = result[0];
      const dateObj = new Date(inserted.date);
      const formattedResult = {
        ...inserted,
        date: dateObj.toISOString()
      };
      
      console.log(`[Exchange Rate POST] Registro creado:`, {
        id: inserted.id,
        source: source,
        buyRate: buyRate,
        sellRate: sellRate,
        rawDate: inserted.date,
        isoDate: formattedResult.date,
        timestamp: new Date().toISOString()
      });

      // Trigger webhook a N8N para notificación de tipo de cambio
      const n8nWebhookUrl = process.env.N8N_EXCHANGE_RATE_WEBHOOK_URL;
      if (n8nWebhookUrl) {
        try {
          // Pre-formatear datos para que N8N no tenga que procesarlos
          const buyRateNum = parseFloat(buyRate);
          const sellRateNum = parseFloat(sellRate);

          // Usar hora actual para el email (el webhook se envía inmediatamente)
          // Esto evita problemas de timezone con la fecha de DB
          const now = new Date();
          const cdmxOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/Mexico_City' };
          const fechaCDMX = now.toLocaleDateString('sv-SE', cdmxOptions); // formato YYYY-MM-DD
          const horaCDMX = now.toLocaleTimeString('es-MX', { ...cdmxOptions, hour12: false });

          const webhookPayload = {
            event: 'exchange_rate_updated',
            // Datos crudos
            data: {
              id: inserted.id,
              buyRate: buyRateNum,
              sellRate: sellRateNum,
              source: source || 'manual',
              date: formattedResult.date,
              createdBy: user.name || user.email,
            },
            // Datos pre-formateados para el email (evita errores de JS en N8N)
            formatted: {
              asunto: `💱 Tipo de Cambio Actualizado - ${(source || 'MANUAL').toUpperCase()} - $${buyRateNum.toFixed(4)}`,
              fecha: fechaCDMX,
              hora: horaCDMX,
              compra: buyRateNum.toFixed(4),
              venta: sellRateNum.toFixed(4),
              fuente: (source || 'manual').toUpperCase(),
              usuario: user.name || user.email || 'Sistema',
            },
            timestamp: new Date().toISOString()
          };

          console.log(`[N8N Webhook] Enviando payload:`, JSON.stringify(webhookPayload, null, 2));

          fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          }).then(response => {
            console.log(`[N8N Webhook] Tipo de cambio enviado a N8N: ${response.status}`);
          }).catch(err => {
            console.error(`[N8N Webhook] Error enviando a N8N:`, err.message);
          });
        } catch (webhookError) {
          console.error(`[N8N Webhook] Error:`, webhookError);
        }
      }

      res.status(201).json(formattedResult);
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

  // Configure multer for file uploads (memoryStorage for R2 support)
  const upload = multer({
    storage: multer.memoryStorage(),
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

      // Upload to R2 or local storage
      const uploadResult = await uploadFile(
        file.buffer,
        'receipts',
        file.originalname,
        file.mimetype
      );
      console.log(`📤 [Receipt Upload] Archivo subido a ${uploadResult.storage}: ${uploadResult.url}`);

      const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'xml';

      const result = await sql(`
        INSERT INTO payment_receipts (payment_id, file_name, file_url, file_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [paymentId, file.originalname, uploadResult.url, fileType, user.id]);

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

      // Preparar archivos adjuntos (soporta R2 y local)
      const attachments = [];
      for (const receipt of receipts) {
        try {
          const fileContent = await getFile(receipt.file_url);
          const base64Content = fileContent.toString('base64');

          attachments.push({
            content: base64Content,
            filename: receipt.file_name,
            type: receipt.file_type === 'pdf' ? 'application/pdf' : 'application/xml',
            disposition: 'attachment'
          });
        } catch (err) {
          console.error(`⚠️ [Email] No se pudo obtener archivo: ${receipt.file_url}`, err);
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

  // Configurar multer para payment vouchers (memoryStorage para R2 upload)
  const voucherUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'application/xml',
        'text/xml',
        'application/xhtml+xml'
      ];
      const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.xml'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PDF, XML, PNG, JPG, JPEG'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // POST /api/scheduled-payments/:id/upload-voucher - Subir comprobante a tarjeta existente
  app.post("/api/scheduled-payments/:id/upload-voucher", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
    console.log(`📤 [Upload Voucher] Petición recibida para payment ID: ${req.params.id}`);
    console.log(`📤 [Upload Voucher] Content-Type:`, req.headers['content-type']);
    
    voucherUpload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ [Upload Voucher] Multer error:', {
          message: err.message,
          code: (err as any).code,
          field: (err as any).field,
          name: err.name
        });
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const scheduledPaymentId = parseInt(req.params.id);
      const file = req.file;

      console.log(`📤 [Upload Voucher] Procesando archivo para payment ID: ${scheduledPaymentId}`);
      console.log(`📤 [Upload Voucher] Archivo recibido:`, file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      } : 'NINGUNO');

      if (!file) {
        console.error('❌ [Upload Voucher] No se subió ningún archivo');
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      // Obtener el scheduled payment
      const { db } = await import('./db');
      const { scheduledPayments } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [scheduledPayment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));
      
      if (!scheduledPayment) {
        console.error(`❌ [Upload Voucher] Payment ID ${scheduledPaymentId} no encontrado`);
        return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
      }

      console.log(`📤 [Upload Voucher] Payment encontrado:`, {
        id: scheduledPayment.id,
        supplierName: scheduledPayment.supplierName,
        amount: scheduledPayment.amount
      });

      // Analizar el documento con OpenAI
      let analysis;
      try {
        console.log(`🤖 [Upload Voucher] Iniciando análisis con OpenAI...`);
        const { analyzePaymentDocument } = await import("./document-analyzer");
        // Usar buffer directamente (memoryStorage)
        const fileBuffer = file.buffer;

        analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);
        console.log(`✅ [Upload Voucher] Análisis completado:`, {
          documentType: analysis.documentType,
          extractedAmount: analysis.extractedAmount,
          ocrConfidence: analysis.ocrConfidence
        });
      } catch (analyzeError: any) {
        console.error('❌ [Upload Voucher] Error en análisis de documento:', analyzeError);
        // Si falla el análisis, continuar pero con valores por defecto
        analysis = {
          documentType: 'unknown' as any,
          extractedAmount: null,
          extractedDate: null,
          extractedBank: null,
          extractedReference: null,
          extractedCurrency: null,
          extractedOriginAccount: null,
          extractedDestinationAccount: null,
          extractedTrackingKey: null,
          extractedBeneficiaryName: null,
          ocrConfidence: 0,
        };
        console.log(`⚠️ [Upload Voucher] Continuando con análisis fallido (valores por defecto)`);
      }

      // Verificar que sea un comprobante (solo si el análisis fue exitoso)
      if (analysis.documentType && analysis.documentType !== 'voucher' && analysis.documentType !== 'rep' && analysis.documentType !== 'unknown') {
        console.error(`❌ [Upload Voucher] Tipo de documento inválido: ${analysis.documentType}`);
        return res.status(400).json({ 
          error: 'Documento inválido',
          details: 'Solo se pueden subir comprobantes de pago o REPs. Las facturas deben subirse primero.'
        });
      }

      // Obtener cliente/proveedor
      let client = null;
      if (scheduledPayment.supplierId) {
        client = await storage.getClient(scheduledPayment.supplierId);
      }
      if (!client && scheduledPayment.supplierName) {
        client = {
          id: scheduledPayment.supplierId || 0,
          name: scheduledPayment.supplierName,
          companyId: scheduledPayment.companyId,
          email: null,
          requiresPaymentComplement: false,
        } as any;
      }

      // Subir archivo a storage (R2 o local)
      console.log(`📤 [Upload Voucher] Subiendo archivo a storage...`);
      const uploadResult = await uploadFile(
        file.buffer,
        'comprobantes',
        file.originalname,
        file.mimetype
      );
      const voucherUrl = uploadResult.url;
      console.log(`✅ [Upload Voucher] Archivo subido a ${uploadResult.storage}: ${voucherUrl}`);

      // Determinar estado inicial
      const criticalFields = ['extractedAmount', 'extractedDate', 'extractedBank', 'extractedReference', 'extractedCurrency'];
      const hasAllCriticalFields = criticalFields.every(field => {
        const value = analysis[field as keyof typeof analysis];
        return value !== null && value !== undefined;
      });
      
      let initialStatus: string;
      if (hasAllCriticalFields && analysis.ocrConfidence >= 0.7) {
        // Datos completos y confiables -> factura pagada
        initialStatus = 'factura_pagada';
      } else {
        // Datos incompletos -> pendiente complemento para validar
        initialStatus = 'pendiente_complemento';
      }

      // Verificar si el monto coincide (con tolerancia del 1%)
      const amountDiff = Math.abs((scheduledPayment.amount - (analysis.extractedAmount || 0)) / scheduledPayment.amount);
      let finalStatus = initialStatus;
      if (amountDiff <= 0.01) {
        // Monto coincide -> cerrar contablemente
        finalStatus = 'cierre_contable';
      } else if (analysis.extractedAmount && analysis.extractedAmount < scheduledPayment.amount) {
        // Monto menor -> pendiente complemento
        finalStatus = 'pendiente_complemento';
      }

      // Crear comprobante vinculado
      console.log(`📝 [Upload Voucher] Preparando datos del voucher...`);
      const newVoucher: InsertPaymentVoucher = {
        companyId: scheduledPayment.companyId,
        payerCompanyId: scheduledPayment.companyId,
        clientId: client?.id || scheduledPayment.supplierId || 0,
        clientName: client?.name || scheduledPayment.supplierName || 'Cliente',
        scheduledPaymentId: scheduledPaymentId,
        status: finalStatus as any,
        voucherFileUrl: voucherUrl, // URL de R2 o local
        voucherFileName: file.originalname,
        voucherFileType: file.mimetype,
        extractedAmount: analysis.extractedAmount,
        extractedDate: analysis.extractedDate,
        extractedBank: analysis.extractedBank,
        extractedReference: analysis.extractedReference,
        extractedCurrency: analysis.extractedCurrency,
        extractedOriginAccount: analysis.extractedOriginAccount,
        extractedDestinationAccount: analysis.extractedDestinationAccount,
        extractedTrackingKey: analysis.extractedTrackingKey,
        extractedBeneficiaryName: analysis.extractedBeneficiaryName,
        ocrConfidence: analysis.ocrConfidence,
        uploadedBy: user.id,
      };

      console.log(`📝 [Upload Voucher] Creando voucher en la base de datos...`);
      let voucher;
      try {
        voucher = await storage.createPaymentVoucher(newVoucher);
        console.log(`✅ [Upload Voucher] Voucher creado con ID: ${voucher.id}`);
      } catch (dbError: any) {
        console.error('❌ [Upload Voucher] Error al crear voucher en la BD:', dbError);
        throw new Error(`Error al crear comprobante: ${dbError?.message || 'Error desconocido'}`);
      }

      // Actualizar scheduled payment con voucherId y estado
      // SIEMPRE cambiar el estado basado en si el cliente requiere REP
      // Si requiere REP → voucher_uploaded (En seguimiento REP)
      // Si NO requiere REP → payment_completed (Pagada)
      const requiresREP = client?.requiresPaymentComplement === true;
      const newStatus = requiresREP ? 'voucher_uploaded' : 'payment_completed';
      
      await db.update(scheduledPayments)
        .set({
          voucherId: voucher.id,
          status: newStatus,
          paidAt: new Date(), // Siempre actualizar cuando se sube comprobante
          paidBy: user.id, // Siempre actualizar cuando se sube comprobante
          updatedAt: new Date(),
        })
        .where(eq(scheduledPayments.id, scheduledPaymentId));
      
      console.log(`✅ [Upload Voucher] Scheduled payment ${scheduledPaymentId} actualizado: status=${newStatus} (requiere REP: ${requiresREP})`);

      console.log(`✅ [Upload Voucher] Comprobante vinculado a cuenta por pagar ${scheduledPaymentId}, voucher ID: ${voucher.id}`);

      // Obtener el scheduled payment actualizado
      const [updatedPayment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, scheduledPaymentId));

      res.status(201).json({
        voucher,
        scheduledPayment: updatedPayment,
        analysis,
        documentType: analysis.documentType,
        message: 'Comprobante subido y vinculado exitosamente'
      });
    } catch (error: any) {
      console.error('❌ [Upload Voucher] Error completo:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validación fallida', 
          details: error.errors 
        });
      }
      
      // Proporcionar mensaje de error más descriptivo
      const errorMessage = error?.message || 'Error al subir comprobante';
      console.error(`❌ [Upload Voucher] Respondiendo con error 500: ${errorMessage}`);
      
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // POST /api/payment-vouchers/upload - Subir comprobante con análisis automático OpenAI - 🔒 Con rate limiting
  console.log('✅ [Routes] Registrando endpoint POST /api/payment-vouchers/upload');
  
  // Endpoint de prueba para diagnosticar
  app.post("/api/payment-vouchers/upload-test", jwtAuthMiddleware, (req, res) => {
    console.log('🧪 [TEST] Endpoint de prueba llamado');
    console.log('🧪 [TEST] Content-Type:', req.headers['content-type']);
    console.log('🧪 [TEST] req.body:', req.body);
    console.log('🧪 [TEST] req.body keys:', Object.keys(req.body || {}));
    res.json({ 
      message: 'Test endpoint funcionando',
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      body: req.body
    });
  });
  
  app.post("/api/payment-vouchers/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
    console.log('📤 [Upload] ========== INICIO DE UPLOAD ==========');
    console.log('📤 [Upload] Petición recibida en /api/payment-vouchers/upload');
    console.log('📤 [Upload] Content-Type:', req.headers['content-type']);
    console.log('📤 [Upload] Content-Length:', req.headers['content-length']);
    console.log('📤 [Upload] req.body ANTES de multer:', req.body);
    console.log('📤 [Upload] req.body keys ANTES de multer:', Object.keys(req.body || {}));
    
    voucherUpload.single('voucher')(req, res, (err) => {
      if (err) {
        console.error('❌ [Multer] Error detectado:', {
          message: err.message,
          code: (err as any).code,
          field: (err as any).field,
          name: err.name
        });
        console.error('❌ [Multer] Stack trace:', err.stack);
        
        // Determinar el tipo de error y dar mensaje más específico
        let errorDetails = err.message;
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          errorDetails = 'El archivo excede el tamaño máximo permitido (10MB)';
        } else if ((err as any).code === 'LIMIT_UNEXPECTED_FILE') {
          errorDetails = 'Campo de archivo inesperado. Asegúrate de usar el campo "voucher"';
        } else if (err.message.includes('Solo se permiten')) {
          errorDetails = err.message;
        }
        
        return res.status(400).json({ 
          error: 'Error al procesar archivo', 
          details: errorDetails,
          code: (err as any).code || 'MULTER_ERROR'
        });
      }
      console.log('✅ [Multer] Archivo procesado exitosamente');
      console.log('📤 [Upload] req.body DESPUÉS de multer:', req.body);
      console.log('📤 [Upload] req.body keys DESPUÉS de multer:', Object.keys(req.body || {}));
      console.log('📤 [Upload] req.file:', req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'null');
      next();
    });
  }, async (req, res) => {
    try {
      const user = getAuthUser(req as AuthRequest);
      const file = req.file;

      console.log('📁 [Upload] Archivo recibido:', file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      } : 'null');

      if (!file) {
        console.error('❌ [Upload] No se recibió ningún archivo');
        return res.status(400).json({
          error: 'No se subió ningún archivo',
          details: 'Asegúrate de seleccionar un archivo antes de subirlo'
        });
      }

      // ✅ SIMPLIFIED SECURITY: Validación de archivo simplificada pero segura
      // Validamos la extensión (ya que multer validó el mimetype)
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      const allowedExtensions = ['.pdf', '.xml', '.png', '.jpg', '.jpeg'];

      if (!allowedExtensions.includes(fileExtension)) {
        console.error(`❌ [Upload] Extensión no permitida: ${fileExtension}`);
        return res.status(400).json({
          error: 'Tipo de archivo no permitido',
          details: `Solo se permiten archivos: ${allowedExtensions.join(', ')}`
        });
      }

      console.log(`✅ [Upload] Archivo aceptado: ${file.originalname} (${fileExtension})`);

      // Analizar el documento primero para determinar el tipo
      console.log('🔍 [Upload] Iniciando análisis del documento...');
      const { analyzePaymentDocument } = await import("./document-analyzer");
      // Usar buffer directamente (memoryStorage)
      const fileBuffer = file.buffer;

      console.log('📄 [Upload] Buffer disponible, tamaño:', fileBuffer.length, 'bytes');
      let analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);
      console.log('✅ [Upload] Análisis completado - DATOS EXTRAÍDOS:', JSON.stringify({
        documentType: analysis?.documentType,
        ocrConfidence: analysis?.ocrConfidence,
        extractedAmount: analysis?.extractedAmount,
        extractedSupplierName: analysis?.extractedSupplierName,
        extractedDueDate: analysis?.extractedDueDate ? analysis.extractedDueDate.toISOString() : null,
        extractedDate: analysis?.extractedDate ? analysis.extractedDate.toISOString() : null,
        extractedInvoiceNumber: analysis?.extractedInvoiceNumber,
        extractedTaxId: analysis?.extractedTaxId,
        extractedCurrency: analysis?.extractedCurrency,
        extractedReference: analysis?.extractedReference
      }, null, 2));

      // 🔍 DEBUG: Log completo del análisis para diagnóstico
      console.log('🔍 [Upload DEBUG] Tipo detectado:', analysis?.documentType);
      console.log('🔍 [Upload DEBUG] ¿Es factura?:', analysis?.documentType === 'invoice');
      console.log('🔍 [Upload DEBUG] ¿Es comprobante?:', analysis?.documentType === 'voucher');
      if (analysis?.documentType && analysis.documentType !== 'invoice' && analysis.documentType !== 'voucher') {
        console.warn(`⚠️ [Upload WARNING] Tipo de documento inesperado: ${analysis.documentType}`);
      }

      // Validar request body - hacer más flexible para manejar FormData
      // Multer parsea FormData y los campos están en req.body como strings
      console.log('📋 [Upload] req.body recibido:', JSON.stringify(req.body, null, 2));
      console.log('📋 [Upload] req.body keys:', Object.keys(req.body || {}));
      
      // Función helper para parsear números de FormData
      const parseNumber = (val: any): number | undefined => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = typeof val === 'string' ? Number(val) : val;
        if (isNaN(num) || num <= 0) return undefined;
        return num;
      };

      // Parsear datos manualmente para mayor control
      const validatedData = {
        payerCompanyId: parseNumber(req.body?.payerCompanyId),
        supplierId: parseNumber(req.body?.supplierId), // ✅ FIX: Parsear supplierId del frontend
        clientId: parseNumber(req.body?.clientId),
        companyId: parseNumber(req.body?.companyId),
        scheduledPaymentId: parseNumber(req.body?.scheduledPaymentId),
        notes: req.body?.notes || undefined,
        notify: req.body?.notify === 'true' || req.body?.notify === '1' || req.body?.notify === true,
        emailTo: req.body?.emailTo
          ? (Array.isArray(req.body.emailTo) ? req.body.emailTo : req.body.emailTo.split(',').map((e: string) => e.trim()).filter((e: string) => e))
          : [],
        emailCc: req.body?.emailCc
          ? (Array.isArray(req.body.emailCc) ? req.body.emailCc : req.body.emailCc.split(',').map((e: string) => e.trim()).filter((e: string) => e))
          : [],
        emailMessage: req.body?.emailMessage || undefined,
      };

      console.log('✅ [Upload] Datos parseados:', validatedData);

      // Para facturas, payerCompanyId es requerido
      if (analysis.documentType === 'invoice' && !validatedData.payerCompanyId) {
        return res.status(400).json({ 
          error: 'PayerCompanyId requerido', 
          details: 'Se requiere especificar la empresa pagadora para procesar la factura. Asegúrate de seleccionar la empresa antes de subir el archivo.' 
        });
      }

      console.log(`📤 [Upload] Procesando documento: ${file.originalname} (tipo: ${analysis.documentType})`);

      // 🧾 LÓGICA INTELIGENTE REFACTORIZADA: Priorizar intención del usuario sobre detección automática
      // PRINCIPIO: Si el usuario seleccionó empresa (payerCompanyId) y NO hay tarjeta existente (scheduledPaymentId),
      // entonces es factura nueva, independientemente de qué detecte OpenAI.
      // OpenAI solo sirve para PRELLENAR datos, no para determinar intención.
      
      // Manejo de errores: Si el análisis falla completamente, crear objeto por defecto
      if (!analysis || !analysis.documentType) {
        console.warn('[Upload] ⚠️ Análisis falló o retornó null, usando valores por defecto');
        const existingAnalysis = analysis || {};
        analysis = {
          documentType: (existingAnalysis.documentType || 'unknown') as "invoice" | "voucher" | "rep" | "unknown",
          extractedAmount: existingAnalysis.extractedAmount ?? null,
          extractedSupplierName: existingAnalysis.extractedSupplierName ?? null,
          extractedDueDate: existingAnalysis.extractedDueDate ?? null,
          extractedDate: existingAnalysis.extractedDate ?? null,
          extractedInvoiceNumber: existingAnalysis.extractedInvoiceNumber ?? null,
          extractedReference: existingAnalysis.extractedReference ?? null,
          extractedTaxId: existingAnalysis.extractedTaxId ?? null,
          extractedCurrency: (existingAnalysis.extractedCurrency || 'MXN') as string,
          extractedBank: existingAnalysis.extractedBank ?? null,
          extractedOriginAccount: existingAnalysis.extractedOriginAccount ?? null,
          extractedDestinationAccount: existingAnalysis.extractedDestinationAccount ?? null,
          extractedTrackingKey: existingAnalysis.extractedTrackingKey ?? null,
          extractedBeneficiaryName: existingAnalysis.extractedBeneficiaryName ?? null,
          ocrConfidence: existingAnalysis.ocrConfidence ?? 0,
          rawResponse: existingAnalysis.rawResponse,
          relatedInvoiceUUID: existingAnalysis.relatedInvoiceUUID ?? null,
          paymentMethod: existingAnalysis.paymentMethod ?? null
        };
      }

      const hasInvoiceCharacteristics = (
        analysis.extractedSupplierName || 
        (analysis.extractedAmount && analysis.documentType !== 'voucher' && analysis.documentType !== 'rep')
      );
      
      // ✅ NUEVA LÓGICA: Priorizar intención del usuario
      let shouldCreateInvoice: boolean;
      let decisionReason: string;

      // PRIORIDAD 1: Si hay scheduledPaymentId → es comprobante para tarjeta existente (intención clara)
      if (validatedData.scheduledPaymentId) {
        shouldCreateInvoice = false;
        decisionReason = 'COMPROBANTE_EXISTENTE';
      }
      // PRIORIDAD 2: Si hay payerCompanyId y NO scheduledPaymentId → es factura nueva (intención del usuario)
      else if (validatedData.payerCompanyId) {
        shouldCreateInvoice = true;
        decisionReason = 'FACTURA_NUEVA_INTENCION_USUARIO';
      }
      // PRIORIDAD 3: Fallback a detección de OpenAI solo si no hay intención clara del usuario
      else {
        const detectedAsInvoice: boolean = Boolean(
          analysis.documentType === 'invoice' ||
          (analysis.documentType === 'unknown' && hasInvoiceCharacteristics)
        );
        shouldCreateInvoice = detectedAsInvoice;
        decisionReason = detectedAsInvoice ? 'DETECCION_OPENAI' : 'FALLO_DETECCION';
      }

      // Logging estructurado con razón de decisión
      console.log('🤖 [Upload] Decisión automática:', JSON.stringify({
        documentType: analysis.documentType || 'NULL',
        hasScheduledPaymentId: !!validatedData.scheduledPaymentId,
        scheduledPaymentId: validatedData.scheduledPaymentId || null,
        hasPayerCompanyId: !!validatedData.payerCompanyId,
        payerCompanyId: validatedData.payerCompanyId || null,
        hasInvoiceCharacteristics: hasInvoiceCharacteristics,
        extractedSupplierName: analysis.extractedSupplierName ? analysis.extractedSupplierName.substring(0, 50) : "NO ENCONTRADO",
        extractedAmount: analysis.extractedAmount || "NO ENCONTRADO",
        extractedDueDate: analysis.extractedDueDate ? "SÍ" : "NO",
        shouldCreateInvoice: shouldCreateInvoice,
        decisionReason: decisionReason
      }, null, 2));

      // 🧾 Si debe crear FACTURA/TARJETA DE PAGO, guardar archivo y devolver datos para verificación
      if (shouldCreateInvoice) {
        // Validación más flexible: permitir verificación manual incluso si faltan algunos campos
        // El usuario podrá completar los campos faltantes en el modal de verificación
        console.log(`📋 [Invoice Detection] Datos extraídos del análisis:`, {
          supplierName: analysis.extractedSupplierName || "NO ENCONTRADO",
          amount: analysis.extractedAmount || "NO ENCONTRADO",
          dueDate: analysis.extractedDueDate || "NO ENCONTRADO",
          invoiceDate: analysis.extractedDate || "NO ENCONTRADO",
          invoiceNumber: analysis.extractedInvoiceNumber || "NO ENCONTRADO",
          taxId: analysis.extractedTaxId || "NO ENCONTRADO",
          currency: analysis.extractedCurrency || "NO ENCONTRADO",
          documentType: analysis.documentType,
          ocrConfidence: analysis.ocrConfidence
        });
        
        // Si no hay monto, mostrar advertencia pero permitir verificación manual
        if (!analysis.extractedAmount) {
          console.warn(`⚠️ [Invoice Detection] ADVERTENCIA: No se pudo extraer el monto de la factura. Se permitirá verificación manual.`);
          // NO rechazar, permitir que el usuario complete el monto manualmente
        }

        // Si falta proveedor o fecha de vencimiento, aún permitir verificación manual
        // El usuario podrá completar estos campos en el modal
        if (!analysis.extractedSupplierName) {
          console.warn(`⚠️ [Invoice Detection] Proveedor no encontrado en factura. Se permitirá verificación manual.`);
        }
        
        if (!analysis.extractedDueDate) {
          console.warn(`⚠️ [Invoice Detection] Fecha de vencimiento no encontrada. Se calculará o el usuario la especificará.`);
          // Si hay fecha de factura, calcular fecha de vencimiento por defecto (+30 días)
          if (analysis.extractedDate) {
            const defaultDueDate = new Date(analysis.extractedDate);
            defaultDueDate.setDate(defaultDueDate.getDate() + 30);
            analysis.extractedDueDate = defaultDueDate;
            console.log(`📅 [Invoice Detection] Fecha de vencimiento calculada por defecto: ${defaultDueDate.toISOString().split('T')[0]}`);
          }
        }

        try {
          console.log(`📋 [Invoice Detection] Factura detectada, preparando datos para verificación`);
          
          // Preservar null si no se extrajo (no convertir a '')
          const supplierName = analysis.extractedSupplierName ?? null;
          const taxId = analysis.extractedTaxId ?? null;
          
          // Buscar cliente/proveedor existente con búsqueda mejorada
          if (!validatedData.payerCompanyId) {
            return res.status(400).json({ error: 'PayerCompanyId requerido para procesar factura' });
          }
          const payerCompanyId = validatedData.payerCompanyId; // Type narrowing
          
          // Función mejorada de matching de proveedores
          const findBestSupplierMatch = async (
            extractedName: string | null,
            extractedTaxId: string | null
          ): Promise<{ supplier: any; confidence: number; source: 'client' | 'supplier' } | null> => {
            if (!extractedName && !extractedTaxId) return null;
            
            // Normalizar nombres
            const normalizeName = (name: string): string => {
              if (!name) return '';
              return name
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remover acentos
                .replace(/[^a-z0-9\s]/g, "") // Remover caracteres especiales
                .replace(/\s+/g, " ") // Normalizar espacios
                .trim();
            };
            
            // Calcular similitud (Levenshtein simplificado)
            const calculateSimilarity = (str1: string, str2: string): number => {
              const longer = str1.length > str2.length ? str1 : str2;
              const shorter = str1.length > str2.length ? str2 : str1;
              if (longer.length === 0) return 1.0;
              const distance = levenshteinDistance(longer, shorter);
              return (longer.length - distance) / longer.length;
            };
            
            const levenshteinDistance = (str1: string, str2: string): number => {
              const matrix: number[][] = [];
              for (let i = 0; i <= str2.length; i++) {
                matrix[i] = [i];
              }
              for (let j = 0; j <= str1.length; j++) {
                matrix[0][j] = j;
              }
              for (let i = 1; i <= str2.length; i++) {
                for (let j = 1; j <= str1.length; j++) {
                  if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                  } else {
                    matrix[i][j] = Math.min(
                      matrix[i - 1][j - 1] + 1,
                      matrix[i][j - 1] + 1,
                      matrix[i - 1][j] + 1
                    );
                  }
                }
              }
              return matrix[str2.length][str1.length];
            };
            
            const normalizedSupplierName = extractedName ? normalizeName(extractedName) : '';
            
            // ESTRATEGIA 1: Buscar por RFC/Tax ID (más confiable - 95% confianza)
            if (extractedTaxId) {
              // Buscar en clients (si tienen campo taxId/RFC)
              const allClients = await storage.getClientsByCompany(payerCompanyId);
              const clientByTaxId = allClients.find((client: any) => {
                // Buscar en notes o en cualquier campo que pueda contener RFC
                const clientText = JSON.stringify(client).toLowerCase();
                const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
                return clientText.includes(normalizedTaxId);
              });
              
              if (clientByTaxId) {
                return { supplier: clientByTaxId, confidence: 0.95, source: 'client' };
              }
              
              // Buscar en suppliers (si tienen campo taxId/RFC)
              const { db } = await import('./db');
              const { suppliers } = await import('../shared/schema');
              const { eq, and, sql } = await import('drizzle-orm');
              
              const allSuppliers = await db.select().from(suppliers)
                .where(and(
                  eq(suppliers.companyId, payerCompanyId),
                  eq(suppliers.isActive, true)
                ));
              
              const supplierByTaxId = allSuppliers.find((supplier: any) => {
                const supplierText = JSON.stringify(supplier).toLowerCase();
                const normalizedTaxId = extractedTaxId.toLowerCase().replace(/[^a-z0-9]/g, '');
                return supplierText.includes(normalizedTaxId);
              });
              
              if (supplierByTaxId) {
                return { supplier: supplierByTaxId, confidence: 0.95, source: 'supplier' };
              }
            }
            
            // ESTRATEGIA 2: Buscar por nombre exacto (85% confianza)
            if (extractedName) {
              const allClients = await storage.getClientsByCompany(payerCompanyId);
              const exactMatch = allClients.find((client: any) => {
                const normalizedClientName = normalizeName(client.name);
                return normalizedClientName === normalizedSupplierName;
              });
              
              if (exactMatch) {
                return { supplier: exactMatch, confidence: 0.85, source: 'client' };
              }
              
              // Buscar en suppliers también
              const { db } = await import('./db');
              const { suppliers } = await import('../shared/schema');
              const { eq, and } = await import('drizzle-orm');
              
              const allSuppliers = await db.select().from(suppliers)
                .where(and(
                  eq(suppliers.companyId, payerCompanyId),
                  eq(suppliers.isActive, true)
                ));
              
              const exactSupplierMatch = allSuppliers.find((supplier: any) => {
                const normalizedSupplierName2 = normalizeName(supplier.name || supplier.shortName || '');
                return normalizedSupplierName2 === normalizedSupplierName;
              });
              
              if (exactSupplierMatch) {
                return { supplier: exactSupplierMatch, confidence: 0.85, source: 'supplier' };
              }
            }
            
            // ESTRATEGIA 3: Fuzzy matching (70-80% confianza)
            if (extractedName) {
              const allClients = await storage.getClientsByCompany(payerCompanyId);
              const fuzzyMatches: Array<{ supplier: any; confidence: number; source: 'client' | 'supplier' }> = [];
              
              allClients.forEach((client: any) => {
                const normalizedClientName = normalizeName(client.name);
                const similarity = calculateSimilarity(normalizedSupplierName, normalizedClientName);
                
                // Coincidencia parcial (una contiene a la otra)
                const containsMatch = normalizedClientName.includes(normalizedSupplierName) || 
                                     normalizedSupplierName.includes(normalizedClientName);
                
                // Coincidencia de palabras clave
                const supplierWords = normalizedSupplierName.split(/\s+/).filter(w => w.length > 3);
                const clientWords = normalizedClientName.split(/\s+/).filter(w => w.length > 3);
                const commonWords = supplierWords.filter(w => clientWords.includes(w));
                const wordMatch = commonWords.length >= 2 || (commonWords.length >= 1 && supplierWords.length <= 3);
                
                let confidence = 0;
                if (similarity > 0.9) confidence = 0.8;
                else if (similarity > 0.7) confidence = 0.75;
                else if (containsMatch) confidence = 0.7;
                else if (wordMatch) confidence = 0.7;
                
                if (confidence >= 0.7) {
                  fuzzyMatches.push({ supplier: client, confidence, source: 'client' });
                }
              });
              
              // Buscar en suppliers también
              const { db } = await import('./db');
              const { suppliers } = await import('../shared/schema');
              const { eq, and } = await import('drizzle-orm');
              
              const allSuppliers = await db.select().from(suppliers)
                .where(and(
                  eq(suppliers.companyId, payerCompanyId),
                  eq(suppliers.isActive, true)
                ));
              
              allSuppliers.forEach((supplier: any) => {
                const supplierDisplayName = supplier.name || supplier.shortName || '';
                const normalizedSupplierName2 = normalizeName(supplierDisplayName);
                const similarity = calculateSimilarity(normalizedSupplierName, normalizedSupplierName2);
                
                const containsMatch = normalizedSupplierName2.includes(normalizedSupplierName) || 
                                     normalizedSupplierName.includes(normalizedSupplierName2);
                
                const supplierWords = normalizedSupplierName.split(/\s+/).filter(w => w.length > 3);
                const supplierWords2 = normalizedSupplierName2.split(/\s+/).filter(w => w.length > 3);
                const commonWords = supplierWords.filter(w => supplierWords2.includes(w));
                const wordMatch = commonWords.length >= 2 || (commonWords.length >= 1 && supplierWords.length <= 3);
                
                let confidence = 0;
                if (similarity > 0.9) confidence = 0.8;
                else if (similarity > 0.7) confidence = 0.75;
                else if (containsMatch) confidence = 0.7;
                else if (wordMatch) confidence = 0.7;
                
                if (confidence >= 0.7) {
                  fuzzyMatches.push({ supplier, confidence, source: 'supplier' });
                }
              });
              
              // Retornar el mejor match
              if (fuzzyMatches.length > 0) {
                fuzzyMatches.sort((a, b) => b.confidence - a.confidence);
                return fuzzyMatches[0];
              }
            }
            
            return null;
          };
          
          // Usar la función mejorada de matching
          let matchingSupplier: any = null;
          let finalSupplierId: number | null = null;
          let matchConfidence = 0;

          // ✅ FIX: Priorizar supplierId del frontend (usuario ya seleccionó proveedor)
          if (validatedData.supplierId) {
            console.log(`🔗 [Invoice Detection] Usando supplierId del frontend: ${validatedData.supplierId}`);

            // Buscar el proveedor en la BD por ID
            const { db } = await import('./db');
            const { suppliers } = await import('../shared/schema');
            const { eq } = await import('drizzle-orm');

            const [supplierFromDb] = await db.select().from(suppliers).where(eq(suppliers.id, validatedData.supplierId));

            if (supplierFromDb) {
              matchingSupplier = supplierFromDb;
              finalSupplierId = supplierFromDb.id;
              matchConfidence = 1.0; // 100% confianza porque el usuario lo seleccionó
              console.log(`✅ [Invoice Detection] Proveedor del frontend encontrado: ${supplierFromDb.name} (ID: ${finalSupplierId})`);
            } else {
              console.warn(`⚠️ [Invoice Detection] supplierId ${validatedData.supplierId} no encontrado en BD, intentando matching por extracción`);
            }
          }

          // Si no hay supplierId del frontend o no se encontró, intentar matching por extracción
          if (!matchingSupplier && (supplierName || taxId)) {
            const matchResult = await findBestSupplierMatch(supplierName, taxId);
            if (matchResult) {
              matchingSupplier = matchResult.supplier;
              finalSupplierId = matchingSupplier.id;
              matchConfidence = matchResult.confidence;
              console.log(`🔗 [Invoice Detection] Proveedor encontrado por extracción (${matchResult.source}): ${matchingSupplier.name} (ID: ${finalSupplierId}, Confianza: ${(matchConfidence * 100).toFixed(0)}%)`);
            } else {
              console.log(`⚠️ [Invoice Detection] Proveedor "${supplierName || 'N/A'}" no encontrado en base de datos`);
            }
          } else if (!matchingSupplier) {
            console.log(`⚠️ [Invoice Detection] Sin supplierId del frontend y sin datos de extracción, requerirá selección manual`);
          }

          // Guardar el archivo de factura temporalmente para verificación
          // (siempre local porque es temporal - se moverá a R2 al confirmar)
          const invoiceFilePath = saveTempFile(fileBuffer, 'facturas', file.originalname);
          
          // Log detallado de datos extraídos
          const hasSupplier = !!analysis.extractedSupplierName;
          const hasAmount = !!analysis.extractedAmount;
          const hasDueDate = !!analysis.extractedDueDate;
          
          console.log(`📋 [Invoice Detection] Datos extraídos para verificación:`, {
            supplierName: analysis.extractedSupplierName || "⚠️ NO ENCONTRADO - requerirá entrada manual",
            amount: analysis.extractedAmount || "⚠️ NO ENCONTRADO - requerirá entrada manual",
            currency: analysis.extractedCurrency || 'MXN',
            dueDate: analysis.extractedDueDate ? analysis.extractedDueDate.toISOString().split('T')[0] : "⚠️ NO ENCONTRADO - se calculará o requerirá entrada manual",
            invoiceDate: analysis.extractedDate ? analysis.extractedDate.toISOString().split('T')[0] : "NO ENCONTRADO",
            invoiceNumber: analysis.extractedInvoiceNumber || "NO ENCONTRADO",
            taxId: analysis.extractedTaxId || "NO ENCONTRADO",
            confidence: (analysis.ocrConfidence * 100).toFixed(1) + "%",
            summary: `Proveedor: ${hasSupplier ? '✅' : '❌'}, Monto: ${hasAmount ? '✅' : '❌'}, Fecha Vencimiento: ${hasDueDate ? '✅' : '❌'}`
          });

          // Construir mensaje descriptivo según qué datos se encontraron
          let message = 'Factura detectada. ';
          if (hasSupplier && hasAmount && hasDueDate) {
            message += 'Datos extraídos correctamente. Por favor verifica la información y especifica la fecha de pago.';
          } else if (hasAmount && hasSupplier) {
            message += 'Se extrajo el proveedor y el monto. Por favor completa la fecha de vencimiento (si falta) y especifica la fecha de pago.';
          } else if (hasAmount) {
            message += 'Se extrajo el monto, pero faltan algunos datos. Por favor completa el proveedor, fecha de vencimiento (si falta) y especifica la fecha de pago.';
          } else {
            message += 'Algunos datos no se pudieron extraer automáticamente. Por favor completa todos los campos necesarios (proveedor, monto, fecha de vencimiento) y especifica la fecha de pago.';
          }

          // Retornar datos extraídos para verificación (NO crear cuenta por pagar aún)
          // SIEMPRE permitir verificación manual, incluso si faltan todos los campos
          console.log(`✅ [Invoice Detection] Retornando datos para verificación manual (siempre permitido)`);
          
          // Preparar respuesta con datos extraídos
          // IMPORTANTE: Preservar null (no convertir a '') para que el frontend pueda usar fallbacks
          const responseData = {
            requiresVerification: true,
            documentType: 'invoice',
            analysis: {
              // Preservar null en lugar de convertir a '' - permite que frontend use supplier.name como fallback
              extractedSupplierName: analysis.extractedSupplierName ?? null, // null si no se encontró (no '')
              extractedAmount: analysis.extractedAmount ?? null, // null si no se encontró
              extractedCurrency: analysis.extractedCurrency ?? 'MXN', // Default solo si es null/undefined
              extractedDueDate: analysis.extractedDueDate ? analysis.extractedDueDate.toISOString() : null,
              extractedDate: analysis.extractedDate ? analysis.extractedDate.toISOString() : null, // Incluir fecha de factura
              extractedInvoiceNumber: analysis.extractedInvoiceNumber ?? null,
              extractedReference: analysis.extractedReference ?? null,
              extractedTaxId: analysis.extractedTaxId ?? null,
              // Campos adicionales extraídos
              extractedBank: analysis.extractedBank ?? null,
              extractedOriginAccount: analysis.extractedOriginAccount ?? null,
              extractedDestinationAccount: analysis.extractedDestinationAccount ?? null,
              extractedTrackingKey: analysis.extractedTrackingKey ?? null,
              extractedBeneficiaryName: analysis.extractedBeneficiaryName ?? null,
              paymentMethod: analysis.paymentMethod ?? null,
              paymentTerms: analysis.paymentTerms ?? null,
              transferType: analysis.transferType ?? null,
            },
            invoiceFile: {
              path: invoiceFilePath,
              originalName: file.originalname,
            },
            supplier: {
              id: finalSupplierId,
              // ✅ FIX: Priorizar nombre del proveedor seleccionado (del frontend) sobre el extraído
              name: (matchingSupplier ? matchingSupplier.name : null) ?? supplierName ?? null,
            },
            payerCompanyId: payerCompanyId,
            message: message,
            matchConfidence: matchConfidence,
            extractionConfidence: analysis.ocrConfidence, // Confianza de extracción de datos
            supplierSuggestions: matchingSupplier ? [{
              id: matchingSupplier.id,
              name: matchingSupplier.name,
              confidence: matchConfidence,
            }] : [],
          };
          
          // Log detallado de lo que se está retornando
          console.log('📤 [Invoice Detection] Datos que se retornan al frontend:', JSON.stringify({
            extractedSupplierName: responseData.analysis.extractedSupplierName,
            extractedAmount: responseData.analysis.extractedAmount,
            extractedCurrency: responseData.analysis.extractedCurrency,
            extractedDueDate: responseData.analysis.extractedDueDate,
            extractedDate: responseData.analysis.extractedDate,
            extractedInvoiceNumber: responseData.analysis.extractedInvoiceNumber,
            extractedTaxId: responseData.analysis.extractedTaxId,
            supplierId: responseData.supplier.id,
            supplierName: responseData.supplier.name,
            payerCompanyId: responseData.payerCompanyId
          }, null, 2));
          
          return res.status(200).json(responseData);
          
          // ✅ IMPORTANTE: Retornar aquí para evitar que continúe al bloque de comprobantes
          return;
          
        } catch (invoiceError) {
          console.error(`❌ [Invoice Detection] Error procesando factura:`, invoiceError);
          return res.status(500).json({ 
            error: 'Error al procesar factura', 
            details: invoiceError instanceof Error ? invoiceError.message : 'Error desconocido' 
          });
        }
      }

      // ✅ NOTA: Ya no rechazamos comprobantes sin scheduledPaymentId
      // La lógica inteligente arriba decide si crear tarjeta o comprobante
      // Si llegamos aquí, es porque NO es una factura, es un comprobante

      // Para comprobantes, obtener el cliente desde scheduledPayment o clientId
      let client = null;
      let scheduledPaymentForClient = null;
      if (validatedData.scheduledPaymentId) {
        // Usar Drizzle directamente para obtener scheduled payment
        const { db } = await import('./db');
        const { scheduledPayments } = await import('../shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const [payment] = await db.select().from(scheduledPayments).where(eq(scheduledPayments.id, validatedData.scheduledPaymentId));
        scheduledPaymentForClient = payment;
        
        if (!scheduledPaymentForClient) {
          return res.status(404).json({ error: 'Cuenta por pagar no encontrada' });
        }
        // Buscar cliente por supplierId si existe
        if (scheduledPaymentForClient.supplierId) {
          client = await storage.getClient(scheduledPaymentForClient.supplierId);
        }
        // Si no hay cliente pero hay supplierName, crear un objeto cliente temporal
        if (!client && scheduledPaymentForClient.supplierName) {
          client = {
            id: scheduledPaymentForClient.supplierId || 0,
            name: scheduledPaymentForClient.supplierName,
            companyId: scheduledPaymentForClient.companyId,
            email: null,
            requiresPaymentComplement: false,
          } as any;
        }
      } else if (validatedData.clientId) {
        client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(404).json({ error: 'Cliente no encontrado' });
        }
      } else {
        return res.status(400).json({ error: 'Se requiere clientId o scheduledPaymentId para comprobantes' });
      }

      // Determinar estado inicial basado en calidad del OCR (solo para comprobantes)
      // Si todos los campos críticos están presentes -> VALIDADO
      // Si faltan campos críticos -> PENDIENTE_VALIDACIÓN
      const criticalFields = (analysis.documentType === 'voucher' || analysis.documentType === 'rep')
        ? ['extractedAmount', 'extractedDate', 'extractedBank', 'extractedReference', 'extractedCurrency']
        : ['extractedAmount', 'extractedSupplierName', 'extractedDueDate'];
      const hasAllCriticalFields = criticalFields.every(field => {
        const value = analysis[field as keyof typeof analysis];
        return value !== null && value !== undefined;
      });
      
      let initialStatus: string;
      if (hasAllCriticalFields && analysis.ocrConfidence >= 0.7) {
        // Datos completos y confiables -> factura pagada
        initialStatus = 'factura_pagada';
      } else {
        // Datos incompletos -> pendiente complemento para validar
        initialStatus = 'pendiente_complemento';
      }

      // Subir archivo a storage (R2 o local)
      console.log(`📤 [Upload] Subiendo comprobante a storage...`);
      const voucherUploadResult = await uploadFile(
        fileBuffer,
        'comprobantes',
        file.originalname,
        file.mimetype
      );
      const voucherFileUrl = voucherUploadResult.url;
      console.log(`✅ [Upload] Comprobante subido a ${voucherUploadResult.storage}: ${voucherFileUrl}`);

      // Usar companyId del cliente si no se especifica
      const voucherCompanyId = validatedData.companyId || client?.companyId || validatedData.payerCompanyId;

      // Crear comprobante usando storage
      // Asegurar que clientId sea un número válido (no null)
      const voucherClientId = validatedData.clientId || (scheduledPaymentForClient?.supplierId ?? 0);
      if (!voucherClientId || voucherClientId === 0) {
        return res.status(400).json({ error: 'Se requiere un cliente válido para crear el comprobante' });
      }

      // Validar que payerCompanyId esté presente para comprobantes
      if (!validatedData.payerCompanyId) {
        return res.status(400).json({ error: 'PayerCompanyId requerido para crear comprobante' });
      }
      const payerCompanyIdForVoucher = validatedData.payerCompanyId; // Type narrowing

      const newVoucher: InsertPaymentVoucher = {
        companyId: voucherCompanyId,
        payerCompanyId: payerCompanyIdForVoucher,
        clientId: voucherClientId,
        clientName: client?.name || scheduledPaymentForClient?.supplierName || 'Cliente',
        scheduledPaymentId: validatedData.scheduledPaymentId || null,
        status: initialStatus as any,
        voucherFileUrl: voucherFileUrl, // URL de R2 o local
        voucherFileName: file.originalname,
        voucherFileType: file.mimetype,
        extractedAmount: analysis.extractedAmount,
        extractedDate: analysis.extractedDate,
        extractedBank: analysis.extractedBank,
        extractedReference: analysis.extractedReference,
        extractedCurrency: analysis.extractedCurrency,
        extractedOriginAccount: analysis.extractedOriginAccount,
        extractedDestinationAccount: analysis.extractedDestinationAccount,
        extractedTrackingKey: analysis.extractedTrackingKey,
        extractedBeneficiaryName: analysis.extractedBeneficiaryName,
        ocrConfidence: analysis.ocrConfidence,
        notify: validatedData.notify || false,
        emailTo: validatedData.emailTo || [],
        emailCc: validatedData.emailCc || [],
        emailMessage: validatedData.emailMessage || null,
        notes: validatedData.notes || null,
        uploadedBy: user.id,
      };

      const voucher = await storage.createPaymentVoucher(newVoucher);

      // 🏦 AUTOMATIZACIÓN: Procesamiento automático
      let finalStatus = initialStatus;
      let linkedInvoiceId: number | null = null;
      let linkedInvoiceUuid: string | null = null;

      try {
        // 1. Intentar vincular con factura/pago programado
        if (validatedData.scheduledPaymentId && scheduledPaymentForClient) {
          const scheduledPayment = scheduledPaymentForClient;
          if (scheduledPayment) {
            // Verificar si el monto coincide (con tolerancia del 1%)
            const amountDiff = Math.abs((scheduledPayment.amount - (analysis.extractedAmount || 0)) / scheduledPayment.amount);
            if (amountDiff <= 0.01) {
              // Monto coincide -> CIERRE_CONTABLE
              finalStatus = 'cierre_contable';
              linkedInvoiceId = scheduledPayment.id;
              console.log(`🔗 [Automation] Vinculado con pago programado ${scheduledPayment.id}`);
            } else if (analysis.extractedAmount && analysis.extractedAmount < scheduledPayment.amount) {
              // Pago parcial -> PENDIENTE_COMPLEMENTO
              finalStatus = 'pendiente_complemento';
              console.log(`⚠️ [Automation] Pago parcial detectado`);
            } else {
              // Monto diferente -> FACTURA_PAGADA (requiere revisión manual)
              finalStatus = 'factura_pagada';
              console.log(`❓ [Automation] Monto no coincide, requiere revisión`);
            }
          }
        } else if (analysis.extractedAmount && analysis.extractedReference) {
          // Buscar pagos programados por monto o referencia
          // (Nota: Esto requeriría una función de búsqueda en storage)
          // Por ahora, dejar en FACTURA_PAGADA para revisión manual
          finalStatus = 'factura_pagada';
        }

        // 2. Si el cliente requiere complemento y no está cerrado
        if (client?.requiresPaymentComplement && finalStatus !== 'cierre_contable') {
          if (finalStatus === 'factura_pagada') {
            finalStatus = 'pendiente_complemento';
          }
        }

        // Actualizar estado si cambió
        if (finalStatus !== initialStatus) {
          await storage.updatePaymentVoucher(voucher.id, {
            status: finalStatus as any,
            linkedInvoiceId,
            linkedInvoiceUuid,
          });
          voucher.status = finalStatus as any;
        }

        // 2.5. Actualizar scheduled_payment si está vinculado
        if (validatedData.scheduledPaymentId && scheduledPaymentForClient) {
          // Determinar el estado del scheduled_payment basado en si requiere REP
          const requiresREP = client?.requiresPaymentComplement === true;
          const scheduledPaymentStatus = requiresREP ? 'voucher_uploaded' : 'payment_completed';
          
          // Importar db y scheduledPayments si no están disponibles
          const { db } = await import('./db');
          const { scheduledPayments } = await import('../shared/schema');
          const { eq } = await import('drizzle-orm');
          
          await db.update(scheduledPayments)
            .set({
              voucherId: voucher.id,
              status: scheduledPaymentStatus,
              paidAt: new Date(),
              paidBy: user.id,
              updatedAt: new Date(),
            })
            .where(eq(scheduledPayments.id, validatedData.scheduledPaymentId));
          
          console.log(`✅ [Upload] Scheduled payment ${validatedData.scheduledPaymentId} actualizado: status=${scheduledPaymentStatus} (requiere REP: ${requiresREP})`);
        }

        // 3. Enviar correo automáticamente si notify=true
        if (validatedData.notify && (validatedData.emailTo?.length || client?.email)) {
          const { emailService } = await import('./email-service');
          const fs = await import('fs');
          
          const emailAddresses = validatedData.emailTo?.length 
            ? validatedData.emailTo 
            : client?.email 
              ? [client.email] 
              : [];
          
          if (emailAddresses.length > 0) {
            try {
              // Obtener nombre de la empresa pagadora
              if (!validatedData.payerCompanyId) {
                console.warn('⚠️ [Email] PayerCompanyId no disponible, usando nombre genérico');
                return;
              }
              const payerCompanyIdForEmail = validatedData.payerCompanyId; // Type narrowing
              const payerCompany = await storage.getCompany(payerCompanyIdForEmail);
              const companyName = payerCompany?.name || 'Empresa';

              // Crear contenido del email
              const subject = `Comprobante de pago – ${companyName} – ${analysis.extractedCurrency || 'MXN'} ${analysis.extractedAmount?.toLocaleString('es-MX') || 'N/A'}`;
              
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
                    Comprobante de Pago
                  </h2>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 16px;"><strong>Estimado/a ${client?.name || 'Cliente'},</strong></p>
                    <p style="margin: 10px 0; font-size: 14px;">
                      Se ha registrado el siguiente comprobante de pago:
                    </p>
                  </div>

                  <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Empresa Pagadora:</strong> ${companyName}</p>
                    ${analysis.extractedAmount ? `<p style="margin: 5px 0;"><strong>Monto:</strong> ${analysis.extractedCurrency || 'MXN'} $${analysis.extractedAmount.toLocaleString('es-MX')}</p>` : ''}
                    ${analysis.extractedDate ? `<p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(analysis.extractedDate).toLocaleDateString('es-MX')}</p>` : ''}
                    ${analysis.extractedBank ? `<p style="margin: 5px 0;"><strong>Banco:</strong> ${analysis.extractedBank}</p>` : ''}
                    ${analysis.extractedReference ? `<p style="margin: 5px 0;"><strong>Referencia:</strong> ${analysis.extractedReference}</p>` : ''}
                    ${analysis.extractedTrackingKey ? `<p style="margin: 5px 0;"><strong>Clave de Rastreo:</strong> ${analysis.extractedTrackingKey}</p>` : ''}
                  </div>

                  ${validatedData.emailMessage ? `<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Mensaje:</strong></p>
                    <p style="margin: 5px 0; font-size: 14px;">${validatedData.emailMessage}</p>
                  </div>` : ''}

                  <p style="margin-top: 20px; font-size: 14px;">
                    El comprobante se encuentra adjunto a este correo.
                  </p>

                  <p style="margin-top: 20px; font-size: 14px;">
                    Saludos cordiales,<br>
                    <strong>Lolita</strong><br>
                    Equipo de Tesorería - Econova
                  </p>
                </div>
              `;

              // Preparar archivo adjunto (usando buffer de memoryStorage)
              const attachment = {
                filename: file.originalname,
                content: file.buffer,
                type: file.mimetype,
              };

              // Enviar email (nota: emailService necesita soporte para attachments)
              // Por ahora, solo enviar el HTML
              const emailResult = await emailService.sendEmail({
                to: emailAddresses[0],
                subject,
                html: emailHtml,
              }, 'treasury');

              // Registrar en email_outbox
              if (emailResult.success || emailResult.error) {
                const { db } = await import('./db');
                const { emailOutbox } = await import('@shared/schema');
                
                await db.insert(emailOutbox).values({
                  voucherId: voucher.id,
                  emailTo: emailAddresses,
                  emailCc: validatedData.emailCc || [],
                  subject,
                  htmlContent: emailHtml,
                  status: emailResult.success ? 'sent' : 'failed',
                  messageId: emailResult.messageId || null,
                  errorMessage: emailResult.error || null,
                  sentAt: emailResult.success ? new Date() : null,
                });

                console.log(`📧 [Email] ${emailResult.success ? 'Enviado' : 'Error'}: ${emailAddresses[0]}`);
              }
            } catch (emailError) {
              console.error('📧 [Email] Error enviando correo:', emailError);
              // No fallar el upload si el email falla
            }
          }
        }

        console.log(`🤖 [Automation] Flujo automático completado: ${finalStatus}`);
      } catch (automationError) {
        console.error('🤖 [Automation] Error en flujo automático:', automationError);
        // No fallar el upload si la automatización falla
      }

      console.log(`✅ [Upload] Comprobante creado con ID: ${voucher.id}, estado: ${voucher.status}`);

      res.status(201).json({
        voucher,
        analysis,
        autoStatus: initialStatus,
        requiresComplement: client?.requiresPaymentComplement || false,
        scheduledPayment: scheduledPaymentForClient || null, // Incluir cuenta por pagar si está vinculada
        documentType: analysis.documentType,
      });
    } catch (error) {
      console.error('❌ [Upload] Error completo:', error);
      console.error('❌ [Upload] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
      
      if (error instanceof z.ZodError) {
        console.error('❌ [Upload] Error de validación Zod:', error.errors);
        return res.status(400).json({ 
          error: 'Validación fallida', 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      
      if (error instanceof Error) {
        console.error('❌ [Upload] Error message:', error.message);
        // Si el error menciona algo específico, devolverlo
        if (error.message.includes('No se subió') || error.message.includes('archivo')) {
          return res.status(400).json({ 
            error: 'Error al procesar archivo', 
            details: error.message 
          });
        }
        if (error.message.includes('PayerCompanyId') || error.message.includes('empresa')) {
          return res.status(400).json({ 
            error: 'Datos incompletos', 
            details: error.message 
          });
        }
      }
      
      res.status(500).json({
        error: 'Error al subir comprobante',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      // ✅ FIX BUG #5: Siempre limpiar el archivo temporal
      // Esto previene acumulación de archivos basura cuando hay errores
      if (req.file?.path) {
        try {
          const fs = await import('fs');
          // Solo eliminar si el archivo aún existe en la ubicación temporal
          // (si fue movido con renameSync, ya no existirá en file.path)
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log(`🗑️ [Upload Cleanup] Archivo temporal eliminado: ${req.file.path}`);
          }
        } catch (cleanupError) {
          console.error('⚠️ [Upload Cleanup] Error al eliminar archivo temporal:', cleanupError);
          // No fallar la request por error de limpieza
        }
      }
    }
  });

  // PUT /api/payment-vouchers/:id/status - Actualizar estado del comprobante (Kanban)
  app.put("/api/payment-vouchers/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const voucherId = parseInt(req.params.id);

      // Validar request body - solo valores válidos del enum en la base de datos
      const statusSchema = z.object({
        status: z.enum([
          'pago_programado', // ✅ Nuevo status
          'factura_pagada',
          'pendiente_complemento',
          'complemento_recibido',
          'cierre_contable'
        ]),
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

  // POST /api/payment-vouchers/:id/pay - Subir comprobante de pago para un voucher (factura)
  // Este endpoint recibe el comprobante de pago y actualiza el status según si requiere REP
  console.log('✅ [Routes] Registrando endpoint POST /api/payment-vouchers/:id/pay');
  app.post("/api/payment-vouchers/:id/pay", jwtAuthMiddleware, (req, res, next) => {
    voucherUpload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ [Pay] Error de Multer:', err);
        return res.status(400).json({ error: 'Error al procesar archivo', details: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const voucherId = parseInt(req.params.id);
      const user = getAuthUser(req as AuthRequest);
      const file = req.file;

      console.log(`💳 [Pay] Procesando pago para voucher ID: ${voucherId}`);
      console.log(`💳 [Pay] Archivo recibido:`, file ? {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        hasBuffer: !!file.buffer,
        bufferLength: file.buffer?.length
      } : 'null');

      if (!file) {
        return res.status(400).json({ error: 'No se subió ningún archivo de comprobante' });
      }

      if (!file.buffer) {
        console.error('❌ [Pay] Error: file.buffer es undefined');
        return res.status(400).json({ error: 'Error al procesar archivo: buffer vacío' });
      }

      // Obtener el voucher actual
      const existingVoucher = await storage.getPaymentVoucher(voucherId);
      if (!existingVoucher) {
        return res.status(404).json({ error: 'Voucher no encontrado' });
      }

      // Verificar que esté en estado pago_programado o factura_pagada
      if (!['pago_programado', 'factura_pagada'].includes(existingVoucher.status)) {
        return res.status(400).json({ 
          error: 'El voucher no está en estado de pago programado',
          currentStatus: existingVoucher.status
        });
      }

      // Analizar el comprobante con OpenAI
      const fs = await import('fs');
      const path = await import('path');
      const { analyzePaymentDocument } = await import("./document-analyzer");
      // Usar file.buffer directamente (memoryStorage)
      const fileBuffer = file.buffer;
      const analysis = await analyzePaymentDocument(fileBuffer, file.mimetype);

      console.log(`💳 [Pay] Análisis del comprobante:`, {
        amount: analysis?.extractedAmount,
        date: analysis?.extractedDate,
        reference: analysis?.extractedReference
      });

      // Guardar el comprobante en la ubicación final
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const voucherDir = path.join(process.cwd(), 'uploads', 'comprobantes', String(year), month);
      
      if (!fs.existsSync(voucherDir)) {
        fs.mkdirSync(voucherDir, { recursive: true });
      }

      const voucherFileName = `${Date.now()}-pago-${file.originalname}`;
      const finalPath = path.join(voucherDir, voucherFileName);
      // Escribir el buffer al archivo (memoryStorage no tiene file.path)
      fs.writeFileSync(finalPath, fileBuffer);

      // Verificar si el proveedor requiere REP
      // Buscar el supplier/client para verificar requiresPaymentComplement
      const { db } = await import('./db');
      const { suppliers } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      let requiresREP = false;
      
      // Buscar el proveedor asociado usando scheduledPaymentId o supplierId
      const { scheduledPayments } = await import('../shared/schema');
      
      // Primero intentar obtener el supplierId desde el scheduled payment
      let supplierId = null;
      if (existingVoucher.scheduledPaymentId) {
        const [scheduledPayment] = await db.select()
          .from(scheduledPayments)
          .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));
        supplierId = scheduledPayment?.supplierId;
      }
      
      if (supplierId) {
        const [supplier] = await db.select()
          .from(suppliers)
          .where(eq(suppliers.id, supplierId));
        
        requiresREP = supplier?.requiresRep === true;
        console.log(`💳 [Pay] Supplier ${supplier?.name} requiresREP: ${requiresREP}`);
      }

      // Determinar nuevo status basado en REP
      // Si requiere REP → pendiente_complemento
      // Si NO requiere REP → cierre_contable
      const newStatus = requiresREP ? 'pendiente_complemento' : 'cierre_contable';
      console.log(`💳 [Pay] Nuevo status: ${newStatus} (requiresREP: ${requiresREP})`);

      // Actualizar el voucher con los datos del comprobante de pago
      const updatedVoucher = await storage.updatePaymentVoucher(voucherId, {
        status: newStatus as any,
        // Guardar datos del comprobante en campos adicionales si los hay
        extractedAmount: analysis?.extractedAmount || existingVoucher.extractedAmount,
        extractedDate: analysis?.extractedDate || existingVoucher.extractedDate,
        extractedBank: analysis?.extractedBank || existingVoucher.extractedBank,
        extractedReference: analysis?.extractedReference || existingVoucher.extractedReference,
        extractedTrackingKey: analysis?.extractedTrackingKey || existingVoucher.extractedTrackingKey,
        ocrConfidence: analysis?.ocrConfidence || existingVoucher.ocrConfidence,
        notes: `${existingVoucher.notes || ''}\nComprobante de pago subido: ${file.originalname}`.trim(),
      });

      // También actualizar el scheduled payment vinculado si existe
      if (existingVoucher.scheduledPaymentId) {
        const { scheduledPayments } = await import('../shared/schema');
        await db.update(scheduledPayments)
          .set({
            status: requiresREP ? 'voucher_uploaded' : 'payment_completed',
            paidAt: new Date(),
            paidBy: user.id,
          })
          .where(eq(scheduledPayments.id, existingVoucher.scheduledPaymentId));
        console.log(`💳 [Pay] Scheduled payment ${existingVoucher.scheduledPaymentId} actualizado a ${requiresREP ? 'voucher_uploaded' : 'payment_completed'}`);
      }

      console.log(`✅ [Pay] Pago registrado exitosamente. Voucher ${voucherId} actualizado a ${newStatus}`);

      res.json({
        voucher: updatedVoucher,
        requiresREP,
        newStatus,
        message: requiresREP 
          ? 'Pago registrado. El proveedor requiere REP, pendiente complemento.'
          : 'Pago completado y cerrado contablemente.'
      });
    } catch (error) {
      console.error('❌ [Pay] Error:', error);
      res.status(500).json({ 
        error: 'Error al procesar pago',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
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

  // DELETE /api/payment-vouchers/:id - Eliminar comprobante con razón (soft delete - se archiva)
  app.delete("/api/payment-vouchers/:id", jwtAuthMiddleware, async (req, res) => {
    const authReq = req as AuthRequest;
    try {
      const voucherId = parseInt(authReq.params.id);
      const userId = authReq.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Validar razón de eliminación
      const deleteSchema = z.object({
        reason: z.string().min(3, 'La razón debe tener al menos 3 caracteres').max(500, 'La razón no puede exceder 500 caracteres'),
      });

      const { reason } = deleteSchema.parse(req.body);

      // Obtener el voucher original antes de eliminar
      const originalVoucher = await db.query.paymentVouchers.findFirst({
        where: eq(paymentVouchers.id, voucherId),
      });

      if (!originalVoucher) {
        return res.status(404).json({ error: 'Comprobante no encontrado' });
      }

      // Guardar en la tabla de eliminados (soft delete)
      await db.insert(deletedPaymentVouchers).values({
        originalVoucherId: originalVoucher.id,
        companyId: originalVoucher.companyId,
        payerCompanyId: originalVoucher.payerCompanyId,
        clientId: originalVoucher.clientId,
        clientName: originalVoucher.clientName,
        status: originalVoucher.status,
        voucherFileUrl: originalVoucher.voucherFileUrl,
        voucherFileName: originalVoucher.voucherFileName,
        extractedAmount: originalVoucher.extractedAmount,
        extractedCurrency: originalVoucher.extractedCurrency,
        extractedReference: originalVoucher.extractedReference,
        extractedBank: originalVoucher.extractedBank,
        originalCreatedAt: originalVoucher.createdAt,
        deletionReason: reason,
        deletedBy: userId,
        originalData: JSON.stringify(originalVoucher), // Backup completo
      });

      // Eliminar el voucher original
      await db.delete(paymentVouchers).where(eq(paymentVouchers.id, voucherId));

      console.log(`🗑️ [Delete Voucher] Voucher ${voucherId} eliminado por usuario ${userId}. Razón: ${reason}`);

      res.json({ 
        success: true, 
        message: 'Comprobante eliminado y archivado correctamente',
        voucherId 
      });
    } catch (error) {
      console.error('Error deleting payment voucher:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validación fallida', details: error.errors });
      }
      res.status(500).json({ error: 'Error al eliminar el comprobante' });
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

  logger.info("✅ All routes have been configured successfully");
  
  // ============================================================================
  // SALES MODULE API - Módulo de Ventas
  // ============================================================================

  // GET /api/sales-stats - Estadísticas generales de ventas
  app.get("/api/sales-stats", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId } = req.query;

      // Multi-tenant filtering
      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      console.log(`[GET /api/sales-stats] Solicitando métricas para companyId: ${resolvedCompanyId}`);
      
      // Calcular todas las métricas usando el módulo optimizado
      const metrics = await getSalesMetrics(resolvedCompanyId);
      
      console.log(`[GET /api/sales-stats] Métricas calculadas:`, {
        activeClients: metrics.activeClients,
        currentVolume: metrics.currentVolume,
        unit: metrics.unit,
        growth: metrics.growth
      });

      // Retornar métricas (incluye backward compatibility + nuevas métricas)
      res.json(metrics);
    } catch (error) {
      console.error('[GET /api/sales-stats] Error:', error);
      if (error instanceof Error) {
        console.error('[GET /api/sales-stats] Error stack:', error.stack);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        error: 'Failed to fetch sales stats',
        details: errorMessage
      });
    }
  });

  // GET /api/sales-comparison - Comparativo año actual vs anterior por cliente
  app.get("/api/sales-comparison", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, year, month } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      // ========================================================================
      // DATOS HARDCODEADOS TEMPORALES - PARA PRESENTACIÓN
      // TODO: ELIMINAR ESTE BLOQUE CUANDO SE ARREGLE LA FUNCIÓN DE ACTUALIZAR VENTAS
      // ========================================================================
      const HARDCODED_COMPARISON_ENABLED = false; // DESACTIVADO - Datos reales en tabla ventas

      if (HARDCODED_COMPARISON_ENABLED && (resolvedCompanyId === 1 || resolvedCompanyId === 2)) {
        console.log(`[GET /api/sales-comparison] ⚠️ USANDO DATOS HARDCODEADOS para companyId=${resolvedCompanyId}`);

        // DURA (companyId=1) - Comparativo mensual KG
        const duraComparisonData = [
          { client_id: 1, client_name: "Enero", previous_year_total: "46407.17", current_year_total: "59453.54", differential: "13046.37", percent_change: "28.11", unit: "KG" },
          { client_id: 2, client_name: "Febrero", previous_year_total: "54955.17", current_year_total: "46450.80", differential: "-8504.37", percent_change: "-15.48", unit: "KG" },
          { client_id: 3, client_name: "Marzo", previous_year_total: "58170.41", current_year_total: "43602.24", differential: "-14568.17", percent_change: "-25.04", unit: "KG" },
          { client_id: 4, client_name: "Abril", previous_year_total: "51814.50", current_year_total: "55972.80", differential: "4158.30", percent_change: "8.03", unit: "KG" },
          { client_id: 5, client_name: "Mayo", previous_year_total: "56757.88", current_year_total: "36358.64", differential: "-20399.24", percent_change: "-35.94", unit: "KG" },
          { client_id: 6, client_name: "Junio", previous_year_total: "45015.50", current_year_total: "51156.50", differential: "6141.00", percent_change: "13.64", unit: "KG" },
          { client_id: 7, client_name: "Julio", previous_year_total: "67090.00", current_year_total: "52999.54", differential: "-14090.46", percent_change: "-21.00", unit: "KG" },
          { client_id: 8, client_name: "Agosto", previous_year_total: "36533.20", current_year_total: "44381.30", differential: "7848.10", percent_change: "21.48", unit: "KG" },
          { client_id: 9, client_name: "Septiembre", previous_year_total: "57676.50", current_year_total: "56763.54", differential: "-912.96", percent_change: "-1.58", unit: "KG" },
          { client_id: 10, client_name: "Octubre", previous_year_total: "70538.00", current_year_total: "42939.20", differential: "-27598.80", percent_change: "-39.13", unit: "KG" },
          { client_id: 11, client_name: "Noviembre", previous_year_total: "40676.04", current_year_total: "44222.00", differential: "3545.96", percent_change: "8.72", unit: "KG" },
          { client_id: 12, client_name: "Diciembre", previous_year_total: "54120.30", current_year_total: "34645.00", differential: "-19475.30", percent_change: "-35.99", unit: "KG" },
        ];

        // ORSEGA (companyId=2) - Comparativo mensual Unidades
        const orsegaComparisonData = [
          { client_id: 1, client_name: "Enero", previous_year_total: "871883.98", current_year_total: "1056748.00", differential: "184864.02", percent_change: "21.20", unit: "unidades" },
          { client_id: 2, client_name: "Febrero", previous_year_total: "471429.00", current_year_total: "986581.00", differential: "515152.00", percent_change: "109.27", unit: "unidades" },
          { client_id: 3, client_name: "Marzo", previous_year_total: "983893.00", current_year_total: "1319150.00", differential: "335257.00", percent_change: "34.08", unit: "unidades" },
          { client_id: 4, client_name: "Abril", previous_year_total: "659319.00", current_year_total: "555894.00", differential: "-103425.00", percent_change: "-15.69", unit: "unidades" },
          { client_id: 5, client_name: "Mayo", previous_year_total: "983283.00", current_year_total: "1062785.00", differential: "79502.00", percent_change: "8.09", unit: "unidades" },
          { client_id: 6, client_name: "Junio", previous_year_total: "702502.00", current_year_total: "1084950.00", differential: "382448.00", percent_change: "54.45", unit: "unidades" },
          { client_id: 7, client_name: "Julio", previous_year_total: "674186.00", current_year_total: "1169659.00", differential: "495473.00", percent_change: "73.49", unit: "unidades" },
          { client_id: 8, client_name: "Agosto", previous_year_total: "528870.00", current_year_total: "558525.00", differential: "29655.00", percent_change: "5.61", unit: "unidades" },
          { client_id: 9, client_name: "Septiembre", previous_year_total: "871278.00", current_year_total: "404786.00", differential: "-466492.00", percent_change: "-53.54", unit: "unidades" },
          { client_id: 10, client_name: "Octubre", previous_year_total: "727375.00", current_year_total: "583234.00", differential: "-144141.00", percent_change: "-19.82", unit: "unidades" },
          { client_id: 11, client_name: "Noviembre", previous_year_total: "1312541.00", current_year_total: "425631.00", differential: "-886910.00", percent_change: "-67.57", unit: "unidades" },
          { client_id: 12, client_name: "Diciembre", previous_year_total: "750918.00", current_year_total: "480458.00", differential: "-270460.00", percent_change: "-36.02", unit: "unidades" },
        ];

        const comparisonData = resolvedCompanyId === 1 ? duraComparisonData : orsegaComparisonData;
        return res.json(comparisonData);
      }
      // ========================================================================
      // FIN DATOS HARDCODEADOS TEMPORALES
      // ========================================================================

      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

      const comparison = await sql(`
        SELECT
          current_year.client_id,
          current_year.client_name,
          SUM(current_year.quantity) as current_year_total,
          COALESCE(SUM(previous_year.quantity), 0) as previous_year_total,
          SUM(current_year.quantity) - COALESCE(SUM(previous_year.quantity), 0) as differential,
          CASE
            WHEN COALESCE(SUM(previous_year.quantity), 0) > 0
            THEN ROUND(((SUM(current_year.quantity) - SUM(previous_year.quantity)) / SUM(previous_year.quantity) * 100)::numeric, 2)
            ELSE NULL
          END as percent_change,
          current_year.unit
        FROM sales_data current_year
        LEFT JOIN sales_data previous_year
          ON current_year.client_id = previous_year.client_id
          AND current_year.company_id = previous_year.company_id
          AND current_year.sale_month = previous_year.sale_month
          AND current_year.sale_year = previous_year.sale_year + 1
        WHERE current_year.company_id = $1
          AND current_year.sale_year = $2
          AND current_year.sale_month = $3
        GROUP BY
          current_year.client_id,
          current_year.client_name,
          current_year.unit
        ORDER BY differential ASC
      `, [resolvedCompanyId, targetYear, targetMonth]);

      res.json(comparison);
    } catch (error) {
      console.error('[GET /api/sales-comparison] Error:', error);
      res.status(500).json({ error: 'Failed to fetch sales comparison' });
    }
  });

  // GET /api/sales-alerts - Obtener alertas activas
  app.get("/api/sales-alerts", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, type } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      let query = `
        SELECT
          id, alert_type, client_id, client_name, severity,
          title, description, data, is_active, is_read,
          created_at, resolved_at
        FROM sales_alerts
        WHERE company_id = $1
          AND is_active = true
      `;

      const params: any[] = [resolvedCompanyId];

      if (type) {
        query += ` AND alert_type = $2`;
        params.push(type);
      }

      query += ` ORDER BY created_at DESC`;

      const alerts = await sql(query, params);

      res.json(alerts);
    } catch (error) {
      console.error('[GET /api/sales-alerts] Error:', error);
      res.status(500).json({ error: 'Failed to fetch sales alerts' });
    }
  });

  // POST /api/sales-alerts/:id/read - Marcar alerta como leída
  app.post("/api/sales-alerts/:id/read", jwtAuthMiddleware, async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);

      await sql(`
        UPDATE sales_alerts
        SET is_read = true
        WHERE id = $1
      `, [alertId]);

      res.json({ success: true });
    } catch (error) {
      console.error('[POST /api/sales-alerts/:id/read] Error:', error);
      res.status(500).json({ error: 'Failed to mark alert as read' });
    }
  });

  // GET /api/sales-monthly-trends - Datos mensuales para gráficos
  // Soporta: ?year=2025 para un año específico, o ?months=12 para últimos N meses
  app.get("/api/sales-monthly-trends", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, months, year } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      let monthlyData;

      // Si se especifica un año, filtrar por ese año completo
      if (year) {
        const selectedYear = parseInt(year as string);
        monthlyData = await sql(`
          SELECT
            sale_year,
            sale_month,
            COALESCE(SUM(quantity), 0) as total_volume,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = $2
          GROUP BY sale_year, sale_month
          ORDER BY sale_month ASC
        `, [resolvedCompanyId, selectedYear]);
      } else {
        // Cuando no se especifica year, usar el último año completo con datos disponibles
        // Esto es mejor que usar fechas relativas porque puede haber datos futuros
        const monthsCount = parseInt(months as string) || 12;
        
        // Primero obtener el último año con datos
        const latestYearResult = await sql(`
          SELECT MAX(sale_year) as max_year
          FROM sales_data
          WHERE company_id = $1
        `, [resolvedCompanyId]);
        
        const latestYear = latestYearResult[0]?.max_year 
          ? parseInt(latestYearResult[0].max_year) 
          : new Date().getFullYear();
        
        console.log(`[GET /api/sales-monthly-trends] Último año con datos para companyId ${resolvedCompanyId}: ${latestYear}`);
        
        // Obtener los últimos N meses del último año con datos
        monthlyData = await sql(`
          SELECT
            sale_year,
            sale_month,
            COALESCE(SUM(quantity), 0) as total_volume,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = $2
          GROUP BY sale_year, sale_month
          ORDER BY sale_month DESC
          LIMIT $3
        `, [resolvedCompanyId, latestYear, monthsCount]);
        
        // Si no hay suficientes datos en el último año, incluir también el año anterior
        if (monthlyData.length < monthsCount && latestYear > 2020) {
          const previousYear = latestYear - 1;
          const remainingMonths = monthsCount - monthlyData.length;
          
          const previousYearData = await sql(`
            SELECT
              sale_year,
              sale_month,
              COALESCE(SUM(quantity), 0) as total_volume,
              COALESCE(SUM(total_amount), 0) as total_amount,
              COUNT(DISTINCT client_name) FILTER (WHERE client_name IS NOT NULL AND client_name <> '') as active_clients,
              MAX(unit) as unit
            FROM sales_data
            WHERE company_id = $1
              AND sale_year = $2
            GROUP BY sale_year, sale_month
            ORDER BY sale_month DESC
            LIMIT $3
          `, [resolvedCompanyId, previousYear, remainingMonths]);
          
          // Combinar datos: año anterior primero, luego último año
          monthlyData = [...previousYearData.reverse(), ...monthlyData.reverse()];
        } else {
          // Invertir para tener orden cronológico (más antiguo primero)
          monthlyData.reverse();
        }
      }

      // Formatear datos para el gráfico
      const formattedData = monthlyData.map((row: any) => {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const saleMonth = parseInt(row.sale_month);
        const saleYear = parseInt(row.sale_year);
        return {
          month: `${monthNames[saleMonth - 1]}`,
          monthFull: `${monthNames[saleMonth - 1]} ${saleYear}`,
          volume: parseFloat(row.total_volume || '0'),
          amount: parseFloat(row.total_amount || '0'),
          clients: parseInt(row.active_clients || '0'),
          year: saleYear,
          monthNum: saleMonth
        };
      });

      // Solo invertir si es modo legacy (months)
      if (!year) {
        formattedData.reverse();
      }

      res.json(formattedData);
    } catch (error) {
      console.error('[GET /api/sales-monthly-trends] Error:', error);
      res.status(500).json({ error: 'Failed to fetch monthly trends' });
    }
  });

  // GET /api/sales-yearly-comparison - Comparativo anual dinámico (reemplaza datos hardcodeados)
  app.get("/api/sales-yearly-comparison", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, year1, year2 } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      // Años a comparar (por defecto: 2024 vs 2025)
      // Cuando haya datos de 2026, automáticamente se incluirán los 3 años
      // Forzar 2024 y 2025 por defecto, independientemente del año actual
      const compareYear1 = year1 ? parseInt(year1 as string) : 2024; // Siempre 2024 por defecto
      const compareYear2 = year2 ? parseInt(year2 as string) : 2025; // Siempre 2025 por defecto

      // Verificar qué años realmente existen en la base de datos
      const availableYearsCheck = await sql(`
        SELECT DISTINCT sale_year, COUNT(*) as count
        FROM sales_data
        WHERE company_id = $1
        GROUP BY sale_year
        ORDER BY sale_year DESC
      `, [resolvedCompanyId]);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[GET /api/sales-yearly-comparison] Años disponibles en BD para companyId ${resolvedCompanyId}:`, 
          availableYearsCheck.map((r: any) => ({ year: r.sale_year, count: r.count })));
      }
      
      // Verificar si hay datos de 2026 para incluir automáticamente
      const year2026Check = await sql(`
        SELECT COUNT(*) as count
        FROM sales_data
        WHERE company_id = $1 AND sale_year = 2026
      `, [resolvedCompanyId]);
      
      const has2026Data = parseInt(year2026Check[0]?.count || '0') > 0;
      const yearsToCompare = has2026Data ? [compareYear1, compareYear2, 2026] : [compareYear1, compareYear2];
      
      // Verificar que los años que queremos comparar realmente existan
      const existingYears = availableYearsCheck.map((r: any) => {
        const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : Number(r.sale_year);
        return year;
      });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[GET /api/sales-yearly-comparison] Años a comparar: ${yearsToCompare.join(', ')}`);
        console.log(`[GET /api/sales-yearly-comparison] Años existentes en BD: ${existingYears.join(', ')}`);
        yearsToCompare.forEach(year => {
          if (!existingYears.includes(year)) {
            console.warn(`[GET /api/sales-yearly-comparison] ⚠️ Año ${year} no encontrado en BD para companyId ${resolvedCompanyId}`);
          }
        });
      }

      // Obtener datos mensuales para los años a comparar (2 o 3 años)
      // Usar parámetros dinámicos según la cantidad de años
      let monthlyData;
      if (yearsToCompare.length === 3) {
        monthlyData = await sql(`
          SELECT
            sale_month,
            sale_year,
            COALESCE(SUM(quantity), 0) as total_quantity,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(DISTINCT client_name) as unique_clients,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = ANY(ARRAY[$2, $3, $4]::integer[])
          GROUP BY sale_year, sale_month
          ORDER BY sale_year, sale_month
        `, [resolvedCompanyId, yearsToCompare[0], yearsToCompare[1], yearsToCompare[2]]);
      } else {
        // Query simplificada - igual que annual-summary que SÍ funciona
        monthlyData = await sql(`
          SELECT
            sale_month,
            sale_year,
            COALESCE(SUM(quantity), 0) as total_quantity,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(DISTINCT client_name) as unique_clients,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_year = ANY(ARRAY[$2, $3]::integer[])
          GROUP BY sale_year, sale_month
          ORDER BY sale_year, sale_month
        `, [resolvedCompanyId, yearsToCompare[0], yearsToCompare[1]]);
      }

      // Log para debugging (siempre, no solo en desarrollo)
      console.log(`[GET /api/sales-yearly-comparison] companyId: ${resolvedCompanyId}, Años solicitados: year1=${compareYear1}, year2=${compareYear2}`);
      console.log(`[GET /api/sales-yearly-comparison] Años a comparar: ${yearsToCompare.join(', ')}`);
      console.log(`[GET /api/sales-yearly-comparison] Registros retornados: ${monthlyData.length}`);
      if (monthlyData.length > 0) {
        const data2024 = monthlyData.filter((r: any) => Number(r.sale_year) === 2024);
        const data2025 = monthlyData.filter((r: any) => Number(r.sale_year) === 2025);
        console.log(`[GET /api/sales-yearly-comparison] Registros 2024: ${data2024.length}, Registros 2025: ${data2025.length}`);
        if (data2024.length > 0) {
          console.log(`[GET /api/sales-yearly-comparison] Datos 2024 encontrados:`, data2024.map((r: any) => ({
            month: Number(r.sale_month),
            amount: Number(r.total_amount),
            quantity: Number(r.total_quantity)
          })));
        }
      }

      // Organizar datos por mes
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

      const comparisonData = monthNames.map((mes, index) => {
        const monthNum = index + 1;
        const dataPoint: any = {
          mes,
          monthNum,
        };

        // Agregar datos de todos los años a comparar
        yearsToCompare.forEach((year) => {
          // Buscar datos del año y mes - usar comparación estricta
          const yearData = monthlyData.find((r: any) => {
            // Convertir a números de forma explícita
            const rMonth = Number(r.sale_month);
            const rYear = Number(r.sale_year);
            return rMonth === monthNum && rYear === year;
          });
          
          if (yearData) {
            dataPoint[`qty_${year}`] = Number(yearData.total_quantity) || 0;
            dataPoint[`amt_${year}`] = Number(yearData.total_amount) || 0;
          } else {
            dataPoint[`qty_${year}`] = 0;
            dataPoint[`amt_${year}`] = 0;
          }
          
          // Log detallado para el primer mes y año 2024
          if (process.env.NODE_ENV !== 'production' && index === 0 && year === 2024) {
            console.log(`[GET /api/sales-yearly-comparison] Mes ${monthNum} (${mes}), Año 2024:`, {
              found: !!yearData,
              total_amount: yearData ? Number(yearData.total_amount) : 0,
              total_quantity: yearData ? Number(yearData.total_quantity) : 0,
              allMonthlyDataFor2024: monthlyData.filter((r: any) => Number(r.sale_year) === 2024).map((r: any) => ({
                month: Number(r.sale_month),
                year: Number(r.sale_year),
                amount: Number(r.total_amount)
              }))
            });
          }
        });

        // Calcular diferencias y porcentajes (solo entre los dos primeros años para compatibilidad)
        const qty1 = dataPoint[`qty_${compareYear1}`] || 0;
        const qty2 = dataPoint[`qty_${compareYear2}`] || 0;
        const amt1 = dataPoint[`amt_${compareYear1}`] || 0;
        const amt2 = dataPoint[`amt_${compareYear2}`] || 0;

        dataPoint.qty_diff = qty2 - qty1;
        dataPoint.qty_percent = qty1 > 0 ? ((qty2 - qty1) / qty1) * 100 : (qty2 > 0 ? 100 : 0);
        dataPoint.amt_diff = amt2 - amt1;
        dataPoint.amt_percent = amt1 > 0 ? ((amt2 - amt1) / amt1) * 100 : (amt2 > 0 ? 100 : 0);
        
        // Determinar unidad
        const firstYearData = monthlyData.find((r: any) => parseInt(r.sale_month) === monthNum && parseInt(r.sale_year) === yearsToCompare[0]);
        dataPoint.unit = firstYearData?.unit || (resolvedCompanyId === 1 ? 'KG' : 'unidades');

        return dataPoint;
      });

      // Calcular totales para todos los años
      const totals = comparisonData.reduce((acc, row) => {
        const totalsObj: any = { ...acc };
        yearsToCompare.forEach((year) => {
          totalsObj[`qty_${year}`] = (totalsObj[`qty_${year}`] || 0) + (row[`qty_${year}`] || 0);
          totalsObj[`amt_${year}`] = (totalsObj[`amt_${year}`] || 0) + (row[`amt_${year}`] || 0);
        });
        return totalsObj;
      }, yearsToCompare.reduce((acc: any, year) => {
        acc[`qty_${year}`] = 0;
        acc[`amt_${year}`] = 0;
        return acc;
      }, {}));

      // Obtener años disponibles para selector
      const availableYears = await sql(`
        SELECT DISTINCT sale_year
        FROM sales_data
        WHERE company_id = $1
        ORDER BY sale_year DESC
      `, [resolvedCompanyId]);

      // Log para debugging (solo en desarrollo)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[GET /api/sales-yearly-comparison] Comparando años: ${yearsToCompare.join(', ')}`);
        console.log(`[GET /api/sales-yearly-comparison] Total registros encontrados: ${monthlyData.length}`);
        console.log(`[GET /api/sales-yearly-comparison] Totales calculados:`, totals);
        console.log(`[GET /api/sales-yearly-comparison] Años disponibles:`, availableYears.map((r: any) => {
          const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : r.sale_year;
          return year;
        }));
      }

      res.json({
        companyId: resolvedCompanyId,
        year1: compareYear1,
        year2: compareYear2,
        data: comparisonData,
        totals: {
          ...totals,
          qty_diff: totals[`qty_${compareYear2}`] - totals[`qty_${compareYear1}`],
          qty_percent: totals[`qty_${compareYear1}`] > 0
            ? ((totals[`qty_${compareYear2}`] - totals[`qty_${compareYear1}`]) / totals[`qty_${compareYear1}`]) * 100
            : 0,
          amt_diff: totals[`amt_${compareYear2}`] - totals[`amt_${compareYear1}`],
          amt_percent: totals[`amt_${compareYear1}`] > 0
            ? ((totals[`amt_${compareYear2}`] - totals[`amt_${compareYear1}`]) / totals[`amt_${compareYear1}`]) * 100
            : 0,
        },
        availableYears: availableYears.map((r: any) => {
          const year = typeof r.sale_year === 'string' ? parseInt(r.sale_year) : r.sale_year;
          return year;
        }),
        unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
      });
    } catch (error) {
      console.error('[GET /api/sales-yearly-comparison] Error:', error);
      res.status(500).json({ error: 'Failed to fetch yearly comparison' });
    }
  });

  // GET /api/sales-multi-year-trend - Tendencia multi-año para gráfica overlay
  app.get("/api/sales-multi-year-trend", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      // Obtener datos mensuales agrupados por año
      const monthlyData = await sql(`
        SELECT
          sale_year,
          sale_month,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(DISTINCT client_name) as unique_clients,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
        GROUP BY sale_year, sale_month
        ORDER BY sale_year, sale_month
      `, [resolvedCompanyId]);

      // Organizar por año para la gráfica overlay
      // Convertir a números para comparación correcta (PostgreSQL puede retornar strings)
      const years = [...new Set(monthlyData.map((r: any) => parseInt(r.sale_year)))].sort();
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      // Formato para gráfica: array de meses con valores por año
      const chartData = monthNames.map((month, index) => {
        const monthNum = index + 1;
        const dataPoint: any = { month, monthNum };

        years.forEach((year: number) => {
          const record = monthlyData.find((r: any) => parseInt(r.sale_year) === year && parseInt(r.sale_month) === monthNum);
          dataPoint[`qty_${year}`] = parseFloat(record?.total_quantity || '0');
          dataPoint[`amt_${year}`] = parseFloat(record?.total_amount || '0');
        });

        return dataPoint;
      });

      // Calcular totales por año
      const yearTotals = years.map((year: number) => {
        const yearData = monthlyData.filter((r: any) => parseInt(r.sale_year) === year);
        return {
          year,
          totalQty: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_quantity || '0'), 0),
          totalAmt: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_amount || '0'), 0),
          avgMonthly: yearData.reduce((sum: number, r: any) => sum + parseFloat(r.total_quantity || '0'), 0) / 12
        };
      });

      res.json({
        companyId: resolvedCompanyId,
        years,
        data: chartData,
        yearTotals,
        unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
      });
    } catch (error) {
      console.error('[GET /api/sales-multi-year-trend] Error:', error);
      res.status(500).json({ error: 'Failed to fetch multi-year trend' });
    }
  });

  // GET /api/sales-churn-risk - Análisis de riesgo de churn de clientes
  app.get("/api/sales-churn-risk", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // Análisis de clientes: última compra, volumen actual vs anterior, tendencia
      const clientAnalysis = await sql(`
        WITH client_stats AS (
          SELECT
            client_name,
            MAX(sale_date) as last_purchase,
            SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current_year,
            SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_last_year,
            SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current_year,
            SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_last_year,
            COUNT(DISTINCT sale_year) as years_active,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
          GROUP BY client_name
        )
        SELECT
          client_name,
          last_purchase,
          qty_current_year,
          qty_last_year,
          amt_current_year,
          amt_last_year,
          years_active,
          unit,
          CURRENT_DATE - last_purchase as days_since_purchase,
          CASE
            WHEN qty_last_year > 0 THEN ((qty_current_year - qty_last_year) / qty_last_year * 100)
            ELSE 0
          END as yoy_change
        FROM client_stats
        ORDER BY last_purchase DESC
      `, [resolvedCompanyId, currentYear, lastYear]);

      // Categorizar clientes por riesgo
      const categorized = {
        critical: [] as any[],    // Sin compras 60+ días
        warning: [] as any[],     // Caída >30% YoY
        declining: [] as any[],   // Caída 10-30% YoY
        stable: [] as any[],      // Mantiene ±10%
        growing: [] as any[],     // Creciendo >10%
        new: [] as any[],         // Solo tiene datos del año actual
        lost: [] as any[]         // Compraba antes, no este año
      };

      clientAnalysis.forEach((client: any) => {
        const daysSince = parseInt(client.days_since_purchase || '0');
        const yoyChange = parseFloat(client.yoy_change || '0');
        const qtyCurrentYear = parseFloat(client.qty_current_year || '0');
        const qtyLastYear = parseFloat(client.qty_last_year || '0');

        const clientData = {
          name: client.client_name,
          lastPurchase: client.last_purchase,
          daysSincePurchase: daysSince,
          qtyCurrentYear,
          qtyLastYear,
          yoyChange: yoyChange,
          amtCurrentYear: parseFloat(client.amt_current_year || '0'),
          unit: client.unit
        };

        if (qtyLastYear > 0 && qtyCurrentYear === 0) {
          categorized.lost.push(clientData);
        } else if (daysSince > 60) {
          categorized.critical.push(clientData);
        } else if (yoyChange < -30) {
          categorized.warning.push(clientData);
        } else if (yoyChange < -10) {
          categorized.declining.push(clientData);
        } else if (qtyLastYear === 0 && qtyCurrentYear > 0) {
          categorized.new.push(clientData);
        } else if (yoyChange > 10) {
          categorized.growing.push(clientData);
        } else {
          categorized.stable.push(clientData);
        }
      });

      // Ordenar cada categoría por impacto (volumen perdido)
      categorized.critical.sort((a, b) => b.qtyLastYear - a.qtyLastYear);
      categorized.warning.sort((a, b) => (b.qtyLastYear - b.qtyCurrentYear) - (a.qtyLastYear - a.qtyCurrentYear));
      categorized.lost.sort((a, b) => b.qtyLastYear - a.qtyLastYear);

      // Resumen
      const summary = {
        totalClients: clientAnalysis.length,
        criticalCount: categorized.critical.length,
        warningCount: categorized.warning.length,
        lostCount: categorized.lost.length,
        newCount: categorized.new.length,
        growingCount: categorized.growing.length,
        lostVolume: categorized.lost.reduce((sum, c) => sum + c.qtyLastYear, 0),
        atRiskVolume: [...categorized.critical, ...categorized.warning].reduce((sum, c) => sum + c.qtyLastYear, 0)
      };

      res.json({
        companyId: resolvedCompanyId,
        currentYear,
        lastYear,
        summary,
        clients: categorized,
        unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
      });
    } catch (error) {
      console.error('[GET /api/sales-churn-risk] Error:', error);
      res.status(500).json({ error: 'Failed to fetch churn risk analysis' });
    }
  });

  // GET /api/sales-client-trends - Top clientes con tendencia YoY
  app.get("/api/sales-client-trends", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, limit = 10 } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      // Usar 2024 vs 2025 (igual que el comparativo anual)
      const currentYear = 2025;
      const lastYear = 2024;

      const clientTrends = await sql(`
        SELECT
          client_name,
          SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) as qty_current,
          SUM(CASE WHEN sale_year = $3 THEN quantity ELSE 0 END) as qty_previous,
          SUM(CASE WHEN sale_year = $2 THEN total_amount ELSE 0 END) as amt_current,
          SUM(CASE WHEN sale_year = $3 THEN total_amount ELSE 0 END) as amt_previous,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          AND sale_year IN ($2, $3)
        GROUP BY client_name
        ORDER BY SUM(CASE WHEN sale_year = $2 THEN quantity ELSE 0 END) DESC
        LIMIT $4
      `, [resolvedCompanyId, currentYear, lastYear, parseInt(limit as string)]);

      const formattedData = clientTrends.map((client: any) => {
        const qtyCurrent = parseFloat(client.qty_current || '0');
        const qtyPrevious = parseFloat(client.qty_previous || '0');
        const change = qtyCurrent - qtyPrevious;
        const changePercent = qtyPrevious > 0 ? (change / qtyPrevious) * 100 : (qtyCurrent > 0 ? 100 : 0);

        return {
          name: client.client_name,
          qtyCurrent,
          qtyPrevious,
          change,
          changePercent,
          amtCurrent: parseFloat(client.amt_current || '0'),
          amtPrevious: parseFloat(client.amt_previous || '0'),
          unit: client.unit
        };
      });

      res.json({
        companyId: resolvedCompanyId,
        currentYear,
        previousYear: lastYear,
        clients: formattedData,
        unit: resolvedCompanyId === 1 ? 'KG' : 'unidades'
      });
    } catch (error) {
      console.error('[GET /api/sales-client-trends] Error:', error);
      res.status(500).json({ error: 'Failed to fetch client trends' });
    }
  });

  // GET /api/sales-top-clients - Top clientes por volumen
  app.get("/api/sales-top-clients", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, limit = 5, period = '3months', sortBy = 'volume' } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      let dateFilter = '';
      let params: any[] = [resolvedCompanyId];

      // Determinar filtro de fecha según el período
      if (period === 'month') {
        // Último mes con datos disponibles
        dateFilter = `AND sale_year = $2 AND sale_month = $3`;
        params.push(currentYear, currentMonth);
      } else if (period === 'year') {
        // Año actual completo
        dateFilter = `AND sale_year = $2`;
        params.push(currentYear);
      } else {
        // Default: últimos 3 meses (backward compatibility)
        dateFilter = `AND sale_date >= CURRENT_DATE - INTERVAL '3 months' AND sale_date <= CURRENT_DATE`;
      }

      params.push(parseInt(limit as string) || 5);

      // Buscar top clientes según el período seleccionado
      let topClients = await sql(`
        SELECT
          client_name,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(*) as transactions,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          ${dateFilter}
          AND client_name IS NOT NULL AND client_name <> ''
        GROUP BY client_name
        ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
        LIMIT $${params.length}
      `, params);

      // Si no hay datos y es month/year, buscar en el último período con datos
      if ((!topClients || topClients.length === 0 || (topClients[0]?.total_volume === 0)) && (period === 'month' || period === 'year')) {
        topClients = await sql(`
          SELECT
            client_name,
            COALESCE(SUM(quantity), 0) as total_volume,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COUNT(*) as transactions,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
            AND sale_date <= CURRENT_DATE
            AND client_name IS NOT NULL AND client_name <> ''
          GROUP BY client_name
          ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
          LIMIT $2
        `, [resolvedCompanyId, parseInt(limit as string) || 5]);
      }

      const formatted = (topClients || []).map((row: any) => {
        const volume = parseFloat(row.total_volume || '0');
        const revenue = parseFloat(row.total_revenue || '0');
        const profitability = volume > 0 ? revenue / volume : 0; // Revenue por unidad de volumen
        
        return {
          name: row.client_name,
          volume: volume,
          revenue: revenue,
          profitability: profitability,
          transactions: parseInt(row.transactions || '0'),
          unit: row.unit
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('[GET /api/sales-top-clients] Error:', error);
      res.status(500).json({ error: 'Failed to fetch top clients' });
    }
  });

  // GET /api/sales-top-products - Top productos por volumen vendido
  app.get("/api/sales-top-products", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, limit = 5, period = '3months', sortBy = 'volume' } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      let dateFilter = '';
      let params: any[] = [resolvedCompanyId];

      // Determinar filtro de fecha según el período
      if (period === 'month') {
        // Último mes con datos disponibles
        dateFilter = `AND sale_year = $2 AND sale_month = $3`;
        params.push(currentYear, currentMonth);
      } else if (period === 'year') {
        // Año actual completo
        dateFilter = `AND sale_year = $2`;
        params.push(currentYear);
      } else {
        // Default: últimos 3 meses (backward compatibility)
        dateFilter = `AND sale_date >= CURRENT_DATE - INTERVAL '3 months' AND sale_date <= CURRENT_DATE`;
      }

      params.push(parseInt(limit as string) || 5);

      // Buscar top productos según el período seleccionado
      let topProducts = await sql(`
        SELECT
          product_name,
          COALESCE(SUM(quantity), 0) as total_volume,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(DISTINCT client_name) as unique_clients,
          COUNT(*) as transactions,
          MAX(unit) as unit
        FROM sales_data
        WHERE company_id = $1
          ${dateFilter}
          AND product_name IS NOT NULL AND product_name <> ''
        GROUP BY product_name
        ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
        LIMIT $${params.length}
      `, params);

      // Si no hay datos y es month/year, buscar en el último período con datos
      if ((!topProducts || topProducts.length === 0) && (period === 'month' || period === 'year')) {
        topProducts = await sql(`
          SELECT
            product_name,
            COALESCE(SUM(quantity), 0) as total_volume,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COUNT(DISTINCT client_name) as unique_clients,
            COUNT(*) as transactions,
            MAX(unit) as unit
          FROM sales_data
          WHERE company_id = $1
            AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
            AND sale_date <= CURRENT_DATE
            AND product_name IS NOT NULL AND product_name <> ''
          GROUP BY product_name
          ORDER BY ${sortBy === 'revenue' ? 'total_revenue' : 'total_volume'} DESC
          LIMIT $2
        `, [resolvedCompanyId, parseInt(limit as string) || 5]);
      }

      const formatted = (topProducts || []).map((row: any) => {
        const volume = parseFloat(row.total_volume) || 0;
        const revenue = parseFloat(row.total_revenue) || 0;
        const profitability = volume > 0 ? revenue / volume : 0; // Revenue por unidad de volumen
        
        return {
          name: row.product_name || 'Sin nombre',
          volume: volume,
          revenue: revenue,
          profitability: profitability,
          uniqueClients: parseInt(row.unique_clients) || 0,
          transactions: parseInt(row.transactions) || 0,
          unit: row.unit || (resolvedCompanyId === 2 ? 'unidades' : 'KG')
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('[GET /api/sales-top-products] Error:', error);
      res.status(500).json({ error: 'Failed to fetch top products' });
    }
  });

  // GET /api/sales-analyst/insights - Análisis estratégico consolidado del analista de ventas
  app.get("/api/sales-analyst/insights", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      console.log(`[GET /api/sales-analyst/insights] Generando insights para companyId: ${resolvedCompanyId}`);
      
      const insights = await generateSalesAnalystInsights(resolvedCompanyId);
      
      console.log(`[GET /api/sales-analyst/insights] Insights generados exitosamente`);
      
      res.json(insights);
    } catch (error) {
      console.error('[GET /api/sales-analyst/insights] Error:', error);
      if (error instanceof Error) {
        console.error('[GET /api/sales-analyst/insights] Error stack:', error.stack);
      }
      res.status(500).json({ 
        error: 'Failed to generate sales analyst insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/sales-alerts/:id/resolve - Resolver alerta
  app.post("/api/sales-alerts/:id/resolve", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const alertId = parseInt(req.params.id);

      await sql(`
        UPDATE sales_alerts
        SET
          is_active = false,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $1
        WHERE id = $2
      `, [user?.id, alertId]);

      res.json({ success: true });
    } catch (error) {
      console.error('[POST /api/sales-alerts/:id/resolve] Error:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  });

  // GET /api/profitability-metrics - Métricas detalladas de rentabilidad
  app.get("/api/profitability-metrics", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, year } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      const targetYear = year ? parseInt(year as string) : undefined;
      const metrics = await calculateRealProfitability(resolvedCompanyId, targetYear);

      res.json(metrics);
    } catch (error) {
      console.error('[GET /api/profitability-metrics] Error:', error);
      res.status(500).json({ error: 'Failed to fetch profitability metrics' });
    }
  });

  // GET /api/annual-summary - Resumen anual ejecutivo
  app.get("/api/annual-summary", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, year } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      if (!year) {
        return res.status(400).json({ error: 'Year parameter is required' });
      }

      const targetYear = parseInt(year as string);
      const summary = await getAnnualSummary(resolvedCompanyId, targetYear);

      res.json(summary);
    } catch (error) {
      console.error('[GET /api/annual-summary] Error:', error);
      res.status(500).json({ error: 'Failed to fetch annual summary' });
    }
  });

  // GET /api/annual-summary/years - Obtener años disponibles
  app.get("/api/annual-summary/years", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      const years = await getAvailableYears(resolvedCompanyId);
      res.json(years);
    } catch (error) {
      console.error('[GET /api/annual-summary/years] Error:', error);
      res.status(500).json({ error: 'Failed to fetch available years' });
    }
  });

  // GET /api/sales-data - Obtener datos de ventas con filtros
  app.get("/api/sales-data", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { companyId, clientId, productId, year, month, startDate, endDate, limit = '1000' } = req.query;

      const resolvedCompanyId = user?.role === 'admin' && companyId
        ? parseInt(companyId as string)
        : user?.companyId;

      if (!resolvedCompanyId) {
        return res.status(403).json({ error: 'No company access' });
      }

      let query = `
        SELECT
          id, company_id, client_id, product_id, client_name, product_name, 
          quantity, unit, unit_price, total_amount,
          sale_date, sale_month, sale_year, invoice_number, folio, notes
        FROM sales_data
        WHERE company_id = $1
      `;

      const params: any[] = [resolvedCompanyId];
      let paramIndex = 2;

      if (clientId) {
        query += ` AND client_id = $${paramIndex}`;
        params.push(parseInt(clientId as string));
        paramIndex++;
      }

      if (productId) {
        query += ` AND product_id = $${paramIndex}`;
        params.push(parseInt(productId as string));
        paramIndex++;
      }

      if (year) {
        query += ` AND sale_year = $${paramIndex}`;
        params.push(parseInt(year as string));
        paramIndex++;
      }

      if (month) {
        query += ` AND sale_month = $${paramIndex}`;
        params.push(parseInt(month as string));
        paramIndex++;
      }

      if (startDate) {
        query += ` AND sale_date >= $${paramIndex}`;
        params.push(startDate as string);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND sale_date <= $${paramIndex}`;
        params.push(endDate as string);
        paramIndex++;
      }

      query += ` ORDER BY sale_date DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string));

      const salesData = await sql(query, params);

      res.json(salesData);
    } catch (error) {
      console.error('[GET /api/sales-data] Error:', error);
      res.status(500).json({ error: 'Failed to fetch sales data' });
    }
  });

  // Configurar multer para archivos Excel de ventas
  const salesUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads', 'sales');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `sales-${uniqueSuffix}-${file.originalname}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/excel'
      ];
      const allowedExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
  });

  // POST /api/sales/upload - Subir archivo Excel de ventas
  app.post("/api/sales/upload", jwtAuthMiddleware, uploadLimiter, (req, res, next) => {
    console.log('📤 [Sales Upload] ========== INICIO DE UPLOAD ==========');
    console.log('📤 [Sales Upload] Petición recibida en /api/sales/upload');
    console.log('📤 [Sales Upload] Content-Type:', req.headers['content-type']);
    
    salesUpload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ [Sales Upload] Multer error:', err.message);
        return res.status(400).json({ 
          error: 'Error al procesar archivo', 
          details: err.message
        });
      }
      console.log('✅ [Sales Upload] Archivo procesado por multer');
      next();
    });
  }, async (req, res) => {
    // Detectar formato del archivo y usar el handler apropiado
    const ExcelJS = await import('exceljs');
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({
        error: 'No se subió ningún archivo',
        details: 'Asegúrate de seleccionar un archivo Excel antes de subirlo'
      });
    }

    try {
      // Leer archivo para detectar formato
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);

      const format = await detectExcelFormat(workbook);
      console.log(`📋 [Sales Upload] Formato detectado: ${format}`);

      if (format === 'IDRALL') {
        // Usar handler de IDRALL para formato nuevo
        console.log('🔄 [Sales Upload] Usando handler IDRALL...');
        await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
      } else if (format === 'LEGACY') {
        // Usar handler legacy para formato antiguo de 4 hojas
        console.log('🔄 [Sales Upload] Usando handler LEGACY...');
        await handleSalesUpload(req, res, { getAuthUser, ExcelJS });
      } else {
        // Intentar con IDRALL por default (formato más común ahora)
        console.log('🔄 [Sales Upload] Formato desconocido, intentando con IDRALL...');
        await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
      }
    } catch (error: any) {
      console.error('❌ [Sales Upload] Error detectando formato:', error.message);
      // Fallback: intentar con IDRALL
      await handleIDRALLUpload(req, res, { getAuthUser, ExcelJS });
    }
  });

  // ============================================================================
  // SALES ACTIONS API - Gestión de Acciones de Ventas (FASE 2)
  // ============================================================================

  // GET /api/sales/acciones - Obtener acciones con filtros
  app.get("/api/sales/acciones", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { submodulo, responsable, estado, prioridad, limit = '100', offset = '0' } = req.query;

      // Construir query dinámico con filtros
      const filters: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filtro por submódulo
      if (submodulo) {
        filters.push(`submodulo = $${paramIndex}`);
        params.push(submodulo);
        paramIndex++;
      }

      // Filtro por responsable (búsqueda parcial, ej: "ON" match "ON/EDV")
      if (responsable) {
        filters.push(`responsables LIKE $${paramIndex}`);
        params.push(`%${responsable}%`);
        paramIndex++;
      }

      // Filtro por estado
      if (estado) {
        filters.push(`estado = $${paramIndex}`);
        params.push(estado);
        paramIndex++;
      }

      // Filtro por prioridad
      if (prioridad) {
        filters.push(`prioridad = $${paramIndex}`);
        params.push(prioridad);
        paramIndex++;
      }

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

      // Agregar limit y offset
      params.push(parseInt(limit as string));
      const limitParam = `$${paramIndex}`;
      paramIndex++;
      params.push(parseInt(offset as string));
      const offsetParam = `$${paramIndex}`;

      const acciones = await sql(`
        SELECT
          id, cliente_id, cliente_nombre, submodulo, descripcion, prioridad, estado,
          responsables, diferencial, kilos_2024, kilos_2025, usd_2025, utilidad,
          fecha_creacion, fecha_limite, fecha_completado, notas, excel_origen_id,
          created_at, updated_at
        FROM sales_acciones
        ${whereClause}
        ORDER BY
          CASE prioridad
            WHEN 'CRITICA' THEN 1
            WHEN 'ALTA' THEN 2
            WHEN 'MEDIA' THEN 3
            WHEN 'BAJA' THEN 4
          END,
          created_at DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}
      `, params);

      // Contar total para paginación
      const countResult = await sql(`
        SELECT COUNT(*) as total
        FROM sales_acciones
        ${whereClause}
      `, params.slice(0, -2)); // Remover limit y offset del count

      res.json({
        acciones,
        total: parseInt(countResult[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error('[GET /api/sales/acciones] Error:', error);
      res.status(500).json({
        error: 'Error al obtener acciones',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/sales/acciones/mias - Obtener mis acciones (del usuario logueado)
  app.get("/api/sales/acciones/mias", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { estado, prioridad } = req.query;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Obtener código del responsable desde el usuario
      // Asumimos que el código está en user.responsableCode o similar
      // Por ahora usamos el nombre del usuario para buscar en sales_responsables
      const responsableResult = await sql(`
        SELECT codigo FROM sales_responsables
        WHERE LOWER(nombre) LIKE LOWER($1) OR email = $2
        LIMIT 1
      `, [`%${user.name}%`, user.email]);

      if (responsableResult.length === 0) {
        return res.json({
          acciones: [],
          message: 'No se encontró un código de responsable para este usuario'
        });
      }

      const codigoResponsable = responsableResult[0].codigo;

      // Construir filtros
      const filters: string[] = [`responsables LIKE $1`];
      const params: any[] = [`%${codigoResponsable}%`];
      let paramIndex = 2;

      if (estado) {
        filters.push(`estado = $${paramIndex}`);
        params.push(estado);
        paramIndex++;
      }

      if (prioridad) {
        filters.push(`prioridad = $${paramIndex}`);
        params.push(prioridad);
        paramIndex++;
      }

      const acciones = await sql(`
        SELECT
          id, cliente_id, cliente_nombre, submodulo, descripcion, prioridad, estado,
          responsables, diferencial, kilos_2024, kilos_2025, usd_2025, utilidad,
          fecha_creacion, fecha_limite, fecha_completado, notas,
          created_at, updated_at
        FROM sales_acciones
        WHERE ${filters.join(' AND ')}
        ORDER BY
          CASE prioridad
            WHEN 'CRITICA' THEN 1
            WHEN 'ALTA' THEN 2
            WHEN 'MEDIA' THEN 3
            WHEN 'BAJA' THEN 4
          END,
          CASE estado
            WHEN 'EN_PROGRESO' THEN 1
            WHEN 'PENDIENTE' THEN 2
            WHEN 'COMPLETADO' THEN 3
            WHEN 'CANCELADO' THEN 4
          END,
          created_at DESC
      `, params);

      res.json({
        acciones,
        responsable: {
          codigo: codigoResponsable,
          nombre: user.name
        },
        total: acciones.length
      });
    } catch (error) {
      console.error('[GET /api/sales/acciones/mias] Error:', error);
      res.status(500).json({
        error: 'Error al obtener mis acciones',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PATCH /api/sales/acciones/:id - Actualizar una acción
  app.patch("/api/sales/acciones/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.user;
      const { id } = req.params;
      const { estado, notas, fecha_limite, prioridad } = req.body;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      // Obtener acción actual
      const accionActual = await sql(`
        SELECT * FROM sales_acciones WHERE id = $1
      `, [parseInt(id)]);

      if (accionActual.length === 0) {
        return res.status(404).json({ error: 'Acción no encontrada' });
      }

      const accion = accionActual[0];

      // Construir update dinámico
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (estado !== undefined) {
        updates.push(`estado = $${paramIndex}`);
        params.push(estado);
        paramIndex++;

        // Si se marca como COMPLETADO, agregar fecha_completado
        if (estado === 'COMPLETADO') {
          updates.push(`fecha_completado = CURRENT_TIMESTAMP`);
        }
      }

      if (notas !== undefined) {
        updates.push(`notas = $${paramIndex}`);
        params.push(notas);
        paramIndex++;
      }

      if (fecha_limite !== undefined) {
        updates.push(`fecha_limite = $${paramIndex}`);
        params.push(fecha_limite);
        paramIndex++;
      }

      if (prioridad !== undefined) {
        updates.push(`prioridad = $${paramIndex}`);
        params.push(prioridad);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
      }

      // Agregar updated_at
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Agregar ID al final de params
      params.push(parseInt(id));
      const idParam = `$${paramIndex}`;

      // Ejecutar update
      await sql(`
        UPDATE sales_acciones
        SET ${updates.join(', ')}
        WHERE id = ${idParam}
      `, params);

      // Crear historial de cambios
      const cambios = [];
      if (estado !== undefined && estado !== accion.estado) {
        await sql(`
          INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [parseInt(id), 'estado', accion.estado, estado, user.id]);
        cambios.push({ campo: 'estado', anterior: accion.estado, nuevo: estado });
      }

      if (prioridad !== undefined && prioridad !== accion.prioridad) {
        await sql(`
          INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [parseInt(id), 'prioridad', accion.prioridad, prioridad, user.id]);
        cambios.push({ campo: 'prioridad', anterior: accion.prioridad, nuevo: prioridad });
      }

      if (notas !== undefined && notas !== accion.notas) {
        await sql(`
          INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [parseInt(id), 'notas', accion.notas || '', notas, user.id]);
        cambios.push({ campo: 'notas', anterior: accion.notas, nuevo: notas });
      }

      // Obtener acción actualizada
      const accionActualizada = await sql(`
        SELECT * FROM sales_acciones WHERE id = $1
      `, [parseInt(id)]);

      res.json({
        success: true,
        accion: accionActualizada[0],
        cambios,
        message: 'Acción actualizada correctamente'
      });
    } catch (error) {
      console.error('[PATCH /api/sales/acciones/:id] Error:', error);
      res.status(500).json({
        error: 'Error al actualizar acción',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/sales/acciones/:id/historial - Obtener historial de cambios de una acción
  app.get("/api/sales/acciones/:id/historial", jwtAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const historial = await sql(`
        SELECT
          h.id,
          h.accion_id,
          h.campo_modificado,
          h.valor_anterior,
          h.valor_nuevo,
          h.created_at,
          u.name as usuario_nombre,
          u.email as usuario_email
        FROM sales_acciones_historial h
        LEFT JOIN users u ON h.usuario_id = u.id
        WHERE h.accion_id = $1
        ORDER BY h.created_at DESC
      `, [parseInt(id)]);

      res.json({
        historial,
        total: historial.length
      });
    } catch (error) {
      console.error('[GET /api/sales/acciones/:id/historial] Error:', error);
      res.status(500).json({
        error: 'Error al obtener historial',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Verificar que las rutas estén registradas correctamente (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    const routes = app._router?.stack || [];
    const exchangeRatesRoutes = routes.filter((layer: any) => 
      layer.route && layer.route.path && layer.route.path.includes("exchange-rates")
    );

    logger.debug(`[Routes] Found ${exchangeRatesRoutes.length} exchange-rates routes registered`, {
      count: exchangeRatesRoutes.length,
      routes: exchangeRatesRoutes.map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods).filter((m: string) => m !== '_all')
      }))
    });

    // Verificar si hay prefijo duplicado
    const doublePrefixed = exchangeRatesRoutes.filter((layer: any) => 
      layer.route.path.includes("/api/api/")
    );
    if (doublePrefixed.length > 0) {
      logger.warn(`⚠️ Found ${doublePrefixed.length} route(s) with double-prefixed path`, {
        routes: doublePrefixed.map((layer: any) => layer.route.path)
      });
    }
  }

  // ========================================================================
  // ACCOUNTING HUB ENDPOINTS
  // ========================================================================
  
  // GET /api/treasury/accounting/documents - Obtener todos los documentos para contabilidad
  app.get("/api/treasury/accounting/documents", jwtAuthMiddleware, async (req, res) => {
    try {
      const vouchers = await storage.getPaymentVouchers();
      
      // Obtener empresas y scheduled payments
      const allCompanies = await storage.getCompanies();
      const scheduledPayments: any[] = [];
      for (const company of allCompanies) {
        const companyPayments = await storage.getScheduledPaymentsByCompany(company.id);
        scheduledPayments.push(...companyPayments);
      }
      
      // Crear mapa de empresas para nombres
      const companiesMap = new Map(allCompanies.map(c => [c.id, c.name]));
      
      // Combinar vouchers y scheduled payments en documentos unificados
      const documents = vouchers.map((v: any) => ({
        id: v.id,
        type: v.invoiceFileUrl ? "invoice" : "voucher",
        companyId: v.payerCompanyId || v.payer_company_id,
        companyName: companiesMap.get(v.payerCompanyId || v.payer_company_id) || "N/A",
        supplierName: v.clientName || v.client_name,
        amount: v.extractedAmount || v.extracted_amount || 0,
        currency: v.extractedCurrency || v.extracted_currency || "MXN",
        date: v.extractedDate || v.extracted_date || v.createdAt || v.created_at,
        status: v.status || "factura_pagada",
        files: {
          invoice: v.invoiceFileUrl ? {
            url: v.invoiceFileUrl,
            name: v.invoiceFileName || "factura.pdf"
          } : undefined,
          voucher: v.voucherFileUrl ? {
            url: v.voucherFileUrl,
            name: v.voucherFileName || "comprobante.pdf"
          } : undefined,
          complement: v.complementFileUrl ? {
            url: v.complementFileUrl,
            name: v.complementFileName || "complemento.pdf"
          } : undefined,
        },
        extractedData: {
          invoiceNumber: v.extractedReference || v.extracted_reference,
          taxId: null, // No está en payment_vouchers actualmente
          bank: v.extractedBank || v.extracted_bank,
          reference: v.extractedReference || v.extracted_reference,
          trackingKey: v.extractedTrackingKey || v.extracted_tracking_key,
        },
      }));
      
      // Agregar scheduled payments como facturas pendientes
      const invoiceDocuments = scheduledPayments
        .filter((sp: any) => sp.status !== "payment_completed")
        .map((sp: any) => ({
          id: `sp-${sp.id}`,
          type: "invoice" as const,
          companyId: sp.companyId || sp.company_id,
          companyName: companiesMap.get(sp.companyId || sp.company_id) || "N/A",
          supplierName: sp.supplierName || sp.supplier_name || "N/A",
          amount: sp.amount || 0,
          currency: sp.currency || "MXN",
          date: sp.dueDate || sp.due_date || sp.createdAt || sp.created_at,
          status: sp.status || "pending",
          files: {
            invoice: sp.hydralFileUrl ? {
              url: sp.hydralFileUrl,
              name: sp.hydralFileName || "factura.pdf"
            } : undefined,
          },
          extractedData: {
            invoiceNumber: sp.reference,
            taxId: null,
            bank: null,
            reference: sp.reference,
            trackingKey: null,
          },
        }));
      
      res.json([...documents, ...invoiceDocuments]);
    } catch (error) {
      console.error("Error fetching accounting documents:", error);
      res.status(500).json({ error: "Error al obtener documentos" });
    }
  });
  
  // POST /api/treasury/accounting/download-batch - Descarga masiva de documentos
  app.post("/api/treasury/accounting/download-batch", jwtAuthMiddleware, async (req, res) => {
    try {
      const { documentIds } = req.body;
      
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "Se requiere un array de IDs de documentos" });
      }
      
      // Por ahora, retornar error ya que necesitaríamos una librería de compresión
      // En producción, usar archiver o similar
      res.status(501).json({ 
        error: "Descarga masiva en desarrollo",
        message: "Esta funcionalidad está en desarrollo. Por favor descarga los documentos individualmente."
      });
    } catch (error) {
      console.error("Error en descarga masiva:", error);
      res.status(500).json({ error: "Error al procesar descarga masiva" });
    }
  });
  
  // GET /api/treasury/accounting/export - Exportar resumen a Excel
  app.get("/api/treasury/accounting/export", jwtAuthMiddleware, async (req, res) => {
    try {
      const { type, company, status, dateFrom, dateTo } = req.query;
      
      // Obtener documentos filtrados (similar a /documents pero con filtros)
      const vouchers = await storage.getPaymentVouchers();
      
      // Aplicar filtros básicos
      let filtered = vouchers;
      if (type && type !== "all") {
        // Filtrar por tipo si es necesario
      }
      if (company && company !== "all") {
        filtered = filtered.filter((v: any) => (v.payerCompanyId || v.payer_company_id) === parseInt(company as string));
      }
      if (status && status !== "all") {
        filtered = filtered.filter((v: any) => (v.status || "factura_pagada") === status);
      }
      
      // Generar CSV simple (en producción usar exceljs o similar)
      const csvRows = [
        ["Tipo", "Empresa", "Proveedor", "Monto", "Moneda", "Fecha", "Estado", "Referencia"].join(","),
        ...filtered.map((v: any) => [
          v.invoiceFileUrl ? "Factura" : "Comprobante",
          v.payerCompanyId || v.payer_company_id,
          v.clientName || v.client_name || "",
          v.extractedAmount || v.extracted_amount || 0,
          v.extractedCurrency || v.extracted_currency || "MXN",
          v.extractedDate || v.extracted_date || "",
          v.status || "factura_pagada",
          v.extractedReference || v.extracted_reference || "",
        ].join(","))
      ];
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="resumen-contabilidad-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join("\n"));
    } catch (error) {
      console.error("Error exportando resumen:", error);
      res.status(500).json({ error: "Error al exportar resumen" });
    }
  });

  // ========================================================================
  // SMART SEARCH / AI ASSISTANT ENDPOINT
  // ========================================================================
  // POST /api/ask - Interpretar preguntas en lenguaje natural sobre datos
  // Usa EcoNova (Claude) o OpenAI segun configuracion
  app.post("/api/ask", jwtAuthMiddleware, async (req, res) => {
    try {
      const { question, conversationHistory } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Pregunta requerida' });
      }

      console.log(`[POST /api/ask] Procesando pregunta: "${question}"`);
      console.log(`[POST /api/ask] Historial de conversación: ${conversationHistory?.length || 0} mensajes`);

      // Extraer contexto del usuario autenticado
      const user = (req as any).user;
      const context = {
        userId: user?.id,
        companyId: user?.companyId,
        // Pasar historial de conversación para que Claude tenga memoria
        conversationHistory: Array.isArray(conversationHistory)
          ? conversationHistory.slice(-10) // Limitar a últimos 10 mensajes para evitar tokens excesivos
          : undefined
      };

      // Usar EcoNova (Claude) si ANTHROPIC_API_KEY esta configurada
      // De lo contrario, usar smartSearch (OpenAI)
      let result;
      const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
      console.log(`[POST /api/ask] ANTHROPIC_API_KEY configurada: ${hasAnthropicKey}`);

      if (hasAnthropicKey) {
        console.log('[POST /api/ask] Usando EcoNova (Claude)');
        result = await econovaSearch(question, context);
      } else {
        console.log('[POST /api/ask] Usando smartSearch (OpenAI)');
        result = await smartSearch(question);
      }

      console.log(`[POST /api/ask] Resultado source: ${result.source}`);

      res.json(result);
    } catch (error) {
      console.error('[POST /api/ask] Error:', error);
      res.status(500).json({
        answer: 'Ocurrio un error al procesar tu pregunta. Por favor intenta de nuevo.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ========================================================================
  // N8N INTEGRATION ENDPOINTS
  // ========================================================================

  // POST /api/n8n/webhook - Endpoint para recibir respuestas de n8n
  app.post("/api/n8n/webhook", async (req, res) => {
    try {
      const { type, data } = req.body;

      // Verificar token de autenticación de n8n (opcional pero recomendado)
      const n8nToken = req.headers['x-n8n-token'];
      const expectedToken = process.env.N8N_WEBHOOK_TOKEN;

      if (expectedToken && n8nToken !== expectedToken) {
        return res.status(401).json({ error: 'Token inválido' });
      }

      console.log(`[N8N Webhook] Recibido tipo: ${type}`);

      switch (type) {
        case 'alert':
          // Procesar alerta de anomalía
          console.log('[N8N Webhook] Alerta recibida:', data);
          // Aquí podrías emitir un WebSocket event o guardar en DB
          break;
        case 'report':
          // Procesar reporte semanal
          console.log('[N8N Webhook] Reporte recibido');
          break;
        default:
          console.log('[N8N Webhook] Tipo desconocido:', type);
      }

      res.json({ success: true, received: type });
    } catch (error) {
      console.error('[N8N Webhook] Error:', error);
      res.status(500).json({ error: 'Error procesando webhook' });
    }
  });

  // GET /api/n8n/context - Proporcionar contexto de datos para n8n
  app.get("/api/n8n/context", async (req, res) => {
    try {
      // Token de autenticación
      const n8nToken = req.headers['x-n8n-token'];
      const expectedToken = process.env.N8N_WEBHOOK_TOKEN;

      if (expectedToken && n8nToken !== expectedToken) {
        return res.status(401).json({ error: 'Token inválido' });
      }

      // Obtener contexto general del sistema
      const duraStats = await getSalesMetrics(1);
      const orsegaStats = await getSalesMetrics(2);
      const exchangeRates = await sql`SELECT * FROM exchange_rates ORDER BY date DESC LIMIT 100`;

      res.json({
        timestamp: new Date().toISOString(),
        companies: {
          dura: duraStats,
          orsega: orsegaStats
        },
        exchangeRates,
        systemInfo: {
          version: '2.0',
          aiEnabled: !!process.env.OPENAI_API_KEY
        }
      });
    } catch (error) {
      console.error('[N8N Context] Error:', error);
      res.status(500).json({ error: 'Error obteniendo contexto' });
    }
  });

  // POST /api/n8n/query - Ejecutar query SQL desde n8n (solo SELECT)
  app.post("/api/n8n/query", async (req, res) => {
    try {
      const n8nToken = req.headers['x-n8n-token'];
      const expectedToken = process.env.N8N_WEBHOOK_TOKEN;

      if (expectedToken && n8nToken !== expectedToken) {
        return res.status(401).json({ error: 'Token inválido' });
      }

      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query requerido' });
      }

      // Validar que sea solo SELECT
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery.startsWith('select')) {
        return res.status(400).json({ error: 'Solo se permiten consultas SELECT' });
      }

      // Bloquear palabras peligrosas
      const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'grant', 'revoke'];
      for (const word of forbidden) {
        if (normalizedQuery.includes(word)) {
          return res.status(400).json({ error: `Operación no permitida: ${word}` });
        }
      }

      console.log(`[N8N Query] Ejecutando: ${query}`);
      const result = await db.execute(drizzleSql.raw(query));

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('[N8N Query] Error:', error);
      res.status(500).json({
        error: 'Error ejecutando query',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Endpoint de diagnóstico para archivos estáticos (solo en desarrollo/staging)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG === 'true') {
    app.get('/api/debug/static-files', jwtAuthMiddleware, async (req, res) => {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        const publicDir = path.join(process.cwd(), 'public');
        const distPublicDir = path.join(process.cwd(), 'dist', 'public');
        const serverPublicDir = path.resolve(import.meta.dirname, 'public');
        
        const result: any = {
          cwd: process.cwd(),
          publicExists: fs.existsSync(publicDir),
          distPublicExists: fs.existsSync(distPublicDir),
          serverPublicExists: fs.existsSync(serverPublicDir),
          filesInPublic: [],
          filesInDistPublic: [],
          filesInServerPublic: [],
        };
        
        if (result.publicExists) {
          result.filesInPublic = fs.readdirSync(publicDir);
        }
        if (result.distPublicExists) {
          result.filesInDistPublic = fs.readdirSync(distPublicDir);
        }
        if (result.serverPublicExists) {
          result.filesInServerPublic = fs.readdirSync(serverPublicDir);
        }
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Error checking static files', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  // ============================================
  // CLOUDFLARE R2 FILE STORAGE ENDPOINTS
  // ============================================

  // GET /api/files/info - Obtener información del almacenamiento
  app.get('/api/files/info', jwtAuthMiddleware, (req, res) => {
    res.json(fileStorage.getStorageInfo());
  });

  // GET /api/files/url/:key(*) - Obtener URL firmada para ver/descargar archivo
  // El (*) permite que el key contenga "/"
  app.get('/api/files/url/*', jwtAuthMiddleware, async (req, res) => {
    try {
      const key = req.params[0]; // Captura todo después de /api/files/url/
      
      if (!key) {
        return res.status(400).json({ error: 'File key is required' });
      }

      // Si R2 está configurado, obtener URL firmada
      if (fileStorage.isR2Configured()) {
        const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // Default 1 hora
        const inline = req.query.inline === 'true';
        
        const url = inline 
          ? await fileStorage.getViewUrl(key, expiresIn)
          : await fileStorage.getDownloadUrl(key, expiresIn);
        
        res.json({ url, provider: 'r2', key, expiresIn });
      } else {
        // Fallback: devolver URL local
        const localUrl = key.startsWith('/') ? key : `/${key}`;
        res.json({ url: localUrl, provider: 'local', key });
      }
    } catch (error) {
      console.error('[Files] Error getting URL:', error);
      res.status(500).json({ 
        error: 'Error getting file URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /api/files/upload - Subir archivo a R2 (con fallback a local)
  const fileUploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  });

  app.post('/api/files/upload', jwtAuthMiddleware, fileUploadMiddleware.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const category = (req.body.category || 'temp') as fileStorage.FileCategory;
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : undefined;

      const result = await fileStorage.uploadFileWithFallback(
        req.file.buffer,
        req.file.originalname,
        category
      );

      res.json({
        success: true,
        ...result,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      console.error('[Files] Error uploading:', error);
      res.status(500).json({ 
        error: 'Error uploading file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // DELETE /api/files/:key(*) - Eliminar archivo de R2
  app.delete('/api/files/*', jwtAuthMiddleware, async (req, res) => {
    try {
      const key = req.params[0];
      
      if (!key) {
        return res.status(400).json({ error: 'File key is required' });
      }

      if (fileStorage.isR2Configured()) {
        const success = await fileStorage.deleteFile(key);
        res.json({ success, key });
      } else {
        // Para archivos locales, eliminar del disco
        const localPath = path.join(process.cwd(), key.startsWith('/') ? key.slice(1) : key);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          res.json({ success: true, key });
        } else {
          res.status(404).json({ error: 'File not found', key });
        }
      }
    } catch (error) {
      console.error('[Files] Error deleting:', error);
      res.status(500).json({ 
        error: 'Error deleting file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  return app;
}
