var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  actionPlans: () => actionPlans,
  areas: () => areas,
  clients: () => clients,
  companies: () => companies,
  cycleTimeMetricsSchema: () => cycleTimeMetricsSchema,
  insertActionPlanSchema: () => insertActionPlanSchema,
  insertAreaSchema: () => insertAreaSchema,
  insertClientSchema: () => insertClientSchema,
  insertCompanySchema: () => insertCompanySchema,
  insertJobProfileSchema: () => insertJobProfileSchema,
  insertKpiSchema: () => insertKpiSchema,
  insertKpiValueSchema: () => insertKpiValueSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertShipmentCycleTimesSchema: () => insertShipmentCycleTimesSchema,
  insertShipmentNotificationSchema: () => insertShipmentNotificationSchema,
  insertShipmentSchema: () => insertShipmentSchema,
  insertShipmentUpdateSchema: () => insertShipmentUpdateSchema,
  insertUserActivationTokenSchema: () => insertUserActivationTokenSchema,
  insertUserSchema: () => insertUserSchema,
  jobProfileWithDetails: () => jobProfileWithDetails,
  jobProfiles: () => jobProfiles,
  kpiValues: () => kpiValues,
  kpis: () => kpis,
  loginSchema: () => loginSchema,
  notifications: () => notifications,
  registerUserSchema: () => registerUserSchema,
  shipmentCycleTimes: () => shipmentCycleTimes,
  shipmentNotifications: () => shipmentNotifications,
  shipmentStatusEnum: () => shipmentStatusEnum,
  shipmentUpdates: () => shipmentUpdates,
  shipments: () => shipments,
  updateKpiSchema: () => updateKpiSchema,
  updateKpiValueSchema: () => updateKpiValueSchema,
  updateShipmentStatusSchema: () => updateShipmentStatusSchema,
  userActivationTokens: () => userActivationTokens,
  users: () => users
});
import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var shipmentStatusEnum, users, insertUserSchema, userActivationTokens, insertUserActivationTokenSchema, companies, insertCompanySchema, areas, insertAreaSchema, kpis, insertKpiSchema, kpiValues, insertKpiValueSchema, actionPlans, insertActionPlanSchema, loginSchema, updateKpiValueSchema, updateKpiSchema, registerUserSchema, shipments, insertShipmentSchema, shipmentUpdates, insertShipmentUpdateSchema, notifications, insertNotificationSchema, shipmentNotifications, insertShipmentNotificationSchema, updateShipmentStatusSchema, jobProfiles, insertJobProfileSchema, jobProfileWithDetails, shipmentCycleTimes, insertShipmentCycleTimesSchema, cycleTimeMetricsSchema, clients, insertClientSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    shipmentStatusEnum = pgEnum("shipment_status", [
      "pending",
      // Pendiente de envío
      "in_transit",
      // En tránsito
      "delayed",
      // Retrasado
      "delivered",
      // Entregado
      "cancelled"
      // Cancelado/Cerrado (entregado y finalizado administrativamente)
    ]);
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
      password: text("password").notNull(),
      role: text("role").notNull().default("viewer"),
      companyId: integer("company_id"),
      areaId: integer("area_id"),
      // Área específica del usuario
      lastLogin: timestamp("last_login")
    });
    insertUserSchema = createInsertSchema(users).omit({ id: true, lastLogin: true });
    userActivationTokens = pgTable("user_activation_tokens", {
      id: serial("id").primaryKey(),
      token: text("token").notNull().unique(),
      email: text("email").notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      used: boolean("used").default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserActivationTokenSchema = createInsertSchema(userActivationTokens).omit({ id: true, createdAt: true });
    companies = pgTable("companies", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      sector: text("sector"),
      logo: text("logo"),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
    areas = pgTable("areas", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      companyId: integer("company_id").notNull()
    });
    insertAreaSchema = createInsertSchema(areas).omit({ id: true });
    kpis = pgTable("kpis", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      areaId: integer("area_id").notNull(),
      companyId: integer("company_id").notNull(),
      unit: text("unit").notNull(),
      target: text("target").notNull(),
      frequency: text("frequency").notNull(),
      // weekly, monthly, quarterly, annual
      calculationMethod: text("calculation_method"),
      responsible: text("responsible"),
      invertedMetric: boolean("inverted_metric").default(false)
      // true si valores menores son mejores
    });
    insertKpiSchema = createInsertSchema(kpis).omit({ id: true });
    kpiValues = pgTable("kpi_values", {
      id: serial("id").primaryKey(),
      kpiId: integer("kpi_id").notNull(),
      userId: integer("user_id").notNull(),
      // ID del usuario específico al que pertenece este KPI
      value: text("value").notNull(),
      date: timestamp("date").defaultNow(),
      period: text("period").notNull(),
      // Month/Quarter/Year the value belongs to
      compliancePercentage: text("compliance_percentage"),
      status: text("status"),
      // complies, alert, not_compliant
      comments: text("comments"),
      updatedBy: integer("updated_by")
      // ID del usuario que actualizó este KPI
    });
    insertKpiValueSchema = createInsertSchema(kpiValues).omit({ id: true, date: true });
    actionPlans = pgTable("action_plans", {
      id: serial("id").primaryKey(),
      kpiId: integer("kpi_id").notNull(),
      problemDescription: text("problem_description").notNull(),
      correctiveActions: text("corrective_actions").notNull(),
      responsible: text("responsible").notNull(),
      startDate: timestamp("start_date").notNull(),
      endDate: timestamp("end_date").notNull(),
      status: text("status").notNull(),
      // pending, in_progress, completed
      results: text("results")
    });
    insertActionPlanSchema = createInsertSchema(actionPlans).omit({ id: true });
    loginSchema = z.object({
      username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
      password: z.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres")
    });
    updateKpiValueSchema = insertKpiValueSchema.extend({
      compliancePercentage: z.string().optional(),
      status: z.string().optional()
    });
    updateKpiSchema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      areaId: z.number().optional(),
      companyId: z.number().optional(),
      unit: z.string().optional(),
      target: z.union([z.string(), z.number()]).transform(
        (val) => typeof val === "number" ? val.toString() : val
      ).optional(),
      frequency: z.string().optional(),
      calculationMethod: z.string().optional(),
      responsible: z.string().optional(),
      invertedMetric: z.boolean().optional()
    });
    registerUserSchema = insertUserSchema.extend({
      password: z.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres"),
      confirmPassword: z.string().min(6, "La contrase\xF1a debe tener al menos 6 caracteres")
    }).refine((data) => data.password === data.confirmPassword, {
      message: "Las contrase\xF1as no coinciden",
      path: ["confirmPassword"]
    });
    shipments = pgTable("shipments", {
      id: serial("id").primaryKey(),
      trackingCode: text("tracking_code").notNull().unique(),
      // Código de seguimiento
      companyId: integer("company_id").notNull(),
      // Empresa a la que pertenece el envío
      customerName: text("customer_name").notNull(),
      // Nombre del cliente
      purchaseOrder: text("purchase_order").notNull(),
      // Orden de compra
      customerEmail: text("customer_email"),
      // Email del cliente para notificaciones
      customerPhone: text("customer_phone"),
      // Teléfono del cliente para notificaciones
      destination: text("destination").notNull(),
      // Destino del envío
      origin: text("origin").notNull(),
      // Origen del envío
      product: text("product").notNull(),
      // Producto que se envía
      quantity: text("quantity").notNull(),
      // Cantidad del producto
      unit: text("unit").notNull(),
      // Unidad de medida (KG, unidades, etc.)
      departureDate: timestamp("departure_date"),
      // Fecha de salida
      estimatedDeliveryDate: timestamp("estimated_delivery_date"),
      // Fecha estimada de entrega
      actualDeliveryDate: timestamp("actual_delivery_date"),
      // Fecha real de entrega
      status: shipmentStatusEnum("status").notNull().default("pending"),
      // Estado del envío
      carrier: text("carrier"),
      // Transportista
      vehicleInfo: text("vehicle_info"),
      // Información del vehículo
      vehicleType: text("vehicle_type"),
      // Tipo de vehículo (camión, cisterna, etc.)
      fuelType: text("fuel_type"),
      // Tipo de combustible (diesel, gasolina, etc.)
      distance: text("distance"),
      // Distancia en kilómetros
      carbonFootprint: text("carbon_footprint"),
      // Huella de carbono calculada (kg CO2e)
      driverName: text("driver_name"),
      // Nombre del conductor
      driverPhone: text("driver_phone"),
      // Teléfono del conductor
      comments: text("comments"),
      // Comentarios adicionales
      createdAt: timestamp("created_at").defaultNow(),
      // Fecha de creación del registro
      updatedAt: timestamp("updated_at").defaultNow()
      // Fecha de última actualización
    });
    insertShipmentSchema = createInsertSchema(shipments).omit({ id: true, createdAt: true, updatedAt: true });
    shipmentUpdates = pgTable("shipment_updates", {
      id: serial("id").primaryKey(),
      shipmentId: integer("shipment_id").notNull(),
      // Relación con el envío
      status: shipmentStatusEnum("status").notNull(),
      // Estado del envío en esta actualización
      location: text("location"),
      // Ubicación del envío al momento de la actualización
      comments: text("comments"),
      // Comentarios sobre la actualización
      updatedBy: integer("updated_by"),
      // Usuario que realizó la actualización
      timestamp: timestamp("timestamp").defaultNow()
      // Fecha y hora de la actualización
    });
    insertShipmentUpdateSchema = createInsertSchema(shipmentUpdates).omit({ id: true, timestamp: true });
    notifications = pgTable("notifications", {
      id: serial("id").primaryKey(),
      title: text("title").notNull(),
      message: text("message").notNull(),
      type: text("type").notNull().default("info"),
      // info, warning, success, announcement
      fromUserId: integer("from_user_id").notNull(),
      toUserId: integer("to_user_id"),
      // null means broadcast to all
      companyId: integer("company_id"),
      // null means all companies
      areaId: integer("area_id"),
      // null means all areas
      priority: text("priority").notNull().default("normal"),
      // low, normal, high, urgent
      read: boolean("read").default(false),
      createdAt: timestamp("created_at").defaultNow(),
      readAt: timestamp("read_at")
    });
    insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
    shipmentNotifications = pgTable("shipment_notifications", {
      id: serial("id").primaryKey(),
      shipmentId: integer("shipment_id").notNull(),
      // Relación con el envío
      emailTo: text("email_to").notNull(),
      // Email del destinatario
      subject: text("subject").notNull(),
      // Asunto del email
      status: text("status").notNull(),
      // sent, failed, pending
      sentAt: timestamp("sent_at").defaultNow(),
      // Fecha y hora del envío
      sentBy: integer("sent_by").notNull(),
      // Usuario que envió la notificación
      shipmentStatus: shipmentStatusEnum("shipment_status").notNull(),
      // Estado del envío al momento del envío
      errorMessage: text("error_message")
      // Mensaje de error si falló el envío
    });
    insertShipmentNotificationSchema = createInsertSchema(shipmentNotifications).omit({ id: true, sentAt: true });
    updateShipmentStatusSchema = z.object({
      status: z.enum(["pending", "in_transit", "delayed", "delivered", "cancelled"]),
      sendNotification: z.boolean().default(true),
      comments: z.string().optional(),
      location: z.string().optional()
    });
    jobProfiles = pgTable("job_profiles", {
      id: serial("id").primaryKey(),
      areaId: integer("area_id").notNull(),
      // Área a la que pertenece el puesto
      companyId: integer("company_id").notNull(),
      // Empresa a la que pertenece
      title: text("title").notNull(),
      // Título del puesto
      description: text("description").notNull(),
      // Descripción detallada del puesto
      mainActivities: json("main_activities").notNull(),
      // Array de actividades principales
      responsibilities: json("responsibilities").notNull(),
      // Array de responsabilidades
      kpiInstructions: json("kpi_instructions").notNull(),
      // Instrucciones sobre KPIs
      tips: json("tips").notNull(),
      // Tips para el éxito en el puesto
      processes: json("processes").notNull(),
      // Procesos y procedimientos
      updateFrequency: json("update_frequency").notNull(),
      // Frecuencia de actualización de KPIs
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    });
    insertJobProfileSchema = createInsertSchema(jobProfiles).omit({ id: true, createdAt: true, updatedAt: true });
    jobProfileWithDetails = z.object({
      id: z.number(),
      areaId: z.number(),
      companyId: z.number(),
      title: z.string(),
      description: z.string(),
      mainActivities: z.array(z.string()),
      responsibilities: z.array(z.string()),
      kpiInstructions: z.array(z.object({
        kpiName: z.string(),
        description: z.string(),
        updateFrequency: z.string(),
        instructions: z.string()
      })),
      tips: z.array(z.object({
        category: z.string(),
        tip: z.string()
      })),
      processes: z.array(z.object({
        name: z.string(),
        description: z.string(),
        steps: z.array(z.string())
      })),
      updateFrequency: z.object({
        daily: z.array(z.string()),
        weekly: z.array(z.string()),
        monthly: z.array(z.string())
      }),
      areaName: z.string(),
      companyName: z.string(),
      userKpis: z.array(z.object({
        id: z.number(),
        name: z.string(),
        target: z.string(),
        frequency: z.string()
      }))
    });
    shipmentCycleTimes = pgTable("shipment_cycle_times", {
      id: serial("id").primaryKey(),
      shipmentId: integer("shipment_id").notNull().unique(),
      // Relación con el envío
      companyId: integer("company_id").notNull(),
      // Empresa del envío
      // Timestamps de cada fase
      createdAt: timestamp("created_at").notNull(),
      // Cuándo se creó el envío
      pendingAt: timestamp("pending_at"),
      // Primera vez que fue marcado como pendiente
      inTransitAt: timestamp("in_transit_at"),
      // Primera vez que fue marcado como en tránsito
      deliveredAt: timestamp("delivered_at"),
      // Primera vez que fue marcado como entregado
      closedAt: timestamp("closed_at"),
      // Primera vez que fue marcado como cerrado/cancelado
      // Duraciones calculadas en horas (decimal)
      hoursPendingToTransit: text("hours_pending_to_transit"),
      // Tiempo de despacho
      hoursTransitToDelivered: text("hours_transit_to_delivered"),
      // Tiempo de transporte
      hoursDeliveredToClosed: text("hours_delivered_to_closed"),
      // Tiempo de cierre
      hoursTotalCycle: text("hours_total_cycle"),
      // Tiempo total: creación → cierre
      hoursToDelivery: text("hours_to_delivery"),
      // Tiempo hasta entrega: creación → entregado
      // Metadata
      computedAt: timestamp("computed_at").defaultNow(),
      // Cuándo se calcularon las métricas
      updatedAt: timestamp("updated_at").defaultNow()
      // Última actualización
    });
    insertShipmentCycleTimesSchema = createInsertSchema(shipmentCycleTimes).omit({
      id: true,
      computedAt: true,
      updatedAt: true
    });
    cycleTimeMetricsSchema = z.object({
      period: z.string(),
      // 'day', 'week', 'month'
      startDate: z.string(),
      endDate: z.string(),
      companyId: z.number().optional(),
      avgPendingToTransit: z.number().nullable(),
      avgTransitToDelivered: z.number().nullable(),
      avgDeliveredToClosed: z.number().nullable(),
      avgTotalCycle: z.number().nullable(),
      avgToDelivery: z.number().nullable(),
      totalShipments: z.number(),
      completedShipments: z.number()
      // Envíos que llegaron a "cerrado"
    });
    clients = pgTable("clients", {
      id: serial("id").primaryKey(),
      name: text("name").notNull(),
      // Nombre o razón social del cliente
      email: text("email").notNull(),
      // Email principal para notificaciones
      phone: text("phone"),
      // Teléfono del cliente
      contactPerson: text("contact_person"),
      // Nombre del contacto principal (campo existente)
      company: text("company"),
      // Empresa/organización del cliente (campo existente)
      address: text("address"),
      // Dirección del cliente
      paymentTerms: integer("payment_terms"),
      // Términos de pago (campo existente como integer)
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
      requiresReceipt: boolean("requires_receipt").default(true),
      // Si requiere acuse de recibo (campo existente)
      reminderFrequency: integer("reminder_frequency"),
      // Frecuencia de recordatorios (campo existente)
      isActive: boolean("is_active").default(true),
      // Cliente activo (campo existente)
      notes: text("notes"),
      // Notas adicionales (campo existente)
      // Nuevos campos que agregamos
      companyId: integer("company_id"),
      // Empresa a la que pertenece (Dura=1 o Orsega=2)
      clientCode: text("client_code"),
      // Código interno del cliente
      secondaryEmail: text("secondary_email"),
      // Email secundario opcional
      city: text("city"),
      // Ciudad
      state: text("state"),
      // Estado/Provincia
      postalCode: text("postal_code"),
      // Código postal
      country: text("country").default("M\xE9xico"),
      // País
      emailNotifications: boolean("email_notifications").default(true),
      // Si recibe notificaciones por email
      preferredLanguage: text("preferred_language").default("es"),
      // Idioma preferido (es/en)
      customerType: text("customer_type"),
      // Tipo de cliente (distribuidor, mayorista, etc.)
      salesRepresentative: text("sales_representative"),
      // Representante de ventas asignado
      creditLimit: text("credit_limit")
      // Límite de crédito
    });
    insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
  }
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
var pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = WebSocket;
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema: schema_exports });
  }
});

