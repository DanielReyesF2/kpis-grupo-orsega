import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurado en .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function verifyAnnualGoals() {
  console.log('🔍 Verificando objetivos anuales en la base de datos...\n');

  try {
    // Verificar Dura International
    const duraKpis = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_dura
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
    `;

    // Verificar Grupo Orsega
    const orsegaKpis = await sql`
      SELECT id, kpi_name, goal, annual_goal
      FROM kpis_orsega
      WHERE LOWER(kpi_name) LIKE '%volumen%ventas%' 
         OR LOWER(kpi_name) LIKE '%ventas%volumen%'
    `;

    console.log('📊 Estado actual en la base de datos:\n');
    
    console.log('🏢 Dura International:');
    duraKpis.forEach(kpi => {
      const annualGoal = kpi.annual_goal || '❌ NO CONFIGURADO';
      const expected = '667449';
      const status = annualGoal === expected ? '✅' : '⚠️';
      console.log(`   ${status} ID ${kpi.id}: ${kpi.kpi_name}`);
      console.log(`      Goal mensual: ${kpi.goal}`);
      console.log(`      Annual Goal: ${annualGoal} (esperado: ${expected})`);
      if (annualGoal !== expected && annualGoal !== '❌ NO CONFIGURADO') {
        console.log(`      ⚠️  ADVERTENCIA: El annualGoal no coincide con el esperado`);
      }
      console.log('');
    });

    console.log('🏢 Grupo Orsega:');
    orsegaKpis.forEach(kpi => {
      const annualGoal = kpi.annual_goal || '❌ NO CONFIGURADO';
      const expected = '10300476';
      const status = annualGoal === expected ? '✅' : '⚠️';
      console.log(`   ${status} ID ${kpi.id}: ${kpi.kpi_name}`);
      console.log(`      Goal mensual: ${kpi.goal}`);
      console.log(`      Annual Goal: ${annualGoal} (esperado: ${expected})`);
      if (annualGoal !== expected && annualGoal !== '❌ NO CONFIGURADO') {
        console.log(`      ⚠️  ADVERTENCIA: El annualGoal no coincide con el esperado`);
      }
      console.log('');
    });

    // Verificar si hay problemas
    const orsegaKpi = orsegaKpis[0];
    if (orsegaKpi && orsegaKpi.annual_goal === '10300476') {
      console.log('✅ Los datos están correctos en la base de datos.\n');
      console.log('💡 Si no ves los cambios en localhost:\n');
      console.log('   1. Abre las DevTools del navegador (F12)');
      console.log('   2. Ve a la pestaña "Application" o "Aplicación"');
      console.log('   3. En "Storage" > "Local Storage" > "http://localhost:8080"');
      console.log('   4. Busca y elimina estas claves:');
      console.log('      - orsegaAnnualTarget');
      console.log('      - duraAnnualTarget');
      console.log('      - salesTargets');
      console.log('   5. Recarga la página con Ctrl+Shift+R (o Cmd+Shift+R en Mac)');
      console.log('   6. Verifica en la consola que aparezca:');
      console.log('      "[SalesMetricsCards] ✅ Usando annualGoal del KPI: 10300476"\n');
    } else {
      console.log('⚠️  Los datos NO están correctos. Ejecuta: npx tsx scripts/set-annual-goals-sales.mjs\n');
    }

  } catch (error) {
    console.error('❌ Error al verificar:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyAnnualGoals();

