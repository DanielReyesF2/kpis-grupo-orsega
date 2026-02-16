/**
 * Comercial Module Storage
 * Database operations for CRM/Sales pipeline management
 */

import { db } from "../db";
import { eq, and, desc, asc, sql, isNull, gte, lte, inArray } from "drizzle-orm";
import {
  prospects,
  prospectActivities,
  prospectNotes,
  prospectMeetings,
  prospectDocuments,
  proposalVersions,
  followUpAlerts,
  scheduledReminders,
  type Prospect,
  type InsertProspect,
  type ProspectActivity,
  type InsertProspectActivity,
  type ProspectNote,
  type InsertProspectNote,
  type ProspectMeeting,
  type InsertProspectMeeting,
  type ProspectDocument,
  type InsertProspectDocument,
  type ProposalVersion,
  type InsertProposalVersion,
  type FollowUpAlert,
  type InsertFollowUpAlert,
  type ScheduledReminder,
  type InsertScheduledReminder,
  type LeadSourceReport,
  type SalesForecastItem,
  type WinLossAnalysisItem,
  type CompetitorAnalysisItem,
} from "@shared/schema";

// ============================================
// PROSPECTS CRUD
// ============================================

export async function getProspects(companyId: number, filters?: {
  stage?: string;
  priority?: string;
  assignedToId?: number;
  search?: string;
}): Promise<Prospect[]> {
  let query = db.select().from(prospects).where(eq(prospects.companyId, companyId));

  // Apply filters using raw SQL for complex conditions
  const conditions = [eq(prospects.companyId, companyId)];

  if (filters?.stage) {
    conditions.push(sql`${prospects.stage} = ${filters.stage}`);
  }
  if (filters?.priority) {
    conditions.push(sql`${prospects.priority} = ${filters.priority}`);
  }
  if (filters?.assignedToId) {
    conditions.push(eq(prospects.assignedToId, filters.assignedToId));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(sql`(LOWER(${prospects.companyName}) LIKE ${searchTerm} OR LOWER(${prospects.contactName}) LIKE ${searchTerm})`);
  }

  return db.select()
    .from(prospects)
    .where(and(...conditions))
    .orderBy(desc(prospects.updatedAt));
}

export async function getProspectById(id: number): Promise<Prospect | undefined> {
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id));
  return prospect;
}

export async function createProspect(data: InsertProspect): Promise<Prospect> {
  const [prospect] = await db.insert(prospects).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  return prospect;
}

export async function updateProspect(id: number, data: Partial<InsertProspect>): Promise<Prospect | undefined> {
  const [prospect] = await db.update(prospects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(prospects.id, id))
    .returning();
  return prospect;
}

export async function deleteProspect(id: number): Promise<boolean> {
  const result = await db.delete(prospects).where(eq(prospects.id, id));
  return true;
}

export async function changeProspectStage(
  id: number,
  stage: string,
  userId: number,
  closedReason?: string,
  lostToCompetitor?: string
): Promise<Prospect | undefined> {
  const [prospect] = await db.update(prospects)
    .set({
      stage: stage as any,
      closedReason,
      lostToCompetitor,
      updatedAt: new Date(),
    })
    .where(eq(prospects.id, id))
    .returning();

  // Log activity for stage change
  if (prospect) {
    await createProspectActivity({
      prospectId: id,
      type: "cambio_etapa",
      title: `Cambio a etapa: ${stage}`,
      description: closedReason ? `Razón: ${closedReason}` : undefined,
      metadata: { previousStage: prospect.stage, newStage: stage },
      createdById: userId,
    });
  }

  return prospect;
}

// ============================================
// PROSPECT ACTIVITIES (Timeline)
// ============================================

export async function getProspectActivities(prospectId: number): Promise<ProspectActivity[]> {
  return db.select()
    .from(prospectActivities)
    .where(eq(prospectActivities.prospectId, prospectId))
    .orderBy(desc(prospectActivities.createdAt));
}

export async function createProspectActivity(data: InsertProspectActivity): Promise<ProspectActivity> {
  const [activity] = await db.insert(prospectActivities).values({
    ...data,
    createdAt: new Date(),
  }).returning();

  // Update last contact on prospect
  await db.update(prospects)
    .set({ lastContactAt: new Date(), updatedAt: new Date() })
    .where(eq(prospects.id, data.prospectId));

  return activity;
}