// server/seed-production.ts
var seed_production_exports = {};
__export(seed_production_exports, {
  seedProductionData: () => seedProductionData
});
async function seedProductionData() {
  try {
    console.log("\u{1F331} Iniciando seeding de datos de producci\xF3n...");
    const existingCompanies = await db.select().from(companies);
    const existingAreas = await db.select().from(areas);
    const existingKpis = await db.select().from(kpis);
    console.log(`\u{1F4CA} Estado actual: companies=${existingCompanies.length}, areas=${existingAreas.length}, kpis=${existingKpis.length}`);
    if (existingCompanies.length >= 2 && existingAreas.length >= 12 && existingKpis.length >= 5) {
      console.log("\u2705 Base de datos ya tiene datos completos");
      return {
        success: true,
        message: "Database already seeded",
        companies: existingCompanies.length,
        areas: existingAreas.length,
        kpis: existingKpis.length
      };
    }
    let insertedCompanies = existingCompanies;
    if (existingCompanies.length < 2) {
      console.log("\u{1F4CA} Insertando companies faltantes...");
      const duraExists = existingCompanies.some((c) => c.id === 1);
      const orsegaExists = existingCompanies.some((c) => c.id === 2);
      const toInsert = [];
      if (!duraExists) {
        toInsert.push({
          id: 1,
          name: "Dura International",
          description: "Empresa l\xEDder en la industria qu\xEDmica",
          sector: "Qu\xEDmica"
        });
      }
      if (!orsegaExists) {
        toInsert.push({
          id: 2,
          name: "Grupo Orsega",
          description: "Empresa especializada en productos qu\xEDmicos",
          sector: "Qu\xEDmica"
        });
      }
      if (toInsert.length > 0) {
        await db.insert(companies).values(toInsert);
      }
      insertedCompanies = await db.select().from(companies);
    }
    if (existingAreas.length < 12) {
      console.log("\u{1F3E2} Insertando areas faltantes...");
      const areasToInsert = [
        { id: 1, name: "Ventas", description: "\xC1rea de Ventas para Dura International", companyId: 1 },
        { id: 2, name: "Log\xEDstica", description: "\xC1rea de Log\xEDstica para Dura International", companyId: 1 },
        { id: 3, name: "Contabilidad y Finanzas", description: "\xC1rea de Contabilidad y Finanzas para Dura International", companyId: 1 },
        { id: 4, name: "Ventas", description: "\xC1rea de Ventas para Grupo Orsega", companyId: 2 },
        { id: 5, name: "Log\xEDstica", description: "\xC1rea de Log\xEDstica para Grupo Orsega", companyId: 2 },
        { id: 6, name: "Contabilidad y Finanzas", description: "\xC1rea de Contabilidad y Finanzas para Grupo Orsega", companyId: 2 },
        { id: 7, name: "Compras", description: "\xC1rea de Compras para Dura International", companyId: 1 },
        { id: 8, name: "Almac\xE9n", description: "\xC1rea de Almac\xE9n para Dura International", companyId: 1 },
        { id: 9, name: "Tesorer\xEDa", description: "\xC1rea de Tesorer\xEDa para Dura International", companyId: 1 },
        { id: 10, name: "Compras", description: "\xC1rea de Compras para Grupo Orsega", companyId: 2 },
        { id: 11, name: "Almac\xE9n", description: "\xC1rea de Almac\xE9n para Grupo Orsega", companyId: 2 },
        { id: 12, name: "Tesorer\xEDa", description: "\xC1rea de Tesorer\xEDa para Grupo Orsega", companyId: 2 }
      ];
      const existingAreaIds = existingAreas.map((a) => a.id);
      const newAreas = areasToInsert.filter((area) => !existingAreaIds.includes(area.id));
      if (newAreas.length > 0) {
        await db.insert(areas).values(newAreas);
      }
    }
    if (existingKpis.length < 5) {
      console.log("\u{1F4C8} Insertando KPIs faltantes de Grupo Orsega...");
      const kpisToInsert = [
        {
          id: 2,
          name: "Precisi\xF3n en estados financieros",
          description: "Mide la exactitud de los estados financieros generados. Objetivo: cero errores en emisi\xF3n de informaci\xF3n financiera.",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "monthly",
          calculationMethod: "Conteo de errores y salvedades",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 4,
          name: "Velocidad de rotaci\xF3n de cuentas por cobrar",
          description: "Mide el tiempo promedio para cobrar cuentas pendientes",
          areaId: 6,
          companyId: 2,
          unit: "d\xEDas",
          target: "60 d\xEDas",
          frequency: "monthly",
          calculationMethod: "Promedio de d\xEDas para cobrar",
          responsible: "Mario Reynoso",
          invertedMetric: true
        },
        {
          id: 6,
          name: "Cumplimiento de obligaciones fiscales",
          description: "Monitoreo mediante checklist para la presentaci\xF3n de impuestos",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "monthly",
          calculationMethod: "Checklist de obligaciones fiscales",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 8,
          name: "Facturaci\xF3n sin errores",
          description: "Mide la precisi\xF3n en la generaci\xF3n de facturas",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "weekly",
          calculationMethod: "(Facturas sin errores / Total de facturas) x 100",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 10,
          name: "Volumen de ventas alcanzado",
          description: "Volumen de ventas en unidades",
          areaId: 4,
          companyId: 2,
          unit: "unidades",
          target: "10.300.476 unidades",
          frequency: "monthly",
          calculationMethod: "Suma de unidades vendidas en el per\xEDodo",
          responsible: "Omar Navarro",
          invertedMetric: false
        }
      ];
      const existingKpiIds = existingKpis.map((k) => k.id);
      const newKpis = kpisToInsert.filter((kpi) => !existingKpiIds.includes(kpi.id));
      if (newKpis.length > 0) {
        await db.insert(kpis).values(newKpis);
      }
    }
    const finalCompanies = await db.select().from(companies);
    const finalAreas = await db.select().from(areas);
    const finalKpis = await db.select().from(kpis);
    console.log("\u2705 Seeding completado exitosamente!");
    return {
      success: true,
      message: "Production database seeded successfully",
      companies: finalCompanies.length,
      areas: finalAreas.length,
      kpis: finalKpis.length
    };
  } catch (error) {
    console.error("\u274C Error durante el seeding:", error);
    return {
      success: false,
      message: "Seeding failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
var init_seed_production = __esm({
  "server/seed-production.ts"() {
    "use strict";
    init_db();
    init_schema();
  }
});

// server/index.ts
import express2 from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";

// server/routes.ts
import { z as z3 } from "zod";
import bcrypt2 from "bcrypt";

// server/DatabaseStorage.ts
init_schema();
init_db();
import { eq, and, desc, isNotNull, sql } from "drizzle-orm";
var DatabaseStorage = class {
  constructor() {
  }
  // User operations
  async getUser(id) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return void 0;
    }
  }
  async getUserByEmail(email2) {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email2));
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return void 0;
    }
  }
  async getUserByUsername(username) {
    try {
      if (username.includes("@")) {
        const [user] = await db.select().from(users).where(eq(users.email, username));
        return user;
      }
      const allUsers = await db.select().from(users);
      return allUsers.find((user) => {
        const emailParts = user.email.toLowerCase().split("@");
        return emailParts.length > 0 && emailParts[0] === username.toLowerCase();
      });
    } catch (error) {
      console.error("Error getting user by username:", error);
      return void 0;
    }
  }
  async createUser(user) {
    try {
      const [createdUser] = await db.insert(users).values(user).returning();
      return createdUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  async updateUser(id, userData) {
    try {
      const [updatedUser] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      return void 0;
    }
  }
  async getUsers() {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error getting users:", error);
      return [];
    }
  }
  async deleteUser(id) {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }
  // Company operations
  async getCompany(id) {
    try {
      const [company] = await db.select().from(companies).where(eq(companies.id, id));
      return company;
    } catch (error) {
      console.error("Error getting company:", error);
      return void 0;
    }
  }
  async getCompanies() {
    try {
      return await db.select().from(companies);
    } catch (error) {
      console.error("Error getting companies:", error);
      return [];
    }
  }
  async createCompany(company) {
    try {
      const [createdCompany] = await db.insert(companies).values(company).returning();
      return createdCompany;
    } catch (error) {
      console.error("Error creating company:", error);
      throw error;
    }
  }
  async updateCompany(id, companyData) {
    try {
      const [updatedCompany] = await db.update(companies).set(companyData).where(eq(companies.id, id)).returning();
      return updatedCompany;
    } catch (error) {
      console.error("Error updating company:", error);
      return void 0;
    }
  }
  // Area operations
  async getArea(id) {
    try {
      const [area] = await db.select().from(areas).where(eq(areas.id, id));
      return area;
    } catch (error) {
      console.error("Error getting area:", error);
      return void 0;
    }
  }
  async getAreas() {
    try {
      return await db.select().from(areas);
    } catch (error) {
      console.error("Error getting areas:", error);
      return [];
    }
  }
  async getAreasByCompany(companyId) {
    try {
      return await db.select().from(areas).where(eq(areas.companyId, companyId));
    } catch (error) {
      console.error("Error getting areas by company:", error);
      return [];
    }
  }
  async createArea(area) {
    try {
      const [createdArea] = await db.insert(areas).values(area).returning();
      return createdArea;
    } catch (error) {
      console.error("Error creating area:", error);
      throw error;
    }
  }
  async updateArea(id, areaData) {
    try {
      const [updatedArea] = await db.update(areas).set(areaData).where(eq(areas.id, id)).returning();
      return updatedArea;
    } catch (error) {
      console.error("Error updating area:", error);
      return void 0;
    }
  }
  // KPI operations
  async getKpi(id) {
    try {
      const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
      return kpi;
    } catch (error) {
      console.error("Error getting KPI:", error);
      return void 0;
    }
  }
  async getKpis() {
    try {
      return await db.select().from(kpis);
    } catch (error) {
      console.error("Error getting KPIs:", error);
      return [];
    }
  }
  async getKpisByCompany(companyId) {
    try {
      return await db.select().from(kpis).where(eq(kpis.companyId, companyId));
    } catch (error) {
      console.error("Error getting KPIs by company:", error);
      return [];
    }
  }
  async getKpisByArea(areaId) {
    try {
      return await db.select().from(kpis).where(eq(kpis.areaId, areaId));
    } catch (error) {
      console.error("Error getting KPIs by area:", error);
      return [];
    }
  }
  async getKpisByCompanyAndArea(companyId, areaId) {
    try {
      return await db.select().from(kpis).where(
        and(eq(kpis.companyId, companyId), eq(kpis.areaId, areaId))
      );
    } catch (error) {
      console.error("Error getting KPIs by company and area:", error);
      return [];
    }
  }
  async createKpi(kpi) {
    try {
      const [createdKpi] = await db.insert(kpis).values(kpi).returning();
      return createdKpi;
    } catch (error) {
      console.error("Error creating KPI:", error);
      throw error;
    }
  }
  async updateKpi(id, kpiData) {
    try {
      const [updatedKpi] = await db.update(kpis).set(kpiData).where(eq(kpis.id, id)).returning();
      return updatedKpi;
    } catch (error) {
      console.error("Error updating KPI:", error);
      return void 0;
    }
  }
  async deleteKpi(id) {
    try {
      await db.delete(kpiValues).where(eq(kpiValues.kpiId, id));
      const result = await db.delete(kpis).where(eq(kpis.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting KPI:", error);
      return false;
    }
  }
  // KPI Value operations
  async getKpiValue(id) {
    try {
      const [kpiValue] = await db.select().from(kpiValues).where(eq(kpiValues.id, id));
      return kpiValue;
    } catch (error) {
      console.error("Error getting KPI value:", error);
      return void 0;
    }
  }
  async getKpiValues() {
    try {
      return await db.select().from(kpiValues);
    } catch (error) {
      console.error("Error getting KPI values:", error);
      return [];
    }
  }
  async getKpiValuesByKpi(kpiId) {
    try {
      return await db.select().from(kpiValues).where(eq(kpiValues.kpiId, kpiId));
    } catch (error) {
      console.error("Error getting KPI values by KPI:", error);
      return [];
    }
  }
  async getKpiValuesByUser(userId) {
    try {
      return await db.select().from(kpiValues).where(eq(kpiValues.userId, userId));
    } catch (error) {
      console.error("Error getting KPI values by user:", error);
      return [];
    }
  }
  async deleteKpiValuesByUser(userId, kpiId) {
    try {
      const result = await db.delete(kpiValues).where(
        and(eq(kpiValues.userId, userId), eq(kpiValues.kpiId, kpiId))
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting KPI values by user:", error);
      return false;
    }
  }
  async getLatestKpiValues(kpiId, limit) {
    try {
      return await db.select().from(kpiValues).where(eq(kpiValues.kpiId, kpiId)).orderBy(desc(kpiValues.date)).limit(limit);
    } catch (error) {
      console.error("Error getting latest KPI values:", error);
      return [];
    }
  }
  async createKpiValue(kpiValue) {
    try {
      const valueWithDate = {
        ...kpiValue,
        date: /* @__PURE__ */ new Date()
      };
      const [createdKpiValue] = await db.insert(kpiValues).values(valueWithDate).returning();
      return createdKpiValue;
    } catch (error) {
      console.error("Error creating KPI value:", error);
      throw error;
    }
  }
  // Action Plan operations
  async getActionPlan(id) {
    try {
      const [actionPlan] = await db.select().from(actionPlans).where(eq(actionPlans.id, id));
      return actionPlan;
    } catch (error) {
      console.error("Error getting action plan:", error);
      return void 0;
    }
  }
  async getActionPlansByKpi(kpiId) {
    try {
      return await db.select().from(actionPlans).where(eq(actionPlans.kpiId, kpiId));
    } catch (error) {
      console.error("Error getting action plans by KPI:", error);
      return [];
    }
  }
  async createActionPlan(actionPlan) {
    try {
      const [createdActionPlan] = await db.insert(actionPlans).values(actionPlan).returning();
      return createdActionPlan;
    } catch (error) {
      console.error("Error creating action plan:", error);
      throw error;
    }
  }
  async updateActionPlan(id, actionPlanData) {
    try {
      const [updatedActionPlan] = await db.update(actionPlans).set(actionPlanData).where(eq(actionPlans.id, id)).returning();
      return updatedActionPlan;
    } catch (error) {
      console.error("Error updating action plan:", error);
      return void 0;
    }
  }
  // Shipment operations
  async getShipment(id) {
    try {
      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
      return shipment;
    } catch (error) {
      console.error("Error getting shipment:", error);
      return void 0;
    }
  }
  async getShipmentByTrackingCode(trackingCode) {
    try {
      const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingCode, trackingCode));
      return shipment;
    } catch (error) {
      console.error("Error getting shipment by tracking code:", error);
      return void 0;
    }
  }
  async getShipments() {
    try {
      return await db.select().from(shipments);
    } catch (error) {
      console.error("Error getting shipments:", error);
      return [];
    }
  }
  async getShipmentsByCompany(companyId) {
    try {
      return await db.select().from(shipments).where(eq(shipments.companyId, companyId));
    } catch (error) {
      console.error("Error getting shipments by company:", error);
      return [];
    }
  }
  async createShipment(shipment) {
    try {
      const [createdShipment] = await db.insert(shipments).values(shipment).returning();
      return createdShipment;
    } catch (error) {
      console.error("Error creating shipment:", error);
      throw error;
    }
  }
  async updateShipment(id, shipmentData) {
    try {
      const [updatedShipment] = await db.update(shipments).set({
        ...shipmentData,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(shipments.id, id)).returning();
      return updatedShipment;
    } catch (error) {
      console.error("Error updating shipment:", error);
      return void 0;
    }
  }
  // Shipment Update operations
  async getShipmentUpdate(id) {
    try {
      const [update] = await db.select().from(shipmentUpdates).where(eq(shipmentUpdates.id, id));
      return update;
    } catch (error) {
      console.error("Error getting shipment update:", error);
      return void 0;
    }
  }
  async getShipmentUpdates(shipmentId) {
    try {
      return await db.select().from(shipmentUpdates).where(eq(shipmentUpdates.shipmentId, shipmentId)).orderBy(desc(shipmentUpdates.timestamp));
    } catch (error) {
      console.error("Error getting shipment updates:", error);
      return [];
    }
  }
  async createShipmentUpdate(update) {
    try {
      const [createdUpdate] = await db.insert(shipmentUpdates).values(update).returning();
      return createdUpdate;
    } catch (error) {
      console.error("Error creating shipment update:", error);
      throw error;
    }
  }
  // Notification operations
  async getNotification(id) {
    try {
      const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
      return notification;
    } catch (error) {
      console.error("Error getting notification:", error);
      return void 0;
    }
  }
  async getNotificationsForUser(userId) {
    try {
      return await db.select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        type: notifications.type,
        priority: notifications.priority,
        read: notifications.read,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
        fromUserId: notifications.fromUserId,
        toUserId: notifications.toUserId,
        fromUserName: users.name,
        fromUserEmail: users.email
      }).from(notifications).leftJoin(users, eq(notifications.fromUserId, users.id)).where(eq(notifications.toUserId, userId)).orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error getting notifications for user:", error);
      return [];
    }
  }
  async createNotification(notification) {
    try {
      const [createdNotification] = await db.insert(notifications).values(notification).returning();
      return createdNotification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  async markNotificationAsRead(id, userId) {
    try {
      const [updatedNotification] = await db.update(notifications).set({
        read: true,
        readAt: /* @__PURE__ */ new Date()
      }).where(and(
        eq(notifications.id, id),
        eq(notifications.toUserId, userId)
      )).returning();
      return updatedNotification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return void 0;
    }
  }
  async deleteNotification(id, userId) {
    try {
      const result = await db.delete(notifications).where(and(
        eq(notifications.id, id),
        eq(notifications.toUserId, userId)
      ));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }
  // Team activity operations
  async getLastKpiUpdateByUser(userId) {
    try {
      const [latestUpdate] = await db.select({
        kpiName: kpis.name,
        updateDate: kpiValues.date
      }).from(kpiValues).leftJoin(kpis, eq(kpiValues.kpiId, kpis.id)).where(eq(kpiValues.updatedBy, userId)).orderBy(desc(kpiValues.date)).limit(1);
      return latestUpdate;
    } catch (error) {
      console.error("Error getting last KPI update by user:", error);
      return void 0;
    }
  }
  async getTeamActivitySummary() {
    try {
      const allUsers = await db.select().from(users);
      const activitySummary = [];
      for (const user of allUsers) {
        const lastKpiUpdate = await this.getLastKpiUpdateByUser(user.id);
        activitySummary.push({
          userId: user.id,
          lastLogin: user.lastLogin,
          lastKpiUpdate: lastKpiUpdate || null
        });
      }
      return activitySummary;
    } catch (error) {
      console.error("Error getting team activity summary:", error);
      return [];
    }
  }
  // Job Profile operations
  async getJobProfile(id) {
    try {
      const [profile] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, id));
      return profile;
    } catch (error) {
      console.error("Error getting job profile:", error);
      return void 0;
    }
  }
  async getJobProfileByUserArea(areaId, companyId) {
    try {
      const [profile] = await db.select().from(jobProfiles).where(
        and(eq(jobProfiles.areaId, areaId), eq(jobProfiles.companyId, companyId))
      );
      return profile;
    } catch (error) {
      console.error("Error getting job profile by area:", error);
      return void 0;
    }
  }
  async getJobProfileWithDetails(userId) {
    try {
      console.log(`[JobProfile] Getting profile for user ID: ${userId}`);
      const user = await this.getUser(userId);
      console.log(`[JobProfile] User found:`, user);
      if (!user || !user.areaId || !user.companyId) {
        console.log(`[JobProfile] User or area/company missing for user ${userId}`);
        return void 0;
      }
      const profile = await this.getJobProfileByUserArea(user.areaId, user.companyId);
      console.log(`[JobProfile] Profile found:`, profile);
      if (!profile) {
        console.log(`[JobProfile] No profile found for area ${user.areaId}, company ${user.companyId}`);
        return void 0;
      }
      const area = await this.getArea(user.areaId);
      const company = await this.getCompany(user.companyId);
      const userKpis = await this.getUserKpis(userId);
      const profileWithDetails = {
        id: profile.id,
        areaId: profile.areaId,
        companyId: profile.companyId,
        title: profile.title,
        description: profile.description,
        mainActivities: profile.mainActivities,
        responsibilities: profile.responsibilities,
        kpiInstructions: profile.kpiInstructions,
        tips: profile.tips,
        processes: profile.processes,
        updateFrequency: profile.updateFrequency,
        areaName: area?.name || "",
        companyName: company?.name || "",
        userKpis: userKpis.map((kpi) => ({
          id: kpi.id,
          name: kpi.name,
          target: kpi.target,
          frequency: kpi.frequency
        }))
      };
      console.log(`[JobProfile] Returning profile with details:`, profileWithDetails);
      return profileWithDetails;
    } catch (error) {
      console.error("Error getting job profile with details:", error);
      return void 0;
    }
  }
  async createJobProfile(profile) {
    try {
      const [newProfile] = await db.insert(jobProfiles).values(profile).returning();
      return newProfile;
    } catch (error) {
      console.error("Error creating job profile:", error);
      throw error;
    }
  }
  async updateJobProfile(id, profile) {
    try {
      const [updatedProfile] = await db.update(jobProfiles).set(profile).where(eq(jobProfiles.id, id)).returning();
      return updatedProfile;
    } catch (error) {
      console.error("Error updating job profile:", error);
      return void 0;
    }
  }
  async getUserKpis(userId) {
    try {
      const user = await this.getUser(userId);
      if (!user || !user.areaId || !user.companyId) {
        return [];
      }
      const userKpis = await db.select().from(kpis).where(
        and(eq(kpis.areaId, user.areaId), eq(kpis.companyId, user.companyId))
      );
      return userKpis;
    } catch (error) {
      console.error("Error getting user KPIs:", error);
      return [];
    }
  }
  async getKPIOverview() {
    try {
      const result = await db.select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        areaName: areas.name,
        companyName: companies.name,
        kpiId: kpis.id,
        kpiName: kpis.name,
        kpiTarget: kpis.target,
        kpiFrequency: kpis.frequency,
        kpiValue: kpiValues.value,
        lastUpdate: kpiValues.date
      }).from(users).innerJoin(areas, eq(users.areaId, areas.id)).innerJoin(companies, eq(users.companyId, companies.id)).innerJoin(kpis, and(eq(kpis.areaId, areas.id), eq(kpis.companyId, companies.id))).leftJoin(kpiValues, eq(kpiValues.kpiId, kpis.id)).where(and(isNotNull(users.areaId), isNotNull(users.companyId))).orderBy(desc(kpiValues.date));
      const groupedResults = /* @__PURE__ */ new Map();
      for (const row of result) {
        const key = `${row.userId}-${row.kpiId}`;
        if (!groupedResults.has(key)) {
          let status = "non-compliant";
          if (row.kpiValue && row.kpiTarget) {
            const extractNumericValue2 = (value) => {
              const cleanValue = value.replace(/[^\d.-]/g, "");
              return parseFloat(cleanValue);
            };
            const currentValue = extractNumericValue2(row.kpiValue);
            const targetValue = extractNumericValue2(row.kpiTarget);
            if (!isNaN(currentValue) && !isNaN(targetValue)) {
              const isLowerBetter = this.isLowerBetterKPI(row.kpiName);
              if (isLowerBetter) {
                if (currentValue <= targetValue) {
                  status = "compliant";
                } else if (currentValue <= targetValue * 1.1) {
                  status = "alert";
                } else {
                  status = "non-compliant";
                }
              } else {
                if (currentValue >= targetValue) {
                  status = "compliant";
                } else if (currentValue >= targetValue * 0.9) {
                  status = "alert";
                } else {
                  status = "non-compliant";
                }
              }
            }
          }
          groupedResults.set(key, {
            ...row,
            status,
            trend: "stable"
            // Por ahora, después implementaremos cálculo de tendencia
          });
        }
      }
      return Array.from(groupedResults.values());
    } catch (error) {
      console.error("Error getting KPI overview:", error);
      return [];
    }
  }
  // Función auxiliar para determinar si un KPI es de "menor es mejor"
  isLowerBetterKPI(kpiName) {
    const lowerBetterKPIs = [
      "d\xEDas de cobro",
      "d\xEDas de pago",
      "tiempo de entrega",
      "huella de carbono",
      "costos",
      "gastos",
      "tiempo de respuesta",
      "defectos",
      "errores",
      "quejas",
      "devoluciones",
      "rotaci\xF3n",
      "tiempo de inactividad"
    ];
    const kpiNameLower = kpiName.toLowerCase();
    return lowerBetterKPIs.some((pattern) => kpiNameLower.includes(pattern));
  }
  async getKPIHistory(kpiId, months = 12) {
    try {
      const kpiHistory = await db.select({
        id: kpiValues.id,
        value: kpiValues.value,
        date: kpiValues.date,
        period: kpiValues.period,
        compliancePercentage: kpiValues.compliancePercentage,
        status: kpiValues.status,
        comments: kpiValues.comments,
        updatedBy: kpiValues.updatedBy
      }).from(kpiValues).where(eq(kpiValues.kpiId, kpiId)).orderBy(desc(kpiValues.date)).limit(months);
      console.log(`[getKPIHistory] KPI ${kpiId} history:`, kpiHistory);
      return kpiHistory;
    } catch (error) {
      console.error("Error getting KPI history:", error);
      return [];
    }
  }
  // Shipment Cycle Times operations
  async getShipmentCycleTime(shipmentId) {
    try {
      const [cycleTime] = await db.select().from(shipmentCycleTimes).where(eq(shipmentCycleTimes.shipmentId, shipmentId));
      return cycleTime;
    } catch (error) {
      console.error("Error getting shipment cycle time:", error);
      return void 0;
    }
  }
  async upsertShipmentCycleTime(cycleTime) {
    try {
      const [existingCycleTime] = await db.select().from(shipmentCycleTimes).where(eq(shipmentCycleTimes.shipmentId, cycleTime.shipmentId));
      if (existingCycleTime) {
        const [updatedCycleTime] = await db.update(shipmentCycleTimes).set({
          ...cycleTime,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(shipmentCycleTimes.shipmentId, cycleTime.shipmentId)).returning();
        return updatedCycleTime;
      } else {
        const [newCycleTime] = await db.insert(shipmentCycleTimes).values(cycleTime).returning();
        return newCycleTime;
      }
    } catch (error) {
      console.error("Error upserting shipment cycle time:", error);
      throw error;
    }
  }
  async recalculateShipmentCycleTime(shipmentId) {
    try {
      const shipment = await this.getShipment(shipmentId);
      if (!shipment) {
        return void 0;
      }
      const updates = await this.getShipmentUpdates(shipmentId);
      let pendingAt = null;
      let inTransitAt = null;
      let deliveredAt = null;
      let closedAt = null;
      for (const update of updates.reverse()) {
        switch (update.status) {
          case "pending":
            if (!pendingAt) pendingAt = update.timestamp;
            break;
          case "in_transit":
            if (!inTransitAt) inTransitAt = update.timestamp;
            break;
          case "delivered":
            if (!deliveredAt) deliveredAt = update.timestamp;
            break;
          case "cancelled":
            if (!closedAt) closedAt = update.timestamp;
            break;
        }
      }
      const calculateHours = (start, end) => {
        if (!start || !end) return null;
        const diffMs = end.getTime() - start.getTime();
        return (diffMs / (1e3 * 60 * 60)).toFixed(2);
      };
      const hoursPendingToTransit = calculateHours(pendingAt, inTransitAt);
      const hoursTransitToDelivered = calculateHours(inTransitAt, deliveredAt);
      const hoursDeliveredToClosed = calculateHours(deliveredAt, closedAt);
      const hoursTotalCycle = calculateHours(shipment.createdAt, closedAt);
      const hoursToDelivery = calculateHours(shipment.createdAt, deliveredAt);
      const cycleTimeData = {
        shipmentId: shipment.id,
        companyId: shipment.companyId,
        createdAt: shipment.createdAt,
        pendingAt,
        inTransitAt,
        deliveredAt,
        closedAt,
        hoursPendingToTransit,
        hoursTransitToDelivered,
        hoursDeliveredToClosed,
        hoursTotalCycle,
        hoursToDelivery
      };
      return await this.upsertShipmentCycleTime(cycleTimeData);
    } catch (error) {
      console.error("Error recalculating shipment cycle time:", error);
      return void 0;
    }
  }
  async getAggregateCycleTimes(companyId, startDate, endDate) {
    try {
      let query = db.select({
        hoursPendingToTransit: shipmentCycleTimes.hoursPendingToTransit,
        hoursTransitToDelivered: shipmentCycleTimes.hoursTransitToDelivered,
        hoursDeliveredToClosed: shipmentCycleTimes.hoursDeliveredToClosed,
        hoursTotalCycle: shipmentCycleTimes.hoursTotalCycle,
        hoursToDelivery: shipmentCycleTimes.hoursToDelivery,
        closedAt: shipmentCycleTimes.closedAt,
        createdAt: shipmentCycleTimes.createdAt,
        companyId: shipmentCycleTimes.companyId
      }).from(shipmentCycleTimes);
      const conditions = [];
      if (companyId) {
        conditions.push(eq(shipmentCycleTimes.companyId, companyId));
      }
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        conditions.push(
          sql`${shipmentCycleTimes.createdAt} >= ${start} AND ${shipmentCycleTimes.createdAt} <= ${end}`
        );
      }
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      const cycleTimes = await query;
      if (cycleTimes.length === 0) {
        return [{
          period: "all",
          startDate: startDate || "",
          endDate: endDate || "",
          companyId,
          avgPendingToTransit: null,
          avgTransitToDelivered: null,
          avgDeliveredToClosed: null,
          avgTotalCycle: null,
          avgToDelivery: null,
          totalShipments: 0,
          completedShipments: 0
        }];
      }
      const validPendingToTransit = cycleTimes.filter((ct) => ct.hoursPendingToTransit).map((ct) => parseFloat(ct.hoursPendingToTransit));
      const validTransitToDelivered = cycleTimes.filter((ct) => ct.hoursTransitToDelivered).map((ct) => parseFloat(ct.hoursTransitToDelivered));
      const validDeliveredToClosed = cycleTimes.filter((ct) => ct.hoursDeliveredToClosed).map((ct) => parseFloat(ct.hoursDeliveredToClosed));
      const validTotalCycle = cycleTimes.filter((ct) => ct.hoursTotalCycle).map((ct) => parseFloat(ct.hoursTotalCycle));
      const validToDelivery = cycleTimes.filter((ct) => ct.hoursToDelivery).map((ct) => parseFloat(ct.hoursToDelivery));
      const avg2 = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const completedShipments = cycleTimes.filter((ct) => ct.closedAt).length;
      return [{
        period: "all",
        startDate: startDate || "",
        endDate: endDate || "",
        companyId,
        avgPendingToTransit: avg2(validPendingToTransit),
        avgTransitToDelivered: avg2(validTransitToDelivered),
        avgDeliveredToClosed: avg2(validDeliveredToClosed),
        avgTotalCycle: avg2(validTotalCycle),
        avgToDelivery: avg2(validToDelivery),
        totalShipments: cycleTimes.length,
        completedShipments
      }];
    } catch (error) {
      console.error("Error getting aggregate cycle times:", error);
      return [{
        period: "all",
        startDate: startDate || "",
        endDate: endDate || "",
        companyId,
        avgPendingToTransit: null,
        avgTransitToDelivered: null,
        avgDeliveredToClosed: null,
        avgTotalCycle: null,
        avgToDelivery: null,
        totalShipments: 0,
        completedShipments: 0
      }];
    }
  }
  // Shipment notification operations (required by routes.ts)
  async createShipmentNotification(data) {
    try {
      return await this.createNotification({
        ...data,
        type: "shipment"
      });
    } catch (error) {
      console.error("Error creating shipment notification:", error);
      throw error;
    }
  }
  async updateShipmentNotificationStatus(id, status, error) {
    try {
      const [updated] = await db.update(notifications).set({
        read: status === "sent",
        readAt: status === "sent" ? /* @__PURE__ */ new Date() : null,
        comments: error || null
      }).where(eq(notifications.id, id)).returning();
      return updated;
    } catch (error2) {
      console.error("Error updating shipment notification status:", error2);
      throw error2;
    }
  }
  async getShipmentNotificationsByShipment(shipmentId) {
    try {
      return await db.select().from(notifications).where(sql`${notifications.message} LIKE '%shipment-${shipmentId}%' OR ${notifications.type} = 'shipment'`).orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error getting shipment notifications:", error);
      return [];
    }
  }
  // User Activation Token operations
  async createActivationToken(email2) {
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      const tokenData = {
        token,
        email: email2,
        expiresAt,
        used: false
      };
      const [activationToken] = await db.insert(userActivationTokens).values(tokenData).returning();
      return activationToken;
    } catch (error) {
      console.error("Error creating activation token:", error);
      throw error;
    }
  }
  async getActivationToken(token) {
    try {
      const [activationToken] = await db.select().from(userActivationTokens).where(eq(userActivationTokens.token, token));
      return activationToken;
    } catch (error) {
      console.error("Error getting activation token:", error);
      return void 0;
    }
  }
  async markTokenAsUsed(token) {
    try {
      const result = await db.update(userActivationTokens).set({ used: true }).where(eq(userActivationTokens.token, token));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking token as used:", error);
      return false;
    }
  }
  async deleteExpiredTokens() {
    try {
      await db.delete(userActivationTokens).where(sql`${userActivationTokens.expiresAt} < NOW()`);
    } catch (error) {
      console.error("Error deleting expired tokens:", error);
    }
  }
};
var storage = new DatabaseStorage();

