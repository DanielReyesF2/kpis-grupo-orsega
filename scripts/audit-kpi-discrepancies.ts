import 'dotenv/config';
import { db } from '../server/db';
import { kpisDura, kpisOrsega, kpiValuesDura, kpiValuesOrsega, users, areas, companies } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { calculateKpiStatus, calculateCompliance } from '../client/src/lib/utils/kpi-status';

interface DiscrepancyReport {
  kpiId: number;
  companyId: number;
  kpiName: string;
  area: string;
  discrepancies: {
    latestValue?: {
      overview: string | null;
      detail: string | null;
      database: string | null;
      match: boolean;
    };
    status?: {
      overview: string;
      calculated: string;
      database: string | null;
      match: boolean;
    };
    target?: {
      target: string | null;
      goal: string | null;
      used: 'target' | 'goal' | 'both' | 'none';
    };
    compliance?: {
      overview: string | null;
      calculated: string | null;
      database: string | null;
      match: boolean;
    };
  };
}

/**
 * Parsea un valor numérico de un string
 */
function parseNumericValue(raw?: string | null): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned);
}

/**
 * Determina si un KPI es de "menor es mejor"
 */
function isLowerBetterKPI(kpiName: string): boolean {
  const lowerBetterKPIs = [
    'días de cobro',
    'días de pago',
    'tiempo de entrega',
    'tiempo promedio',
    'tiempo de respuesta',
    'tiempo de ciclo',
    'días de inventario',
    'rotación de inventario',
    'defectos',
    'errores',
    'quejas',
    'devoluciones',
    'huella de carbono',
    'costos',
    'gastos'
  ];
  
  const kpiNameLower = kpiName.toLowerCase();
  return lowerBetterKPIs.some(pattern => kpiNameLower.includes(pattern));
}

/**
 * Calcula el status como lo hace getKPIOverview
 */
function calculateStatusOverview(
  currentValue: string | null,
  target: string | null,
  kpiName: string
): string {
  if (!currentValue) return "non-compliant";
  
  const targetNumber = parseNumericValue(target);
  const currentNumber = parseNumericValue(currentValue);
  
  if (isNaN(targetNumber) || isNaN(currentNumber)) {
    return currentValue ? "alert" : "non-compliant";
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  
  if (lowerBetter) {
    if (currentNumber <= targetNumber) {
      return "compliant";
    } else if (currentNumber <= targetNumber * 1.1) {
      return "alert";
    } else {
      return "non-compliant";
    }
  } else {
    if (currentNumber >= targetNumber) {
      return "compliant";
    } else if (currentNumber >= targetNumber * 0.9) {
      return "alert";
    } else {
      return "non-compliant";
    }
  }
}

/**
 * Normaliza el status para comparación
 */
function normalizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'compliant': 'complies',
    'non-compliant': 'not_compliant',
    'alert': 'alert',
    'complies': 'complies',
    'not_compliant': 'not_compliant'
  };
  return statusMap[status.toLowerCase()] || status.toLowerCase();
}

/**
 * Obtiene el último valor de un KPI desde la base de datos
 */
async function getLatestValueFromDB(
  companyId: number,
  kpiId: number
): Promise<{ value: string | null; date: Date | null; status: string | null; compliancePercentage: string | null }> {
  const resolved = companyId === 1 ? 1 : 2;
  const table = resolved === 1 ? kpiValuesDura : kpiValuesOrsega;
  
  const records = await db
    .select()
    .from(table)
    .where(eq(table.kpi_id, kpiId))
    .orderBy(desc(table.year), desc(table.created_at))
    .limit(1);
  
  if (records.length === 0) {
    return { value: null, date: null, status: null, compliancePercentage: null };
  }
  
  const record = records[0];
  return {
    value: record.value?.toString() || null,
    date: record.created_at || null,
    status: record.status || null,
    compliancePercentage: record.compliance_percentage || null
  };
}

/**
 * Simula cómo getKPIOverview obtiene el último valor
 */
