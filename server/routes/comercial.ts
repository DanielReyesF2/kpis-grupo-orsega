/**
 * Comercial Routes - CRM/Sales Pipeline Management
 * Endpoints for prospects, activities, notes, meetings, documents, proposals, alerts, and reports
 */

import { Router } from 'express';
import { z } from 'zod';
import { jwtAuthMiddleware } from '../auth';
import { getAuthUser, type AuthRequest } from './_helpers';
import { logger } from '../logger';
import {
  insertProspectSchema,
  insertProspectActivitySchema,
  insertProspectNoteSchema,
  insertProspectMeetingSchema,
  insertProspectDocumentSchema,
  insertProposalVersionSchema,
  insertScheduledReminderSchema,
  changeStageSchema,
  completeMeetingSchema,
  changeProposalStatusSchema,
} from '@shared/schema';
import * as comercialStorage from '../storage/comercial';

const router = Router();

// All routes require authentication
router.use(jwtAuthMiddleware);

// ============================================
// PROSPECTS CRUD
// ============================================

// List prospects with filters
router.get('/api/comercial/prospects', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const { stage, priority, assignedToId, search } = req.query;

    const prospects = await comercialStorage.getProspects(companyId, {
      stage: stage as string | undefined,
      priority: priority as string | undefined,
      assignedToId: assignedToId ? parseInt(assignedToId as string) : undefined,
      search: search as string | undefined,
    });

    res.json(prospects);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects] Error', error);
    res.status(500).json({ message: 'Error al obtener prospectos' });
  }
});

// Get single prospect
router.get('/api/comercial/prospects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const prospect = await comercialStorage.getProspectById(id);

    if (!prospect) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    res.json(prospect);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id] Error', error);
    res.status(500).json({ message: 'Error al obtener prospecto' });
  }
});

// Create prospect
router.post('/api/comercial/prospects', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);

    const validatedData = insertProspectSchema.parse({
      ...req.body,
      companyId: user.companyId || 1,
      createdById: user.id,
    });

    const prospect = await comercialStorage.createProspect(validatedData);
    res.status(201).json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects] Error', error);
    res.status(500).json({ message: 'Error al crear prospecto' });
  }
});

// Update prospect
router.patch('/api/comercial/prospects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const prospect = await comercialStorage.updateProspect(id, req.body);

    if (!prospect) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    res.json(prospect);
  } catch (error) {
    logger.error('[PATCH /api/comercial/prospects/:id] Error', error);
    res.status(500).json({ message: 'Error al actualizar prospecto' });
  }
});

// Delete prospect
router.delete('/api/comercial/prospects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comercialStorage.deleteProspect(id);
    res.status(204).send();
  } catch (error) {
    logger.error('[DELETE /api/comercial/prospects/:id] Error', error);
    res.status(500).json({ message: 'Error al eliminar prospecto' });
  }
});

// Change prospect stage
router.post('/api/comercial/prospects/:id/stage', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const id = parseInt(req.params.id);

    const { stage, closedReason, lostToCompetitor } = changeStageSchema.parse(req.body);

    const prospect = await comercialStorage.changeProspectStage(
      id,
      stage,
      user.id,
      closedReason,
      lostToCompetitor
    );

    if (!prospect) {
      return res.status(404).json({ message: 'Prospecto no encontrado' });
    }

    res.json(prospect);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/stage] Error', error);
    res.status(500).json({ message: 'Error al cambiar etapa' });
  }
});

// ============================================
// PROSPECT ACTIVITIES (Timeline)
// ============================================

// Get prospect activities
router.get('/api/comercial/prospects/:id/activities', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const activities = await comercialStorage.getProspectActivities(prospectId);
    res.json(activities);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id/activities] Error', error);
    res.status(500).json({ message: 'Error al obtener actividades' });
  }
});

// Create activity manually
router.post('/api/comercial/prospects/:id/activities', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const prospectId = parseInt(req.params.id);

    const validatedData = insertProspectActivitySchema.parse({
      ...req.body,
      prospectId,
      createdById: user.id,
    });

    const activity = await comercialStorage.createProspectActivity(validatedData);
    res.status(201).json(activity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/activities] Error', error);
    res.status(500).json({ message: 'Error al crear actividad' });
  }
});

// ============================================
// PROSPECT NOTES
// ============================================

// Get prospect notes
router.get('/api/comercial/prospects/:id/notes', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const notes = await comercialStorage.getProspectNotes(prospectId);
    res.json(notes);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id/notes] Error', error);
    res.status(500).json({ message: 'Error al obtener notas' });
  }
});

