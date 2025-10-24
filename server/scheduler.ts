import { autoCloseMonth } from "../scripts/weekly_sales_update";

/**
 * Simple scheduler para auto-cierre mensual
 * Se ejecuta diariamente y verifica si es el último día del mes
 */
export class MonthlyClosureScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    console.log('[MonthlyClosureScheduler] Inicializando scheduler...');
  }

  /**
   * Inicia el scheduler que verifica diariamente si debe ejecutar el auto-cierre
   */
  start() {
    if (this.isRunning) {
      console.log('[MonthlyClosureScheduler] Scheduler ya está ejecutándose');
      return;
    }

    console.log('[MonthlyClosureScheduler] 🚀 Iniciando scheduler - verificación diaria a las 23:00');
    
    // Ejecutar inmediatamente para verificar estado actual
    this.checkAndExecuteClosureIfNeeded();
    
    // Programar verificación diaria (cada 24 horas)
    this.intervalId = setInterval(() => {
      this.checkAndExecuteClosureIfNeeded();
    }, 24 * 60 * 60 * 1000); // 24 horas en millisegundos
    
    this.isRunning = true;
  }

  /**
   * Detiene el scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[MonthlyClosureScheduler] 🛑 Scheduler detenido');
  }

  /**
   * Verifica si es el último día del mes y ejecuta el auto-cierre si es necesario
   */
  private async checkAndExecuteClosureIfNeeded() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Solo ejecutar entre las 22:00 y 23:59 del último día del mes
      if (currentHour < 22) {
        console.log(`[MonthlyClosureScheduler] 🕐 No es hora de verificar - actual: ${currentHour}:00`);
        return;
      }

      // Verificar si es el último día del mes
      const isLastDayOfMonth = this.isLastDayOfMonth(now);
      
      if (!isLastDayOfMonth) {
        console.log(`[MonthlyClosureScheduler] 📅 No es el último día del mes - actual: ${now.getDate()}`);
        return;
      }

      console.log(`[MonthlyClosureScheduler] 🎯 ES EL ÚLTIMO DÍA DEL MES - ejecutando auto-cierre`);
      
      // Ejecutar auto-cierre para ambas empresas
      await this.executeMonthlyClosureForAllCompanies();
      
    } catch (error) {
      console.error('[MonthlyClosureScheduler] ❌ Error durante verificación:', error);
    }
  }

  /**
   * Verifica si es el último día del mes
   */
  private isLastDayOfMonth(date: Date): boolean {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === lastDay;
  }

  /**
   * Ejecuta el auto-cierre mensual para todas las empresas
   */
  private async executeMonthlyClosureForAllCompanies() {
    console.log('[MonthlyClosureScheduler] 🏢 Ejecutando auto-cierre para todas las empresas...');
    
    const companies = [1, 2]; // Dura International (1), Grupo Orsega (2)
    
    for (const companyId of companies) {
      try {
        console.log(`[MonthlyClosureScheduler] 🏢 Procesando empresa ${companyId}...`);
        
        const result = await autoCloseMonth(companyId);
        
        if (result) {
          console.log(`[MonthlyClosureScheduler] ✅ Auto-cierre exitoso para empresa ${companyId}`);
        } else {
          console.log(`[MonthlyClosureScheduler] ℹ️ No hay datos para cerrar en empresa ${companyId} o ya está cerrado`);
        }
        
      } catch (error) {
        console.error(`[MonthlyClosureScheduler] ❌ Error en auto-cierre para empresa ${companyId}:`, error);
      }
    }
    
    console.log('[MonthlyClosureScheduler] 🎉 Proceso de auto-cierre completado para todas las empresas');
  }

  /**
   * Ejecuta manualmente el auto-cierre (para testing)
   */
  async forceExecute(): Promise<void> {
    console.log('[MonthlyClosureScheduler] 🚀 Ejecución manual forzada...');
    await this.executeMonthlyClosureForAllCompanies();
  }

  /**
   * Obtiene el estado actual del scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextCheck: this.intervalId ? 'En 24 horas' : 'No programado',
      currentTime: new Date().toISOString(),
      isLastDayOfMonth: this.isLastDayOfMonth(new Date())
    };
  }
}

// Instancia global del scheduler
export const monthlyScheduler = new MonthlyClosureScheduler();