// ============================================
// PROSPECT NOTES
// ============================================

export async function getProspectNotes(prospectId: number): Promise<ProspectNote[]> {
  return db.select()
    .from(prospectNotes)
    .where(eq(prospectNotes.prospectId, prospectId))
    .orderBy(desc(prospectNotes.isPinned), desc(prospectNotes.createdAt));
}

export async function createProspectNote(data: InsertProspectNote): Promise<ProspectNote> {
  const [note] = await db.insert(prospectNotes).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // Log activity
  await createProspectActivity({
    prospectId: data.prospectId,
    type: "nota",
    title: "Nueva nota agregada",
    description: data.content.substring(0, 100) + (data.content.length > 100 ? "..." : ""),
    createdById: data.createdById,
  });

  return note;
}

export async function updateProspectNote(id: number, content: string): Promise<ProspectNote | undefined> {
  const [note] = await db.update(prospectNotes)
    .set({ content, updatedAt: new Date() })
    .where(eq(prospectNotes.id, id))
    .returning();
  return note;
}

export async function deleteProspectNote(id: number): Promise<boolean> {
  await db.delete(prospectNotes).where(eq(prospectNotes.id, id));
  return true;
}

export async function toggleNotePin(id: number): Promise<ProspectNote | undefined> {
  const [note] = await db.select().from(prospectNotes).where(eq(prospectNotes.id, id));
  if (!note) return undefined;

  const [updated] = await db.update(prospectNotes)
    .set({ isPinned: !note.isPinned, updatedAt: new Date() })
    .where(eq(prospectNotes.id, id))
    .returning();
  return updated;
}

// ============================================
// PROSPECT MEETINGS
// ============================================

export async function getProspectMeetings(prospectId: number): Promise<ProspectMeeting[]> {
  return db.select()
    .from(prospectMeetings)
    .where(eq(prospectMeetings.prospectId, prospectId))
    .orderBy(desc(prospectMeetings.scheduledAt));
}

export async function getUpcomingMeetings(userId: number, days: number = 7): Promise<ProspectMeeting[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return db.select()
    .from(prospectMeetings)
    .where(and(
      eq(prospectMeetings.createdById, userId),
      gte(prospectMeetings.scheduledAt, now),
      lte(prospectMeetings.scheduledAt, futureDate),
      sql`${prospectMeetings.status} IN ('programada', 'reprogramada')`
    ))
    .orderBy(asc(prospectMeetings.scheduledAt));
}

export async function createProspectMeeting(data: InsertProspectMeeting): Promise<ProspectMeeting> {
  const [meeting] = await db.insert(prospectMeetings).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // Log activity
  await createProspectActivity({
    prospectId: data.prospectId,
    type: "reunion",
    title: `Reunión programada: ${data.title}`,
    description: `Fecha: ${new Date(data.scheduledAt).toLocaleString()}`,
    metadata: { meetingId: meeting.id },
    createdById: data.createdById,
  });

  return meeting;
}

export async function updateProspectMeeting(id: number, data: Partial<InsertProspectMeeting>): Promise<ProspectMeeting | undefined> {
  const [meeting] = await db.update(prospectMeetings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(prospectMeetings.id, id))
    .returning();
  return meeting;
}

