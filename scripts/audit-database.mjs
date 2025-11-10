import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2];

if (!DATABASE_URL) {
  console.error('❌ Error: Debes proporcionar DATABASE_URL');
  console.error('Uso: node audit-database.mjs "postgresql://..."');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function auditDatabase() {
  console.log('🔍 AUDITORÍA DE BASE DE DATOS - GRUPO ORSEGA\n');
  console.log('='.repeat(80));

  try {
    // 1. AUDITORÍA DE EMPRESAS
    console.log('\n📊 1. EMPRESAS (Companies)');
    console.log('-'.repeat(80));
    const companies = await sql`SELECT id, name, "createdAt" FROM "Company" ORDER BY id`;
    console.table(companies);

    // 2. AUDITORÍA DE KPIs
    console.log('\n📊 2. KPIs POR EMPRESA');
    console.log('-'.repeat(80));
    const kpis = await sql`
      SELECT
        k.id,
        k.name,
        k.goal,
        k.objective,
        k."companyId",
        c.name as "companyName",
        k."createdAt"
      FROM "Kpi" k
      LEFT JOIN "Company" c ON k."companyId" = c.id
      ORDER BY k."companyId", k.id
    `;
    console.table(kpis);

    // 3. VERIFICAR INCONSISTENCIAS EN GOALS
    console.log('\n⚠️  3. INCONSISTENCIAS EN GOALS/OBJECTIVES');
    console.log('-'.repeat(80));
    const inconsistencies = kpis.filter(k => {
      const goal = parseFloat(k.goal);
      const objective = parseFloat(k.objective);
      return goal !== objective && !isNaN(goal) && !isNaN(objective);
    });

    if (inconsistencies.length > 0) {
      console.log('❌ Se encontraron KPIs con goal ≠ objective:');
      inconsistencies.forEach(k => {
        console.log(`  - KPI ${k.id} "${k.name}" (${k.companyName})`);
        console.log(`    goal: ${k.goal}`);
        console.log(`    objective: ${k.objective}`);
      });
    } else {
      console.log('✅ No hay inconsistencias entre goal y objective');
    }

    // 4. AUDITORÍA ESPECÍFICA: VOLUMEN DE VENTAS ORSEGA
    console.log('\n🎯 4. ANÁLISIS DETALLADO: VOLUMEN DE VENTAS ORSEGA');
    console.log('-'.repeat(80));
    const orsegaSales = await sql`
      SELECT
        k.id,
        k.name,
        k.goal,
        k.objective,
        k."companyId",
        k."createdAt",
        k."updatedAt"
      FROM "Kpi" k
      WHERE k."companyId" = 2
      AND (k.name ILIKE '%volumen%' OR k.name ILIKE '%ventas%')
    `;

    if (orsegaSales.length > 0) {
      console.table(orsegaSales);

      const kpi = orsegaSales[0];
      const goalNum = parseFloat(kpi.goal);
      const expectedGoal = 858373;
      const currentGoal = goalNum;

      console.log('\n📈 CÁLCULO DEL PORCENTAJE:');
      console.log(`  Goal actual en DB: ${currentGoal.toLocaleString()}`);
      console.log(`  Goal esperado: ${expectedGoal.toLocaleString()}`);
      console.log(`  Objetivo anual (goal × 12): ${(currentGoal * 12).toLocaleString()}`);

      if (currentGoal === 55000) {
        console.log(`  ⚠️  PROBLEMA: Goal = 55,000 → Anual = 660,000`);
        console.log(`  📊 Con ventas YTD ~8.5M → Porcentaje = ~1292% ❌`);
        console.log(`  ✅ SOLUCIÓN: Cambiar goal a 858,373 → Anual = 10,300,476`);
        console.log(`  📊 Con ventas YTD ~8.5M → Porcentaje = ~83% ✅`);
      } else if (currentGoal === expectedGoal) {
        console.log('  ✅ Goal está correcto');
      } else {
        console.log(`  ⚠️  Goal inesperado: ${currentGoal.toLocaleString()}`);
      }
    } else {
      console.log('❌ No se encontró KPI de Volumen de Ventas para Orsega');
    }

    // 5. AUDITORÍA DE VALORES DE KPIs (últimos 30 días)
    console.log('\n📊 5. VALORES DE KPIs (Últimos 30 días)');
    console.log('-'.repeat(80));
    const recentValues = await sql`
      SELECT
        kv.id,
        kv."kpiId",
        k.name as "kpiName",
        c.name as "companyName",
        kv.value,
        kv."compliancePercentage",
        kv.date,
        kv."createdAt"
      FROM "KpiValue" kv
      LEFT JOIN "Kpi" k ON kv."kpiId" = k.id
      LEFT JOIN "Company" c ON kv."companyId" = c.id
      WHERE kv.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY kv.date DESC, kv."kpiId"
      LIMIT 50
    `;
    console.table(recentValues);

    // 6. AUDITORÍA DE USUARIOS
    console.log('\n👥 6. USUARIOS Y ROLES');
    console.log('-'.repeat(80));
    const users = await sql`
      SELECT
        id,
        username,
        email,
        role,
        "companyId",
        "createdAt"
      FROM "User"
      ORDER BY id
    `;
    console.table(users);

    // 7. VERIFICAR DUPLICADOS
    console.log('\n🔍 7. VERIFICAR DUPLICADOS');
    console.log('-'.repeat(80));

    const duplicateKpis = await sql`
      SELECT
        name,
        "companyId",
        COUNT(*) as count
      FROM "Kpi"
      GROUP BY name, "companyId"
      HAVING COUNT(*) > 1
    `;

    if (duplicateKpis.length > 0) {
      console.log('❌ KPIs duplicados encontrados:');
      console.table(duplicateKpis);
    } else {
      console.log('✅ No hay KPIs duplicados');
    }

    // 8. ESTADÍSTICAS GENERALES
    console.log('\n📈 8. ESTADÍSTICAS GENERALES');
    console.log('-'.repeat(80));
    const stats = await sql`
      SELECT
        'Companies' as tabla,
        COUNT(*)::int as total
      FROM "Company"
      UNION ALL
      SELECT 'KPIs', COUNT(*)::int FROM "Kpi"
      UNION ALL
      SELECT 'KPI Values', COUNT(*)::int FROM "KpiValue"
      UNION ALL
      SELECT 'Users', COUNT(*)::int FROM "User"
    `;
    console.table(stats);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Auditoría completada\n');

  } catch (error) {
    console.error('\n❌ Error durante la auditoría:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

auditDatabase();
