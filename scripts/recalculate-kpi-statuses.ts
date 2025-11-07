import 'dotenv/config';
import { db } from '../server/db';
import { kpisDura, kpisOrsega, kpiValuesDura, kpiValuesOrsega } from '@shared/schema';
import { eq } from 'drizzle-orm';

function extractNumericValue(value: string | number | null): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return NaN;
  
  // Remover caracteres no numéricos excepto punto decimal y signo negativo
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned);
}

function isLowerBetterKPI(kpiName: string): boolean {
  const lowerBetterPatterns = [
    'rotación de cuentas por cobrar',
    'velocidad de rotación',
    'tiempo de',
    'días de',
    'plazo de',
    'demora'
  ];
  
  const lowerKpiName = kpiName.toLowerCase();
  return lowerBetterPatterns.some(pattern => 
    lowerKpiName.includes(pattern) && !lowerKpiName.includes('entrega')
  );
}

function calculateStatus(value: string | number | null, target: string | number | null, kpiName: string): string {
  if (!value || !target) return 'alert';
  
  const numericValue = extractNumericValue(value);
  const numericTarget = extractNumericValue(target);
  
  if (isNaN(numericValue) || isNaN(numericTarget) || numericTarget <= 0) {
    return 'alert';
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  
  if (lowerBetter) {
    if (numericValue <= numericTarget) {
      return 'complies';
    } else if (numericValue <= numericTarget * 1.1) {
      return 'alert';
    } else {
      return 'not_compliant';
    }
  } else {
    if (numericValue >= numericTarget) {
      return 'complies';
    } else if (numericValue >= numericTarget * 0.9) {
      return 'alert';
    } else {
      return 'not_compliant';
    }
  }
}

function calculateCompliance(value: string | number | null, target: string | number | null, kpiName: string): string {
  if (!value || !target) return '0.0%';
  
  const numericValue = extractNumericValue(value);
  const numericTarget = extractNumericValue(target);
  
  if (isNaN(numericValue) || isNaN(numericTarget) || numericTarget <= 0) {
    return '0.0%';
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  let percentage: number;
  
  if (lowerBetter) {
    percentage = Math.min((numericTarget / numericValue) * 100, 100);
  } else {
    percentage = Math.min((numericValue / numericTarget) * 100, 100);
  }
  
  return `${percentage.toFixed(1)}%`;
}

async function recalculateStatuses() {
  console.log('🔄 Iniciando recálculo de estados de KPIs...\n');

  try {
    // Procesar KPIs de Dura
    console.log('📊 Procesando KPIs de Dura...');
    const duraKpis = await db.select().from(kpisDura);
    
    let duraUpdated = 0;
    for (const kpi of duraKpis) {
      const target = kpi.goal || null;
      if (!target) {
        console.log(`  ⏭️  KPI "${kpi.kpiName}" no tiene goal, saltando...`);
        continue;
      }

      // Obtener todos los valores de este KPI
      const values = await db
        .select()
        .from(kpiValuesDura)
        .where(eq(kpiValuesDura.kpiId, kpi.id));
      
      // Ordenar por fecha descendente
      values.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      for (const value of values) {
        const newStatus = calculateStatus(value.value, target, kpi.kpiName);
        const newCompliance = calculateCompliance(value.value, target, kpi.kpiName);

        // Solo actualizar si el estado o compliance cambió
        if (value.status !== newStatus || value.compliancePercentage !== newCompliance) {
          await db
            .update(kpiValuesDura)
            .set({
              status: newStatus,
              compliancePercentage: newCompliance
            })
            .where(eq(kpiValuesDura.id, value.id));
          
          duraUpdated++;
          console.log(`  ✅ Actualizado: "${kpi.kpiName}" - Valor: ${value.value}, Estado: ${value.status} → ${newStatus}, Compliance: ${newCompliance}`);
        }
      }
    }

    // Procesar KPIs de Orsega
    console.log('\n📊 Procesando KPIs de Orsega...');
    const orsegaKpis = await db.select().from(kpisOrsega);
    
    let orsegaUpdated = 0;
    for (const kpi of orsegaKpis) {
      const target = kpi.goal || null;
      if (!target) {
        console.log(`  ⏭️  KPI "${kpi.kpiName}" no tiene goal, saltando...`);
        continue;
      }

      // Obtener todos los valores de este KPI
      const values = await db
        .select()
        .from(kpiValuesOrsega)
        .where(eq(kpiValuesOrsega.kpiId, kpi.id));
      
      // Ordenar por fecha descendente
      values.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      for (const value of values) {
        const newStatus = calculateStatus(value.value, target, kpi.kpiName);
        const newCompliance = calculateCompliance(value.value, target, kpi.kpiName);

        // Solo actualizar si el estado o compliance cambió
        if (value.status !== newStatus || value.compliancePercentage !== newCompliance) {
          await db
            .update(kpiValuesOrsega)
            .set({
              status: newStatus,
              compliancePercentage: newCompliance
            })
            .where(eq(kpiValuesOrsega.id, value.id));
          
          orsegaUpdated++;
          console.log(`  ✅ Actualizado: "${kpi.kpiName}" - Valor: ${value.value}, Estado: ${value.status} → ${newStatus}, Compliance: ${newCompliance}`);
        }
      }
    }

    console.log(`\n✅ Recálculo completado:`);
    console.log(`   - Dura: ${duraUpdated} valores actualizados`);
    console.log(`   - Orsega: ${orsegaUpdated} valores actualizados`);
    console.log(`   - Total: ${duraUpdated + orsegaUpdated} valores actualizados`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al recalcular estados:', error);
    process.exit(1);
  }
}

recalculateStatuses();

