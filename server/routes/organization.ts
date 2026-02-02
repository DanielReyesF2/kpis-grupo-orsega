import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { sql } from './_helpers';
import { jwtAuthMiddleware, jwtAdminMiddleware } from '../auth';
import { insertCompanySchema, insertAreaSchema } from '@shared/schema';

const router = Router();

// Company routes
router.get("/api/companies", jwtAuthMiddleware, async (req, res) => {
  try {
    const companies = await storage.getCompanies();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/api/companies/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const company = await storage.getCompany(id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    console.log(`[GET /api/companies/:id] Buscando empresa con ID: ${id}`);
    console.log(`[GET /api/companies/:id] Empresa encontrada: ${company ? 'Si' : 'No'}`);
    console.log(`[GET /api/companies/:id] Enviando empresa: { id: ${company.id}, name: '${company.name}' }`);

    res.json(company);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/api/companies", jwtAuthMiddleware, async (req, res) => {
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
router.get("/api/areas", jwtAuthMiddleware, async (req, res) => {
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

router.get("/api/areas/:id", jwtAuthMiddleware, async (req, res) => {
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

router.post("/api/areas", jwtAuthMiddleware, async (req, res) => {
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

export default router;
