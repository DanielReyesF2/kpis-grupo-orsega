import { 
  users, companies, areas, kpis, kpiValues, kpiValuesDura, kpiValuesOrsega, actionPlans, shipments, shipmentItems, shipmentUpdates, notifications, jobProfiles, shipmentCycleTimes, userActivationTokens, clients, paymentVouchers 
} from "@shared/schema";
import type { 
  User, InsertUser, 
  Company, InsertCompany, 
  Area, InsertArea, 
  Kpi, InsertKpi,
  KpiValue, InsertKpiValue,
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
  PaymentVoucher, InsertPaymentVoucher
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNotNull, isNull, sql, avg, count, gte } from "drizzle-orm";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  constructor() {
    // Removed session store since JWT is used for authentication
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
  async getKpi(id: number): Promise<Kpi | undefined> {
    try {
      const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
      return kpi;
    } catch (error) {
      console.error("Error getting KPI:", error);
      return undefined;
    }
  }

  async getKpis(): Promise<Kpi[]> {
    try {
      return await db.select().from(kpis);
    } catch (error) {
      console.error("Error getting KPIs:", error);
      return [];
    }
  }

  async getKpisByCompany(companyId: number): Promise<Kpi[]> {
    try {
      return await db.select().from(kpis).where(eq(kpis.companyId, companyId));
    } catch (error) {
      console.error("Error getting KPIs by company:", error);
      return [];
    }
  }

  async getKpisByArea(areaId: number): Promise<Kpi[]> {
    try {
      return await db.select().from(kpis).where(eq(kpis.areaId, areaId));
    } catch (error) {
      console.error("Error getting KPIs by area:", error);
      return [];
    }
  }

  async getKpisByCompanyAndArea(companyId: number, areaId: number): Promise<Kpi[]> {
    try {
      return await db.select().from(kpis).where(
        and(eq(kpis.companyId, companyId), eq(kpis.areaId, areaId))
      );
    } catch (error) {
      console.error("Error getting KPIs by company and area:", error);
      return [];
    }
  }

  async createKpi(kpi: InsertKpi): Promise<Kpi> {
    try {
      const [createdKpi] = await db.insert(kpis).values(kpi).returning();
      return createdKpi;
    } catch (error) {
      console.error("Error creating KPI:", error);
      throw error;
    }
  }

  async updateKpi(id: number, kpiData: Partial<Kpi>): Promise<Kpi | undefined> {
    try {
      const [updatedKpi] = await db
        .update(kpis)
        .set(kpiData)
        .where(eq(kpis.id, id))
        .returning();
      return updatedKpi;
    } catch (error) {
      console.error("Error updating KPI:", error);
      return undefined;
    }
  }

  async deleteKpi(id: number): Promise<boolean> {
    try {
      // Primero eliminar todos los valores asociados al KPI
      await db.delete(kpiValues).where(eq(kpiValues.kpiId, id));
      
      // Luego eliminar el KPI
      const result = await db.delete(kpis).where(eq(kpis.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting KPI:", error);
      return false;
    }
  }

  // KPI Value operations
  async getKpiValue(id: number): Promise<KpiValue | undefined> {
    try {
      const [kpiValue] = await db.select().from(kpiValues).where(eq(kpiValues.id, id));
      return kpiValue;
    } catch (error) {
      console.error("Error getting KPI value:", error);
      return undefined;
    }
  }

  async getKpiValues(): Promise<KpiValue[]> {
    try {
      return await db.select().from(kpiValues);
    } catch (error) {
      console.error("Error getting KPI values:", error);
      return [];
    }
  }

  async getKpiValuesByKpi(kpiId: number): Promise<KpiValue[]> {
    try {
      return await db.select().from(kpiValues).where(eq(kpiValues.kpiId, kpiId));
    } catch (error) {
      console.error("Error getting KPI values by KPI:", error);
      return [];
    }
  }

  async getKpiValuesByUser(userId: number): Promise<KpiValue[]> {
    try {
      return await db.select().from(kpiValues).where(eq(kpiValues.userId, userId));
    } catch (error) {
      console.error("Error getting KPI values by user:", error);
      return [];
    }
  }

  async deleteKpiValuesByUser(userId: number, kpiId: number): Promise<boolean> {
    try {
      const result = await db.delete(kpiValues).where(
        and(eq(kpiValues.userId, userId), eq(kpiValues.kpiId, kpiId))
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error deleting KPI values by user:", error);
      return false;
    }
  }

  async getLatestKpiValues(kpiId: number, limit: number): Promise<KpiValue[]> {
    try {
      return await db
        .select()
        .from(kpiValues)
        .where(eq(kpiValues.kpiId, kpiId))
        .orderBy(desc(kpiValues.date))
        .limit(limit);
    } catch (error) {
      console.error("Error getting latest KPI values:", error);
      return [];
    }
  }

  async createKpiValue(kpiValue: InsertKpiValue): Promise<KpiValue> {
    try {
      // Asegurarse de que la fecha se establezca correctamente para nuevos valores
      const valueWithDate = {
        ...kpiValue,
        date: new Date()
      };
      
      const [createdKpiValue] = await db.insert(kpiValues).values(valueWithDate).returning();
      return createdKpiValue;
    } catch (error) {
      console.error("Error creating KPI value:", error);
      // Reparar desincronización de secuencia si aplica (duplicate key on primary key)
      const err: any = error;
      if (err?.code === '23505' && String(err?.detail || '').includes('kpi_values_pkey')) {
        try {
          console.warn('[KPI] Detected sequence mismatch on kpi_values.id. Repairing sequence and retrying...');
          // Set sequence to max(id)+1
          await db.execute(sql`SELECT setval(
            pg_get_serial_sequence('kpi_values','id'),
            COALESCE((SELECT MAX(id) + 1 FROM kpi_values), 1),
            false
          )`);
          const [createdAfterFix] = await db.insert(kpiValues).values({
            ...kpiValue,
            date: new Date()
          }).returning();
          return createdAfterFix;
        } catch (repairError) {
          console.error('[KPI] Sequence repair failed:', repairError);
        }
      }
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
  async getLastKpiUpdateByUser(userId: number): Promise<{ kpiName: string; updateDate: Date; } | undefined> {
    try {
      const [latestUpdate] = await db
        .select({
          kpiName: kpis.name,
          updateDate: kpiValues.date
        })
        .from(kpiValues)
        .leftJoin(kpis, eq(kpiValues.kpiId, kpis.id))
        .where(eq(kpiValues.updatedBy, userId))
        .orderBy(desc(kpiValues.date))
        .limit(1);
      
      return latestUpdate;
    } catch (error) {
      console.error("Error getting last KPI update by user:", error);
      return undefined;
    }
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

      const userKpis = await db.select().from(kpis).where(
        and(eq(kpis.areaId, user.areaId), eq(kpis.companyId, user.companyId))
      );
      return userKpis;
    } catch (error) {
      console.error("Error getting user KPIs:", error);
      return [];
    }
  }

  async getKPIOverview(): Promise<any[]> {
    try {
      const result = await db.select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        areaName: areas.name,
        companyName: companies.name,
        kpiId: kpis.id,
        kpiName: kpis.name,
        kpiTarget: kpis.target,
        kpiFrequency: kpis.frequency,
        kpiValue: kpiValues.value,
        lastUpdate: kpiValues.date
      })
      .from(users)
      .innerJoin(areas, eq(users.areaId, areas.id))
      .innerJoin(companies, eq(users.companyId, companies.id))
      .innerJoin(kpis, and(eq(kpis.areaId, areas.id), eq(kpis.companyId, companies.id)))
      .leftJoin(kpiValues, eq(kpiValues.kpiId, kpis.id))
      .where(and(isNotNull(users.areaId), isNotNull(users.companyId)))
      .orderBy(desc(kpiValues.date));

      // Agrupar por usuario y KPI, tomando el valor más reciente
      const groupedResults = new Map();
      
      for (const row of result) {
        const key = `${row.userId}-${row.kpiId}`;
        if (!groupedResults.has(key)) {
          // Calcular estado basado en el valor actual vs target
          let status = 'non-compliant'; // Por defecto es no cumple si no hay datos
          
          if (row.kpiValue && row.kpiTarget) {
            // Función para extraer valores numéricos
            const extractNumericValue = (value: string): number => {
              const cleanValue = value.replace(/[^\d.-]/g, '');
              return parseFloat(cleanValue);
            };
            
            const currentValue = extractNumericValue(row.kpiValue);
            const targetValue = extractNumericValue(row.kpiTarget);
            
            if (!isNaN(currentValue) && !isNaN(targetValue)) {
              // Determinar si es una métrica invertida (menor es mejor)
              const isLowerBetter = this.isLowerBetterKPI(row.kpiName);
              
              if (isLowerBetter) {
                // Para métricas donde menor es mejor
                if (currentValue <= targetValue) {
                  status = 'compliant';
                } else if (currentValue <= targetValue * 1.1) {
                  status = 'alert';
                } else {
                  status = 'non-compliant';
                }
              } else {
                // Para métricas donde mayor es mejor
                if (currentValue >= targetValue) {
                  status = 'compliant';
                } else if (currentValue >= targetValue * 0.9) {
                  status = 'alert';
                } else {
                  status = 'non-compliant';
                }
              }
            }
          }

          groupedResults.set(key, {
            ...row,
            status,
            trend: 'stable' // Por ahora, después implementaremos cálculo de tendencia
          });
        }
      }

      return Array.from(groupedResults.values());
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



  async getKPIHistory(kpiId: number, months: number = 12): Promise<any[]> {
    try {
      // Usar neon directamente para consultar las tablas específicas
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL!);
      
      // Primero buscar en qué tabla está el KPI (kpis_dura o kpis_orsega)
      let kpiInfo: any = null;
      let isOrsega = false;
      
      // Intentar buscar en kpis_orsega primero
      const orsegaResult = await sql`
        SELECT id, area, kpi_name, responsible
        FROM kpis_orsega
        WHERE id = ${kpiId}
        LIMIT 1
      `;
      
      if (orsegaResult && orsegaResult.length > 0) {
        kpiInfo = orsegaResult[0];
        isOrsega = true;
        console.log(`[getKPIHistory] ✅ KPI ${kpiId} encontrado en kpis_orsega: ${kpiInfo.kpi_name}`);
      } else {
        console.log(`[getKPIHistory] KPI ${kpiId} no encontrado en kpis_orsega, buscando en kpis_dura...`);
        // Buscar en kpis_dura
        const duraResult = await sql`
          SELECT id, area, kpi_name, responsible
          FROM kpis_dura
          WHERE id = ${kpiId}
          LIMIT 1
        `;
        
        if (duraResult && duraResult.length > 0) {
          kpiInfo = duraResult[0];
          isOrsega = false;
          console.log(`[getKPIHistory] ✅ KPI ${kpiId} encontrado en kpis_dura: ${kpiInfo.kpi_name}`);
        } else {
          console.log(`[getKPIHistory] ⚠️ KPI ${kpiId} no encontrado en kpis_dura ni kpis_orsega`);
        }
      }
      
      if (!kpiInfo) {
        console.error(`[getKPIHistory] ❌ KPI ${kpiId} no encontrado en kpis_dura ni kpis_orsega`);
        return [];
      }

      // Buscar valores históricos usando el mismo kpi_id
      // Cada compañía usa su tabla específica: kpi_values_dura o kpi_values_orsega
      let result: any[] = [];
      
      if (isOrsega) {
        // Orsega - SOLO buscar en kpi_values_orsega
        let rawResult = await sql`
          SELECT 
            id,
            kpi_id as "kpiId",
            month,
            year,
            value,
            created_at as "date"
          FROM kpi_values_orsega
          WHERE kpi_id = ${kpiId}
          ORDER BY year DESC, 
            CASE month
              WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3
              WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6
              WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9
              WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12
              ELSE 13
            END DESC
          LIMIT ${months}
        `;
        
        console.log(`[getKPIHistory] KPI ${kpiId} Orsega - Encontrados ${rawResult.length} registros en kpi_values_orsega por kpi_id=${kpiId}`);
        if (rawResult.length > 0) {
          console.log(`[getKPIHistory] Muestra de registros encontrados:`, JSON.stringify(rawResult.slice(0, 2), null, 2));
        }
        
        // Si no encuentra por ID, buscar por nombre de KPI usando JOIN
        if (rawResult.length === 0 && kpiInfo?.kpi_name) {
          console.log(`[getKPIHistory] KPI ${kpiId} Orsega - No se encontraron registros por ID, buscando por nombre "${kpiInfo.kpi_name}" usando JOIN...`);
          const joinResult = await sql`
            SELECT 
              kv.id,
              kv.kpi_id as "kpiId",
              kv.month,
              kv.year,
              kv.value,
              kv.created_at as "date"
            FROM kpi_values_orsega kv
            INNER JOIN kpis_orsega k ON kv.kpi_id = k.id
            WHERE k.kpi_name = ${kpiInfo.kpi_name}
            ORDER BY kv.year DESC,
              CASE kv.month
                WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3
                WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6
                WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9
                WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12
                ELSE 13
              END DESC
            LIMIT ${months}
          `;
          
          console.log(`[getKPIHistory] KPI ${kpiId} Orsega - Encontrados ${joinResult.length} registros por nombre usando JOIN`);
          rawResult = joinResult;
        }
        
        // Convertir datos a formato estándar
        result = rawResult.map((row: any) => ({
          id: row.id,
          value: row.value?.toString() || '0',
          date: row.date || new Date(),
          period: `${row.month} ${row.year}`,
          compliancePercentage: null,
          status: null,
          comments: null,
          updatedBy: null
        }));
      } else {
        // Dura - SOLO buscar en kpi_values_dura
        let rawResult = await sql`
          SELECT 
            id,
            kpi_id as "kpiId",
            month,
            year,
            value,
            created_at as "date"
          FROM kpi_values_dura
          WHERE kpi_id = ${kpiId}
          ORDER BY year DESC,
            CASE month
              WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3
              WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6
              WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9
              WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12
              ELSE 13
            END DESC
          LIMIT ${months}
        `;
        
        console.log(`[getKPIHistory] KPI ${kpiId} Dura - Encontrados ${rawResult.length} registros en kpi_values_dura por kpi_id=${kpiId}`);
        if (rawResult.length > 0) {
          console.log(`[getKPIHistory] Muestra de registros encontrados:`, JSON.stringify(rawResult.slice(0, 2), null, 2));
        }
        
        // Si no encuentra por ID, buscar por nombre de KPI usando JOIN
        if (rawResult.length === 0 && kpiInfo?.kpi_name) {
          console.log(`[getKPIHistory] KPI ${kpiId} Dura - No se encontraron registros por ID, buscando por nombre "${kpiInfo.kpi_name}" usando JOIN...`);
          const joinResult = await sql`
            SELECT 
              kv.id,
              kv.kpi_id as "kpiId",
              kv.month,
              kv.year,
              kv.value,
              kv.created_at as "date"
            FROM kpi_values_dura kv
            INNER JOIN kpis_dura k ON kv.kpi_id = k.id
            WHERE k.kpi_name = ${kpiInfo.kpi_name}
            ORDER BY kv.year DESC,
              CASE kv.month
                WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3
                WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6
                WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9
                WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12
                ELSE 13
              END DESC
            LIMIT ${months}
          `;
          
          console.log(`[getKPIHistory] KPI ${kpiId} Dura - Encontrados ${joinResult.length} registros por nombre usando JOIN`);
          rawResult = joinResult;
        }
        
        // Convertir datos a formato estándar
        result = rawResult.map((row: any) => ({
          id: row.id,
          value: row.value?.toString() || '0',
          date: row.date || new Date(),
          period: `${row.month} ${row.year}`,
          compliancePercentage: null,
          status: null,
          comments: null,
          updatedBy: null
        }));
      }


      console.log(`[getKPIHistory] KPI ${kpiId} (${isOrsega ? 'Orsega' : 'Dura'}) history:`, result.length, 'records');
      return result;
    } catch (error) {
      console.error("Error getting KPI history:", error);
      return [];
    }
  }

  async getUserKPIHistory(userId: number, months: number = 6): Promise<any[]> {
    try {
      // Calcular fecha límite (X meses atrás desde hoy)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      const userKPIHistory = await db.select({
        kpiId: kpiValues.kpiId,
        kpiName: kpis.name,
        kpiTarget: kpis.target,
        kpiUnit: kpis.unit,
        kpiFrequency: kpis.frequency,
        companyId: kpis.companyId,
        companyName: companies.name,
        areaName: areas.name,
        valueId: kpiValues.id,
        value: kpiValues.value,
        date: kpiValues.date,
        period: kpiValues.period,
        compliancePercentage: kpiValues.compliancePercentage,
        status: kpiValues.status,
        comments: kpiValues.comments,
      })
      .from(kpiValues)
      .innerJoin(kpis, eq(kpiValues.kpiId, kpis.id))
      .innerJoin(companies, eq(kpis.companyId, companies.id))
      .innerJoin(areas, eq(kpis.areaId, areas.id))
      .where(
        and(
          eq(kpiValues.userId, userId),
          gte(kpiValues.date, cutoffDate)
        )
      )
      .orderBy(desc(kpiValues.date));

      console.log(`[getUserKPIHistory] User ${userId} history (${userKPIHistory.length} records) desde ${cutoffDate.toISOString()}`);
      return userKPIHistory;
    } catch (error) {
      console.error("Error getting user KPI history:", error);
      return [];
    }
  }

  async getKPIHistoryByUsers(kpiId: number, months: number = 6): Promise<any> {
    try {
      // Calcular fecha de corte (X meses atrás)
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // Obtener información del KPI
      const [kpiInfo] = await db.select({
        id: kpis.id,
        name: kpis.name,
        target: kpis.target,
        unit: kpis.unit,
        frequency: kpis.frequency,
        companyId: kpis.companyId,
        companyName: companies.name,
        areaId: kpis.areaId,
        areaName: areas.name,
      })
      .from(kpis)
      .innerJoin(companies, eq(kpis.companyId, companies.id))
      .innerJoin(areas, eq(kpis.areaId, areas.id))
      .where(eq(kpis.id, kpiId));

      if (!kpiInfo) {
        return null;
      }

      // Obtener todos los valores del KPI con información de usuarios
      const kpiHistory = await db.select({
        valueId: kpiValues.id,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        value: kpiValues.value,
        date: kpiValues.date,
        period: kpiValues.period,
        compliancePercentage: kpiValues.compliancePercentage,
        status: kpiValues.status,
        comments: kpiValues.comments,
      })
      .from(kpiValues)
      .innerJoin(users, eq(kpiValues.userId, users.id))
      .where(
        and(
          eq(kpiValues.kpiId, kpiId),
          gte(kpiValues.date, cutoffDate)
        )
      )
      .orderBy(desc(kpiValues.date));

      // Agrupar por usuario
      const userHistoryMap = new Map();
      for (const record of kpiHistory) {
        if (!userHistoryMap.has(record.userId)) {
          userHistoryMap.set(record.userId, {
            userId: record.userId,
            userName: record.userName,
            userEmail: record.userEmail,
            values: []
          });
        }
        userHistoryMap.get(record.userId).values.push({
          valueId: record.valueId,
          value: record.value,
          date: record.date,
          period: record.period,
          compliancePercentage: record.compliancePercentage,
          status: record.status,
          comments: record.comments,
        });
      }

      console.log(`[getKPIHistoryByUsers] KPI ${kpiId} history: ${userHistoryMap.size} users, ${kpiHistory.length} total records desde ${cutoffDate.toISOString()}`);

      return {
        kpi: kpiInfo,
        users: Array.from(userHistoryMap.values())
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

  // Scheduled Payment operations (placeholder for IDRALL integration)
  async createScheduledPayment(payment: any): Promise<any> {
    // This is a placeholder method for IDRALL integration
    // In a real implementation, this would create a scheduled payment record
    console.log('Creating scheduled payment:', payment);
    return { id: Date.now(), ...payment };
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
