import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurado en .env');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function addAnnualGoalColumn() {
  console.log('🔧 Agregando columna annual_goal a las tablas de KPIs...\n');

  try {
    // Ejecutar los ALTER TABLE primero
    console.log('→ Agregando columna a kpis_dura...');
    await sql`ALTER TABLE kpis_dura ADD COLUMN IF NOT EXISTS annual_goal TEXT`;
    console.log('  ✅ kpis_dura completado\n');

    console.log('→ Agregando columna a kpis_orsega...');
    await sql`ALTER TABLE kpis_orsega ADD COLUMN IF NOT EXISTS annual_goal TEXT`;
    console.log('  ✅ kpis_orsega completado\n');

    // Luego agregar los comentarios (pueden fallar si no están soportados, pero no es crítico)
    try {
      console.log('→ Agregando comentarios a las columnas...');
      await sql`COMMENT ON COLUMN kpis_dura.annual_goal IS 'Objetivo anual del KPI (usado principalmente para KPIs de ventas)'`;
      await sql`COMMENT ON COLUMN kpis_orsega.annual_goal IS 'Objetivo anual del KPI (usado principalmente para KPIs de ventas)'`;
      console.log('  ✅ Comentarios agregados\n');
    } catch (commentError) {
      console.log('  ⚠️  No se pudieron agregar comentarios (no crítico):', commentError.message);
    }

    // Verificar que las columnas se agregaron correctamente
    console.log('🔍 Verificando columnas...\n');
    
    const kpisDuraColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kpis_dura' AND column_name = 'annual_goal'
    `;
    
    const kpisOrsegaColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kpis_orsega' AND column_name = 'annual_goal'
    `;

    if (kpisDuraColumns.length > 0 && kpisOrsegaColumns.length > 0) {
      console.log('✅ Éxito: Columna annual_goal agregada a ambas tablas');
      console.log(`   - kpis_dura: ${kpisDuraColumns[0].data_type}`);
      console.log(`   - kpis_orsega: ${kpisOrsegaColumns[0].data_type}\n`);
    } else {
      console.log('⚠️  Advertencia: No se pudo verificar las columnas');
    }

    console.log('✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error al ejecutar la migración:', error.message);
    if (error.code === '42701') {
      console.log('ℹ️  La columna ya existe, esto es normal si se ejecuta múltiples veces.');
    } else {
      process.exit(1);
    }
  }
}

addAnnualGoalColumn();