async function getLatestValueOverview(
  companyId: number,
  kpiId: number
): Promise<string | null> {
  const resolved = companyId === 1 ? 1 : 2;
  const table = resolved === 1 ? kpiValuesDura : kpiValuesOrsega;
  
  const records = await db
    .select()
    .from(table)
    .where(eq(table.kpi_id, kpiId));
  
  if (records.length === 0) return null;
  
  // Simular la lógica de latestValueMap
  let latest: typeof records[0] | null = null;
  for (const record of records) {
    const recordDate = record.created_at ? new Date(record.created_at) : null;
    const latestDate = latest?.created_at ? new Date(latest.created_at) : null;
    
    if (!latest || (recordDate && latestDate && recordDate > latestDate)) {
      latest = record;
    }
  }
  
  return latest?.value?.toString() || null;
}

/**
 * Simula cómo KpiDetailDialog obtiene el último valor
 */
async function getLatestValueDetail(
  companyId: number,
  kpiId: number
): Promise<string | null> {
  const resolved = companyId === 1 ? 1 : 2;
  const table = resolved === 1 ? kpiValuesDura : kpiValuesOrsega;
  
  const records = await db
    .select()
    .from(table)
    .where(eq(table.kpi_id, kpiId))
    .orderBy(desc(table.year), desc(table.created_at))
    .limit(1);
  
  if (records.length === 0) return null;
  
  return records[0].value?.toString() || null;
}

/**
 * Función principal de auditoría
 */
