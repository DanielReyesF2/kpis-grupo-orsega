import { users, companies, areas, kpis, kpiValues, actionPlans } from "@shared/schema";
import type { 
  User, InsertUser, 
  Company, InsertCompany, 
  Area, InsertArea, 
  Kpi, InsertKpi,
  KpiValue, InsertKpiValue,
  ActionPlan, InsertActionPlan
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  
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
  getKpi(id: number): Promise<Kpi | undefined>;
  getKpis(): Promise<Kpi[]>;
  getKpisByCompany(companyId: number): Promise<Kpi[]>;
  getKpisByArea(areaId: number): Promise<Kpi[]>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: number, kpi: Partial<Kpi>): Promise<Kpi | undefined>;
  
  // KPI Value operations
  getKpiValue(id: number): Promise<KpiValue | undefined>;
  getKpiValues(): Promise<KpiValue[]>;
  getKpiValuesByKpi(kpiId: number): Promise<KpiValue[]>;
  getLatestKpiValues(kpiId: number, limit: number): Promise<KpiValue[]>;
  createKpiValue(kpiValue: InsertKpiValue): Promise<KpiValue>;
  
  // Action Plan operations
  getActionPlan(id: number): Promise<ActionPlan | undefined>;
  getActionPlansByKpi(kpiId: number): Promise<ActionPlan[]>;
  createActionPlan(actionPlan: InsertActionPlan): Promise<ActionPlan>;
  updateActionPlan(id: number, actionPlan: Partial<ActionPlan>): Promise<ActionPlan | undefined>;

  // Session store
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private companies: Map<number, Company>;
  private areas: Map<number, Area>;
  private kpis: Map<number, Kpi>;
  private kpiValues: Map<number, KpiValue>;
  private actionPlans: Map<number, ActionPlan>;
  
  private userId: number;
  private companyId: number;
  private areaId: number;
  private kpiId: number;
  private kpiValueId: number;
  private actionPlanId: number;
  
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.companies = new Map();
    this.areas = new Map();
    this.kpis = new Map();
    this.kpiValues = new Map();
    this.actionPlans = new Map();
    
    this.userId = 1;
    this.companyId = 1;
    this.areaId = 1;
    this.kpiId = 1;
    this.kpiValueId = 1;
    this.actionPlanId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Un día
    });
    
    // Initialize with sample data
    this.initializeData();
  }

  private initializeData(): void {
    // Create default admin user
    const adminUser: User = {
      id: this.userId++,
      name: "Admin",
      email: "admin@econova.com",
      password: "password123", // En una app real, esto estaría hasheado
      role: "admin",
      companyId: null,
      lastLogin: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

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

    // Crear áreas funcionales para ambas empresas - Solo las 3 áreas principales
    const mainAreas = [
      "Ventas",
      "Logística",
      "Contabilidad y Finanzas"
    ];
    
    // Maps para almacenar referencias de las áreas
    const duraAreaMap = new Map<string, Area>();
    const orsegaAreaMap = new Map<string, Area>();

    // Agregar áreas para Dura International
    mainAreas.forEach(areaName => {
      const area: Area = {
        id: this.areaId++,
        name: areaName,
        description: `Área de ${areaName} para Dura International`,
        companyId: duraCompany.id,
      };
      this.areas.set(area.id, area);
      duraAreaMap.set(areaName, area);
    });

    // Agregar áreas para Grupo Orsega
    mainAreas.forEach(areaName => {
      const area: Area = {
        id: this.areaId++,
        name: areaName,
        description: `Área de ${areaName} para Grupo Orsega`,
        companyId: orsegaCompany.id,
      };
      this.areas.set(area.id, area);
      orsegaAreaMap.set(areaName, area);
    });

    // 1. VENTAS - Configurada como primera área prioritaria
    if (duraAreaMap.has("Ventas") && orsegaAreaMap.has("Ventas")) {
      const salesKpis = [
        {
          name: "Volumen de ventas alcanzado",
          description: "Mide el volumen total de ventas (en KG para Dura, en unidades para Orsega)",
          unit: "KG",
          duraTarget: "53,480 KG",
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
          responsible: "Rafael Cortés"
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
          duraTarget: "Satisfactorio o superior",
          orsegaTarget: "Satisfactorio o superior",
          frequency: "quarterly",
          calculationMethod: "Encuesta cualitativa",
          responsible: "Fernando Ruiz"
        }
      ];
      
      // Agregar KPIs para ambas empresas
      salesKpis.forEach(kpiData => {
        // KPI de Dura International
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
          companyId: duraCompany.id
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Valores de muestra para Dura
        const duraValues = [
          { 
            value: kpiData.name.includes("Volumen") ? "51,230 KG" : 
                   kpiData.name.includes("Porcentaje de crecimiento") ? "+8.5%" : 
                   kpiData.name.includes("Nuevos clientes") ? "1" : 
                   kpiData.name.includes("Tasa de retención") ? "92%" : 
                   "Satisfactorio",
            period: "Abril 2023", 
            status: kpiData.name.includes("Volumen") ? "alert" : 
                    kpiData.name.includes("Porcentaje de crecimiento") ? "alert" : 
                    kpiData.name.includes("Nuevos clientes") ? "alert" : 
                    "complies",
            compliancePercentage: kpiData.name.includes("Volumen") ? "96%" : 
                                 kpiData.name.includes("Porcentaje de crecimiento") ? "85%" : 
                                 kpiData.name.includes("Nuevos clientes") ? "50%" : 
                                 "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // KPI de Grupo Orsega
        const orsegaKpi: Kpi = {
          id: this.kpiId++,
          name: kpiData.name,
          description: kpiData.description,
          unit: kpiData.name.includes("Volumen") ? "unidades" : kpiData.unit,
          target: kpiData.orsegaTarget,
          frequency: kpiData.frequency,
          calculationMethod: kpiData.calculationMethod,
          responsible: kpiData.responsible,
          areaId: orsegaAreaMap.get("Ventas")!.id,
          companyId: orsegaCompany.id
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Valores de muestra para Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Volumen") ? "765,420 unidades" : 
                   kpiData.name.includes("Porcentaje de crecimiento") ? "+11.2%" : 
                   kpiData.name.includes("Nuevos clientes") ? "3" : 
                   kpiData.name.includes("Tasa de retención") ? "88%" : 
                   "Muy satisfactorio",
            period: "Abril 2023", 
            status: kpiData.name.includes("Tasa de retención") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Volumen") ? "98%" : 
                                 kpiData.name.includes("Tasa de retención") ? "98%" : "100%",
            comments: "Valor registrado para el periodo"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 2. LOGÍSTICA
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
      
      // Agregar KPIs para ambas empresas
      logisticsKpis.forEach(kpiData => {
        // KPI de Dura International
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
          companyId: duraCompany.id
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Valores de muestra para Dura
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
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // KPI de Grupo Orsega
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
          companyId: orsegaCompany.id
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Valores de muestra para Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Precisión de inventarios") ? "99.2%" : 
                   kpiData.name.includes("Cumplimiento de tiempos") ? "97%" : 
                   kpiData.name.includes("Costos de transporte") ? "-3% vs inflación" : 
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
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }
    
    // 3. CONTABILIDAD Y FINANZAS
    if (duraAreaMap.has("Contabilidad y Finanzas") && orsegaAreaMap.has("Contabilidad y Finanzas")) {
      const financeKpis = [
        {
          name: "Precisión en estados financieros",
          description: "Mide la exactitud de los estados financieros generados",
          unit: "%",
          duraTarget: "99%",
          orsegaTarget: "99%",
          frequency: "monthly",
          calculationMethod: "(Reportes sin errores / Total de reportes) x 100",
          responsible: "María Rodríguez"
        },
        {
          name: "Velocidad de rotación de cuentas por cobrar",
          description: "Mide el tiempo promedio para cobrar cuentas pendientes",
          unit: "días",
          duraTarget: "< 45 días",
          orsegaTarget: "< 45 días",
          frequency: "monthly",
          calculationMethod: "Promedio de días para cobrar",
          responsible: "Juan Pérez"
        },
        {
          name: "Cumplimiento de obligaciones fiscales",
          description: "Mide el cumplimiento de las obligaciones fiscales",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "monthly",
          calculationMethod: "(Obligaciones cumplidas a tiempo / Total de obligaciones) x 100",
          responsible: "Luis García"
        },
        {
          name: "Facturación sin errores",
          description: "Mide la precisión en la generación de facturas",
          unit: "%",
          duraTarget: "100%",
          orsegaTarget: "100%",
          frequency: "weekly",
          calculationMethod: "(Facturas sin errores / Total de facturas) x 100",
          responsible: "Ana Torres"
        },
        {
          name: "Control de costos (margen bruto)",
          description: "Mide el margen bruto en relación con el presupuesto",
          unit: "%",
          duraTarget: "> Presupuestado",
          orsegaTarget: "> Presupuestado",
          frequency: "monthly",
          calculationMethod: "Margen bruto actual - Margen bruto presupuestado",
          responsible: "Carlos Sánchez"
        }
      ];

      // Agregar KPIs para ambas empresas
      financeKpis.forEach(kpiData => {
        // KPI de Dura International
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
          companyId: duraCompany.id
        };
        this.kpis.set(duraKpi.id, duraKpi);
        
        // Valores de muestra para Dura
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
                                  kpiData.name.includes("Rotación") ? "90%" : "100%",
            comments: "Valor registrado para el periodo"
          },
          { 
            value: kpiData.name.includes("Precisión") ? "99.2%" : 
                   kpiData.name.includes("Rotación") ? "42" : 
                   kpiData.name.includes("Cumplimiento") ? "100%" : 
                   kpiData.name.includes("Facturación") ? "98%" : "+3.1%", 
            period: "Q2 2023", 
            status: kpiData.name.includes("Rotación") ? "complies" : "complies",
            compliancePercentage: kpiData.name.includes("Rotación") ? "100%" : "100%",
            comments: "Mejora respecto al periodo anterior"
          }
        ];

        duraValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: duraKpi.id,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
        
        // KPI de Grupo Orsega
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
          companyId: orsegaCompany.id
        };
        this.kpis.set(orsegaKpi.id, orsegaKpi);
        
        // Valores de muestra para Orsega
        const orsegaValues = [
          { 
            value: kpiData.name.includes("Precisión") ? "99.0%" : 
                   kpiData.name.includes("Rotación") ? "47" : 
                   kpiData.name.includes("Cumplimiento") ? "98%" : 
                   kpiData.name.includes("Facturación") ? "95%" : "+1.8%", 
            period: "Q1 2023", 
            status: kpiData.name.includes("Cumplimiento") ? "alert" : 
                    kpiData.name.includes("Rotación") ? "alert" : 
                    kpiData.name.includes("Facturación") ? "alert" : "complies",
            compliancePercentage: kpiData.name.includes("Cumplimiento") ? "98%" : 
                                  kpiData.name.includes("Rotación") ? "90%" : 
                                  kpiData.name.includes("Facturación") ? "95%" : "100%",
            comments: "Valor registrado para el periodo"
          },
          { 
            value: kpiData.name.includes("Precisión") ? "99.5%" : 
                   kpiData.name.includes("Rotación") ? "43" : 
                   kpiData.name.includes("Cumplimiento") ? "100%" : 
                   kpiData.name.includes("Facturación") ? "98%" : "+2.5%", 
            period: "Q2 2023", 
            status: kpiData.name.includes("Rotación") ? "complies" : "complies",
            compliancePercentage: "100%",
            comments: "Mejora respecto al periodo anterior"
          }
        ];

        orsegaValues.forEach(valueData => {
          const kpiValue: KpiValue = {
            id: this.kpiValueId++,
            kpiId: orsegaKpi.id,
            ...valueData,
            date: new Date()
          };
          this.kpiValues.set(kpiValue.id, kpiValue);
        });
      });
    }