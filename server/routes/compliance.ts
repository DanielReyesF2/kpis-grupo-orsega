import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';

const router = Router();

// GET /api/compliance/catalog — Full obligation catalog
router.get("/api/compliance/catalog", jwtAuthMiddleware, async (_req, res) => {
  try {
    const catalog = await storage.getObligationCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('[compliance] Error getting catalog:', error);
    res.status(500).json({ error: 'Error al obtener catálogo de obligaciones' });
  }
});

// GET /api/compliance/obligations?companyId= — Company obligations with catalog data
router.get("/api/compliance/obligations", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const obligations = await storage.getCompanyObligations(companyId);
    res.json(obligations);
  } catch (error) {
    console.error('[compliance] Error getting obligations:', error);
    res.status(500).json({ error: 'Error al obtener obligaciones' });
  }
});

// GET /api/compliance/dossier/:tenantObligationId?period= — Dossier with evidence
router.get("/api/compliance/dossier/:tenantObligationId", jwtAuthMiddleware, async (req, res) => {
  try {
    const tenantObligationId = parseInt(req.params.tenantObligationId);
    const period = (req.query.period as string) || '2026';

    if (isNaN(tenantObligationId)) {
      return res.status(400).json({ error: 'tenantObligationId inválido' });
    }

    const dossier = await storage.getObligationDossier(tenantObligationId, period);
    if (!dossier) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    res.json(dossier);
  } catch (error) {
    console.error('[compliance] Error getting dossier:', error);
    res.status(500).json({ error: 'Error al obtener expediente' });
  }
});

// GET /api/compliance/dossiers?companyId=&period= — All dossiers for company
router.get("/api/compliance/dossiers", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : user.companyId;
    const period = req.query.period as string | undefined;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const dossiers = await storage.getCompanyDossiers(companyId, period);
    res.json(dossiers);
  } catch (error) {
    console.error('[compliance] Error getting dossiers:', error);
    res.status(500).json({ error: 'Error al obtener expedientes' });
  }
});

// GET /api/compliance/deadlines?companyId=&days= — Upcoming deadlines
router.get("/api/compliance/deadlines", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : user.companyId;
    const days = req.query.days ? parseInt(req.query.days as string) : 90;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const deadlines = await storage.getUpcomingDeadlines(companyId, days);
    res.json(deadlines);
  } catch (error) {
    console.error('[compliance] Error getting deadlines:', error);
    res.status(500).json({ error: 'Error al obtener vencimientos' });
  }
});

// GET /api/compliance/score?companyId= — Compliance score summary
router.get("/api/compliance/score", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const companyId = req.query.companyId
      ? parseInt(req.query.companyId as string)
      : user.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const score = await storage.getComplianceScore(companyId);
    res.json(score);
  } catch (error) {
    console.error('[compliance] Error getting compliance score:', error);
    res.status(500).json({ error: 'Error al obtener score de cumplimiento' });
  }
});

// PATCH /api/compliance/obligations/:id — Update obligation status/notes
const updateObligationSchema = z.object({
  status: z.enum(['compliant', 'pending', 'expired', 'not_applicable']),
  notes: z.string().max(2000).optional(),
});

router.patch("/api/compliance/obligations/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const parsed = updateObligationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    const updated = await storage.updateObligationStatus(id, parsed.data.status, parsed.data.notes);
    if (!updated) {
      return res.status(404).json({ error: 'Obligación no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[compliance] Error updating obligation:', error);
    res.status(500).json({ error: 'Error al actualizar obligación' });
  }
});

// POST /api/compliance/evidence — Add evidence to dossier
const addEvidenceSchema = z.object({
  dossierId: z.number().int().positive(),
  evidenceType: z.string().max(100),
  fileUrl: z.string().max(2000).optional(),
  fileName: z.string().max(255).optional(),
  dataJson: z.record(z.unknown()).optional(),
  source: z.string().max(50).default('manual'),
  uploadedBy: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

router.post("/api/compliance/evidence", jwtAuthMiddleware, async (req, res) => {
  try {
    const parsed = addEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    }

    const { dossierId, ...evidenceData } = parsed.data;
    const evidence = await storage.addDossierEvidence(dossierId, evidenceData);

    if (!evidence) {
      return res.status(500).json({ error: 'Error al agregar evidencia' });
    }

    res.status(201).json(evidence);
  } catch (error) {
    console.error('[compliance] Error adding evidence:', error);
    res.status(500).json({ error: 'Error al agregar evidencia' });
  }
});

export default router;
