import { storage } from '../server/storage';

/**
 * Utilidades para detección automática de período
 */
export function detectCurrentPeriod(): { weekNumber: number; weekText: string; month: string; year: number; period: string } {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const weekNumber = Math.ceil(dayOfMonth / 7);
  
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  const weekText = `Semana ${weekNumber}`;
  const period = `${weekText} - ${month} ${year}`;
  
  return { weekNumber, weekText, month, year, period };
}

export async function getLastWeeklyUpdate(companyId: number): Promise<any | null> {
  try {
    const allKpis = await storage.getKpis();
    const volumeKpi = allKpis.find(kpi => 
      kpi.name.includes("Volumen de ventas") && 
      kpi.companyId === companyId
    );
    
    if (!volumeKpi) return null;
    
    const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? companyId);
    const weeklyValues = kpiValues.filter(value =>
      value.period?.includes("Semana")
    ).sort((a, b) => {
      const dateA = new Date(a.date as string | number | Date);
      const dateB = new Date(b.date as string | number | Date);
      return dateB.getTime() - dateA.getTime();
    });
    
    return weeklyValues[0] || null;
  } catch (error) {
    console.error('Error getting last weekly update:', error);
    return null;
  }
}

/**
 * Interfaz para los datos de venta semanal simplificada
 */
export interface SalesData {
  /** Valor de ventas de la semana en KG o unidades (sin formato) */
  value: number;
  /** ID de la compañía (1 para Dura International, 2 para Grupo Orsega) */
  companyId: number;
  /** ID del usuario que hace la actualización */
  userId?: number;
  /** Datos para override manual (solo administradores) */
  adminOverride?: boolean;
  weekNumber?: string;
  month?: string;
  year?: number;
}

/**
 * Interfaz para la respuesta de la actualización semanal
 */
export interface WeeklySalesUpdateResult {
  success: boolean;
  message?: string;
  weeklyRecord?: any;
  currentPeriod?: any;
  monthlyPreview?: {
    totalValue: number;
    formattedValue: string;
    compliancePercentage: string;
    status: string;
    weekCount: number;
    comment: string;
  };
}

/**
 * Función principal simplificada para actualizar ventas semanales
 * Detecta automáticamente el período y maneja crear/actualizar inteligentemente
 * 
 * @param salesData - Objeto con los datos de venta semanal simplificados
 * @returns Resultado de la operación
 */