// server/storage.ts
var storage2 = new DatabaseStorage();

// server/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
var JWT_SECRET = process.env.JWT_SECRET || "econova-kpi-jwt-secret-key";
var JWT_EXPIRES_IN = "7d";
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error("[JWT] Error al verificar token:", error);
    return null;
  }
}
function jwtAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  console.log("[JWT Auth] Checking token:", !!token);
  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
      details: "No authentication token provided"
    });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      message: "Unauthorized",
      details: "Invalid or expired token"
    });
  }
  req.user = payload;
  console.log(`[JWT Auth] Authenticated user: ID=${payload.id}, Role=${payload.role}`);
  next();
}
async function comparePasswords(supplied, stored) {
  try {
    if (stored.startsWith("$2b$")) {
      return await bcrypt.compare(supplied, stored);
    }
    return supplied === stored;
  } catch (error) {
    console.error("[Auth] Error comparando contrase\xF1as:", error);
    return false;
  }
}
async function loginUser(username, password) {
  try {
    const user = await storage2.getUserByUsername(username);
    if (!user) {
      console.log(`[Auth] Usuario no encontrado: ${username}`);
      return null;
    }
    const passwordMatches = await comparePasswords(password, user.password);
    if (!passwordMatches) {
      console.log(`[Auth] Contrase\xF1a incorrecta para usuario: ${username}`);
      return null;
    }
    await storage2.updateUser(user.id, { lastLogin: /* @__PURE__ */ new Date() });
    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId
    });
    console.log(`[Auth] Login exitoso para usuario: ${username}`);
    const { password: _, ...userWithoutPassword } = user;
    return {
      token,
      user: userWithoutPassword
    };
  } catch (error) {
    console.error("[Auth] Error en login:", error);
    return null;
  }
}

