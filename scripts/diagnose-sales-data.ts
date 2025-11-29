import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function diagnoseSalesData() {
  console.log("🔍 DIAGNÓSTICO DEL MÓDULO DE VENTAS\n");
  console.log("=" .repeat(60));

  try {
    // 1. Verificar que las tablas existen
    console.log("\n📋 1. VERIFICANDO EXISTENCIA DE TABLAS");
    console.log("-".repeat(60));

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('sales_data', 'sales_uploads', 'sales_alerts', 'products')
      ORDER BY table_name
    `;

    console.log("Tablas encontradas:");
    tables.forEach(t => console.log(`  ✓ ${t.table_name}`));

    if (tables.length < 4) {
      console.log("\n⚠️  PROBLEMA: Faltan tablas del módulo de ventas");
      const missing = ['sales_data', 'sales_uploads', 'sales_alerts', 'products']
        .filter(t => !tables.find(found => found.table_name === t));
      console.log("Faltantes:", missing.join(", "));
    }

    // 2. Contar registros en sales_data
    console.log("\n📊 2. CONTEO DE REGISTROS EN SALES_DATA");
    console.log("-".repeat(60));

    const totalCount = await sql`
      SELECT COUNT(*) as count FROM sales_data
    `;
    console.log(`Total de registros: ${totalCount[0].count}`);

    if (parseInt(totalCount[0].count as string) === 0) {
      console.log("\n❌ PROBLEMA ENCONTRADO: La tabla sales_data está VACÍA");
      console.log("   → No hay datos para mostrar en el módulo");
      console.log("   → Necesitas insertar datos de ventas en la tabla");
      return;
    }

    // 3. Verificar distribución por company_id
    console.log("\n🏢 3. DISTRIBUCIÓN POR EMPRESA (company_id)");
    console.log("-".repeat(60));

    const byCompany = await sql`
      SELECT
        company_id,
        COUNT(*) as count,
        MIN(sale_date) as fecha_inicio,
        MAX(sale_date) as fecha_fin
      FROM sales_data
      GROUP BY company_id
      ORDER BY company_id
    `;

    console.log("\nDatos por empresa:");
    byCompany.forEach(row => {
      const companyName = row.company_id === 1 ? "Dura International" :
                         row.company_id === 2 ? "Grupo Orsega" :
                         `Company ${row.company_id}`;
      console.log(`  Company ID ${row.company_id} (${companyName}):`);
      console.log(`    - Registros: ${row.count}`);
      console.log(`    - Rango de fechas: ${row.fecha_inicio} a ${row.fecha_fin}`);
    });

    // 4. Verificar datos del mes actual (noviembre 2025)
    console.log("\n📅 4. DATOS DEL MES ACTUAL (Noviembre 2025)");
    console.log("-".repeat(60));

    const currentMonth = await sql`
      SELECT
        company_id,
        COUNT(*) as count,
        SUM(quantity) as total_quantity,
        COUNT(DISTINCT client_id) as unique_clients
      FROM sales_data
      WHERE sale_year = 2025
        AND sale_month = 11
      GROUP BY company_id
      ORDER BY company_id
    `;

    if (currentMonth.length === 0) {
      console.log("\n⚠️  ADVERTENCIA: NO hay datos para Noviembre 2025");
      console.log("   → El módulo está configurado para mostrar el mes actual");
      console.log("   → Por eso no se ven datos en la interfaz");

      // Mostrar qué meses SÍ tienen datos
      const availableMonths = await sql`
        SELECT DISTINCT sale_year, sale_month, COUNT(*) as count
        FROM sales_data
        GROUP BY sale_year, sale_month
        ORDER BY sale_year DESC, sale_month DESC
        LIMIT 12
      `;

      console.log("\n   Meses con datos disponibles:");
      availableMonths.forEach(m => {
        console.log(`     - ${m.sale_year}-${String(m.sale_month).padStart(2, '0')}: ${m.count} registros`);
      });
    } else {
      console.log("\n✅ Datos encontrados para Noviembre 2025:");
      currentMonth.forEach(row => {
        const companyName = row.company_id === 1 ? "Dura International" : "Grupo Orsega";
        console.log(`  ${companyName}:`);
        console.log(`    - Registros: ${row.count}`);
        console.log(`    - Volumen total: ${row.total_quantity}`);
        console.log(`    - Clientes únicos: ${row.unique_clients}`);
      });
    }

    // 5. Mostrar ejemplos de registros
    console.log("\n📝 5. EJEMPLOS DE REGISTROS (Primeros 5)");
    console.log("-".repeat(60));

    const samples = await sql`
      SELECT
        company_id,
        client_name,
        product_name,
        quantity,
        unit,
        sale_date,
        sale_year,
        sale_month
      FROM sales_data
      ORDER BY sale_date DESC
      LIMIT 5
    `;

    samples.forEach((row, idx) => {
      console.log(`\n  Registro ${idx + 1}:`);
      console.log(`    - Company ID: ${row.company_id}`);
      console.log(`    - Cliente: ${row.client_name}`);
      console.log(`    - Producto: ${row.product_name}`);
      console.log(`    - Cantidad: ${row.quantity} ${row.unit}`);
      console.log(`    - Fecha: ${row.sale_date} (${row.sale_year}-${String(row.sale_month).padStart(2, '0')})`);
    });

    // 6. Verificar alertas
    console.log("\n🚨 6. ALERTAS ACTIVAS");
    console.log("-".repeat(60));

    const alertsCount = await sql`
      SELECT
        company_id,
        alert_type,
        COUNT(*) as count
      FROM sales_alerts
      WHERE is_active = true
      GROUP BY company_id, alert_type
      ORDER BY company_id, alert_type
    `;

    if (alertsCount.length === 0) {
      console.log("No hay alertas activas");
    } else {
      alertsCount.forEach(row => {
        console.log(`  Company ${row.company_id} - ${row.alert_type}: ${row.count} alertas`);
      });
    }

    // 7. Resumen y recomendaciones
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN Y RECOMENDACIONES");
    console.log("=".repeat(60));

    const hasData = parseInt(totalCount[0].count as string) > 0;
    const hasCurrentMonthData = currentMonth.length > 0;

    if (!hasData) {
      console.log("\n❌ PROBLEMA: No hay datos en sales_data");
      console.log("\n🔧 SOLUCIÓN:");
      console.log("   1. Verifica que los datos se hayan insertado correctamente en Neon");
      console.log("   2. Revisa el script de importación de datos");
      console.log("   3. Asegúrate de que company_id sea 1 (Dura) o 2 (Orsega)");
    } else if (!hasCurrentMonthData) {
      console.log("\n⚠️  PROBLEMA: Hay datos, pero NO del mes actual (Nov 2025)");
      console.log("\n🔧 SOLUCIONES POSIBLES:");
      console.log("   OPCIÓN A: Agregar datos de noviembre 2025");
      console.log("   OPCIÓN B: Modificar el frontend para mostrar el mes más reciente disponible");
      console.log("   OPCIÓN C: Agregar selector de mes/año en la interfaz");
    } else {
      console.log("\n✅ TODO OK: Hay datos del mes actual");
      console.log("\n🔍 Si aún no ves datos en la interfaz, verifica:");
      console.log("   1. Que estés logueado con el usuario correcto");
      console.log("   2. La consola del navegador (F12) para errores de API");
      console.log("   3. La pestaña Network para ver si las llamadas a /api/sales-* son exitosas");
      console.log("   4. Que el company_id del usuario coincida con los datos");
    }

    console.log("\n" + "=".repeat(60));

  } catch (error) {
    console.error("\n❌ ERROR durante el diagnóstico:");
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar diagnóstico
diagnoseSalesData()
  .then(() => {
    console.log("\n✅ Diagnóstico completado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error fatal:", error);
    process.exit(1);
  });