// Create note
router.post('/api/comercial/prospects/:id/notes', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const prospectId = parseInt(req.params.id);

    const validatedData = insertProspectNoteSchema.parse({
      ...req.body,
      prospectId,
      createdById: user.id,
    });

    const note = await comercialStorage.createProspectNote(validatedData);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/notes] Error', error);
    res.status(500).json({ message: 'Error al crear nota' });
  }
});

// Update note
router.patch('/api/comercial/prospects/:prospectId/notes/:noteId', async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'El contenido es requerido' });
    }

    const note = await comercialStorage.updateProspectNote(noteId, content);

    if (!note) {
      return res.status(404).json({ message: 'Nota no encontrada' });
    }

    res.json(note);
  } catch (error) {
    logger.error('[PATCH /api/comercial/prospects/:id/notes/:noteId] Error', error);
    res.status(500).json({ message: 'Error al actualizar nota' });
  }
});

// Delete note
router.delete('/api/comercial/prospects/:prospectId/notes/:noteId', async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId);
    await comercialStorage.deleteProspectNote(noteId);
    res.status(204).send();
  } catch (error) {
    logger.error('[DELETE /api/comercial/prospects/:id/notes/:noteId] Error', error);
    res.status(500).json({ message: 'Error al eliminar nota' });
  }
});

// Toggle note pin
router.post('/api/comercial/prospects/:prospectId/notes/:noteId/toggle-pin', async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId);
    const note = await comercialStorage.toggleNotePin(noteId);

    if (!note) {
      return res.status(404).json({ message: 'Nota no encontrada' });
    }

    res.json(note);
  } catch (error) {
    logger.error('[POST /api/comercial/prospects/:id/notes/:noteId/toggle-pin] Error', error);
    res.status(500).json({ message: 'Error al cambiar pin de nota' });
  }
});

// ============================================
// PROSPECT MEETINGS
// ============================================

// Get prospect meetings
router.get('/api/comercial/prospects/:id/meetings', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const meetings = await comercialStorage.getProspectMeetings(prospectId);
    res.json(meetings);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id/meetings] Error', error);
    res.status(500).json({ message: 'Error al obtener reuniones' });
  }
});

// Get upcoming meetings for user
router.get('/api/comercial/meetings/upcoming', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const days = parseInt(req.query.days as string) || 7;

    const meetings = await comercialStorage.getUpcomingMeetings(user.id, days);
    res.json(meetings);
  } catch (error) {
    logger.error('[GET /api/comercial/meetings/upcoming] Error', error);
    res.status(500).json({ message: 'Error al obtener reuniones próximas' });
  }
});

// Create meeting
router.post('/api/comercial/prospects/:id/meetings', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const prospectId = parseInt(req.params.id);

    const validatedData = insertProspectMeetingSchema.parse({
      ...req.body,
      prospectId,
      createdById: user.id,
    });

    const meeting = await comercialStorage.createProspectMeeting(validatedData);
    res.status(201).json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/meetings] Error', error);
    res.status(500).json({ message: 'Error al crear reunión' });
  }
});

// Update meeting
router.patch('/api/comercial/prospects/:prospectId/meetings/:meetingId', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const meeting = await comercialStorage.updateProspectMeeting(meetingId, req.body);

    if (!meeting) {
      return res.status(404).json({ message: 'Reunión no encontrada' });
    }

    res.json(meeting);
  } catch (error) {
    logger.error('[PATCH /api/comercial/prospects/:id/meetings/:meetingId] Error', error);
    res.status(500).json({ message: 'Error al actualizar reunión' });
  }
});

// Complete meeting
router.post('/api/comercial/prospects/:prospectId/meetings/:meetingId/complete', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const { outcome } = completeMeetingSchema.parse(req.body);

    const meeting = await comercialStorage.completeMeeting(meetingId, outcome);

    if (!meeting) {
      return res.status(404).json({ message: 'Reunión no encontrada' });
    }

    res.json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/meetings/:meetingId/complete] Error', error);
    res.status(500).json({ message: 'Error al completar reunión' });
  }
});

// Cancel meeting
router.post('/api/comercial/prospects/:prospectId/meetings/:meetingId/cancel', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId);
    const { reason } = req.body;

    const meeting = await comercialStorage.cancelMeeting(meetingId, reason);

    if (!meeting) {
      return res.status(404).json({ message: 'Reunión no encontrada' });
    }

    res.json(meeting);
  } catch (error) {
    logger.error('[POST /api/comercial/prospects/:id/meetings/:meetingId/cancel] Error', error);
    res.status(500).json({ message: 'Error al cancelar reunión' });
  }
});