// server/routes.ts
init_schema();

// scripts/weekly_sales_update.ts
function detectCurrentPeriod() {
  const today = /* @__PURE__ */ new Date();
  const dayOfMonth = today.getDate();
  const weekNumber = Math.ceil(dayOfMonth / 7);
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  const weekText = `Semana ${weekNumber}`;
  const period = `${weekText} - ${month} ${year}`;
  return { weekNumber, weekText, month, year, period };
}
async function updateWeeklySales(salesData) {
  try {
    if (!salesData || !salesData.value || !salesData.companyId) {
      throw new Error("Faltan datos obligatorios: value y companyId son requeridos");
    }
    console.log("[UpdateWeeklySales] Iniciando actualizaci\xF3n con datos:", salesData);
    let currentPeriod;
    if (salesData.adminOverride && salesData.weekNumber && salesData.month && salesData.year) {
      const weekNumber = parseInt(salesData.weekNumber.replace("Semana ", ""));
      currentPeriod = {
        weekNumber,
        weekText: salesData.weekNumber,
        month: salesData.month,
        year: salesData.year,
        period: `${salesData.weekNumber} - ${salesData.month} ${salesData.year}`
      };
      console.log("[UpdateWeeklySales] Modo ADMINISTRADOR - Per\xEDodo manual:", currentPeriod);
    } else {
      currentPeriod = detectCurrentPeriod();
      console.log("[UpdateWeeklySales] Modo NORMAL - Per\xEDodo autom\xE1tico:", currentPeriod);
    }
    const allKpis = await storage2.getKpis();
    const selectedCompanyId = salesData.companyId;
    const volumeKpi = allKpis.find(
      (kpi) => kpi.name.includes("Volumen de ventas") && kpi.companyId === selectedCompanyId
    );
    if (!volumeKpi) {
      throw new Error(`No se encontr\xF3 el KPI de volumen de ventas para la compa\xF1\xEDa ID: ${selectedCompanyId}`);
    }
    console.log(`[UpdateWeeklySales] Encontrado KPI: ${volumeKpi.name} (ID: ${volumeKpi.id})`);
    const existingWeeklyRecords = await storage2.getKpiValuesByKpi(volumeKpi.id);
    const existingThisWeek = existingWeeklyRecords.find(
      (record) => record.period === currentPeriod.period
    );
    const isUpdate = !!existingThisWeek;
    console.log(`[UpdateWeeklySales] ${isUpdate ? "Actualizando" : "Creando"} registro para: ${currentPeriod.period}`);
    const annualTarget = parseFloat(volumeKpi.target.replace(/[^0-9.,]/g, "").replace(",", ""));
    const monthlyTarget = Math.round(annualTarget / 12);
    const weeklyTarget = Math.round(monthlyTarget / 4);
    console.log(`[UpdateWeeklySales] Objetivos - Anual: ${annualTarget}, Mensual: ${monthlyTarget}, Semanal: ${weeklyTarget}`);
    const formattedValue = new Intl.NumberFormat("es-MX").format(salesData.value);
    const valueUnit = selectedCompanyId === 1 ? "KG" : "unidades";
    const fullFormattedValue = `${formattedValue} ${valueUnit}`;
    const weeklyCompliance = salesData.value / weeklyTarget * 100;
    const weeklyStatus = weeklyCompliance >= 95 ? "complies" : weeklyCompliance >= 85 ? "alert" : "not_compliant";
    const weeklyKpiValue = {
      kpiId: volumeKpi.id,
      userId: salesData.userId || 1,
      // Usuario que actualiza (Omar)
      value: fullFormattedValue,
      period: currentPeriod.period,
      compliancePercentage: `${weeklyCompliance.toFixed(1)}%`,
      status: weeklyStatus,
      comments: `${isUpdate ? "Actualizaci\xF3n" : "Registro"} semanal autom\xE1tico`,
      updatedBy: salesData.userId || 1
    };
    console.log(`[UpdateWeeklySales] Creando nuevo registro semanal`);
    const savedWeeklySales = await storage2.createKpiValue(weeklyKpiValue);
    const updatedKpiValues = await storage2.getKpiValuesByKpi(volumeKpi.id);
    const currentMonthWeeklySales = updatedKpiValues.filter(
      (value) => value.period.includes(currentPeriod.month) && value.period.includes(currentPeriod.year.toString()) && value.period.includes("Semana")
    );
    let monthlyTotal = 0;
    currentMonthWeeklySales.forEach((sale) => {
      const numericValue = parseFloat(sale.value.replace(/[^0-9.,]+/g, "").replace(",", "."));
      if (!isNaN(numericValue)) {
        monthlyTotal += numericValue;
      }
    });
    const formattedMonthlyTotal = new Intl.NumberFormat("es-MX").format(monthlyTotal);
    console.log(`[UpdateWeeklySales] Total mensual recalculado: ${formattedMonthlyTotal} ${valueUnit} (${currentMonthWeeklySales.length} semanas)`);
    const monthlyCompliancePercentage = monthlyTotal / monthlyTarget * 100;
    const monthlyStatus = monthlyCompliancePercentage >= 95 ? "complies" : monthlyCompliancePercentage >= 85 ? "alert" : "not_compliant";
    const monthlyComment = `Total mensual: ${formattedMonthlyTotal} ${valueUnit} de ${currentMonthWeeklySales.length} semanas (${monthlyCompliancePercentage.toFixed(1)}% del objetivo)`;
    console.log(`[UpdateWeeklySales] M\xE9tricas mensuales - Compliance: ${monthlyCompliancePercentage.toFixed(1)}%, Status: ${monthlyStatus}`);
    console.log(`[UpdateWeeklySales] \u2705 Proceso completado exitosamente`);
    return {
      success: true,
      message: `${isUpdate ? "Actualizaci\xF3n" : "Registro"} semanal completado exitosamente`,
      weeklyRecord: savedWeeklySales,
      currentPeriod,
      monthlyPreview: {
        totalValue: monthlyTotal,
        formattedValue: `${formattedMonthlyTotal} ${valueUnit}`,
        compliancePercentage: `${monthlyCompliancePercentage.toFixed(1)}%`,
        status: monthlyStatus,
        weekCount: currentMonthWeeklySales.length,
        comment: monthlyComment
      }
    };
  } catch (error) {
    console.error("[UpdateWeeklySales] \u274C Error al procesar actualizaci\xF3n:", error);
    return {
      success: false,
      message: error?.message || "Error desconocido al actualizar ventas semanales"
    };
  }
}
async function autoCloseMonth(companyId, month, year) {
  try {
    const currentDate = /* @__PURE__ */ new Date();
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre"
    ];
    const targetMonth = month || (currentDate.getMonth() === 0 ? "Diciembre" : monthNames[currentDate.getMonth() - 1]);
    const targetYear = year || (currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear());
    console.log(`[AutoCloseMonth] Cerrando mes ${targetMonth} ${targetYear} para empresa ${companyId}`);
    const allKpis = await storage2.getKpis();
    const volumeKpi = allKpis.find(
      (kpi) => kpi.name.includes("Volumen de ventas") && kpi.companyId === companyId
    );
    if (!volumeKpi) {
      console.error(`[AutoCloseMonth] No se encontr\xF3 KPI de volumen de ventas para empresa ${companyId}`);
      return false;
    }
    const kpiValues2 = await storage2.getKpiValuesByKpi(volumeKpi.id);
    const weeklyRecords = kpiValues2.filter(
      (value) => value.period.includes(targetMonth) && value.period.includes(targetYear.toString()) && value.period.includes("Semana")
    );
    if (weeklyRecords.length === 0) {
      console.log(`[AutoCloseMonth] No hay registros semanales para ${targetMonth} ${targetYear}`);
      return false;
    }
    let monthlyTotal = 0;
    weeklyRecords.forEach((record) => {
      const numericValue = parseFloat(record.value.replace(/[^0-9.,]+/g, "").replace(",", "."));
      if (!isNaN(numericValue)) {
        monthlyTotal += numericValue;
      }
    });
    const annualTarget = parseFloat(volumeKpi.target.replace(/[^0-9.,]+/g, "").replace(",", ""));
    const monthlyTarget = Math.round(annualTarget / 12);
    const compliancePercentage = monthlyTotal / monthlyTarget * 100;
    const status = compliancePercentage >= 95 ? "complies" : compliancePercentage >= 85 ? "alert" : "not_compliant";
    const valueUnit = companyId === 1 ? "KG" : "unidades";
    const formattedTotal = new Intl.NumberFormat("es-MX").format(monthlyTotal);
    const monthlyRecord = {
      kpiId: volumeKpi.id,
      userId: weeklyRecords[weeklyRecords.length - 1]?.userId || 1,
      value: `${formattedTotal} ${valueUnit}`,
      period: `${targetMonth} ${targetYear}`,
      compliancePercentage: `${compliancePercentage.toFixed(1)}%`,
      status,
      comments: `Cierre autom\xE1tico mensual - suma de ${weeklyRecords.length} semanas`,
      updatedBy: null
      // Sistema
    };
    await storage2.createKpiValue(monthlyRecord);
    console.log(`[AutoCloseMonth] \u2705 Mes ${targetMonth} ${targetYear} cerrado - Total: ${formattedTotal} ${valueUnit}`);
    return true;
  } catch (error) {
    console.error(`[AutoCloseMonth] \u274C Error al cerrar mes:`, error);
    return false;
  }
}

// server/email.ts
import sgMail from "@sendgrid/mail";
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
async function sendEmail(params) {
  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html
    });
    console.log(`[Email] Correo enviado exitosamente a ${params.to}`);
    return true;
  } catch (error) {
    console.error("[Email] Error al enviar correo:", error);
    return false;
  }
}
function createTeamMessageTemplate(senderName, recipientName, title, message, type, priority) {
  const priorityColor = priority === "urgent" ? "#ef4444" : priority === "high" ? "#f59e0b" : priority === "normal" ? "#3b82f6" : "#6b7280";
  const typeIcon = type === "success" ? "\u2705" : type === "warning" ? "\u26A0\uFE0F" : type === "error" ? "\u274C" : "\u2139\uFE0F";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mensaje del Equipo - Econova</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #273949;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #273949;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #64748b;
          font-size: 14px;
        }
        .message-header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f1f5f9;
          border-radius: 8px;
          border-left: 4px solid ${priorityColor};
        }
        .message-icon {
          font-size: 24px;
          margin-right: 15px;
        }
        .message-info {
          flex: 1;
        }
        .message-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 5px;
        }
        .message-meta {
          font-size: 14px;
          color: #64748b;
        }
        .message-content {
          background: #fefefe;
          padding: 25px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin: 20px 0;
          font-size: 16px;
          line-height: 1.7;
        }
        .sender-info {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }
        .sender-name {
          font-weight: 600;
          color: #273949;
          margin-bottom: 5px;
        }
        .company-info {
          color: #64748b;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
        .priority-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          background: ${priorityColor};
          color: white;
          margin-left: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">ECONOVA</div>
          <div class="subtitle">Sistema de Gesti\xF3n de KPIs</div>
        </div>
        
        <div class="message-header">
          <div class="message-icon">${typeIcon}</div>
          <div class="message-info">
            <div class="message-title">
              ${title}
              <span class="priority-badge">${priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : priority === "normal" ? "Normal" : "Baja"}</span>
            </div>
            <div class="message-meta">Mensaje del equipo para ${recipientName}</div>
          </div>
        </div>
        
        <div class="message-content">
          ${message.replace(/\n/g, "<br>")}
        </div>
        
        <div class="sender-info">
          <div class="sender-name">Enviado por: Mario Reynoso (Gerente General)</div>
          <div class="company-info">Econova - Dura International & Grupo Orsega</div>
        </div>
        
        <div class="footer">
          <p>Este mensaje fue enviado desde el sistema de gesti\xF3n de KPIs de Econova.</p>
          <p>Para responder, inicia sesi\xF3n en el sistema o contacta directamente al remitente.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text2 = `
ECONOVA - Sistema de Gesti\xF3n de KPIs

${typeIcon} ${title}
Prioridad: ${priority === "urgent" ? "Urgente" : priority === "high" ? "Alta" : priority === "normal" ? "Normal" : "Baja"}

Para: ${recipientName}
De: Mario Reynoso (Gerente General)

Mensaje:
${message}

---
Este mensaje fue enviado desde el sistema de gesti\xF3n de KPIs de Econova.
Para responder, inicia sesi\xF3n en el sistema o contacta directamente al remitente.
  `.trim();
  return { html, text: text2 };
}

