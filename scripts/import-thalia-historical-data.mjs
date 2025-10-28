import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Datos históricos de Thalía extraídos de las imágenes
// KPI 1: Entregas en tiempo (Cumplimiento de tiempos de entrega)
const deliveryData = [
  // DURA International
  { month: 'Enero 2025', company: 'DURA', total: 6, onTime: 6, late: 0, compliance: 100.00 },
  { month: 'Febrero 2025', company: 'DURA', total: 18, onTime: 17, late: 1, compliance: 94.44 },
  { month: 'Marzo 2025', company: 'DURA', total: 12, onTime: 10, late: 2, compliance: 83.33 },
  { month: 'Abril 2025', company: 'DURA', total: 35, onTime: 31, late: 4, compliance: 88.57 },
  { month: 'Mayo 2025', company: 'DURA', total: 23, onTime: 21, late: 2, compliance: 91.30 },
  { month: 'Junio 2025', company: 'DURA', total: 22, onTime: 18, late: 4, compliance: 81.82 },
  { month: 'Julio 2025', company: 'DURA', total: 47, onTime: 38, late: 9, compliance: 80.85 },
  { month: 'Agosto 2025', company: 'DURA', total: 45, onTime: 41, late: 4, compliance: 91.11 },
  { month: 'Septiembre 2025', company: 'DURA', total: 42, onTime: 31, late: 11, compliance: 73.81 },
  { month: 'Octubre 2025', company: 'DURA', total: 32, onTime: 29, late: 3, compliance: 90.62 },
  
  // ORSEGA
  { month: 'Enero 2025', company: 'ORSEGA', total: 9, onTime: 8, late: 1, compliance: 88.89 },
  { month: 'Febrero 2025', company: 'ORSEGA', total: 5, onTime: 5, late: 0, compliance: 100.00 },
  { month: 'Marzo 2025', company: 'ORSEGA', total: 5, onTime: 4, late: 1, compliance: 80.00 },
  { month: 'Abril 2025', company: 'ORSEGA', total: 5, onTime: 5, late: 0, compliance: 100.00 },
  { month: 'Mayo 2025', company: 'ORSEGA', total: 7, onTime: 5, late: 2, compliance: 71.43 },
  { month: 'Junio 2025', company: 'ORSEGA', total: 8, onTime: 7, late: 1, compliance: 87.50 },
  { month: 'Julio 2025', company: 'ORSEGA', total: 5, onTime: 4, late: 1, compliance: 80.00 },
  { month: 'Agosto 2025', company: 'ORSEGA', total: 8, onTime: 8, late: 0, compliance: 100.00 },
  { month: 'Septiembre 2025', company: 'ORSEGA', total: 11, onTime: 10, late: 1, compliance: 90.91 },
  { month: 'Octubre 2025', company: 'ORSEGA', total: 4, onTime: 4, late: 0, compliance: 100.00 },
];

// Función para determinar el estado según el porcentaje de cumplimiento
function getStatus(compliance) {
  if (compliance >= 90) return 'complies';
  if (compliance >= 70) return 'alert';
  return 'not_compliant';
}

// Función para convertir nombre de mes a fecha
function parseMonthYear(monthYear) {
  const monthMap = {
    'Enero': 0, 'Febrero': 1, 'Marzo': 2, 'Abril': 3,
    'Mayo': 4, 'Junio': 5, 'Julio': 6, 'Agosto': 7,
    'Septiembre': 8, 'Octubre': 9, 'Noviembre': 10, 'Diciembre': 11
  };
  
  const [month, year] = monthYear.split(' ');
  const monthIndex = monthMap[month];
  if (monthIndex === undefined) {
    throw new Error(`Mes no reconocido: ${month}`);
  }
  
  // Usar el primer día del mes a las 12:00 PM
  return new Date(parseInt(year), monthIndex, 1, 12, 0, 0);
}

