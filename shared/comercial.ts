import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

// ============================================================
// MÓDULO COMERCIAL - CRM para gestión de residuos B2B
// ============================================================

// ============================================
// ENUMS
// ============================================

// Enum para fuente de leads
export const leadSourceEnum = pgEnum("lead_source", [
  "referido", "web", "llamada_fria", "evento", "linkedin", "email_marketing", "otro"
]);

// Enum para estado de prospectos
export const prospectStageEnum = pgEnum("prospect_stage", [
  "lead", "contactado", "calificado", "propuesta", "negociacion", "cerrado_ganado", "cerrado_perdido"
]);

// Enum para prioridad
export const priorityEnum = pgEnum("priority", [
  "baja", "media", "alta", "urgente"
]);

// Enum para tipo de actividad
export const activityTypeEnum = pgEnum("activity_type", [
  "llamada", "email", "reunion", "nota", "cambio_etapa", "documento", "propuesta", "otro"
]);

// Enum para estado de reunión
export const meetingStatusEnum = pgEnum("meeting_status", [
  "programada", "completada", "cancelada", "reprogramada"
]);

// Enum para estado de propuesta
export const proposalStatusEnum = pgEnum("proposal_status", [
  "borrador", "enviada", "revisada", "aceptada", "rechazada"
]);

// Enum para estado de alerta
export const alertStatusEnum = pgEnum("alert_status", [
  "pending", "acknowledged", "dismissed", "auto_resolved"
]);

// Enum para tipo de alerta
export const alertTypeEnum = pgEnum("alert_type", [
  "overdue_follow_up", "stale_prospect", "high_value_at_risk", "scheduled_reminder"
]);

// Enum para frecuencia de recordatorio
export const reminderFrequencyEnum = pgEnum("reminder_frequency", [
  "once", "daily", "weekly", "monthly"
]);

// ============================================
// TABLAS BASE
// ============================================

