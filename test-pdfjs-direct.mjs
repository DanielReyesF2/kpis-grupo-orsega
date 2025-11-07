#!/usr/bin/env node
/**
 * Test directo de pdfjs-dist
 * Verifica si podemos extraer texto de un PDF
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 TEST DIRECTO - pdfjs-dist extraction\n');

async function testPDFJS() {
  try {
    console.log('1️⃣ Importando pdfjs-dist...');
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.js');

    console.log('✅ Importado correctamente\n');

    console.log('2️⃣ Verificando estructura del módulo...');
    console.log('   - pdfjsModule.default:', typeof pdfjsModule.default);
    console.log('   - pdfjsModule.getDocument:', typeof pdfjsModule.getDocument);
    console.log('   - pdfjsModule.default.getDocument:', typeof pdfjsModule.default?.getDocument);
    console.log('');

    const pdfjsLib = pdfjsModule.default || pdfjsModule;

    if (typeof pdfjsLib.getDocument !== 'function') {
      console.log('❌ ERROR: getDocument no es una función');
      console.log('💡 El fix actual en document-analyzer.ts NO FUNCIONA');
      return false;
    }

    console.log('✅ getDocument está disponible\n');

    console.log('3️⃣ Intentando cargar PDF de prueba...');
    const pdfPath = join(__dirname, 'tests', 'test-files', 'factura-ejemplo.pdf');
    const pdfBuffer = readFileSync(pdfPath);

    console.log(`✅ PDF leído: ${pdfBuffer.length} bytes\n`);

    console.log('4️⃣ Intentando extraer texto del PDF...');
    const loadingTask = pdfjsLib.getDocument({data: new Uint8Array(pdfBuffer)});
    const pdf = await loadingTask.promise;

    console.log(`✅ PDF cargado: ${pdf.numPages} páginas\n`);

    console.log('5️⃣ Extrayendo texto de la primera página...');
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');

    console.log(`✅ Texto extraído (${pageText.length} caracteres):\n`);
    console.log('═'.repeat(60));
    console.log(pageText.substring(0, 200) + '...');
    console.log('═'.repeat(60));

    console.log('\n✅ ¡ÉXITO! pdfjs-dist funciona correctamente');
    console.log('✅ El problema debe estar en cómo se importa en document-analyzer.ts');

    return true;

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n📍 Stack trace:');
    console.error(error.stack);

    if (error.message.includes('ENOENT')) {
      console.error('\n🔴 ERROR ENOENT DETECTADO');
      console.error('🔴 Este es el bug que estamos intentando arreglar');
    }

    return false;
  }
}

testPDFJS().then(success => {
  console.log('\n' + '═'.repeat(60));
  if (success) {
    console.log('🎉 RESULTADO: pdfjs-dist FUNCIONA');
    console.log('💡 SIGUIENTE PASO: Verificar import en document-analyzer.ts');
  } else {
    console.log('💔 RESULTADO: pdfjs-dist NO FUNCIONA O MAL CONFIGURADO');
  }
  console.log('═'.repeat(60));
  process.exit(success ? 0 : 1);
});
