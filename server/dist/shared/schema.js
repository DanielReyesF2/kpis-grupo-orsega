"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertPendingInvoiceSchema = exports.pendingInvoices = exports.insertTransportRequestSchema = exports.transportRequests = exports.insertPaymentReminderSchema = exports.paymentReminders = exports.insertPaymentSchema = exports.payments = exports.paymentStatusEnum = exports.insertSupplierSchema = exports.suppliers = exports.insertPaymentAlertSchema = exports.paymentAlerts = exports.insertDocumentSchema = exports.documents = exports.insertDocumentCategorySchema = exports.documentCategories = exports.insertDailyBalanceSchema = exports.dailyBalances = exports.insertBankAccountSchema = exports.bankAccounts = exports.jobProfileWithDetails = exports.insertJobProfileSchema = exports.jobProfiles = exports.updateShipmentStatusSchema = exports.insertShipmentNotificationSchema = exports.shipmentNotifications = exports.insertNotificationSchema = exports.notifications = exports.insertShipmentUpdateSchema = exports.shipmentUpdates = exports.insertShipmentSchema = exports.shipments = exports.registerUserSchema = exports.updateKpiSchema = exports.updateKpiValueSchema = exports.loginSchema = exports.insertActionPlanSchema = exports.actionPlans = exports.insertKpiValueSchema = exports.kpiValues = exports.insertKpiSchema = exports.kpis = exports.insertAreaSchema = exports.areas = exports.insertCompanySchema = exports.companies = exports.insertUserSchema = exports.users = exports.shipmentStatusEnum = void 0;
exports.insertClientSchema = exports.clients = exports.insertTransportProviderSchema = exports.transportProviders = exports.currencyAnalysisSchema = exports.insertCurrencyQuoteSchema = exports.currencyQuotes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
// Enumeración para el estado del envío
exports.shipmentStatusEnum = (0, pg_core_1.pgEnum)('shipment_status', [
    'pending', // Pendiente de envío
    'in_transit', // En tránsito
    'delayed', // Retrasado
    'delivered', // Entregado
    'cancelled' // Cancelado
]);
// User schema
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    role: (0, pg_core_1.text)("role").notNull().default("viewer"),
    companyId: (0, pg_core_1.integer)("company_id"),
    areaId: (0, pg_core_1.integer)("area_id"), // Área específica del usuario
    lastLogin: (0, pg_core_1.timestamp)("last_login"),
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({ id: true, lastLogin: true });
// Company schema
exports.companies = (0, pg_core_1.pgTable)("companies", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    sector: (0, pg_core_1.text)("sector"),
    logo: (0, pg_core_1.text)("logo"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertCompanySchema = (0, drizzle_zod_1.createInsertSchema)(exports.companies).omit({ id: true, createdAt: true });
// Area schema
exports.areas = (0, pg_core_1.pgTable)("areas", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    companyId: (0, pg_core_1.integer)("company_id").notNull(),
});
exports.insertAreaSchema = (0, drizzle_zod_1.createInsertSchema)(exports.areas).omit({ id: true });
// KPI schema
exports.kpis = (0, pg_core_1.pgTable)("kpis", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    areaId: (0, pg_core_1.integer)("area_id").notNull(),
    companyId: (0, pg_core_1.integer)("company_id").notNull(),
    unit: (0, pg_core_1.text)("unit").notNull(),
    target: (0, pg_core_1.text)("target").notNull(),
    frequency: (0, pg_core_1.text)("frequency").notNull(), // weekly, monthly, quarterly, annual
    calculationMethod: (0, pg_core_1.text)("calculation_method"),
    responsible: (0, pg_core_1.text)("responsible"),
    invertedMetric: (0, pg_core_1.boolean)("inverted_metric").default(false), // true si valores menores son mejores
});
exports.insertKpiSchema = (0, drizzle_zod_1.createInsertSchema)(exports.kpis).omit({ id: true }).extend({
    target: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => typeof val === 'number' ? val.toString() : val).optional(),
    // Permitir también 'objective' como alias de 'target' para compatibilidad
    objective: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => typeof val === 'number' ? val.toString() : val).optional(),
    description: zod_1.z.string().min(1, "La descripción es requerida"),
    areaId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => typeof val === 'string' ? parseInt(val) : val),
    companyId: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => typeof val === 'string' ? parseInt(val) : val)
}).transform((data) => {
    // Si viene 'objective', moverlo a 'target'
    if (data.objective && !data.target) {
        data.target = data.objective;
    }
    // Eliminar el campo 'objective' del resultado final
    const { objective, ...rest } = data;
    return rest;
}).refine((data) => data.target, {
    message: "El objetivo/target es requerido",
    path: ["target"]
});
// KPI Value schema
exports.kpiValues = (0, pg_core_1.pgTable)("kpi_values", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    kpiId: (0, pg_core_1.integer)("kpi_id").notNull(),
    userId: (0, pg_core_1.integer)("user_id").notNull(), // ID del usuario específico al que pertenece este KPI
    value: (0, pg_core_1.text)("value").notNull(),
    date: (0, pg_core_1.timestamp)("date").defaultNow(),
    period: (0, pg_core_1.text)("period").notNull(), // Month/Quarter/Year the value belongs to
    compliancePercentage: (0, pg_core_1.text)("compliance_percentage"),
    status: (0, pg_core_1.text)("status"), // complies, alert, not_compliant
    comments: (0, pg_core_1.text)("comments"),
    updatedBy: (0, pg_core_1.integer)("updated_by"), // ID del usuario que actualizó este KPI
});
exports.insertKpiValueSchema = (0, drizzle_zod_1.createInsertSchema)(exports.kpiValues).omit({ id: true, date: true });
// Action Plan schema
exports.actionPlans = (0, pg_core_1.pgTable)("action_plans", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    kpiId: (0, pg_core_1.integer)("kpi_id").notNull(),
    problemDescription: (0, pg_core_1.text)("problem_description").notNull(),
    correctiveActions: (0, pg_core_1.text)("corrective_actions").notNull(),
    responsible: (0, pg_core_1.text)("responsible").notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date").notNull(),
    status: (0, pg_core_1.text)("status").notNull(), // pending, in_progress, completed
    results: (0, pg_core_1.text)("results"),
});
exports.insertActionPlanSchema = (0, drizzle_zod_1.createInsertSchema)(exports.actionPlans).omit({ id: true });
// Extended schemas for frontend validation
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
    password: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
