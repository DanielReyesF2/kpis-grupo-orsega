import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurado en .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function setAnnualGoals() {
  console.log('🎯 Estableciendo objetivos anuales para KPIs de ventas...\n');

  try {
    // Objetivos anuales
    const goals = {
      dura: '667449',      // ~55,620 * 12
      orsega: '10300476'   // ~858,373 * 12
    };

    console.log('📊 Objetivos a establecer:');
    console.log(`   - Dura International: ${goals.dura}`);
    console.log(`   - Grupo Orsega: ${goals.orsega}\n`);

    // Buscar KPIs de ventas por nombre
    console.log('🔍 Buscando KPIs de ventas...\n');

    // Dura International - KPI de Volumen de Ventas
    const duraKpis = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_dura
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
      ORDER BY id
    `;

    // Grupo Orsega - KPI de Volumen de Ventas
    const orsegaKpis = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_orsega
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
      ORDER BY id
    `;

    console.log(`📋 KPIs encontrados:`);
    console.log(`   - Dura: ${duraKpis.length} KPI(s)`);
    duraKpis.forEach(kpi => {
      console.log(`     * ID ${kpi.id}: ${kpi.kpi_name} (goal: ${kpi.goal}, annual_goal: ${kpi.annual_goal || 'null'})`);
    });
    console.log(`   - Orsega: ${orsegaKpis.length} KPI(s)`);
    orsegaKpis.forEach(kpi => {
      console.log(`     * ID ${kpi.id}: ${kpi.kpi_name} (goal: ${kpi.goal}, annual_goal: ${kpi.annual_goal || 'null'})`);
    });
    console.log('');

    // Actualizar Dura International
    if (duraKpis.length > 0) {
      for (const kpi of duraKpis) {
        console.log(`→ Actualizando KPI Dura ID ${kpi.id} (${kpi.kpi_name})...`);
        await sql`
          UPDATE kpis_dura
          SET annual_goal = ${goals.dura}
          WHERE id = ${kpi.id}
        `;
        console.log(`  ✅ Objetivo anual establecido: ${goals.dura}\n`);
      }
    } else {
      console.log('⚠️  No se encontró KPI de ventas para Dura International\n');
    }

    // Actualizar Grupo Orsega
    if (orsegaKpis.length > 0) {
      for (const kpi of orsegaKpis) {
        console.log(`→ Actualizando KPI Orsega ID ${kpi.id} (${kpi.kpi_name})...`);
        await sql`
          UPDATE kpis_orsega
          SET annual_goal = ${goals.orsega}
          WHERE id = ${kpi.id}
        `;
        console.log(`  ✅ Objetivo anual establecido: ${goals.orsega}\n`);
      }
    } else {
      console.log('⚠️  No se encontró KPI de ventas para Grupo Orsega\n');
    }

    // Verificar que se actualizaron correctamente
    console.log('🔍 Verificando actualizaciones...\n');
    
    const verifyDura = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_dura
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
    `;
    
    const verifyOrsega = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_orsega
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
    `;

    console.log('✅ Verificación final:');
    verifyDura.forEach(kpi => {
      console.log(`   - Dura ID ${kpi.id}: annual_goal = ${kpi.annual_goal}`);
    });
    verifyOrsega.forEach(kpi => {
      console.log(`   - Orsega ID ${kpi.id}: annual_goal = ${kpi.annual_goal}`);
    });

    console.log('\n✅ Objetivos anuales establecidos exitosamente!');
    console.log('\n📝 Nota: El frontend se actualizará automáticamente al refrescar los datos del KPI.');
    
  } catch (error) {
    console.error('❌ Error al establecer objetivos anuales:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setAnnualGoals();