// ============================================
// PROSPECT DOCUMENTS
// ============================================

// Get prospect documents
router.get('/api/comercial/prospects/:id/documents', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const documents = await comercialStorage.getProspectDocuments(prospectId);
    res.json(documents);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id/documents] Error', error);
    res.status(500).json({ message: 'Error al obtener documentos' });
  }
});

// Create document reference
router.post('/api/comercial/prospects/:id/documents', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const prospectId = parseInt(req.params.id);

    const validatedData = insertProspectDocumentSchema.parse({
      ...req.body,
      prospectId,
      uploadedById: user.id,
    });

    const document = await comercialStorage.createProspectDocument(validatedData);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/documents] Error', error);
    res.status(500).json({ message: 'Error al crear documento' });
  }
});

// Delete document
router.delete('/api/comercial/prospects/:prospectId/documents/:docId', async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    await comercialStorage.deleteProspectDocument(docId);
    res.status(204).send();
  } catch (error) {
    logger.error('[DELETE /api/comercial/prospects/:id/documents/:docId] Error', error);
    res.status(500).json({ message: 'Error al eliminar documento' });
  }
});

// ============================================
// PROPOSAL VERSIONS
// ============================================

// Get proposal versions
router.get('/api/comercial/prospects/:id/proposals', async (req, res) => {
  try {
    const prospectId = parseInt(req.params.id);
    const proposals = await comercialStorage.getProposalVersions(prospectId);
    res.json(proposals);
  } catch (error) {
    logger.error('[GET /api/comercial/prospects/:id/proposals] Error', error);
    res.status(500).json({ message: 'Error al obtener propuestas' });
  }
});

// Create proposal version
router.post('/api/comercial/prospects/:id/proposals', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const prospectId = parseInt(req.params.id);

    const validatedData = insertProposalVersionSchema.parse({
      ...req.body,
      prospectId,
      createdById: user.id,
    });

    const proposal = await comercialStorage.createProposalVersion(validatedData);
    res.status(201).json(proposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/proposals] Error', error);
    res.status(500).json({ message: 'Error al crear propuesta' });
  }
});

// Update proposal
router.patch('/api/comercial/prospects/:prospectId/proposals/:proposalId', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    const proposal = await comercialStorage.updateProposalVersion(proposalId, req.body);

    if (!proposal) {
      return res.status(404).json({ message: 'Propuesta no encontrada' });
    }

    res.json(proposal);
  } catch (error) {
    logger.error('[PATCH /api/comercial/prospects/:id/proposals/:proposalId] Error', error);
    res.status(500).json({ message: 'Error al actualizar propuesta' });
  }
});

// Send proposal
router.post('/api/comercial/prospects/:prospectId/proposals/:proposalId/send', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const proposalId = parseInt(req.params.proposalId);

    const proposal = await comercialStorage.sendProposal(proposalId, user.id);

    if (!proposal) {
      return res.status(404).json({ message: 'Propuesta no encontrada' });
    }

    res.json(proposal);
  } catch (error) {
    logger.error('[POST /api/comercial/prospects/:id/proposals/:proposalId/send] Error', error);
    res.status(500).json({ message: 'Error al enviar propuesta' });
  }
});

// Change proposal status
router.post('/api/comercial/prospects/:prospectId/proposals/:proposalId/status', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const proposalId = parseInt(req.params.proposalId);

    const { status } = changeProposalStatusSchema.parse(req.body);
    const proposal = await comercialStorage.changeProposalStatus(proposalId, status, user.id);

    if (!proposal) {
      return res.status(404).json({ message: 'Propuesta no encontrada' });
    }

    res.json(proposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/prospects/:id/proposals/:proposalId/status] Error', error);
    res.status(500).json({ message: 'Error al cambiar estado de propuesta' });
  }
});

// ============================================
// ALERTS
// ============================================

// Get user alerts
router.get('/api/comercial/alerts', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const status = req.query.status as string | undefined;

    const alerts = await comercialStorage.getAlerts(user.id, status);
    res.json(alerts);
  } catch (error) {
    logger.error('[GET /api/comercial/alerts] Error', error);
    res.status(500).json({ message: 'Error al obtener alertas' });
  }
});

// Get pending alerts count
router.get('/api/comercial/alerts/count', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);

    const count = await comercialStorage.getPendingAlertsCount(user.id);
    res.json({ count });
  } catch (error) {
    logger.error('[GET /api/comercial/alerts/count] Error', error);
    res.status(500).json({ message: 'Error al obtener conteo de alertas' });
  }
});