// Prospectos - Clientes potenciales
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(), // Empresa Dura=1 o Orsega=2

  // Información del contacto
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactPosition: text("contact_position"),

  // Información de la empresa prospecto
  companyName: text("company_name").notNull(),
  industry: text("industry"),
  employeeCount: text("employee_count"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  state: text("state"),

  // Estado y seguimiento
  stage: prospectStageEnum("stage").notNull().default("lead"),
  priority: priorityEnum("priority").default("media"),
  source: leadSourceEnum("source"),

  // Valor y oportunidad
  estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
  estimatedCloseDate: timestamp("estimated_close_date"),
  probability: integer("probability").default(50), // 0-100%

  // Servicios de interés (específicos de gestión de residuos)
  wasteTypes: text("waste_types").array(), // ["peligrosos", "no peligrosos", "reciclables"]
  servicesInterested: text("services_interested").array(), // ["recoleccion", "tratamiento", "disposicion", "reciclaje"]
  estimatedVolume: text("estimated_volume"), // Volumen mensual estimado

  // Competencia
  competitors: text("competitors").array(), // ["Veolia", "PASA", "Red Ambiental"]
  currentProvider: text("current_provider"),

  // Propuestas
  proposalSentAt: timestamp("proposal_sent_at"),
  currentProposalId: integer("current_proposal_id"),

  // Resultado (si cerrado)
  closedReason: text("closed_reason"),
  lostToCompetitor: text("lost_to_competitor"),

  // Asignación
  assignedToId: integer("assigned_to_id").references(() => users.id),

  // Fechas de seguimiento
  lastContactAt: timestamp("last_contact_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),

  // Metadata
  notes: text("notes"),
  tags: text("tags").array(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospects.$inferSelect;

// ============================================
// FASE 1: Timeline, Notas, Reuniones
// ============================================

// Actividades del prospecto (Timeline)
export const prospectActivities = pgTable("prospect_activities", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  type: activityTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"), // Datos adicionales según el tipo
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProspectActivitySchema = createInsertSchema(prospectActivities).omit({
  id: true,
  createdAt: true
});
export type InsertProspectActivity = z.infer<typeof insertProspectActivitySchema>;
export type ProspectActivity = typeof prospectActivities.$inferSelect;

// Notas del prospecto
export const prospectNotes = pgTable("prospect_notes", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProspectNoteSchema = createInsertSchema(prospectNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertProspectNote = z.infer<typeof insertProspectNoteSchema>;
export type ProspectNote = typeof prospectNotes.$inferSelect;

// Reuniones del prospecto
export const prospectMeetings = pgTable("prospect_meetings", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(60), // minutos
  location: text("location"),
  meetingUrl: text("meeting_url"),
  status: meetingStatusEnum("status").default("programada"),
  attendees: jsonb("attendees"), // [{name, email}]
  outcome: text("outcome"),
  completedAt: timestamp("completed_at"),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProspectMeetingSchema = createInsertSchema(prospectMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertProspectMeeting = z.infer<typeof insertProspectMeetingSchema>;
export type ProspectMeeting = typeof prospectMeetings.$inferSelect;

// ============================================
// FASE 2: Documentos y Propuestas
// ============================================

// Documentos del prospecto
export const prospectDocuments = pgTable("prospect_documents", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "contrato", "cotizacion", "presentacion", "otro"
  url: text("url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  description: text("description"),
  uploadedById: integer("uploaded_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProspectDocumentSchema = createInsertSchema(prospectDocuments).omit({
  id: true,
  createdAt: true
});
export type InsertProspectDocument = z.infer<typeof insertProspectDocumentSchema>;
export type ProspectDocument = typeof prospectDocuments.$inferSelect;

// Versiones de propuestas
export const proposalVersions = pgTable("proposal_versions", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  url: text("url").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  validUntil: timestamp("valid_until"),
  status: proposalStatusEnum("status").default("borrador"),
  notes: text("notes"),
  sentAt: timestamp("sent_at"),
  sentById: integer("sent_by_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProposalVersionSchema = createInsertSchema(proposalVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export type InsertProposalVersion = z.infer<typeof insertProposalVersionSchema>;
export type ProposalVersion = typeof proposalVersions.$inferSelect;

// ============================================
// FASE 4: Alertas y Recordatorios
// ============================================

// Alertas de seguimiento
export const followUpAlerts = pgTable("follow_up_alerts", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  alertType: alertTypeEnum("alert_type").notNull(),
  status: alertStatusEnum("status").default("pending"),
  title: text("title").notNull(),
  message: text("message"),
  priority: priorityEnum("priority").default("media"),
  dueDate: timestamp("due_date"),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedById: integer("acknowledged_by_id").references(() => users.id),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFollowUpAlertSchema = createInsertSchema(followUpAlerts).omit({
  id: true,
  createdAt: true
});
export type InsertFollowUpAlert = z.infer<typeof insertFollowUpAlertSchema>;
export type FollowUpAlert = typeof followUpAlerts.$inferSelect;

// Recordatorios programados
export const scheduledReminders = pgTable("scheduled_reminders", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  reminderDate: timestamp("reminder_date").notNull(),
  frequency: reminderFrequencyEnum("frequency").default("once"),
  isActive: boolean("is_active").default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScheduledReminderSchema = createInsertSchema(scheduledReminders).omit({
  id: true,
  createdAt: true
});
export type InsertScheduledReminder = z.infer<typeof insertScheduledReminderSchema>;
export type ScheduledReminder = typeof scheduledReminders.$inferSelect;

// ============================================
// TIPOS PARA REPORTES
// ============================================

export interface LeadSourceReport {
  source: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalValue: number;
}

export interface SalesForecastItem {
  month: string;
  year: number;
  count: number;
  totalValue: number;
  weightedValue: number;
}

export interface WinLossAnalysisItem {
  reason: string;
  count: number;
  totalValue: number;
  percentage: number;
}

export interface CompetitorAnalysisItem {
  competitor: string;
  mentions: number;
  wins: number;
  losses: number;
  winRate: number;
}

// ============================================
// SCHEMAS DE VALIDACIÓN ADICIONALES
// ============================================

// Schema para actualizar prospecto
export const updateProspectSchema = insertProspectSchema.partial();
export type UpdateProspect = z.infer<typeof updateProspectSchema>;

// Schema para cambio de etapa
export const changeStageSchema = z.object({
  stage: z.enum(["lead", "contactado", "calificado", "propuesta", "negociacion", "cerrado_ganado", "cerrado_perdido"]),
  closedReason: z.string().optional(),
  lostToCompetitor: z.string().optional(),
});
export type ChangeStage = z.infer<typeof changeStageSchema>;

// Schema para completar reunión
export const completeMeetingSchema = z.object({
  outcome: z.string().min(1, "El resultado es requerido"),
});
export type CompleteMeeting = z.infer<typeof completeMeetingSchema>;

// Schema para enviar propuesta
export const sendProposalSchema = z.object({
  sentAt: z.string().datetime().optional(),
});
export type SendProposal = z.infer<typeof sendProposalSchema>;

// Schema para cambiar estado de propuesta
export const changeProposalStatusSchema = z.object({
  status: z.enum(["borrador", "enviada", "revisada", "aceptada", "rechazada"]),
});
export type ChangeProposalStatus = z.infer<typeof changeProposalStatusSchema>;
