/**
 * Shared test utilities for backend tests
 */
import { vi } from 'vitest';
import express from 'express';
import type { IStorage } from '../storage';

// ============================================================================
// Mock User Factory
// ============================================================================

export interface MockUser {
  id: number;
  role: string;
  email: string;
  name: string;
  areaId: number | null;
  companyId: number | null;
}

export function mockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 1,
    role: 'admin',
    email: 'admin@test.com',
    name: 'Test Admin',
    areaId: 1,
    companyId: 1,
    ...overrides,
  };
}

export function mockViewer(overrides: Partial<MockUser> = {}): MockUser {
  return mockUser({ id: 2, role: 'viewer', name: 'Test Viewer', email: 'viewer@test.com', ...overrides });
}

export function mockExecutive(overrides: Partial<MockUser> = {}): MockUser {
  return mockUser({ id: 3, role: 'executive', name: 'Test Executive', email: 'exec@test.com', ...overrides });
}

// ============================================================================
// Mock Express Request / Response
// ============================================================================

export function createMockReq(overrides: Record<string, any> = {}) {
  return {
    user: mockUser(),
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

export function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.write = vi.fn().mockReturnValue(true);
  res.end = vi.fn();
  res.on = vi.fn().mockReturnValue(res);
  res.writableEnded = false;
  return res;
}

// ============================================================================
// Test Express App (for supertest)
// ============================================================================

export function createTestApp(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

// ============================================================================
// Mock Storage Factory
// ============================================================================

export function createMockStorage(): IStorage {
  return {
    // User operations
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getUsers: vi.fn(),
    deleteUser: vi.fn(),

    // Company operations
    getCompany: vi.fn(),
    getCompanies: vi.fn(),
    createCompany: vi.fn(),
    updateCompany: vi.fn(),

    // Area operations
    getArea: vi.fn(),
    getAreas: vi.fn(),
    getAreasByCompany: vi.fn(),
    createArea: vi.fn(),
    updateArea: vi.fn(),

    // KPI operations
    getKpi: vi.fn(),
    getKpis: vi.fn(),
    getKpisByCompany: vi.fn(),
    getKpisByArea: vi.fn(),
    getKpisByCompanyAndArea: vi.fn(),
    createKpi: vi.fn(),
    updateKpi: vi.fn(),
    deleteKpi: vi.fn(),
    getKPIHistory: vi.fn(),
    getUserKPIHistory: vi.fn(),
    getKPIHistoryByUsers: vi.fn(),

    // KPI Value operations
    getKpiValue: vi.fn(),
    getKpiValues: vi.fn(),
    getKpiValuesByKpi: vi.fn(),
    getLatestKpiValues: vi.fn(),
    createKpiValue: vi.fn(),

    // Action Plan operations
    getActionPlan: vi.fn(),
    getActionPlansByKpi: vi.fn(),
    createActionPlan: vi.fn(),
    updateActionPlan: vi.fn(),

    // Shipment operations
    getShipment: vi.fn(),
    getShipmentByTrackingCode: vi.fn(),
    getShipments: vi.fn(),
    getShipmentsByCompany: vi.fn(),
    getShipmentsByStatus: vi.fn(),
    getShipmentsByCompanyAndStatus: vi.fn(),
    createShipment: vi.fn(),
    updateShipment: vi.fn(),

    // Shipment Item operations
    getShipmentItems: vi.fn(),
    createShipmentItem: vi.fn(),
    createShipmentItems: vi.fn(),
    updateShipmentItem: vi.fn(),
    deleteShipmentItem: vi.fn(),

    // Shipment Update operations
    getShipmentUpdate: vi.fn(),
    getShipmentUpdatesByShipment: vi.fn(),
    createShipmentUpdate: vi.fn(),

    // Notification operations
    getNotification: vi.fn(),
    getNotificationsForUser: vi.fn(),
    createNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    deleteNotification: vi.fn(),

    // Shipment Notification operations
    getShipmentNotification: vi.fn(),
    getShipmentNotificationsByShipment: vi.fn(),
    createShipmentNotification: vi.fn(),
    updateShipmentNotificationStatus: vi.fn(),

    // Team activity operations
    getLastKpiUpdateByUser: vi.fn(),
    getTeamActivitySummary: vi.fn(),

    // Job Profile operations
    getJobProfile: vi.fn(),
    getJobProfileByUserArea: vi.fn(),
    getJobProfileWithDetails: vi.fn(),
    createJobProfile: vi.fn(),
    updateJobProfile: vi.fn(),
    getUserKpis: vi.fn(),

    // Shipment Cycle Times operations
    getShipmentCycleTime: vi.fn(),
    upsertShipmentCycleTime: vi.fn(),
    recalculateShipmentCycleTime: vi.fn(),
    getAggregateCycleTimes: vi.fn(),

    // Client operations
    getClient: vi.fn(),
    getClients: vi.fn(),
    getClientsByCompany: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),

    // Payment Voucher operations
    getPaymentVoucher: vi.fn(),
    getPaymentVouchers: vi.fn(),
    getPaymentVouchersByCompany: vi.fn(),
    getPaymentVouchersByStatus: vi.fn(),
    createPaymentVoucher: vi.fn(),
    updatePaymentVoucher: vi.fn(),
    updatePaymentVoucherStatus: vi.fn(),
  };
}

// ============================================================================
// Common mock data
// ============================================================================

export const MOCK_KPI = {
  id: 1,
  name: 'Volumen de Ventas',
  description: 'Test KPI',
  companyId: 1 as 1 | 2,
  areaId: 1,
  goal: '100',
  value: '85',
  unit: 'KG',
  frequency: 'monthly',
  responsible: 'Test User',
  category: 'ventas',
  status: 'alert',
};

export const MOCK_NOTIFICATION = {
  id: 1,
  fromUserId: 1,
  toUserId: 2,
  title: 'Test notification',
  message: 'Test message',
  type: 'info',
  read: false,
  companyId: 1,
  areaId: 1,
  createdAt: new Date(),
};

export const MOCK_SHIPMENT = {
  id: 1,
  containerNumber: 'CONT-001',
  status: 'in_transit',
  companyId: 1,
  origin: 'Shanghai',
  destination: 'Mexico City',
  eta: new Date('2025-06-01'),
};
