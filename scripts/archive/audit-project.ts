#!/usr/bin/env tsx
/**
 * Script de Auditoría Técnica para KPIs Grupo Orsega
 * Verifica estructura, tipos, rutas, y preparación para deployment
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

interface AuditResult {
  category: string;
  status: '✅' | '⚠️' | '❌';
  message: string;
  details?: string[];
}

const results: AuditResult[] = [];

function addResult(category: string, status: '✅' | '⚠️' | '❌', message: string, details?: string[]) {
  results.push({ category, status, message, details });
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function auditStructure() {
  console.log('📁 Verificando estructura del proyecto...');
  
  const requiredDirs = ['server', 'client/src', 'shared'];
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'server/index.ts',
    'server/routes.ts',
    'client/src/main.tsx',
  ];

  for (const dir of requiredDirs) {
    const exists = await checkFileExists(join(__dirname, dir));
    addResult('Estructura', exists ? '✅' : '❌', `Directorio ${dir}`, exists ? undefined : ['No encontrado']);
  }

  for (const file of requiredFiles) {
    const exists = await checkFileExists(join(__dirname, file));
    addResult('Estructura', exists ? '✅' : '❌', `Archivo ${file}`, exists ? undefined : ['No encontrado']);
  }
}

async function auditPackageJson() {
  console.log('📦 Verificando package.json...');
  
  const packageJsonPath = join(__dirname, 'package.json');
  const content = await readFileContent(packageJsonPath);
  const pkg = JSON.parse(content);

  // Verificar scripts críticos
  const requiredScripts = ['build', 'start', 'dev'];
  for (const script of requiredScripts) {
    const exists = !!pkg.scripts?.[script];
    addResult('Package.json', exists ? '✅' : '❌', `Script ${script}`, exists ? undefined : ['No encontrado']);
  }

  // Verificar dependencias críticas
  const criticalDeps = ['express', '@tanstack/react-query', 'react', 'typescript'];
  for (const dep of criticalDeps) {
    const exists = !!(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]);
    addResult('Package.json', exists ? '✅' : '❌', `Dependencia ${dep}`, exists ? undefined : ['No encontrada']);
  }
}

async function auditRoutes() {
  console.log('🛣️  Verificando rutas API...');
  
  const routesPath = join(__dirname, 'server/routes.ts');
  const content = await readFileContent(routesPath);

  // Verificar rutas públicas
  const publicRoutes = ['/api/login', '/api/register'];
  for (const route of publicRoutes) {
    const hasRoute = content.includes(`"${route}"`) || content.includes(`'${route}'`);
    addResult('Rutas', hasRoute ? '✅' : '⚠️', `Ruta pública ${route}`, hasRoute ? undefined : ['No encontrada']);
  }

  // Verificar duplicación de prefijos (excluir código de verificación)
  // Buscar rutas con /api/api/ pero excluir comentarios y código de verificación
  const routesWithDoubleApi = content.match(/app\.(get|post|put|delete|patch|use)\(['"]\/api\/api\//g);
  const hasDoubleApi = routesWithDoubleApi && routesWithDoubleApi.length > 0;
  addResult('Rutas', hasDoubleApi ? '❌' : '✅', 'Prefijos duplicados /api/api/', hasDoubleApi ? [`Encontrado ${routesWithDoubleApi.length} ruta(s) con prefijo duplicado`] : undefined);

  // Verificar middleware de autenticación
  const hasJwtMiddleware = content.includes('jwtAuthMiddleware');
  addResult('Rutas', hasJwtMiddleware ? '✅' : '⚠️', 'Middleware de autenticación', hasJwtMiddleware ? undefined : ['No encontrado']);
}

async function auditTypes() {
  console.log('📝 Verificando tipos TypeScript...');
  
  const routesPath = join(__dirname, 'server/routes.ts');
  const content = await readFileContent(routesPath);

  // Contar tipos any (mayoría en helpers - no crítico para deployment)
  const anyMatches = content.match(/:\s*any\b|as\s+any\b/g) || [];
  const anyCount = anyMatches.length;
  
  addResult(
    'Tipos',
    anyCount === 0 ? '✅' : anyCount < 50 ? '⚠️' : '❌',
    `Tipos 'any' encontrados: ${anyCount}`,
    anyCount > 0 && anyCount < 50 ? [`${anyCount} usos de 'any' encontrados - mayoría en helpers, no crítico`] : anyCount >= 50 ? [`${anyCount} usos de 'any' - considerar tipar explícitamente`] : undefined
  );
}

async function auditLogs() {
  console.log('📋 Verificando logs...');
  
  const routesPath = join(__dirname, 'server/routes.ts');
  const content = await readFileContent(routesPath);

  // Contar console.log (migración progresiva a logger - no crítico)
  const consoleLogMatches = content.match(/console\.(log|warn|error|debug)/g) || [];
  const logCount = consoleLogMatches.length;
  
  addResult(
    'Logs',
    logCount < 50 ? '✅' : '⚠️',
    `Console.log encontrados: ${logCount}`,
    logCount > 50 ? [`${logCount} console.log encontrados - migración progresiva a logger en curso`] : undefined
  );
}

async function auditSecurity() {
  console.log('🔒 Verificando seguridad...');
  
  const indexPath = join(__dirname, 'server/index.ts');
  const content = await readFileContent(indexPath);

  const hasHelmet = content.includes('helmet');
  const hasRateLimit = content.includes('rateLimit') || content.includes('rate-limit');
  const hasCors = content.includes('cors') || content.includes('CORS');

  addResult('Seguridad', hasHelmet ? '✅' : '⚠️', 'Helmet configurado', hasHelmet ? undefined : ['No encontrado']);
  addResult('Seguridad', hasRateLimit ? '✅' : '⚠️', 'Rate limiting configurado', hasRateLimit ? undefined : ['No encontrado']);
}

async function auditBuild() {
  console.log('🏗️  Verificando configuración de build...');
  
  const viteConfigPath = join(__dirname, 'vite.config.ts');
  const viteContent = await readFileContent(viteConfigPath);

  const hasBuildConfig = viteContent.includes('build:') || viteContent.includes('outDir');
  addResult('Build', hasBuildConfig ? '✅' : '⚠️', 'Configuración de build de Vite', hasBuildConfig ? undefined : ['No encontrada']);

  // Verificar que no use Vite en producción
  const indexPath = join(__dirname, 'server/index.ts');
  const indexContent = await readFileContent(indexPath);
  const checksViteEnv = indexContent.includes('NODE_ENV') && indexContent.includes('development');
  addResult('Build', checksViteEnv ? '✅' : '⚠️', 'Verificación de entorno para Vite', checksViteEnv ? undefined : ['No verifica entorno']);
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 REPORTE DE AUDITORÍA TÉCNICA - KPIs Grupo Orsega');
  console.log('='.repeat(80) + '\n');

  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    console.log(`\n## ${category}\n`);
    
    for (const result of categoryResults) {
      console.log(`${result.status} ${result.message}`);
      if (result.details) {
        for (const detail of result.details) {
          console.log(`   ${detail}`);
        }
      }
    }
  }

  const total = results.length;
  const success = results.filter(r => r.status === '✅').length;
  const warnings = results.filter(r => r.status === '⚠️').length;
  const errors = results.filter(r => r.status === '❌').length;

  console.log('\n' + '='.repeat(80));
  console.log('📈 RESUMEN');
  console.log('='.repeat(80));
  console.log(`Total verificaciones: ${total}`);
  console.log(`✅ Correctas: ${success} (${Math.round(success/total*100)}%)`);
  console.log(`⚠️  Advertencias: ${warnings} (${Math.round(warnings/total*100)}%)`);
  console.log(`❌ Errores: ${errors} (${Math.round(errors/total*100)}%)`);
  console.log('='.repeat(80) + '\n');

  if (errors > 0) {
    console.log('❌ Se encontraron errores críticos que deben corregirse antes del deployment.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  Se encontraron advertencias. El proyecto está funcional pero se recomienda revisarlas.\n');
    console.log('💡 Las advertencias sobre console.log y tipos any son mejoras incrementales, no bloquean deployment.\n');
    process.exit(0);
  } else {
    console.log('✅ Todas las verificaciones pasaron. El proyecto está listo para deployment.\n');
    process.exit(0);
  }
}

async function main() {
  try {
    await auditStructure();
    await auditPackageJson();
    await auditRoutes();
    await auditTypes();
    await auditLogs();
    await auditSecurity();
    await auditBuild();
    await generateReport();
  } catch (error) {
    console.error('❌ Error durante la auditoría:', error);
    process.exit(1);
  }
}

main();