// Acknowledge alert
router.post('/api/comercial/alerts/:id/acknowledge', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const id = parseInt(req.params.id);

    const alert = await comercialStorage.acknowledgeAlert(id, user.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alerta no encontrada' });
    }

    res.json(alert);
  } catch (error) {
    logger.error('[POST /api/comercial/alerts/:id/acknowledge] Error', error);
    res.status(500).json({ message: 'Error al reconocer alerta' });
  }
});

// Dismiss alert
router.post('/api/comercial/alerts/:id/dismiss', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const alert = await comercialStorage.dismissAlert(id);

    if (!alert) {
      return res.status(404).json({ message: 'Alerta no encontrada' });
    }

    res.json(alert);
  } catch (error) {
    logger.error('[POST /api/comercial/alerts/:id/dismiss] Error', error);
    res.status(500).json({ message: 'Error al descartar alerta' });
  }
});

// Generate alerts (admin only)
router.post('/api/comercial/alerts/generate', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const alerts = await comercialStorage.generateAlerts(companyId);
    res.json({ generated: alerts.length, alerts });
  } catch (error) {
    logger.error('[POST /api/comercial/alerts/generate] Error', error);
    res.status(500).json({ message: 'Error al generar alertas' });
  }
});

// ============================================
// REMINDERS
// ============================================

// Get user reminders
router.get('/api/comercial/reminders', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);

    const reminders = await comercialStorage.getReminders(user.id);
    res.json(reminders);
  } catch (error) {
    logger.error('[GET /api/comercial/reminders] Error', error);
    res.status(500).json({ message: 'Error al obtener recordatorios' });
  }
});

// Create reminder
router.post('/api/comercial/reminders', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);

    const validatedData = insertScheduledReminderSchema.parse({
      ...req.body,
      userId: user.id,
    });

    const reminder = await comercialStorage.createReminder(validatedData);
    res.status(201).json(reminder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
    }
    logger.error('[POST /api/comercial/reminders] Error', error);
    res.status(500).json({ message: 'Error al crear recordatorio' });
  }
});

// Update reminder
router.patch('/api/comercial/reminders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reminder = await comercialStorage.updateReminder(id, req.body);

    if (!reminder) {
      return res.status(404).json({ message: 'Recordatorio no encontrado' });
    }

    res.json(reminder);
  } catch (error) {
    logger.error('[PATCH /api/comercial/reminders/:id] Error', error);
    res.status(500).json({ message: 'Error al actualizar recordatorio' });
  }
});

// Delete reminder
router.delete('/api/comercial/reminders/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await comercialStorage.deleteReminder(id);
    res.status(204).send();
  } catch (error) {
    logger.error('[DELETE /api/comercial/reminders/:id] Error', error);
    res.status(500).json({ message: 'Error al eliminar recordatorio' });
  }
});

// ============================================
// REPORTS & ANALYTICS
// ============================================

// Lead sources report
router.get('/api/comercial/reports/lead-sources', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const report = await comercialStorage.getLeadSourcesReport(companyId);
    res.json(report);
  } catch (error) {
    logger.error('[GET /api/comercial/reports/lead-sources] Error', error);
    res.status(500).json({ message: 'Error al obtener reporte de fuentes' });
  }
});

// Sales forecast
router.get('/api/comercial/reports/forecast', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const forecast = await comercialStorage.getSalesForecast(companyId);
    res.json(forecast);
  } catch (error) {
    logger.error('[GET /api/comercial/reports/forecast] Error', error);
    res.status(500).json({ message: 'Error al obtener proyección de ventas' });
  }
});

// Win/Loss analysis
router.get('/api/comercial/reports/win-loss', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const analysis = await comercialStorage.getWinLossAnalysis(companyId);
    res.json(analysis);
  } catch (error) {
    logger.error('[GET /api/comercial/reports/win-loss] Error', error);
    res.status(500).json({ message: 'Error al obtener análisis de resultados' });
  }
});

// Competitor analysis
router.get('/api/comercial/reports/competitors', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const analysis = await comercialStorage.getCompetitorAnalysis(companyId);
    res.json(analysis);
  } catch (error) {
    logger.error('[GET /api/comercial/reports/competitors] Error', error);
    res.status(500).json({ message: 'Error al obtener análisis de competidores' });
  }
});

// Pipeline stats
router.get('/api/comercial/reports/pipeline', async (req, res) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const user = getAuthUser(authReq);
    const companyId = user.companyId || 1;

    const stats = await comercialStorage.getPipelineStats(companyId);
    res.json(stats);
  } catch (error) {
    logger.error('[GET /api/comercial/reports/pipeline] Error', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del pipeline' });
  }
});

export default router;