// server/sendgrid.ts
import { MailService } from "@sendgrid/mail";
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}
var mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);
async function sendEmail2(params) {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html
    });
    return true;
  } catch (error) {
    console.error("SendGrid email error:", error);
    return false;
  }
}
function getShipmentStatusEmailTemplate(shipment, newStatus, customerName) {
  const statusMap = {
    pending: { label: "Prepar\xE1ndose para env\xEDo", color: "#3B82F6" },
    in_transit: { label: "En tr\xE1nsito", color: "#F59E0B" },
    delayed: { label: "Retrasado", color: "#EF4444" },
    delivered: { label: "Entregado", color: "#10B981" },
    cancelled: { label: "Cancelado", color: "#6B7280" }
  };
  const status = statusMap[newStatus] || { label: newStatus, color: "#6B7280" };
  const trackingCode = shipment.trackingCode;
  const product = shipment.product;
  const estimatedDate = shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString("es-MX") : "Por confirmar";
  const subject = `Actualizaci\xF3n de env\xEDo ${trackingCode} - ${status.label}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #273949; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .status-badge { 
          display: inline-block; 
          padding: 8px 16px; 
          border-radius: 4px; 
          color: white; 
          font-weight: bold;
          background: ${status.color};
        }
        .details { background: white; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Econova - Actualizaci\xF3n de Env\xEDo</h1>
        </div>
        <div class="content">
          <p>Estimado/a <strong>${customerName}</strong>,</p>
          
          <p>Su env\xEDo ha sido actualizado:</p>
          
          <div class="details">
            <h3>Detalles del Env\xEDo</h3>
            <p><strong>C\xF3digo de seguimiento:</strong> ${trackingCode}</p>
            <p><strong>Producto:</strong> ${product}</p>
            <p><strong>Estado actual:</strong> <span class="status-badge">${status.label}</span></p>
            <p><strong>Fecha estimada de entrega:</strong> ${estimatedDate}</p>
          </div>
          
          ${newStatus === "delivered" ? `
            <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>\xA1Su env\xEDo ha sido entregado exitosamente!</strong></p>
              <p>Gracias por confiar en nosotros para sus necesidades log\xEDsticas.</p>
            </div>
          ` : ""}
          
          ${newStatus === "delayed" ? `
            <div style="background: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>Notificaci\xF3n de retraso</strong></p>
              <p>Lamentamos informarle que su env\xEDo presenta un retraso. Nuestro equipo est\xE1 trabajando para minimizar el impacto y le mantendremos informado.</p>
            </div>
          ` : ""}
          
          <p>Si tiene alguna pregunta o necesita m\xE1s informaci\xF3n, no dude en contactarnos.</p>
        </div>
        <div class="footer">
          <p>Este mensaje fue enviado por <strong>Thalia Rodriguez</strong> - Departamento de Log\xEDstica<br>
          Econova | Dura International & Grupo Orsega<br>
          Email: marioreynoso@grupoorsega.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
  const text2 = `
Estimado/a ${customerName},

Su env\xEDo ha sido actualizado:

C\xF3digo de seguimiento: ${trackingCode}
Producto: ${product}
Estado actual: ${status.label}
Fecha estimada de entrega: ${estimatedDate}

${newStatus === "delivered" ? "\xA1Su env\xEDo ha sido entregado exitosamente! Gracias por confiar en nosotros." : ""}
${newStatus === "delayed" ? "Lamentamos informarle que su env\xEDo presenta un retraso. Nuestro equipo est\xE1 trabajando para minimizar el impacto." : ""}

Si tiene alguna pregunta, no dude en contactarnos.

Saludos,
Thalia Rodriguez - Departamento de Log\xEDstica
Econova | Dura International & Grupo Orsega
  `;
  return { subject, html, text: text2 };
}

// server/routes-catalog.ts
import { Router } from "express";
import { randomUUID } from "node:crypto";

// server/db-logistics.ts
import { Pool as Pool2 } from "pg";
var connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no est\xE1 definida");
var dbUrl = connectionString.includes("sslmode=") ? connectionString : connectionString + (connectionString.includes("?") ? "&" : "?") + "sslmode=require";
var pool2 = new Pool2({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 1e4,
  max: 8
});
async function sql2(q, params) {
  const c = await pool2.connect();
  try {
    return await c.query(q, params);
  } finally {
    c.release();
  }
}

// shared/logistics-schema.ts
import { z as z2 } from "zod";
var uuidSchema = () => z2.string().uuid();
var email = z2.string().email().optional().or(z2.literal("").transform(() => void 0));
var shipmentStatus = z2.enum(["pendiente", "asignando_transporte", "confirmado", "en_camino", "retenido", "entregado", "cerrado"]);
var eventType = z2.enum(["pickup", "customs", "delay", "delivery", "note"]);
var clientSchema = z2.object({
  id: uuidSchema(),
  name: z2.string().min(2),
  rfc: z2.string().optional(),
  email,
  phone: z2.string().optional(),
  billingAddr: z2.string().optional(),
  shippingAddr: z2.string().optional(),
  isActive: z2.boolean().default(true)
});
var createClientSchema = clientSchema.omit({ id: true });
var updateClientSchema = clientSchema.partial().extend({ id: uuidSchema() });
var providerSchema = z2.object({
  id: uuidSchema(),
  name: z2.string().min(2),
  email,
  phone: z2.string().optional(),
  contactName: z2.string().optional(),
  notes: z2.string().optional(),
  rating: z2.number().min(0).max(5).optional(),
  isActive: z2.boolean().default(true)
});
var createProviderSchema = providerSchema.omit({ id: true });
var updateProviderSchema = providerSchema.partial().extend({ id: uuidSchema() });
var providerChannelSchema = z2.object({
  id: uuidSchema(),
  providerId: uuidSchema(),
  type: z2.enum(["email", "api", "portal"]),
  value: z2.string().min(3),
  isDefault: z2.boolean().default(false)
});
var createProviderChannelSchema = providerChannelSchema.omit({ id: true });
var shipmentSchema = z2.object({
  id: uuidSchema(),
  reference: z2.string().min(2),
  clientId: uuidSchema(),
  providerId: uuidSchema().optional(),
  origin: z2.string().min(2),
  destination: z2.string().min(2),
  incoterm: z2.string().optional(),
  status: shipmentStatus.default("pendiente"),
  etd: z2.string().datetime().optional(),
  eta: z2.string().datetime().optional()
});
var createShipmentSchema = shipmentSchema.omit({ id: true, status: true }).extend({ notifyClient: z2.boolean().default(false), customerEmail: email });
var updateShipmentSchema = shipmentSchema.partial().extend({ id: uuidSchema() });
var shipmentEventSchema = z2.object({
  id: uuidSchema(),
  shipmentId: uuidSchema(),
  type: eventType,
  at: z2.string().datetime(),
  lat: z2.number().optional(),
  lng: z2.number().optional(),
  notes: z2.string().optional()
});
var createShipmentEventSchema = shipmentEventSchema.omit({ id: true });
var shipmentDocSchema = z2.object({
  id: uuidSchema(),
  shipmentId: uuidSchema(),
  kind: z2.enum(["bl", "factura", "foto", "otro"]),
  fileUrl: z2.string().url(),
  uploadedAt: z2.string().datetime().optional(),
  uploadedBy: z2.string().optional()
});
var createShipmentDocSchema = shipmentDocSchema.omit({ id: true });

// server/routes-catalog.ts
var catalogRouter = Router();
catalogRouter.get("/clients", async (req, res) => {
  try {
    const result = await sql2(`
      SELECT id, name, rfc, email, phone, billing_addr, shipping_addr, is_active, created_at, updated_at 
      FROM client 
      WHERE is_active = TRUE 
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});
catalogRouter.post("/clients", async (req, res) => {
  try {
    const validated = createClientSchema.parse(req.body);
    const id = randomUUID();
    const result = await sql2(`
      INSERT INTO client (id, name, rfc, email, phone, billing_addr, shipping_addr, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.name, validated.rfc, validated.email, validated.phone, validated.billingAddr, validated.shippingAddr, validated.isActive]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(400).json({ error: "Failed to create client" });
  }
});
catalogRouter.patch("/clients/:id", async (req, res) => {
  try {
    const validated = updateClientSchema.parse({ ...req.body, id: req.params.id });
    const fields = [];
    const values = [];
    let index = 1;
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== "id" && value !== void 0) {
        const dbField = key === "billingAddr" ? "billing_addr" : key === "shippingAddr" ? "shipping_addr" : key === "isActive" ? "is_active" : key;
        fields.push(`${dbField} = $${index}`);
        values.push(value);
        index++;
      }
    });
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    values.push(req.params.id);
    const result = await sql2(`
      UPDATE client SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(400).json({ error: "Failed to update client" });
  }
});
catalogRouter.get("/providers", async (req, res) => {
  try {
    const result = await sql2(`
      SELECT p.*, 
        array_agg(
          json_build_object(
            'id', pc.id,
            'type', pc.type,
            'value', pc.value,
            'isDefault', pc.is_default
          )
        ) FILTER (WHERE pc.id IS NOT NULL) as channels
      FROM provider p
      LEFT JOIN provider_channel pc ON p.id = pc.provider_id
      WHERE p.is_active = TRUE
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});
catalogRouter.post("/providers", async (req, res) => {
  try {
    const validated = createProviderSchema.parse(req.body);
    const id = randomUUID();
    const result = await sql2(`
      INSERT INTO provider (id, name, email, phone, contact_name, notes, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.name, validated.email, validated.phone, validated.contactName, validated.notes, validated.rating, validated.isActive]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating provider:", error);
    res.status(400).json({ error: "Failed to create provider" });
  }
});
catalogRouter.patch("/providers/:id", async (req, res) => {
  try {
    const validated = updateProviderSchema.parse({ ...req.body, id: req.params.id });
    const fields = [];
    const values = [];
    let index = 1;
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== "id" && value !== void 0) {
        const dbField = key === "contactName" ? "contact_name" : key === "isActive" ? "is_active" : key;
        fields.push(`${dbField} = $${index}`);
        values.push(value);
        index++;
      }
    });
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    values.push(req.params.id);
    const result = await sql2(`
      UPDATE provider SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating provider:", error);
    res.status(400).json({ error: "Failed to update provider" });
  }
});
catalogRouter.post("/providers/:id/channels", async (req, res) => {
  try {
    const validated = createProviderChannelSchema.parse({ ...req.body, providerId: req.params.id });
    const id = randomUUID();
    const result = await sql2(`
      INSERT INTO provider_channel (id, provider_id, type, value, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, validated.providerId, validated.type, validated.value, validated.isDefault]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating provider channel:", error);
    res.status(400).json({ error: "Failed to create provider channel" });
  }
});

// server/routes-logistics.ts
import { Router as Router2 } from "express";
import { randomUUID as randomUUID2 } from "node:crypto";

// server/email-logistics.ts
import sgMail2 from "@sendgrid/mail";
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not found - email functionality disabled");
} else {
  sgMail2.setApiKey(process.env.SENDGRID_API_KEY);
}
async function sendTransportRequest(data) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log("Email would be sent:", data);
    return;
  }
  const baseUrl = process.env.NODE_ENV === "production" ? "https://your-domain.replit.app" : "http://localhost:5000";
  const confirmUrl = `${baseUrl}/api/shipments/${data.shipment.id}/confirm?token=${data.confirmToken}&pickupAt=${encodeURIComponent(data.pickupWindow || "")}`;
  const rejectUrl = `${baseUrl}/api/shipments/${data.shipment.id}/reject?token=${data.rejectToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Solicitud de Transporte</h1>
        <p style="margin: 5px 0 0 0;">Sistema Log\xEDstico DIGO</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <p>Estimado proveedor,</p>
        
        <p>Tenemos una nueva solicitud de transporte que requiere su atenci\xF3n:</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin-top: 0;">Detalles del Env\xEDo</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Referencia:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.reference}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Cliente:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.client_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Origen:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.origin}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Destino:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.destination}</td>
            </tr>
            ${data.shipment.incoterm ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Incoterm:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.incoterm}</td>
            </tr>` : ""}
            ${data.pickupWindow ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Ventana de Recolecci\xF3n:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.pickupWindow}</td>
            </tr>` : ""}
          </table>
          
          ${data.notes ? `
          <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
            <strong>Notas adicionales:</strong><br>
            ${data.notes}
          </div>` : ""}
        </div>
        
        <p><strong>\xBFPuede realizar este transporte?</strong></p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" 
             style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: bold;">
            \u2705 CONFIRMAR TRANSPORTE
          </a>
          
          <a href="${rejectUrl}" 
             style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: bold;">
            \u274C RECHAZAR
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>Este correo fue enviado autom\xE1ticamente por el Sistema Log\xEDstico DIGO.</p>
          <p>Si tiene preguntas, responda directamente a este correo.</p>
        </div>
      </div>
    </div>
  `;
  const msg = {
    to: data.to,
    from: "logistics@digo.mx",
    // Verified sender
    subject: `Solicitud de Transporte - ${data.shipment.reference}`,
    html
  };
  await sgMail2.send(msg);
  console.log(`Transport request email sent to: ${data.to}`);
}

