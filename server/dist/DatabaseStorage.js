"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("@shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const db_2 = require("./db");
const PostgresSessionStore = (0, connect_pg_simple_1.default)(express_session_1.default);
class DatabaseStorage {
    constructor() {
        this.sessionStore = new PostgresSessionStore({
            pool: db_2.pool,
            createTableIfMissing: true
        });
    }
    // User operations
    async getUser(id) {
        try {
            const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
            return user;
        }
        catch (error) {
            console.error("Error getting user:", error);
            return undefined;
        }
    }
    async getUserByEmail(email) {
        try {
            const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
            return user;
        }
        catch (error) {
            console.error("Error getting user by email:", error);
            return undefined;
        }
    }
    async getUserByUsername(username) {
        try {
            // Si el username es un email completo, buscar por email
            if (username.includes('@')) {
                const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, username));
                return user;
            }
            // Si no es un email, buscar por la parte antes del @ en el email
            // Ejemplo: "omarnavarro" debe encontrar "omarnavarro@duraintal.com"
            const allUsers = await db_1.db.select().from(schema_1.users);
            return allUsers.find(user => {
                const emailParts = user.email.toLowerCase().split('@');
                return emailParts.length > 0 && emailParts[0] === username.toLowerCase();
            });
        }
        catch (error) {
            console.error("Error getting user by username:", error);
            return undefined;
        }
    }
    async createUser(user) {
        try {
            const [createdUser] = await db_1.db.insert(schema_1.users).values(user).returning();
            return createdUser;
        }
        catch (error) {
            console.error("Error creating user:", error);
            throw error;
        }
    }
    async updateUser(id, userData) {
        try {
            const [updatedUser] = await db_1.db
                .update(schema_1.users)
                .set(userData)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
                .returning();
            return updatedUser;
        }
        catch (error) {
            console.error("Error updating user:", error);
            return undefined;
        }
    }
    async getUsers() {
        try {
            return await db_1.db.select().from(schema_1.users);
        }
        catch (error) {
            console.error("Error getting users:", error);
            return [];
        }
    }
    async deleteUser(id) {
        try {
            const result = await db_1.db.delete(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
            return result.rowCount !== null && result.rowCount > 0;
        }
        catch (error) {
            console.error("Error deleting user:", error);
            return false;
        }
    }
    // Company operations
    async getCompany(id) {
        try {
            const [company] = await db_1.db.select().from(schema_1.companies).where((0, drizzle_orm_1.eq)(schema_1.companies.id, id));
            return company;
        }
        catch (error) {
            console.error("Error getting company:", error);
            return undefined;
        }
    }
    async getCompanies() {
        try {
            return await db_1.db.select().from(schema_1.companies);
        }
        catch (error) {
            console.error("Error getting companies:", error);
            return [];
        }
    }
    async createCompany(company) {
        try {
            const [createdCompany] = await db_1.db.insert(schema_1.companies).values(company).returning();
            return createdCompany;
        }
        catch (error) {
            console.error("Error creating company:", error);
            throw error;
        }
    }
    async updateCompany(id, companyData) {
        try {
            const [updatedCompany] = await db_1.db
                .update(schema_1.companies)
                .set(companyData)
                .where((0, drizzle_orm_1.eq)(schema_1.companies.id, id))
                .returning();
            return updatedCompany;
        }
        catch (error) {
            console.error("Error updating company:", error);
            return undefined;
        }
    }
    // Area operations
    async getArea(id) {
        try {
            const [area] = await db_1.db.select().from(schema_1.areas).where((0, drizzle_orm_1.eq)(schema_1.areas.id, id));
            return area;
        }
        catch (error) {
            console.error("Error getting area:", error);
            return undefined;
        }
    }
    async getAreas() {
        try {
            return await db_1.db.select().from(schema_1.areas);
        }
        catch (error) {
            console.error("Error getting areas:", error);
            return [];
        }
    }
    async getAreasByCompany(companyId) {
        try {
            return await db_1.db.select().from(schema_1.areas).where((0, drizzle_orm_1.eq)(schema_1.areas.companyId, companyId));
        }
        catch (error) {
            console.error("Error getting areas by company:", error);
            return [];
        }
    }
    async createArea(area) {
        try {
            const [createdArea] = await db_1.db.insert(schema_1.areas).values(area).returning();
            return createdArea;
        }
        catch (error) {
            console.error("Error creating area:", error);
            throw error;
        }
    }
    async updateArea(id, areaData) {
        try {
            const [updatedArea] = await db_1.db
                .update(schema_1.areas)
                .set(areaData)
                .where((0, drizzle_orm_1.eq)(schema_1.areas.id, id))
                .returning();
            return updatedArea;
        }
        catch (error) {
            console.error("Error updating area:", error);
            return undefined;
        }
    }
    // KPI operations
    async getKpi(id) {
        try {
            const [kpi] = await db_1.db.select().from(schema_1.kpis).where((0, drizzle_orm_1.eq)(schema_1.kpis.id, id));
            return kpi;
        }
        catch (error) {
            console.error("Error getting KPI:", error);
            return undefined;
        }
    }
    async getKpis() {
        try {
            return await db_1.db.select().from(schema_1.kpis);
        }
        catch (error) {
            console.error("Error getting KPIs:", error);
            return [];
        }
    }
    async getKpisByCompany(companyId) {
        try {
            return await db_1.db.select().from(schema_1.kpis).where((0, drizzle_orm_1.eq)(schema_1.kpis.companyId, companyId));
        }
        catch (error) {
            console.error("Error getting KPIs by company:", error);
            return [];
        }
    }
    async getKpisByArea(areaId) {
        try {
            return await db_1.db.select().from(schema_1.kpis).where((0, drizzle_orm_1.eq)(schema_1.kpis.areaId, areaId));
        }
        catch (error) {
            console.error("Error getting KPIs by area:", error);
            return [];
        }
    }
    async getKpisByCompanyAndArea(companyId, areaId) {
        try {
            return await db_1.db.select().from(schema_1.kpis).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.kpis.companyId, companyId), (0, drizzle_orm_1.eq)(schema_1.kpis.areaId, areaId)));
        }
        catch (error) {
            console.error("Error getting KPIs by company and area:", error);
            return [];
        }
    }
    async createKpi(kpi) {
        try {
            const [createdKpi] = await db_1.db.insert(schema_1.kpis).values(kpi).returning();
            return createdKpi;
        }
        catch (error) {
            console.error("Error creating KPI:", error);
            throw error;
        }
    }
    async updateKpi(id, kpiData) {
        try {
            const [updatedKpi] = await db_1.db
                .update(schema_1.kpis)
                .set(kpiData)
                .where((0, drizzle_orm_1.eq)(schema_1.kpis.id, id))
                .returning();
            return updatedKpi;
        }
        catch (error) {
            console.error("Error updating KPI:", error);
            return undefined;
        }
    }
    async deleteKpi(id) {
        try {
            // Primero eliminar todos los valores asociados al KPI
            await db_1.db.delete(schema_1.kpiValues).where((0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, id));
            // Luego eliminar el KPI
            const result = await db_1.db.delete(schema_1.kpis).where((0, drizzle_orm_1.eq)(schema_1.kpis.id, id));
            return result.rowCount > 0;
        }
        catch (error) {
            console.error("Error deleting KPI:", error);
            return false;
        }
    }
    // KPI Value operations
    async getKpiValue(id) {
        try {
            const [kpiValue] = await db_1.db.select().from(schema_1.kpiValues).where((0, drizzle_orm_1.eq)(schema_1.kpiValues.id, id));
            return kpiValue;
        }
        catch (error) {
            console.error("Error getting KPI value:", error);
            return undefined;
        }
    }
    async getKpiValues() {
        try {
            return await db_1.db.select().from(schema_1.kpiValues);
        }
        catch (error) {
            console.error("Error getting KPI values:", error);
            return [];
        }
    }
    async getKpiValuesByKpi(kpiId) {
        try {
            return await db_1.db.select().from(schema_1.kpiValues).where((0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, kpiId));
        }
        catch (error) {
            console.error("Error getting KPI values by KPI:", error);
            return [];
        }
    }
    async getKpiValuesByUser(userId) {
        try {
            return await db_1.db.select().from(schema_1.kpiValues).where((0, drizzle_orm_1.eq)(schema_1.kpiValues.userId, userId));
        }
        catch (error) {
            console.error("Error getting KPI values by user:", error);
            return [];
        }
    }
    async deleteKpiValuesByUser(userId, kpiId) {
        try {
            const result = await db_1.db.delete(schema_1.kpiValues).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.kpiValues.userId, userId), (0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, kpiId)));
            return result.rowCount > 0;
        }
        catch (error) {
            console.error("Error deleting KPI values by user:", error);
            return false;
        }
    }
    async getLatestKpiValues(kpiId, limit) {
        try {
            return await db_1.db
                .select()
                .from(schema_1.kpiValues)
                .where((0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, kpiId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.kpiValues.date))
                .limit(limit);
        }
        catch (error) {
            console.error("Error getting latest KPI values:", error);
            return [];
        }
    }
    async createKpiValue(kpiValue) {
        try {
            // Asegurarse de que la fecha se establezca correctamente para nuevos valores
            const valueWithDate = {
                ...kpiValue,
                date: new Date()
            };
            const [createdKpiValue] = await db_1.db.insert(schema_1.kpiValues).values(valueWithDate).returning();
            return createdKpiValue;
        }
        catch (error) {
            console.error("Error creating KPI value:", error);
            throw error;
        }
    }
    // Action Plan operations
    async getActionPlan(id) {
        try {
            const [actionPlan] = await db_1.db.select().from(schema_1.actionPlans).where((0, drizzle_orm_1.eq)(schema_1.actionPlans.id, id));
            return actionPlan;
        }
        catch (error) {
            console.error("Error getting action plan:", error);
            return undefined;
        }
    }
    async getActionPlansByKpi(kpiId) {
        try {
            return await db_1.db.select().from(schema_1.actionPlans).where((0, drizzle_orm_1.eq)(schema_1.actionPlans.kpiId, kpiId));
        }
        catch (error) {
            console.error("Error getting action plans by KPI:", error);
            return [];
        }
    }
    async createActionPlan(actionPlan) {
        try {
            const [createdActionPlan] = await db_1.db.insert(schema_1.actionPlans).values(actionPlan).returning();
            return createdActionPlan;
        }
        catch (error) {
            console.error("Error creating action plan:", error);
            throw error;
        }
    }
    async updateActionPlan(id, actionPlanData) {
        try {
            const [updatedActionPlan] = await db_1.db
                .update(schema_1.actionPlans)
                .set(actionPlanData)
                .where((0, drizzle_orm_1.eq)(schema_1.actionPlans.id, id))
                .returning();
            return updatedActionPlan;
        }
        catch (error) {
            console.error("Error updating action plan:", error);
            return undefined;
        }
    }
    // Shipment operations
    async getShipment(id) {
        try {
            const [shipment] = await db_1.db.select().from(schema_1.shipments).where((0, drizzle_orm_1.eq)(schema_1.shipments.id, id));
            return shipment;
        }
        catch (error) {
            console.error("Error getting shipment:", error);
            return undefined;
        }
    }
    async getShipmentByTrackingCode(trackingCode) {
        try {
            const [shipment] = await db_1.db.select().from(schema_1.shipments).where((0, drizzle_orm_1.eq)(schema_1.shipments.trackingCode, trackingCode));
            return shipment;
        }
        catch (error) {
            console.error("Error getting shipment by tracking code:", error);
            return undefined;
        }
    }
    async getShipments() {
        try {
            return await db_1.db.select().from(schema_1.shipments);
        }
        catch (error) {
            console.error("Error getting shipments:", error);
            return [];
        }
    }
    async getShipmentsByCompany(companyId) {
        try {
            return await db_1.db.select().from(schema_1.shipments).where((0, drizzle_orm_1.eq)(schema_1.shipments.companyId, companyId));
        }
        catch (error) {
            console.error("Error getting shipments by company:", error);
            return [];
        }
    }
    async createShipment(shipment) {
        try {
            const [createdShipment] = await db_1.db.insert(schema_1.shipments).values(shipment).returning();
            return createdShipment;
        }
        catch (error) {
            console.error("Error creating shipment:", error);
            throw error;
        }
    }
    async updateShipment(id, shipmentData) {
        try {
            const [updatedShipment] = await db_1.db
                .update(schema_1.shipments)
                .set({
                ...shipmentData,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.shipments.id, id))
                .returning();
            return updatedShipment;
        }
        catch (error) {
            console.error("Error updating shipment:", error);
            return undefined;
        }
    }
    // Shipment Update operations
    async getShipmentUpdate(id) {
        try {
            const [update] = await db_1.db.select().from(schema_1.shipmentUpdates).where((0, drizzle_orm_1.eq)(schema_1.shipmentUpdates.id, id));
            return update;
        }
        catch (error) {
            console.error("Error getting shipment update:", error);
            return undefined;
        }
    }
    async getShipmentUpdates(shipmentId) {
        try {
            return await db_1.db
                .select()
                .from(schema_1.shipmentUpdates)
                .where((0, drizzle_orm_1.eq)(schema_1.shipmentUpdates.shipmentId, shipmentId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.shipmentUpdates.timestamp));
        }
        catch (error) {
            console.error("Error getting shipment updates:", error);
            return [];
        }
    }
    async createShipmentUpdate(update) {
        try {
            const [createdUpdate] = await db_1.db.insert(schema_1.shipmentUpdates).values(update).returning();
            return createdUpdate;
        }
        catch (error) {
            console.error("Error creating shipment update:", error);
            throw error;
        }
    }
    // Notification operations
    async getNotification(id) {
        try {
            const [notification] = await db_1.db.select().from(schema_1.notifications).where((0, drizzle_orm_1.eq)(schema_1.notifications.id, id));
            return notification;
        }
        catch (error) {
            console.error("Error getting notification:", error);
            return undefined;
        }
    }
    async getNotificationsForUser(userId) {
        try {
            return await db_1.db
                .select({
                id: schema_1.notifications.id,
                title: schema_1.notifications.title,
                message: schema_1.notifications.message,
                type: schema_1.notifications.type,
                priority: schema_1.notifications.priority,
                read: schema_1.notifications.read,
                createdAt: schema_1.notifications.createdAt,
                readAt: schema_1.notifications.readAt,
                fromUserId: schema_1.notifications.fromUserId,
                toUserId: schema_1.notifications.toUserId,
                fromUserName: schema_1.users.name,
                fromUserEmail: schema_1.users.email,
            })
                .from(schema_1.notifications)
                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.notifications.fromUserId, schema_1.users.id))
                .where((0, drizzle_orm_1.eq)(schema_1.notifications.toUserId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.notifications.createdAt));
        }
        catch (error) {
            console.error("Error getting notifications for user:", error);
            return [];
        }
    }
    async createNotification(notification) {
        try {
            const [createdNotification] = await db_1.db.insert(schema_1.notifications).values(notification).returning();
            return createdNotification;
        }
        catch (error) {
            console.error("Error creating notification:", error);
            throw error;
        }
    }
    async markNotificationAsRead(id, userId) {
        try {
            const [updatedNotification] = await db_1.db
                .update(schema_1.notifications)
                .set({
                read: true,
                readAt: new Date()
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notifications.id, id), (0, drizzle_orm_1.eq)(schema_1.notifications.toUserId, userId)))
                .returning();
            return updatedNotification;
        }
        catch (error) {
            console.error("Error marking notification as read:", error);
            return undefined;
        }
    }
    async deleteNotification(id, userId) {
        try {
            const result = await db_1.db
                .delete(schema_1.notifications)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notifications.id, id), (0, drizzle_orm_1.eq)(schema_1.notifications.toUserId, userId)));
            return result.rowCount > 0;
        }
        catch (error) {
            console.error("Error deleting notification:", error);
            return false;
        }
    }
    // Team activity operations
    async getLastKpiUpdateByUser(userId) {
        try {
            const [latestUpdate] = await db_1.db
                .select({
                kpiName: schema_1.kpis.name,
                updateDate: schema_1.kpiValues.date
            })
                .from(schema_1.kpiValues)
                .leftJoin(schema_1.kpis, (0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, schema_1.kpis.id))
                .where((0, drizzle_orm_1.eq)(schema_1.kpiValues.updatedBy, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.kpiValues.date))
                .limit(1);
            return latestUpdate;
        }
        catch (error) {
            console.error("Error getting last KPI update by user:", error);
            return undefined;
        }
    }
    async getTeamActivitySummary() {
        try {
            const allUsers = await db_1.db.select().from(schema_1.users);
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
        }
        catch (error) {
            console.error("Error getting team activity summary:", error);
            return [];
        }
    }
    // Job Profile operations
    async getJobProfile(id) {
        try {
            const [profile] = await db_1.db.select().from(schema_1.jobProfiles).where((0, drizzle_orm_1.eq)(schema_1.jobProfiles.id, id));
            return profile;
        }
        catch (error) {
            console.error("Error getting job profile:", error);
            return undefined;
        }
    }
    async getJobProfileByUserArea(areaId, companyId) {
        try {
            const [profile] = await db_1.db.select().from(schema_1.jobProfiles).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.jobProfiles.areaId, areaId), (0, drizzle_orm_1.eq)(schema_1.jobProfiles.companyId, companyId)));
            return profile;
        }
        catch (error) {
            console.error("Error getting job profile by area:", error);
            return undefined;
        }
    }
    async getJobProfileWithDetails(userId) {
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
                mainActivities: profile.mainActivities,
                responsibilities: profile.responsibilities,
                kpiInstructions: profile.kpiInstructions,
                tips: profile.tips,
                processes: profile.processes,
                updateFrequency: profile.updateFrequency,
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
        }
        catch (error) {
            console.error("Error getting job profile with details:", error);
            return undefined;
        }
    }
    async createJobProfile(profile) {
        try {
            const [newProfile] = await db_1.db.insert(schema_1.jobProfiles).values(profile).returning();
            return newProfile;
        }
        catch (error) {
            console.error("Error creating job profile:", error);
            throw error;
        }
    }
    async updateJobProfile(id, profile) {
        try {
            const [updatedProfile] = await db_1.db.update(schema_1.jobProfiles)
                .set(profile)
                .where((0, drizzle_orm_1.eq)(schema_1.jobProfiles.id, id))
                .returning();
            return updatedProfile;
        }
        catch (error) {
            console.error("Error updating job profile:", error);
            return undefined;
        }
    }
    async getUserKpis(userId) {
        try {
            const user = await this.getUser(userId);
            if (!user || !user.areaId || !user.companyId) {
                return [];
            }
            const userKpis = await db_1.db.select().from(schema_1.kpis).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.kpis.areaId, user.areaId), (0, drizzle_orm_1.eq)(schema_1.kpis.companyId, user.companyId)));
            return userKpis;
        }
        catch (error) {
            console.error("Error getting user KPIs:", error);
            return [];
        }
    }
    async getKPIOverview() {
        try {
            const result = await db_1.db.select({
                userId: schema_1.users.id,
                userName: schema_1.users.name,
                userEmail: schema_1.users.email,
                areaName: schema_1.areas.name,
                companyName: schema_1.companies.name,
                kpiId: schema_1.kpis.id,
                kpiName: schema_1.kpis.name,
                kpiTarget: schema_1.kpis.target,
                kpiFrequency: schema_1.kpis.frequency,
                kpiValue: schema_1.kpiValues.value,
                lastUpdate: schema_1.kpiValues.date
            })
                .from(schema_1.users)
                .innerJoin(schema_1.areas, (0, drizzle_orm_1.eq)(schema_1.users.areaId, schema_1.areas.id))
                .innerJoin(schema_1.companies, (0, drizzle_orm_1.eq)(schema_1.users.companyId, schema_1.companies.id))
                .innerJoin(schema_1.kpis, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.kpis.areaId, schema_1.areas.id), (0, drizzle_orm_1.eq)(schema_1.kpis.companyId, schema_1.companies.id)))
                .leftJoin(schema_1.kpiValues, (0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, schema_1.kpis.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(schema_1.users.areaId), (0, drizzle_orm_1.isNotNull)(schema_1.users.companyId)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.kpiValues.date));
            // Agrupar por usuario y KPI, tomando el valor más reciente
            const groupedResults = new Map();
            for (const row of result) {
                const key = `${row.userId}-${row.kpiId}`;
                if (!groupedResults.has(key)) {
                    // Calcular estado basado en el valor actual vs target
                    let status = 'non-compliant'; // Por defecto es no cumple si no hay datos
                    if (row.kpiValue && row.kpiTarget) {
                        // Función para extraer valores numéricos
                        const extractNumericValue = (value) => {
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
                                }
                                else if (currentValue <= targetValue * 1.1) {
                                    status = 'alert';
                                }
                                else {
                                    status = 'non-compliant';
                                }
                            }
                            else {
                                // Para métricas donde mayor es mejor
                                if (currentValue >= targetValue) {
                                    status = 'compliant';
                                }
                                else if (currentValue >= targetValue * 0.9) {
                                    status = 'alert';
                                }
                                else {
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
        }
        catch (error) {
            console.error("Error getting KPI overview:", error);
            return [];
        }
    }
    // Función auxiliar para determinar si un KPI es de "menor es mejor"
    isLowerBetterKPI(kpiName) {
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
    async getKPIHistory(kpiId, months = 12) {
        try {
            const kpiHistory = await db_1.db.select({
                id: schema_1.kpiValues.id,
                value: schema_1.kpiValues.value,
                date: schema_1.kpiValues.date,
                period: schema_1.kpiValues.period,
                compliancePercentage: schema_1.kpiValues.compliancePercentage,
                status: schema_1.kpiValues.status,
                comments: schema_1.kpiValues.comments,
                updatedBy: schema_1.kpiValues.updatedBy
            })
                .from(schema_1.kpiValues)
                .where((0, drizzle_orm_1.eq)(schema_1.kpiValues.kpiId, kpiId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.kpiValues.date))
                .limit(months);
            console.log(`[getKPIHistory] KPI ${kpiId} history:`, kpiHistory);
            return kpiHistory;
        }
        catch (error) {
            console.error("Error getting KPI history:", error);
            return [];
        }
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