export async function completeMeeting(id: number, outcome: string): Promise<ProspectMeeting | undefined> {
  const [meeting] = await db.select().from(prospectMeetings).where(eq(prospectMeetings.id, id));
  if (!meeting) return undefined;

  const [updated] = await db.update(prospectMeetings)
    .set({
      status: "completada" as any,
      outcome,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(prospectMeetings.id, id))
    .returning();

  // Log activity
  if (updated) {
    await createProspectActivity({
      prospectId: meeting.prospectId,
      type: "reunion",
      title: `Reunión completada: ${meeting.title}`,
      description: `Resultado: ${outcome}`,
      metadata: { meetingId: id, outcome },
      createdById: meeting.createdById,
    });
  }

  return updated;
}

export async function cancelMeeting(id: number, reason?: string): Promise<ProspectMeeting | undefined> {
  const [meeting] = await db.select().from(prospectMeetings).where(eq(prospectMeetings.id, id));
  if (!meeting) return undefined;

  const [updated] = await db.update(prospectMeetings)
    .set({
      status: "cancelada" as any,
      outcome: reason,
      updatedAt: new Date(),
    })
    .where(eq(prospectMeetings.id, id))
    .returning();

  return updated;
}

// ============================================
// PROSPECT DOCUMENTS
// ============================================

export async function getProspectDocuments(prospectId: number): Promise<ProspectDocument[]> {
  return db.select()
    .from(prospectDocuments)
    .where(eq(prospectDocuments.prospectId, prospectId))
    .orderBy(desc(prospectDocuments.createdAt));
}

export async function createProspectDocument(data: InsertProspectDocument): Promise<ProspectDocument> {
  const [document] = await db.insert(prospectDocuments).values({
    ...data,
    createdAt: new Date(),
  }).returning();

  // Log activity
  await createProspectActivity({
    prospectId: data.prospectId,
    type: "documento",
    title: `Documento subido: ${data.name}`,
    description: `Tipo: ${data.type}`,
    metadata: { documentId: document.id },
    createdById: data.uploadedById,
  });

  return document;
}

export async function deleteProspectDocument(id: number): Promise<boolean> {
  await db.delete(prospectDocuments).where(eq(prospectDocuments.id, id));
  return true;
}

// ============================================
// PROPOSAL VERSIONS
// ============================================

export async function getProposalVersions(prospectId: number): Promise<ProposalVersion[]> {
  return db.select()
    .from(proposalVersions)
    .where(eq(proposalVersions.prospectId, prospectId))
    .orderBy(desc(proposalVersions.version));
}

export async function createProposalVersion(data: InsertProposalVersion): Promise<ProposalVersion> {
  // Get next version number
  const [lastVersion] = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${proposalVersions.version}), 0)` })
    .from(proposalVersions)
    .where(eq(proposalVersions.prospectId, data.prospectId));

  const nextVersion = (lastVersion?.maxVersion || 0) + 1;

  const [proposal] = await db.insert(proposalVersions).values({
    ...data,
    version: nextVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // Update current proposal on prospect
  await db.update(prospects)
    .set({ currentProposalId: proposal.id, updatedAt: new Date() })
    .where(eq(prospects.id, data.prospectId));

  // Log activity
  await createProspectActivity({
    prospectId: data.prospectId,
    type: "propuesta",
    title: `Propuesta v${nextVersion} creada`,
    description: data.amount ? `Monto: $${data.amount}` : undefined,
    metadata: { proposalId: proposal.id, version: nextVersion },
    createdById: data.createdById,
  });

  return proposal;
}

export async function updateProposalVersion(id: number, data: Partial<InsertProposalVersion>): Promise<ProposalVersion | undefined> {
  const [proposal] = await db.update(proposalVersions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(proposalVersions.id, id))
    .returning();
  return proposal;
}

export async function sendProposal(id: number, userId: number): Promise<ProposalVersion | undefined> {
  const [proposal] = await db.select().from(proposalVersions).where(eq(proposalVersions.id, id));
  if (!proposal) return undefined;

  const now = new Date();
  const [updated] = await db.update(proposalVersions)
    .set({
      status: "enviada" as any,
      sentAt: now,
      sentById: userId,
      updatedAt: now,
    })
    .where(eq(proposalVersions.id, id))
    .returning();

  // Update prospect
  await db.update(prospects)
    .set({ proposalSentAt: now, stage: "propuesta" as any, updatedAt: now })
    .where(eq(prospects.id, proposal.prospectId));

  // Log activity
  await createProspectActivity({
    prospectId: proposal.prospectId,
    type: "propuesta",
    title: `Propuesta v${proposal.version} enviada`,
    metadata: { proposalId: id },
    createdById: userId,
  });

  return updated;
}

export async function changeProposalStatus(id: number, status: string, userId: number): Promise<ProposalVersion | undefined> {
  const [proposal] = await db.select().from(proposalVersions).where(eq(proposalVersions.id, id));
  if (!proposal) return undefined;

  const [updated] = await db.update(proposalVersions)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(proposalVersions.id, id))
    .returning();

  // If accepted, change prospect to won
  if (status === "aceptada") {
    await changeProspectStage(proposal.prospectId, "cerrado_ganado", userId);
  } else if (status === "rechazada") {
    await changeProspectStage(proposal.prospectId, "cerrado_perdido", userId, "Propuesta rechazada");
  }

  return updated;
}

// ============================================
// ALERTS
// ============================================

export async function getAlerts(userId: number, status?: string): Promise<FollowUpAlert[]> {
  const conditions = [eq(followUpAlerts.assignedToId, userId)];
  if (status) {
    conditions.push(sql`${followUpAlerts.status} = ${status}`);
  }

  return db.select()
    .from(followUpAlerts)
    .where(and(...conditions))
    .orderBy(desc(followUpAlerts.createdAt));
}

export async function getPendingAlertsCount(userId: number): Promise<number> {
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(followUpAlerts)
    .where(and(
      eq(followUpAlerts.assignedToId, userId),
      sql`${followUpAlerts.status} = 'pending'`
    ));
  return result?.count || 0;
}

export async function acknowledgeAlert(id: number, userId: number): Promise<FollowUpAlert | undefined> {
  const [alert] = await db.update(followUpAlerts)
    .set({
      status: "acknowledged" as any,
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    })
    .where(eq(followUpAlerts.id, id))
    .returning();
  return alert;
}

export async function dismissAlert(id: number): Promise<FollowUpAlert | undefined> {
  const [alert] = await db.update(followUpAlerts)
    .set({ status: "dismissed" as any })
    .where(eq(followUpAlerts.id, id))
    .returning();
  return alert;
}

export async function generateAlerts(companyId: number): Promise<FollowUpAlert[]> {
  const generatedAlerts: FollowUpAlert[] = [];
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get prospects with overdue follow-ups
  const overdueProspects = await db.select()
    .from(prospects)
    .where(and(
      eq(prospects.companyId, companyId),
      sql`${prospects.nextFollowUpAt} < ${now}`,
      sql`${prospects.stage} NOT IN ('cerrado_ganado', 'cerrado_perdido')`
    ));

  for (const prospect of overdueProspects) {
    const [existingAlert] = await db.select()
      .from(followUpAlerts)
      .where(and(
        eq(followUpAlerts.prospectId, prospect.id),
        sql`${followUpAlerts.alertType} = 'overdue_follow_up'`,
        sql`${followUpAlerts.status} = 'pending'`
      ));

    if (!existingAlert) {
      const [alert] = await db.insert(followUpAlerts).values({
        prospectId: prospect.id,
        alertType: "overdue_follow_up" as any,
        title: `Seguimiento vencido: ${prospect.companyName}`,
        message: `El seguimiento estaba programado para ${prospect.nextFollowUpAt?.toLocaleDateString()}`,
        priority: "alta" as any,
        dueDate: prospect.nextFollowUpAt,
        assignedToId: prospect.assignedToId,
        createdAt: new Date(),
      }).returning();
      generatedAlerts.push(alert);
    }
  }

  // Get stale prospects (no activity in 7+ days)
  const staleProspects = await db.select()
    .from(prospects)
    .where(and(
      eq(prospects.companyId, companyId),
      sql`${prospects.lastContactAt} < ${sevenDaysAgo}`,
      sql`${prospects.stage} NOT IN ('cerrado_ganado', 'cerrado_perdido')`
    ));

  for (const prospect of staleProspects) {
    const [existingAlert] = await db.select()
      .from(followUpAlerts)
      .where(and(
        eq(followUpAlerts.prospectId, prospect.id),
        sql`${followUpAlerts.alertType} = 'stale_prospect'`,
        sql`${followUpAlerts.status} = 'pending'`
      ));

    if (!existingAlert) {
      const [alert] = await db.insert(followUpAlerts).values({
        prospectId: prospect.id,
        alertType: "stale_prospect" as any,
        title: `Prospecto sin actividad: ${prospect.companyName}`,
        message: `No hay contacto desde ${prospect.lastContactAt?.toLocaleDateString()}`,
        priority: "media" as any,
        assignedToId: prospect.assignedToId,
        createdAt: new Date(),
      }).returning();
      generatedAlerts.push(alert);
    }
  }

  // Get high-value prospects at risk
  const highValueAtRisk = await db.select()
    .from(prospects)
    .where(and(
      eq(prospects.companyId, companyId),
      sql`${prospects.estimatedValue}::numeric > 100000`,
      sql`${prospects.lastContactAt} < ${threeDaysAgo}`,
      sql`${prospects.stage} IN ('propuesta', 'negociacion')`
    ));

  for (const prospect of highValueAtRisk) {
    const [existingAlert] = await db.select()
      .from(followUpAlerts)
      .where(and(
        eq(followUpAlerts.prospectId, prospect.id),
        sql`${followUpAlerts.alertType} = 'high_value_at_risk'`,
        sql`${followUpAlerts.status} = 'pending'`
      ));

    if (!existingAlert) {
      const [alert] = await db.insert(followUpAlerts).values({
        prospectId: prospect.id,
        alertType: "high_value_at_risk" as any,
        title: `Alto valor en riesgo: ${prospect.companyName}`,
        message: `Oportunidad de $${prospect.estimatedValue} sin seguimiento reciente`,
        priority: "urgente" as any,
        assignedToId: prospect.assignedToId,
        createdAt: new Date(),
      }).returning();
      generatedAlerts.push(alert);
    }
  }

  return generatedAlerts;
}

// ============================================
// REMINDERS
// ============================================

export async function getReminders(userId: number): Promise<ScheduledReminder[]> {
  return db.select()
    .from(scheduledReminders)
    .where(and(
      eq(scheduledReminders.userId, userId),
      eq(scheduledReminders.isActive, true)
    ))
    .orderBy(asc(scheduledReminders.reminderDate));
}

export async function createReminder(data: InsertScheduledReminder): Promise<ScheduledReminder> {
  const [reminder] = await db.insert(scheduledReminders).values({
    ...data,
    createdAt: new Date(),
  }).returning();
  return reminder;
}

export async function updateReminder(id: number, data: Partial<InsertScheduledReminder>): Promise<ScheduledReminder | undefined> {
  const [reminder] = await db.update(scheduledReminders)
    .set(data)
    .where(eq(scheduledReminders.id, id))
    .returning();
  return reminder;
}

export async function deleteReminder(id: number): Promise<boolean> {
  await db.delete(scheduledReminders).where(eq(scheduledReminders.id, id));
  return true;
}

// ============================================
// REPORTS & ANALYTICS
// ============================================

export async function getLeadSourcesReport(companyId: number): Promise<LeadSourceReport[]> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(source, 'sin_fuente') as source,
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE stage = 'cerrado_ganado') as converted_leads,
      COALESCE(SUM(estimated_value::numeric), 0) as total_value
    FROM prospects
    WHERE company_id = ${companyId}
    GROUP BY source
    ORDER BY total_leads DESC
  `);

  return (result.rows as any[]).map(row => ({
    source: row.source,
    totalLeads: parseInt(row.total_leads),
    convertedLeads: parseInt(row.converted_leads),
    conversionRate: row.total_leads > 0 ? (row.converted_leads / row.total_leads) * 100 : 0,
    totalValue: parseFloat(row.total_value) || 0,
  }));
}