export async function updateWeeklySales(salesData: SalesData): Promise<WeeklySalesUpdateResult> {
  try {
    // Validar datos de entrada simplificados
    if (!salesData || !salesData.value || !salesData.companyId) {
      throw new Error("Faltan datos obligatorios: value y companyId son requeridos");
    }

    console.log('[UpdateWeeklySales] Iniciando actualización con datos:', salesData);

    // 1. Determinar período (automático o manual para administradores)
    let currentPeriod: any;
    
    if (salesData.adminOverride && salesData.weekNumber && salesData.month && salesData.year) {
      // Modo administrador: usar período manual
      const weekNumber = parseInt(salesData.weekNumber.replace('Semana ', ''));
      currentPeriod = {
        weekNumber,
        weekText: salesData.weekNumber,
        month: salesData.month,
        year: salesData.year,
        period: `${salesData.weekNumber} - ${salesData.month} ${salesData.year}`
      };
      console.log('[UpdateWeeklySales] Modo ADMINISTRADOR - Período manual:', currentPeriod);
    } else {
      // Modo normal: detectar automáticamente
      currentPeriod = detectCurrentPeriod();
      console.log('[UpdateWeeklySales] Modo NORMAL - Período automático:', currentPeriod);
    }

    // 2. Encontrar el KPI de volumen de ventas para la compañía
    const allKpis = await storage.getKpis();
    const selectedCompanyId = salesData.companyId;
    
    const volumeKpi = allKpis.find(kpi => 
      kpi.name.includes("Volumen de ventas") && 
      kpi.companyId === selectedCompanyId
    );

    if (!volumeKpi) {
      throw new Error(`No se encontró el KPI de volumen de ventas para la compañía ID: ${selectedCompanyId}`);
    }

    console.log(`[UpdateWeeklySales] Encontrado KPI: ${volumeKpi.name} (ID: ${volumeKpi.id})`);
    
    // 3. Verificar si ya existe un registro para esta semana
    const existingWeeklyRecords = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? selectedCompanyId);
    const existingThisWeek = existingWeeklyRecords.find(record => 
      record.period === currentPeriod.period
    );
    
    const isUpdate = !!existingThisWeek;
    console.log(`[UpdateWeeklySales] ${isUpdate ? 'Actualizando' : 'Creando'} registro para: ${currentPeriod.period}`);
    
    // 4. Calcular objetivos automáticamente
    const annualTarget = parseFloat((volumeKpi.target ?? '0').replace(/[^0-9.,]/g, '').replace(',', ''));
    const monthlyTarget = Math.round(annualTarget / 12);
    const weeklyTarget = Math.round(monthlyTarget / 4);
    
    console.log(`[UpdateWeeklySales] Objetivos - Anual: ${annualTarget}, Mensual: ${monthlyTarget}, Semanal: ${weeklyTarget}`);
    
    // 5. Preparar datos del registro semanal
    const formattedValue = new Intl.NumberFormat('es-MX').format(salesData.value);
    const valueUnit = selectedCompanyId === 1 ? "KG" : "unidades";
    const fullFormattedValue = `${formattedValue} ${valueUnit}`;
    
    // Calcular compliance semanal (umbrales centralizados: 100%/90%)
    const weeklyCompliance = (salesData.value / weeklyTarget) * 100;
    const weeklyStatus = weeklyCompliance >= 100 ? "complies" :
                        weeklyCompliance >= 90 ? "alert" : "not_compliant";
    
    const weeklyKpiValue = {
      companyId: volumeKpi.companyId ?? selectedCompanyId,
      kpiId: volumeKpi.id,
      userId: salesData.userId || 1, // Usuario que actualiza (Omar)
      value: fullFormattedValue,
      period: currentPeriod.period,
      month: currentPeriod.month,
      year: currentPeriod.year,
      compliancePercentage: `${weeklyCompliance.toFixed(1)}%`,
      status: weeklyStatus,
      comments: `${isUpdate ? 'Actualización' : 'Registro'} semanal automático`,
      updatedBy: salesData.userId || 1
    };
    
    // 6. Crear registro semanal (por ahora siempre crear nuevo)
    console.log(`[UpdateWeeklySales] Creando nuevo registro semanal`);
    const savedWeeklySales = await storage.createKpiValue(weeklyKpiValue);
    
    // 7. Calcular total mensual actualizado
    // Recalcular total mensual con todos los registros semanales
    const updatedKpiValues = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? selectedCompanyId);
    const currentMonthWeeklySales = updatedKpiValues.filter(value =>
      value.period?.includes(currentPeriod.month) &&
      value.period?.includes(currentPeriod.year.toString()) &&
      value.period?.includes("Semana")
    );
    
    let monthlyTotal = 0;
    currentMonthWeeklySales.forEach(sale => {
      const numericValue = parseFloat(sale.value.replace(/[^0-9.,]+/g, '').replace(',', '.'));
      if (!isNaN(numericValue)) {
        monthlyTotal += numericValue;
      }
    });
    
    const formattedMonthlyTotal = new Intl.NumberFormat('es-MX').format(monthlyTotal);
    console.log(`[UpdateWeeklySales] Total mensual recalculado: ${formattedMonthlyTotal} ${valueUnit} (${currentMonthWeeklySales.length} semanas)`);
    
    // 8. Calcular métricas mensuales en tiempo real (no guardar aún)
    // Umbrales centralizados: 100%/90% (ver shared/kpi-utils.ts)
    const monthlyCompliancePercentage = (monthlyTotal / monthlyTarget) * 100;
    const monthlyStatus = monthlyCompliancePercentage >= 100 ? "complies" :
                         monthlyCompliancePercentage >= 90 ? "alert" : "not_compliant";
    
    const monthlyComment = `Total mensual: ${formattedMonthlyTotal} ${valueUnit} de ${currentMonthWeeklySales.length} semanas (${monthlyCompliancePercentage.toFixed(1)}% del objetivo)`;
    
    console.log(`[UpdateWeeklySales] Métricas mensuales - Compliance: ${monthlyCompliancePercentage.toFixed(1)}%, Status: ${monthlyStatus}`);
    
    // 9. Retornar resultado exitoso
    console.log(`[UpdateWeeklySales] ✅ Proceso completado exitosamente`);
    
    return {
      success: true,
      message: `${isUpdate ? 'Actualización' : 'Registro'} semanal completado exitosamente`,
      weeklyRecord: savedWeeklySales,
      currentPeriod: currentPeriod,
      monthlyPreview: {
        totalValue: monthlyTotal,
        formattedValue: `${formattedMonthlyTotal} ${valueUnit}`,
        compliancePercentage: `${monthlyCompliancePercentage.toFixed(1)}%`,
        status: monthlyStatus,
        weekCount: currentMonthWeeklySales.length,
        comment: monthlyComment
      }
    };
    
  } catch (error: any) {
    console.error('[UpdateWeeklySales] ❌ Error al procesar actualización:', error);
    return {
      success: false,
      message: error?.message || 'Error desconocido al actualizar ventas semanales'
    };
  }
}

