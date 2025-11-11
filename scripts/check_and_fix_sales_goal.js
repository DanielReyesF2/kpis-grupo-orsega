/**
 * Script para verificar y corregir el objetivo de ventas de Grupo Orsega
 * 
 * Este script:
 * 1. Verifica el valor actual del campo 'goal' en la tabla kpis_orsega
 * 2. Lo actualiza a 858373 (objetivo trimestral) si es necesario
 * 3. También verifica/actualiza la tabla kpis nueva si existe
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Objetivo TRIMESTRAL para Grupo Orsega
const QUARTERLY_TARGET = 858373; // unidades trimestrales
const ANNUAL_TARGET = QUARTERLY_TARGET * 4; // 3,433,492 unidades anuales

async function checkAndFixSalesGoal() {
  console.log('🔍 Verificando y corrigiendo objetivo de ventas de Grupo Orsega...\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ============================================
    // 1. Verificar tabla antigua kpis_orsega
    // ============================================
    console.log('📊 Verificando tabla kpis_orsega...');
    const orsegaResult = await client.query(`
      SELECT 
        id,
        kpi_name,
        goal,
        unit,
        area,
        frequency
      FROM kpis_orsega 
      WHERE LOWER(kpi_name) LIKE '%ventas%' 
         OR LOWER(kpi_name) LIKE '%volumen%'
      ORDER BY id
    `);
    
    if (orsegaResult.rows.length === 0) {
      console.log('⚠️  No se encontró KPI de ventas en kpis_orsega');
    } else {
      console.log(`✅ Encontrados ${orsegaResult.rows.length} KPI(s) de ventas en kpis_orsega:\n`);
      
      for (const row of orsegaResult.rows) {
        console.log(`   ID: ${row.id}`);
        console.log(`   Nombre: ${row.kpi_name}`);
        console.log(`   Goal actual: ${row.goal || '(vacío/null)'}`);
        console.log(`   Unidad: ${row.unit || '(no especificada)'}`);
        console.log(`   Área: ${row.area || '(no especificada)'}`);
        console.log(`   Frecuencia: ${row.frequency || '(no especificada)'}`);
        
        // Extraer valor numérico del goal actual
        const currentGoalValue = row.goal ? 
          parseFloat(String(row.goal).replace(/[^0-9.-]+/g, '')) : null;
        
        console.log(`   Valor numérico extraído: ${currentGoalValue || 'N/A'}`);
        
        // Actualizar si es necesario
        if (!currentGoalValue || currentGoalValue !== QUARTERLY_TARGET) {
          console.log(`   ⚠️  Valor incorrecto o vacío. Actualizando a ${QUARTERLY_TARGET} (trimestral)...`);
          
          await client.query(
            `UPDATE kpis_orsega 
             SET goal = $1 
             WHERE id = $2`,
            [QUARTERLY_TARGET.toString(), row.id]
          );
          
          console.log(`   ✅ Actualizado correctamente`);
        } else {
          console.log(`   ✅ Valor ya es correcto (${QUARTERLY_TARGET} unidades trimestrales)`);
        }
        console.log('');
      }
    }
    
    // ============================================
    // 2. Verificar tabla nueva kpis
    // ============================================
    console.log('📊 Verificando tabla kpis (nueva)...');
    try {
      const newKpisResult = await client.query(`
        SELECT 
          id,
          name,
          target,
          unit,
          company_id
        FROM kpis 
        WHERE company_id = 2 
          AND (LOWER(name) LIKE '%ventas%' OR LOWER(name) LIKE '%volumen%')
        ORDER BY id
      `);
      
      if (newKpisResult.rows.length === 0) {
        console.log('⚠️  No se encontró KPI de ventas en tabla kpis para company_id = 2\n');
      } else {
        console.log(`✅ Encontrados ${newKpisResult.rows.length} KPI(s) de ventas en tabla kpis:\n`);
        
        for (const row of newKpisResult.rows) {
          console.log(`   ID: ${row.id}`);
          console.log(`   Nombre: ${row.name}`);
          console.log(`   Target actual: ${row.target || '(vacío/null)'}`);
          console.log(`   Unidad: ${row.unit || '(no especificada)'}`);
          console.log(`   Company ID: ${row.company_id}`);
          
          // El target en la tabla nueva puede estar formateado, extraer valor numérico
          const currentTargetValue = row.target ? 
            parseFloat(String(row.target).replace(/[^0-9.-]+/g, '')) : null;
          
          console.log(`   Valor numérico extraído: ${currentTargetValue || 'N/A'}`);
          
          // Nota: En la tabla nueva, el target puede ser anual, trimestral o mensual
          // Vamos a actualizar con el valor trimestral formateado
          const formattedQuarterlyTarget = new Intl.NumberFormat('es-MX').format(QUARTERLY_TARGET);
          const targetString = `${formattedQuarterlyTarget} unidades (trimestral)`;
          
          console.log(`   ℹ️  Nota: En tabla kpis, el target puede ser anual.`);
          console.log(`   ℹ️  Valor trimestral sugerido: ${targetString}`);
          console.log('');
        }
      }
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log('⚠️  La tabla kpis no existe aún (esto es normal si no se ha migrado)\n');
      } else {
        throw err;
      }
    }
    
    // Confirmar transacción
    await client.query('COMMIT');
    console.log('✅ Transacción completada.\n');
    
    // ============================================
    // 3. Resumen de valores correctos
    // ============================================
    console.log('📋 RESUMEN DE VALORES CORRECTOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Objetivo Trimestral: ${QUARTERLY_TARGET.toLocaleString('es-MX')} unidades`);
    console.log(`   Objetivo Anual:      ${ANNUAL_TARGET.toLocaleString('es-MX')} unidades`);
    console.log(`   Objetivo Mensual:    ${Math.round(QUARTERLY_TARGET / 3).toLocaleString('es-MX')} unidades (aproximado)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 IMPORTANTE: El campo "goal" en kpis_orsega debe contener el valor TRIMESTRAL (858373)');
    console.log('   El código debe multiplicar por 4 para obtener el objetivo anual.\n');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al verificar/actualizar metas de ventas:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Ejecutar la función
checkAndFixSalesGoal()
  .then(() => {
    console.log('✅ Script finalizado exitosamente');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error al ejecutar el script:', err);
    process.exit(1);
  });




