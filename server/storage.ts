import type {
  User, InsertUser,
  Company, InsertCompany,
  CompanyId,
  Area, InsertArea,
  Kpi, InsertKpi,
  KpiValue, InsertKpiValue,
  ActionPlan, InsertActionPlan,
  Shipment, InsertShipment,
  ShipmentWithCycleTimes,
  ShipmentWithItems,
  ShipmentItem, InsertShipmentItem,
  ShipmentUpdate, InsertShipmentUpdate,
  Notification, InsertNotification,
  ShipmentNotification, InsertShipmentNotification,
  JobProfile, InsertJobProfile,
  JobProfileWithDetails,
  ShipmentCycleTimes, InsertShipmentCycleTimes,
  CycleTimeMetrics,
  Client, InsertClient,
  PaymentVoucher, InsertPaymentVoucher
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;

  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<Company>): Promise<Company | undefined>;

  // Area operations
  getArea(id: number): Promise<Area | undefined>;
  getAreas(): Promise<Area[]>;
  getAreasByCompany(companyId: number): Promise<Area[]>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: number, area: Partial<Area>): Promise<Area | undefined>;

  // KPI operations
  getKpi(id: number, companyId: number): Promise<Kpi | undefined>;
  getKpis(companyId?: number): Promise<Kpi[]>;
  getKpisByCompany(companyId: number): Promise<Kpi[]>;
  getKpisByArea(areaId: number): Promise<Kpi[]>;
  getKpisByCompanyAndArea(companyId: number, areaId: number): Promise<Kpi[]>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: number, kpi: Partial<Kpi>): Promise<Kpi | undefined>;
  deleteKpi(id: number, companyId: number): Promise<boolean>;
  getKPIHistory(kpiId: number, months?: number, companyId?: number): Promise<KpiValue[]>;
  getUserKPIHistory(userId: number, months?: number): Promise<any[]>;
  getKPIHistoryByUsers(kpiId: number, months?: number): Promise<any>;

  // KPI Value operations
  getKpiValue(id: number, companyId?: number): Promise<KpiValue | undefined>;
  getKpiValues(companyId?: number): Promise<KpiValue[]>;
  getKpiValuesByKpi(kpiId: number, companyId: number): Promise<KpiValue[]>;
  getLatestKpiValues(kpiId: number, limit: number, companyId: number): Promise<KpiValue[]>;
  createKpiValue(kpiValue: InsertKpiValue): Promise<KpiValue>;

  // Action Plan operations
  getActionPlan(id: number): Promise<ActionPlan | undefined>;
  getActionPlansByKpi(kpiId: number): Promise<ActionPlan[]>;
  createActionPlan(actionPlan: InsertActionPlan): Promise<ActionPlan>;
  updateActionPlan(id: number, actionPlan: Partial<ActionPlan>): Promise<ActionPlan | undefined>;

  // Shipment operations
  getShipment(id: number): Promise<Shipment | undefined>;
  getShipmentByTrackingCode(trackingCode: string): Promise<Shipment | undefined>;
  getShipments(): Promise<ShipmentWithCycleTimes[]>;
  getShipmentsByCompany(companyId: number): Promise<ShipmentWithCycleTimes[]>;
  getShipmentsByStatus(status: string): Promise<Shipment[]>;
  getShipmentsByCompanyAndStatus(companyId: number, status: string): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<Shipment>): Promise<Shipment | undefined>;

  // Shipment Item operations
  getShipmentItems(shipmentId: number): Promise<ShipmentItem[]>;
  createShipmentItem(item: InsertShipmentItem): Promise<ShipmentItem>;
  createShipmentItems(items: InsertShipmentItem[]): Promise<ShipmentItem[]>;
  updateShipmentItem(id: number, item: Partial<ShipmentItem>): Promise<ShipmentItem | undefined>;
  deleteShipmentItem(id: number): Promise<boolean>;

  // Shipment Update operations
  getShipmentUpdate(id: number): Promise<ShipmentUpdate | undefined>;
  getShipmentUpdatesByShipment(shipmentId: number): Promise<ShipmentUpdate[]>;
  createShipmentUpdate(update: InsertShipmentUpdate): Promise<ShipmentUpdate>;

  // Notification operations
  getNotification(id: number): Promise<Notification | undefined>;
  getNotificationsForUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number, userId: number): Promise<Notification | undefined>;
  deleteNotification(id: number, userId: number): Promise<boolean>;

  // Shipment Notification operations
  getShipmentNotification(id: number): Promise<ShipmentNotification | undefined>;
  getShipmentNotificationsByShipment(shipmentId: number): Promise<ShipmentNotification[]>;
  createShipmentNotification(notification: InsertShipmentNotification): Promise<ShipmentNotification>;
  updateShipmentNotificationStatus(id: number, status: string, errorMessage?: string): Promise<ShipmentNotification | undefined>;

  // Team activity operations
  getLastKpiUpdateByUser(userId: number): Promise<{ kpiName: string; updateDate: Date; } | undefined>;
  getTeamActivitySummary(): Promise<Array<{ userId: number; lastLogin: Date | null; lastKpiUpdate: { kpiName: string; updateDate: Date; } | null; }>>;

  // Job Profile operations
  getJobProfile(id: number): Promise<JobProfile | undefined>;
  getJobProfileByUserArea(areaId: number, companyId: number): Promise<JobProfile | undefined>;
  getJobProfileWithDetails(userId: number): Promise<JobProfileWithDetails | undefined>;
  createJobProfile(profile: InsertJobProfile): Promise<JobProfile>;
  updateJobProfile(id: number, profile: Partial<JobProfile>): Promise<JobProfile | undefined>;
  getUserKpis(userId: number): Promise<Kpi[]>;

  // Shipment Cycle Times operations
  getShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined>;
  upsertShipmentCycleTime(cycleTime: InsertShipmentCycleTimes): Promise<ShipmentCycleTimes>;
  recalculateShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined>;
  getAggregateCycleTimes(companyId?: number, startDate?: string, endDate?: string): Promise<CycleTimeMetrics[]>;

  // Client operations (for Treasury module)
  getClient(id: number): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  getClientsByCompany(companyId: number): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<Client>): Promise<Client | undefined>;

  // Payment Voucher operations (for Treasury module)
  getPaymentVoucher(id: number): Promise<PaymentVoucher | undefined>;
  getPaymentVouchers(): Promise<PaymentVoucher[]>;
  getPaymentVouchersByCompany(companyId: number): Promise<PaymentVoucher[]>;
  getPaymentVouchersByStatus(status: string, companyId?: number): Promise<PaymentVoucher[]>;
  createPaymentVoucher(voucher: InsertPaymentVoucher): Promise<PaymentVoucher>;
  updatePaymentVoucher(id: number, voucher: Partial<PaymentVoucher>): Promise<PaymentVoucher | undefined>;
  updatePaymentVoucherStatus(id: number, status: string): Promise<PaymentVoucher | undefined>;
}

// Production database storage
import { DatabaseStorage } from './DatabaseStorage';
export const storage = new DatabaseStorage();
