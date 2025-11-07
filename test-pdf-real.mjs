#!/usr/bin/env node
/**
 * Test REAL del endpoint de subida de PDFs
 * Simula lo que hace el usuario en el navegador
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 TEST REAL - Subir PDF al servidor\n');

async function testPDFUpload() {
  try {
    // 1. Login primero para obtener token
    console.log('1️⃣ Intentando login...');
    const loginResponse = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login falló:', loginResponse.status, loginResponse.statusText);
      console.log('ℹ️  Esto es normal si el usuario admin no existe o tiene otra contraseña');
      console.log('ℹ️  Continuando con test sin autenticación para ver el error...\n');
    }

    let token = null;
    try {
      const loginData = await loginResponse.json();
      token = loginData.token;
      console.log('✅ Login exitoso, token obtenido\n');
    } catch (e) {
      console.log('⚠️  No se pudo obtener token, probando sin auth\n');
    }

    // 2. Subir PDF
    console.log('2️⃣ Subiendo PDF de prueba...');
    const pdfPath = join(__dirname, 'tests', 'test-files', 'factura-ejemplo.pdf');

    // Verificar que el archivo existe
    try {
      const pdfBuffer = readFileSync(pdfPath);
      console.log(`✅ PDF encontrado: ${pdfPath} (${pdfBuffer.length} bytes)\n`);
    } catch (e) {
      console.log(`❌ No se encontró el PDF en: ${pdfPath}`);
      console.log('💡 Asegúrate de que los archivos de test están generados');
      console.log('   Ejecuta: node scripts/generate-test-files.mjs\n');
      return;
    }

    const formData = new FormData();
    formData.append('voucher', readFileSync(pdfPath), {
      filename: 'factura-ejemplo.pdf',
      contentType: 'application/pdf'
    });
    formData.append('payerCompanyId', '1');
    formData.append('notes', 'Test desde script automático');

    const headers = formData.getHeaders();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('📤 Enviando request a /api/payment-vouchers/upload...\n');

    const uploadResponse = await fetch('http://localhost:8080/api/payment-vouchers/upload', {
      method: 'POST',
      headers,
      body: formData
    });

    console.log(`📊 Status: ${uploadResponse.status} ${uploadResponse.statusText}`);

    const responseText = await uploadResponse.text();
    console.log('\n📄 Response body:');
    console.log('═'.repeat(60));

    try {
      const json = JSON.parse(responseText);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(responseText);
    }
    console.log('═'.repeat(60));

    if (uploadResponse.ok) {
      console.log('\n✅ ¡ÉXITO! El PDF se subió correctamente');
      console.log('✅ El fix de pdfjs-dist FUNCIONA');
      return true;
    } else {
      console.log('\n❌ FALLÓ: El PDF no se pudo subir');

      // Analizar el error
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error && errorData.error.includes('ENOENT')) {
          console.log('\n🔴 ERROR CONFIRMADO: Bug de pdf-parse SIGUE PRESENTE');
          console.log('🔴 El fix NO funcionó');
        } else if (errorData.error && errorData.error.includes('Unauthorized')) {
          console.log('\n⚠️  Error de autenticación (esperado sin token válido)');
          console.log('💡 Para test completo, usa credenciales válidas');
        }
      } catch {}

      return false;
    }

  } catch (error) {
    console.error('\n💥 Error ejecutando test:', error.message);
    console.error('\n💡 Asegúrate de que:');
    console.error('   1. El servidor está corriendo (npm run dev)');
    console.error('   2. Los archivos de test están generados');
    console.error('   3. El puerto 8080 está disponible');
    return false;
  }
}

testPDFUpload().then(success => {
  console.log('\n' + '═'.repeat(60));
  if (success) {
    console.log('🎉 RESULTADO: FIX FUNCIONANDO');
  } else {
    console.log('💔 RESULTADO: FIX NO FUNCIONA O ERROR DE AUTENTICACIÓN');
  }
  console.log('═'.repeat(60));
  process.exit(success ? 0 : 1);
});
