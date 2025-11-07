import 'dotenv/config';
import { pool } from '../server/db';

async function checkStructure() {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'kpi_values_dura' 
    AND column_name IN ('compliance_percentage', 'status', 'value')
    ORDER BY column_name
  `);
  console.log('Estructura de kpi_values_dura:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  const result2 = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'kpi_values_orsega' 
    AND column_name IN ('compliance_percentage', 'status', 'value')
    ORDER BY column_name
  `);
  console.log('\nEstructura de kpi_values_orsega:');
  console.log(JSON.stringify(result2.rows, null, 2));
  
  process.exit(0);
}

checkStructure();