async function auditKpiDiscrepancies() {
  console.log('🔍 Iniciando auditoría de discrepancias en KPIs...\n');
  
  const reports: DiscrepancyReport[] = [];
  
  // Obtener todas las empresas
  const allCompanies = await db.select().from(companies);
  
  for (const company of allCompanies) {
    const companyId = company.id;
    const resolved = companyId === 1 ? 1 : 2;
    
    console.log(`\n📊 Analizando empresa: ${company.name} (ID: ${companyId})`);
    
    // Obtener KPIs de la empresa
    const kpiTable = resolved === 1 ? kpisDura : kpisOrsega;
    const kpis = await db.select().from(kpiTable);
    
    console.log(`   Encontrados ${kpis.length} KPIs`);
    
    for (const kpi of kpis) {
      const kpiId = kpi.id;
      
      // Obtener valores desde diferentes fuentes
      const [latestValueOverview, latestValueDetail, latestValueDB] = await Promise.all([
        getLatestValueOverview(companyId, kpiId),
        getLatestValueDetail(companyId, kpiId),
        getLatestValueFromDB(companyId, kpiId)
      ]);
      
      // Obtener target y goal
      // Nota: En la BD solo existe 'goal', pero se mapea a 'target' también
      const goal = kpi.goal || null;
      const target = goal; // target se mapea desde goal en mapKpiRecord
      const usedTarget = goal ?? null;
      
      // Calcular status desde diferentes fuentes
      const statusOverview = calculateStatusOverview(latestValueOverview, usedTarget, kpi.kpiName);
      const statusCalculated = calculateKpiStatus(
        latestValueOverview || '',
        usedTarget || '',
        isLowerBetterKPI(kpi.kpiName)
      );
      
      // Calcular compliance
      const complianceCalculated = latestValueOverview && usedTarget
        ? calculateCompliance(latestValueOverview, usedTarget, isLowerBetterKPI(kpi.kpiName))
        : null;
      
      // Verificar discrepancias
      const valueMatch = latestValueOverview === latestValueDetail && latestValueDetail === latestValueDB.value;
      const statusMatch = normalizeStatus(statusOverview) === normalizeStatus(statusCalculated);
      const complianceMatch = latestValueDB.compliancePercentage 
        ? Math.abs(parseFloat(complianceCalculated?.replace('%', '') || '0') - parseFloat(latestValueDB.compliancePercentage.replace('%', '') || '0')) < 0.1
        : true; // Si no hay compliance en BD, no podemos comparar
      
      // Solo reportar si hay discrepancias
      if (!valueMatch || !statusMatch || !complianceMatch || (target && goal && target !== goal)) {
        const report: DiscrepancyReport = {
          kpiId,
          companyId,
          kpiName: kpi.kpiName,
          area: kpi.area,
          discrepancies: {
            latestValue: {
              overview: latestValueOverview,
              detail: latestValueDetail,
              database: latestValueDB.value,
              match: valueMatch
            },
            status: {
              overview: statusOverview,
              calculated: statusCalculated,
              database: latestValueDB.status,
              match: statusMatch && (!latestValueDB.status || normalizeStatus(latestValueDB.status) === normalizeStatus(statusCalculated))
            },
            target: {
              target,
              goal,
              used: target && goal ? 'both' : target ? 'target' : goal ? 'goal' : 'none'
            },
            compliance: {
              overview: null, // No se calcula en overview directamente
              calculated: complianceCalculated,
              database: latestValueDB.compliancePercentage,
              match: complianceMatch
            }
          }
        };
        
        reports.push(report);
      }
    }
  }
  
  // Generar reporte
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 REPORTE DE DISCREPANCIAS');
  console.log('='.repeat(80));
  
  if (reports.length === 0) {
    console.log('\n✅ No se encontraron discrepancias. Todos los valores son consistentes.');
  } else {
    console.log(`\n⚠️  Se encontraron ${reports.length} KPIs con discrepancias:\n`);
    
    for (const report of reports) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`KPI: ${report.kpiName} (ID: ${report.kpiId}, Empresa: ${report.companyId}, Área: ${report.area})`);
      console.log(`${'─'.repeat(80)}`);
      
      if (!report.discrepancies.latestValue?.match) {
        console.log('❌ DISCREPANCIA EN ÚLTIMO VALOR:');
        console.log(`   Overview: ${report.discrepancies.latestValue?.overview || 'null'}`);
        console.log(`   Detalle:  ${report.discrepancies.latestValue?.detail || 'null'}`);
        console.log(`   BD:       ${report.discrepancies.latestValue?.database || 'null'}`);
      }
      
      if (!report.discrepancies.status?.match) {
        console.log('❌ DISCREPANCIA EN STATUS:');
        console.log(`   Overview:  ${report.discrepancies.status?.overview}`);
        console.log(`   Calculado: ${report.discrepancies.status?.calculated}`);
        console.log(`   BD:        ${report.discrepancies.status?.database || 'null'}`);
      }
      
      if (report.discrepancies.target?.used === 'both') {
        console.log('⚠️  AMBOS TARGET Y GOAL DEFINIDOS:');
        console.log(`   Target: ${report.discrepancies.target?.target}`);
        console.log(`   Goal:   ${report.discrepancies.target?.goal}`);
      }
      
      if (!report.discrepancies.compliance?.match) {
        console.log('❌ DISCREPANCIA EN COMPLIANCE:');
        console.log(`   Calculado: ${report.discrepancies.compliance?.calculated || 'null'}`);
        console.log(`   BD:        ${report.discrepancies.compliance?.database || 'null'}`);
      }
    }
    
    // Resumen estadístico
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RESUMEN ESTADÍSTICO');
    console.log('='.repeat(80));
    
    const valueDiscrepancies = reports.filter(r => !r.discrepancies.latestValue?.match).length;
    const statusDiscrepancies = reports.filter(r => !r.discrepancies.status?.match).length;
    const targetGoalIssues = reports.filter(r => r.discrepancies.target?.used === 'both').length;
    const complianceDiscrepancies = reports.filter(r => !r.discrepancies.compliance?.match).length;
    
    console.log(`\nDiscrepancias en último valor: ${valueDiscrepancies}`);
    console.log(`Discrepancias en status: ${statusDiscrepancies}`);
    console.log(`KPIs con ambos target y goal: ${targetGoalIssues}`);
    console.log(`Discrepancias en compliance: ${complianceDiscrepancies}`);
  }
  
  // Guardar reporte en archivo JSON
  const fs = await import('fs/promises');
  const reportPath = 'scripts/kpi-discrepancies-report.json';
  await fs.writeFile(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\n💾 Reporte completo guardado en: ${reportPath}`);
  
  return reports;
}

// Ejecutar auditoría
auditKpiDiscrepancies()
  .then(() => {
    console.log('\n✅ Auditoría completada.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error durante la auditoría:', error);
    process.exit(1);
  });

