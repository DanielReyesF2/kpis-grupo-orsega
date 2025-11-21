/**
 * Script de prueba para validar el endpoint /api/collaborators-performance
 * 
 * Uso:
 * 1. Asegúrate de tener el servidor corriendo
 * 2. Obtén un token JWT válido (desde el login)
 * 3. Ejecuta: tsx scripts/test-collaborators-endpoint.ts
 */

import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // Pega aquí tu token JWT

interface CollaboratorScore {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'regular' | 'critical';
  averageCompliance: number;
  compliantKpis: number;
  alertKpis: number;
  notCompliantKpis: number;
  totalKpis: number;
  lastUpdate: string | null;
  kpis: any[];
}

async function testCollaboratorsEndpoint() {
  console.log('🧪 Probando endpoint /api/collaborators-performance\n');

  if (!AUTH_TOKEN) {
    console.error('❌ Error: AUTH_TOKEN no está configurado');
    console.log('   Por favor, configura la variable de entorno AUTH_TOKEN con tu token JWT');
    console.log('   Ejemplo: AUTH_TOKEN=tu_token_aqui tsx scripts/test-collaborators-endpoint.ts');
    process.exit(1);
  }

  try {
    // Probar sin companyId (todos los colaboradores)
    console.log('📊 Test 1: Obtener todos los colaboradores (sin filtro de empresa)');
    const response1 = await fetch(`${API_BASE_URL}/api/collaborators-performance`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response1.ok) {
      const error = await response1.text();
      console.error(`❌ Error ${response1.status}:`, error);
      return;
    }

    const collaborators1: CollaboratorScore[] = await response1.json();
    console.log(`✅ Respuesta recibida: ${collaborators1.length} colaboradores\n`);

    // Validar estructura de cada colaborador
    console.log('🔍 Validando estructura de datos...\n');
    let allValid = true;

    collaborators1.forEach((collab, index) => {
      console.log(`\n📋 Colaborador ${index + 1}: ${collab.name}`);
      
      // Validar campos requeridos
      const requiredFields = ['name', 'score', 'status', 'averageCompliance', 'compliantKpis', 'alertKpis', 'notCompliantKpis', 'totalKpis', 'lastUpdate', 'kpis'];
      const missingFields = requiredFields.filter(field => !(field in collab));
      
      if (missingFields.length > 0) {
        console.error(`  ❌ Campos faltantes: ${missingFields.join(', ')}`);
        allValid = false;
      } else {
        console.log(`  ✅ Todos los campos requeridos presentes`);
      }

      // Validar score
      if (typeof collab.score !== 'number' || collab.score < 0 || collab.score > 100) {
        console.error(`  ❌ Score inválido: ${collab.score} (debe ser 0-100)`);
        allValid = false;
      } else {
        console.log(`  ✅ Score: ${collab.score}`);
      }

      // Validar status
      const validStatuses = ['excellent', 'good', 'regular', 'critical'];
      if (!validStatuses.includes(collab.status)) {
        console.error(`  ❌ Status inválido: ${collab.status}`);
        allValid = false;
      } else {
        console.log(`  ✅ Status: ${collab.status}`);
      }

      // Validar clasificación según score
      let expectedStatus: string;
      if (collab.score >= 85) expectedStatus = 'excellent';
      else if (collab.score >= 70) expectedStatus = 'good';
      else if (collab.score >= 50) expectedStatus = 'regular';
      else expectedStatus = 'critical';

      if (collab.status !== expectedStatus) {
        console.error(`  ⚠️  Status no coincide con score: esperado ${expectedStatus}, obtenido ${collab.status}`);
        allValid = false;
      } else {
        console.log(`  ✅ Clasificación correcta según score`);
      }

      // Validar métricas
      console.log(`  📊 Métricas:`);
      console.log(`     - Total KPIs: ${collab.totalKpis}`);
      console.log(`     - Cumplidos: ${collab.compliantKpis}`);
      console.log(`     - En Alerta: ${collab.alertKpis}`);
      console.log(`     - No Cumplidos: ${collab.notCompliantKpis}`);
      console.log(`     - Promedio Compliance: ${collab.averageCompliance}%`);
      console.log(`     - Última Actualización: ${collab.lastUpdate || 'N/A'}`);
      console.log(`     - KPIs asociados: ${collab.kpis.length}`);

      // Validar que la suma de KPIs coincida
      const sum = collab.compliantKpis + collab.alertKpis + collab.notCompliantKpis;
      if (sum !== collab.totalKpis) {
        console.error(`  ❌ Suma de KPIs no coincide: ${sum} vs ${collab.totalKpis}`);
        allValid = false;
      } else {
        console.log(`  ✅ Suma de KPIs correcta`);
      }
    });

    // Probar con companyId
    console.log('\n\n📊 Test 2: Obtener colaboradores filtrados por empresa (companyId=2)');
    const response2 = await fetch(`${API_BASE_URL}/api/collaborators-performance?companyId=2`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response2.ok) {
      const collaborators2: CollaboratorScore[] = await response2.json();
      console.log(`✅ Respuesta recibida: ${collaborators2.length} colaboradores para empresa 2`);
    } else {
      const error = await response2.text();
      console.error(`❌ Error ${response2.status}:`, error);
    }

    // Resumen final
    console.log('\n\n' + '='.repeat(60));
    if (allValid) {
      console.log('✅ TODAS LAS VALIDACIONES PASARON');
      console.log(`✅ Endpoint funcionando correctamente`);
      console.log(`✅ Estructura de datos válida`);
      console.log(`✅ Cálculos correctos`);
    } else {
      console.log('❌ ALGUNAS VALIDACIONES FALLARON');
      console.log('   Revisa los errores arriba');
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error al probar endpoint:', error.message);
    console.error(error);
  }
}

// Ejecutar prueba
testCollaboratorsEndpoint();


