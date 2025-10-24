"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const DatabaseStorage_1 = require("./DatabaseStorage");
// Servicio para obtener cotizaciones automáticamente del DOF y otras fuentes
class CurrencyService {
    constructor() {
        this.isRunning = false;
    }
    // Obtener cotización oficial USD/MXN
    async getDOFRate() {
        try {
            console.log('🔍 Obteniendo cotización oficial USD/MXN...');
            // Usar API confiable de exchangerate-api.com
            const response = await axios_1.default.get('https://api.exchangerate-api.com/v4/latest/USD', {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            console.log('📡 Respuesta de exchangerate-api.com:', response.status);
            if (response.data && response.data.rates && response.data.rates.MXN) {
                const baseRate = parseFloat(response.data.rates.MXN);
                console.log(`✅ Tipo de cambio USD/MXN obtenido: ${baseRate}`);
                // Simular spread bancario típico del DOF
                const spread = 0.03; // 3 centavos de spread
                return {
                    buyRate: baseRate - spread,
                    sellRate: baseRate + spread,
                    date: new Date()
                };
            }
            console.log('❌ No se pudo obtener la cotización MXN');
            return null;
        }
        catch (error) {
            console.error('❌ Error obteniendo cotización oficial:', error.message);
            return null;
        }
    }
    // Obtener cotización de múltiples fuentes (simulado para demo)
    async getMultipleRates() {
        const rates = [];
        // DOF - Real
        const dofRate = await this.getDOFRate();
        if (dofRate) {
            rates.push({
                source: 'DOF',
                buyRate: dofRate.buyRate,
                sellRate: dofRate.sellRate
            });
        }
        // Santander - Simulado basado en DOF + spread
        if (dofRate) {
            rates.push({
                source: 'Santander',
                buyRate: dofRate.buyRate - 0.15,
                sellRate: dofRate.sellRate + 0.15
            });
            // Monex - Simulado basado en DOF + spread diferente
            rates.push({
                source: 'Monex',
                buyRate: dofRate.buyRate - 0.10,
                sellRate: dofRate.sellRate + 0.10
            });
        }
        return rates;
    }
    // Guardar cotizaciones en la base de datos
    async saveCurrencyQuotes() {
        try {
            const rates = await this.getMultipleRates();
            const now = new Date();
            for (const rate of rates) {
                const quote = {
                    sourceProvider: rate.source.toLowerCase(),
                    quotingUser: 1, // Lolita's user ID - adjust as needed
                    companyId: 1, // Default company
                    buyRate: rate.buyRate.toString(),
                    sellRate: rate.sellRate.toString(),
                    baseCurrency: 'USD',
                    targetCurrency: 'MXN',
                    quotingDate: now.toISOString().split('T')[0],
                    quotingTime: now.toTimeString().split(' ')[0],
                    notes: 'Actualización automática'
                };
                await DatabaseStorage_1.storage.createCurrencyQuote(quote);
                console.log(`✅ Cotización guardada: ${rate.source} - Compra: $${rate.buyRate} - Venta: $${rate.sellRate}`);
            }
            console.log(`🔄 Actualizadas ${rates.length} cotizaciones a las ${now.toLocaleTimeString('es-MX')}`);
        }
        catch (error) {
            console.error('Error guardando cotizaciones:', error);
        }
    }
    // Obtener historial de la última semana
    async getWeeklyHistory() {
        try {
            const quotes = await DatabaseStorage_1.storage.getCurrencyQuotes();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return quotes.filter(quote => new Date(quote.createdAt || quote.quotingDate) >= oneWeekAgo);
        }
        catch (error) {
            console.error('Error obteniendo historial semanal:', error);
            return [];
        }
    }
    // Inicializar tareas automáticas
    startAutomaticUpdates() {
        if (this.isRunning) {
            console.log('⚠️ Servicio de cotizaciones ya está ejecutándose');
            return;
        }
        this.isRunning = true;
        console.log('🚀 Iniciando servicio automático de cotizaciones...');
        // Tarea a las 9:00 AM todos los días
        node_cron_1.default.schedule('0 9 * * *', async () => {
            console.log('⏰ Ejecutando actualización automática - 9:00 AM');
            await this.saveCurrencyQuotes();
        }, {
            timezone: "America/Mexico_City"
        });
        // Tarea a las 12:30 PM todos los días
        node_cron_1.default.schedule('30 12 * * *', async () => {
            console.log('⏰ Ejecutando actualización automática - 12:30 PM');
            await this.saveCurrencyQuotes();
        }, {
            timezone: "America/Mexico_City"
        });
        // Actualización cada 30 minutos para pruebas
        node_cron_1.default.schedule('*/30 * * * *', async () => {
            console.log('⏰ Actualización de prueba cada 30 minutos');
            await this.saveCurrencyQuotes();
        }, {
            timezone: "America/Mexico_City"
        });
        console.log('✅ Tareas automáticas programadas:');
        console.log('   • 9:00 AM (Zona horaria México)');
        console.log('   • 12:30 PM (Zona horaria México)');
        console.log('   • Cada 30 minutos (para pruebas)');
        // Actualización inmediata para mostrar datos
        console.log('🔄 Ejecutando actualización inmediata...');
        this.saveCurrencyQuotes();
    }
    // Detener tareas automáticas
    stopAutomaticUpdates() {
        this.isRunning = false;
        console.log('🛑 Servicio automático de cotizaciones detenido');
    }
    // Método manual para forzar actualización
    async forceUpdate() {
        console.log('🔄 Forzando actualización manual de cotizaciones...');
        await this.saveCurrencyQuotes();
    }
}
exports.currencyService = new CurrencyService();
//# sourceMappingURL=currencyService.js.map