export async function getSalesForecast(companyId: number): Promise<SalesForecastItem[]> {
  const result = await db.execute(sql`
    SELECT
      EXTRACT(MONTH FROM estimated_close_date) as month,
      EXTRACT(YEAR FROM estimated_close_date) as year,
      COUNT(*) as count,
      COALESCE(SUM(estimated_value::numeric), 0) as total_value,
      COALESCE(SUM(estimated_value::numeric * probability / 100), 0) as weighted_value
    FROM prospects
    WHERE company_id = ${companyId}
      AND stage NOT IN ('cerrado_ganado', 'cerrado_perdido')
      AND estimated_close_date IS NOT NULL
      AND estimated_close_date >= CURRENT_DATE
    GROUP BY EXTRACT(YEAR FROM estimated_close_date), EXTRACT(MONTH FROM estimated_close_date)
    ORDER BY year, month
  `);

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return (result.rows as any[]).map(row => ({
    month: monthNames[parseInt(row.month) - 1],
    year: parseInt(row.year),
    count: parseInt(row.count),
    totalValue: parseFloat(row.total_value) || 0,
    weightedValue: parseFloat(row.weighted_value) || 0,
  }));
}

export async function getWinLossAnalysis(companyId: number): Promise<{ wins: WinLossAnalysisItem[], losses: WinLossAnalysisItem[], winRate: number }> {
  // Win analysis
  const winsResult = await db.execute(sql`
    SELECT
      'Ganado' as reason,
      COUNT(*) as count,
      COALESCE(SUM(estimated_value::numeric), 0) as total_value
    FROM prospects
    WHERE company_id = ${companyId}
      AND stage = 'cerrado_ganado'
  `);

  // Loss analysis by reason
  const lossesResult = await db.execute(sql`
    SELECT
      COALESCE(closed_reason, 'Sin especificar') as reason,
      COUNT(*) as count,
      COALESCE(SUM(estimated_value::numeric), 0) as total_value
    FROM prospects
    WHERE company_id = ${companyId}
      AND stage = 'cerrado_perdido'
    GROUP BY closed_reason
    ORDER BY count DESC
  `);

  // Total for percentages
  const totalResult = await db.execute(sql`
    SELECT COUNT(*) as total
    FROM prospects
    WHERE company_id = ${companyId}
      AND stage IN ('cerrado_ganado', 'cerrado_perdido')
  `);

  const total = parseInt((totalResult.rows[0] as any)?.total || 0);
  const winsCount = parseInt((winsResult.rows[0] as any)?.count || 0);

  const wins = (winsResult.rows as any[]).map(row => ({
    reason: row.reason,
    count: parseInt(row.count),
    totalValue: parseFloat(row.total_value) || 0,
    percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0,
  }));

  const losses = (lossesResult.rows as any[]).map(row => ({
    reason: row.reason,
    count: parseInt(row.count),
    totalValue: parseFloat(row.total_value) || 0,
    percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0,
  }));

  return {
    wins,
    losses,
    winRate: total > 0 ? (winsCount / total) * 100 : 0,
  };
}

