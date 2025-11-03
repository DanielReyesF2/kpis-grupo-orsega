import { users, companies, areas, actionPlans, shipments, shipmentItems, shipmentUpdates, notifications, shipmentNotifications, jobProfiles, shipmentCycleTimes, clients, paymentVouchers } from "@shared/schema";
import type { 
  User, InsertUser, 
  Company, InsertCompany, 
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

export class MemStorage {
  private users: Map<number, User>;
  private companies: Map<number, Company>;
  private areas: Map<number, Area>;
  private kpis: Map<number, Kpi>;
  private kpiValues: Map<number, KpiValue>;
  private actionPlans: Map<number, ActionPlan>;
  private shipments: Map<number, Shipment>;
  private shipmentUpdates: Map<number, ShipmentUpdate>;
  private shipmentNotifications: Map<number, ShipmentNotification>;
  private notifications: Map<number, Notification>;
  private jobProfiles: Map<number, JobProfile>;
  private shipmentCycleTimes: Map<number, ShipmentCycleTimes>; // Keyed by shipmentId
  
  private userId: number;
  private companyId: number;
  private areaId: number;
  private kpiId: number;
  private kpiValueId: number;
  private actionPlanId: number;
  private shipmentId: number;
  private shipmentUpdateId: number;
  private shipmentNotificationId: number;
  private notificationId: number;
  private jobProfileId: number;
  private cycleTimeId: number;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.areas = new Map();
    this.kpis = new Map();
    this.kpiValues = new Map();
    this.actionPlans = new Map();
    this.shipments = new Map();
    this.shipmentUpdates = new Map();
    this.shipmentNotifications = new Map();
    this.notifications = new Map();
    this.jobProfiles = new Map();
    this.shipmentCycleTimes = new Map();
    
    this.userId = 1;
    this.companyId = 1;
    this.areaId = 1;
    this.kpiId = 1;
    this.kpiValueId = 1;
    this.actionPlanId = 1;
    this.shipmentId = 1;
    this.shipmentUpdateId = 1;
    this.shipmentNotificationId = 1;
    this.notificationId = 1;
    this.jobProfileId = 1;
    this.cycleTimeId = 1;
    
    // Initialize with sample data
    this.initializeData();
    
    // Initialize shipment data
    this.initializeShipmentData();
  }

  private initializeData(): void {
    // Create default admin user
    const adminUser: User = {
      id: this.userId++,
      name: "Admin",
      email: "admin@econova.com",
      password: "password123", // In a real app, this would be hashed
      role: "admin",
      companyId: null,
      areaId: null,
      lastLogin: new Date(),
    };
    this.users.set(adminUser.id, adminUser);
    
    // Crear usuario para Omar Navarro (responsable de ventas)
    const omarUser: User = {
      id: this.userId++,
      name: "Omar Navarro",
      email: "omar.navarro",
      password: "ventas2025", // En una app real, esto estaría hasheado
      role: "user",
      companyId: null, // Puede acceder a todas las compañías
      areaId: null,
      lastLogin: null,
    };
    this.users.set(omarUser.id, omarUser);
    
    // Crear usuario para Mario Reynoso (responsable de Contabilidad y Finanzas)
    const marioUser: User = {
      id: this.userId++,
      name: "Mario Reynoso",
      email: "mario.reynoso",
      password: "finanzas2025", // En una app real, esto estaría hasheado
      role: "user",
      companyId: null, // Puede acceder a todas las compañías
      areaId: null,
      lastLogin: null,
    };
    this.users.set(marioUser.id, marioUser);
    
    // Crear usuario para Thalia Rodriguez (responsable de Logística)
    const thaliaUser: User = {
      id: this.userId++,
      name: "Thalia Rodriguez",
      email: "thalia.rodriguez",
      password: "logistica2025", // En una app real, esto estaría hasheado
      role: "user",
      companyId: null, // Puede acceder a todas las compañías
      areaId: null,
      lastLogin: null,
    };
    this.users.set(thaliaUser.id, thaliaUser);

    // Create companies
    const duraCompany: Company = {
      id: this.companyId++,
      name: "Dura International",
      description: "Empresa líder en la industria química",
      sector: "Química",
      logo: null,
      createdAt: new Date(),
    };
    this.companies.set(duraCompany.id, duraCompany);

    const orsegaCompany: Company = {
      id: this.companyId++,
      name: "Grupo Orsega",
      description: "Empresa especializada en productos químicos",
      sector: "Química",
      logo: null,
      createdAt: new Date(),
    };
    this.companies.set(orsegaCompany.id, orsegaCompany);

    // Create functional areas for both companies
    const mainAreas = [
      "Ventas",
      "Logística",
      "Contabilidad y Finanzas"
    ];
    
    const allAreas = mainAreas;

    // Maps to store area references
    const duraAreaMap = new Map<string, Area>();
    const orsegaAreaMap = new Map<string, Area>();

    // Add areas for Dura International
    allAreas.forEach(areaName => {
      const area: Area = {
        id: this.areaId++,
        name: areaName,
        description: `Área de ${areaName} para Dura International`,
        companyId: duraCompany.id,
      };
      this.areas.set(area.id, area);
      duraAreaMap.set(areaName, area);
    });

    // Add areas for Grupo Orsega
    allAreas.forEach(areaName => {
      const area: Area = {
        id: this.areaId++,
        name: areaName,
        description: `Área de ${areaName} para Grupo Orsega`,
        companyId: orsegaCompany.id,
      };
      this.areas.set(area.id, area);
      orsegaAreaMap.set(areaName, area);
    });

    // Define all KPIs by area
    // 1. CONTABILIDAD Y FINANZAS
    if (duraAreaMap.has("Contabilidad y Finanzas") && orsegaAreaMap.has("Contabilidad y Finanzas")) {
      const financeKpis = [
        {
          name: "Precisión en estados financieros",
          description: "Mide la exactitud de los estados financieros generados. Objetivo: cero errores en emisión de información financiera. Limitar las salvedades a menos de 5 al mes.",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "Conteo de errores y salvedades. Los datos son procesados por Julio.",
          responsible: "Mario Reynoso"
        },
        {
          name: "Velocidad de rotación de cuentas por cobrar",
          description: "Mide el tiempo promedio para cobrar cuentas pendientes. Considerando que para Orsega un cliente clave representa el 80% de ventas.",
          unit: "días",
          duraTarget: "45 días",
          orsegaTarget: "60 días",
          frequency: "monthly",
          calculationMethod: "Promedio de días para cobrar",
          responsible: "Mario Reynoso"
        },
        {
          name: "Cumplimiento de obligaciones fiscales",
          description: "Monitoreo mediante checklist para la presentación de impuestos. Objetivo de cumplimiento 100% para evitar confusiones.",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "Checklist de obligaciones fiscales. Mario enviará el WordCat con la información a Daniel.",
          responsible: "Mario Reynoso"
        },
        {
          name: "Facturación sin errores",
          description: "Mide la precisión en la generación de facturas",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "weekly",
          calculationMethod: "(Facturas sin errores / Total de facturas) x 100",
          responsible: "Mario Reynoso"
        },
        /* Removido "Control de costos (margen bruto)" para integrarlo como un indicador en el reporte de ventas */
      ];

      // Add KPIs for both companies
      financeKpis.forEach(kpiData => {
        // Dura International KPI
        const duraKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.duraTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: duraAreaMap.get("Contabilidad y Finanzas")!.id,
          companyId: duraCompany.id,
          invertedMetric: false
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Sample values for Dura
        const duraValues = [
          { 
            value: kpiData.name.includes("Precisión") ? "98.5%" : 
                   kpiData.name.includes("Rotación") ? "48" : 
                   kpiData.name.includes("Cumplimiento") ? "100%" : 
                   kpiData.name.includes("Facturación") ? "97%" : "+2.5%", 
            period: "Q1 2023", 
            status: kpiData.name.includes("Precisión") ? "alert" : 
                    kpiData.name.includes("Rotación") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Precisión") ? "95%" : 
                                  kpiData.name.includes("Rotación") ? "93.8%" : "100%",
            comments: kpiData.name.includes("Rotación") ? 
                      "Ligeramente por encima del objetivo (45 días). Mejorando plazo de cobro." : 
                      "Valor registrado para el periodo"
          },
          { 
            value: kpiData.name.includes("Precisión") ? "99.2%" : 
                   kpiData.name.includes("Rotación") ? "42" : 
                   kpiData.name.includes("Cumplimiento") ? "100%" : 
                   kpiData.name.includes("Facturación") ? "98%" : "+3.1%", 
            period: "Q2 2023", 
            status: kpiData.name.includes("Rotación") ? "complies" : "complies",
            compliancePercentage: kpiData.name.includes("Rotación") ? 
                                  // 45/42 = 1.071, 1.071*100 = 107.1%
                                  "107.1%" : "100%",
            comments: kpiData.name.includes("Rotación") ? 
                      "Por debajo del objetivo (45 días). Excelente gestión de cobros." : 
                      "Mejora respecto al periodo anterior"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // Grupo Orsega KPI
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Contabilidad y Finanzas")!.id,
          companyId: orsegaCompany.id,
          invertedMetric: false
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Sample values for Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Precisión") ? "99.0%" : 
                   kpiData.name.includes("Rotación") ? "65" : 
                   kpiData.name.includes("Cumplimiento") ? "98%" : 
                   kpiData.name.includes("Facturación") ? "95%" : "+1.8%", 
            period: "Q1 2023", 
            status: kpiData.name.includes("Cumplimiento") ? "alert" : 
                    kpiData.name.includes("Rotación") ? "alert" : 
                    kpiData.name.includes("Facturación") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Cumplimiento") ? "98%" : 
                                  kpiData.name.includes("Rotación") ? "92%" : 
                                  kpiData.name.includes("Facturación") ? "95%" : "100%",
            comments: kpiData.name.includes("Rotación") ? "Por encima del objetivo. Cliente clave (80% de ventas) paga a 65 días" : "Valor registrado para el periodo"
          },
          { 
            value: kpiData.name.includes("Precisión") ? "99.5%" : 
                   kpiData.name.includes("Rotación") ? "58" : 
                   kpiData.name.includes("Cumplimiento") ? "100%" : 
                   kpiData.name.includes("Facturación") ? "98%" : "+2.5%", 
            period: "Q2 2023", 
            status: kpiData.name.includes("Rotación") ? "complies" : "complies",
            compliancePercentage: "100%",
            comments: kpiData.name.includes("Rotación") ? "Mejora en la rotación. Dentro del objetivo de 60 días" : "Mejora respecto al periodo anterior"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 2. COMPRAS
    if (duraAreaMap.has("Compras") && orsegaAreaMap.has("Compras")) {
      const purchasingKpis = [
        {
          name: "Nivel de inventario óptimo",
          description: "Mantener los niveles óptimos de inventario para operaciones",
          unit: "unidades",
          duraTarget: "Máx. 2 meses secantes",
          orsegaTarget: "Máx. 6 ton metilato",
          frequency: "monthly",
          calculationMethod: "Medición directa de inventario vs. objetivo",
          responsible: "Roberto Méndez"
        },
        {
          name: "Tiempo de respuesta a Ventas",
          description: "Mide el tiempo de respuesta a solicitudes de Ventas",
          unit: "horas",
          duraTarget: "Máx. 4 horas",
          orsegaTarget: "Máx. 4 horas",
          frequency: "weekly",
          calculationMethod: "Tiempo promedio de respuesta",
          responsible: "Elena Morales"
        },
        {
          name: "Tiempo de entrega de proveedores",
          description: "Mide el cumplimiento de tiempos de entrega de proveedores",
          unit: "%",
          duraTarget: "95% cumplimiento",
          orsegaTarget: "95% cumplimiento",
          frequency: "monthly",
          calculationMethod: "(Entregas a tiempo / Total de entregas) x 100",
          responsible: "Miguel Ángel Soto"
        },
        {
          name: "Optimización de costos de compra",
          description: "Mide la reducción de costos en compras",
          unit: "%",
          duraTarget: "< 5%",
          orsegaTarget: "< 5%",
          frequency: "quarterly",
          calculationMethod: "(Costo actual - Costo previo) / Costo previo x 100",
          responsible: "Josefina Ramírez"
        }
      ];
      
      // Add KPIs for both companies (implementation similar to finance KPIs)
      purchasingKpis.forEach(kpiData => {
        // Dura International KPI
        const duraKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.duraTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: duraAreaMap.get("Compras")!.id,
          companyId: duraCompany.id,
          invertedMetric: false
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Sample values for Dura
        const duraValues = [
          { 
            value: kpiData.name.includes("Nivel") ? "1.8 meses" : 
                   kpiData.name.includes("Tiempo de respuesta") ? "4.5 horas" : 
                   kpiData.name.includes("Tiempo de entrega") ? "92%" : 
                   "-3.5%", 
            period: "Q1 2023", 
            status: kpiData.name.includes("Tiempo de respuesta") ? "alert" : 
                    kpiData.name.includes("Tiempo de entrega") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Tiempo de respuesta") ? "90%" : 
                                  kpiData.name.includes("Tiempo de entrega") ? "92%" : "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // Grupo Orsega KPI
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Compras")!.id,
          companyId: orsegaCompany.id,
          invertedMetric: false
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Sample values for Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Nivel") ? "5.8 ton" : 
                   kpiData.name.includes("Tiempo de respuesta") ? "3.8 horas" : 
                   kpiData.name.includes("Tiempo de entrega") ? "96%" : 
                   "-4.2%", 
            period: "Q1 2023", 
            status: kpiData.name.includes("Nivel") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Nivel") ? "95%" : "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 3. VENTAS
    if (duraAreaMap.has("Ventas") && orsegaAreaMap.has("Ventas")) {
      const salesKpis = [
        {
          name: "Volumen de ventas alcanzado",
          description: "Mide el volumen total de ventas mensual en kilogramos",
          unit: "KG",
          duraTarget: "55,620 KG",
          orsegaTarget: "775,735 unidades",
          frequency: "monthly",
          calculationMethod: "Suma del volumen de todas las ventas en KG/unidades",
          responsible: "Omar Navarro"
        },
        {
          name: "Porcentaje de crecimiento en ventas",
          description: "Mide el crecimiento en ventas respecto al año anterior",
          unit: "%",
          duraTarget: "+10% vs año anterior",
          orsegaTarget: "+10% vs año anterior",
          frequency: "monthly",
          calculationMethod: "((Ventas actuales - Ventas año anterior) / Ventas año anterior) x 100",
          responsible: "Isabella Vega"
        },
        {
          name: "Nuevos clientes adquiridos",
          description: "Mide la adquisición de nuevos clientes",
          unit: "clientes",
          duraTarget: "2 nuevos/mes",
          orsegaTarget: "2 nuevos/mes",
          frequency: "monthly",
          calculationMethod: "Conteo de nuevos clientes",
          responsible: "Omar Navarro"
        },
        {
          name: "Tasa de retención de clientes",
          description: "Mide el porcentaje de clientes que permanecen activos",
          unit: "%",
          duraTarget: "90%",
          orsegaTarget: "90%",
          frequency: "monthly",
          calculationMethod: "(Clientes activos que renuevan / Total de clientes activos) x 100",
          responsible: "Alejandra Durán"
        },
        {
          name: "Satisfacción interdepartamental",
          description: "Evalúa la colaboración con otros departamentos",
          unit: "cualitativo",
          duraTarget: "Retroalimentación continua",
          orsegaTarget: "Retroalimentación continua",
          frequency: "quarterly",
          calculationMethod: "Encuestas de satisfacción interdepartamental",
          responsible: "Sergio Montero"
        }
      ];
      
      // Add KPIs for both companies
      salesKpis.forEach(kpiData => {
        // Dura International KPI
        const duraKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.duraTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: duraAreaMap.get("Ventas")!.id,
          companyId: duraCompany.id,
          invertedMetric: false
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Sample values for Dura - DATOS ACTUALIZADOS 2025
        const duraValues = kpiData.name.includes("Volumen") ? [
          { 
            value: "59,453 KG",
            period: "Enero 2025", 
            status: "complies",
            compliancePercentage: "107%",
            comments: "Por encima del objetivo mensual de 55,620 KG"
          },
          { 
            value: "46,450 KG",
            period: "Febrero 2025", 
            status: "not_compliant",
            compliancePercentage: "83%",
            comments: "Por debajo del objetivo mensual, afectado por fallas en equipos"
          },
          { 
            value: "43,602.24 KG",
            period: "Marzo 2025", 
            status: "not_compliant",
            compliancePercentage: "78%",
            comments: "Por debajo del objetivo, plan de acción en curso"
          }
        ] : kpiData.name.includes("Nuevos clientes") ? [
          { 
            value: "0",
            period: "Enero 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          },
          { 
            value: "0",
            period: "Febrero 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          },
          { 
            value: "0",
            period: "Marzo 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          }
        ] : [
          { 
            value: kpiData.name.includes("Porcentaje de crecimiento") ? "+8.5%" : 
                   kpiData.name.includes("Tasa de retención") ? "92%" : 
                   "Satisfactorio",
            period: "Enero 2025", 
            status: kpiData.name.includes("Porcentaje de crecimiento") ? "alert" : 
                    "complies",
            compliancePercentage: kpiData.name.includes("Porcentaje de crecimiento") ? "85%" : 
                                  "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // Grupo Orsega KPI
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Ventas")!.id,
          companyId: orsegaCompany.id,
          invertedMetric: false
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Sample values for Orsega - DATOS ACTUALIZADOS 2025
        const orsegaValues = kpiData.name.includes("Volumen") ? [
          { 
            value: "812,340 unidades",
            period: "Enero 2025", 
            status: "complies",
            compliancePercentage: "105%",
            comments: "Por encima del objetivo mensual de 775,735 unidades"
          },
          { 
            value: "755,212 unidades",
            period: "Febrero 2025", 
            status: "alert",
            compliancePercentage: "97%",
            comments: "Ligeramente por debajo del objetivo mensual"
          },
          { 
            value: "780,430 unidades",
            period: "Marzo 2025", 
            status: "complies",
            compliancePercentage: "101%",
            comments: "Recuperación y cumplimiento del objetivo"
          },
          { 
            value: "237,464 unidades",
            period: "Abril 2025", 
            status: "not_compliant",
            compliancePercentage: "31%",
            comments: "Muy por debajo del objetivo, posible error en los datos"
          }
        ] : kpiData.name.includes("Nuevos clientes") ? [
          { 
            value: "0",
            period: "Enero 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          },
          { 
            value: "0",
            period: "Febrero 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          },
          { 
            value: "0",
            period: "Marzo 2025", 
            status: "not_compliant",
            compliancePercentage: "0%",
            comments: "No se registraron nuevos clientes en este periodo"
          }
        ] : [
          { 
            value: kpiData.name.includes("Porcentaje de crecimiento") ? "+11.2%" : 
                   kpiData.name.includes("Tasa de retención") ? "88%" : 
                   "Muy satisfactorio",
            period: "Enero 2025", 
            status: kpiData.name.includes("Tasa de retención") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Tasa de retención") ? "98%" : "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 4. SOPORTE DE VENTAS
    if (duraAreaMap.has("Soporte de Ventas") && orsegaAreaMap.has("Soporte de Ventas")) {
      const salesSupportKpis = [
        {
          name: "Actualización del CRM",
          description: "Mide la actualización oportuna de datos en el CRM",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "(Registros actualizados / Total de registros) x 100",
          responsible: "Gabriela Herrera"
        },
        {
          name: "Tiempo de respuesta a solicitudes",
          description: "Mide el tiempo de respuesta a solicitudes de clientes",
          unit: "horas",
          duraTarget: "< 24 horas",
          orsegaTarget: "< 24 horas",
          frequency: "weekly",
          calculationMethod: "Tiempo promedio de respuesta",
          responsible: "Daniel Ortega"
        },
        {
          name: "Precisión en documentación de órdenes",
          description: "Mide la exactitud en la documentación de órdenes",
          unit: "%",
          duraTarget: "98%",
          orsegaTarget: "98%",
          frequency: "quarterly",
          calculationMethod: "(Documentos sin errores / Total de documentos) x 100",
          responsible: "Laura Reyes"
        },
        {
          name: "Eficiencia en reportes de soporte",
          description: "Mide la entrega oportuna de reportes",
          unit: "%",
          duraTarget: "100% en plazo",
          orsegaTarget: "100% en plazo",
          frequency: "monthly",
          calculationMethod: "(Reportes entregados a tiempo / Total de reportes) x 100",
          responsible: "Roberto Cruz"
        },
        {
          name: "Seguimiento a evaluación de muestras",
          description: "Mide el seguimiento a muestras enviadas a clientes",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "(Muestras con seguimiento / Total de muestras) x 100",
          responsible: "Mariana Fuentes"
        },
        {
          name: "Seguimiento a redes sociales",
          description: "Mide la actividad en redes sociales",
          unit: "posts",
          duraTarget: "2 posts/semana",
          orsegaTarget: "2 posts/semana",
          frequency: "weekly",
          calculationMethod: "Conteo de publicaciones",
          responsible: "Javier Castillo"
        },
        {
          name: "Recuperación de ventas de clientes",
          description: "Mide la reactivación de clientes inactivos",
          unit: "%",
          duraTarget: "% clientes reactivados",
          orsegaTarget: "% clientes reactivados",
          frequency: "bimonthly",
          calculationMethod: "(Clientes reactivados / Total de clientes inactivos) x 100",
          responsible: "Verónica Torres"
        }
      ];
      
      // Add KPIs for both companies
      salesSupportKpis.forEach(kpiData => {
        // Dura International KPI
        const duraKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.duraTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: duraAreaMap.get("Soporte de Ventas")!.id,
          companyId: duraCompany.id,
          invertedMetric: false
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Sample values for Dura
        const duraValues = [
          { 
            value: kpiData.name.includes("Actualización") ? "95%" : 
                   kpiData.name.includes("Tiempo de respuesta") ? "22 horas" : 
                   kpiData.name.includes("Precisión") ? "97.5%" : 
                   kpiData.name.includes("Eficiencia") ? "98%" : 
                   kpiData.name.includes("Seguimiento a evaluación") ? "100%" : 
                   kpiData.name.includes("Seguimiento a redes") ? "1.5/semana" : 
                   "15%",
            period: "Q1 2023", 
            status: kpiData.name.includes("Actualización") ? "alert" : 
                    kpiData.name.includes("Precisión") ? "alert" : 
                    kpiData.name.includes("Eficiencia") ? "alert" : 
                    kpiData.name.includes("Seguimiento a redes") ? "alert" : 
                    "complies",
            compliancePercentage: kpiData.name.includes("Actualización") ? "95%" : 
                                  kpiData.name.includes("Precisión") ? "97%" : 
                                  kpiData.name.includes("Eficiencia") ? "98%" : 
                                  kpiData.name.includes("Seguimiento a redes") ? "75%" : 
                                  "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // Grupo Orsega KPI
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Soporte de Ventas")!.id,
          companyId: orsegaCompany.id,
          invertedMetric: false
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Sample values for Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Actualización") ? "98%" : 
                   kpiData.name.includes("Tiempo de respuesta") ? "20 horas" : 
                   kpiData.name.includes("Precisión") ? "98.5%" : 
                   kpiData.name.includes("Eficiencia") ? "100%" : 
                   kpiData.name.includes("Seguimiento a evaluación") ? "98%" : 
                   kpiData.name.includes("Seguimiento a redes") ? "2/semana" : 
                   "20%",
            period: "Q1 2023", 
            status: kpiData.name.includes("Seguimiento a evaluación") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Seguimiento a evaluación") ? "98%" : "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 5. LOGÍSTICA
    if (duraAreaMap.has("Logística") && orsegaAreaMap.has("Logística")) {
      const logisticsKpis = [
        {
          name: "Precisión de inventarios",
          description: "Mide la exactitud del inventario físico vs. sistema",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "quarterly",
          calculationMethod: "(Inventario correcto / Total de inventario) x 100",
          responsible: "Ricardo Vargas"
        },
        {
          name: "Cumplimiento de tiempos de entrega",
          description: "Mide el cumplimiento de los tiempos de entrega a clientes",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "(Entregas a tiempo / Total de entregas) x 100",
          responsible: "Patricia Lara"
        },
        {
          name: "Costos de transporte",
          description: "Mide la optimización de costos de transporte",
          unit: "%",
          duraTarget: "< Inflación anual",
          orsegaTarget: "< Inflación anual",
          frequency: "yearly",
          calculationMethod: "Comparación con la inflación anual",
          responsible: "Héctor Navarro"
        },
        {
          name: "Satisfacción de clientes internos",
          description: "Mide la satisfacción de otros departamentos con Logística",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "semiannually",
          calculationMethod: "Encuestas de satisfacción",
          responsible: "Carmen Delgado"
        },
        {
          name: "Tiempo de recuperación de evidencias",
          description: "Mide el tiempo para recuperar evidencias de entrega",
          unit: "horas",
          duraTarget: "< 24 horas",
          orsegaTarget: "< 24 horas",
          frequency: "monthly",
          calculationMethod: "Tiempo promedio de recuperación",
          responsible: "Arturo Guzmán"
        }
      ];
      
      // Add KPIs for both companies
      logisticsKpis.forEach(kpiData => {
        // Dura International KPI
        const duraKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.duraTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: duraAreaMap.get("Logística")!.id,
          companyId: duraCompany.id,
          invertedMetric: false
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Sample values for Dura
        const duraValues = [
          { 
            value: kpiData.name.includes("Precisión de inventarios") ? "98.5%" : 
                   kpiData.name.includes("Cumplimiento de tiempos") ? "95%" : 
                   kpiData.name.includes("Costos de transporte") ? "-2% vs inflación" : 
                   kpiData.name.includes("Satisfacción") ? "92%" : 
                   "28 horas",
            period: "Q1 2023", 
            status: kpiData.name.includes("Precisión de inventarios") ? "alert" : 
                    kpiData.name.includes("Cumplimiento de tiempos") ? "alert" : 
                    kpiData.name.includes("Satisfacción") ? "alert" : 
                    kpiData.name.includes("Tiempo de recuperación") ? "alert" : 
                    "complies",
            compliancePercentage: kpiData.name.includes("Precisión de inventarios") ? "98%" : 
                                  kpiData.name.includes("Cumplimiento de tiempos") ? "95%" : 
                                  kpiData.name.includes("Satisfacción") ? "92%" : 
                                  kpiData.name.includes("Tiempo de recuperación") ? "85%" : 
                                  "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // Grupo Orsega KPI
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Logística")!.id,
          companyId: orsegaCompany.id,
          invertedMetric: false
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Sample values for Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Precisión de inventarios") ? "99.2%" : 
                   kpiData.name.includes("Cumplimiento de tiempos") ? "97%" : 
                   kpiData.name.includes("Costos de transporte") ? "-1.5% vs inflación" : 
                   kpiData.name.includes("Satisfacción") ? "95%" : 
                   "22 horas",
            period: "Q1 2023", 
            status: kpiData.name.includes("Cumplimiento de tiempos") ? "alert" : 
                    kpiData.name.includes("Satisfacción") ? "alert" : 
                    "complies",
            compliancePercentage: kpiData.name.includes("Cumplimiento de tiempos") ? "97%" : 
                                  kpiData.name.includes("Satisfacción") ? "95%" : 
                                  "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            userId: 1, // Admin user
            updatedBy: null,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      // Para propósitos de migración, si el usuario ingresa un email, buscar por email también
      if (username.includes('@')) {
        return this.getUserByEmail(username);
      }
      
      // Caso especial para el usuario admin (sin verificar formato de email)
      if (username.toLowerCase() === 'admin') {
        return Array.from(this.users.values()).find(
          (user) => user.name.toLowerCase() === 'admin'
        );
      }
      
      // Para otros usuarios, verificar si coincide con la parte del email antes del @
      return Array.from(this.users.values()).find(
        (user) => {
          const emailParts = user.email.toLowerCase().split('@');
          return emailParts.length > 0 && emailParts[0] === username.toLowerCase();
        }
      );
    } catch (error) {
      console.error("Error en getUserByUsername:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...insertUser, 
      id, 
      lastLogin: null,
      role: insertUser.role || 'viewer',
      companyId: insertUser.companyId || null,
      areaId: insertUser.areaId || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = this.companyId++;
    const company: Company = { 
      ...insertCompany, 
      id, 
      createdAt: new Date(),
      description: insertCompany.description || null,
      sector: insertCompany.sector || null,
      logo: insertCompany.logo || null
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    
    const updatedCompany = { ...company, ...companyData };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }
  
  // Area operations
  async getArea(id: number): Promise<Area | undefined> {
    return this.areas.get(id);
  }

  async getAreas(): Promise<Area[]> {
    return Array.from(this.areas.values());
  }

  async getAreasByCompany(companyId: number): Promise<Area[]> {
    return Array.from(this.areas.values()).filter(
      (area) => area.companyId === companyId
    );
  }

  async createArea(insertArea: InsertArea): Promise<Area> {
    const id = this.areaId++;
    const area: Area = { 
      ...insertArea, 
      id,
      description: insertArea.description || null
    };
    this.areas.set(id, area);
    return area;
  }

  async updateArea(id: number, areaData: Partial<Area>): Promise<Area | undefined> {
    const area = this.areas.get(id);
    if (!area) return undefined;
    
    const updatedArea = { ...area, ...areaData };
    this.areas.set(id, updatedArea);
    return updatedArea;
  }
  
  // KPI operations
  async getKpi(id: number, companyId: number): Promise<Kpi | undefined> {
    const kpi = this.kpis.get(id);
    if (!kpi) return undefined;
    if (kpi.companyId !== companyId) return undefined;
    return kpi;
  }

  async getKpis(companyId?: number): Promise<Kpi[]> {
    const all = Array.from(this.kpis.values());
    if (typeof companyId === "number") {
      return all.filter((kpi) => kpi.companyId === companyId);
    }
    return all;
  }

  async getKpisByCompany(companyId: number): Promise<Kpi[]> {
    return this.getKpis(companyId);
  }

  async getKpisByArea(areaId: number): Promise<Kpi[]> {
    return Array.from(this.kpis.values()).filter(
      (kpi) => kpi.areaId === areaId
    );
  }

  async getKpisByCompanyAndArea(companyId: number, areaId: number): Promise<Kpi[]> {
    return Array.from(this.kpis.values()).filter(
      (kpi) => kpi.companyId === companyId && kpi.areaId === areaId
    );
  }

  async createKpi(insertKpi: InsertKpi): Promise<Kpi> {
    const id = this.kpiId++;
    const area = insertKpi.areaId ? this.areas.get(insertKpi.areaId) : undefined;
    const goal = insertKpi.goal ?? insertKpi.target ?? null;

    const kpi: Kpi = {
      id,
      companyId: insertKpi.companyId,
      areaId: insertKpi.areaId ?? null,
      area: area?.name ?? insertKpi.area ?? null,
      name: insertKpi.name,
      description: insertKpi.description ?? null,
      goal,
      target: goal,
      unit: insertKpi.unit ?? null,
      frequency: insertKpi.frequency ?? null,
      calculationMethod: insertKpi.calculationMethod ?? null,
      responsible: insertKpi.responsible ?? null,
      source: insertKpi.source ?? null,
      period: insertKpi.period ?? null,
      createdAt: new Date(),
      invertedMetric: false,
    };

    this.kpis.set(id, kpi);
    return kpi;
  }

  async updateKpi(id: number, kpiData: Partial<Kpi>): Promise<Kpi | undefined> {
    const kpi = this.kpis.get(id);
    if (!kpi) return undefined;
    
    const updatedKpi: Kpi = { ...kpi, ...kpiData };

    if (kpiData.goal !== undefined || kpiData.target !== undefined) {
      const goal = (kpiData.goal ?? kpiData.target) ?? updatedKpi.goal;
      updatedKpi.goal = goal;
      updatedKpi.target = goal;
    }

    if (kpiData.areaId !== undefined) {
      const area = this.areas.get(kpiData.areaId);
      updatedKpi.areaId = kpiData.areaId;
      if (area) {
        updatedKpi.area = area.name;
      }
    }

    if (kpiData.area !== undefined) {
      updatedKpi.area = kpiData.area;
    }

    this.kpis.set(id, updatedKpi);
    return updatedKpi;
  }

  async deleteKpi(id: number, companyId: number): Promise<boolean> {
    const kpi = this.kpis.get(id);
    if (!kpi || kpi.companyId !== companyId) {
      return false;
    }
    this.kpis.delete(id);
    // Remove associated values
    for (const [valueId, value] of this.kpiValues.entries()) {
      if (value.kpiId === id) {
        this.kpiValues.delete(valueId);
      }
    }
    return true;
  }
  
  // KPI Value operations
  async getKpiValue(id: number, companyId?: number): Promise<KpiValue | undefined> {
    const value = this.kpiValues.get(id);
    if (!value) return undefined;
    if (typeof companyId === "number" && value.companyId !== companyId) {
      return undefined;
    }
    return value;
  }

  async getKpiValues(companyId?: number): Promise<KpiValue[]> {
    const values = Array.from(this.kpiValues.values());
    if (typeof companyId === "number") {
      return values.filter((value) => value.companyId === companyId);
    }
    return values;
  }

  async getKpiValuesByKpi(kpiId: number, companyId: number): Promise<KpiValue[]> {
    return this.getKpiValues(companyId)
      .filter((value) => value.kpiId === kpiId)
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
  }

  async getLatestKpiValues(kpiId: number, limit: number, companyId: number): Promise<KpiValue[]> {
    return this.getKpiValues(companyId)
      .filter((value) => value.kpiId === kpiId)
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  }

  async createKpiValue(insertKpiValue: InsertKpiValue): Promise<KpiValue> {
    const id = this.kpiValueId++;
    // Actualizamos para manejar períodos más amigables para gráficos (Enero 2025, Febrero 2025, etc.)
    // Si el período está en un formato diferente, lo extraemos de la fecha actual
    let period = insertKpiValue.period;
    
    if (!period || period === 'monthly') {
      const date = new Date();
      const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      period = `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
    
    const kpiValue: KpiValue = { 
      ...insertKpiValue, 
      id, 
      date: new Date(),
      period,
      status: insertKpiValue.status || null,
      compliancePercentage: insertKpiValue.compliancePercentage || null,
      comments: insertKpiValue.comments || null,
      updatedBy: insertKpiValue.updatedBy || null
    };
    
    this.kpiValues.set(id, kpiValue);
    return kpiValue;
  }
  
  // Action Plan operations
  async getActionPlan(id: number): Promise<ActionPlan | undefined> {
    return this.actionPlans.get(id);
  }

  async getActionPlansByKpi(kpiId: number): Promise<ActionPlan[]> {
    return Array.from(this.actionPlans.values()).filter(
      (plan) => plan.kpiId === kpiId
    );
  }

  async createActionPlan(insertActionPlan: InsertActionPlan): Promise<ActionPlan> {
    const id = this.actionPlanId++;
    const actionPlan: ActionPlan = { 
      ...insertActionPlan, 
      id,
      results: insertActionPlan.results || null
    };
    this.actionPlans.set(id, actionPlan);
    return actionPlan;
  }

  async updateActionPlan(id: number, planData: Partial<ActionPlan>): Promise<ActionPlan | undefined> {
    const plan = this.actionPlans.get(id);
    if (!plan) return undefined;
    
    const updatedPlan = { ...plan, ...planData };
    this.actionPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  // Implementación de métodos para Shipment (Envíos)
  async getShipment(id: number): Promise<Shipment | undefined> {
    return this.shipments.get(id);
  }

  async getShipmentByTrackingCode(trackingCode: string): Promise<Shipment | undefined> {
    for (const shipment of Array.from(this.shipments.values())) {
      if (shipment.trackingCode === trackingCode) {
        return shipment;
      }
    }
    return undefined;
  }

  // Helper method to enrich shipments with cycle times data
  private enrichShipmentWithCycleTimes(shipment: Shipment): ShipmentWithCycleTimes {
    const cycleTime = this.shipmentCycleTimes.get(shipment.id);
    
    if (!cycleTime) {
      return {
        ...shipment,
        cycleTimes: null
      };
    }
    
    return {
      ...shipment,
      cycleTimes: {
        hoursTotalCycle: cycleTime.hoursTotalCycle,
        hoursPendingToTransit: cycleTime.hoursPendingToTransit,
        hoursTransitToDelivered: cycleTime.hoursTransitToDelivered,
        hoursDeliveredToClosed: cycleTime.hoursDeliveredToClosed,
        hoursToDelivery: cycleTime.hoursToDelivery,
        computedAt: cycleTime.computedAt || undefined,
        updatedAt: cycleTime.updatedAt || undefined
      }
    };
  }

  async getShipments(): Promise<ShipmentWithCycleTimes[]> {
    const shipments = Array.from(this.shipments.values());
    return shipments.map(shipment => this.enrichShipmentWithCycleTimes(shipment));
  }

  async getShipmentsByCompany(companyId: number): Promise<ShipmentWithCycleTimes[]> {
    const shipments = Array.from(this.shipments.values()).filter(shipment => shipment.companyId === companyId);
    return shipments.map(shipment => this.enrichShipmentWithCycleTimes(shipment));
  }

  async getShipmentsByStatus(status: string): Promise<Shipment[]> {
    return Array.from(this.shipments.values()).filter(shipment => shipment.status === status);
  }

  async getShipmentsByCompanyAndStatus(companyId: number, status: string): Promise<Shipment[]> {
    return Array.from(this.shipments.values()).filter(
      shipment => shipment.companyId === companyId && shipment.status === status
    );
  }

  async createShipment(shipmentData: InsertShipment): Promise<Shipment> {
    const id = this.shipmentId++;
    
    // Generamos un código de seguimiento único si no se proporciona
    let trackingCode = shipmentData.trackingCode;
    if (!trackingCode) {
      const companyPrefix = shipmentData.companyId === 1 ? 'DUR' : 'ORS';
      const currentDate = new Date();
      const year = currentDate.getFullYear().toString().slice(2);
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const trackingNum = id.toString().padStart(4, '0');
      trackingCode = `${companyPrefix}-${year}${month}-${trackingNum}`;
    }
    
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const shipment: Shipment = {
      id,
      ...shipmentData,
      trackingCode,
      status: shipmentData.status || 'pending',
      createdAt,
      updatedAt,
      comments: shipmentData.comments || null,
      customerEmail: shipmentData.customerEmail || null,
      customerPhone: shipmentData.customerPhone || null,
      departureDate: shipmentData.departureDate || null,
      estimatedDeliveryDate: shipmentData.estimatedDeliveryDate || null,
      actualDeliveryDate: shipmentData.actualDeliveryDate || null,
      carrier: shipmentData.carrier || null,
      vehicleInfo: shipmentData.vehicleInfo || null,
      vehicleType: shipmentData.vehicleType || null,
      fuelType: shipmentData.fuelType || null,
      distance: shipmentData.distance || null,
      carbonFootprint: shipmentData.carbonFootprint || null,
      driverName: shipmentData.driverName || null,
      driverPhone: shipmentData.driverPhone || null
    };
    
    this.shipments.set(id, shipment);
    return shipment;
  }

  async updateShipment(id: number, shipmentData: Partial<Shipment>): Promise<Shipment | undefined> {
    const shipment = this.shipments.get(id);
    if (!shipment) return undefined;
    
    const updatedShipment = { 
      ...shipment, 
      ...shipmentData,
      updatedAt: new Date()
    };
    
    this.shipments.set(id, updatedShipment);
    return updatedShipment;
  }

  // Implementación de métodos para ShipmentUpdate (Actualizaciones de envíos)
  async getShipmentUpdate(id: number): Promise<ShipmentUpdate | undefined> {
    return this.shipmentUpdates.get(id);
  }

  async getShipmentUpdatesByShipment(shipmentId: number): Promise<ShipmentUpdate[]> {
    return Array.from(this.shipmentUpdates.values())
      .filter(update => update.shipmentId === shipmentId)
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      });
  }

  async createShipmentUpdate(updateData: InsertShipmentUpdate): Promise<ShipmentUpdate> {
    const id = this.shipmentUpdateId++;
    const timestamp = new Date();
    
    const update: ShipmentUpdate = {
      id,
      ...updateData,
      timestamp,
      comments: updateData.comments || null,
      updatedBy: updateData.updatedBy || null,
      location: updateData.location || null
    };
    
    this.shipmentUpdates.set(id, update);
    
    // Actualizar también el estado del envío
    const shipment = await this.getShipment(updateData.shipmentId);
    if (shipment) {
      await this.updateShipment(shipment.id, { 
        status: updateData.status,
        updatedAt: timestamp
      });
    }
    
    return update;
  }
  
  // Método para inicializar datos de ejemplo para envíos
  private initializeShipmentData(): void {
    // Envíos para Dura International
    const duraShipments = [
      {
        trackingCode: "DUR-2404-0001",
        companyId: 1,
        customerName: "Distribuidora Química del Pacífico",
        purchaseOrder: "PO-2025-001",
        destination: "Mazatlán, Sinaloa",
        origin: "Monterrey, Nuevo León",
        product: "Sosa Cáustica",
        quantity: "5000",
        unit: "KG",
        departureDate: new Date("2025-04-19"),
        estimatedDeliveryDate: new Date("2025-04-22"),
        status: "in_transit" as const,
        carrier: "TransQuimicos SA",
        vehicleInfo: "Cisterna especializada C-3540",
        vehicleType: "Cisterna",
        fuelType: "Diesel",
        distance: "957",
        carbonFootprint: "2104",
        driverName: "Juan Pérez",
        driverPhone: "+52 555 123 4567",
        customerEmail: "compras@disquimpac.com",
        customerPhone: "+52 669 987 6543",
        comments: "Pedido urgente, cliente prioritario"
      },
      {
        trackingCode: "DUR-2404-0002",
        companyId: 1,
        customerName: "Química Industrial del Norte",
        purchaseOrder: "PO-2025-002",
        destination: "Torreón, Coahuila",
        origin: "Monterrey, Nuevo León",
        product: "Ácido Sulfúrico",
        quantity: "3500",
        unit: "KG",
        departureDate: new Date("2025-04-22"),
        estimatedDeliveryDate: new Date("2025-04-25"),
        status: "pending" as const,
        carrier: "TransQuimicos SA",
        vehicleInfo: "Tanque especializado T-8721",
        vehicleType: "Tanque",
        fuelType: "Diesel",
        distance: "435",
        carbonFootprint: "953",
        driverName: "Roberto Martínez",
        driverPhone: "+52 555 765 4321",
        customerEmail: "operaciones@quinor.mx",
        customerPhone: "+52 871 234 5678",
        comments: "Carga peligrosa, requiere documentación especial"
      },
      {
        trackingCode: "DUR-2404-0003",
        companyId: 1,
        customerName: "Agroquímicos del Bajío",
        purchaseOrder: "PO-2025-003",
        destination: "León, Guanajuato",
        origin: "Monterrey, Nuevo León",
        product: "Formaldehído",
        quantity: "2800",
        unit: "KG",
        departureDate: new Date("2025-04-15"),
        estimatedDeliveryDate: new Date("2025-04-18"),
        actualDeliveryDate: new Date("2025-04-18"),
        status: "delivered" as const,
        carrier: "LogiChem",
        vehicleInfo: "Camión L-9234",
        vehicleType: "Camión",
        fuelType: "Diesel",
        distance: "632",
        carbonFootprint: "1390",
        driverName: "Miguel Ángel Soto",
        driverPhone: "+52 555 987 6543",
        customerEmail: "compras@agrobajio.com",
        customerPhone: "+52 477 345 6789",
        comments: "Entrega completada satisfactoriamente"
      }
    ];
    
    // Envíos para Grupo Orsega
    const orsegaShipments = [
      {
        trackingCode: "ORS-2404-0001",
        companyId: 2,
        customerName: "Productos Químicos Industriales",
        purchaseOrder: "PO-ORS-2025-001",
        destination: "Guadalajara, Jalisco",
        origin: "Ciudad de México",
        product: "Acetona",
        quantity: "250000",
        unit: "unidades",
        departureDate: new Date("2025-04-20"),
        estimatedDeliveryDate: new Date("2025-04-21"),
        status: "delayed" as const,
        carrier: "QuimiTransportes",
        vehicleInfo: "Trailer QT-5623",
        vehicleType: "Trailer",
        fuelType: "Diesel",
        distance: "549",
        carbonFootprint: "1208",
        driverName: "Fernando Ruiz",
        driverPhone: "+52 555 432 1098",
        customerEmail: "logistica@pqi.com.mx",
        customerPhone: "+52 333 456 7890",
        comments: "Retraso por bloqueo carretero en Jalisco"
      },
      {
        trackingCode: "ORS-2404-0002",
        companyId: 2,
        customerName: "Laboratorios Químicos de Occidente",
        purchaseOrder: "PO-ORS-2025-002",
        destination: "Tepic, Nayarit",
        origin: "Ciudad de México",
        product: "Peróxido de Hidrógeno",
        quantity: "180000",
        unit: "unidades",
        departureDate: new Date("2025-04-23"),
        estimatedDeliveryDate: new Date("2025-04-25"),
        status: "in_transit" as const,
        carrier: "QuimiTransportes",
        vehicleInfo: "Camión refrigerado QT-3318",
        vehicleType: "Camión refrigerado",
        fuelType: "Diesel",
        distance: "832",
        carbonFootprint: "1984",
        driverName: "Alberto Mendoza",
        driverPhone: "+52 555 678 9012",
        customerEmail: "compras@lqo.mx",
        customerPhone: "+52 311 234 5678",
        comments: "Producto requiere cadena de frío"
      },
      {
        trackingCode: "ORS-2404-0003",
        companyId: 2,
        customerName: "Adhesivos Especializados",
        purchaseOrder: "PO-ORS-2025-003",
        destination: "Querétaro, Querétaro",
        origin: "Ciudad de México",
        product: "Metilato de Sodio",
        quantity: "125000",
        unit: "unidades",
        departureDate: new Date("2025-04-18"),
        estimatedDeliveryDate: new Date("2025-04-19"),
        actualDeliveryDate: new Date("2025-04-19"),
        status: "delivered" as const,
        carrier: "LogiChem",
        vehicleInfo: "Camión L-7891",
        vehicleType: "Camión",
        fuelType: "Diesel",
        distance: "218",
        carbonFootprint: "475",
        driverName: "Rafael Torres",
        driverPhone: "+52 555 890 1234",
        customerEmail: "insumos@adhesivosesp.com",
        customerPhone: "+52 442 567 8901",
        comments: "Cliente confirmó recepción completa"
      }
    ];

    // Registrar envíos de Dura
    duraShipments.forEach(shipmentData => {
      const shipment: Shipment = {
        id: this.shipmentId++,
        ...shipmentData,
        actualDeliveryDate: shipmentData.actualDeliveryDate || null,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000), // Fecha aleatoria en los últimos 10 días
        updatedAt: new Date()
      };
      this.shipments.set(shipment.id, shipment);
      
      // Crear actualizaciones para este envío
      this.createInitialShipmentUpdates(shipment);
    });
    
    // Registrar envíos de Orsega
    orsegaShipments.forEach(shipmentData => {
      const shipment: Shipment = {
        id: this.shipmentId++,
        ...shipmentData,
        actualDeliveryDate: shipmentData.actualDeliveryDate || null,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000), // Fecha aleatoria en los últimos 10 días
        updatedAt: new Date()
      };
      this.shipments.set(shipment.id, shipment);
      
      // Crear actualizaciones para este envío
      this.createInitialShipmentUpdates(shipment);
    });
  }
  
  // Método para crear actualizaciones iniciales para cada envío
  private createInitialShipmentUpdates(shipment: Shipment): void {
    // Crear actualización de creación del envío
    const creationUpdate: ShipmentUpdate = {
      id: this.shipmentUpdateId++,
      shipmentId: shipment.id,
      status: 'pending',
      location: shipment.origin,
      comments: 'Envío registrado en sistema',
      updatedBy: 1, // Admin user
      timestamp: new Date(shipment.createdAt ? shipment.createdAt.getTime() : Date.now())
    };
    this.shipmentUpdates.set(creationUpdate.id, creationUpdate);
    
    // Si el envío ya salió, crear actualización de salida
    if (shipment.departureDate && shipment.departureDate <= new Date()) {
      const departureUpdate: ShipmentUpdate = {
        id: this.shipmentUpdateId++,
        shipmentId: shipment.id,
        status: 'in_transit',
        location: shipment.origin,
        comments: 'Envío despachado desde almacén',
        updatedBy: 1, // Admin user
        timestamp: new Date(shipment.departureDate.getTime())
      };
      this.shipmentUpdates.set(departureUpdate.id, departureUpdate);
    }
    
    // Si el envío está retrasado, crear actualización de retraso
    if (shipment.status === 'delayed') {
      const delayUpdate: ShipmentUpdate = {
        id: this.shipmentUpdateId++,
        shipmentId: shipment.id,
        status: 'delayed',
        location: 'En ruta',
        comments: shipment.comments || 'Envío retrasado',
        updatedBy: 1, // Admin user
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ayer
      };
      this.shipmentUpdates.set(delayUpdate.id, delayUpdate);
    }
    
    // Si el envío fue entregado, crear actualización de entrega
    if (shipment.status === 'delivered' && shipment.actualDeliveryDate) {
      const deliveryUpdate: ShipmentUpdate = {
        id: this.shipmentUpdateId++,
        shipmentId: shipment.id,
        status: 'delivered',
        location: shipment.destination,
        comments: 'Envío entregado al cliente',
        updatedBy: 1, // Admin user
        timestamp: new Date(shipment.actualDeliveryDate.getTime())
      };
      this.shipmentUpdates.set(deliveryUpdate.id, deliveryUpdate);
    }
  }

  // Team activity operations
  async getLastKpiUpdateByUser(userId: number): Promise<{ kpiName: string; updateDate: Date; } | undefined> {
    // Para MemStorage, buscar la última actualización de KPI por usuario
    const userKpiValues = Array.from(this.kpiValues.values())
      .filter(kpiValue => kpiValue.updatedBy === userId)
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });
    
    if (userKpiValues.length === 0) return undefined;
    
    const latestValue = userKpiValues[0];
    const kpi = this.kpis.get(latestValue.kpiId);
    
    if (!kpi) return undefined;
    
    return latestValue.date ? {
      kpiName: kpi.name,
      updateDate: latestValue.date
    } : undefined;
  }

  async getTeamActivitySummary(): Promise<Array<{ userId: number; lastLogin: Date | null; lastKpiUpdate: { kpiName: string; updateDate: Date; } | null; }>> {
    const allUsers = Array.from(this.users.values());
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

  // Shipment Notification operations
  async getShipmentNotification(id: number): Promise<ShipmentNotification | undefined> {
    return this.shipmentNotifications.get(id);
  }

  async getShipmentNotificationsByShipment(shipmentId: number): Promise<ShipmentNotification[]> {
    return Array.from(this.shipmentNotifications.values())
      .filter(notification => notification.shipmentId === shipmentId);
  }

  async createShipmentNotification(notificationData: InsertShipmentNotification): Promise<ShipmentNotification> {
    const notification: ShipmentNotification = {
      ...notificationData,
      id: this.shipmentNotificationId++,
      sentAt: new Date(),
      errorMessage: notificationData.errorMessage || null
    };
    this.shipmentNotifications.set(notification.id, notification);
    return notification;
  }

  async updateShipmentNotificationStatus(id: number, status: string, errorMessage?: string): Promise<ShipmentNotification | undefined> {
    const notification = this.shipmentNotifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: ShipmentNotification = {
      ...notification,
      status,
      errorMessage: errorMessage || null,
    };
    
    this.shipmentNotifications.set(id, updatedNotification);
    return updatedNotification;
  }

  // Missing User operations
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Missing Notification operations  
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsForUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      notification => notification.toUserId === userId || notification.toUserId === null
    );
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = this.notificationId++;
    const notification: Notification = {
      ...insertNotification,
      companyId: insertNotification.companyId ?? null,
      areaId: insertNotification.areaId ?? null,
      toUserId: insertNotification.toUserId ?? null,
      type: insertNotification.type ?? "info",
      priority: insertNotification.priority ?? "normal",
      id,
      read: false,
      readAt: null,
      createdAt: new Date()
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: number, userId: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification || (notification.toUserId && notification.toUserId !== userId)) {
      return undefined;
    }
    
    const updatedNotification = { ...notification, read: true, readAt: new Date() };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async deleteNotification(id: number, userId: number): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification || (notification.toUserId && notification.toUserId !== userId)) {
      return false;
    }
    return this.notifications.delete(id);
  }

  // Missing Job Profile operations
  async getJobProfile(id: number): Promise<JobProfile | undefined> {
    return this.jobProfiles.get(id);
  }

  async getJobProfileByUserArea(areaId: number, companyId: number): Promise<JobProfile | undefined> {
    return Array.from(this.jobProfiles.values()).find(
      profile => profile.areaId === areaId && profile.companyId === companyId
    );
  }

  async getJobProfileWithDetails(userId: number): Promise<JobProfileWithDetails | undefined> {
    const user = await this.getUser(userId);
    if (!user || !user.areaId) return undefined;
    
    const profile = await this.getJobProfileByUserArea(user.areaId, user.companyId || 1);
    if (!profile) return undefined;
    
    const area = await this.getArea(user.areaId);
    const company = user.companyId ? await this.getCompany(user.companyId) : null;
    const kpis = await this.getUserKpis(userId);
    
    return {
      id: profile.id,
      companyId: profile.companyId,
      areaId: profile.areaId,
      title: profile.title,
      description: profile.description,
      mainActivities: profile.mainActivities as string[],
      responsibilities: profile.responsibilities as string[],
      kpiInstructions: profile.kpiInstructions as { kpiName: string; description: string; updateFrequency: string; instructions: string; }[],
      tips: profile.tips as { category: string; tip: string; }[],
      processes: profile.processes as { name: string; description: string; steps: string[]; }[],
      updateFrequency: profile.updateFrequency as { daily: string[]; weekly: string[]; monthly: string[]; },
      areaName: area?.name || '',
      companyName: company?.name || '',
      userKpis: kpis.map(kpi => ({
        id: kpi.id,
        name: kpi.name,
        description: kpi.description || '',
        target: kpi.target,
        frequency: kpi.frequency,
        unit: kpi.unit
      }))
    };
  }

  async createJobProfile(insertProfile: InsertJobProfile): Promise<JobProfile> {
    const id = this.jobProfileId++;
    const profile: JobProfile = {
      ...insertProfile,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.jobProfiles.set(id, profile);
    return profile;
  }

  async updateJobProfile(id: number, profileData: Partial<JobProfile>): Promise<JobProfile | undefined> {
    const profile = this.jobProfiles.get(id);
    if (!profile) return undefined;
    
    const updatedProfile = { 
      ...profile, 
      ...profileData,
      updatedAt: new Date()
    };
    this.jobProfiles.set(id, updatedProfile);
    return updatedProfile;
  }

  async getUserKpis(userId: number): Promise<Kpi[]> {
    const user = await this.getUser(userId);
    if (!user || !user.areaId) return [];
    
    return this.getKpisByArea(user.areaId);
  }
  
  // Shipment Cycle Times operations
  async getShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined> {
    return this.shipmentCycleTimes.get(shipmentId);
  }
  
  async upsertShipmentCycleTime(cycleTime: InsertShipmentCycleTimes): Promise<ShipmentCycleTimes> {
    const id = this.cycleTimeId++;
    const existing = this.shipmentCycleTimes.get(cycleTime.shipmentId);
    
    const newCycleTime: ShipmentCycleTimes = {
      id: existing?.id || id,
      ...cycleTime,
      pendingAt: cycleTime.pendingAt ?? null,
      inTransitAt: cycleTime.inTransitAt ?? null,
      deliveredAt: cycleTime.deliveredAt ?? null,
      closedAt: cycleTime.closedAt ?? null,
      hoursPendingToTransit: cycleTime.hoursPendingToTransit ?? null,
      hoursTransitToDelivered: cycleTime.hoursTransitToDelivered ?? null,
      hoursDeliveredToClosed: cycleTime.hoursDeliveredToClosed ?? null,
      hoursTotalCycle: cycleTime.hoursTotalCycle ?? null,
      hoursToDelivery: cycleTime.hoursToDelivery ?? null,
      computedAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.shipmentCycleTimes.set(cycleTime.shipmentId, newCycleTime);
    return newCycleTime;
  }
  
  async recalculateShipmentCycleTime(shipmentId: number): Promise<ShipmentCycleTimes | undefined> {
    const shipment = this.shipments.get(shipmentId);
    if (!shipment) return undefined;
    
    // Get all updates for this shipment, sorted by timestamp
    const updates = Array.from(this.shipmentUpdates.values())
      .filter(update => update.shipmentId === shipmentId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
    
    // Find first occurrence of each status
    const statusTimestamps: { [key: string]: Date } = {};
    for (const update of updates) {
      if (!statusTimestamps[update.status]) {
        statusTimestamps[update.status] = update.timestamp!;
      }
    }
    
    // Calculate timestamps for each phase
    const createdAt = shipment.createdAt!;
    const pendingAt = statusTimestamps['pending'] || createdAt;
    const inTransitAt = statusTimestamps['in_transit'];
    const deliveredAt = statusTimestamps['delivered'] || shipment.actualDeliveryDate;
    const closedAt = statusTimestamps['cancelled']; // Using 'cancelled' as 'closed' in UI
    
    // Calculate durations in hours
    const calculateHours = (start?: Date | null, end?: Date | null): string | null => {
      if (!start || !end) return null;
      const diffMs = end.getTime() - start.getTime();
      return (diffMs / (1000 * 60 * 60)).toFixed(2); // Convert to hours with 2 decimals
    };
    
    const hoursPendingToTransit = calculateHours(pendingAt, inTransitAt);
    const hoursTransitToDelivered = calculateHours(inTransitAt, deliveredAt);  
    const hoursDeliveredToClosed = calculateHours(deliveredAt, closedAt);
    const hoursTotalCycle = calculateHours(createdAt, closedAt);
    const hoursToDelivery = calculateHours(createdAt, deliveredAt);
    
    // Upsert the calculated cycle times
    const cycleTimeData: InsertShipmentCycleTimes = {
      shipmentId,
      companyId: shipment.companyId,
      createdAt,
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
  }
  
  async getAggregateCycleTimes(companyId?: number, startDate?: string, endDate?: string): Promise<CycleTimeMetrics[]> {
    let cycleTimes = Array.from(this.shipmentCycleTimes.values());
    
    // Filter by company if specified
    if (companyId) {
      cycleTimes = cycleTimes.filter(ct => ct.companyId === companyId);
    }
    
    // Filter by date range if specified
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      cycleTimes = cycleTimes.filter(ct => {
        const created = new Date(ct.createdAt);
        return created >= start && created <= end;
      });
    }
    
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
    const validPendingToTransit = cycleTimes.filter(ct => ct.hoursPendingToTransit).map(ct => parseFloat(ct.hoursPendingToTransit!));
    const validTransitToDelivered = cycleTimes.filter(ct => ct.hoursTransitToDelivered).map(ct => parseFloat(ct.hoursTransitToDelivered!));
    const validDeliveredToClosed = cycleTimes.filter(ct => ct.hoursDeliveredToClosed).map(ct => parseFloat(ct.hoursDeliveredToClosed!));
    const validTotalCycle = cycleTimes.filter(ct => ct.hoursTotalCycle).map(ct => parseFloat(ct.hoursTotalCycle!));
    const validToDelivery = cycleTimes.filter(ct => ct.hoursToDelivery).map(ct => parseFloat(ct.hoursToDelivery!));
    
    const avg = (arr: number[]): number | null => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    
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
  }
}

// For development/testing
// export const storage = new MemStorage();

// For production with database persistence
import { DatabaseStorage } from './DatabaseStorage';
export const storage = new DatabaseStorage();
