import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum, real, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enumeración para el estado del envío
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'pending',     // Pendiente de envío
  'in_transit',  // En tránsito
  'delayed',     // Retrasado
  'delivered',   // Entregado
  'cancelled'    // Cancelado/Cerrado (entregado y finalizado administrativamente)
]);

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"),
  companyId: integer("company_id"),
  areaId: integer("area_id"), // Área específica del usuario
  lastLogin: timestamp("last_login"),
});

// ✅ SECURITY IMPROVEMENT: Extender schema con validación de longitud máxima
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, lastLogin: true })
  .extend({
    name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
    email: z.string().email("Email inválido").max(320, "El email no puede exceder 320 caracteres"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100, "La contraseña no puede exceder 100 caracteres"),
    role: z.string().max(50, "El rol no puede exceder 50 caracteres")
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User Activation Tokens schema
export const userActivationTokens = pgTable("user_activation_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserActivationTokenSchema = createInsertSchema(userActivationTokens).omit({ id: true, createdAt: true });
export type InsertUserActivationToken = z.infer<typeof insertUserActivationTokenSchema>;
export type UserActivationToken = typeof userActivationTokens.$inferSelect;

// Company schema
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sector: text("sector"),
  logo: text("logo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Area schema
export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  companyId: integer("company_id").notNull(),
});

export const insertAreaSchema = createInsertSchema(areas).omit({ id: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;

// KPI schema específicos por empresa
export const kpisDura = pgTable("kpis_dura", {
  id: serial("id").primaryKey(),
  area: text("area").notNull(),
  kpiName: text("kpi_name").notNull(),
  description: text("description"),
  calculationMethod: text("calculation_method"),
  goal: text("goal"),
  annualGoal: text("annual_goal"), // Objetivo anual (para KPIs de ventas)
  unit: text("unit"),
  frequency: text("frequency"),
  source: text("source"),
  responsible: text("responsible"),
  period: text("period"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kpisOrsega = pgTable("kpis_orsega", {
  id: serial("id").primaryKey(),
  area: text("area").notNull(),
  kpiName: text("kpi_name").notNull(),
  description: text("description"),
  calculationMethod: text("calculation_method"),
  goal: text("goal"),
  annualGoal: text("annual_goal"), // Objetivo anual (para KPIs de ventas)
  unit: text("unit"),
  frequency: text("frequency"),
  source: text("source"),
  responsible: text("responsible"),
  period: text("period"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertKpiDuraSchema = createInsertSchema(kpisDura).omit({ id: true, createdAt: true });
export const insertKpiOrsegaSchema = createInsertSchema(kpisOrsega).omit({ id: true, createdAt: true });

export type InsertKpiDura = z.infer<typeof insertKpiDuraSchema>;
export type InsertKpiOrsega = z.infer<typeof insertKpiOrsegaSchema>;
export type KpiDura = typeof kpisDura.$inferSelect;
export type KpiOrsega = typeof kpisOrsega.$inferSelect;

// KPI Values schema específicos por empresa
export const kpiValuesDura = pgTable("kpi_values_dura", {
  id: serial("id").primaryKey(),
  kpi_id: integer("kpi_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  value: real("value").notNull(),
  compliance_percentage: text("compliance_percentage"),
  status: text("status"),
  comments: text("comments"),
  updated_by: integer("updated_by"),
  created_at: timestamp("created_at").defaultNow(),
});

export const kpiValuesOrsega = pgTable("kpi_values_orsega", {
  id: serial("id").primaryKey(),
  kpi_id: integer("kpi_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  value: real("value").notNull(),
  compliance_percentage: text("compliance_percentage"),
  status: text("status"),
  comments: text("comments"),
  updated_by: integer("updated_by"),
  created_at: timestamp("created_at").defaultNow(),
});

export type KpiValueDura = typeof kpiValuesDura.$inferSelect;
export type KpiValueOrsega = typeof kpiValuesOrsega.$inferSelect;

export const companyIdSchema = z.union([z.literal(1), z.literal(2)]);
export type CompanyId = z.infer<typeof companyIdSchema>;

const stringOrNumberToString = z.union([z.string(), z.number()]).transform((val) =>
  typeof val === "number" ? val.toString() : val
);

// ✅ SECURITY IMPROVEMENT: Agregar validación de longitud máxima para prevenir DoS
export const insertKpiSchema = z
  .object({
    companyId: companyIdSchema.optional(),
    areaId: z.number().int().positive().optional(),
    area: z.string().min(1, "El área es requerida").max(100, "El área no puede exceder 100 caracteres").optional(),
    name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede exceder 200 caracteres"),
    description: z.string().max(2000, "La descripción no puede exceder 2000 caracteres").optional().nullable(),
    target: stringOrNumberToString.optional(),
    goal: stringOrNumberToString.optional(),
    unit: z.string().max(50, "La unidad no puede exceder 50 caracteres").optional().nullable(),
    frequency: z.string().max(50, "La frecuencia no puede exceder 50 caracteres").optional().nullable(),
    calculationMethod: z.string().max(500, "El método de cálculo no puede exceder 500 caracteres").optional().nullable(),
    responsible: z.string().max(200, "El responsable no puede exceder 200 caracteres").optional().nullable(),
    source: z.string().max(200, "La fuente no puede exceder 200 caracteres").optional().nullable(),
    period: z.string().max(50, "El período no puede exceder 50 caracteres").optional().nullable(),
  })
  .refine((data) => data.areaId !== undefined || !!data.area, {
    message: "Debe seleccionarse un área válida",
    path: ["areaId"],
  });

export type InsertKpi = z.infer<typeof insertKpiSchema>;

export type Kpi = {
  id: number;
  companyId: CompanyId;
  areaId: number | null;
  area: string | null;
  name: string;
  description: string | null;
  goal: string | null;
  target: string | null;
  annualGoal: string | null; // Objetivo anual (para KPIs de ventas)
  unit: string | null;
  frequency: string | null;
  calculationMethod: string | null;
  responsible: string | null;
  source: string | null;
  period: string | null;
  createdAt: Date | null;
  invertedMetric?: boolean | null;
};

export const insertCompanyKpiValueSchema = z.object({
  companyId: companyIdSchema.optional(),
  kpiId: z.number().int().positive(),
  value: stringOrNumberToString,
  period: z.string().optional().nullable(),
  month: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  compliancePercentage: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  updatedBy: z.number().int().optional().nullable(),
});

export const insertKpiValueSchema = insertCompanyKpiValueSchema;
export type InsertKpiValue = z.infer<typeof insertKpiValueSchema>;
export type InsertCompanyKpiValue = InsertKpiValue;

export type KpiValue = {
  id: number;
  kpiId: number;
  companyId: CompanyId;
  value: string;
  period: string | null;
  month: string | null;
  year: number | null;
  date: Date | null;
  compliancePercentage: string | null;
  status: string | null;
  comments: string | null;
  updatedBy: number | null;
};

// Action Plan schema
export const actionPlans = pgTable("action_plans", {
  id: serial("id").primaryKey(),
  kpiId: integer("kpi_id").notNull(),
  problemDescription: text("problem_description").notNull(),
  correctiveActions: text("corrective_actions").notNull(),
  responsible: text("responsible").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull(), // pending, in_progress, completed
  results: text("results"),
});

export const insertActionPlanSchema = createInsertSchema(actionPlans).omit({ id: true });
export type InsertActionPlan = z.infer<typeof insertActionPlanSchema>;
export type ActionPlan = typeof actionPlans.$inferSelect;

// Extended schemas for frontend validation
export const loginSchema = z.object({
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// Schema para actualizar valores de KPIs con soporte para compliancePercentage y status
export const updateKpiValueSchema = insertKpiValueSchema.extend({
  compliancePercentage: z.string().optional(),
  status: z.string().optional(),
});

// Schema para actualizar KPIs (permite campos opcionales y convierte tipos)
export const updateKpiSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  areaId: z.number().int().positive().optional(),
  area: z.string().optional(),
  companyId: companyIdSchema.optional(),
  unit: z.string().optional(),
  target: stringOrNumberToString.optional(),
  goal: stringOrNumberToString.optional(),
  annualGoal: z.union([stringOrNumberToString, z.null()]).optional(), // Objetivo anual (para KPIs de ventas) - permite null para borrar
  frequency: z.string().optional(),
  calculationMethod: z.string().optional(),
  responsible: z.string().optional(),
  source: z.string().optional(),
  period: z.string().optional(),
  invertedMetric: z.boolean().optional(),
});

export const registerUserSchema = insertUserSchema.extend({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Shipments schema - Tabla para los envíos
export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  trackingCode: text("tracking_code").notNull().unique(), // Código de seguimiento
  companyId: integer("company_id").notNull(), // Empresa a la que pertenece el envío
  customerId: integer("customer_id"), // ID del cliente (relación con tabla clients) - nullable para compatibilidad
  customerName: text("customer_name").notNull(), // Nombre del cliente
  purchaseOrder: text("purchase_order").notNull(), // Orden de compra
  customerEmail: text("customer_email"), // Email del cliente para notificaciones
  customerPhone: text("customer_phone"), // Teléfono del cliente para notificaciones
  invoiceNumber: text("invoice_number"), // Número de factura (requerido para pasar a en tránsito)
  destination: text("destination").notNull(), // Destino del envío
  origin: text("origin").notNull(), // Origen del envío
  product: text("product").notNull(), // Producto que se envía
  quantity: text("quantity").notNull(), // Cantidad del producto
  unit: text("unit").notNull(), // Unidad de medida (KG, unidades, etc.)
  departureDate: timestamp("departure_date"), // Fecha de salida
  estimatedDeliveryDate: timestamp("estimated_delivery_date"), // Fecha estimada de entrega
  actualDeliveryDate: timestamp("actual_delivery_date"), // Fecha real de entrega
  status: shipmentStatusEnum("status").notNull().default('pending'), // Estado del envío
  carrier: text("carrier"), // Transportista
  vehicleInfo: text("vehicle_info"), // Información del vehículo
  vehicleType: text("vehicle_type"), // Tipo de vehículo (camión, cisterna, etc.)
  fuelType: text("fuel_type"), // Tipo de combustible (diesel, gasolina, etc.)
  distance: text("distance"), // Distancia en kilómetros
  carbonFootprint: text("carbon_footprint"), // Huella de carbono calculada (kg CO2e)
  driverName: text("driver_name"), // Nombre del conductor
  driverPhone: text("driver_phone"), // Teléfono del conductor
  comments: text("comments"), // Comentarios adicionales
  // KPIs de Logística
  transportCost: real("transport_cost"), // Costo de transporte (MXN)
  inRouteAt: timestamp("in_route_at"), // Timestamp automático cuando pasa a in_transit
  deliveredAt: timestamp("delivered_at"), // Timestamp automático cuando pasa a delivered
  createdAt: timestamp("created_at").defaultNow(), // Fecha de creación del registro
  updatedAt: timestamp("updated_at").defaultNow(), // Fecha de última actualización
  // Columnas legacy de versiones anteriores (mantener para compatibilidad)
  destinationLat: real("destination_lat"),
  destinationLng: real("destination_lng"),
  originLat: real("origin_lat"),
  originLng: real("origin_lng"),
  purchaseOrderNumber: text("purchase_order_number"),
  notificationEmails: json("notification_emails"),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;

// Shipment Items schema - Tabla para múltiples productos por envío
export const shipmentItems = pgTable("shipment_items", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull(), // Relación con el envío
  product: text("product").notNull(), // Nombre del producto
  quantity: text("quantity").notNull(), // Cantidad del producto
  unit: text("unit").notNull(), // Unidad de medida (KG, unidades, litros, etc.)
  description: text("description"), // Descripción adicional del producto
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShipmentItemSchema = createInsertSchema(shipmentItems).omit({ id: true, createdAt: true });
export type InsertShipmentItem = z.infer<typeof insertShipmentItemSchema>;
export type ShipmentItem = typeof shipmentItems.$inferSelect;

// Extended Shipment type with cycle times included (for N+1 query optimization)
export type ShipmentWithCycleTimes = Shipment & {
  cycleTimes?: {
    hoursTotalCycle?: string | null;
    hoursPendingToTransit?: string | null;
    hoursTransitToDelivered?: string | null;
    hoursDeliveredToClosed?: string | null;
    hoursToDelivery?: string | null;
    computedAt?: Date | string;
    updatedAt?: Date | string;
  } | null;
};

// Extended Shipment type with items
export type ShipmentWithItems = Shipment & {
  items?: ShipmentItem[];
};

// Shipment Updates schema - Tabla para las actualizaciones de estado de los envíos
export const shipmentUpdates = pgTable("shipment_updates", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull(), // Relación con el envío
  status: shipmentStatusEnum("status").notNull(), // Estado del envío en esta actualización
  location: text("location"), // Ubicación del envío al momento de la actualización
  comments: text("comments"), // Comentarios sobre la actualización
  updatedBy: integer("updated_by"), // Usuario que realizó la actualización
  timestamp: timestamp("timestamp").defaultNow(), // Fecha y hora de la actualización
});

export const insertShipmentUpdateSchema = createInsertSchema(shipmentUpdates).omit({ id: true, timestamp: true });
export type InsertShipmentUpdate = z.infer<typeof insertShipmentUpdateSchema>;
export type ShipmentUpdate = typeof shipmentUpdates.$inferSelect;

// Notifications schema - Para comunicación y mensajes del equipo
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // info, warning, success, announcement
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id"), // null means broadcast to all
  companyId: integer("company_id"), // null means all companies
  areaId: integer("area_id"), // null means all areas
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Shipment Notifications schema - Para el historial de notificaciones enviadas por email
export const shipmentNotifications = pgTable("shipment_notifications", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull(), // Relación con el envío
  emailTo: text("email_to").notNull(), // Email del destinatario
  subject: text("subject").notNull(), // Asunto del email
  status: text("status").notNull(), // sent, failed, pending
  sentAt: timestamp("sent_at").defaultNow(), // Fecha y hora del envío
  sentBy: integer("sent_by").notNull(), // Usuario que envió la notificación
  shipmentStatus: shipmentStatusEnum("shipment_status").notNull(), // Estado del envío al momento del envío
  errorMessage: text("error_message"), // Mensaje de error si falló el envío
});

export const insertShipmentNotificationSchema = createInsertSchema(shipmentNotifications).omit({ id: true, sentAt: true });
export type InsertShipmentNotification = z.infer<typeof insertShipmentNotificationSchema>;
export type ShipmentNotification = typeof shipmentNotifications.$inferSelect;

// Schema para actualizar el estado de un envío con notificación opcional
export const updateShipmentStatusSchema = z.object({
  status: z.enum(['pending', 'in_transit', 'delayed', 'delivered', 'cancelled']),
  sendNotification: z.boolean().default(true),
  comments: z.string().optional(),
  location: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

// Job Profiles schema - Para información detallada de cada puesto de trabajo
export const jobProfiles = pgTable("job_profiles", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull(), // Área a la que pertenece el puesto
  companyId: integer("company_id").notNull(), // Empresa a la que pertenece
  title: text("title").notNull(), // Título del puesto
  description: text("description").notNull(), // Descripción detallada del puesto
  mainActivities: json("main_activities").notNull(), // Array de actividades principales
  responsibilities: json("responsibilities").notNull(), // Array de responsabilidades
  kpiInstructions: json("kpi_instructions").notNull(), // Instrucciones sobre KPIs
  tips: json("tips").notNull(), // Tips para el éxito en el puesto
  processes: json("processes").notNull(), // Procesos y procedimientos
  updateFrequency: json("update_frequency").notNull(), // Frecuencia de actualización de KPIs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobProfileSchema = createInsertSchema(jobProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobProfile = z.infer<typeof insertJobProfileSchema>;
export type JobProfile = typeof jobProfiles.$inferSelect;

// Schema para obtener el perfil de trabajo completo con información relacionada
export const jobProfileWithDetails = z.object({
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
    instructions: z.string(),
  })),
  tips: z.array(z.object({
    category: z.string(),
    tip: z.string(),
  })),
  processes: z.array(z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
  })),
  updateFrequency: z.object({
    daily: z.array(z.string()),
    weekly: z.array(z.string()),
    monthly: z.array(z.string()),
  }),
  areaName: z.string(),
  companyName: z.string(),
  userKpis: z.array(z.object({
    id: z.number(),
    name: z.string(),
    target: z.string(),
    frequency: z.string(),
  })),
});

export type JobProfileWithDetails = z.infer<typeof jobProfileWithDetails>;

// Shipment Cycle Times schema - Para las métricas de tiempo de ciclo de los envíos
export const shipmentCycleTimes = pgTable("shipment_cycle_times", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().unique(), // Relación con el envío
  companyId: integer("company_id").notNull(), // Empresa del envío
  
  // Timestamps de cada fase
  createdAt: timestamp("created_at").notNull(), // Cuándo se creó el envío
  pendingAt: timestamp("pending_at"), // Primera vez que fue marcado como pendiente
  inTransitAt: timestamp("in_transit_at"), // Primera vez que fue marcado como en tránsito
  deliveredAt: timestamp("delivered_at"), // Primera vez que fue marcado como entregado
  closedAt: timestamp("closed_at"), // Primera vez que fue marcado como cerrado/cancelado
  
  // Duraciones calculadas en horas (decimal)
  hoursPendingToTransit: text("hours_pending_to_transit"), // Tiempo de despacho
  hoursTransitToDelivered: text("hours_transit_to_delivered"), // Tiempo de transporte
  hoursDeliveredToClosed: text("hours_delivered_to_closed"), // Tiempo de cierre
  hoursTotalCycle: text("hours_total_cycle"), // Tiempo total: creación → cierre
  hoursToDelivery: text("hours_to_delivery"), // Tiempo hasta entrega: creación → entregado
  
  // Metadata
  computedAt: timestamp("computed_at").defaultNow(), // Cuándo se calcularon las métricas
  updatedAt: timestamp("updated_at").defaultNow(), // Última actualización
});

export const insertShipmentCycleTimesSchema = createInsertSchema(shipmentCycleTimes).omit({ 
  id: true, 
  computedAt: true, 
  updatedAt: true 
});
export type InsertShipmentCycleTimes = z.infer<typeof insertShipmentCycleTimesSchema>;
export type ShipmentCycleTimes = typeof shipmentCycleTimes.$inferSelect;

// Schema para obtener métricas agregadas por período
export const cycleTimeMetricsSchema = z.object({
  period: z.string(), // 'day', 'week', 'month'
  startDate: z.string(),
  endDate: z.string(),
  companyId: z.number().optional(),
  avgPendingToTransit: z.number().nullable(),
  avgTransitToDelivered: z.number().nullable(), 
  avgDeliveredToClosed: z.number().nullable(),
  avgTotalCycle: z.number().nullable(),
  avgToDelivery: z.number().nullable(),
  totalShipments: z.number(),
  completedShipments: z.number(), // Envíos que llegaron a "cerrado"
});

export type CycleTimeMetrics = z.infer<typeof cycleTimeMetricsSchema>;

// Clients schema - Tabla para los clientes de ambas empresas (basada en estructura existente)
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nombre o razón social del cliente
  email: text("email").notNull(), // Email principal para notificaciones
  phone: text("phone"), // Teléfono del cliente
  contactPerson: text("contact_person"), // Nombre del contacto principal (campo existente)
  company: text("company"), // Empresa/organización del cliente (campo existente)
  address: text("address"), // Dirección del cliente
  paymentTerms: integer("payment_terms"), // Términos de pago (campo existente como integer)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  requiresReceipt: boolean("requires_receipt").default(true), // Si requiere acuse de recibo (campo existente)
  reminderFrequency: integer("reminder_frequency"), // Frecuencia de recordatorios (campo existente)
  isActive: boolean("is_active").default(true), // Cliente activo (campo existente)
  notes: text("notes"), // Notas adicionales (campo existente)
  // Nuevos campos que agregamos
  companyId: integer("company_id"), // Empresa a la que pertenece (Dura=1 o Orsega=2)
  clientCode: text("client_code"), // Código interno del cliente
  secondaryEmail: text("secondary_email"), // Email secundario opcional
  city: text("city"), // Ciudad
  state: text("state"), // Estado/Provincia
  postalCode: text("postal_code"), // Código postal
  country: text("country").default("México"), // País
  emailNotifications: boolean("email_notifications").default(true), // Si recibe notificaciones por email
  customerType: text("customer_type"), // Tipo de cliente (distribuidor, mayorista, etc.)
  requiresPaymentComplement: boolean("requires_payment_complement").default(false), // Si requiere complemento de pago para cerrar compras
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Provider schema - Proveedores de transporte (tabla existente)
export const providers = pgTable("provider", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  contactName: text("contact_name"),
  notes: text("notes"),
  rating: real("rating"),
  isActive: boolean("is_active").notNull().default(true),
  shortName: text("short_name"),
  companyId: integer("company_id"),
  location: text("location"), // NAC, EXT
  requiresRep: boolean("requires_rep").default(false),
  repFrequency: integer("rep_frequency"), // días
  reminderEmail: text("reminder_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProviderSchema = createInsertSchema(providers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Provider = typeof providers.$inferSelect;

// Suppliers schema - Proveedores de Tesorería (REP - Recordatorios de Pago)
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Proveedor (ej: "Transportes Potosinos")
  shortName: text("short_name"), // Nombre Corto (ej: "Potosinos")
  email: text("email"), // Contacto (correo)
  location: text("location"), // Ubicación (NAC, EXT)
  requiresRep: boolean("requires_rep").default(false), // REP (SI/NO)
  repFrequency: integer("rep_frequency"), // Frecuencia de recordatorio de REP (días)
  companyId: integer("company_id"), // 1 = Dura, 2 = Orsega
  isActive: boolean("is_active").default(true),
  notes: text("notes"), // Notas adicionales
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Products schema - Catálogo de productos de Dura y Orsega
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  companyId: integer("company_id").notNull(), // 1 = Dura, 2 = Orsega
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ============================================
// MÓDULO TESORERÍA - Lolita
// ============================================

// Enum para estados del flujo de comprobantes
// IMPORTANTE: Estos valores deben coincidir exactamente con el enum en la base de datos
// Ver migraciones/0000_quick_gateway.sql línea 2
export const voucherStatusEnum = pgEnum('voucher_status', [
  'pago_programado',         // Pago programado (factura subida, pendiente comprobante)
  'factura_pagada',          // Factura pagada (estado después de subir comprobante)
  'pendiente_complemento',   // Esperando complemento del proveedor (requiere REP)
  'complemento_recibido',    // Complemento ya subido
  'cierre_contable'          // Finalizado contablemente
]);

// Pagos Programados
export const scheduledPayments = pgTable("scheduled_payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id), // Nueva relación a suppliers
  supplierName: text("supplier_name"), // Mantener por retrocompatibilidad
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("MXN"), // MXN o USD
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("idrall_imported"), // Estados del ciclo: idrall_imported, pending_approval, approved, payment_scheduled, payment_pending, payment_completed, voucher_uploaded, closed
  reference: text("reference"), // Número de factura o referencia
  notes: text("notes"),
  // Campos para origen Idrall (nombres de columnas mantienen 'hydral' por compatibilidad con BD existente)
  sourceType: text("source_type").default("manual"), // 'idrall' | 'manual'
  hydralFileUrl: text("hydral_file_url"), // URL del archivo original de Idrall (columna mantiene nombre 'hydral' por compatibilidad)
  hydralFileName: text("hydral_file_name"), // Nombre del archivo de Idrall (columna mantiene nombre 'hydral' por compatibilidad)
  // Campos para aprobación y pago
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"), // user_id
  paymentScheduledAt: timestamp("payment_scheduled_at"), // Fecha programada de pago
  paymentDate: timestamp("payment_date"), // Fecha de pago (cuando se va a pagar) - obligatoria para facturas manuales
  paidAt: timestamp("paid_at"),
  paidBy: integer("paid_by"), // user_id
  // Vinculación con comprobante
  voucherId: integer("voucher_id").references(() => paymentVouchers.id), // ID del comprobante asociado (payment_voucher)
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduledPaymentSchema = createInsertSchema(scheduledPayments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledPayment = z.infer<typeof insertScheduledPaymentSchema>;
export type ScheduledPayment = typeof scheduledPayments.$inferSelect;

// Comprobantes de Pago
export const paymentReceipts = pgTable("payment_receipts", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").references(() => scheduledPayments.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Ruta al archivo
  fileType: text("file_type").notNull(), // xml, pdf
  uploadedBy: integer("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  sentTo: text("sent_to").array(), // Emails a los que se envió
  sentAt: timestamp("sent_at"),
});

export const insertPaymentReceiptSchema = createInsertSchema(paymentReceipts).omit({ id: true, uploadedAt: true });
export type InsertPaymentReceipt = z.infer<typeof insertPaymentReceiptSchema>;
export type PaymentReceipt = typeof paymentReceipts.$inferSelect;

// Complementos de Pago
export const paymentComplements = pgTable("payment_complements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  clientName: text("client_name").notNull(),
  invoiceReference: text("invoice_reference").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("MXN"),
  complementUrl: text("complement_url"), // URL del complemento generado
  status: text("status").notNull().default("pending"), // pending, generated, sent
  generatedAt: timestamp("generated_at"),
  sentAt: timestamp("sent_at"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentComplementSchema = createInsertSchema(paymentComplements).omit({ id: true, createdAt: true });
export type InsertPaymentComplement = z.infer<typeof insertPaymentComplementSchema>;
export type PaymentComplement = typeof paymentComplements.$inferSelect;

// Tipo de Cambio
export const exchangeRates = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull().defaultNow(),
  buyRate: real("buy_rate").notNull(), // Compra
  sellRate: real("sell_rate").notNull(), // Venta
  source: text("source"), // MONEX, Santander, DOF, etc.
  notes: text("notes"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, createdAt: true });
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;

// Comprobantes Bancarios (Payment Vouchers) - Sistema Kanban
export const paymentVouchers = pgTable("payment_vouchers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(), // Empresa del cliente/beneficiario
  payerCompanyId: integer("payer_company_id").notNull(), // Empresa pagadora (Orsega/Dura)
  clientId: integer("client_id").notNull(), // Cliente/beneficiario (payeeClientId)
  clientName: text("client_name").notNull(), // Nombre del cliente (denormalizado para búsqueda rápida)
  supplierId: integer("supplier_id"), // ID del proveedor (opcional)
  
  // Vinculación opcional a pago programado
  scheduledPaymentId: integer("scheduled_payment_id"), // Opcional
  
  // Estado del flujo Kanban
  status: voucherStatusEnum("status").notNull().default('factura_pagada'),
  
  // Archivos subidos
  voucherFileUrl: text("voucher_file_url").notNull(), // Comprobante bancario (obligatorio)
  voucherFileName: text("voucher_file_name").notNull(),
  voucherFileType: text("voucher_file_type").notNull(), // pdf, png, jpg, jpeg
  
  invoiceFileUrl: text("invoice_file_url"), // Factura (opcional)
  invoiceFileName: text("invoice_file_name"),
  invoiceFileType: text("invoice_file_type"),
  
  complementFileUrl: text("complement_file_url"), // Complemento de pago (opcional)
  complementFileName: text("complement_file_name"),
  complementFileType: text("complement_file_type"),
  
  // Datos extraídos automáticamente por OpenAI
  extractedAmount: real("extracted_amount"), // Monto detectado
  extractedDate: timestamp("extracted_date"), // Fecha del comprobante
  extractedBank: text("extracted_bank"), // Banco emisor
  extractedReference: text("extracted_reference"), // Número de referencia/folio
  extractedCurrency: text("extracted_currency"), // MXN, USD
  extractedOriginAccount: text("extracted_origin_account"), // Cuenta origen
  extractedDestinationAccount: text("extracted_destination_account"), // Cuenta destino
  extractedTrackingKey: text("extracted_tracking_key"), // Clave de rastreo (SPEI)
  extractedBeneficiaryName: text("extracted_beneficiary_name"), // Nombre del beneficiario
  ocrConfidence: real("ocr_confidence"), // Confianza del análisis (0-1)
  
  // Configuración de envío de correo
  notify: boolean("notify").default(false), // Si se debe enviar correo automáticamente
  emailTo: text("email_to").array(), // Emails principales (destinatarios)
  emailCc: text("email_cc").array(), // Emails en copia
  emailMessage: text("email_message"), // Mensaje personalizado para el correo
  
  // Vinculación con facturas
  linkedInvoiceId: integer("linked_invoice_id"), // ID de factura asociada (si existe)
  linkedInvoiceUuid: text("linked_invoice_uuid"), // UUID de factura asociada
  
  // Metadatos
  notes: text("notes"), // Notas adicionales de Lolita
  uploadedBy: integer("uploaded_by").notNull(), // Usuario que subió (Lolita)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  
  // Recordatorios automáticos
  lastReminderSent: timestamp("last_reminder_sent"), // Última vez que se envió recordatorio
  reminderCount: integer("reminder_count").default(0), // Cantidad de recordatorios enviados
});

export const insertPaymentVoucherSchema = createInsertSchema(paymentVouchers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPaymentVoucher = z.infer<typeof insertPaymentVoucherSchema>;
export type PaymentVoucher = typeof paymentVouchers.$inferSelect;

// Email Outbox - Tracking de envíos de correo
export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  voucherId: integer("voucher_id").references(() => paymentVouchers.id, { onDelete: "cascade" }),
  emailTo: text("email_to").notNull().array(), // Emails principales
  emailCc: text("email_cc").array(), // Emails en copia
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, failed
  messageId: text("message_id"), // ID del mensaje del proveedor de email (Resend/SendGrid)
  errorMessage: text("error_message"), // Mensaje de error si falla
  sentAt: timestamp("sent_at"), // Fecha de envío exitoso
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailOutboxSchema = createInsertSchema(emailOutbox).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailOutbox = z.infer<typeof insertEmailOutboxSchema>;
export type EmailOutbox = typeof emailOutbox.$inferSelect;

// KPI Detail type for dashboard components
export interface KpiDetail {
  id: number;
  name: string;
  status: 'complies' | 'alert' | 'not_compliant';
  value: string;
  target: string;
  compliancePercentage: string | null;
  period: string;
  comments: string | null;
}
