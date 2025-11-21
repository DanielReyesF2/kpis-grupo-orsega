import 'dotenv/config';
import { db } from '../server/db';
import { kpisOrsega } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function verifyKpis() {
  try {
    console.log('🔍 Verificando KPIs de la base de datos (Grupo Orsega)...\n');
    
    const kpis = await db.select().from(kpisOrsega).orderBy(kpisOrsega.id);
    
    console.log(`📊 Total de KPIs encontrados: ${kpis.length}\n`);
    console.log('='.repeat(80));
    
    kpis.forEach(kpi => {
      console.log(`\nID: ${kpi.id}`);
      console.log(`Área: ${kpi.area}`);
      console.log(`Nombre KPI: ${kpi.kpiName}`);
      console.log(`Descripción: ${kpi.description || 'Sin descripción'}`);
      console.log(`Método de cálculo: ${kpi.calculationMethod || 'Sin método'}`);
      console.log('-'.repeat(80));
    });
    
    // Agrupar por área
    const byArea = new Map<string, typeof kpis>();
    kpis.forEach(kpi => {
      if (!byArea.has(kpi.area)) {
        byArea.set(kpi.area, []);
      }
      byArea.get(kpi.area)!.push(kpi);
    });
    
    console.log('\n\n📋 RESUMEN POR ÁREA:');
    console.log('='.repeat(80));
    byArea.forEach((areaKpis, area) => {
      console.log(`\n${area}: ${areaKpis.length} KPIs`);
      areaKpis.forEach(kpi => {
        console.log(`  - ${kpi.kpiName} (ID: ${kpi.id})`);
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyKpis();
