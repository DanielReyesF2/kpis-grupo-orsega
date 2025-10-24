"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const storage_1 = require("./storage");
const auth_1 = require("./auth");
const schema_1 = require("@shared/schema");
const weekly_sales_update_1 = require("../scripts/weekly_sales_update");
const email_1 = require("./email");
const sendgrid_1 = require("./sendgrid");
const routes_catalog_1 = require("./routes-catalog");
const routes_logistics_1 = require("./routes-logistics");
// Funciones utilitarias mejoradas para validación de KPIs
function extractNumericValue(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value !== 'string')
        return NaN;
    // Remover caracteres no numéricos excepto punto decimal y signo negativo
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned);
}
function isLowerBetterKPI(kpiName) {
    const lowerBetterPatterns = [
        'rotación de cuentas por cobrar',
        'velocidad de rotación',
        'tiempo de',
        'días de',
        'plazo de',
        'demora'
    ];
    const lowerKpiName = kpiName.toLowerCase();
    return lowerBetterPatterns.some(pattern => lowerKpiName.includes(pattern) && !lowerKpiName.includes('entrega'));
}
// Función para crear notificaciones automáticas en cambios de estado críticos
async function createKPIStatusChangeNotification(kpi, user, previousStatus, newStatus, storage) {
    try {
        // Solo notificar en cambios críticos
        const criticalChanges = [
            { from: 'complies', to: 'not_compliant' },
            { from: 'alert', to: 'not_compliant' },
            { from: 'not_compliant', to: 'complies' }
        ];
        const isCriticalChange = criticalChanges.some(change => change.from === previousStatus && change.to === newStatus);
        if (isCriticalChange) {
            const statusMap = {
                'complies': 'En cumplimiento',
                'alert': 'En alerta',
                'not_compliant': 'No cumple'
            };
            const notification = {
                userId: user.id,
                title: `Cambio de estado en KPI: ${kpi.name}`,
                message: `El KPI "${kpi.name}" ha cambiado de "${statusMap[previousStatus]}" a "${statusMap[newStatus]}"`,
                type: newStatus === 'complies' ? 'success' : 'warning',
                isRead: false
            };
            await storage.createNotification(notification);
            console.log(`[KPI Notification] Notificación creada para cambio de estado: ${kpi.name}`);
        }
    }
    catch (error) {
        console.error('Error creating KPI status change notification:', error);
        // No fallar la operación por un error de notificación
    }
}
function registerRoutes(app) {
    const server = app.listen;
    // Login route
    app.post("/api/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ message: "Username and password are required" });
            }
            const result = await (0, auth_1.loginUser)(username, password);
            if (!result) {
                return res.status(401).json({ message: "Invalid username or password" });
            }
            res.json(result);
        }
        catch (error) {
            console.error("[POST /api/login] Error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // User routes
    app.get("/api/user", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const tokenUser = req.user;
            // Obtener datos actualizados del usuario desde la base de datos
            const user = await storage_1.storage.getUser(tokenUser.id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            res.json(user);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/users", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const users = await storage_1.storage.getUsers();
            res.json(users);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/users", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            console.log("[POST /api/users] Datos recibidos:", JSON.stringify(req.body, null, 2));
            // Validar datos con Zod
            const validatedData = schema_1.insertUserSchema.parse(req.body);
            console.log("[POST /api/users] Datos validados:", JSON.stringify(validatedData, null, 2));
            // Hash password if provided
            if (validatedData.password) {
                validatedData.password = await bcrypt_1.default.hash(validatedData.password, 10);
            }
            console.log("[POST /api/users] Datos después del hash:", JSON.stringify({ ...validatedData, password: '[HASHED]' }, null, 2));
            const user = await storage_1.storage.createUser(validatedData);
            console.log("[POST /api/users] Usuario creado:", user);
            res.status(201).json(user);
        }
        catch (error) {
            console.error("[POST /api/users] Error completo:", error);
            console.error("[POST /api/users] Stack trace:", error.stack);
            if (error instanceof zod_1.z.ZodError) {
                console.error("[POST /api/users] Errores de validación:", error.errors);
                return res.status(400).json({
                    message: "Validation error",
                    errors: error.errors
                });
            }
            res.status(500).json({ message: "Internal server error", details: error.message });
        }
    });
    app.put("/api/users/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            console.log("[PUT /api/users/:id] Datos recibidos:", req.body);
            // Validar datos con Zod (usando partial para permitir actualizaciones parciales)
            const validatedData = schema_1.insertUserSchema.partial().parse(req.body);
            // Hash password if provided
            if (validatedData.password) {
                validatedData.password = await bcrypt_1.default.hash(validatedData.password, 10);
            }
            console.log("[PUT /api/users/:id] Datos validados:", validatedData);
            const user = await storage_1.storage.updateUser(id, validatedData);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            console.log("[PUT /api/users/:id] Usuario actualizado:", user);
            res.json(user);
        }
        catch (error) {
            console.error("[PUT /api/users/:id] Error:", error);
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({
                    message: "Validation error",
                    errors: error.errors
                });
            }
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/users/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const success = await storage_1.storage.deleteUser(id);
            if (!success) {
                return res.status(404).json({ message: "User not found" });
            }
            res.json({ message: "User deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Company routes
    app.get("/api/companies", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const companies = await storage_1.storage.getCompanies();
            res.json(companies);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/companies/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const company = await storage_1.storage.getCompany(id);
            if (!company) {
                return res.status(404).json({ message: "Company not found" });
            }
            console.log(`[GET /api/companies/:id] Buscando empresa con ID: ${id}`);
            console.log(`[GET /api/companies/:id] Empresa encontrada: ${company ? 'Sí' : 'No'}`);
            console.log(`[GET /api/companies/:id] Enviando empresa: { id: ${company.id}, name: '${company.name}' }`);
            res.json(company);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/companies", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const validatedData = schema_1.insertCompanySchema.parse(req.body);
            const company = await storage_1.storage.createCompany(validatedData);
            res.status(201).json(company);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors });
            }
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Area routes
    app.get("/api/areas", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            if (req.query.companyId) {
                const companyId = parseInt(req.query.companyId);
                const areas = await storage_1.storage.getAreasByCompany(companyId);
                res.json(areas);
            }
            else {
                const areas = await storage_1.storage.getAreas();
                res.json(areas);
            }
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/areas/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const area = await storage_1.storage.getArea(id);
            if (!area) {
                return res.status(404).json({ message: "Area not found" });
            }
            res.json(area);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/areas", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const validatedData = schema_1.insertAreaSchema.parse(req.body);
            const area = await storage_1.storage.createArea(validatedData);
            res.status(201).json(area);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors });
            }
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // KPI routes
    app.get("/api/kpis", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            let kpis;
            // Filter by company if companyId is provided
            if (req.query.companyId) {
                const companyId = parseInt(req.query.companyId);
                // For collaborators, filter by company AND user's area
                if (user.role === 'collaborator' && user.areaId) {
                    kpis = await storage_1.storage.getKpisByCompanyAndArea(companyId, user.areaId);
                }
                else {
                    // For admin/manager, show all KPIs of the company
                    kpis = await storage_1.storage.getKpisByCompany(companyId);
                }
            }
            // Filter by area if areaId is provided
            else if (req.query.areaId) {
                const areaId = parseInt(req.query.areaId);
                kpis = await storage_1.storage.getKpisByArea(areaId);
            }
            else {
                if (user.role === 'collaborator' && user.areaId) {
                    // For collaborators, only show KPIs of their area
                    kpis = await storage_1.storage.getKpisByArea(user.areaId);
                }
                else {
                    // For admin/manager, show all KPIs
                    kpis = await storage_1.storage.getKpis();
                }
            }
            res.json(kpis);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/kpis/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const kpi = await storage_1.storage.getKpi(id);
            if (!kpi) {
                return res.status(404).json({ message: "KPI not found" });
            }
            // All collaborators can access all KPIs from both companies since they work for both
            // No access restrictions by company
            // Determinar si este KPI se trata de un indicador donde un valor menor es mejor
            const isLowerBetter = kpi.name.includes("Rotación de cuentas por cobrar") ||
                kpi.name.includes("Velocidad de rotación") ||
                (kpi.name.includes("Tiempo") && !kpi.name.includes("entrega"));
            console.log(`[GET KPI/${id}] Calculando para "${kpi.name}". ¿Es invertido?: ${isLowerBetter}`);
            // Añadir propiedad isLowerBetter al KPI para facilitar cálculos en el front
            res.json({
                ...kpi,
                isLowerBetter
            });
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/kpis", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            // Solo Mario y admin pueden crear KPIs
            if (req.user.role !== 'admin' && req.user.name !== 'Mario Reynoso') {
                return res.status(403).json({ message: "No tienes permisos para crear KPIs" });
            }
            const validatedData = schema_1.insertKpiSchema.parse(req.body);
            const kpi = await storage_1.storage.createKpi(validatedData);
            res.status(201).json(kpi);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors });
            }
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.put("/api/kpis/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            // Solo Mario y admin pueden actualizar KPIs
            if (req.user.role !== 'admin' && req.user.name !== 'Mario Reynoso') {
                return res.status(403).json({ message: "No tienes permisos para actualizar KPIs" });
            }
            const id = parseInt(req.params.id);
            const validatedData = schema_1.updateKpiSchema.parse(req.body);
            console.log(`[PUT /api/kpis/${id}] Datos validados:`, validatedData);
            const kpi = await storage_1.storage.updateKpi(id, validatedData);
            if (!kpi) {
                return res.status(404).json({ message: "KPI not found" });
            }
            console.log(`[PUT /api/kpis/${id}] KPI actualizado:`, kpi);
            res.json(kpi);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                console.error(`[PUT /api/kpis/${id}] Error de validación:`, error.errors);
                return res.status(400).json({ message: error.errors });
            }
            console.error(`[PUT /api/kpis/${id}] Error interno:`, error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/kpis/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            // Solo Mario y admin pueden eliminar KPIs
            if (req.user.role !== 'admin' && req.user.name !== 'Mario Reynoso') {
                return res.status(403).json({ message: "No tienes permisos para eliminar KPIs" });
            }
            const id = parseInt(req.params.id);
            const success = await storage_1.storage.deleteKpi(id);
            if (!success) {
                return res.status(404).json({ message: "KPI not found" });
            }
            res.json({ message: "KPI eliminado exitosamente" });
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Nueva ruta para eliminar KPI específico del usuario
    app.delete("/api/user-kpis/:kpiId", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            const kpiId = parseInt(req.params.kpiId);
            // Verificar que el KPI existe
            const kpi = await storage_1.storage.getKpi(kpiId);
            if (!kpi) {
                return res.status(404).json({ message: "KPI not found" });
            }
            // Eliminar solo los valores de este KPI para este usuario específico
            const success = await storage_1.storage.deleteKpiValuesByUser(user.id, kpiId);
            if (!success) {
                // Si no se encontraron valores, significa que el usuario no tiene este KPI
                // Esto no es un error, simplemente no había nada que eliminar
                return res.json({ message: "No había valores de KPI para este usuario (ya estaba eliminado)" });
            }
            res.json({ message: "KPI eliminado para el usuario específico" });
        }
        catch (error) {
            console.error("Error eliminating user-specific KPI:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // KPI Value routes
    app.get("/api/kpi-values", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            if (req.query.kpiId) {
                const kpiId = parseInt(req.query.kpiId);
                const kpi = await storage_1.storage.getKpi(kpiId);
                if (!kpi) {
                    return res.status(404).json({ message: "KPI not found" });
                }
                // Para colaboradores, mostrar solo sus propios KPIs
                // Para managers/admins, mostrar todos los KPIs
                if (user.role === 'collaborator') {
                    const kpiValues = await storage_1.storage.getKpiValuesByKpi(kpiId);
                    const userKpiValues = kpiValues.filter(kv => kv.userId === user.id);
                    res.json(userKpiValues);
                }
                else {
                    const kpiValues = await storage_1.storage.getKpiValuesByKpi(kpiId);
                    res.json(kpiValues);
                }
            }
            else {
                if (user.role === 'collaborator') {
                    // Colaboradores solo ven sus propios KPIs
                    const kpiValues = await storage_1.storage.getKpiValuesByUser(user.id);
                    res.json(kpiValues);
                }
                else {
                    // Managers/admins ven todos los KPIs
                    const kpiValues = await storage_1.storage.getKpiValues();
                    res.json(kpiValues);
                }
            }
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/kpi-values", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            const validatedData = schema_1.insertKpiValueSchema.parse({
                ...req.body,
                userId: user.id // Asegurar que el KPI se asocie al usuario actual
            });
            // Buscar el KPI para obtener información necesaria
            const kpi = await storage_1.storage.getKpi(validatedData.kpiId);
            if (!kpi) {
                return res.status(404).json({ message: "KPI not found" });
            }
            // Obtener el último valor para comparar cambios de estado
            const lastValues = await storage_1.storage.getLatestKpiValues(validatedData.kpiId, 1);
            const previousStatus = lastValues.length > 0 ? lastValues[0].status : null;
            // Calcular el cumplimiento si hay un objetivo con validación mejorada
            if (kpi.target) {
                const currentValue = validatedData.value;
                const target = kpi.target;
                // Validación robusta de valores numéricos
                const numericCurrentValue = extractNumericValue(currentValue);
                const numericTarget = extractNumericValue(target);
                if (!isNaN(numericCurrentValue) && !isNaN(numericTarget)) {
                    let percentage;
                    // Determinar si es una métrica invertida usando lógica mejorada
                    const isLowerBetter = isLowerBetterKPI(kpi.name);
                    console.log(`[KPI Calculation] Calculando para "${kpi.name}". ¿Es invertido?: ${isLowerBetter}`);
                    if (isLowerBetter) {
                        // Para métricas donde un valor menor es mejor (como días de cobro)
                        percentage = Math.min(numericTarget / numericCurrentValue * 100, 100);
                        // Determinar estado basado en porcentaje de cumplimiento
                        if (numericCurrentValue <= numericTarget) {
                            validatedData.status = 'complies';
                        }
                        else if (numericCurrentValue <= numericTarget * 1.1) { // 10% de margen para alerta
                            validatedData.status = 'alert';
                        }
                        else {
                            validatedData.status = 'not_compliant';
                        }
                    }
                    else {
                        // Para métricas normales donde un valor mayor es mejor
                        percentage = Math.min(numericCurrentValue / numericTarget * 100, 100);
                        // Determinar estado basado en porcentaje de cumplimiento
                        if (numericCurrentValue >= numericTarget) {
                            validatedData.status = 'complies';
                        }
                        else if (numericCurrentValue >= numericTarget * 0.9) { // 90% del objetivo para alerta
                            validatedData.status = 'alert';
                        }
                        else {
                            validatedData.status = 'not_compliant';
                        }
                    }
                    validatedData.compliancePercentage = `${percentage.toFixed(1)}%`;
                }
            }
            // Agregar el ID del usuario que está creando el valor KPI
            const kpiValueWithUser = {
                ...validatedData,
                updatedBy: user.id
            };
            const kpiValue = await storage_1.storage.createKpiValue(kpiValueWithUser);
            // Crear notificación automática si hay cambio de estado crítico
            if (previousStatus && previousStatus !== validatedData.status) {
                await createKPIStatusChangeNotification(kpi, user, previousStatus, validatedData.status, storage_1.storage);
            }
            res.status(201).json(kpiValue);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors });
            }
            console.error('Error creating KPI value:', error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Weekly Sales Update Endpoint
    app.post("/api/sales/weekly-update", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            console.log(`[POST /api/sales/weekly-update] Recibida solicitud de actualización de ventas semanales:`, req.body);
            const { value, weekNumber, month, year, companyId } = req.body;
            // Validar que se proporcionen los datos necesarios
            if (!value || !weekNumber || !month || !year) {
                return res.status(400).json({
                    message: "Datos insuficientes. Se requiere value, weekNumber, month y year"
                });
            }
            // Preparar datos para la función de actualización
            const salesData = {
                value: parseFloat(value),
                weekNumber,
                month,
                year: parseInt(year),
                companyId: companyId || 1 // Default a Dura International si no se especifica
            };
            // Llamar a la función de actualización semanal
            const result = await (0, weekly_sales_update_1.updateWeeklySales)(salesData);
            if (result.success) {
                console.log(`[POST /api/sales/weekly-update] Datos de ventas actualizados correctamente`);
                res.status(201).json({
                    message: "Datos de ventas actualizados correctamente",
                    data: result
                });
            }
            else {
                console.error(`[POST /api/sales/weekly-update] Error:`, result.message);
                res.status(400).json({
                    message: result.message || "Error al actualizar datos de ventas"
                });
            }
        }
        catch (error) {
            console.error('[POST /api/sales/weekly-update] Error:', error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Shipment routes
    app.get("/api/shipments", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            if (req.query.companyId) {
                const companyId = parseInt(req.query.companyId);
                const shipments = await storage_1.storage.getShipmentsByCompany(companyId);
                res.json(shipments);
            }
            else {
                const shipments = await storage_1.storage.getShipments();
                res.json(shipments);
            }
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/shipments/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const shipment = await storage_1.storage.getShipment(id);
            if (!shipment) {
                return res.status(404).json({ message: "Shipment not found" });
            }
            res.json(shipment);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/shipments/tracking/:trackingCode", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const trackingCode = req.params.trackingCode;
            const shipment = await storage_1.storage.getShipmentByTrackingCode(trackingCode);
            if (!shipment) {
                return res.status(404).json({ message: "Shipment not found" });
            }
            res.json(shipment);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/shipments", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            console.log("[POST /api/shipments] Datos recibidos:", JSON.stringify(req.body, null, 2));
            // Transformar fechas de string a Date antes de validar
            const transformedData = {
                ...req.body,
                estimatedDeliveryDate: req.body.estimatedDeliveryDate ? new Date(req.body.estimatedDeliveryDate) : null,
                departureDate: req.body.departureDate ? new Date(req.body.departureDate) : null,
                actualDeliveryDate: req.body.actualDeliveryDate ? new Date(req.body.actualDeliveryDate) : null
            };
            console.log("[POST /api/shipments] Datos transformados:", JSON.stringify(transformedData, null, 2));
            // Validar datos con Zod
            const validatedData = schema_1.insertShipmentSchema.parse(transformedData);
            console.log("[POST /api/shipments] Datos validados:", JSON.stringify(validatedData, null, 2));
            // Crear el envío
            const shipment = await storage_1.storage.createShipment(validatedData);
            console.log("[POST /api/shipments] Envío creado:", shipment);
            res.status(201).json(shipment);
        }
        catch (error) {
            console.error("[POST /api/shipments] Error completo:", error);
            console.error("[POST /api/shipments] Stack trace:", error?.stack);
            if (error instanceof zod_1.z.ZodError) {
                console.error("[POST /api/shipments] Errores de validación:", error.errors);
                return res.status(400).json({
                    message: "Validation error",
                    errors: error.errors
                });
            }
            res.status(500).json({ message: "Internal server error", details: error.message });
        }
    });
    app.get("/api/shipments/:id/updates", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const shipmentId = parseInt(req.params.id);
            const updates = await storage_1.storage.getShipmentUpdates(shipmentId);
            res.json(updates);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Action Plan routes
    app.get("/api/action-plans", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            if (req.query.kpiId) {
                const kpiId = parseInt(req.query.kpiId);
                const actionPlans = await storage_1.storage.getActionPlansByKpi(kpiId);
                res.json(actionPlans);
            }
            else {
                // For now, return empty array for general action plans
                res.json([]);
            }
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/action-plans/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const actionPlan = await storage_1.storage.getActionPlan(id);
            if (!actionPlan) {
                return res.status(404).json({ message: "Action plan not found" });
            }
            res.json(actionPlan);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Notifications routes
    app.get("/api/notifications", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            const notifications = await storage_1.storage.getNotificationsForUser(user.id);
            res.json(notifications);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.post("/api/notifications", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const user = req.user;
            const notificationData = {
                ...req.body,
                fromUserId: user.id
            };
            console.log("[POST /api/notifications] Creando notificación:", notificationData);
            // Crear notificación en la base de datos
            const notification = await storage_1.storage.createNotification(notificationData);
            // Obtener información del destinatario para enviar el correo
            const recipient = await storage_1.storage.getUser(notificationData.toUserId);
            if (recipient && recipient.email) {
                console.log("[POST /api/notifications] Enviando correo a:", recipient.email);
                // Crear template del correo
                const { html, text } = (0, email_1.createTeamMessageTemplate)(user.name, recipient.name, notificationData.title, notificationData.message, notificationData.type || 'info', notificationData.priority || 'normal');
                // Enviar correo electrónico usando el correo de Mario Reynoso
                const emailSent = await (0, email_1.sendEmail)({
                    to: recipient.email,
                    from: 'Mario Reynoso <marioreynoso@grupoorsega.com>', // Correo verificado de Mario Reynoso con nombre
                    subject: `[Econova] ${notificationData.title}`,
                    html,
                    text
                });
                if (emailSent) {
                    console.log("[POST /api/notifications] Correo enviado exitosamente");
                }
                else {
                    console.error("[POST /api/notifications] Error al enviar correo");
                }
            }
            else {
                console.warn("[POST /api/notifications] Destinatario no encontrado o sin email");
            }
            res.status(201).json(notification);
        }
        catch (error) {
            console.error("[POST /api/notifications] Error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.put("/api/notifications/:id/read", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            const notification = await storage_1.storage.markNotificationAsRead(id, user.id);
            if (!notification) {
                return res.status(404).json({ message: "Notification not found" });
            }
            res.json(notification);
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.delete("/api/notifications/:id", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            const success = await storage_1.storage.deleteNotification(id, user.id);
            if (!success) {
                return res.status(404).json({ message: "Notification not found" });
            }
            res.json({ message: "Notification deleted successfully" });
        }
        catch (error) {
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Team Activity routes
    app.get("/api/team-activity", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            console.log("[GET /api/team-activity] Obteniendo resumen de actividad del equipo");
            const activitySummary = await storage_1.storage.getTeamActivitySummary();
            console.log("[GET /api/team-activity] Resumen obtenido:", activitySummary);
            res.json(activitySummary);
        }
        catch (error) {
            console.error("Error getting team activity:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    app.get("/api/users/:id/last-kpi-update", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            const lastUpdate = await storage_1.storage.getLastKpiUpdateByUser(userId);
            res.json(lastUpdate);
        }
        catch (error) {
            console.error("Error getting last KPI update:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    });
    // Shipment Status Update with Notifications
    app.put("/api/shipments/:id/status", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const shipmentId = parseInt(req.params.id);
            const user = req.user;
            const validatedData = schema_1.updateShipmentStatusSchema.parse(req.body);
            console.log("[PUT /api/shipments/:id/status] Actualizando estado del envío:", { shipmentId, data: validatedData });
            // Obtener el envío actual
            const shipment = await storage_1.storage.getShipment(shipmentId);
            if (!shipment) {
                return res.status(404).json({ message: "Envío no encontrado" });
            }
            // Actualizar el envío con el nuevo estado
            const updatedShipment = await storage_1.storage.updateShipment(shipmentId, {
                status: validatedData.status,
                updatedAt: new Date()
            });
            if (!updatedShipment) {
                return res.status(404).json({ message: "Error al actualizar el envío" });
            }
            // Crear registro de actualización en el historial
            const shipmentUpdate = await storage_1.storage.createShipmentUpdate({
                shipmentId: shipmentId,
                status: validatedData.status,
                location: validatedData.location || null,
                comments: validatedData.comments || null,
                updatedBy: user.id
            });
            // Enviar notificación por email si está habilitada y el cliente tiene email
            if (validatedData.sendNotification && updatedShipment.customerEmail) {
                try {
                    console.log("[Notification] Enviando notificación por email a:", updatedShipment.customerEmail);
                    const emailTemplate = (0, sendgrid_1.getShipmentStatusEmailTemplate)(updatedShipment, validatedData.status, updatedShipment.customerName);
                    // Crear registro de notificación
                    const notificationRecord = await storage_1.storage.createShipmentNotification({
                        shipmentId: shipmentId,
                        emailTo: updatedShipment.customerEmail,
                        subject: emailTemplate.subject,
                        status: 'pending',
                        sentBy: user.id,
                        shipmentStatus: validatedData.status,
                        errorMessage: null
                    });
                    // Enviar email usando SendGrid
                    const emailSent = await (0, sendgrid_1.sendEmail)({
                        to: updatedShipment.customerEmail,
                        from: 'marioreynoso@grupoorsega.com', // Siempre desde Mario
                        subject: emailTemplate.subject,
                        html: emailTemplate.html,
                        text: emailTemplate.text
                    });
                    if (emailSent) {
                        await storage_1.storage.updateShipmentNotificationStatus(notificationRecord.id, 'sent');
                        console.log("[Notification] Email enviado exitosamente");
                    }
                    else {
                        await storage_1.storage.updateShipmentNotificationStatus(notificationRecord.id, 'failed', 'Error al enviar email');
                        console.error("[Notification] Error al enviar email");
                    }
                }
                catch (emailError) {
                    console.error("[Notification] Error en el proceso de notificación:", emailError);
                    // No fallar la actualización por un error de email
                }
            }
            res.json({
                shipment: updatedShipment,
                update: shipmentUpdate,
                notificationSent: validatedData.sendNotification && !!updatedShipment.customerEmail
            });
        }
        catch (error) {
            console.error("[PUT /api/shipments/:id/status] Error:", error);
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
            }
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    // Get shipment notification history
    app.get("/api/shipments/:id/notifications", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const shipmentId = parseInt(req.params.id);
            const notifications = await storage_1.storage.getShipmentNotificationsByShipment(shipmentId);
            res.json(notifications);
        }
        catch (error) {
            console.error("[GET /api/shipments/:id/notifications] Error:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    // Job Profile routes
    app.get("/api/job-profiles/:userId", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const profile = await storage_1.storage.getJobProfileWithDetails(userId);
            if (!profile) {
                return res.status(404).json({ message: "Perfil de trabajo no encontrado" });
            }
            res.json(profile);
        }
        catch (error) {
            console.error("[GET /api/job-profiles/:userId] Error:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    app.get("/api/user-kpis/:userId", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const userId = parseInt(req.params.userId);
            const userKpis = await storage_1.storage.getUserKpis(userId);
            res.json(userKpis);
        }
        catch (error) {
            console.error("[GET /api/user-kpis/:userId] Error:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    // KPI Overview - Vista consolidada para ejecutivos
    app.get("/api/kpi-overview", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const kpiOverview = await storage_1.storage.getKPIOverview();
            res.json(kpiOverview);
        }
        catch (error) {
            console.error("[GET /api/kpi-overview] Error:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    // KPI History - Historial mensual de un KPI específico
    app.get("/api/kpi-history/:kpiId", auth_1.jwtAuthMiddleware, async (req, res) => {
        try {
            const kpiId = parseInt(req.params.kpiId);
            const months = parseInt(req.query.months) || 12;
            const kpiHistory = await storage_1.storage.getKPIHistory(kpiId, months);
            res.json(kpiHistory);
        }
        catch (error) {
            console.error("[GET /api/kpi-history/:kpiId] Error:", error);
            res.status(500).json({ message: "Error interno del servidor" });
        }
    });
    // Integrate Logistics Routes
    app.use("/api", routes_catalog_1.catalogRouter);
    app.use("/api", routes_logistics_1.logisticsRouter);
    console.log("✅ All routes have been configured successfully");
    return app;
}
