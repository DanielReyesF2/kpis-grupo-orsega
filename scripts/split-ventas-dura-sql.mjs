#!/usr/bin/env node
/**
 * Script para dividir el SQL grande de ventas_dura en chunks más pequeños
 * que puedan ejecutarse en Neon SQL Editor sin ser truncados
 * 
 * Uso: node scripts/split-ventas-dura-sql.mjs <archivo-sql-original>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const CHUNK_SIZE = 100; // Número de INSERT statements por chunk
const OUTPUT_DIR = path.join(__dirname, '../migrations/ventas_dura_chunks');

// Función para extraer los INSERT statements del SQL
function extractInsertStatements(sqlContent) {
  // Buscar la sección de INSERT statements
  const insertSection = sqlContent.match(/INSERT INTO ventas_dura[^;]+;/gs);
  
  if (!insertSection) {
    throw new Error('No se encontraron INSERT statements en el SQL');
  }
  
  // Extraer todos los VALUES
  const allInserts = [];
  insertSection.forEach(block => {
    // Dividir por líneas que contienen VALUES
    const lines = block.split('\n');
    let currentInsert = null;
    
    for (const line of lines) {
      if (line.trim().startsWith('INSERT INTO ventas_dura')) {
        // Nuevo INSERT statement
        currentInsert = line.trim();
      } else if (line.trim().startsWith('(') && currentInsert) {
        // Agregar VALUES al INSERT actual
        currentInsert += '\n' + line.trim();
        if (line.trim().endsWith('),') || line.trim().endsWith(');')) {
          // Fin del VALUES
          allInserts.push(currentInsert.replace(/,$/, ';'));
          currentInsert = null;
        }
      } else if (currentInsert && line.trim()) {
        currentInsert += '\n' + line.trim();
        if (line.trim().endsWith(');')) {
          allInserts.push(currentInsert);
          currentInsert = null;
        }
      }
    }
  });
  
  return allInserts;
}

// Función para crear el header del SQL (CREATE TABLE, etc.)
function getSQLHeader() {
  return `-- =====================================================
-- DURA INTERNATIONAL - HISTÓRICO DE VENTAS (CHUNK)
-- Base de datos: Neon (PostgreSQL)
-- Generado automáticamente por split-ventas-dura-sql.mjs
-- =====================================================

-- Asegurar que la tabla existe
CREATE TABLE IF NOT EXISTS ventas_dura (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    folio VARCHAR(15),
    cliente VARCHAR(50) NOT NULL,
    producto VARCHAR(30),
    cantidad DECIMAL(12,3),
    precio_unitario DECIMAL(12,4),
    importe DECIMAL(14,2),
    anio SMALLINT,
    mes SMALLINT,
    venta_2024 DECIMAL(14,2),
    venta_2025 DECIMAL(14,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices (solo crear si no existen)
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas_dura(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas_dura(cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas_dura(producto);
CREATE INDEX IF NOT EXISTS idx_ventas_anio_mes ON ventas_dura(anio, mes);
CREATE INDEX IF NOT EXISTS idx_ventas_folio ON ventas_dura(folio);

`;
}

// Función para crear un chunk
function createChunk(inserts, chunkNumber, totalChunks) {
  const header = getSQLHeader();
  const footer = `\n-- =====================================================
-- Chunk ${chunkNumber} de ${totalChunks}
-- Total de registros en este chunk: ${inserts.length}
-- =====================================================
`;
  
  return header + inserts.join('\n\n') + footer;
}

// Función principal
async function splitSQL(inputFile) {
  console.log('📂 Leyendo archivo SQL original...');
  const sqlContent = fs.readFileSync(inputFile, 'utf-8');
  
  console.log('🔍 Extrayendo INSERT statements...');
  const allInserts = extractInsertStatements(sqlContent);
  console.log(`✅ Encontrados ${allInserts.length} INSERT statements`);
  
  // Crear directorio de salida
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Dividir en chunks
  const totalChunks = Math.ceil(allInserts.length / CHUNK_SIZE);
  console.log(`\n📦 Dividiendo en ${totalChunks} chunks de ~${CHUNK_SIZE} registros cada uno...\n`);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, allInserts.length);
    const chunk = allInserts.slice(start, end);
    
    const chunkNumber = i + 1;
    const chunkContent = createChunk(chunk, chunkNumber, totalChunks);
    
    const outputFile = path.join(OUTPUT_DIR, `chunk_${String(chunkNumber).padStart(3, '0')}.sql`);
    fs.writeFileSync(outputFile, chunkContent, 'utf-8');
    
    console.log(`✅ Chunk ${chunkNumber}/${totalChunks}: ${chunk.length} registros → ${outputFile}`);
  }
  
  console.log(`\n✨ ¡Completado! ${totalChunks} archivos creados en: ${OUTPUT_DIR}`);
  console.log(`\n📋 Instrucciones:`);
  console.log(`   1. Ejecuta los chunks en orden (chunk_001.sql, chunk_002.sql, etc.)`);
  console.log(`   2. Cada chunk puede ejecutarse independientemente en Neon SQL Editor`);
  console.log(`   3. Los chunks son idempotentes (puedes ejecutarlos múltiples veces)`);
  console.log(`\n💡 Alternativa: Usa el endpoint /api/sales/upload para subir el Excel directamente`);
}

// Ejecutar
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('❌ Error: Debes proporcionar el archivo SQL original');
  console.error('\nUso: node scripts/split-ventas-dura-sql.mjs <archivo-sql-original>');
  console.error('\nEjemplo:');
  console.error('  node scripts/split-ventas-dura-sql.mjs ventas_dura_completo.sql');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: El archivo "${inputFile}" no existe`);
  process.exit(1);
}

splitSQL(inputFile).catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});



















