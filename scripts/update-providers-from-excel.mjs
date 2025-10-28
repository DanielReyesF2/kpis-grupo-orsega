import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = neon(process.env.DATABASE_URL);

async function query(text, params) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

async function updateProvidersFromExcel() {
  console.log('📊 Iniciando actualización de proveedores desde Excel...\n');

  const excelPath = join(__dirname, '..', 'attached_assets', 'Directorio proveedores REP.xlsx');
  
  console.log(`📂 Leyendo archivo: ${excelPath}`);

  // Leer el archivo Excel
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const worksheet = workbook.getWorksheet(1); // Primera hoja
  
  if (!worksheet) {
    throw new Error('No se encontró ninguna hoja en el archivo Excel');
  }

  console.log(`📋 Hoja encontrada: "${worksheet.name}"`);

  // Leer los encabezados - buscar en las primeras 3 filas
  let headerRowIndex = 1;
  let headers = [];
  let columnIndices = {};
  let defaultCompanyId = null;

  for (let rowNum = 1; rowNum <= Math.min(3, worksheet.rowCount); rowNum++) {
    const testRow = worksheet.getRow(rowNum);
    const testHeaders = [];
    testRow.eachCell((cell, colNumber) => {
      testHeaders[colNumber] = cell.value?.toString().trim() || '';
    });

    // Mapeo de columnas del Excel a campos de la base de datos
    const columnMap = {
      'PROVEEDOR': 'name',
      'NOMBRE': 'name',
      'SHORT NAME': 'shortName',
      'NOMBRE CORTO': 'shortName',
      'COMPAÑIA': 'company',
      'COMPANIA': 'company',
      'EMPRESA': 'company',
      'UBICACION': 'location',
      'UBICACIÓN': 'location',
      'REP': 'requiresRep',
      'FRECUENCIA': 'repFrequency',
      'FRECUENCIA DE RECORDATORIO': 'repFrequency',
      'EMAIL RECORDATORIO': 'reminderEmail',
      'CORREO RECORDATORIO': 'reminderEmail',
      'EMAIL': 'email',
      'CORREO': 'email',
      'TELEFONO': 'phone',
      'TELÉFONO': 'phone',
      'CONTACTO': 'reminderEmail',
      'CONTACTO (CORREO)': 'reminderEmail',
      'NOTAS': 'notes',
    };

    // Buscar índices de columnas en esta fila
    const testIndices = {};
    Object.keys(testHeaders).forEach((colNumStr) => {
      const colNum = parseInt(colNumStr);
      const header = testHeaders[colNum];
      const normalizedHeader = header.toUpperCase().trim();
      for (const [excelCol, dbField] of Object.entries(columnMap)) {
        if (normalizedHeader.includes(excelCol) || normalizedHeader === excelCol) {
          testIndices[dbField] = colNum; // ExcelJS usa índice base 1
          break;
        }
      }
    });

    // Si encontramos la columna NOMBRE, usamos esta fila como encabezado
      if (testIndices.name) {
        headerRowIndex = rowNum;
        headers = testHeaders;
        columnIndices = testIndices;
        const hintRow = rowNum > 1 ? worksheet.getRow(rowNum - 1) : null;
        if (hintRow) {
          const hintLabel = normalizeHeaderLabel(hintRow.getCell(testIndices.location || 2)?.value);
          if (hintLabel === 'DURA' || hintLabel === 'DURA INTERNATIONAL') {
            defaultCompanyId = 1;
          } else if (hintLabel === 'GRUPO ORSEGA' || hintLabel === 'ORSEGA') {
            defaultCompanyId = 2;
          }
        }
        break;
      }
  }

  console.log(`📌 Encabezados encontrados en fila ${headerRowIndex}:`, headers.filter(h => h).join(', '));
  console.log('🔍 Columnas mapeadas:', JSON.stringify(columnIndices, null, 2));
  console.log('');

  if (!columnIndices.name) {
    throw new Error('No se encontró la columna NOMBRE en el Excel. Por favor verifica que el archivo tenga los encabezados correctos.');
  }

  // Mapeo de nombres de empresas a IDs
  const companyMap = {
    'DURA': 1,
    'DURA INTERNATIONAL': 1,
    'GRUPO ORSEGA': 2,
    'ORSEGA': 2,
  };

  // Procesar cada fila (empezando desde la fila 2, ya que la 1 es el encabezado)
  let processed = 0;
  let updated = 0;
  let inserted = 0;
  let duplicatesMerged = 0;
  let errors = 0;

  let currentCompanyId = defaultCompanyId;

  // Procesar todas las filas de manera asíncrona
  for (let rowNumber = headerRowIndex + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    try {
      const row = worksheet.getRow(rowNumber);
      const labelCell = normalizeHeaderLabel(row.getCell(columnIndices.location || 2)?.value);

      if (labelCell === 'DURA' || labelCell === 'DURA INTERNATIONAL') {
        currentCompanyId = 1;
        continue;
      }

      if (labelCell === 'GRUPO ORSEGA' || labelCell === 'ORSEGA') {
        currentCompanyId = 2;
        continue;
      }

      if (labelCell === 'UBICACION' || labelCell === 'UBICACIÓN') {
        // Segunda cabecera encontrada dentro de la misma hoja
        continue;
      }
      
      // Obtener valores de las celdas
      const getCellValue = (field) => {
        const colIndex = columnIndices[field];
        if (!colIndex) return null;
        const cell = row.getCell(colIndex);
        return cell?.value?.toString().trim() || null;
      };

      const name = getCellValue('name');
      if (!name) {
        console.log(`⚠️  Fila ${rowNumber}: Sin nombre, saltando...`);
        continue;
      }

      const companyName = getCellValue('company') || '';
      const companyId = findCompanyId(companyName, companyMap) ?? currentCompanyId;

      const reminderEmail = getCellValue('reminderEmail');
      const email = getCellValue('email') || reminderEmail;

      const providerData = {
        name,
        shortName: getCellValue('shortName'),
        companyId,
        location: normalizeLocation(getCellValue('location') || ''),
        requiresRep: normalizeBoolean(getCellValue('requiresRep') || ''),
        repFrequency: normalizeNumber(getCellValue('repFrequency') || ''),
        reminderEmail,
        email,
        phone: getCellValue('phone'),
        contactName: getCellValue('contactName'),
        notes: getCellValue('notes'),
      };

      processed++;
      
      // Verificar si el proveedor ya existe (y manejar duplicados por nombre)
      const { provider: existingProvider, duplicateCount } = await findExistingProvider(name, companyId);

      if (existingProvider) {
        // Si el Excel no trae companyId reutilizamos el existente
        providerData.companyId = providerData.companyId ?? existingProvider.company_id ?? null;

        await updateProvider(existingProvider.id, providerData);
        updated++;

        if (duplicateCount > 1) {
          duplicatesMerged += duplicateCount - 1;
          console.warn(`⚠️  [Fila ${rowNumber}] Encontrados ${duplicateCount} registros activos para "${name}". Actualizando id ${existingProvider.id} y dejando pendiente consolidación manual de los restantes.`);
        } else {
          console.log(`✅ [Fila ${rowNumber}] Actualizado: ${name} (${companyName || resolveCompanyLabel(providerData.companyId) || 'Sin empresa'})`);
        }
      } else {
        // Insertar nuevo proveedor
        await insertProvider(providerData);
        inserted++;
        console.log(`➕ [Fila ${rowNumber}] Insertado: ${name} (${companyName || resolveCompanyLabel(providerData.companyId) || 'Sin empresa'})`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ [Fila ${rowNumber}] Error:`, error.message);
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   📝 Filas procesadas: ${processed}`);
  console.log(`   ✏️  Proveedores actualizados: ${updated}`);
  console.log(`   ➕ Proveedores insertados: ${inserted}`);
      console.log(`   🔁 Registros duplicados detectados: ${duplicatesMerged}`);
      console.log(`   ❌ Errores: ${errors}`);
}

function normalizeHeaderLabel(value) {
  if (!value) return '';
  const raw = typeof value === 'object' && value.text ? value.text : value.toString();
  return raw
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function findCompanyId(companyName, companyMap) {
  if (!companyName) return null;
  const normalized = companyName.toUpperCase().trim();
  for (const [key, id] of Object.entries(companyMap)) {
    if (normalized.includes(key)) {
      return id;
    }
  }
  return null;
}

function normalizeLocation(location) {
  if (!location) return null;
  const normalized = location.toUpperCase().trim();
  if (normalized.includes('NAC') || normalized.includes('NACIONAL')) return 'NAC';
  if (normalized.includes('EXT') || normalized.includes('EXTERIOR')) return 'EXT';
  return null;
}

function normalizeBoolean(value) {
  if (!value) return false;
  const normalized = value.toUpperCase().trim();
  return normalized === 'SI' || normalized === 'YES' || normalized === 'TRUE' || normalized === '1';
}

function normalizeNumber(value) {
  if (!value) return null;
  const num = parseInt(value.toString().trim());
  return isNaN(num) ? null : num;
}

function resolveCompanyLabel(companyId) {
  if (!companyId) return null;
  return companyId === 1 ? 'Dura' : companyId === 2 ? 'Orsega' : `Empresa ${companyId}`;
}

async function findExistingProvider(name, companyId) {
  try {
    let matchedProvider = null;
    let duplicates = [];

    if (companyId) {
      const result = await query(
        `SELECT id, company_id 
         FROM provider 
         WHERE LOWER(name) = LOWER($1) AND company_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [name, companyId]
      );
      if (result.length > 0) {
        matchedProvider = result[0];
      }
    }

    if (!matchedProvider) {
      duplicates = await query(
        `SELECT id, company_id 
         FROM provider 
         WHERE LOWER(name) = LOWER($1) AND is_active = TRUE
         ORDER BY (company_id IS NULL), updated_at DESC
         LIMIT 5`,
        [name]
      );

      if (duplicates.length > 0) {
        matchedProvider = duplicates.find((row) => row.company_id !== null) || duplicates[0];
      }
    }

    return {
      provider: matchedProvider,
      duplicateCount: duplicates.length || (matchedProvider ? 1 : 0),
    };
  } catch (error) {
    console.error('Error finding provider:', error);
    return { provider: null, duplicateCount: 0 };
  }
}

async function updateProvider(id, data) {
  try {
    await query(
      `UPDATE provider 
       SET short_name = $1,
           company_id = $2,
           location = $3,
           requires_rep = $4,
           rep_frequency = $5,
           reminder_email = $6,
           email = COALESCE($7, email),
           phone = COALESCE($8, phone),
           contact_name = COALESCE($9, contact_name),
           notes = COALESCE($10, notes),
           updated_at = NOW()
       WHERE id = $11`,
      [
        data.shortName,
        data.companyId,
        data.location,
        data.requiresRep,
        data.repFrequency,
        data.reminderEmail,
        data.email,
        data.phone,
        data.contactName,
        data.notes,
        id
      ]
    );
  } catch (error) {
    console.error('Error updating provider:', error);
    throw error;
  }
}

async function insertProvider(data) {
  try {
    await query(
      `INSERT INTO provider (id, name, short_name, company_id, location, requires_rep, rep_frequency, reminder_email, email, phone, contact_name, notes, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)`,
      [
        data.name,
        data.shortName,
        data.companyId,
        data.location,
        data.requiresRep,
        data.repFrequency,
        data.reminderEmail,
        data.email,
        data.phone,
        data.contactName,
        data.notes
      ]
    );
  } catch (error) {
    console.error('Error inserting provider:', error);
    throw error;
  }
}

// Ejecutar el script
updateProvidersFromExcel()
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
