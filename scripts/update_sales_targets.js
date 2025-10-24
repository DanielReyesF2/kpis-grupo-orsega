/**
 * Script para actualizar los objetivos de ventas en la base de datos
 * 
 * Este script actualiza directamente los KPIs de volumen de ventas para cada compañía
 * con los valores de objetivos anuales correctos.
 */

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Valores correctos para las metas anuales
const CORRECT_TARGETS = {
  1: {
    value: 667449,
    unit: 'KG',
    name: 'Dura International'
  },
  2: {
    value: 10300476,
    unit: 'unidades',
    name: 'Grupo Orsega'
  }
};

async function updateSalesTargets() {
  console.log('Iniciando actualización de metas de ventas...');
  
  const client = await pool.connect();
  
  try {
    // Iniciar transacción
    await client.query('BEGIN');
    
    // Para cada compañía, actualizar su meta de ventas
    for (const companyId in CORRECT_TARGETS) {
      const target = CORRECT_TARGETS[companyId];
      const formattedValue = new Intl.NumberFormat('es-MX').format(target.value);
      const targetString = `${formattedValue} ${target.unit}`;
      
      console.log(`Actualizando meta para ${target.name}: ${targetString}`);
      
      // Buscar el KPI de volumen de ventas para esta compañía
      const result = await client.query(
        `SELECT id FROM kpis 
         WHERE name LIKE '%Volumen de ventas%' AND company_id = $1`,
        [companyId]
      );
      
      if (result.rows.length > 0) {
        const kpiId = result.rows[0].id;
        console.log(`KPI encontrado con ID: ${kpiId}`);
        
        // Actualizar el target del KPI
        await client.query(
          `UPDATE kpis SET target = $1 WHERE id = $2`,
          [targetString, kpiId]
        );
        
        console.log(`Meta actualizada correctamente para KPI ID ${kpiId}`);
      } else {
        console.error(`No se encontró KPI de volumen de ventas para compañía ID ${companyId}`);
      }
    }
    
    // Confirmar transacción
    await client.query('COMMIT');
    console.log('Transacción completada. Metas actualizadas correctamente.');
    
    // También calculamos y mostramos las metas mensuales y semanales
    for (const companyId in CORRECT_TARGETS) {
      const target = CORRECT_TARGETS[companyId];
      const monthlyTarget = Math.round(target.value / 12);
      const weeklyTarget = Math.round(target.value / 52);
      
      console.log(`Metas calculadas para ${target.name}:`);
      console.log(`- Anual: ${new Intl.NumberFormat('es-MX').format(target.value)} ${target.unit}`);
      console.log(`- Mensual: ${new Intl.NumberFormat('es-MX').format(monthlyTarget)} ${target.unit}`);
      console.log(`- Semanal: ${new Intl.NumberFormat('es-MX').format(weeklyTarget)} ${target.unit}`);
    }
    
  } catch (err) {
    // Revertir transacción en caso de error
    await client.query('ROLLBACK');
    console.error('Error al actualizar metas de ventas:', err);
  } finally {
    // Liberar cliente
    client.release();
  }
}

// Ejecutar la función
updateSalesTargets().then(() => {
  console.log('Script finalizado');
  process.exit(0);
}).catch(err => {
  console.error('Error al ejecutar el script:', err);
  process.exit(1);
});