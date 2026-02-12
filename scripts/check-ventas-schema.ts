import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const columns = await sql`
    SELECT column_name, data_type, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_name = 'ventas' AND column_name IN ('mes', 'anio', 'fecha')
    ORDER BY ordinal_position
  `;

  console.log('📋 Ventas date columns:');
  columns.forEach((c: any) => {
    console.log(`  - ${c.column_name}: ${c.data_type}, generated=${c.is_generated}, expr=${c.generation_expression || 'N/A'}`);
  });
}

check();
