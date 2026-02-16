import type express from "express";
import { jwtAuthMiddleware } from "./auth";

// Nova AI routes (SSE streaming chat)
import { novaRouter } from "./nova/nova-routes";

// Legacy separate route modules
import { catalogRouter } from "./routes-catalog";
import { logisticsRouter } from "./routes-logistics";

// Decomposed route modules
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import usersRouter from "./routes/users";
import organizationRouter from "./routes/organization";
import kpisRouter from "./routes/kpis";
import kpiValuesRouter from "./routes/kpi-values";
import salesOperationsRouter from "./routes/sales-operations";
import shipmentsRouter from "./routes/shipments";
import notificationsRouter from "./routes/notifications";
import analyticsRouter from "./routes/analytics";
import catalogDataRouter from "./routes/catalog";
import onboardingRouter from "./routes/onboarding";
import treasuryPaymentsRouter from "./routes/treasury-payments";
import treasuryFxRouter from "./routes/treasury-fx";
import treasuryDocumentsRouter from "./routes/treasury-documents";
import treasuryAccountingRouter from "./routes/treasury-accounting";
import paymentVouchersRouter from "./routes/payment-vouchers";
import salesAnalyticsRouter from "./routes/sales-analytics";
import salesDataRouter from "./routes/sales-data";
import salesActionsRouter from "./routes/sales-actions";
import n8nRouter from "./routes/n8n";
import filesRouter from "./routes/files";
import docsRouter from "./routes/docs";
import comercialRouter from "./routes/comercial";

export function registerRoutes(app: express.Application) {
  // ========================================
  // PUBLIC ROUTES (no auth) — must be registered first
  // ========================================
  app.use(authRouter);          // POST /api/login, POST /api/register
  app.use(onboardingRouter);    // GET/POST /api/activate/:token, seed-production, debug-database
  app.use(n8nRouter);           // POST /api/n8n/webhook (token-based auth)

  // ========================================
  // NOVA AI — SSE Streaming Chat + File Upload
  // ========================================
  app.use(novaRouter);

  // ========================================
  // LEGACY ROUTE MODULES
  // ========================================
  app.use("/api", jwtAuthMiddleware, catalogRouter);
  app.use("/api/logistics-legacy", logisticsRouter);

  // ========================================
  // DECOMPOSED ROUTE MODULES
  // ========================================
  app.use(adminRouter);
  app.use(usersRouter);
  app.use(organizationRouter);
  app.use(kpisRouter);
  app.use(kpiValuesRouter);
  app.use(salesOperationsRouter);
  app.use(shipmentsRouter);
  app.use(notificationsRouter);
  app.use(analyticsRouter);
  app.use(catalogDataRouter);
  app.use(treasuryPaymentsRouter);
  app.use(treasuryFxRouter);
  app.use(treasuryDocumentsRouter);
  app.use(treasuryAccountingRouter);
  app.use(paymentVouchersRouter);
  app.use(salesAnalyticsRouter);
  app.use(salesDataRouter);
  app.use(salesActionsRouter);
  app.use(filesRouter);
  app.use(docsRouter);
  app.use(comercialRouter);

  return app;
}
