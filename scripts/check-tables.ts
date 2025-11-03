import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function checkTables() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    // Verificar tablas relacionadas con KPIs
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%kpi%'
      ORDER BY table_name
    `;
    
    console.log('\n📊 Tablas KPI encontradas en la base de datos:');
    console.log('='.repeat(60));
    
    for (const table of tables) {
      // Contar registros en cada tabla usando template literal
      const tableName = table.table_name as string;
      const count = await sql(`SELECT COUNT(*) as count FROM ${tableName}`);
      
      console.log(`\n${tableName}: ${count[0]?.count || 0} registros`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`\nTotal: ${tables.length} tablas relacionadas con KPIs\n`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

checkTables();

