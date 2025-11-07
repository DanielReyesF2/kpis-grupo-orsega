import 'dotenv/config';
import { db, pool } from '../server/db';
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
    'demora',
    'incidencias'
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

function calculateCompliance(value: string | number | null, target: string | number | null, kpiName: string): number {
  if (!value || !target) return 0.0;
  
  const numericValue = extractNumericValue(value);
  const numericTarget = extractNumericValue(target);
  
  if (isNaN(numericValue) || isNaN(numericTarget) || numericTarget <= 0) {
    return 0.0;
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  let percentage: number;
  
  if (lowerBetter) {
    percentage = Math.min((numericTarget / numericValue) * 100, 100);
  } else {
    percentage = Math.min((numericValue / numericTarget) * 100, 100);
  }
  
  return parseFloat(percentage.toFixed(1));
}

async function recalculateMissingStatuses() {
  console.log('🔄 Iniciando recálculo de compliancePercentage y status faltantes...\n');

  try {
    let totalUpdated = 0;
    let totalSkipped = 0;

    // Procesar KPIs de Dura
    console.log('📊 Procesando KPIs de Dura...');
    const duraKpis = await db.select().from(kpisDura);
    const duraKpisMap = new Map(duraKpis.map(k => [k.id, k]));
    
    // Obtener valores de Dura que no tienen compliance_percentage o status
    const allDuraValues = await db.select().from(kpiValuesDura);
    const duraValuesToUpdate = allDuraValues.filter(v => {
      const hasCompliance = v.compliance_percentage && v.compliance_percentage.trim() !== '';
      const hasStatus = v.status && v.status.trim() !== '';
      return !hasCompliance || !hasStatus;
    });

    console.log(`  📋 Encontrados ${duraValuesToUpdate.length} valores de Dura sin compliance/status`);

    for (const value of duraValuesToUpdate) {
      const kpi = duraKpisMap.get(value.kpi_id);
      if (!kpi) {
        console.log(`  ⚠️  KPI ${value.kpi_id} no encontrado, saltando valor ${value.id}`);
        totalSkipped++;
        continue;
      }

      const target = kpi.goal || null;
      if (!target) {
        console.log(`  ⏭️  KPI "${kpi.kpiName}" no tiene goal, saltando valor ${value.id}`);
        totalSkipped++;
        continue;
      }

      const valueNum = value.value || 0;
      const valueStr = valueNum.toString();
      const newStatus = calculateStatus(valueStr, target, kpi.kpiName);
      const newCompliance = calculateCompliance(valueStr, target, kpi.kpiName);

      // Solo actualizar los campos que faltan
      const updateData: any = {};
      if (!value.compliance_percentage || value.compliance_percentage.trim() === '') {
        updateData.compliance_percentage = newCompliance;
      }
      if (!value.status || value.status.trim() === '') {
        updateData.status = newStatus;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          // Usar pool directamente para ejecutar SQL crudo
          // compliance_percentage es numeric, no text
          const queryParts: string[] = [];
          if (updateData.compliance_percentage !== undefined) {
            queryParts.push(`compliance_percentage = ${updateData.compliance_percentage}`);
          }
          if (updateData.status !== undefined) {
            const escaped = updateData.status.replace(/'/g, "''");
            queryParts.push(`status = '${escaped}'`);
          }
          
          if (queryParts.length > 0) {
            const finalQuery = `UPDATE kpi_values_dura SET ${queryParts.join(', ')} WHERE id = ${value.id}`;
            await pool.query(finalQuery);
          }
        } catch (error: any) {
          console.error(`  ❌ Error actualizando valor ${value.id}:`, error.message);
          console.error(`     updateData:`, updateData);
          continue;
        }
      } else {
        totalSkipped++;
        continue;
      }

      totalUpdated++;
      console.log(`  ✅ Actualizado valor ${value.id} de "${kpi.kpiName}": ${valueStr} vs ${target} → ${newStatus} (${newCompliance})`);
    }

    // Procesar KPIs de Orsega
    console.log('\n📊 Procesando KPIs de Orsega...');
    const orsegaKpis = await db.select().from(kpisOrsega);
    const orsegaKpisMap = new Map(orsegaKpis.map(k => [k.id, k]));
    
    // Obtener valores de Orsega que no tienen compliance_percentage o status
    const allOrsegaValues = await db.select().from(kpiValuesOrsega);
    const orsegaValuesToUpdate = allOrsegaValues.filter(v => {
      const hasCompliance = v.compliance_percentage && v.compliance_percentage.trim() !== '';
      const hasStatus = v.status && v.status.trim() !== '';
      return !hasCompliance || !hasStatus;
    });

    console.log(`  📋 Encontrados ${orsegaValuesToUpdate.length} valores de Orsega sin compliance/status`);

    for (const value of orsegaValuesToUpdate) {
      const kpi = orsegaKpisMap.get(value.kpi_id);
      if (!kpi) {
        console.log(`  ⚠️  KPI ${value.kpi_id} no encontrado, saltando valor ${value.id}`);
        totalSkipped++;
        continue;
      }

      const target = kpi.goal || null;
      if (!target) {
        console.log(`  ⏭️  KPI "${kpi.kpiName}" no tiene goal, saltando valor ${value.id}`);
        totalSkipped++;
        continue;
      }

      const valueNum = value.value || 0;
      const valueStr = valueNum.toString();
      const newStatus = calculateStatus(valueStr, target, kpi.kpiName);
      const newCompliance = calculateCompliance(valueStr, target, kpi.kpiName);

      // Solo actualizar los campos que faltan
      const updateData: any = {};
      if (!value.compliance_percentage || value.compliance_percentage.trim() === '') {
        updateData.compliance_percentage = newCompliance;
      }
      if (!value.status || value.status.trim() === '') {
        updateData.status = newStatus;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          // Usar pool directamente para ejecutar SQL crudo
          // compliance_percentage es numeric, no text
          const queryParts: string[] = [];
          if (updateData.compliance_percentage !== undefined) {
            queryParts.push(`compliance_percentage = ${updateData.compliance_percentage}`);
          }
          if (updateData.status !== undefined) {
            const escaped = updateData.status.replace(/'/g, "''");
            queryParts.push(`status = '${escaped}'`);
          }
          
          if (queryParts.length > 0) {
            const finalQuery = `UPDATE kpi_values_orsega SET ${queryParts.join(', ')} WHERE id = ${value.id}`;
            await pool.query(finalQuery);
          }
        } catch (error: any) {
          console.error(`  ❌ Error actualizando valor ${value.id}:`, error.message);
          console.error(`     updateData:`, updateData);
          continue;
        }
      } else {
        totalSkipped++;
        continue;
      }

      totalUpdated++;
      console.log(`  ✅ Actualizado valor ${value.id} de "${kpi.kpiName}": ${valueStr} vs ${target} → ${newStatus} (${newCompliance})`);
    }

    console.log(`\n✅ Recálculo completado:`);
    console.log(`   - Valores actualizados: ${totalUpdated}`);
    console.log(`   - Valores saltados: ${totalSkipped}`);
    console.log(`   - Total procesado: ${totalUpdated + totalSkipped}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al recalcular estados:', error);
    process.exit(1);
  }
}

recalculateMissingStatuses();

