import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const sql = neon(process.env.DATABASE_URL);

// Productos desde la imagen proporcionada
const products = [
  // GRUPO ORSEGA (company_id = 2)
  { empresa: 'GRUPO ORSEGA', nombre: 'MONCAT 2021' },
  { empresa: 'GRUPO ORSEGA', nombre: 'MONCAT 1991' },
  { empresa: 'GRUPO ORSEGA', nombre: 'METILATO DE SODIO 25%' },
  { empresa: 'GRUPO ORSEGA', nombre: 'METILATO DE SODIO 30%' },
  
  // DURA INTERNATIONAL (company_id = 1)
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT CALCIO 6%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT CALCIO 10%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT COBALTO 6%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT COBALTO 12%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT COBALTO 21' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DURANAP COBRE 8%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT COBALTO 12% NI' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT DB930' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT CE 12%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DRICAT 2710' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DRICAT CV120' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DRICAT CV320' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DURASTAB LT2' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DURASTAB LT3' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT MANGANESO 6%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT MANGANESO 9%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ESTRONCIO 24%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ZINC 8%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ZINC 16%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ZINC 18%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ZIRCONIO 18%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DUROCT ZIRCONIO 24%' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DURASPERSE 57' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'METIL ETIL CETOXIMA' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DIFOAM W11' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'Diflow S' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'Difoam S66' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'Difoam S52' },
  { empresa: 'DURA INTERNATIONAL', nombre: 'DriCAT Mn 8% NDA HS' },
];

// Mapeo de empresas a company_id
const companyMap = {
  'GRUPO ORSEGA': 2,
  'DURA INTERNATIONAL': 1,
};

async function updateProducts() {
  try {
    console.log('🔄 Iniciando actualización de productos...\n');

    // Obtener productos existentes
    const existingProducts = await sql`
      SELECT id, name, company_id, is_active
      FROM products
    `;

    console.log(`📊 Productos existentes en BD: ${existingProducts.length}`);

    // Crear Set de productos activos del Excel
    const activeProducts = new Set();
    products.forEach(p => {
      const companyId = companyMap[p.empresa];
      const key = `${companyId}|${p.nombre}`;
      activeProducts.add(key);
    });

    // Marcar como inactivos los productos que no están en el Excel
    let deactivatedCount = 0;
    for (const existing of existingProducts) {
      const key = `${existing.company_id}|${existing.name}`;
      if (!activeProducts.has(key) && existing.is_active) {
        await sql`
          UPDATE products 
          SET is_active = false, updated_at = NOW()
          WHERE id = ${existing.id}
        `;
        deactivatedCount++;
        console.log(`  ⚠️  Desactivado: ${existing.name} (${existing.company_id === 1 ? 'Dura' : 'Orsega'})`);
      }
    }

    // Insertar o reactivar productos del Excel
    let insertedCount = 0;
    let reactivatedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const companyId = companyMap[product.empresa];
      
      // Verificar si el producto ya existe
      const existing = existingProducts.find(
        p => p.name === product.nombre && p.company_id === companyId
      );

      if (existing) {
        // Si existe pero está inactivo, reactivarlo
        if (!existing.is_active) {
          await sql`
            UPDATE products 
            SET is_active = true, updated_at = NOW()
            WHERE id = ${existing.id}
          `;
          reactivatedCount++;
          console.log(`  ✅ Reactivado: ${product.nombre} (${product.empresa})`);
        } else {
          skippedCount++;
        }
      } else {
        // Insertar nuevo producto
        await sql`
          INSERT INTO products (name, company_id, is_active, created_at, updated_at)
          VALUES (${product.nombre}, ${companyId}, true, NOW(), NOW())
        `;
        insertedCount++;
        console.log(`  ➕ Insertado: ${product.nombre} (${product.empresa})`);
      }
    }

    console.log('\n📈 Resumen de actualización:');
    console.log(`  ✅ Insertados: ${insertedCount}`);
    console.log(`  🔄 Reactivados: ${reactivatedCount}`);
    console.log(`  ⚠️  Desactivados: ${deactivatedCount}`);
    console.log(`  ⏭️  Sin cambios: ${skippedCount}`);
    console.log(`  📦 Total procesados: ${products.length}`);

    // Verificar resultado final
    const finalProducts = await sql`
      SELECT 
        company_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as activos
      FROM products
      GROUP BY company_id
      ORDER BY company_id
    `;

    console.log('\n📊 Estado final de productos por empresa:');
    finalProducts.forEach(row => {
      const empresa = row.company_id === 1 ? 'DURA INTERNATIONAL' : 'GRUPO ORSEGA';
      console.log(`  ${empresa}: ${row.activos} activos de ${row.total} totales`);
    });

    console.log('\n✅ Actualización completada exitosamente');

  } catch (error) {
    console.error('❌ Error al actualizar productos:', error);
    process.exit(1);
  }
}

updateProducts();

