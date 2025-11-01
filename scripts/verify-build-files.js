#!/usr/bin/env node

/**
 * Script de verificación de archivos requeridos para el build
 * Detecta archivos importados pero no trackeados en git
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Archivos críticos que deben estar en git
const criticalFiles = [
  'client/src/components/dashboard/SalesMetricsCards.tsx',
  'client/src/components/dashboard/LogisticsPreview.tsx',
];

// Obtener lista de archivos trackeados en git
function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { 
      cwd: rootDir,
      encoding: 'utf-8'
    });
    return new Set(output.trim().split('\n').filter(Boolean));
  } catch (error) {
    console.error('Error ejecutando git ls-files:', error.message);
    return new Set();
  }
}

// Obtener lista de archivos no trackeados
function getUntrackedFiles() {
  try {
    const output = execSync('git status --porcelain', { 
      cwd: rootDir,
      encoding: 'utf-8'
    });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter(line => line.startsWith('??'))
      .map(line => line.substring(3).trim());
  } catch (error) {
    console.error('Error ejecutando git status:', error.message);
    return [];
  }
}

// Buscar imports de archivos críticos
function findImports() {
  const trackedFiles = getTrackedFiles();
  const imports = [];
  
  try {
    const grepOutput = execSync(
      `grep -r "from '@/components/dashboard/SalesMetricsCards'\\|from '@/components/dashboard/LogisticsPreview'" client/src/ || true`,
      { cwd: rootDir, encoding: 'utf-8' }
    );
    
    if (grepOutput.trim()) {
      grepOutput.trim().split('\n').forEach(line => {
        if (line.includes(':')) {
          const [file] = line.split(':');
          imports.push(file);
        }
      });
    }
  } catch (error) {
    // grep no encontró nada, continuar
  }
  
  return imports;
}

// Verificar archivos críticos
function verifyCriticalFiles() {
  const trackedFiles = getTrackedFiles();
  const untrackedFiles = getUntrackedFiles();
  const missing = [];
  const untracked = [];
  
  criticalFiles.forEach(file => {
    const fullPath = resolve(rootDir, file);
    
    if (!existsSync(fullPath)) {
      console.error(`❌ Archivo no existe: ${file}`);
      missing.push(file);
    } else if (!trackedFiles.has(file)) {
      if (untrackedFiles.includes(file)) {
        console.warn(`⚠️  Archivo no trackeado (untracked): ${file}`);
        untracked.push(file);
      } else {
        console.warn(`⚠️  Archivo modificado pero no committeado: ${file}`);
        untracked.push(file);
      }
    } else {
      console.log(`✅ Archivo trackeado: ${file}`);
    }
  });
  
  return { missing, untracked };
}

// Main
console.log('🔍 Verificando archivos requeridos para el build...\n');

const { missing, untracked } = verifyCriticalFiles();
const imports = findImports();

console.log('\n📊 Resumen:');
console.log(`   - Archivos críticos encontrados: ${criticalFiles.length - missing.length}/${criticalFiles.length}`);
console.log(`   - Archivos no trackeados: ${untracked.length}`);
console.log(`   - Archivos faltantes: ${missing.length}`);
console.log(`   - Archivos que importan estos componentes: ${imports.length}`);

if (untracked.length > 0 || missing.length > 0) {
  console.log('\n❌ PROBLEMAS DETECTADOS:');
  
  if (untracked.length > 0) {
    console.log('\n🔴 Archivos no trackeados (NO se enviarán a Railway):');
    untracked.forEach(file => {
      console.log(`   - ${file}`);
      console.log(`     → Ejecuta: git add ${file}`);
    });
  }
  
  if (missing.length > 0) {
    console.log('\n🔴 Archivos faltantes:');
    missing.forEach(file => {
      console.log(`   - ${file}`);
    });
  }
  
  if (imports.length > 0) {
    console.log('\n📝 Archivos que importan estos componentes:');
    imports.forEach(file => {
      console.log(`   - ${file}`);
    });
  }
  
  console.log('\n💡 Solución:');
  console.log('   1. git add client/src/components/dashboard/SalesMetricsCards.tsx');
  console.log('   2. git add client/src/components/dashboard/LogisticsPreview.tsx');
  console.log('   3. git commit -m "fix: Add missing dashboard components"');
  console.log('   4. git push\n');
  
  process.exit(1);
} else {
  console.log('\n✅ Todos los archivos críticos están trackeados en git.\n');
  process.exit(0);
}






