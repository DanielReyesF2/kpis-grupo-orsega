#!/usr/bin/env node
/**
 * Script para generar archivos de prueba para tests
 * Genera PDFs, imágenes y Excel de ejemplo
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_FILES_DIR = join(__dirname, '..', 'tests', 'test-files');

// Crear directorio si no existe
if (!existsSync(TEST_FILES_DIR)) {
  mkdirSync(TEST_FILES_DIR, { recursive: true });
}

console.log('📦 Generando archivos de prueba...\n');

// ========================================
// 1. GENERAR PDF DE FACTURA
// ========================================
console.log('📄 Generando factura-ejemplo.pdf...');
const invoicePDF = new jsPDF();

invoicePDF.setFontSize(20);
invoicePDF.text('FACTURA', 105, 20, { align: 'center' });

invoicePDF.setFontSize(12);
invoicePDF.text('Folio: INV-2025-001', 20, 40);
invoicePDF.text('RFC: ABC123456789', 20, 50);
invoicePDF.text('Proveedor: Acme Corporation S.A. de C.V.', 20, 60);
invoicePDF.text('Fecha de Emisión: 2025-01-15', 20, 70);
invoicePDF.text('Fecha de Vencimiento: 2025-02-15', 20, 80);
invoicePDF.text('Monto Total: $5,000.00 MXN', 20, 90);
invoicePDF.text('Moneda: MXN', 20, 100);

invoicePDF.setFontSize(10);
invoicePDF.text('Concepto: Servicios de consultoría', 20, 120);
invoicePDF.text('Método de Pago: Transferencia bancaria', 20, 130);
invoicePDF.text('Folio Fiscal: 3E2C4D5E-6789-1234-ABCD-EF0123456789', 20, 140);

const invoicePDFPath = join(TEST_FILES_DIR, 'factura-ejemplo.pdf');
writeFileSync(invoicePDFPath, Buffer.from(invoicePDF.output('arraybuffer')));
console.log('  ✅ Creado:', invoicePDFPath);

// ========================================
// 2. GENERAR PDF DE COMPROBANTE DE PAGO
// ========================================
console.log('\n📄 Generando comprobante-pago-ejemplo.pdf...');
const voucherPDF = new jsPDF();

voucherPDF.setFontSize(20);
voucherPDF.text('COMPROBANTE DE PAGO', 105, 20, { align: 'center' });

voucherPDF.setFontSize(12);
voucherPDF.text('Transferencia SPEI', 20, 40);
voucherPDF.text('Fecha: 2025-01-15', 20, 50);
voucherPDF.text('Banco: Banco Santander', 20, 60);
voucherPDF.text('CLABE Destino: 014180655000000000', 20, 70);
voucherPDF.text('Monto: $5,000.00 MXN', 20, 80);
voucherPDF.text('Referencia: 7894561230', 20, 90);
voucherPDF.text('Beneficiario: Juan Pérez García', 20, 100);
voucherPDF.text('Clave de Rastreo: 20250115ABC123456789', 20, 110);

const voucherPDFPath = join(TEST_FILES_DIR, 'comprobante-pago-ejemplo.pdf');
writeFileSync(voucherPDFPath, Buffer.from(voucherPDF.output('arraybuffer')));
console.log('  ✅ Creado:', voucherPDFPath);

// ========================================
// 3. GENERAR PDF DE REP (Complemento de Pago)
// ========================================
console.log('\n📄 Generando rep-ejemplo.pdf...');
const repPDF = new jsPDF();

repPDF.setFontSize(20);
repPDF.text('RECIBO ELECTRÓNICO DE PAGO', 105, 20, { align: 'center' });

repPDF.setFontSize(12);
repPDF.text('CFDI Complemento de Pago', 20, 40);
repPDF.text('UUID: 3E2C4D5E-6789-1234-ABCD-EF0123456789', 20, 50);
repPDF.text('UUID Relacionado: 1A2B3C4D-5678-9012-ABCD-EF9876543210', 20, 60);
repPDF.text('Fecha de Pago: 2025-01-15', 20, 70);
repPDF.text('Monto Pagado: $4,500.00 MXN', 20, 80);
repPDF.text('RFC: XYZ987654321', 20, 90);
repPDF.text('Método de Pago: 03 - Transferencia electrónica de fondos', 20, 100);

const repPDFPath = join(TEST_FILES_DIR, 'rep-ejemplo.pdf');
writeFileSync(repPDFPath, Buffer.from(repPDF.output('arraybuffer')));
console.log('  ✅ Creado:', repPDFPath);

// ========================================
// 4. GENERAR PDF INVÁLIDO (para tests de error)
// ========================================
console.log('\n📄 Generando archivo-invalido.pdf...');
const invalidPDFPath = join(TEST_FILES_DIR, 'archivo-invalido.pdf');
writeFileSync(invalidPDFPath, 'Este no es un PDF válido, solo texto plano');
console.log('  ✅ Creado:', invalidPDFPath);

// ========================================
// 5. CREAR README
// ========================================
console.log('\n📄 Creando README.md...');
const readmePath = join(TEST_FILES_DIR, 'README.md');
const readmeContent = `# Archivos de Prueba para Tests

Este directorio contiene archivos de ejemplo para tests automatizados.

## Archivos Disponibles

### PDFs
- **factura-ejemplo.pdf**: Factura CFDI con datos completos
- **comprobante-pago-ejemplo.pdf**: Comprobante de transferencia SPEI
- **rep-ejemplo.pdf**: Recibo Electrónico de Pago (Complemento de Pago CFDI)
- **archivo-invalido.pdf**: Archivo inválido para tests de manejo de errores

## Uso

Estos archivos son usados por:
- Tests unitarios en \`tests/unit/\`
- Tests de integración en \`tests/integration/\`
- Tests E2E en \`tests/e2e/\`

## Regenerar Archivos

Para regenerar estos archivos:

\`\`\`bash
node scripts/generate-test-files.mjs
\`\`\`

## Notas

- Todos los datos en estos archivos son ficticios
- Los RFCs, UUIDs y números de cuenta son ejemplos
- No usar estos archivos en producción
`;

writeFileSync(readmePath, readmeContent);
console.log('  ✅ Creado:', readmePath);

console.log('\n✅ Todos los archivos de prueba generados exitosamente');
console.log('\n📂 Ubicación:', TEST_FILES_DIR);