// Schema para actualizar valores de KPIs con soporte para compliancePercentage y status
exports.updateKpiValueSchema = exports.insertKpiValueSchema.extend({
    compliancePercentage: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
});
// Schema para actualizar KPIs (permite campos opcionales y convierte tipos)
exports.updateKpiSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    areaId: zod_1.z.number().optional(),
    companyId: zod_1.z.number().optional(),
    unit: zod_1.z.string().optional(),
    target: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform((val) => typeof val === 'number' ? val.toString() : val).optional(),
    frequency: zod_1.z.string().optional(),
    calculationMethod: zod_1.z.string().optional(),
    responsible: zod_1.z.string().optional(),
    invertedMetric: zod_1.z.boolean().optional(),
});
exports.registerUserSchema = exports.insertUserSchema.extend({
    password: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
});
// Shipments schema - Tabla para los envíos
exports.shipments = (0, pg_core_1.pgTable)("shipments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    trackingCode: (0, pg_core_1.text)("tracking_code").notNull().unique(), // Código de seguimiento
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa a la que pertenece el envío
    purchaseOrderNumber: (0, pg_core_1.text)("purchase_order_number"), // Número de orden de compra
    customerName: (0, pg_core_1.text)("customer_name").notNull(), // Nombre del cliente
    customerEmail: (0, pg_core_1.text)("customer_email"), // Email del cliente para notificaciones
    customerPhone: (0, pg_core_1.text)("customer_phone"), // Teléfono del cliente para notificaciones
    notificationEmails: (0, pg_core_1.json)("notification_emails"), // Array de emails para notificaciones
    destination: (0, pg_core_1.text)("destination").notNull(), // Destino del envío
    origin: (0, pg_core_1.text)("origin").notNull(), // Origen del envío
    product: (0, pg_core_1.text)("product").notNull(), // Producto que se envía
    quantity: (0, pg_core_1.text)("quantity").notNull(), // Cantidad del producto
    unit: (0, pg_core_1.text)("unit").notNull(), // Unidad de medida (KG, unidades, etc.)
    departureDate: (0, pg_core_1.timestamp)("departure_date"), // Fecha de salida
    estimatedDeliveryDate: (0, pg_core_1.timestamp)("estimated_delivery_date"), // Fecha estimada de entrega
    actualDeliveryDate: (0, pg_core_1.timestamp)("actual_delivery_date"), // Fecha real de entrega
    status: (0, exports.shipmentStatusEnum)("status").notNull().default('pending'), // Estado del envío
    carrier: (0, pg_core_1.text)("carrier"), // Nombre del transportista
    vehicleInfo: (0, pg_core_1.text)("vehicle_info"), // Información del vehículo
    vehicleType: (0, pg_core_1.text)("vehicle_type"), // Tipo de vehículo (camión, cisterna, etc.)
    fuelType: (0, pg_core_1.text)("fuel_type"), // Tipo de combustible (diesel, gasolina, etc.)
    distance: (0, pg_core_1.text)("distance"), // Distancia en kilómetros
    carbonFootprint: (0, pg_core_1.text)("carbon_footprint"), // Huella de carbono calculada (kg CO2e)
    driverName: (0, pg_core_1.text)("driver_name"), // Nombre del conductor
    driverPhone: (0, pg_core_1.text)("driver_phone"), // Teléfono del conductor
    comments: (0, pg_core_1.text)("comments"), // Comentarios adicionales
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(), // Fecha de creación del registro
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(), // Fecha de última actualización
});
exports.insertShipmentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.shipments).omit({ id: true, createdAt: true, updatedAt: true });
// Shipment Updates schema - Tabla para las actualizaciones de estado de los envíos
exports.shipmentUpdates = (0, pg_core_1.pgTable)("shipment_updates", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    shipmentId: (0, pg_core_1.integer)("shipment_id").notNull(), // Relación con el envío
    status: (0, exports.shipmentStatusEnum)("status").notNull(), // Estado del envío en esta actualización
    location: (0, pg_core_1.text)("location"), // Ubicación del envío al momento de la actualización
    comments: (0, pg_core_1.text)("comments"), // Comentarios sobre la actualización
    updatedBy: (0, pg_core_1.integer)("updated_by"), // Usuario que realizó la actualización
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow(), // Fecha y hora de la actualización
});
exports.insertShipmentUpdateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.shipmentUpdates).omit({ id: true, timestamp: true });
// Notifications schema - Para comunicación y mensajes del equipo
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    title: (0, pg_core_1.text)("title").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    type: (0, pg_core_1.text)("type").notNull().default("info"), // info, warning, success, announcement
    fromUserId: (0, pg_core_1.integer)("from_user_id").notNull(),
    toUserId: (0, pg_core_1.integer)("to_user_id"), // null means broadcast to all
    companyId: (0, pg_core_1.integer)("company_id"), // null means all companies
    areaId: (0, pg_core_1.integer)("area_id"), // null means all areas
    priority: (0, pg_core_1.text)("priority").notNull().default("normal"), // low, normal, high, urgent
    read: (0, pg_core_1.boolean)("read").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    readAt: (0, pg_core_1.timestamp)("read_at"),
});
exports.insertNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.notifications).omit({ id: true, createdAt: true });
// Shipment Notifications schema - Para el historial de notificaciones enviadas por email
exports.shipmentNotifications = (0, pg_core_1.pgTable)("shipment_notifications", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    shipmentId: (0, pg_core_1.integer)("shipment_id").notNull(), // Relación con el envío
    emailTo: (0, pg_core_1.text)("email_to").notNull(), // Email del destinatario
    subject: (0, pg_core_1.text)("subject").notNull(), // Asunto del email
    status: (0, pg_core_1.text)("status").notNull(), // sent, failed, pending
    sentAt: (0, pg_core_1.timestamp)("sent_at").defaultNow(), // Fecha y hora del envío
    sentBy: (0, pg_core_1.integer)("sent_by").notNull(), // Usuario que envió la notificación
    shipmentStatus: (0, exports.shipmentStatusEnum)("shipment_status").notNull(), // Estado del envío al momento del envío
    errorMessage: (0, pg_core_1.text)("error_message"), // Mensaje de error si falló el envío
});
exports.insertShipmentNotificationSchema = (0, drizzle_zod_1.createInsertSchema)(exports.shipmentNotifications).omit({ id: true, sentAt: true });
// Schema para actualizar el estado de un envío con notificación opcional
exports.updateShipmentStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'in_transit', 'delayed', 'delivered', 'cancelled']),
    sendNotification: zod_1.z.boolean().default(true),
    comments: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
});
// Job Profiles schema - Para información detallada de cada puesto de trabajo
exports.jobProfiles = (0, pg_core_1.pgTable)("job_profiles", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    areaId: (0, pg_core_1.integer)("area_id").notNull(), // Área a la que pertenece el puesto
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa a la que pertenece
    title: (0, pg_core_1.text)("title").notNull(), // Título del puesto
    description: (0, pg_core_1.text)("description").notNull(), // Descripción detallada del puesto
    mainActivities: (0, pg_core_1.json)("main_activities").notNull(), // Array de actividades principales
    responsibilities: (0, pg_core_1.json)("responsibilities").notNull(), // Array de responsabilidades
    kpiInstructions: (0, pg_core_1.json)("kpi_instructions").notNull(), // Instrucciones sobre KPIs
    tips: (0, pg_core_1.json)("tips").notNull(), // Tips para el éxito en el puesto
    processes: (0, pg_core_1.json)("processes").notNull(), // Procesos y procedimientos
    updateFrequency: (0, pg_core_1.json)("update_frequency").notNull(), // Frecuencia de actualización de KPIs
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertJobProfileSchema = (0, drizzle_zod_1.createInsertSchema)(exports.jobProfiles).omit({ id: true, createdAt: true, updatedAt: true });
// Schema para obtener el perfil de trabajo completo con información relacionada
exports.jobProfileWithDetails = zod_1.z.object({
    id: zod_1.z.number(),
    areaId: zod_1.z.number(),
    companyId: zod_1.z.number(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    mainActivities: zod_1.z.array(zod_1.z.string()),
    responsibilities: zod_1.z.array(zod_1.z.string()),
    kpiInstructions: zod_1.z.array(zod_1.z.object({
        kpiName: zod_1.z.string(),
        description: zod_1.z.string(),
        updateFrequency: zod_1.z.string(),
        instructions: zod_1.z.string(),
    })),
    tips: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.string(),
        tip: zod_1.z.string(),
    })),
    processes: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        description: zod_1.z.string(),
        steps: zod_1.z.array(zod_1.z.string()),
    })),
    updateFrequency: zod_1.z.object({
        daily: zod_1.z.array(zod_1.z.string()),
        weekly: zod_1.z.array(zod_1.z.string()),
        monthly: zod_1.z.array(zod_1.z.string()),
    }),
    areaName: zod_1.z.string(),
    companyName: zod_1.z.string(),
    userKpis: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.number(),
        name: zod_1.z.string(),
        target: zod_1.z.string(),
        frequency: zod_1.z.string(),
    })),
});
// Bank Accounts schema - Para gestionar las cuentas bancarias
exports.bankAccounts = (0, pg_core_1.pgTable)("bank_accounts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    bankName: (0, pg_core_1.text)("bank_name").notNull(), // Nombre del banco
    accountType: (0, pg_core_1.text)("account_type").notNull(), // Tipo de cuenta (corriente, ahorros, etc.)
    accountNumber: (0, pg_core_1.text)("account_number").notNull(), // Número de cuenta
    accountName: (0, pg_core_1.text)("account_name").notNull(), // Nombre/titular de la cuenta
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa propietaria
    currency: (0, pg_core_1.text)("currency").notNull().default("MXN"), // Moneda
    isActive: (0, pg_core_1.boolean)("is_active").default(true), // Cuenta activa
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertBankAccountSchema = (0, drizzle_zod_1.createInsertSchema)(exports.bankAccounts).omit({ id: true, createdAt: true, updatedAt: true });
// Daily Balances schema - Para registrar saldos diarios
exports.dailyBalances = (0, pg_core_1.pgTable)("daily_balances", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    bankAccountId: (0, pg_core_1.integer)("bank_account_id").notNull(), // Relación con cuenta bancaria
    date: (0, pg_core_1.text)("date").notNull(), // Fecha del saldo (YYYY-MM-DD)
    balance: (0, pg_core_1.text)("balance").notNull(), // Saldo del día
    previousBalance: (0, pg_core_1.text)("previous_balance"), // Saldo anterior
    difference: (0, pg_core_1.text)("difference"), // Diferencia con el día anterior
    notes: (0, pg_core_1.text)("notes"), // Observaciones
    createdBy: (0, pg_core_1.integer)("created_by").notNull(), // Usuario que registró
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertDailyBalanceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.dailyBalances).omit({ id: true, createdAt: true, updatedAt: true });
// Document Categories schema - Para categorizar documentos
exports.documentCategories = (0, pg_core_1.pgTable)("document_categories", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(), // Nombre de la categoría
    description: (0, pg_core_1.text)("description"), // Descripción
    color: (0, pg_core_1.text)("color").default("#3B82F6"), // Color para la UI
    icon: (0, pg_core_1.text)("icon").default("FileText"), // Icono
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertDocumentCategorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.documentCategories).omit({ id: true, createdAt: true });
// Documents schema - Para gestionar comprobantes y facturas
exports.documents = (0, pg_core_1.pgTable)("documents", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    title: (0, pg_core_1.text)("title").notNull(), // Título del documento
    description: (0, pg_core_1.text)("description"), // Descripción
    fileName: (0, pg_core_1.text)("file_name").notNull(), // Nombre del archivo original
    fileSize: (0, pg_core_1.integer)("file_size"), // Tamaño del archivo en bytes
    fileType: (0, pg_core_1.text)("file_type").notNull(), // Tipo de archivo (PDF, JPG, etc.)
    filePath: (0, pg_core_1.text)("file_path").notNull(), // Ruta del archivo en el servidor
    categoryId: (0, pg_core_1.integer)("category_id").notNull(), // Categoría del documento
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa
    amount: (0, pg_core_1.text)("amount"), // Monto del documento (si aplica)
    currency: (0, pg_core_1.text)("currency").default("MXN"), // Moneda
    documentDate: (0, pg_core_1.text)("document_date"), // Fecha del documento
    supplier: (0, pg_core_1.text)("supplier"), // Proveedor/Cliente
    referenceNumber: (0, pg_core_1.text)("reference_number"), // Número de referencia/factura
    bankAccountId: (0, pg_core_1.integer)("bank_account_id"), // Cuenta bancaria relacionada
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, approved, rejected
    tags: (0, pg_core_1.json)("tags"), // Etiquetas para búsqueda
    uploadedBy: (0, pg_core_1.integer)("uploaded_by").notNull(), // Usuario que subió el documento
    approvedBy: (0, pg_core_1.integer)("approved_by"), // Usuario que aprobó
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertDocumentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.documents).omit({ id: true, createdAt: true, updatedAt: true });
// Payment Alerts schema - Para configurar alertas de saldos y pagos
exports.paymentAlerts = (0, pg_core_1.pgTable)("payment_alerts", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(), // Nombre de la alerta
    description: (0, pg_core_1.text)("description"), // Descripción
    alertType: (0, pg_core_1.text)("alert_type").notNull(), // low_balance, document_due, payment_reminder
    bankAccountId: (0, pg_core_1.integer)("bank_account_id"), // Cuenta bancaria (si aplica)
    threshold: (0, pg_core_1.text)("threshold"), // Umbral para la alerta
    recipients: (0, pg_core_1.json)("recipients").notNull(), // Array de emails para notificar
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    lastTriggered: (0, pg_core_1.timestamp)("last_triggered"), // Última vez que se disparó
    createdBy: (0, pg_core_1.integer)("created_by").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertPaymentAlertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentAlerts).omit({ id: true, createdAt: true, updatedAt: true });
// Supplier/Client schema - Para gestionar proveedores y clientes
exports.suppliers = (0, pg_core_1.pgTable)("suppliers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(), // Nombre del proveedor/cliente
    email: (0, pg_core_1.text)("email").notNull(), // Email para enviar comprobantes
    phone: (0, pg_core_1.text)("phone"), // Teléfono
    address: (0, pg_core_1.text)("address"), // Dirección
    rfc: (0, pg_core_1.text)("rfc"), // RFC (México)
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa que maneja este proveedor
    requiresReceipt: (0, pg_core_1.boolean)("requires_receipt").default(false), // ¿Necesita recibo de pago?
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    notes: (0, pg_core_1.text)("notes"), // Notas adicionales
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertSupplierSchema = (0, drizzle_zod_1.createInsertSchema)(exports.suppliers).omit({ id: true, createdAt: true, updatedAt: true });
// Payment Status enum
exports.paymentStatusEnum = (0, pg_core_1.pgEnum)('payment_status', [
    'payment_sent', // Pago enviado
    'waiting_receipt', // Esperando recibo
    'receipt_received', // Recibo recibido
    'completed', // Completado
    'no_receipt_required' // No requiere recibo
]);
// Payments schema - Para gestionar los pagos que realiza Lolita
exports.payments = (0, pg_core_1.pgTable)("payments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa que hizo el pago
    supplierId: (0, pg_core_1.integer)("supplier_id").notNull(), // Proveedor al que se le pagó
    amount: (0, pg_core_1.text)("amount").notNull(), // Monto del pago
    currency: (0, pg_core_1.text)("currency").notNull().default("MXN"), // Moneda
    paymentDate: (0, pg_core_1.text)("payment_date").notNull(), // Fecha del pago
    status: (0, exports.paymentStatusEnum)("status").notNull().default("payment_sent"), // Estado del pago
    isCashPayment: (0, pg_core_1.boolean)("is_cash_payment").default(false), // ¿Es pago de contado?
    bankAccountId: (0, pg_core_1.integer)("bank_account_id"), // Cuenta bancaria utilizada
    invoiceNumber: (0, pg_core_1.text)("invoice_number"), // Número de factura
    description: (0, pg_core_1.text)("description"), // Descripción del pago
    // Archivos
    paymentReceiptPath: (0, pg_core_1.text)("payment_receipt_path"), // Ruta del comprobante de pago
    invoicePath: (0, pg_core_1.text)("invoice_path"), // Ruta de la factura
    supplierReceiptPath: (0, pg_core_1.text)("supplier_receipt_path"), // Ruta del recibo del proveedor
    // Correos
    emailSent: (0, pg_core_1.boolean)("email_sent").default(false), // ¿Se envió correo?
    emailSentAt: (0, pg_core_1.timestamp)("email_sent_at"), // Cuándo se envió
    lastReminderSent: (0, pg_core_1.timestamp)("last_reminder_sent"), // Último recordatorio
    reminderCount: (0, pg_core_1.integer)("reminder_count").default(0), // Contador de recordatorios
    // Auditoría
    createdBy: (0, pg_core_1.integer)("created_by").notNull(), // Usuario que creó (Lolita)
    updatedBy: (0, pg_core_1.integer)("updated_by"), // Usuario que actualizó
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertPaymentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.payments).omit({ id: true, createdAt: true, updatedAt: true });
// Payment Reminders schema - Para programar recordatorios automáticos
exports.paymentReminders = (0, pg_core_1.pgTable)("payment_reminders", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    paymentId: (0, pg_core_1.integer)("payment_id").notNull(), // Relación con el pago
    reminderType: (0, pg_core_1.text)("reminder_type").notNull(), // receipt_request, follow_up, urgent
    scheduledFor: (0, pg_core_1.timestamp)("scheduled_for").notNull(), // Cuándo enviar el recordatorio
    emailTo: (0, pg_core_1.text)("email_to").notNull(), // Email del destinatario
    subject: (0, pg_core_1.text)("subject").notNull(), // Asunto del email
    body: (0, pg_core_1.text)("body").notNull(), // Cuerpo del email
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, sent, failed
    sentAt: (0, pg_core_1.timestamp)("sent_at"), // Cuándo se envió
    reminderNumber: (0, pg_core_1.integer)("reminder_number").default(1), // Número de recordatorio (1, 2, 3...)
    errorMessage: (0, pg_core_1.text)("error_message"), // Mensaje de error si falló
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.insertPaymentReminderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentReminders).omit({ id: true, createdAt: true });
// Transport Requests schema - Para gestionar solicitudes de transporte
exports.transportRequests = (0, pg_core_1.pgTable)("transport_requests", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    shipmentId: (0, pg_core_1.integer)("shipment_id").notNull(), // Envío relacionado
    providerId: (0, pg_core_1.text)("provider_id").notNull(), // ID del proveedor (imasa, fedex, etc.)
    providerName: (0, pg_core_1.text)("provider_name").notNull(), // Nombre del proveedor
    providerEmail: (0, pg_core_1.text)("provider_email").notNull(), // Email del proveedor
    requestData: (0, pg_core_1.json)("request_data").notNull(), // Datos completos de la solicitud
    status: (0, pg_core_1.text)("status").notNull().default("sent"), // sent, replied, confirmed, cancelled
    requestedBy: (0, pg_core_1.integer)("requested_by").notNull(), // Usuario que solicitó (Thalia)
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertTransportRequestSchema = (0, drizzle_zod_1.createInsertSchema)(exports.transportRequests).omit({ id: true, createdAt: true, updatedAt: true });
// Pending Invoices schema - Para facturas por pagar (subidas por Thalia/Andy)
exports.pendingInvoices = (0, pg_core_1.pgTable)("pending_invoices", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa
    supplierId: (0, pg_core_1.integer)("supplier_id").notNull(), // Proveedor
    invoiceNumber: (0, pg_core_1.text)("invoice_number").notNull(), // Número de factura
    amount: (0, pg_core_1.text)("amount").notNull(), // Monto
    currency: (0, pg_core_1.text)("currency").notNull().default("MXN"), // Moneda
    issueDate: (0, pg_core_1.text)("issue_date"), // Fecha de emisión de la factura
    dueDate: (0, pg_core_1.text)("due_date"), // Fecha de vencimiento
    description: (0, pg_core_1.text)("description"), // Descripción/concepto
    // Archivo de la factura
    invoicePath: (0, pg_core_1.text)("invoice_path").notNull(), // Ruta del archivo de factura
    fileName: (0, pg_core_1.text)("file_name").notNull(), // Nombre original del archivo
    fileSize: (0, pg_core_1.integer)("file_size"), // Tamaño del archivo
    // Estado y seguimiento
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, processing, paid, cancelled
    priority: (0, pg_core_1.text)("priority").notNull().default("normal"), // low, normal, high, urgent
    // Usuario que subió (Thalia o Andy)
    uploadedBy: (0, pg_core_1.integer)("uploaded_by").notNull(), // Usuario que subió la factura
    approvedBy: (0, pg_core_1.integer)("approved_by"), // Usuario que aprobó para pago
    processedBy: (0, pg_core_1.integer)("processed_by"), // Usuario que procesó el pago (Lolita)
    // Relación con el pago realizado
    paymentId: (0, pg_core_1.integer)("payment_id"), // ID del pago creado (cuando Lolita lo procesa)
    // Notas y comentarios
    notes: (0, pg_core_1.text)("notes"), // Notas adicionales
    // Auditoría
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertPendingInvoiceSchema = (0, drizzle_zod_1.createInsertSchema)(exports.pendingInvoices).omit({ id: true, createdAt: true, updatedAt: true });
// Removed duplicate payment reminders schema - using the one above
// Currency Exchange Quotes schema - Para cotizaciones de dólares (Lolita)
exports.currencyQuotes = (0, pg_core_1.pgTable)("currency_quotes", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    sourceProvider: (0, pg_core_1.text)("source_provider").notNull(), // "santander", "monex", "dof", "banxico"
    quotingUser: (0, pg_core_1.integer)("quoting_user").notNull(), // Usuario que capturó la cotización (Lolita)
    companyId: (0, pg_core_1.integer)("company_id").notNull(), // Empresa para la que se cotiza
    // Datos de la cotización
    buyRate: (0, pg_core_1.text)("buy_rate").notNull(), // Tipo de cambio de compra (USD -> MXN)
    sellRate: (0, pg_core_1.text)("sell_rate").notNull(), // Tipo de cambio de venta (MXN -> USD)
    baseCurrency: (0, pg_core_1.text)("base_currency").notNull().default("USD"), // Moneda base
    targetCurrency: (0, pg_core_1.text)("target_currency").notNull().default("MXN"), // Moneda objetivo
    // Fecha y hora exactas
    quotingDate: (0, pg_core_1.text)("quoting_date").notNull(), // Fecha de la cotización (YYYY-MM-DD)
    quotingTime: (0, pg_core_1.text)("quoting_time").notNull(), // Hora exacta (HH:MM:SS)
    // Metadatos
    notes: (0, pg_core_1.text)("notes"), // Notas adicionales de Lolita
    isActive: (0, pg_core_1.boolean)("is_active").default(true), // Para marcar cotizaciones activas/inactivas
    // Auditoría
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertCurrencyQuoteSchema = (0, drizzle_zod_1.createInsertSchema)(exports.currencyQuotes).omit({ id: true, createdAt: true, updatedAt: true });
// Schema para análisis de tendencias
exports.currencyAnalysisSchema = zod_1.z.object({
    provider: zod_1.z.string(),
    period: zod_1.z.enum(['day', 'week', 'month', 'quarter', 'year']),
    averageBuyRate: zod_1.z.number(),
    averageSellRate: zod_1.z.number(),
    minBuyRate: zod_1.z.number(),
    maxBuyRate: zod_1.z.number(),
    minSellRate: zod_1.z.number(),
    maxSellRate: zod_1.z.number(),
    volatility: zod_1.z.number(),
    trend: zod_1.z.enum(['up', 'down', 'stable']),
    quotes: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.number(),
        buyRate: zod_1.z.string(),
        sellRate: zod_1.z.string(),
        quotingDate: zod_1.z.string(),
        quotingTime: zod_1.z.string(),
    })),
});
// Transport Providers schema - Para gestionar proveedores de transporte internos
exports.transportProviders = (0, pg_core_1.pgTable)("transport_providers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(), // Nombre del proveedor (IMASA, FedEx, etc.)
    email: (0, pg_core_1.text)("email").notNull(), // Email para solicitudes
    phone: (0, pg_core_1.text)("phone"), // Teléfono de contacto
    contactPerson: (0, pg_core_1.text)("contact_person"), // Persona de contacto
    address: (0, pg_core_1.text)("address"), // Dirección de la empresa
    website: (0, pg_core_1.text)("website"), // Sitio web
    specialties: (0, pg_core_1.json)("specialties"), // Array de especialidades ["Carga general", "Logística nacional"]
    serviceAreas: (0, pg_core_1.json)("service_areas"), // Áreas de servicio ["Nacional", "Internacional"]
    notes: (0, pg_core_1.text)("notes"), // Notas adicionales
    isActive: (0, pg_core_1.boolean)("is_active").default(true), // Proveedor activo
    requiresAppointment: (0, pg_core_1.boolean)("requires_appointment").default(false), // Si requiere cita por defecto
    rating: (0, pg_core_1.integer)("rating").default(5), // Calificación del proveedor (1-5)
    createdBy: (0, pg_core_1.integer)("created_by").notNull(), // Usuario que agregó al proveedor
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertTransportProviderSchema = (0, drizzle_zod_1.createInsertSchema)(exports.transportProviders).omit({ id: true, createdAt: true, updatedAt: true });
// Clients schema - Para gestionar clientes y recordatorios de pago
exports.clients = (0, pg_core_1.pgTable)("clients", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(), // Nombre del cliente
    email: (0, pg_core_1.text)("email"), // Email principal
    phone: (0, pg_core_1.text)("phone"), // Teléfono de contacto
    contactPerson: (0, pg_core_1.text)("contact_person"), // Persona de contacto principal
    company: (0, pg_core_1.text)("company"), // Nombre de la empresa
    address: (0, pg_core_1.text)("address"), // Dirección completa
    paymentTerms: (0, pg_core_1.integer)("payment_terms").default(30), // Términos de pago en días
    isActive: (0, pg_core_1.boolean)("is_active").default(true), // Cliente activo
    requiresReceipt: (0, pg_core_1.boolean)("requires_receipt").default(true), // Requiere recibo de pago
    reminderFrequency: (0, pg_core_1.integer)("reminder_frequency").default(7), // Frecuencia de recordatorios en días
    notes: (0, pg_core_1.text)("notes"), // Notas adicionales
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.insertClientSchema = (0, drizzle_zod_1.createInsertSchema)(exports.clients).omit({ id: true, createdAt: true, updatedAt: true });
