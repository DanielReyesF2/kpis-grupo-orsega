import {
  users,
  companies,
  areas,
  kpisDura,
  kpisOrsega,
  kpiValuesDura,
  kpiValuesOrsega,
  actionPlans,
  shipments,
  shipmentItems,
  shipmentUpdates,
  notifications,
  jobProfiles,
  shipmentCycleTimes,
  userActivationTokens,
  clients,
  paymentVouchers,
  scheduledPayments,
  type InsertKpiDura,
  type InsertKpiOrsega,
  type KpiDura,
  type KpiOrsega,
  type KpiValueDura,
  type KpiValueOrsega
} from "@shared/schema";
import type {
  User, InsertUser,
  Company, InsertCompany,
  Area, InsertArea,
  InsertKpi,
  Kpi,
  InsertKpiValue,
  KpiValue,
  CompanyId,
  ActionPlan, InsertActionPlan,
  Shipment, InsertShipment,
  ShipmentItem, InsertShipmentItem,
  ShipmentUpdate, InsertShipmentUpdate,
  Notification, InsertNotification,
  JobProfile, InsertJobProfile,
  JobProfileWithDetails,
  ShipmentCycleTimes, InsertShipmentCycleTimes,
  CycleTimeMetrics,
  UserActivationToken, InsertUserActivationToken,
  Client, InsertClient,
  PaymentVoucher, InsertPaymentVoucher,
  ScheduledPayment, InsertScheduledPayment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Removed session store since JWT is used for authentication
  }

  private resolveCompany(companyId: number): 1 | 2 {
    if (companyId === 1 || companyId === 2) {
      return companyId;
    }
    throw new Error(`Unsupported companyId ${companyId}. Use 1 for Dura or 2 for Orsega.`);
  }

  private getKpiTable(companyId: 1 | 2) {
    return companyId === 1 ? kpisDura : kpisOrsega;
  }

  private getKpiValuesTable(companyId: 1 | 2) {
    return companyId === 1 ? kpiValuesDura : kpiValuesOrsega;
  }

  private async getCompanyAreaMap(companyId: 1 | 2) {
    const areaRows = await db.select().from(areas).where(eq(areas.companyId, companyId));
    const areaMap = new Map<string, Area>();
    for (const area of areaRows) {
      areaMap.set(area.name.trim().toLowerCase(), area);
    }
    return areaMap;
  }

  private normalizeAreaName(area?: string | null) {
    return area ? area.trim().toLowerCase() : null;
  }

  private async findCompanyForKpiId(kpiId: number): Promise<1 | 2 | undefined> {
    const [duraMatch] = await db
      .select({ id: kpisDura.id })
      .from(kpisDura)
      .where(eq(kpisDura.id, kpiId))
      .limit(1);
    if (duraMatch) return 1;

    const [orsegaMatch] = await db
      .select({ id: kpisOrsega.id })
      .from(kpisOrsega)
      .where(eq(kpisOrsega.id, kpiId))
      .limit(1);
    if (orsegaMatch) return 2;

    return undefined;
  }

  private async findCompanyForKpiValueId(valueId: number): Promise<1 | 2 | undefined> {
    const [duraMatch] = await db
      .select({ id: kpiValuesDura.id })
      .from(kpiValuesDura)
      .where(eq(kpiValuesDura.id, valueId))
      .limit(1);
    if (duraMatch) return 1;

    const [orsegaMatch] = await db
      .select({ id: kpiValuesOrsega.id })
      .from(kpiValuesOrsega)
      .where(eq(kpiValuesOrsega.id, valueId))
      .limit(1);
    if (orsegaMatch) return 2;

    return undefined;
  }

  private mapKpiRecord(record: any, companyId: 1 | 2, areaMap: Map<string, Area>) {
    const normalizedArea = this.normalizeAreaName(record.area);
    const areaMatch = normalizedArea ? areaMap.get(normalizedArea) : undefined;
    return {
      id: record.id,
      area: areaMatch?.name ?? record.area ?? null,
      kpiName: record.kpiName,
      name: record.kpiName,
      description: record.description ?? null,
      calculationMethod: record.calculationMethod ?? null,
      goal: record.goal ?? null,
      target: record.goal ?? null,
      unit: record.unit ?? null,
      frequency: record.frequency ?? null,
      source: record.source ?? null,
      responsible: record.responsible ?? null,
      period: record.period ?? null,
      createdAt: record.createdAt ?? null,
      companyId,
      areaId: areaMatch?.id ?? null,
    };
  }

  private mapKpiValueRecord(record: any, companyId: 1 | 2) {
    const period =
      record.month && record.year
        ? `${record.month.charAt(0).toUpperCase()}${record.month.slice(1).toLowerCase()} ${record.year}`
        : null;
    return {
      id: record.id,
      kpiId: record.kpi_id,
      value: record.value?.toString() ?? "0",
      period,
      date: record.created_at ?? new Date(),
      compliancePercentage: null,
      status: null,
      comments: null,
      updatedBy: null,
      month: record.month ?? null,
      year: record.year ?? null,
      companyId,
    };
  }

  async getCompanyKpisNormalized(companyId: number) {
    const resolved = this.resolveCompany(companyId);
    const table = this.getKpiTable(resolved);
    const areaMap = await this.getCompanyAreaMap(resolved);
    const records = await db.select().from(table);
    return records.map((record) => this.mapKpiRecord(record, resolved, areaMap));
  }

  async getAllCompanyKpisNormalized() {
    const dura = await this.getCompanyKpisNormalized(1);
    const orsega = await this.getCompanyKpisNormalized(2);
    return [...dura, ...orsega];
  }

  async getCompanyKpiNormalized(companyId: number, kpiId: number) {
    const resolved = this.resolveCompany(companyId);
    const table = this.getKpiTable(resolved);
    const areaMap = await this.getCompanyAreaMap(resolved);
    const records = await db.select().from(table).where(eq(table.id, kpiId)).limit(1);
    if (records.length === 0) return undefined;
    return this.mapKpiRecord(records[0], resolved, areaMap);
  }

  async getCompanyKpiValuesNormalized(companyId: number) {
    const resolved = this.resolveCompany(companyId);
    const table = this.getKpiValuesTable(resolved);
    const records = await db.select().from(table);
    return records.map((record) => this.mapKpiValueRecord(record, resolved));
  }

  async getCompanyKpiValuesByKpiNormalized(companyId: number, kpiId: number) {
    const resolved = this.resolveCompany(companyId);
    const table = this.getKpiValuesTable(resolved);
    
    // Optimización: Limitar a 12 registros más recientes directamente en la query
    const records = await db
      .select()
      .from(table)
      .where(eq(table.kpi_id, kpiId))
      .orderBy(desc(table.year), desc(table.created_at))
      .limit(12); // Limitar en la query para mejor rendimiento
    
    const mapped = records.map((record) => this.mapKpiValueRecord(record, resolved));
    
    return mapped;
  }

  async upsertCompanyKpiValueNormalized(companyId: number, data: {
    kpiId: number;
    month: string;
    year: number;
    value: number;
    compliancePercentage?: string | null;
    status?: string | null;
    comments?: string | null;
    updatedBy?: number | null;
  }) {
    const resolved = this.resolveCompany(companyId);
    const table = this.getKpiValuesTable(resolved);
    const monthUpper = data.month.toUpperCase();

    const existing = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.kpi_id, data.kpiId),
          eq(table.month, monthUpper),
          eq(table.year, data.year)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(table)
        .set({
          value: data.value,
          created_at: new Date(),
        })
        .where(eq(table.id, existing[0].id))
        .returning();
      return this.mapKpiValueRecord(updated, resolved);
    }

    const [inserted] = await db
      .insert(table)
      .values({
        kpi_id: data.kpiId,
        month: monthUpper,
        year: data.year,
        value: data.value,
        created_at: new Date(),
      })
      .returning();

    return this.mapKpiValueRecord(inserted, resolved);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Comparación case-insensitive para evitar errores por mayúsculas/minúsculas
      const lowerEmail = email.toLowerCase();
      const [user] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.email}) = ${lowerEmail}`);
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      // Si el username es un email completo, buscar por email
      if (username.includes('@')) {
        const lowerEmail = username.toLowerCase();
        const [user] = await db
          .select()
          .from(users)
          .where(sql`LOWER(${users.email}) = ${lowerEmail}`);
        return user;
      }
      
      // Si no es un email, buscar por la parte antes del @ en el email
      // Ejemplo: "omarnavarro" debe encontrar "omarnavarro@duraintal.com"
      const allUsers = await db.select().from(users);
      
      return allUsers.find(user => {
        const emailParts = user.email.toLowerCase().split('@');
        return emailParts.length > 0 && emailParts[0] === username.toLowerCase();
      });
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [createdUser] = await db.insert(users).values(user).returning();
      return createdUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error getting users:", error);
      return [];
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    try {
      const [company] = await db.select().from(companies).where(eq(companies.id, id));
      return company;
    } catch (error) {
      console.error("Error getting company:", error);
      return undefined;
    }
  }

  async getCompanies(): Promise<Company[]> {
    try {
      return await db.select().from(companies);
    } catch (error) {
      console.error("Error getting companies:", error);
      return [];
    }
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    try {
      const [createdCompany] = await db.insert(companies).values(company).returning();
      return createdCompany;
    } catch (error) {
      console.error("Error creating company:", error);
      throw error;
    }
  }

  async updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined> {
    try {
      const [updatedCompany] = await db
        .update(companies)
        .set(companyData)
        .where(eq(companies.id, id))
        .returning();
      return updatedCompany;
    } catch (error) {
      console.error("Error updating company:", error);
      return undefined;
    }
  }

  // Area operations
  async getArea(id: number): Promise<Area | undefined> {
    try {
      const [area] = await db.select().from(areas).where(eq(areas.id, id));
      return area;
    } catch (error) {
      console.error("Error getting area:", error);
      return undefined;
    }
  }

  async getAreas(): Promise<Area[]> {
    try {
      return await db.select().from(areas);
    } catch (error) {
      console.error("Error getting areas:", error);
      return [];
    }
  }

  async getAreasByCompany(companyId: number): Promise<Area[]> {
    try {
      return await db.select().from(areas).where(eq(areas.companyId, companyId));
    } catch (error) {
      console.error("Error getting areas by company:", error);
      return [];
    }
  }

  async createArea(area: InsertArea): Promise<Area> {
    try {
      const [createdArea] = await db.insert(areas).values(area).returning();
      return createdArea;
    } catch (error) {
      console.error("Error creating area:", error);
      throw error;
    }
  }

  async updateArea(id: number, areaData: Partial<Area>): Promise<Area | undefined> {
    try {
      const [updatedArea] = await db
        .update(areas)
        .set(areaData)
        .where(eq(areas.id, id))
        .returning();
      return updatedArea;
    } catch (error) {
      console.error("Error updating area:", error);
      return undefined;
    }
  }

  // KPI operations
  async getKpi(id: number, companyId: number): Promise<Kpi | undefined> {
    try {
      const resolved = this.resolveCompany(companyId);
      const table = this.getKpiTable(resolved);
      const areaMap = await this.getCompanyAreaMap(resolved);
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!record) return undefined;
      return this.mapKpiRecord(record, resolved, areaMap);
    } catch (error) {
      console.error("Error getting KPI:", error);
      return undefined;
    }
  }

  async getKpis(companyId?: number): Promise<Kpi[]> {
    try {
      if (typeof companyId === "number") {
        return await this.getCompanyKpisNormalized(companyId);
      }
      return await this.getAllCompanyKpisNormalized();
    } catch (error) {
      console.error("Error getting KPIs:", error);
      return [];
    }
  }

  async getKpisByCompany(companyId: number): Promise<Kpi[]> {
    try {
      return await this.getCompanyKpisNormalized(companyId);
    } catch (error) {
      console.error("Error getting KPIs by company:", error);
      return [];
    }
  }

  async getKpisByArea(areaId: number): Promise<Kpi[]> {
    try {
      const [areaRecord] = await db.select().from(areas).where(eq(areas.id, areaId)).limit(1);
      if (!areaRecord) {
        return [];
      }

      const resolved = this.resolveCompany(areaRecord.companyId);
      const table = this.getKpiTable(resolved);
      const areaMap = await this.getCompanyAreaMap(resolved);
      const normalizedName = this.normalizeAreaName(areaRecord.name);

      const records = await db.select().from(table);
      return records
        .filter((record) => this.normalizeAreaName(record.area) === normalizedName)
        .map((record) => this.mapKpiRecord(record, resolved, areaMap));
    } catch (error) {
      console.error("Error getting KPIs by area:", error);
      return [];
    }
  }

  async getKpisByCompanyAndArea(companyId: number, areaId: number): Promise<Kpi[]> {
    try {
      const resolved = this.resolveCompany(companyId);
      const [areaRecord] = await db.select().from(areas).where(eq(areas.id, areaId)).limit(1);
      if (!areaRecord || this.resolveCompany(areaRecord.companyId) !== resolved) {
        return [];
      }

      const table = this.getKpiTable(resolved);
      const areaMap = await this.getCompanyAreaMap(resolved);
      const normalizedName = this.normalizeAreaName(areaRecord.name);
      const records = await db.select().from(table);

      return records
        .filter((record) => this.normalizeAreaName(record.area) === normalizedName)
        .map((record) => this.mapKpiRecord(record, resolved, areaMap));
    } catch (error) {
      console.error("Error getting KPIs by company and area:", error);
      return [];
    }
  }

  async createKpi(kpi: InsertKpi): Promise<Kpi> {
    try {
      const resolved = this.resolveCompany(kpi.companyId);
      const table = this.getKpiTable(resolved);

      let areaRecord: Area | undefined;
      if (kpi.areaId) {
        const [area] = await db.select().from(areas).where(eq(areas.id, kpi.areaId)).limit(1);
        if (!area) {
          throw new Error(`Area with id ${kpi.areaId} not found`);
        }
        if (this.resolveCompany(area.companyId) !== resolved) {
          throw new Error(`La área ${area.id} pertenece a otra compañía`);
        }
        areaRecord = area;
      }

      const areaName = (areaRecord?.name ?? kpi.area)?.trim();
      if (!areaName) {
        throw new Error("Debe especificarse un área válida para el KPI");
      }

      const insertPayload = {
        area: areaName,
        kpiName: kpi.name,
        description: kpi.description ?? null,
        calculationMethod: kpi.calculationMethod ?? null,
        goal: kpi.goal ?? kpi.target ?? null,
        unit: kpi.unit ?? null,
        frequency: kpi.frequency ?? null,
        source: kpi.source ?? null,
        responsible: kpi.responsible ?? null,
        period: kpi.period ?? null,
      };

      const [created] = await db.insert(table).values(insertPayload).returning();
      const areaMap = await this.getCompanyAreaMap(resolved);
      return this.mapKpiRecord(created, resolved, areaMap);
    } catch (error) {
      console.error("Error creating KPI:", error);
      throw error;
    }
  }

  async updateKpi(id: number, kpiData: Partial<Kpi>): Promise<Kpi | undefined> {
    try {
      const companyId = kpiData.companyId ?? (await this.findCompanyForKpiId(id));
      if (!companyId) {
        console.warn(`[DatabaseStorage] No se encontró compañía para KPI ${id}`);
        return undefined;
      }

      const resolved = this.resolveCompany(companyId);
      const table = this.getKpiTable(resolved);
      const updates: Record<string, any> = {};

      if (kpiData.name !== undefined) updates.kpiName = kpiData.name;
      if (kpiData.description !== undefined) updates.description = kpiData.description;
      if (kpiData.calculationMethod !== undefined) updates.calculationMethod = kpiData.calculationMethod;
      if (kpiData.target !== undefined || kpiData.goal !== undefined) {
        updates.goal = kpiData.goal ?? kpiData.target;
      }
      if (kpiData.unit !== undefined) updates.unit = kpiData.unit;
      if (kpiData.frequency !== undefined) updates.frequency = kpiData.frequency;
      if (kpiData.source !== undefined) updates.source = kpiData.source;
      if (kpiData.responsible !== undefined) updates.responsible = kpiData.responsible;
      if (kpiData.period !== undefined) updates.period = kpiData.period;

      if (kpiData.areaId !== undefined || kpiData.area !== undefined) {
        let areaName = kpiData.area;
        if (kpiData.areaId !== undefined) {
          const [area] = await db.select().from(areas).where(eq(areas.id, kpiData.areaId)).limit(1);
          if (!area) {
            throw new Error(`Area with id ${kpiData.areaId} not found`);
          }
          if (this.resolveCompany(area.companyId) !== resolved) {
            throw new Error(`La área ${area.id} pertenece a otra compañía`);
          }
          areaName = area.name;
        }
        if (areaName) {
          updates.area = areaName;
        }
      }

      if (Object.keys(updates).length === 0) {
        return await this.getKpi(id, resolved);
      }

      const [updated] = await db
        .update(table)
        .set(updates)
        .where(eq(table.id, id))
        .returning();

      if (!updated) return undefined;

      const areaMap = await this.getCompanyAreaMap(resolved);
      return this.mapKpiRecord(updated, resolved, areaMap);
    } catch (error) {
      console.error("Error updating KPI:", error);
      return undefined;
    }
  }

  async deleteKpi(id: number, companyId: number): Promise<boolean> {
    try {
      const resolved = this.resolveCompany(companyId);
      const valuesTable = this.getKpiValuesTable(resolved);
      await db.delete(valuesTable).where(eq(valuesTable.kpi_id, id));

      const table = this.getKpiTable(resolved);
      const result = await db.delete(table).where(eq(table.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting KPI:", error);
      return false;
    }
  }

  // KPI Value operations
  async getKpiValue(id: number, companyId?: number): Promise<KpiValue | undefined> {
    try {
      let resolved: 1 | 2 | undefined;
      if (companyId !== undefined) {
        resolved = this.resolveCompany(companyId);
      } else {
        resolved = await this.findCompanyForKpiValueId(id);
      }

      if (!resolved) return undefined;

      const table = this.getKpiValuesTable(resolved);
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!record) return undefined;
      return this.mapKpiValueRecord(record, resolved);
    } catch (error) {
      console.error("Error getting KPI value:", error);
      return undefined;
    }
  }

  async getKpiValues(companyId?: number): Promise<KpiValue[]> {
    try {
      if (typeof companyId === "number") {
        return await this.getCompanyKpiValuesNormalized(companyId);
      }

      const dura = await this.getCompanyKpiValuesNormalized(1);
      const orsega = await this.getCompanyKpiValuesNormalized(2);
      return [...dura, ...orsega];
    } catch (error) {
      console.error("Error getting KPI values:", error);
      return [];
    }
  }

  async getKpiValuesByKpi(kpiId: number, companyId: number): Promise<KpiValue[]> {
    try {
      return await this.getCompanyKpiValuesByKpiNormalized(companyId, kpiId);
    } catch (error) {
      console.error("Error getting KPI values by KPI:", error);
      return [];
    }
  }

  async getKpiValuesByUser(_userId: number): Promise<KpiValue[]> {
    // Las tablas específicas por empresa no guardan valores por usuario
    return [];
  }

  async deleteKpiValuesByUser(_userId: number, _kpiId: number): Promise<boolean> {
    // No hay valores específicos por usuario en las tablas por empresa
    return false;
  }

  async getLatestKpiValues(kpiId: number, limit: number, companyId: number): Promise<KpiValue[]> {
    try {
      const values = await this.getCompanyKpiValuesByKpiNormalized(companyId, kpiId);
      return values.slice(0, limit);
    } catch (error) {
      console.error("Error getting latest KPI values:", error);
      return [];
    }
  }

  private extractMonthYear(data: { month?: string | null; year?: number | null; period?: string | null }) {
    if (data.month && data.year) {
      return {
        month: data.month.toUpperCase(),
        year: data.year,
      };
    }

    if (data.period) {
      const parts = data.period.trim().split(/[\s/-]+/);
      const maybeYear = parseInt(parts[parts.length - 1], 10);
      if (!Number.isFinite(maybeYear)) {
        throw new Error(`No se pudo determinar el año a partir del periodo "${data.period}"`);
      }
      const monthPart = parts.slice(0, -1).join(" ");
      if (!monthPart) {
        throw new Error(`No se pudo determinar el mes a partir del periodo "${data.period}"`);
      }
      return {
        month: monthPart.toUpperCase(),
        year: maybeYear,
      };
    }

    const now = new Date();
    const month = now.toLocaleString("es-MX", { month: "long" }).toUpperCase();
    const year = now.getFullYear();
    return { month, year };
  }

  async createKpiValue(kpiValue: InsertKpiValue): Promise<KpiValue> {
    try {
      const companyIdInput =
        kpiValue.companyId ?? (await this.findCompanyForKpiId(kpiValue.kpiId));
      if (!companyIdInput) {
        throw new Error(`Unable to determine company for KPI ${kpiValue.kpiId}`);
      }

      const resolved = this.resolveCompany(companyIdInput);
      const { month, year } = this.extractMonthYear(kpiValue);
      const numericValue =
        typeof kpiValue.value === "string" ? parseFloat(kpiValue.value) : Number(kpiValue.value);

      if (!Number.isFinite(numericValue)) {
        throw new Error(`El valor del KPI debe ser numérico. Recibido: ${kpiValue.value}`);
      }

      return await this.upsertCompanyKpiValueNormalized(resolved, {
        kpiId: kpiValue.kpiId,
        month,
        year,
        value: numericValue,
        compliancePercentage: kpiValue.compliancePercentage ?? null,
        status: kpiValue.status ?? null,
        comments: kpiValue.comments ?? null,
        updatedBy: kpiValue.updatedBy ?? null,
      });
    } catch (error) {
      console.error("Error creating KPI value:", error);
      throw error;
    }
  }

  // Action Plan operations
  async getActionPlan(id: number): Promise<ActionPlan | undefined> {
    try {
      const [actionPlan] = await db.select().from(actionPlans).where(eq(actionPlans.id, id));
      return actionPlan;
    } catch (error) {
      console.error("Error getting action plan:", error);
      return undefined;
    }
  }

  async getActionPlansByKpi(kpiId: number): Promise<ActionPlan[]> {
    try {
      return await db.select().from(actionPlans).where(eq(actionPlans.kpiId, kpiId));
    } catch (error) {
      console.error("Error getting action plans by KPI:", error);
      return [];
    }
  }

  async createActionPlan(actionPlan: InsertActionPlan): Promise<ActionPlan> {
    try {
      const [createdActionPlan] = await db.insert(actionPlans).values(actionPlan).returning();
      return createdActionPlan;
    } catch (error) {
      console.error("Error creating action plan:", error);
      throw error;
    }
  }

  async updateActionPlan(id: number, actionPlanData: Partial<ActionPlan>): Promise<ActionPlan | undefined> {
    try {
      const [updatedActionPlan] = await db
        .update(actionPlans)
        .set(actionPlanData)
        .where(eq(actionPlans.id, id))
        .returning();
      return updatedActionPlan;
    } catch (error) {
      console.error("Error updating action plan:", error);
      return undefined;
    }
  }

  // Shipment operations
  async getShipment(id: number): Promise<Shipment | undefined> {
    try {
      const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
      return shipment;
    } catch (error) {
      console.error("Error getting shipment:", error);
      return undefined;
    }
  }

  async getShipmentByTrackingCode(trackingCode: string): Promise<Shipment | undefined> {
    try {
      const [shipment] = await db.select().from(shipments).where(eq(shipments.trackingCode, trackingCode));
      return shipment;
    } catch (error) {
      console.error("Error getting shipment by tracking code:", error);
      return undefined;
    }
  }

  async getShipments(): Promise<Shipment[]> {
    try {
      const allShipments = await db.select().from(shipments);
      
      // Cargar items para cada shipment
      const shipmentsWithItems = await Promise.all(
        allShipments.map(async (shipment) => {
          const items = await this.getShipmentItems(shipment.id);
          return { ...shipment, items };
        })
      );
      
      return shipmentsWithItems as any;
    } catch (error) {
      console.error("Error getting shipments:", error);
      return [];
    }
  }

  async getShipmentsByCompany(companyId: number): Promise<Shipment[]> {
    try {
      const companyShipments = await db.select().from(shipments).where(eq(shipments.companyId, companyId));
      
      // Cargar items para cada shipment
      const shipmentsWithItems = await Promise.all(
        companyShipments.map(async (shipment) => {
          const items = await this.getShipmentItems(shipment.id);
          return { ...shipment, items };
        })
      );
      
      return shipmentsWithItems as any;
    } catch (error) {
      console.error("Error getting shipments by company:", error);
      return [];
    }
  }

  async createShipment(shipment: InsertShipment): Promise<Shipment> {
    try {
      const [createdShipment] = await db.insert(shipments).values(shipment).returning();
      return createdShipment;
    } catch (error) {
      console.error("Error creating shipment:", error);
      throw error;
    }
  }

  async updateShipment(id: number, shipmentData: Partial<Shipment>): Promise<Shipment | undefined> {
    try {
      const [updatedShipment] = await db
        .update(shipments)
        .set({
          ...shipmentData,
          updatedAt: new Date()
        })
        .where(eq(shipments.id, id))
        .returning();
      return updatedShipment;
    } catch (error) {
      console.error("Error updating shipment:", error);
      return undefined;
    }
  }

  // Shipment Item operations
  async getShipmentItems(shipmentId: number): Promise<ShipmentItem[]> {
    try {
      return await db.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
    } catch (error) {
      console.error("Error getting shipment items:", error);
      return [];
    }
  }

  async createShipmentItem(item: InsertShipmentItem): Promise<ShipmentItem> {
    try {
      const [createdItem] = await db.insert(shipmentItems).values(item).returning();
      return createdItem;
    } catch (error) {
      console.error("Error creating shipment item:", error);
      throw error;
    }
  }

  async createShipmentItems(items: InsertShipmentItem[]): Promise<ShipmentItem[]> {
    try {
      if (items.length === 0) return [];
      const createdItems = await db.insert(shipmentItems).values(items).returning();
      return createdItems;
    } catch (error) {
      console.error("Error creating shipment items:", error);
      throw error;
    }
  }

  async updateShipmentItem(id: number, itemData: Partial<ShipmentItem>): Promise<ShipmentItem | undefined> {
    try {
      const [updatedItem] = await db
        .update(shipmentItems)
        .set(itemData)
        .where(eq(shipmentItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error("Error updating shipment item:", error);
      return undefined;
    }
  }

  async deleteShipmentItem(id: number): Promise<boolean> {
    try {
      await db.delete(shipmentItems).where(eq(shipmentItems.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting shipment item:", error);
      return false;
    }
  }

  // Shipment Update operations
  async getShipmentUpdate(id: number): Promise<ShipmentUpdate | undefined> {
    try {
      const [update] = await db.select().from(shipmentUpdates).where(eq(shipmentUpdates.id, id));
      return update;
    } catch (error) {
      console.error("Error getting shipment update:", error);
      return undefined;
    }
  }

  async getShipmentUpdates(shipmentId: number): Promise<ShipmentUpdate[]> {
    try {
      return await db
        .select()
        .from(shipmentUpdates)
        .where(eq(shipmentUpdates.shipmentId, shipmentId))
        .orderBy(desc(shipmentUpdates.timestamp));
    } catch (error) {
      console.error("Error getting shipment updates:", error);
      return [];
    }
  }

  async createShipmentUpdate(update: InsertShipmentUpdate): Promise<ShipmentUpdate> {
    try {
      const [createdUpdate] = await db.insert(shipmentUpdates).values(update).returning();
      return createdUpdate;
    } catch (error) {
      console.error("Error creating shipment update:", error);
      throw error;
    }
  }

  // Notification operations
  async getNotification(id: number): Promise<Notification | undefined> {
    try {
      const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
      return notification;
    } catch (error) {
      console.error("Error getting notification:", error);
      return undefined;
    }
  }

  async getNotificationsForUser(userId: number): Promise<Notification[]> {
    try {
      return await db
        .select({
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
          fromUserEmail: users.email,
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.fromUserId, users.id))
        .where(eq(notifications.toUserId, userId))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error getting notifications for user:", error);
      return [];
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const [createdNotification] = await db.insert(notifications).values(notification).returning();
      return createdNotification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  async markNotificationAsRead(id: number, userId: number): Promise<Notification | undefined> {
    try {
      const [updatedNotification] = await db
        .update(notifications)
        .set({ 
          read: true, 
          readAt: new Date() 
        })
        .where(and(
          eq(notifications.id, id),
          eq(notifications.toUserId, userId)
        ))
        .returning();
      return updatedNotification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return undefined;
    }
  }

  async deleteNotification(id: number, userId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(notifications)
        .where(and(
          eq(notifications.id, id),
          eq(notifications.toUserId, userId)
        ));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }

  // Team activity operations
  async getLastKpiUpdateByUser(_userId: number): Promise<{ kpiName: string; updateDate: Date; } | undefined> {
    // Las tablas por empresa no guardan historial por usuario; se regresa undefined
    return undefined;
  }

  async getTeamActivitySummary(): Promise<Array<{ userId: number; lastLogin: Date | null; lastKpiUpdate: { kpiName: string; updateDate: Date; } | null; }>> {
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
  async getJobProfile(id: number): Promise<JobProfile | undefined> {
    try {
      const [profile] = await db.select().from(jobProfiles).where(eq(jobProfiles.id, id));
      return profile;
    } catch (error) {
      console.error("Error getting job profile:", error);
      return undefined;
    }
  }

  async getJobProfileByUserArea(areaId: number, companyId: number): Promise<JobProfile | undefined> {
    try {
      const [profile] = await db.select().from(jobProfiles).where(
        and(eq(jobProfiles.areaId, areaId), eq(jobProfiles.companyId, companyId))
      );
      return profile;
    } catch (error) {
      console.error("Error getting job profile by area:", error);
      return undefined;
    }
  }

  async getJobProfileWithDetails(userId: number): Promise<JobProfileWithDetails | undefined> {
    try {
      console.log(`[JobProfile] Getting profile for user ID: ${userId}`);
      const user = await this.getUser(userId);
      console.log(`[JobProfile] User found:`, user);
      
      if (!user || !user.areaId || !user.companyId) {
        console.log(`[JobProfile] User or area/company missing for user ${userId}`);
        return undefined;
      }

      const profile = await this.getJobProfileByUserArea(user.areaId, user.companyId);
      console.log(`[JobProfile] Profile found:`, profile);
      
      if (!profile) {
        console.log(`[JobProfile] No profile found for area ${user.areaId}, company ${user.companyId}`);
        return undefined;
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
        mainActivities: profile.mainActivities as string[],
        responsibilities: profile.responsibilities as string[],
        kpiInstructions: profile.kpiInstructions as Array<{
          kpiName: string;
          description: string;
          updateFrequency: string;
          instructions: string;
        }>,
        tips: profile.tips as Array<{
          category: string;
          tip: string;
        }>,
        processes: profile.processes as Array<{
          name: string;
          description: string;
          steps: string[];
        }>,
        updateFrequency: profile.updateFrequency as {
          daily: string[];
          weekly: string[];
          monthly: string[];
        },
        areaName: area?.name || '',
        companyName: company?.name || '',
        userKpis: userKpis.map(kpi => ({
          id: kpi.id,
          name: kpi.name,
          target: kpi.target,
          frequency: kpi.frequency,
        })),
      };
      
      console.log(`[JobProfile] Returning profile with details:`, profileWithDetails);
      return profileWithDetails;
    } catch (error) {
      console.error("Error getting job profile with details:", error);
      return undefined;
    }
  }

  async createJobProfile(profile: InsertJobProfile): Promise<JobProfile> {
    try {
      const [newProfile] = await db.insert(jobProfiles).values(profile).returning();
      return newProfile;
    } catch (error) {
      console.error("Error creating job profile:", error);
      throw error;
    }
  }

  async updateJobProfile(id: number, profile: Partial<JobProfile>): Promise<JobProfile | undefined> {
    try {
      const [updatedProfile] = await db.update(jobProfiles)
        .set(profile)
        .where(eq(jobProfiles.id, id))
        .returning();
      return updatedProfile;
    } catch (error) {
      console.error("Error updating job profile:", error);
      return undefined;
    }
  }

  async getUserKpis(userId: number): Promise<Kpi[]> {
    try {
      const user = await this.getUser(userId);
      if (!user || !user.areaId || !user.companyId) {
        return [];
      }

      const companyKpis = await this.getCompanyKpisNormalized(user.companyId);
      return companyKpis.filter((kpi) => kpi.areaId === user.areaId);
    } catch (error) {
      console.error("Error getting user KPIs:", error);
      return [];
    }
  }

  async getKPIOverview(): Promise<any[]> {
    try {
      const [allUsers, areasList, companiesList] = await Promise.all([
        db.select().from(users),
        db.select().from(areas),
        db.select().from(companies),
      ]);

      const assignedUsers = allUsers.filter(
        (user) => user.areaId !== null && user.areaId !== undefined && user.companyId !== null && user.companyId !== undefined
      );

      const areaById = new Map(areasList.map((area) => [area.id, area]));
      const companyById = new Map(companiesList.map((company) => [company.id, company]));

      const uniqueCompanyIds = Array.from(
        new Set(
          assignedUsers
            .map((user) => user.companyId)
            .filter((companyId): companyId is number => typeof companyId === "number")
        )
      );

      const kpisByCompany = new Map<number, Kpi[]>();
      const valuesByCompany = new Map<number, KpiValue[]>();

      for (const companyId of uniqueCompanyIds) {
        try {
          const resolved = this.resolveCompany(companyId);
          const companyKpis = await this.getCompanyKpisNormalized(resolved);
          kpisByCompany.set(companyId, companyKpis);

          const companyValues = await this.getCompanyKpiValuesNormalized(resolved);
          valuesByCompany.set(companyId, companyValues);
        } catch (error) {
          console.warn(`[getKPIOverview] Company ${companyId} skipped: ${(error as Error).message}`);
        }
      }

      const latestValueMap = new Map<string, KpiValue>();
      for (const [companyId, values] of valuesByCompany.entries()) {
        for (const value of values) {
          const key = `${companyId}-${value.kpiId}`;
          const existing = latestValueMap.get(key);
          const valueDate = value.date ? new Date(value.date) : null;
          const existingDate = existing?.date ? new Date(existing.date) : null;
          if (!existing || (valueDate && existingDate && valueDate > existingDate)) {
            latestValueMap.set(key, value);
          }
        }
      }

      const parseNumericValue = (raw?: string | null) => {
        if (!raw) return NaN;
        const cleaned = raw.replace(/[^\d.-]/g, "");
        return parseFloat(cleaned);
      };

      const overview: any[] = [];

      for (const user of assignedUsers) {
        const area = user.areaId ? areaById.get(user.areaId) : undefined;
        const company = user.companyId ? companyById.get(user.companyId) : undefined;

        if (!area || !company) continue;

        const companyKpis = kpisByCompany.get(user.companyId!) ?? [];
        const relevantKpis = companyKpis.filter((kpi) => kpi.areaId === user.areaId);

        for (const kpi of relevantKpis) {
          const key = `${user.companyId}-${kpi.id}`;
          const latestValue = latestValueMap.get(key);

          const target = kpi.target ?? kpi.goal ?? null;
          const currentValue = latestValue?.value ?? null;
          const lastUpdate = latestValue?.date ?? null;

          let status = "non-compliant";
          const targetNumber = parseNumericValue(target);
          const currentNumber = parseNumericValue(currentValue);

          if (!isNaN(targetNumber) && !isNaN(currentNumber)) {
            const lowerBetter = this.isLowerBetterKPI(kpi.name);
            if (lowerBetter) {
              if (currentNumber <= targetNumber) {
                status = "compliant";
              } else if (currentNumber <= targetNumber * 1.1) {
                status = "alert";
              } else {
                status = "non-compliant";
              }
            } else {
              if (currentNumber >= targetNumber) {
                status = "compliant";
              } else if (currentNumber >= targetNumber * 0.9) {
                status = "alert";
              } else {
                status = "non-compliant";
              }
            }
          } else if (currentValue) {
            status = "alert";
          }

          overview.push({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            areaName: area.name,
            companyName: company.name,
            kpiId: kpi.id,
            kpiName: kpi.name,
            kpiTarget: target,
            kpiFrequency: kpi.frequency,
            kpiValue: currentValue,
            lastUpdate,
            status,
            trend: "stable",
          });
        }
      }

      return overview;
    } catch (error) {
      console.error("Error getting KPI overview:", error);
      return [];
    }
  }

  // Función auxiliar para determinar si un KPI es de "menor es mejor"
  private isLowerBetterKPI(kpiName: string): boolean {
    const lowerBetterKPIs = [
      'días de cobro',
      'días de pago',
      'tiempo de entrega',
      'huella de carbono',
      'costos',
      'gastos',
      'tiempo de respuesta',
      'defectos',
      'errores',
      'quejas',
      'devoluciones',
      'rotación',
      'tiempo de inactividad'
    ];
    
    const kpiNameLower = kpiName.toLowerCase();
    return lowerBetterKPIs.some(pattern => kpiNameLower.includes(pattern));
  }



  async getKPIHistory(kpiId: number, months: number = 12, companyId?: number): Promise<KpiValue[]> {
    try {
      const resolved =
        typeof companyId === "number"
          ? this.resolveCompany(companyId)
          : await this.findCompanyForKpiId(kpiId);

      if (!resolved) {
        return [];
      }

      const values = await this.getCompanyKpiValuesByKpiNormalized(resolved, kpiId);
      
      // Limitar antes de retornar para mejor rendimiento
      return values.slice(0, months);
    } catch (error) {
      console.error("[getKPIHistory] Error getting KPI history:", error);
      return [];
    }
  }

  async getUserKPIHistory(_userId: number, _months: number = 6): Promise<any[]> {
    // No existen valores históricos por usuario en las tablas específicas
    return [];
  }

  async getKPIHistoryByUsers(kpiId: number, _months: number = 6): Promise<any> {
    try {
      const companyId = await this.findCompanyForKpiId(kpiId);
      if (!companyId) {
        return null;
      }

      const kpi = await this.getCompanyKpiNormalized(companyId, kpiId);
      if (!kpi) {
        return null;
      }

      return {
        kpi,
        users: [],
      };
    } catch (error) {
      console.error("Error getting KPI history by users:", error);
      return null;
    }
  }

  // Shipment Cycle Times operations
  async getShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined> {
    try {
      const [cycleTime] = await db.select().from(shipmentCycleTimes).where(eq(shipmentCycleTimes.shipmentId, shipmentId));
      return cycleTime;
    } catch (error) {
      console.error("Error getting shipment cycle time:", error);
      return undefined;
    }
  }

  async upsertShipmentCycleTime(cycleTime: InsertShipmentCycleTimes): Promise<ShipmentCycleTimes> {
    try {
      // Try to update first
      const [existingCycleTime] = await db.select()
        .from(shipmentCycleTimes)
        .where(eq(shipmentCycleTimes.shipmentId, cycleTime.shipmentId));
      
      if (existingCycleTime) {
        // Update existing record
        const [updatedCycleTime] = await db.update(shipmentCycleTimes)
          .set({ 
            ...cycleTime,
            updatedAt: new Date() 
          })
          .where(eq(shipmentCycleTimes.shipmentId, cycleTime.shipmentId))
          .returning();
        return updatedCycleTime;
      } else {
        // Insert new record
        const [newCycleTime] = await db.insert(shipmentCycleTimes)
          .values(cycleTime)
          .returning();
        return newCycleTime;
      }
    } catch (error) {
      console.error("Error upserting shipment cycle time:", error);
      throw error;
    }
  }

  async recalculateShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined> {
    try {
      // Get the shipment and its updates
      const shipment = await this.getShipment(shipmentId);
      if (!shipment) {
        return undefined;
      }

      const updates = await this.getShipmentUpdates(shipmentId);
      
      // Initialize timestamps
      let pendingAt: Date | null = null;
      let inTransitAt: Date | null = null;
      let deliveredAt: Date | null = null;
      let closedAt: Date | null = null;

      // Find the first occurrence of each status
      for (const update of updates.reverse()) { // Process in chronological order
        switch (update.status) {
          case 'pending':
            if (!pendingAt) pendingAt = update.timestamp;
            break;
          case 'in_transit':
            if (!inTransitAt) inTransitAt = update.timestamp;
            break;
          case 'delivered':
            if (!deliveredAt) deliveredAt = update.timestamp;
            break;
          case 'cancelled':
            if (!closedAt) closedAt = update.timestamp;
            break;
        }
      }

      // Calculate durations in hours
      const calculateHours = (start: Date | null, end: Date | null): string | null => {
        if (!start || !end) return null;
        const diffMs = end.getTime() - start.getTime();
        return (diffMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours
      };

      const hoursPendingToTransit = calculateHours(pendingAt, inTransitAt);
      const hoursTransitToDelivered = calculateHours(inTransitAt, deliveredAt);
      const hoursDeliveredToClosed = calculateHours(deliveredAt, closedAt);
      const hoursTotalCycle = calculateHours(shipment.createdAt!, closedAt);
      const hoursToDelivery = calculateHours(shipment.createdAt!, deliveredAt);

      const cycleTimeData: InsertShipmentCycleTimes = {
        shipmentId: shipment.id,
        companyId: shipment.companyId,
        createdAt: shipment.createdAt!,
        pendingAt,
        inTransitAt,
        deliveredAt,
        closedAt,
        hoursPendingToTransit,
        hoursTransitToDelivered,
        hoursDeliveredToClosed,
        hoursTotalCycle,
        hoursToDelivery,
      };
      
      return await this.upsertShipmentCycleTime(cycleTimeData);
    } catch (error) {
      console.error("Error recalculating shipment cycle time:", error);
      return undefined;
    }
  }

  async getAggregateCycleTimes(companyId?: number, startDate?: string, endDate?: string): Promise<CycleTimeMetrics[]> {
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

      // Build WHERE conditions
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
        query = query.where(and(...conditions)) as typeof query;
      }

      const cycleTimes = await query;

      if (cycleTimes.length === 0) {
        return [{
          period: 'all',
          startDate: startDate || '',
          endDate: endDate || '',
          companyId,
          avgPendingToTransit: null,
          avgTransitToDelivered: null,
          avgDeliveredToClosed: null,
          avgTotalCycle: null,
          avgToDelivery: null,
          totalShipments: 0,
          completedShipments: 0,
        }];
      }

      // Calculate averages
      const validPendingToTransit = cycleTimes
        .filter(ct => ct.hoursPendingToTransit)
        .map(ct => parseFloat(ct.hoursPendingToTransit!));
      const validTransitToDelivered = cycleTimes
        .filter(ct => ct.hoursTransitToDelivered)
        .map(ct => parseFloat(ct.hoursTransitToDelivered!));
      const validDeliveredToClosed = cycleTimes
        .filter(ct => ct.hoursDeliveredToClosed)
        .map(ct => parseFloat(ct.hoursDeliveredToClosed!));
      const validTotalCycle = cycleTimes
        .filter(ct => ct.hoursTotalCycle)
        .map(ct => parseFloat(ct.hoursTotalCycle!));
      const validToDelivery = cycleTimes
        .filter(ct => ct.hoursToDelivery)
        .map(ct => parseFloat(ct.hoursToDelivery!));
      
      const avg = (arr: number[]): number | null => 
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      
      const completedShipments = cycleTimes.filter(ct => ct.closedAt).length;
      
      return [{
        period: 'all',
        startDate: startDate || '',
        endDate: endDate || '',
        companyId,
        avgPendingToTransit: avg(validPendingToTransit),
        avgTransitToDelivered: avg(validTransitToDelivered),
        avgDeliveredToClosed: avg(validDeliveredToClosed),
        avgTotalCycle: avg(validTotalCycle),
        avgToDelivery: avg(validToDelivery),
        totalShipments: cycleTimes.length,
        completedShipments,
      }];
    } catch (error) {
      console.error("Error getting aggregate cycle times:", error);
      return [{
        period: 'all',
        startDate: startDate || '',
        endDate: endDate || '',
        companyId,
        avgPendingToTransit: null,
        avgTransitToDelivered: null,
        avgDeliveredToClosed: null,
        avgTotalCycle: null,
        avgToDelivery: null,
        totalShipments: 0,
        completedShipments: 0,
      }];
    }
  }


  // Shipment notification operations (required by routes.ts)
  async createShipmentNotification(data: any): Promise<any> {
    try {
      // Create as generic notification with shipmentId
      return await this.createNotification({
        ...data,
        type: 'shipment'
      });
    } catch (error) {
      console.error("Error creating shipment notification:", error);
      throw error;
    }
  }

  async updateShipmentNotificationStatus(id: number, status: string, error?: string): Promise<any> {
    try {
      // Update notification with status info
      const [updated] = await db.update(notifications)
        .set({ 
          read: status === 'sent', 
          readAt: status === 'sent' ? new Date() : null
        })
        .where(eq(notifications.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating shipment notification status:", error);
      throw error;
    }
  }

  async getShipmentNotificationsByShipment(shipmentId: number): Promise<any[]> {
    try {
      // Query notifications by shipmentId in message field or custom field
      return await db.select().from(notifications)
        .where(sql`${notifications.message} LIKE '%shipment-${shipmentId}%' OR ${notifications.type} = 'shipment'`)
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error getting shipment notifications:", error);
      return [];
    }
  }

  // User Activation Token operations
  async createActivationToken(email: string): Promise<UserActivationToken> {
    try {
      // Generate secure random token
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15) +
                   Date.now().toString(36);
      
      // Token expires in 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const tokenData = {
        token,
        email,
        expiresAt,
        used: false
      };

      const [activationToken] = await db.insert(userActivationTokens)
        .values(tokenData)
        .returning();
      
      return activationToken;
    } catch (error) {
      console.error("Error creating activation token:", error);
      throw error;
    }
  }

  async getActivationToken(token: string): Promise<UserActivationToken | undefined> {
    try {
      const [activationToken] = await db.select().from(userActivationTokens)
        .where(eq(userActivationTokens.token, token));
      return activationToken;
    } catch (error) {
      console.error("Error getting activation token:", error);
      return undefined;
    }
  }

  async markTokenAsUsed(token: string): Promise<boolean> {
    try {
      const result = await db.update(userActivationTokens)
        .set({ used: true })
        .where(eq(userActivationTokens.token, token));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error marking token as used:", error);
      return false;
    }
  }

  async deleteExpiredTokens(): Promise<void> {
    try {
      await db.delete(userActivationTokens)
        .where(sql`${userActivationTokens.expiresAt} < NOW()`);
    } catch (error) {
      console.error("Error deleting expired tokens:", error);
    }
  }

  // Client operations (for Treasury module)
  async getClient(id: number): Promise<Client | undefined> {
    try {
      const [client] = await db.select().from(clients).where(eq(clients.id, id));
      return client;
    } catch (error) {
      console.error("Error getting client:", error);
      return undefined;
    }
  }

  async getClients(): Promise<Client[]> {
    try {
      return await db.select().from(clients).orderBy(clients.name);
    } catch (error) {
      console.error("Error getting clients:", error);
      return [];
    }
  }

  async getClientsByCompany(companyId: number): Promise<Client[]> {
    try {
      return await db.select().from(clients)
        .where(eq(clients.companyId, companyId))
        .orderBy(clients.name);
    } catch (error) {
      console.error("Error getting clients by company:", error);
      return [];
    }
  }

  async createClient(client: InsertClient): Promise<Client> {
    try {
      const [createdClient] = await db.insert(clients).values(client).returning();
      return createdClient;
    } catch (error) {
      console.error("Error creating client:", error);
      throw error;
    }
  }

  async updateClient(id: number, clientData: Partial<Client>): Promise<Client | undefined> {
    try {
      const [updatedClient] = await db
        .update(clients)
        .set({ ...clientData, updatedAt: new Date() })
        .where(eq(clients.id, id))
        .returning();
      return updatedClient;
    } catch (error) {
      console.error("Error updating client:", error);
      return undefined;
    }
  }

  // Payment Voucher operations (for Treasury module)
  async getPaymentVoucher(id: number): Promise<PaymentVoucher | undefined> {
    try {
      const [voucher] = await db.select().from(paymentVouchers).where(eq(paymentVouchers.id, id));
      return voucher;
    } catch (error) {
      console.error("Error getting payment voucher:", error);
      return undefined;
    }
  }

  async getPaymentVouchers(): Promise<PaymentVoucher[]> {
    try {
      return await db.select().from(paymentVouchers).orderBy(desc(paymentVouchers.createdAt));
    } catch (error) {
      console.error("Error getting payment vouchers:", error);
      return [];
    }
  }

  async getPaymentVouchersByCompany(companyId: number): Promise<PaymentVoucher[]> {
    try {
      return await db.select().from(paymentVouchers)
        .where(eq(paymentVouchers.companyId, companyId))
        .orderBy(desc(paymentVouchers.createdAt));
    } catch (error) {
      console.error("Error getting payment vouchers by company:", error);
      return [];
    }
  }

  async getPaymentVouchersByStatus(status: string, companyId?: number): Promise<PaymentVoucher[]> {
    try {
      if (companyId) {
        return await db.select().from(paymentVouchers)
          .where(and(
            eq(paymentVouchers.status, status as any),
            eq(paymentVouchers.companyId, companyId)
          ))
          .orderBy(desc(paymentVouchers.createdAt));
      } else {
        return await db.select().from(paymentVouchers)
          .where(eq(paymentVouchers.status, status as any))
          .orderBy(desc(paymentVouchers.createdAt));
      }
    } catch (error) {
      console.error("Error getting payment vouchers by status:", error);
      return [];
    }
  }

  async createPaymentVoucher(voucher: InsertPaymentVoucher): Promise<PaymentVoucher> {
    try {
      const [createdVoucher] = await db.insert(paymentVouchers).values(voucher).returning();
      return createdVoucher;
    } catch (error) {
      console.error("Error creating payment voucher:", error);
      throw error;
    }
  }

  // Scheduled Payment operations
  async createScheduledPayment(payment: InsertScheduledPayment): Promise<ScheduledPayment> {
    try {
      const [createdPayment] = await db
        .insert(scheduledPayments)
        .values({
          ...payment,
          updatedAt: new Date()
        })
        .returning();

      console.log('[DatabaseStorage] Scheduled payment created:', createdPayment.id);
      return createdPayment;
    } catch (error) {
      console.error('[DatabaseStorage] Error creating scheduled payment:', error);
      throw error;
    }
  }

  async getScheduledPayment(id: number): Promise<ScheduledPayment | undefined> {
    try {
      const [payment] = await db
        .select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.id, id))
        .limit(1);
      return payment;
    } catch (error) {
      console.error('[DatabaseStorage] Error getting scheduled payment:', error);
      return undefined;
    }
  }

  async getScheduledPaymentsByCompany(companyId: number): Promise<ScheduledPayment[]> {
    try {
      const payments = await db
        .select()
        .from(scheduledPayments)
        .where(eq(scheduledPayments.companyId, companyId))
        .orderBy(scheduledPayments.dueDate);
      return payments;
    } catch (error) {
      console.error('[DatabaseStorage] Error getting scheduled payments by company:', error);
      return [];
    }
  }

  async updateScheduledPayment(id: number, payment: Partial<InsertScheduledPayment>): Promise<ScheduledPayment | undefined> {
    try {
      const [updatedPayment] = await db
        .update(scheduledPayments)
        .set({ ...payment, updatedAt: new Date() })
        .where(eq(scheduledPayments.id, id))
        .returning();
      return updatedPayment;
    } catch (error) {
      console.error('[DatabaseStorage] Error updating scheduled payment:', error);
      return undefined;
    }
  }

  async deleteScheduledPayment(id: number): Promise<boolean> {
    try {
      await db
        .delete(scheduledPayments)
        .where(eq(scheduledPayments.id, id));
      return true;
    } catch (error) {
      console.error('[DatabaseStorage] Error deleting scheduled payment:', error);
      return false;
    }
  }

  async updatePaymentVoucher(id: number, voucherData: Partial<PaymentVoucher>): Promise<PaymentVoucher | undefined> {
    try {
      const [updatedVoucher] = await db
        .update(paymentVouchers)
        .set({ ...voucherData, updatedAt: new Date() })
        .where(eq(paymentVouchers.id, id))
        .returning();
      return updatedVoucher;
    } catch (error) {
      console.error("Error updating payment voucher:", error);
      return undefined;
    }
  }

  async updatePaymentVoucherStatus(id: number, status: string): Promise<PaymentVoucher | undefined> {
    try {
      const [updatedVoucher] = await db
        .update(paymentVouchers)
        .set({ status: status as any, updatedAt: new Date() })
        .where(eq(paymentVouchers.id, id))
        .returning();
      return updatedVoucher;
    } catch (error) {
      console.error("Error updating payment voucher status:", error);
      return undefined;
    }
  }

  // Métodos faltantes requeridos por IStorage
  async getShipmentsByStatus(status: string): Promise<Shipment[]> {
    try {
      const result = await db
        .select()
        .from(shipments)
        .where(eq(shipments.status, status as any));
      return result;
    } catch (error) {
      console.error("Error getting shipments by status:", error);
      return [];
    }
  }

  async getShipmentsByCompanyAndStatus(companyId: number, status: string): Promise<Shipment[]> {
    try {
      const result = await db
        .select()
        .from(shipments)
        .where(and(
          eq(shipments.companyId, companyId),
          eq(shipments.status, status as any)
        ));
      return result;
    } catch (error) {
      console.error("Error getting shipments by company and status:", error);
      return [];
    }
  }

  async getShipmentUpdatesByShipment(shipmentId: number): Promise<any[]> {
    try {
      // Implementar según el esquema de actualizaciones de envíos
      return [];
    } catch (error) {
      console.error("Error getting shipment updates:", error);
      return [];
    }
  }

  async getShipmentNotification(notificationId: number): Promise<any> {
    try {
      // Implementar según el esquema de notificaciones
      return null;
    } catch (error) {
      console.error("Error getting shipment notification:", error);
      return null;
    }
  }
}

export const storage = new DatabaseStorage();