// server/routes-logistics.ts
var logisticsRouter = Router2();
logisticsRouter.get("/shipments", async (req, res) => {
  try {
    const { status, q, clientId, providerId, page = "1", limit = "20" } = req.query;
    let whereClause = "1=1";
    const params = [];
    let paramIndex = 1;
    if (status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (clientId) {
      whereClause += ` AND s.client_id = $${paramIndex}`;
      params.push(clientId);
      paramIndex++;
    }
    if (providerId) {
      whereClause += ` AND s.provider_id = $${paramIndex}`;
      params.push(providerId);
      paramIndex++;
    }
    if (q) {
      whereClause += ` AND (s.reference ILIKE $${paramIndex} OR s.origin ILIKE $${paramIndex} OR s.destination ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    const result = await sql2(`
      SELECT s.*,
        c.name as client_name,
        c.email as client_email,
        p.name as provider_name,
        p.email as provider_email
      FROM shipment s
      LEFT JOIN client c ON s.client_id = c.id
      LEFT JOIN provider p ON s.provider_id = p.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching shipments:", error);
    res.status(500).json({ error: "Failed to fetch shipments" });
  }
});
logisticsRouter.get("/shipments/:id", async (req, res) => {
  try {
    const result = await sql2(`
      SELECT s.*,
        c.name as client_name, c.email as client_email,
        p.name as provider_name, p.email as provider_email
      FROM shipment s
      LEFT JOIN client c ON s.client_id = c.id
      LEFT JOIN provider p ON s.provider_id = p.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    const events = await sql2(`
      SELECT * FROM shipment_event 
      WHERE shipment_id = $1 
      ORDER BY at DESC
    `, [req.params.id]);
    const docs = await sql2(`
      SELECT * FROM shipment_doc 
      WHERE shipment_id = $1 
      ORDER BY uploaded_at DESC
    `, [req.params.id]);
    const shipment = result.rows[0];
    shipment.events = events.rows;
    shipment.documents = docs.rows;
    res.json(shipment);
  } catch (error) {
    console.error("Error fetching shipment:", error);
    res.status(500).json({ error: "Failed to fetch shipment" });
  }
});
logisticsRouter.post("/shipments", async (req, res) => {
  try {
    const validated = createShipmentSchema.parse(req.body);
    const id = randomUUID2();
    const result = await sql2(`
      INSERT INTO shipment (id, reference, client_id, provider_id, origin, destination, incoterm, etd, eta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, validated.reference, validated.clientId, validated.providerId, validated.origin, validated.destination, validated.incoterm, validated.etd, validated.eta]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating shipment:", error);
    res.status(400).json({ error: "Failed to create shipment" });
  }
});
logisticsRouter.patch("/shipments/:id", async (req, res) => {
  try {
    const validated = updateShipmentSchema.parse({ ...req.body, id: req.params.id });
    const fields = [];
    const values = [];
    let index = 1;
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== "id" && value !== void 0) {
        const dbField = key === "clientId" ? "client_id" : key === "providerId" ? "provider_id" : key;
        fields.push(`${dbField} = $${index}`);
        values.push(value);
        index++;
      }
    });
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    values.push(req.params.id);
    const result = await sql2(`
      UPDATE shipment SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating shipment:", error);
    res.status(400).json({ error: "Failed to update shipment" });
  }
});
logisticsRouter.post("/shipments/:id/events", async (req, res) => {
  try {
    const validated = createShipmentEventSchema.parse({ ...req.body, shipmentId: req.params.id });
    const id = randomUUID2();
    const result = await sql2(`
      INSERT INTO shipment_event (id, shipment_id, type, at, lat, lng, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.shipmentId, validated.type, validated.at, validated.lat, validated.lng, validated.notes, "system"]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating shipment event:", error);
    res.status(400).json({ error: "Failed to create shipment event" });
  }
});
logisticsRouter.post("/shipments/:id/docs", async (req, res) => {
  try {
    const validated = createShipmentDocSchema.parse({ ...req.body, shipmentId: req.params.id });
    const id = randomUUID2();
    const result = await sql2(`
      INSERT INTO shipment_doc (id, shipment_id, kind, file_url, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, validated.shipmentId, validated.kind, validated.fileUrl, validated.uploadedBy]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating shipment document:", error);
    res.status(400).json({ error: "Failed to create shipment document" });
  }
});
logisticsRouter.post("/shipments/:id/request-transport", async (req, res) => {
  try {
    const { providerId, pickupWindow, notes } = req.body;
    const shipmentId = req.params.id;
    await sql2(`
      UPDATE shipment 
      SET status = 'asignando_transporte', provider_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [providerId, shipmentId]);
    const shipmentResult = await sql2(`
      SELECT s.*, c.name as client_name, p.name as provider_name, p.email as provider_email
      FROM shipment s
      JOIN client c ON s.client_id = c.id
      JOIN provider p ON s.provider_id = p.id
      WHERE s.id = $1
    `, [shipmentId]);
    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    const shipment = shipmentResult.rows[0];
    const confirmToken = randomUUID2();
    const rejectToken = randomUUID2();
    try {
      await sendTransportRequest({
        to: shipment.provider_email,
        shipment,
        confirmToken,
        rejectToken,
        pickupWindow,
        notes
      });
      await sql2(`
        INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
        VALUES ($1, $2, 'note', NOW(), $3, 'system')
      `, [randomUUID2(), shipmentId, `Solicitud de transporte enviada a ${shipment.provider_name}`]);
      res.json({ success: true, message: "Transport request sent successfully" });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      res.status(500).json({ error: "Failed to send transport request" });
    }
  } catch (error) {
    console.error("Error requesting transport:", error);
    res.status(500).json({ error: "Failed to request transport" });
  }
});
logisticsRouter.post("/shipments/:id/confirm", async (req, res) => {
  try {
    const { token, pickupAt } = req.query;
    const shipmentId = req.params.id;
    if (!token) {
      return res.status(400).json({ error: "Invalid token" });
    }
    await sql2(`
      UPDATE shipment 
      SET status = 'confirmado', updated_at = NOW()
      WHERE id = $1
    `, [shipmentId]);
    await sql2(`
      INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
      VALUES ($1, $2, 'pickup', $3, 'Transporte confirmado por proveedor', 'provider')
    `, [randomUUID2(), shipmentId, pickupAt || (/* @__PURE__ */ new Date()).toISOString()]);
    res.json({ success: true, message: "Transport confirmed successfully" });
  } catch (error) {
    console.error("Error confirming transport:", error);
    res.status(500).json({ error: "Failed to confirm transport" });
  }
});
logisticsRouter.post("/shipments/:id/reject", async (req, res) => {
  try {
    const { token, reason } = req.query;
    const shipmentId = req.params.id;
    if (!token) {
      return res.status(400).json({ error: "Invalid token" });
    }
    await sql2(`
      UPDATE shipment 
      SET status = 'pendiente', provider_id = NULL, updated_at = NOW()
      WHERE id = $1
    `, [shipmentId]);
    await sql2(`
      INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
      VALUES ($1, $2, 'note', NOW(), $3, 'provider')
    `, [randomUUID2(), shipmentId, `Transporte rechazado: ${reason || "Sin raz\xF3n especificada"}`]);
    res.json({ success: true, message: "Transport rejected" });
  } catch (error) {
    console.error("Error rejecting transport:", error);
    res.status(500).json({ error: "Failed to reject transport" });
  }
});

// server/routes.ts
import path from "path";
import fs from "fs";
import { neon } from "@neondatabase/serverless";
function getAuthUser(req) {
  if (!req.user) {
    throw new Error("Unauthorized");
  }
  return req.user;
}
var sql3 = neon(process.env.DATABASE_URL);
function sanitizeUser(user) {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser;
}
function sanitizeUsers(users3) {
  return users3.map(sanitizeUser);
}
function redactSensitiveData(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sensitive = ["password", "token", "authorization", "apiKey", "secret", "jwt"];
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
function extractNumericValue(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
}
function isLowerBetterKPI(kpiName) {
  const lowerBetterPatterns = [
    "rotaci\xF3n de cuentas por cobrar",
    "velocidad de rotaci\xF3n",
    "tiempo de",
    "d\xEDas de",
    "plazo de",
    "demora"
  ];
  const lowerKpiName = kpiName.toLowerCase();
  return lowerBetterPatterns.some(
    (pattern) => lowerKpiName.includes(pattern) && !lowerKpiName.includes("entrega")
  );
}
async function createKPIStatusChangeNotification(kpi, user, previousStatus, newStatus, storage3) {
  try {
    const criticalChanges = [
      { from: "complies", to: "not_compliant" },
      { from: "alert", to: "not_compliant" },
      { from: "not_compliant", to: "complies" }
    ];
    const isCriticalChange = criticalChanges.some(
      (change) => change.from === previousStatus && change.to === newStatus
    );
    if (isCriticalChange) {
      const statusMap = {
        "complies": "En cumplimiento",
        "alert": "En alerta",
        "not_compliant": "No cumple"
      };
      const notification = {
        userId: user.id,
        title: `Cambio de estado en KPI: ${kpi.name}`,
        message: `El KPI "${kpi.name}" ha cambiado de "${statusMap[previousStatus]}" a "${statusMap[newStatus]}"`,
        type: newStatus === "complies" ? "success" : "warning",
        isRead: false
      };
      await storage3.createNotification(notification);
      console.log(`[KPI Notification] Notificaci\xF3n creada para cambio de estado: ${kpi.name}`);
    }
  } catch (error) {
    console.error("Error creating KPI status change notification:", error);
  }
}
function registerRoutes(app2) {
  const server = app2.listen;
  app2.get("/health", (req, res) => {
    const nodeEnv = process.env.NODE_ENV || "undefined";
    const expressEnv = app2.get("env");
    const health = {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: {
        NODE_ENV: nodeEnv,
        express_env: expressEnv,
        is_production: expressEnv === "production"
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: 5e3
      }
    };
    res.json(health);
  });
  app2.get("/env-check", (req, res) => {
    const nodeEnv = process.env.NODE_ENV || "undefined";
    const expressEnv = app2.get("env");
    const paths = {
      cwd: process.cwd(),
      script_dir: import.meta.dirname,
      dist_index: path.resolve(import.meta.dirname, "index.js"),
      dist_public: path.resolve(import.meta.dirname, "public"),
      dist_public_index: path.resolve(import.meta.dirname, "public", "index.html")
    };
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
    }
    const envVars = [
      "DATABASE_URL",
      "JWT_SECRET",
      "SENDGRID_API_KEY",
      "REPL_ID",
      "REPL_SLUG"
    ];
    const envStatus = {};
    envVars.forEach((envVar) => {
      const exists = !!process.env[envVar];
      const length = process.env[envVar]?.length || 0;
      envStatus[envVar] = {
        exists,
        length: exists ? length : 0,
        status: exists ? "SET" : "MISSING"
      };
    });
    const diagnostics = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      environment: {
        NODE_ENV: nodeEnv,
        express_env: expressEnv,
        is_production: expressEnv === "production"
      },
      paths,
      file_checks: fileChecks,
      env_variables: envStatus,
      critical_issues: []
    };
    if (!envStatus["JWT_SECRET"]?.exists) {
      diagnostics.critical_issues.push("JWT_SECRET missing - auth will fail");
    }
    if (expressEnv === "production" && !fileChecks.dist_public_index_exists) {
      diagnostics.critical_issues.push("dist/public/index.html missing in production");
    }
    res.json(diagnostics);
  });
  app2.get("/api/healthz", (req, res) => {
    res.json({
      status: "ok",
      environment: process.env.NODE_ENV,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/spa-check", (req, res) => {
    const indexPath = path.resolve(import.meta.dirname, "public", "index.html");
    const exists = fs.existsSync(indexPath);
    res.json({
      spaFallback: exists ? "OK" : "FAIL",
      indexPath,
      exists
    });
  });
  app2.post("/api/login", async (req, res) => {
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
  app2.post("/api/register", async (req, res) => {
    try {
      console.log("[POST /api/register] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));
      const { area, ...userData } = req.body;
      const companyId = userData.companyId != null ? Number(userData.companyId) : void 0;
      let areaId = null;
      if (area && companyId) {
        const areaMapping = {
          "Sales": { 1: 1, 2: 4 },
          // Ventas: Dura=1, Orsega=4
          "Logistics": { 1: 2, 2: 5 },
          // Logística: Dura=2, Orsega=5
          "Purchasing": { 1: 7, 2: 10 },
          // Compras: Dura=7, Orsega=10
          "Accounting": { 1: 3, 2: 6 }
          // Contabilidad: Dura=3, Orsega=6
        };
        areaId = areaMapping[area]?.[companyId] || null;
        console.log(`[POST /api/register] \xC1rea mapeada: ${area} + Company ${companyId} = areaId ${areaId}`);
      }
      const validationResult = insertUserSchema.safeParse({
        ...userData,
        companyId,
        areaId,
        email: userData.email?.toLowerCase()
        // Normalizar email
      });
      if (!validationResult.success) {
        console.log("[POST /api/register] Error de validaci\xF3n:", validationResult.error.issues);
        return res.status(400).json({
          message: "Error de validaci\xF3n",
          code: "VALIDATION_ERROR",
          errors: validationResult.error.issues
        });
      }
      const validatedData = validationResult.data;
      console.log("[POST /api/register] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));
      try {
        const existingUser = await storage2.getUserByUsername(validatedData.email);
        if (existingUser) {
          return res.status(409).json({
            message: "El email ya est\xE1 registrado"
          });
        }
      } catch (error) {
        console.log("[POST /api/register] Email disponible");
      }
      if (!validatedData.password) {
        return res.status(400).json({
          message: "La contrase\xF1a es obligatoria"
        });
      }
      validatedData.password = await bcrypt2.hash(validatedData.password, 10);
      if (!validatedData.role) {
        validatedData.role = "collaborator";
      }
      console.log("[POST /api/register] Datos despu\xE9s del hash:", JSON.stringify({ ...validatedData, password: "[HASHED]" }, null, 2));
      const user = await storage2.createUser(validatedData);
      console.log("[POST /api/register] Usuario registrado exitosamente:", sanitizeUser(user));
      res.status(201).json({
        message: "Usuario registrado exitosamente",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("[POST /api/register] Error completo:", error);
      if (error instanceof Error) {
        console.error("[POST /api/register] Stack trace:", error.stack);
        if (error.message.includes("duplicate key") || error.message.includes("unique constraint")) {
          return res.status(409).json({
            message: "El email ya est\xE1 registrado",
            code: "EMAIL_EXISTS"
          });
        }
      }
      if (error instanceof z3.ZodError) {
        console.error("[POST /api/register] Errores de validaci\xF3n:", error.errors);
        return res.status(400).json({
          message: "Error de validaci\xF3n",
          code: "VALIDATION_ERROR",
          errors: error.errors
        });
      }
      res.status(500).json({
        message: "Error interno del servidor",
        code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/user", jwtAuthMiddleware, async (req, res) => {
    try {
      const tokenUser = req.user;
      const user = await storage2.getUser(tokenUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/users", jwtAuthMiddleware, async (req, res) => {
    try {
      const users3 = await storage2.getUsers();
      res.json(sanitizeUsers(users3));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/users", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[POST /api/users] Datos recibidos:", JSON.stringify(redactSensitiveData(req.body), null, 2));
      const validatedData = insertUserSchema.parse(req.body);
      console.log("[POST /api/users] Datos validados:", JSON.stringify(redactSensitiveData(validatedData), null, 2));
      if (validatedData.password) {
        validatedData.password = await bcrypt2.hash(validatedData.password, 10);
      }
      console.log("[POST /api/users] Datos despu\xE9s del hash:", JSON.stringify({ ...validatedData, password: "[HASHED]" }, null, 2));
      const user = await storage2.createUser(validatedData);
      console.log("[POST /api/users] Usuario creado:", user);
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      console.error("[POST /api/users] Error completo:", error);
      if (error instanceof Error) {
        console.error("[POST /api/users] Stack trace:", error.stack);
      }
      if (error instanceof z3.ZodError) {
        console.error("[POST /api/users] Errores de validaci\xF3n:", error.errors);
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  app2.put("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("[PUT /api/users/:id] Datos recibidos:", redactSensitiveData(req.body));
      const validatedData = insertUserSchema.partial().parse(req.body);
      if (validatedData.password) {
        validatedData.password = await bcrypt2.hash(validatedData.password, 10);
      }
      console.log("[PUT /api/users/:id] Datos validados:", redactSensitiveData(validatedData));
      const user = await storage2.updateUser(id, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      console.log("[PUT /api/users/:id] Usuario actualizado:", user);
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("[PUT /api/users/:id] Error:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/users/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage2.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/companies", jwtAuthMiddleware, async (req, res) => {
    try {
      const companies2 = await storage2.getCompanies();
      res.json(companies2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/companies/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage2.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      console.log(`[GET /api/companies/:id] Buscando empresa con ID: ${id}`);
      console.log(`[GET /api/companies/:id] Empresa encontrada: ${company ? "S\xED" : "No"}`);
      console.log(`[GET /api/companies/:id] Enviando empresa: { id: ${company.id}, name: '${company.name}' }`);
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/companies", jwtAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage2.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/areas", jwtAuthMiddleware, async (req, res) => {
    try {
      if (req.query.companyId && req.query.companyId !== "undefined" && req.query.companyId !== "null") {
        const companyIdNum = parseInt(req.query.companyId);
        if (!isNaN(companyIdNum) && companyIdNum > 0) {
          const areas2 = await storage2.getAreasByCompany(companyIdNum);
          res.json(areas2);
        } else {
          console.warn(`Invalid companyId received: ${req.query.companyId}`);
          const areas2 = await storage2.getAreas();
          res.json(areas2);
        }
      } else {
        const areas2 = await storage2.getAreas();
        res.json(areas2);
      }
    } catch (error) {
      console.error("Error getting areas:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/areas/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const area = await storage2.getArea(id);
      if (!area) {
        return res.status(404).json({ message: "Area not found" });
      }
      res.json(area);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/areas", jwtAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertAreaSchema.parse(req.body);
      const area = await storage2.createArea(validatedData);
      res.status(201).json(area);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/kpis", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const companyId = req.query.companyId ? parseInt(req.query.companyId) : null;
      let kpis2;
      if (companyId) {
        kpis2 = await storage2.getKpisByCompany(companyId);
      } else {
        kpis2 = await storage2.getKpis();
      }
      res.json(kpis2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const kpi = await storage2.getKpi(id);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      const isLowerBetter = kpi.name.includes("Rotaci\xF3n de cuentas por cobrar") || kpi.name.includes("Velocidad de rotaci\xF3n") || kpi.name.includes("Tiempo") && !kpi.name.includes("entrega");
      console.log(`[GET KPI/${id}] Calculando para "${kpi.name}". \xBFEs invertido?: ${isLowerBetter}`);
      res.json({
        ...kpi,
        isLowerBetter
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/kpis", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req;
      if (authReq.user?.role !== "admin" && authReq.user?.role !== "manager") {
        return res.status(403).json({ message: "No tienes permisos para crear KPIs" });
      }
      const validatedData = insertKpiSchema.parse(req.body);
      const kpi = await storage2.createKpi(validatedData);
      res.status(201).json(kpi);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.put("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req;
      if (authReq.user?.role !== "admin" && authReq.user?.role !== "manager") {
        return res.status(403).json({ message: "No tienes permisos para actualizar KPIs" });
      }
      const id = parseInt(req.params.id);
      const validatedData = updateKpiSchema.parse(req.body);
      console.log(`[PUT /api/kpis/${id}] Datos validados:`, validatedData);
      const kpi = await storage2.updateKpi(id, validatedData);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      console.log(`[PUT /api/kpis/${id}] KPI actualizado:`, kpi);
      res.json(kpi);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        console.error(`[PUT /api/kpis] Error de validaci\xF3n:`, error.errors);
        return res.status(400).json({ message: error.errors });
      }
      console.error(`[PUT /api/kpis] Error interno:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/kpis/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const authReq = req;
      if (authReq.user?.role !== "admin" && authReq.user?.role !== "manager") {
        return res.status(403).json({ message: "No tienes permisos para eliminar KPIs" });
      }
      const id = parseInt(req.params.id);
      const success = await storage2.deleteKpi(id);
      if (!success) {
        return res.status(404).json({ message: "KPI not found" });
      }
      res.json({ message: "KPI eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/user-kpis/:kpiId", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const kpiId = parseInt(req.params.kpiId);
      const kpi = await storage2.getKpi(kpiId);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      const success = await storage2.deleteKpiValuesByUser(user.id, kpiId);
      if (!success) {
        return res.json({ message: "No hab\xEDa valores de KPI para este usuario (ya estaba eliminado)" });
      }
      res.json({ message: "KPI eliminado para el usuario espec\xEDfico" });
    } catch (error) {
      console.error("Error eliminating user-specific KPI:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/top-performers", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId } = req.query;
      if (!companyId) {
        return res.status(400).json({ message: "companyId es requerido" });
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
      const result = await sql4(query, [companyId]);
      res.json(result);
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId);
        const kpi = await storage2.getKpi(kpiId);
        if (!kpi) {
          return res.status(404).json({ message: "KPI not found" });
        }
        if (user.role === "collaborator") {
          const kpiValues2 = await storage2.getKpiValuesByKpi(kpiId);
          const userKpiValues = kpiValues2.filter((kv) => kv.userId === user.id);
          res.json(userKpiValues);
        } else {
          const kpiValues2 = await storage2.getKpiValuesByKpi(kpiId);
          res.json(kpiValues2);
        }
      } else {
        if (user.role === "collaborator") {
          const kpiValues2 = await storage2.getKpiValuesByUser(user.id);
          res.json(kpiValues2);
        } else {
          const kpiValues2 = await storage2.getKpiValues();
          res.json(kpiValues2);
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const validatedData = insertKpiValueSchema.parse({
        ...req.body,
        userId: user.id
        // Asegurar que el KPI se asocie al usuario actual
      });
      const kpi = await storage2.getKpi(validatedData.kpiId);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      const lastValues = await storage2.getLatestKpiValues(validatedData.kpiId, 1);
      const previousStatus = lastValues.length > 0 ? lastValues[0].status : null;
      if (kpi.target) {
        const currentValue = validatedData.value;
        const target = kpi.target;
        const numericCurrentValue = extractNumericValue(currentValue);
        const numericTarget = extractNumericValue(target);
        if (!isNaN(numericCurrentValue) && !isNaN(numericTarget)) {
          let percentage;
          const isLowerBetter = isLowerBetterKPI(kpi.name);
          console.log(`[KPI Calculation] Calculando para "${kpi.name}". \xBFEs invertido?: ${isLowerBetter}`);
          if (isLowerBetter) {
            percentage = Math.min(numericTarget / numericCurrentValue * 100, 100);
            if (numericCurrentValue <= numericTarget) {
              validatedData.status = "complies";
            } else if (numericCurrentValue <= numericTarget * 1.1) {
              validatedData.status = "alert";
            } else {
              validatedData.status = "not_compliant";
            }
          } else {
            percentage = Math.min(numericCurrentValue / numericTarget * 100, 100);
            if (numericCurrentValue >= numericTarget) {
              validatedData.status = "complies";
            } else if (numericCurrentValue >= numericTarget * 0.9) {
              validatedData.status = "alert";
            } else {
              validatedData.status = "not_compliant";
            }
          }
          validatedData.compliancePercentage = `${percentage.toFixed(1)}%`;
        }
      }
      const kpiValueWithUser = {
        ...validatedData,
        updatedBy: user.id
      };
      const kpiValue = await storage2.createKpiValue(kpiValueWithUser);
      if (previousStatus && validatedData.status && previousStatus !== validatedData.status) {
        await createKPIStatusChangeNotification(kpi, user, previousStatus, validatedData.status, storage2);
      }
      res.status(201).json(kpiValue);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error creating KPI value:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/sales/weekly-update", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/weekly-update] SIMPLIFICADO - Recibida solicitud:`, req.body);
      const { value, companyId, weekNumber, month, year, adminOverride } = req.body;
      const user = getAuthUser(req);
      if (!value || !companyId) {
        return res.status(400).json({
          message: "Datos insuficientes. Se requiere value y companyId"
        });
      }
      const salesData = {
        value: parseFloat(value),
        companyId: parseInt(companyId || "1"),
        // Default a Dura International
        userId: user.id
        // Usuario autenticado
      };
      if (user.role === "admin" && adminOverride && weekNumber && month && year) {
        salesData.adminOverride = true;
        salesData.weekNumber = weekNumber;
        salesData.month = month;
        salesData.year = parseInt(year);
        console.log(`[POST /api/sales/weekly-update] ADMIN OVERRIDE - Per\xEDodo manual: ${weekNumber} - ${month} ${year}`);
      } else {
        console.log(`[POST /api/sales/weekly-update] Modo normal - detecci\xF3n autom\xE1tica`);
      }
      let targetMonth, targetYear;
      if (salesData.adminOverride && salesData.month && salesData.year) {
        targetMonth = salesData.month;
        targetYear = salesData.year;
      } else {
        const today = /* @__PURE__ */ new Date();
        const monthNames = [
          "Enero",
          "Febrero",
          "Marzo",
          "Abril",
          "Mayo",
          "Junio",
          "Julio",
          "Agosto",
          "Septiembre",
          "Octubre",
          "Noviembre",
          "Diciembre"
        ];
        targetMonth = monthNames[today.getMonth()];
        targetYear = today.getFullYear();
      }
      const shouldCheckClosure = !(user.role === "admin" && salesData.adminOverride);
      if (shouldCheckClosure) {
        const allKpis = await storage2.getKpis();
        const volumeKpi = allKpis.find(
          (kpi) => kpi.name.includes("Volumen de ventas") && kpi.companyId === salesData.companyId
        );
        if (volumeKpi) {
          const kpiValues2 = await storage2.getKpiValuesByKpi(volumeKpi.id);
          const monthlyRecord = kpiValues2.find(
            (value2) => value2.period === `${targetMonth} ${targetYear}` && !value2.period.includes("Semana")
          );
          if (monthlyRecord) {
            console.log(`[POST /api/sales/weekly-update] \u274C ACCESO DENEGADO - Mes ${targetMonth} ${targetYear} ya est\xE1 cerrado`);
            return res.status(409).json({
              success: false,
              message: `El mes ${targetMonth} ${targetYear} ya est\xE1 cerrado y no se pueden hacer m\xE1s actualizaciones.`,
              monthStatus: {
                closed: true,
                period: `${targetMonth} ${targetYear}`,
                closedValue: monthlyRecord.value,
                closedDate: monthlyRecord.date
              },
              suggestion: "Contacta a un administrador si necesitas actualizar este per\xEDodo."
            });
          }
        }
      } else {
        console.log(`[POST /api/sales/weekly-update] \u{1F513} ADMIN OVERRIDE - Permitiendo actualizaci\xF3n en per\xEDodo ${targetMonth} ${targetYear}`);
      }
      const result = await updateWeeklySales(salesData);
      if (result.success) {
        console.log(`[POST /api/sales/weekly-update] \u2705 Actualizaci\xF3n exitosa:`, {
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
        console.error(`[POST /api/sales/weekly-update] \u274C Error:`, result.message);
        res.status(400).json({
          success: false,
          message: result.message || "Error al actualizar datos de ventas"
        });
      }
    } catch (error) {
      console.error("[POST /api/sales/weekly-update] \u274C Error cr\xEDtico:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  });
  app2.post("/api/sales/auto-close-month", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/auto-close-month] Iniciando auto-cierre mensual:`, req.body);
      const { companyId, month, year } = req.body;
      const user = getAuthUser(req);
      if (user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden ejecutar el auto-cierre mensual"
        });
      }
      const companiesToClose = companyId ? [parseInt(companyId)] : [1, 2];
      console.log(`[POST /api/sales/auto-close-month] Procesando empresas:`, companiesToClose);
      const results = [];
      for (const compId of companiesToClose) {
        try {
          console.log(`[POST /api/sales/auto-close-month] Procesando empresa ${compId}...`);
          const result = await autoCloseMonth(compId, month, year);
          results.push({
            companyId: compId,
            success: result,
            message: result ? "Mes cerrado exitosamente" : "No hay datos para cerrar o ya est\xE1 cerrado"
          });
        } catch (error) {
          console.error(`[POST /api/sales/auto-close-month] Error para empresa ${compId}:`, error);
          results.push({
            companyId: compId,
            success: false,
            message: error.message || "Error al cerrar mes"
          });
        }
      }
      const allSuccessful = results.every((r) => r.success);
      const successCount = results.filter((r) => r.success).length;
      console.log(`[POST /api/sales/auto-close-month] \u2705 Completado - ${successCount}/${results.length} empresas procesadas`);
      res.status(200).json({
        success: allSuccessful,
        message: `Auto-cierre completado: ${successCount}/${results.length} empresas procesadas`,
        results,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("[POST /api/sales/auto-close-month] \u274C Error cr\xEDtico:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante el auto-cierre"
      });
    }
  });
  app2.post("/api/sales/monthly-close", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log(`[POST /api/sales/monthly-close] CIERRE MANUAL iniciado:`, req.body);
      const { companyId, month, year, override = false } = req.body;
      const user = getAuthUser(req);
      if (user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Solo los administradores pueden cerrar meses manualmente"
        });
      }
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Par\xE1metros requeridos: companyId, month, year"
        });
      }
      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage2.getKpis();
      const volumeKpi = allKpis.find(
        (kpi) => kpi.name.includes("Volumen de ventas") && kpi.companyId === parseInt(companyId)
      );
      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontr\xF3 KPI de volumen de ventas para la compa\xF1\xEDa ${companyId}`
        });
      }
      const existingKpiValues = await storage2.getKpiValuesByKpi(volumeKpi.id);
      const existingMonthlyRecord = existingKpiValues.find(
        (value) => value.period === targetPeriod && !value.period.includes("Semana")
      );
      if (existingMonthlyRecord && !override) {
        return res.status(409).json({
          success: false,
          message: `El mes ${month} ${year} ya est\xE1 cerrado. Usa override=true para volver a cerrar.`,
          existingRecord: {
            id: existingMonthlyRecord.id,
            value: existingMonthlyRecord.value,
            date: existingMonthlyRecord.date,
            period: existingMonthlyRecord.period
          }
        });
      }
      console.log(`[POST /api/sales/monthly-close] Ejecutando cierre para empresa ${companyId}, per\xEDodo: ${targetPeriod}`);
      const result = await autoCloseMonth(parseInt(companyId), month, parseInt(year));
      if (result) {
        console.log(`[POST /api/sales/monthly-close] \u2705 Cierre manual exitoso para compa\xF1\xEDa ${companyId}`);
        const actionText = existingMonthlyRecord && override ? "actualizado" : "cerrado";
        res.status(200).json({
          success: true,
          message: `Mes ${month} ${year} ${actionText} exitosamente`,
          companyId: parseInt(companyId),
          period: targetPeriod,
          wasOverride: !!(existingMonthlyRecord && override),
          closedBy: user.name || user.id
        });
      } else {
        console.error(`[POST /api/sales/monthly-close] \u274C Error en cierre manual para compa\xF1\xEDa ${companyId}`);
        res.status(500).json({
          success: false,
          message: `Error al cerrar el mes ${month} ${year} - posiblemente no hay datos semanales suficientes`
        });
      }
    } catch (error) {
      console.error("[POST /api/sales/monthly-close] \u274C Error cr\xEDtico:", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor durante cierre manual",
        error: error.message
      });
    }
  });
  app2.get("/api/sales/monthly-status", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, month, year } = req.query;
      if (!companyId || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Par\xE1metros requeridos: companyId, month, year"
        });
      }
      const targetPeriod = `${month} ${year}`;
      const allKpis = await storage2.getKpis();
      const volumeKpi = allKpis.find(
        (kpi) => kpi.name.includes("Volumen de ventas") && kpi.companyId === parseInt(companyId)
      );
      if (!volumeKpi) {
        return res.status(404).json({
          success: false,
          message: `No se encontr\xF3 KPI de volumen de ventas para la compa\xF1\xEDa ${companyId}`
        });
      }
      const kpiValues2 = await storage2.getKpiValuesByKpi(volumeKpi.id);
      const monthlyRecord = kpiValues2.find(
        (value) => value.period === targetPeriod && !value.period.includes("Semana")
      );
      const weeklyRecords = kpiValues2.filter(
        (value) => value.period.includes(month) && value.period.includes(year) && value.period.includes("Semana")
      );
      res.status(200).json({
        success: true,
        closed: !!monthlyRecord,
        period: targetPeriod,
        monthlyRecord: monthlyRecord || null,
        weeklyRecordsCount: weeklyRecords.length,
        weeklyRecords: weeklyRecords.map((w) => ({
          period: w.period,
          value: w.value,
          date: w.date
        }))
      });
    } catch (error) {
      console.error("[GET /api/sales/monthly-status] Error:", error);
      res.status(500).json({
        success: false,
        message: "Error al consultar estado del mes"
      });
    }
  });
  app2.get("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      const {
        companyId,
        status,
        limit = "50",
        // Default 50 envíos por página
        page = "1",
        since
        // Filtro temporal: 'YYYY-MM-DD' o días como '30d'
      } = req.query;
      const limitNum = parseInt(limit);
      const pageNum = parseInt(page);
      const offset = (pageNum - 1) * limitNum;
      let sinceDate;
      if (since) {
        const sinceStr = since;
        if (sinceStr.endsWith("d")) {
          const days = parseInt(sinceStr.replace("d", ""));
          sinceDate = /* @__PURE__ */ new Date();
          sinceDate.setDate(sinceDate.getDate() - days);
        } else {
          sinceDate = new Date(sinceStr);
        }
      }
      let shipments2;
      if (companyId) {
        const companyIdNum = parseInt(companyId);
        shipments2 = await storage2.getShipmentsByCompany(companyIdNum);
      } else {
        shipments2 = await storage2.getShipments();
      }
      if (status) {
        shipments2 = shipments2.filter((s) => s.status === status);
      }
      if (sinceDate) {
        shipments2 = shipments2.filter((s) => {
          const shipmentDate = new Date(s.actualDeliveryDate || s.updatedAt || s.createdAt);
          return shipmentDate >= sinceDate;
        });
      }
      shipments2.sort((a, b) => {
        const dateA = new Date(a.actualDeliveryDate || a.updatedAt || a.createdAt);
        const dateB = new Date(b.actualDeliveryDate || b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      const total = shipments2.length;
      const paginatedShipments = shipments2.slice(offset, offset + limitNum);
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
      console.error("[GET /api/shipments] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/shipments/products", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const { companyId } = req.query;
      console.log("[GET /api/shipments/products] Usuario:", user.name, "Empresa filtro:", companyId);
      let whereConditions = ["product IS NOT NULL AND product != ''"];
      let queryParams = [];
      let paramCount = 0;
      const whereClause = `WHERE ${whereConditions.join(" AND ")}`;
      const query = `
        SELECT DISTINCT product 
        FROM shipments 
        ${whereClause}
        ORDER BY product ASC
      `;
      const result = await sql4(query, queryParams);
      const products = result.map((row) => row.product);
      console.log(`[GET /api/shipments/products] Encontrados ${products.length} productos \xFAnicos`);
      res.json(products);
    } catch (error) {
      console.error("[GET /api/shipments/products] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/shipments/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const shipment = await storage2.getShipment(id);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/shipments/tracking/:trackingCode", jwtAuthMiddleware, async (req, res) => {
    try {
      const trackingCode = req.params.trackingCode;
      const shipment = await storage2.getShipmentByTrackingCode(trackingCode);
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/shipments", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[POST /api/shipments] Datos recibidos:", JSON.stringify(req.body, null, 2));
      const transformedData = {
        ...req.body,
        estimatedDeliveryDate: req.body.estimatedDeliveryDate ? new Date(req.body.estimatedDeliveryDate) : null,
        departureDate: req.body.departureDate ? new Date(req.body.departureDate) : null,
        actualDeliveryDate: req.body.actualDeliveryDate ? new Date(req.body.actualDeliveryDate) : null
      };
      console.log("[POST /api/shipments] Datos transformados:", JSON.stringify(transformedData, null, 2));
      const validatedData = insertShipmentSchema.parse(transformedData);
      console.log("[POST /api/shipments] Datos validados:", JSON.stringify(validatedData, null, 2));
      const shipment = await storage2.createShipment(validatedData);
      console.log("[POST /api/shipments] Env\xEDo creado:", shipment);
      res.status(201).json(shipment);
    } catch (error) {
      console.error("[POST /api/shipments] Error completo:", error);
      console.error("[POST /api/shipments] Stack trace:", error?.stack);
      if (error instanceof z3.ZodError) {
        console.error("[POST /api/shipments] Errores de validaci\xF3n:", error.errors);
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Internal server error", details: error.message });
    }
  });
  app2.get("/api/shipments/:id/updates", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const updates = await storage2.getShipmentUpdates(shipmentId);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/action-plans", jwtAuthMiddleware, async (req, res) => {
    try {
      if (req.query.kpiId) {
        const kpiId = parseInt(req.query.kpiId);
        const actionPlans2 = await storage2.getActionPlansByKpi(kpiId);
        res.json(actionPlans2);
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/action-plans/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const actionPlan = await storage2.getActionPlan(id);
      if (!actionPlan) {
        return res.status(404).json({ message: "Action plan not found" });
      }
      res.json(actionPlan);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const notifications2 = await storage2.getNotificationsForUser(user.id);
      res.json(notifications2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      const notificationData = {
        ...req.body,
        fromUserId: user.id
      };
      console.log("[POST /api/notifications] Creando notificaci\xF3n:", notificationData);
      const notification = await storage2.createNotification(notificationData);
      const recipient = await storage2.getUser(notificationData.toUserId);
      if (recipient && recipient.email) {
        console.log("[POST /api/notifications] Enviando correo a:", recipient.email);
        const { html, text: text2 } = createTeamMessageTemplate(
          user.name,
          recipient.name,
          notificationData.title,
          notificationData.message,
          notificationData.type || "info",
          notificationData.priority || "normal"
        );
        const emailSent = await sendEmail({
          to: recipient.email,
          from: "Mario Reynoso <marioreynoso@grupoorsega.com>",
          // Correo verificado de Mario Reynoso con nombre
          subject: `[Econova] ${notificationData.title}`,
          html,
          text: text2
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
  app2.put("/api/notifications/:id/read", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getAuthUser(req);
      const notification = await storage2.markNotificationAsRead(id, user.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/notifications/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = getAuthUser(req);
      const success = await storage2.deleteNotification(id, user.id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/team-activity", jwtAuthMiddleware, async (req, res) => {
    try {
      console.log("[GET /api/team-activity] Obteniendo resumen de actividad del equipo");
      const activitySummary = await storage2.getTeamActivitySummary();
      console.log("[GET /api/team-activity] Resumen obtenido:", activitySummary);
      res.json(activitySummary);
    } catch (error) {
      console.error("Error getting team activity:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/users/:id/last-kpi-update", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const lastUpdate = await storage2.getLastKpiUpdateByUser(userId);
      res.json(lastUpdate);
    } catch (error) {
      console.error("Error getting last KPI update:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.put("/api/shipments/:id/status", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const user = getAuthUser(req);
      const validatedData = updateShipmentStatusSchema.parse(req.body);
      console.log("[PUT /api/shipments/:id/status] Actualizando estado del env\xEDo:", { shipmentId, data: validatedData });
      const shipment = await storage2.getShipment(shipmentId);
      if (!shipment) {
        return res.status(404).json({ message: "Env\xEDo no encontrado" });
      }
      const updatedShipment = await storage2.updateShipment(shipmentId, {
        status: validatedData.status,
        updatedAt: /* @__PURE__ */ new Date()
      });
      if (!updatedShipment) {
        return res.status(404).json({ message: "Error al actualizar el env\xEDo" });
      }
      const shipmentUpdate = await storage2.createShipmentUpdate({
        shipmentId,
        status: validatedData.status,
        location: validatedData.location || null,
        comments: validatedData.comments || null,
        updatedBy: user.id
      });
      try {
        await storage2.recalculateShipmentCycleTime(shipmentId);
        console.log(`[Cycle Times] Recalculated for shipment ${shipmentId}`);
      } catch (cycleTimeError) {
        console.error(`[Cycle Times] Error recalculating for shipment ${shipmentId}:`, cycleTimeError);
      }
      if (validatedData.sendNotification && updatedShipment.customerEmail) {
        try {
          console.log("[Notification] Verificando preferencias de notificaci\xF3n para cliente:", updatedShipment.customerName);
          const clientPreferencesQuery = await sql4(
            `SELECT acuse FROM clients WHERE email = $1 AND company_id = $2 LIMIT 1`,
            [updatedShipment.customerEmail, updatedShipment.companyId]
          );
          const shouldSendNotification = clientPreferencesQuery.length > 0 ? clientPreferencesQuery[0].acuse : true;
          if (shouldSendNotification) {
            console.log("[Notification] Cliente autoriza notificaciones - Enviando email a:", updatedShipment.customerEmail);
            const emailTemplate = getShipmentStatusEmailTemplate(
              updatedShipment,
              validatedData.status,
              updatedShipment.customerName
            );
            const notificationRecord = await storage2.createShipmentNotification({
              shipmentId,
              emailTo: updatedShipment.customerEmail,
              subject: emailTemplate.subject,
              status: "pending",
              sentBy: user.id,
              shipmentStatus: validatedData.status,
              errorMessage: null
            });
            const emailSent = await sendEmail2({
              to: updatedShipment.customerEmail,
              from: "marioreynoso@grupoorsega.com",
              // Siempre desde Mario
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              text: emailTemplate.text
            });
            if (emailSent) {
              await storage2.updateShipmentNotificationStatus(notificationRecord.id, "sent");
              console.log("[Notification] Email enviado exitosamente respetando preferencias del cliente");
            } else {
              await storage2.updateShipmentNotificationStatus(notificationRecord.id, "failed", "Error al enviar email");
              console.error("[Notification] Error al enviar email");
            }
          } else {
            console.log("[Notification] Cliente NO autoriza notificaciones - Email omitido para:", updatedShipment.customerEmail);
          }
        } catch (emailError) {
          console.error("[Notification] Error en el proceso de notificaci\xF3n:", emailError);
        }
      }
      res.json({
        shipment: updatedShipment,
        update: shipmentUpdate,
        notificationSent: validatedData.sendNotification && !!updatedShipment.customerEmail
      });
    } catch (error) {
      console.error("[PUT /api/shipments/:id/status] Error:", error);
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: "Datos inv\xE1lidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/shipments/:id/notifications", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const notifications2 = await storage2.getShipmentNotificationsByShipment(shipmentId);
      res.json(notifications2);
    } catch (error) {
      console.error("[GET /api/shipments/:id/notifications] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/shipments/:id/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const cycleTime = await storage2.recalculateShipmentCycleTime(shipmentId);
      if (!cycleTime) {
        return res.status(404).json({ message: "Env\xEDo no encontrado" });
      }
      res.json(cycleTime);
    } catch (error) {
      console.error("[GET /api/shipments/:id/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/metrics/cycle-times", jwtAuthMiddleware, async (req, res) => {
    try {
      const companyId = req.query.companyId ? parseInt(req.query.companyId) : void 0;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      const metrics = await storage2.getAggregateCycleTimes(companyId, startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("[GET /api/metrics/cycle-times] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/job-profiles/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const profile = await storage2.getJobProfileWithDetails(userId);
      if (!profile) {
        return res.status(404).json({ message: "Perfil de trabajo no encontrado" });
      }
      res.json(profile);
    } catch (error) {
      console.error("[GET /api/job-profiles/:userId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/user-kpis/:userId", jwtAuthMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userKpis = await storage2.getUserKpis(userId);
      res.json(userKpis);
    } catch (error) {
      console.error("[GET /api/user-kpis/:userId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/kpi-overview", jwtAuthMiddleware, async (req, res) => {
    try {
      const kpiOverview = await storage2.getKPIOverview();
      res.json(kpiOverview);
    } catch (error) {
      console.error("[GET /api/kpi-overview] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/kpi-history/:kpiId", jwtAuthMiddleware, async (req, res) => {
    try {
      const kpiId = parseInt(req.params.kpiId);
      const months = parseInt(req.query.months) || 12;
      const kpiHistory = await storage2.getKPIHistory(kpiId, months);
      res.json(kpiHistory);
    } catch (error) {
      console.error("[GET /api/kpi-history/:kpiId] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  const sql4 = neon(process.env.DATABASE_URL);
  app2.get("/api/clients-db", jwtAuthMiddleware, async (req, res) => {
    try {
      const { companyId, search } = req.query;
      let whereClause = "WHERE is_active = true";
      const params = [];
      let paramIndex = 1;
      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR client_code ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      const result = await sql4(`
        SELECT 
          id, name, email, phone, contact_person, company, address,
          company_id, client_code, city, state, postal_code, country,
          requires_receipt, email_notifications, customer_type,
          payment_terms, is_active, created_at
        FROM clients 
        ${whereClause}
        ORDER BY name
      `, params);
      res.json(result);
    } catch (error) {
      console.error("Error fetching clients from database:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
  app2.get("/api/clients-db/:id", jwtAuthMiddleware, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const result = await sql4(`
        SELECT 
          id, name, email, phone, contact_person, company, address,
          company_id, client_code, city, state, postal_code, country,
          requires_receipt, email_notifications, customer_type,
          payment_terms, is_active, notes, created_at, updated_at
        FROM clients 
        WHERE id = $1 AND is_active = true
      `, [clientId]);
      if (result.length === 0) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(result[0]);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });
  app2.get("/api/clients", jwtAuthMiddleware, async (req, res) => {
    try {
      const result = await sql4(`
        SELECT 
          id, name, email, phone, contact_person as contact_name,
          address as billing_addr, address as shipping_addr,
          client_code as rfc, is_active
        FROM clients 
        WHERE is_active = true
        ORDER BY name
      `);
      res.json(result);
    } catch (error) {
      console.error("Error fetching clients for logistics:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });
  app2.get("/api/providers", jwtAuthMiddleware, async (req, res) => {
    try {
      const result = await sql4(`
        SELECT 
          id, name, email, phone, contact_name, rating, is_active
        FROM provider 
        WHERE is_active = true
        ORDER BY name
      `);
      res.json(result);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });
  app2.post("/api/admin/send-activation-emails", jwtAuthMiddleware, async (req, res) => {
    try {
      const user = getAuthUser(req);
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Solo administradores pueden enviar emails de activaci\xF3n masiva" });
      }
      const users3 = await storage2.getUsers();
      let successCount = 0;
      let errorCount = 0;
      for (const targetUser of users3) {
        try {
          const activationToken = await storage2.createActivationToken(targetUser.email);
          const baseUrl = process.env.NODE_ENV === "production" ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER || "user"}.replit.app` : "http://localhost:5000";
          const activationUrl = `${baseUrl}/activate/${activationToken.token}`;
          const emailSent = await sendEmail({
            to: targetUser.email,
            from: "daniel@econova.com.mx",
            subject: "\u{1F510} Activa tu cuenta en ECONOVA KPI Dashboard",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
                  <h1 style="margin: 0; font-size: 28px;">\xA1Bienvenido a ECONOVA!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">KPI Dashboard - Sistema de Gesti\xF3n</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <h2 style="color: #273949; margin-top: 0;">Hola ${targetUser.name},</h2>
                  
                  <p>Tu cuenta ha sido creada en el Sistema ECONOVA KPI Dashboard. Para completar la configuraci\xF3n y acceder al sistema, necesitas establecer tu contrase\xF1a personal.</p>
                  
                  <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1976d2;">\u{1F4E7} Tu informaci\xF3n de acceso:</h3>
                    <p style="margin: 0;"><strong>Email:</strong> ${targetUser.email}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Rol:</strong> ${targetUser.role}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${activationUrl}" style="background: linear-gradient(135deg, #273949 0%, #b5e951 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                      \u{1F510} Activar mi cuenta
                    </a>
                  </div>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">\u26A0\uFE0F Informaci\xF3n importante:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #856404;">
                      <li>Este enlace es v\xE1lido por <strong>24 horas</strong></li>
                      <li>Solo puedes usarlo <strong>una vez</strong></li>
                      <li>Elige una contrase\xF1a segura (m\xEDnimo 8 caracteres)</li>
                      <li>Nunca compartas tus credenciales de acceso</li>
                    </ul>
                  </div>
                  
                  <p style="color: #666; font-size: 14px;">Si no puedes hacer clic en el bot\xF3n, copia y pega este enlace en tu navegador:</p>
                  <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 5px; font-size: 12px; color: #666;">${activationUrl}</p>
                </div>
                
                <div style="text-align: center; color: #666; font-size: 12px;">
                  <p>\xA9 2025 ECONOVA - KPI Dashboard</p>
                  <p>Sistema de Gesti\xF3n de Indicadores de Rendimiento</p>
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
      await storage2.deleteExpiredTokens();
      res.json({
        message: `Emails de activaci\xF3n enviados`,
        totalUsers: users3.length,
        successful: successCount,
        failed: errorCount
      });
    } catch (error) {
      console.error("[POST /api/admin/send-activation-emails] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/activate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const activationToken = await storage2.getActivationToken(token);
      if (!activationToken) {
        return res.status(404).json({
          error: "Token no v\xE1lido",
          message: "El enlace de activaci\xF3n no es v\xE1lido o ha expirado"
        });
      }
      if (/* @__PURE__ */ new Date() > activationToken.expiresAt) {
        return res.status(400).json({
          error: "Token expirado",
          message: "El enlace de activaci\xF3n ha expirado. Solicita uno nuevo al administrador"
        });
      }
      if (activationToken.used) {
        return res.status(400).json({
          error: "Token ya utilizado",
          message: "Este enlace de activaci\xF3n ya fue utilizado"
        });
      }
      const user = await storage2.getUserByEmail(activationToken.email);
      if (!user) {
        return res.status(404).json({
          error: "Usuario no encontrado",
          message: "No se encontr\xF3 un usuario asociado a este token"
        });
      }
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
  app2.post("/api/activate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      if (!password || password.length < 8) {
        return res.status(400).json({
          message: "La contrase\xF1a debe tener al menos 8 caracteres"
        });
      }
      const activationToken = await storage2.getActivationToken(token);
      if (!activationToken) {
        return res.status(404).json({
          message: "Token no v\xE1lido o expirado"
        });
      }
      if (/* @__PURE__ */ new Date() > activationToken.expiresAt) {
        return res.status(400).json({
          message: "El enlace de activaci\xF3n ha expirado"
        });
      }
      if (activationToken.used) {
        return res.status(400).json({
          message: "Este enlace de activaci\xF3n ya fue utilizado"
        });
      }
      const user = await storage2.getUserByEmail(activationToken.email);
      if (!user) {
        return res.status(404).json({
          message: "Usuario no encontrado"
        });
      }
      const hashedPassword = await bcrypt2.hash(password, 10);
      await storage2.updateUser(user.id, { password: hashedPassword });
      await storage2.markTokenAsUsed(token);
      await storage2.deleteExpiredTokens();
      res.json({
        message: "\xA1Contrase\xF1a establecida exitosamente! Ya puedes iniciar sesi\xF3n",
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error("[POST /api/activate/:token] Error:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.use("/api", catalogRouter);
  app2.use("/api", logisticsRouter);
  app2.post("/api/seed-production", async (req, res) => {
    try {
      const { seedProductionData: seedProductionData2 } = await Promise.resolve().then(() => (init_seed_production(), seed_production_exports));
      const result = await seedProductionData2();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Seeding failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app2.get("/api/debug-database", async (req, res) => {
    try {
      const allCompanies = await storage2.getCompanies();
      const allAreas = await storage2.getAreas();
      const allKpis = await storage2.getKpis();
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
  console.log("\u2705 All routes have been configured successfully");
  return app2;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import path4 from "path";
import fs3 from "fs";
function logBootDiagnostics() {
  try {
    const nodeEnv = process.env.NODE_ENV || "undefined";
    const appEnv = process.env.NODE_ENV === "production" ? "production" : "development";
    console.log("\n\u{1F50D} === BOOT DIAGNOSTICS ===");
    console.log(`\u{1F4CA} NODE_ENV: ${nodeEnv}`);
    console.log(`\u{1F4CA} Express env will be: ${appEnv}`);
    console.log(`\u{1F4CA} Current working directory: ${process.cwd()}`);
    const currentFileUrl = import.meta.url;
    const currentFileDir = path4.dirname(fileURLToPath(currentFileUrl));
    console.log(`\u{1F4CA} Script directory: ${currentFileDir}`);
    const distIndexPath = path4.resolve(currentFileDir, "index.js");
    const distPublicPath = path4.resolve(currentFileDir, "public");
    const distPublicIndexPath = path4.resolve(distPublicPath, "index.html");
    const altDistIndexPath = path4.resolve(currentFileDir, "..", "server", "dist", "index.js");
    const altDistPublicPath = path4.resolve(currentFileDir, "..", "dist", "public");
    const altDistPublicIndexPath = path4.resolve(altDistPublicPath, "index.html");
    console.log(`\u{1F4C2} Expected dist/index.js: ${distIndexPath}`);
    console.log(`\u{1F4C2} Expected dist/public: ${distPublicPath}`);
    console.log(`\u{1F4C2} Expected dist/public/index.html: ${distPublicIndexPath}`);
    console.log(`\u2705 dist/index.js exists: ${fs3.existsSync(distIndexPath)} (expected for production)`);
    console.log(`\u2705 dist/public exists: ${fs3.existsSync(distPublicPath)} (expected for production)`);
    console.log(`\u2705 dist/public/index.html exists: ${fs3.existsSync(distPublicIndexPath)} (expected for production)`);
    console.log(`\u{1F4E6} Build artifacts in current locations:`);
    console.log(`   backend (server/dist/index.js): ${fs3.existsSync(altDistIndexPath)}`);
    console.log(`   frontend (dist/public/index.html): ${fs3.existsSync(altDistPublicIndexPath)}`);
    const criticalEnvs = [
      "DATABASE_URL",
      "JWT_SECRET",
      "SENDGRID_API_KEY",
      "REPL_ID",
      "REPL_SLUG"
    ];
    console.log("\u{1F512} Environment variables status:");
    criticalEnvs.forEach((envVar) => {
      const exists = !!process.env[envVar];
      const length = process.env[envVar]?.length || 0;
      console.log(`   ${envVar}: ${exists ? "\u2705 SET" : "\u274C MISSING"} ${exists ? `(${length} chars)` : ""}`);
    });
    console.log("=== END BOOT DIAGNOSTICS ===\n");
  } catch (error) {
    console.error("\u26A0\uFE0F Error in boot diagnostics:", error);
    console.log("Continuing server startup...\n");
  }
}
logBootDiagnostics();
var app = express2();
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  console.log("\u{1F512} Trust proxy enabled for production (.replit.app domain)");
}
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(express2.static(path4.join(process.cwd(), "public")));
function redactSensitiveData2(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sensitive = ["password", "token", "authorization", "apiKey", "secret", "jwt"];
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData2(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
app.use((req, res, next) => {
  const start = Date.now();
  const path5 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path5.startsWith("/api")) {
      let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const redactedResponse = redactSensitiveData2(capturedJsonResponse);
        logLine += ` :: ${JSON.stringify(redactedResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  registerRoutes(app);
  const server = createServer(app);
  const expressEnv = app.get("env");
  console.log(`\u{1F680} Express environment detected: ${expressEnv}`);
  if (expressEnv === "development") {
    console.log("\u{1F527} Setting up Vite middleware for development...");
    await setupVite(app, server);
    console.log("\u2705 Vite middleware configured");
  } else {
    console.log("\u{1F4E6} Setting up static file serving for production...");
    try {
      serveStatic(app);
      console.log("\u2705 Static file serving configured");
    } catch (error) {
      console.error("\u274C CRITICAL ERROR setting up static files:", error);
      throw error;
    }
  }
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[Server Error ${status}]:`, err.message);
    if (status >= 500) {
      console.error("Full error stack:", err.stack);
    }
    res.status(status).json({ message });
  });
  const port = 5e3;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    console.log("\u23F8\uFE0F  Auto-cierre autom\xE1tico DESACTIVADO - cierre manual requerido");
    console.log("\u2705 Sistema configurado para cierre manual");
  });
})();