export async function getCompetitorAnalysis(companyId: number): Promise<CompetitorAnalysisItem[]> {
  const result = await db.execute(sql`
    WITH unnested AS (
      SELECT
        unnest(competitors) as competitor,
        stage,
        lost_to_competitor
      FROM prospects
      WHERE company_id = ${companyId}
        AND competitors IS NOT NULL
    )
    SELECT
      competitor,
      COUNT(*) as mentions,
      COUNT(*) FILTER (WHERE stage = 'cerrado_ganado') as wins,
      COUNT(*) FILTER (WHERE stage = 'cerrado_perdido' AND lost_to_competitor = competitor) as losses
    FROM unnested
    GROUP BY competitor
    ORDER BY mentions DESC
  `);

  return (result.rows as any[]).map(row => {
    const wins = parseInt(row.wins);
    const losses = parseInt(row.losses);
    const total = wins + losses;
    return {
      competitor: row.competitor,
      mentions: parseInt(row.mentions),
      wins,
      losses,
      winRate: total > 0 ? (wins / total) * 100 : 0,
    };
  });
}

// ============================================
// PIPELINE STATS
// ============================================

export async function getPipelineStats(companyId: number): Promise<{
  byStage: { stage: string; count: number; value: number }[];
  totalValue: number;
  totalProspects: number;
  weightedPipeline: number;
}> {
  const result = await db.execute(sql`
    SELECT
      stage,
      COUNT(*) as count,
      COALESCE(SUM(estimated_value::numeric), 0) as value,
      COALESCE(SUM(estimated_value::numeric * probability / 100), 0) as weighted_value
    FROM prospects
    WHERE company_id = ${companyId}
      AND stage NOT IN ('cerrado_ganado', 'cerrado_perdido')
    GROUP BY stage
    ORDER BY
      CASE stage
        WHEN 'lead' THEN 1
        WHEN 'contactado' THEN 2
        WHEN 'calificado' THEN 3
        WHEN 'propuesta' THEN 4
        WHEN 'negociacion' THEN 5
        ELSE 6
      END
  `);

  const byStage = (result.rows as any[]).map(row => ({
    stage: row.stage,
    count: parseInt(row.count),
    value: parseFloat(row.value) || 0,
  }));

  const totalValue = byStage.reduce((sum, s) => sum + s.value, 0);
  const totalProspects = byStage.reduce((sum, s) => sum + s.count, 0);
  const weightedPipeline = (result.rows as any[]).reduce((sum, row) => sum + (parseFloat(row.weighted_value) || 0), 0);

  return { byStage, totalValue, totalProspects, weightedPipeline };
}