async function importThaliaData() {
  console.log('🔄 Iniciando importación de datos históricos de Thalía...\n');

  try {
    // 1. Buscar el usuario Thalía
    const usersResult = await sql`
      SELECT id, name, email 
      FROM users 
      WHERE LOWER(name) LIKE '%thalía%' OR LOWER(name) LIKE '%thalia%' OR LOWER(email) LIKE '%thalia%'
    `;
    
    if (usersResult.length === 0) {
      console.log('❌ Usuario Thalía no encontrado. Por favor, verifica que existe en la base de datos.');
      console.log('   Puedes crear el usuario desde la aplicación o ejecutar un script de seeding.');
      process.exit(1);
    }
    
    const thalia = usersResult[0];
    console.log(`✅ Usuario encontrado: ${thalia.name} (ID: ${thalia.id})\n`);

    // 2. Buscar el KPI relacionado con entregas (puede tener diferentes nombres)
    const kpisResult = await sql`
      SELECT k.id, k.name, k.company_id, a.name as area_name
      FROM kpis k
      LEFT JOIN areas a ON k.area_id = a.id
      WHERE (k.name LIKE '%entrega%' OR k.name LIKE '%cumplimiento%')
        AND a.name = 'Logística'
    `;
    
    if (kpisResult.length === 0) {
      console.log('❌ No se encontraron KPIs de logística relacionados con entregas.');
      console.log('   Verificando KPIs de logística existentes...');
      const logisticsKpis = await sql`
        SELECT k.name, k.company_id 
        FROM kpis k
        LEFT JOIN areas a ON k.area_id = a.id
        WHERE a.name = 'Logística'
        LIMIT 10
      `;
      console.log(`   KPIs de logística encontrados: ${logisticsKpis.map(k => k.name).join(', ')}`);
      process.exit(1);
    }

    // 3. Obtener empresas
    const companiesResult = await sql`SELECT id, name FROM companies`;
    const duraCompany = companiesResult.find(c => c.name.includes('Dura') || c.name.includes('DURA'));
    const orsegaCompany = companiesResult.find(c => c.name.includes('Orsega') || c.name.includes('ORSEGA'));
    
    if (!duraCompany || !orsegaCompany) {
      console.log('❌ Empresas no encontradas.');
      console.log(`   Empresas disponibles: ${companiesResult.map(c => c.name).join(', ')}`);
      process.exit(1);
    }

    console.log(`✅ Empresas encontradas:`);
    console.log(`   - ${duraCompany.name} (ID: ${duraCompany.id})`);
    console.log(`   - ${orsegaCompany.name} (ID: ${orsegaCompany.id})\n`);

    // 4. Mapear KPIs por empresa y crear si no existen
    const duraKpi = kpisResult.find(k => k.company_id === duraCompany.id);
    let orsegaKpi = kpisResult.find(k => k.company_id === orsegaCompany.id);

    if (!duraKpi) {
      console.log('❌ No se encontró KPI de entregas para DURA.');
      process.exit(1);
    }

    // Si no existe el KPI para Orsega, lo creamos
    if (!orsegaKpi) {
      console.log('⚠️  No se encontró KPI de entregas para ORSEGA. Creando uno nuevo...');
      
      // Buscar el área de Logística para Orsega
      const logisticsArea = await sql`
        SELECT id FROM areas WHERE name = 'Logística' LIMIT 1
      `;
      
      if (logisticsArea.length === 0) {
        console.log('❌ No se encontró el área de Logística.');
        process.exit(1);
      }

      // Crear el KPI para Orsega basado en el de DURA
      // Usar nombre específico para Orsega si es necesario
      const kpiName = duraKpi.name === 'Tiempo de entrega promedio' 
        ? 'Cumplimiento de tiempos de entrega' 
        : duraKpi.name;
      
      const newKpiResult = await sql`
        INSERT INTO kpis (
          name, description, area_id, company_id, unit, target, frequency, calculation_method, responsible
        ) VALUES (
          ${kpiName}, 
          'Mide el cumplimiento de los tiempos de entrega a clientes',
          ${logisticsArea[0].id},
          ${orsegaCompany.id},
          '%',
          '100%',
          'monthly',
          '(Entregas a tiempo / Total de entregas) x 100',
          'Thalia Rodriguez'
        )
        RETURNING id, name, company_id
      `;
      
      orsegaKpi = newKpiResult[0];
      console.log(`✅ KPI creado para ORSEGA: ${orsegaKpi.name} (ID: ${orsegaKpi.id})`);
    }

    console.log(`✅ KPIs listos:`);
    console.log(`   - DURA: ${duraKpi.name} (ID: ${duraKpi.id})`);
    console.log(`   - ORSEGA: ${orsegaKpi.name} (ID: ${orsegaKpi.id})\n`);

    // 5. Insertar datos históricos
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const data of deliveryData) {
      try {
        const kpiId = data.company === 'DURA' ? duraKpi.id : orsegaKpi.id;
        const date = parseMonthYear(data.month);
        const period = data.month;
        const value = data.compliance.toFixed(2);
        const compliancePercentage = `${data.compliance.toFixed(2)}%`;
        const status = getStatus(data.compliance);
        const comments = `Total: ${data.total} embarques | A tiempo: ${data.onTime} | Tardíos: ${data.late}`;

        // Verificar si ya existe un registro para este período
        const existing = await sql`
          SELECT id 
          FROM kpi_values 
          WHERE kpi_id = ${kpiId} 
            AND user_id = ${thalia.id} 
            AND period = ${period}
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Ya existe registro para ${data.month} - ${data.company}, omitiendo...`);
          skippedCount++;
          continue;
        }

        // Insertar nuevo registro
        await sql`
          INSERT INTO kpi_values (
            kpi_id, user_id, value, date, period, 
            compliance_percentage, status, comments, updated_by
          ) VALUES (
            ${kpiId}, ${thalia.id}, ${value}, ${date}, ${period},
            ${compliancePercentage}, ${status}, ${comments}, ${thalia.id}
          )
        `;

        console.log(`✅ Insertado: ${data.month} - ${data.company} | ${compliancePercentage} cumplimiento (${status})`);
        insertedCount++;
      } catch (error) {
        console.error(`❌ Error insertando ${data.month} - ${data.company}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Resumen de importación:');
    console.log(`   ✅ Insertados: ${insertedCount}`);
    console.log(`   ⏭️  Omitidos (ya existían): ${skippedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📦 Total procesados: ${deliveryData.length}`);

    console.log('\n✅ Importación completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    process.exit(1);
  }
}

importThaliaData();

