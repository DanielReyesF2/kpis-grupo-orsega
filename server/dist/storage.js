"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.MemStorage = void 0;
class MemStorage {
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
        this.userId = 1;
        this.companyId = 1;
        this.areaId = 1;
        this.kpiId = 1;
        this.kpiValueId = 1;
        this.actionPlanId = 1;
        this.shipmentId = 1;
        this.shipmentUpdateId = 1;
        this.shipmentNotificationId = 1;
        // Initialize with sample data
        this.initializeData();
        // Initialize shipment data
        this.initializeShipmentData();
    }
    initializeData() {
        // Create default admin user
        const adminUser = {
            id: this.userId++,
            name: "Admin",
            email: "admin@econova.com",
            password: "password123", // In a real app, this would be hashed
            role: "admin",
            companyId: null,
            lastLogin: new Date(),
        };
        this.users.set(adminUser.id, adminUser);
        // Crear usuario para Omar Navarro (responsable de ventas)
        const omarUser = {
            id: this.userId++,
            name: "Omar Navarro",
            email: "omar.navarro",
            password: "ventas2025", // En una app real, esto estaría hasheado
            role: "user",
            companyId: null, // Puede acceder a todas las compañías
            lastLogin: null,
        };
        this.users.set(omarUser.id, omarUser);
        // Crear usuario para Mario Reynoso (responsable de Contabilidad y Finanzas)
        const marioUser = {
            id: this.userId++,
            name: "Mario Reynoso",
            email: "mario.reynoso",
            password: "finanzas2025", // En una app real, esto estaría hasheado
            role: "user",
            companyId: null, // Puede acceder a todas las compañías
            lastLogin: null,
        };
        this.users.set(marioUser.id, marioUser);
        // Crear usuario para Thalia Rodriguez (responsable de Logística)
        const thaliaUser = {
            id: this.userId++,
            name: "Thalia Rodriguez",
            email: "thalia.rodriguez",
            password: "logistica2025", // En una app real, esto estaría hasheado
            role: "user",
            companyId: null, // Puede acceder a todas las compañías
            lastLogin: null,
        };
        this.users.set(thaliaUser.id, thaliaUser);
        // Create companies
        const duraCompany = {
            id: this.companyId++,
            name: "Dura International",
            description: "Empresa líder en la industria química",
            sector: "Química",
            logo: null,
            createdAt: new Date(),
        };
        this.companies.set(duraCompany.id, duraCompany);
        const orsegaCompany = {
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
        const duraAreaMap = new Map();
        const orsegaAreaMap = new Map();
        // Add areas for Dura International
        allAreas.forEach(areaName => {
            const area = {
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
            const area = {
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
                const duraKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.duraTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: duraAreaMap.get("Contabilidad y Finanzas").id,
                    companyId: duraCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: duraKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
                // Grupo Orsega KPI
                const orsegaKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.orsegaTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: orsegaAreaMap.get("Contabilidad y Finanzas").id,
                    companyId: orsegaCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: orsegaKpi.id,
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
                const duraKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.duraTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: duraAreaMap.get("Compras").id,
                    companyId: duraCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: duraKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
                // Grupo Orsega KPI
                const orsegaKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.orsegaTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: orsegaAreaMap.get("Compras").id,
                    companyId: orsegaCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: orsegaKpi.id,
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
                const duraKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.duraTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: duraAreaMap.get("Ventas").id,
                    companyId: duraCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: duraKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
                // Grupo Orsega KPI
                const orsegaKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.orsegaTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: orsegaAreaMap.get("Ventas").id,
                    companyId: orsegaCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: orsegaKpi.id,
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
                const duraKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.duraTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: duraAreaMap.get("Soporte de Ventas").id,
                    companyId: duraCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: duraKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
                // Grupo Orsega KPI
                const orsegaKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.orsegaTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: orsegaAreaMap.get("Soporte de Ventas").id,
                    companyId: orsegaCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: orsegaKpi.id,
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
                const duraKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.duraTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: duraAreaMap.get("Logística").id,
                    companyId: duraCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: duraKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
                // Grupo Orsega KPI
                const orsegaKpi = {
                    id: this.kpiId++,
                    name: kpiData.name,
                    description: kpiData.description,
                    unit: kpiData.unit,
                    target: kpiData.orsegaTarget,
                    frequency: kpiData.frequency,
                    calculationMethod: kpiData.calculationMethod,
                    responsible: kpiData.responsible,
                    areaId: orsegaAreaMap.get("Logística").id,
                    companyId: orsegaCompany.id
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
                    const kpiValue = {
                        id: this.kpiValueId++,
                        kpiId: orsegaKpi.id,
                        ...valueData,
                        date: new Date()
                    };
                    this.kpiValues.set(kpiValue.id, kpiValue);
                });
            });
        }
    }
    // User operations
    async getUser(id) {
        return this.users.get(id);
    }
    async getUserByEmail(email) {
        return Array.from(this.users.values()).find((user) => user.email.toLowerCase() === email.toLowerCase());
    }
    async getUserByUsername(username) {
        try {
            // Para propósitos de migración, si el usuario ingresa un email, buscar por email también
            if (username.includes('@')) {
                return this.getUserByEmail(username);
            }
            // Caso especial para el usuario admin (sin verificar formato de email)
            if (username.toLowerCase() === 'admin') {
                return Array.from(this.users.values()).find((user) => user.name.toLowerCase() === 'admin');
            }
            // Para otros usuarios, verificar si coincide con la parte del email antes del @
            return Array.from(this.users.values()).find((user) => {
                const emailParts = user.email.toLowerCase().split('@');
                return emailParts.length > 0 && emailParts[0] === username.toLowerCase();
            });
        }
        catch (error) {
            console.error("Error en getUserByUsername:", error);
            return undefined;
        }
    }
    async createUser(insertUser) {
        const id = this.userId++;
        const user = { ...insertUser, id };
        this.users.set(id, user);
        return user;
    }
    async updateUser(id, userData) {
        const user = this.users.get(id);
        if (!user)
            return undefined;
        const updatedUser = { ...user, ...userData };
        this.users.set(id, updatedUser);
        return updatedUser;
    }
    async getUsers() {
        return Array.from(this.users.values());
    }
    // Company operations
    async getCompany(id) {
        return this.companies.get(id);
    }
    async getCompanies() {
        return Array.from(this.companies.values());
    }
    async createCompany(insertCompany) {
        const id = this.companyId++;
        const company = { ...insertCompany, id, createdAt: new Date() };
        this.companies.set(id, company);
        return company;
    }
    async updateCompany(id, companyData) {
        const company = this.companies.get(id);
        if (!company)
            return undefined;
        const updatedCompany = { ...company, ...companyData };
        this.companies.set(id, updatedCompany);
        return updatedCompany;
    }
    // Area operations
    async getArea(id) {
        return this.areas.get(id);
    }
    async getAreas() {
        return Array.from(this.areas.values());
    }
    async getAreasByCompany(companyId) {
        return Array.from(this.areas.values()).filter((area) => area.companyId === companyId);
    }
    async createArea(insertArea) {
        const id = this.areaId++;
        const area = { ...insertArea, id };
        this.areas.set(id, area);
        return area;
    }
    async updateArea(id, areaData) {
        const area = this.areas.get(id);
        if (!area)
            return undefined;
        const updatedArea = { ...area, ...areaData };
        this.areas.set(id, updatedArea);
        return updatedArea;
    }
    // KPI operations
    async getKpi(id) {
        return this.kpis.get(id);
    }
    async getKpis() {
        return Array.from(this.kpis.values());
    }
    async getKpisByCompany(companyId) {
        return Array.from(this.kpis.values()).filter((kpi) => kpi.companyId === companyId);
    }
    async getKpisByArea(areaId) {
        return Array.from(this.kpis.values()).filter((kpi) => kpi.areaId === areaId);
    }
    async createKpi(insertKpi) {
        const id = this.kpiId++;
        const kpi = { ...insertKpi, id };
        this.kpis.set(id, kpi);
        return kpi;
    }
    async updateKpi(id, kpiData) {
        const kpi = this.kpis.get(id);
        if (!kpi)
            return undefined;
        const updatedKpi = { ...kpi, ...kpiData };
        this.kpis.set(id, updatedKpi);
        return updatedKpi;
    }
    // KPI Value operations
    async getKpiValue(id) {
        return this.kpiValues.get(id);
    }
    async getKpiValues() {
        return Array.from(this.kpiValues.values());
    }
    async getKpiValuesByKpi(kpiId) {
        return Array.from(this.kpiValues.values())
            .filter((value) => value.kpiId === kpiId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    async getLatestKpiValues(kpiId, limit) {
        return Array.from(this.kpiValues.values())
            .filter((value) => value.kpiId === kpiId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, limit);
    }
    async createKpiValue(insertKpiValue) {
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
        const kpiValue = {
            ...insertKpiValue,
            id,
            date: new Date(),
            period
        };
        this.kpiValues.set(id, kpiValue);
        return kpiValue;
    }
    // Action Plan operations
    async getActionPlan(id) {
        return this.actionPlans.get(id);
    }
    async getActionPlansByKpi(kpiId) {
        return Array.from(this.actionPlans.values()).filter((plan) => plan.kpiId === kpiId);
    }
    async createActionPlan(insertActionPlan) {
        const id = this.actionPlanId++;
        const actionPlan = { ...insertActionPlan, id };
        this.actionPlans.set(id, actionPlan);
        return actionPlan;
    }
    async updateActionPlan(id, planData) {
        const plan = this.actionPlans.get(id);
        if (!plan)
            return undefined;
        const updatedPlan = { ...plan, ...planData };
        this.actionPlans.set(id, updatedPlan);
        return updatedPlan;
    }
    // Implementación de métodos para Shipment (Envíos)
    async getShipment(id) {
        return this.shipments.get(id);
    }
    async getShipmentByTrackingCode(trackingCode) {
        for (const shipment of this.shipments.values()) {
            if (shipment.trackingCode === trackingCode) {
                return shipment;
            }
        }
        return undefined;
    }
    async getShipments() {
        return Array.from(this.shipments.values());
    }
    async getShipmentsByCompany(companyId) {
        return Array.from(this.shipments.values()).filter(shipment => shipment.companyId === companyId);
    }
    async getShipmentsByStatus(status) {
        return Array.from(this.shipments.values()).filter(shipment => shipment.status === status);
    }
    async getShipmentsByCompanyAndStatus(companyId, status) {
        return Array.from(this.shipments.values()).filter(shipment => shipment.companyId === companyId && shipment.status === status);
    }
    async createShipment(shipmentData) {
        const id = this.shipmentId++;
        // Generamos un código de seguimiento único si no se proporciona
        if (!shipmentData.trackingCode) {
            const companyPrefix = shipmentData.companyId === 1 ? 'DUR' : 'ORS';
            const currentDate = new Date();
            const year = currentDate.getFullYear().toString().slice(2);
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            const trackingNum = id.toString().padStart(4, '0');
            shipmentData.trackingCode = `${companyPrefix}-${year}${month}-${trackingNum}`;
        }
        const createdAt = new Date();
        const updatedAt = new Date();
        const shipment = {
            id,
            ...shipmentData,
            status: shipmentData.status || 'pending',
            createdAt,
            updatedAt
        };
        this.shipments.set(id, shipment);
        return shipment;
    }
    async updateShipment(id, shipmentData) {
        const shipment = this.shipments.get(id);
        if (!shipment)
            return undefined;
        const updatedShipment = {
            ...shipment,
            ...shipmentData,
            updatedAt: new Date()
        };
        this.shipments.set(id, updatedShipment);
        return updatedShipment;
    }
    // Implementación de métodos para ShipmentUpdate (Actualizaciones de envíos)
    async getShipmentUpdate(id) {
        return this.shipmentUpdates.get(id);
    }
    async getShipmentUpdatesByShipment(shipmentId) {
        return Array.from(this.shipmentUpdates.values())
            .filter(update => update.shipmentId === shipmentId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Ordenar por fecha de actualización, más reciente primero
    }
    async createShipmentUpdate(updateData) {
        const id = this.shipmentUpdateId++;
        const timestamp = new Date();
        const update = {
            id,
            ...updateData,
            timestamp
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
    initializeShipmentData() {
        // Envíos para Dura International
        const duraShipments = [
            {
                trackingCode: "DUR-2404-0001",
                companyId: 1,
                customerName: "Distribuidora Química del Pacífico",
                destination: "Mazatlán, Sinaloa",
                origin: "Monterrey, Nuevo León",
                product: "Sosa Cáustica",
                quantity: "5000",
                unit: "KG",
                departureDate: new Date("2025-04-19"),
                estimatedDeliveryDate: new Date("2025-04-22"),
                status: "in_transit",
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
                destination: "Torreón, Coahuila",
                origin: "Monterrey, Nuevo León",
                product: "Ácido Sulfúrico",
                quantity: "3500",
                unit: "KG",
                departureDate: new Date("2025-04-22"),
                estimatedDeliveryDate: new Date("2025-04-25"),
                status: "pending",
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
                destination: "León, Guanajuato",
                origin: "Monterrey, Nuevo León",
                product: "Formaldehído",
                quantity: "2800",
                unit: "KG",
                departureDate: new Date("2025-04-15"),
                estimatedDeliveryDate: new Date("2025-04-18"),
                actualDeliveryDate: new Date("2025-04-18"),
                status: "delivered",
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
                destination: "Guadalajara, Jalisco",
                origin: "Ciudad de México",
                product: "Acetona",
                quantity: "250000",
                unit: "unidades",
                departureDate: new Date("2025-04-20"),
                estimatedDeliveryDate: new Date("2025-04-21"),
                status: "delayed",
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
                destination: "Tepic, Nayarit",
                origin: "Ciudad de México",
                product: "Peróxido de Hidrógeno",
                quantity: "180000",
                unit: "unidades",
                departureDate: new Date("2025-04-23"),
                estimatedDeliveryDate: new Date("2025-04-25"),
                status: "in_transit",
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
                destination: "Querétaro, Querétaro",
                origin: "Ciudad de México",
                product: "Metilato de Sodio",
                quantity: "125000",
                unit: "unidades",
                departureDate: new Date("2025-04-18"),
                estimatedDeliveryDate: new Date("2025-04-19"),
                actualDeliveryDate: new Date("2025-04-19"),
                status: "delivered",
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
            const shipment = {
                id: this.shipmentId++,
                ...shipmentData,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000), // Fecha aleatoria en los últimos 10 días
                updatedAt: new Date()
            };
            this.shipments.set(shipment.id, shipment);
            // Crear actualizaciones para este envío
            this.createInitialShipmentUpdates(shipment);
        });
        // Registrar envíos de Orsega
        orsegaShipments.forEach(shipmentData => {
            const shipment = {
                id: this.shipmentId++,
                ...shipmentData,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000), // Fecha aleatoria en los últimos 10 días
                updatedAt: new Date()
            };
            this.shipments.set(shipment.id, shipment);
            // Crear actualizaciones para este envío
            this.createInitialShipmentUpdates(shipment);
        });
    }
    // Método para crear actualizaciones iniciales para cada envío
    createInitialShipmentUpdates(shipment) {
        // Crear actualización de creación del envío
        const creationUpdate = {
            id: this.shipmentUpdateId++,
            shipmentId: shipment.id,
            status: 'pending',
            location: shipment.origin,
            comments: 'Envío registrado en sistema',
            updatedBy: 1, // Admin user
            timestamp: new Date(shipment.createdAt.getTime())
        };
        this.shipmentUpdates.set(creationUpdate.id, creationUpdate);
        // Si el envío ya salió, crear actualización de salida
        if (shipment.departureDate && shipment.departureDate <= new Date()) {
            const departureUpdate = {
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
            const delayUpdate = {
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
            const deliveryUpdate = {
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
    async getLastKpiUpdateByUser(userId) {
        // Para MemStorage, buscar la última actualización de KPI por usuario
        const userKpiValues = Array.from(this.kpiValues.values())
            .filter(kpiValue => kpiValue.updatedBy === userId)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
        if (userKpiValues.length === 0)
            return undefined;
        const latestValue = userKpiValues[0];
        const kpi = this.kpis.get(latestValue.kpiId);
        if (!kpi)
            return undefined;
        return {
            kpiName: kpi.name,
            updateDate: latestValue.date
        };
    }
    async getTeamActivitySummary() {
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
    async getShipmentNotification(id) {
        return this.shipmentNotifications.get(id);
    }
    async getShipmentNotificationsByShipment(shipmentId) {
        return Array.from(this.shipmentNotifications.values())
            .filter(notification => notification.shipmentId === shipmentId);
    }
    async createShipmentNotification(notificationData) {
        const notification = {
            ...notificationData,
            id: this.shipmentNotificationId++,
            sentAt: new Date(),
        };
        this.shipmentNotifications.set(notification.id, notification);
        return notification;
    }
    async updateShipmentNotificationStatus(id, status, errorMessage) {
        const notification = this.shipmentNotifications.get(id);
        if (!notification)
            return undefined;
        const updatedNotification = {
            ...notification,
            status,
            errorMessage: errorMessage || null,
        };
        this.shipmentNotifications.set(id, updatedNotification);
        return updatedNotification;
    }
}
exports.MemStorage = MemStorage;
// For development/testing
// export const storage = new MemStorage();
// For production with database persistence
const DatabaseStorage_1 = require("./DatabaseStorage");
exports.storage = new DatabaseStorage_1.DatabaseStorage();