/**
 * Función para el auto-cierre mensual (se ejecutará con cron job)
 */
export async function autoCloseMonth(companyId: number, month?: string, year?: number): Promise<boolean> {
  try {
    const currentDate = new Date();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                       "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    const targetMonth = month || (currentDate.getMonth() === 0 ? "Diciembre" : monthNames[currentDate.getMonth() - 1]);
    const targetYear = year || (currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear());
    
    console.log(`[AutoCloseMonth] Cerrando mes ${targetMonth} ${targetYear} para empresa ${companyId}`);
    
    // Encontrar KPI de volumen de ventas
    const allKpis = await storage.getKpis();
    const volumeKpi = allKpis.find(kpi => 
      kpi.name.includes("Volumen de ventas") && 
      kpi.companyId === companyId
    );
    
    if (!volumeKpi) {
      console.error(`[AutoCloseMonth] No se encontró KPI de volumen de ventas para empresa ${companyId}`);
      return false;
    }
    
    // Obtener todas las ventas semanales del mes
    const kpiValues = await storage.getKpiValuesByKpi(volumeKpi.id, volumeKpi.companyId ?? companyId);
    const weeklyRecords = kpiValues.filter(value =>
      value.period?.includes(targetMonth) &&
      value.period?.includes(targetYear.toString()) &&
      value.period?.includes("Semana")
    );
    
    if (weeklyRecords.length === 0) {
      console.log(`[AutoCloseMonth] No hay registros semanales para ${targetMonth} ${targetYear}`);
      return false;
    }
    
    // Calcular total mensual
    let monthlyTotal = 0;
    weeklyRecords.forEach(record => {
      const numericValue = parseFloat(record.value.replace(/[^0-9.,]+/g, '').replace(',', '.'));
      if (!isNaN(numericValue)) {
        monthlyTotal += numericValue;
      }
    });
    
    const annualTarget = parseFloat((volumeKpi.target ?? '0').replace(/[^0-9.,]+/g, '').replace(',', ''));
    const monthlyTarget = Math.round(annualTarget / 12);
    const compliancePercentage = (monthlyTotal / monthlyTarget) * 100;
    // Umbrales centralizados: 100%/90% (ver shared/kpi-utils.ts)
    const status = compliancePercentage >= 100 ? "complies" :
                  compliancePercentage >= 90 ? "alert" : "not_compliant";
    
    const valueUnit = companyId === 1 ? "KG" : "unidades";
    const formattedTotal = new Intl.NumberFormat('es-MX').format(monthlyTotal);
    
    // Crear registro mensual oficial
    const lastRecord = weeklyRecords[weeklyRecords.length - 1];
    const monthlyRecord = {
      kpiId: volumeKpi.id,
      userId: (lastRecord && 'userId' in lastRecord ? lastRecord.userId : null) || 1,
      value: `${formattedTotal} ${valueUnit}`,
      period: `${targetMonth} ${targetYear}`,
      compliancePercentage: `${compliancePercentage.toFixed(1)}%`,
      status,
      comments: `Cierre automático mensual - suma de ${weeklyRecords.length} semanas`,
      updatedBy: null // Sistema
    };
    
    await storage.createKpiValue(monthlyRecord);
    console.log(`[AutoCloseMonth] ✅ Mes ${targetMonth} ${targetYear} cerrado - Total: ${formattedTotal} ${valueUnit}`);
    
    return true;
  } catch (error) {
    console.error(`[AutoCloseMonth] ❌ Error al cerrar mes:`, error);
    return false;
  }
}
