/**
 * Tests unitarios para document-analyzer.ts
 * Prueba la extracción de texto de PDFs y análisis con OpenAI
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzePaymentDocument } from '../../server/document-analyzer';

// Mock de OpenAI para no hacer llamadas reales en tests
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  documentType: 'invoice',
                  amount: 5000,
                  currency: 'MXN',
                  date: '2025-01-15',
                  supplierName: 'Acme Corporation S.A. de C.V.',
                  dueDate: '2025-02-15',
                  invoiceNumber: 'INV-2025-001',
                  taxId: 'ABC123456789',
                })
              }
            }]
          })
        }
      }
    }))
  };
});

describe('document-analyzer', () => {
  const TEST_FILES_DIR = join(__dirname, '..', 'test-files');

  beforeAll(() => {
    // Configurar variables de entorno necesarias
    process.env.OPENAI_API_KEY = 'sk-test-mock-key';
  });

  describe('analyzePaymentDocument', () => {
    it('debe analizar una factura PDF correctamente', async () => {
      const pdfPath = join(TEST_FILES_DIR, 'factura-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      const result = await analyzePaymentDocument(pdfBuffer, 'application/pdf');

      // Verificar que se detectó como factura
      expect(result.documentType).toBe('invoice');

      // Verificar que extrajo datos básicos
      expect(result.extractedAmount).toBe(5000);
      expect(result.extractedCurrency).toBe('MXN');
      expect(result.extractedSupplierName).toBe('Acme Corporation S.A. de C.V.');
      expect(result.extractedInvoiceNumber).toBe('INV-2025-001');
      expect(result.extractedTaxId).toBe('ABC123456789');

      // Verificar fechas
      expect(result.extractedDate).toBeInstanceOf(Date);
      expect(result.extractedDueDate).toBeInstanceOf(Date);

      // Verificar confianza
      expect(result.ocrConfidence).toBeGreaterThan(0);
      expect(result.ocrConfidence).toBeLessThanOrEqual(1);
    }, 30000); // Timeout de 30 segundos para dar tiempo a procesar PDF

    it('debe analizar un comprobante de pago PDF correctamente', async () => {
      // Mock específico para voucher
      const mockOpenAI = require('openai').default;
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    documentType: 'voucher',
                    amount: 5000,
                    currency: 'MXN',
                    date: '2025-01-15',
                    bank: 'Banco Santander',
                    reference: '7894561230',
                    destinationAccount: '014180655000000000',
                    trackingKey: '20250115ABC123456789',
                    beneficiaryName: 'Juan Pérez García',
                  })
                }
              }]
            })
          }
        }
      }));

      const pdfPath = join(TEST_FILES_DIR, 'comprobante-pago-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      const result = await analyzePaymentDocument(pdfBuffer, 'application/pdf');

      expect(result.documentType).toBe('voucher');
      expect(result.extractedAmount).toBe(5000);
      expect(result.extractedBank).toBe('Banco Santander');
      expect(result.extractedReference).toBe('7894561230');
      expect(result.extractedDestinationAccount).toBe('014180655000000000');
      expect(result.extractedTrackingKey).toBe('20250115ABC123456789');
      expect(result.extractedBeneficiaryName).toBe('Juan Pérez García');
    }, 30000);

    it('debe analizar un REP PDF correctamente', async () => {
      // Mock específico para REP
      const mockOpenAI = require('openai').default;
      mockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    documentType: 'rep',
                    amount: 4500,
                    currency: 'MXN',
                    date: '2025-01-15',
                    taxId: 'XYZ987654321',
                    relatedInvoiceUUID: '1A2B3C4D-5678-9012-ABCD-EF9876543210',
                    paymentMethod: '03 - Transferencia electrónica de fondos',
                  })
                }
              }]
            })
          }
        }
      }));

      const pdfPath = join(TEST_FILES_DIR, 'rep-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      const result = await analyzePaymentDocument(pdfBuffer, 'application/pdf');

      expect(result.documentType).toBe('rep');
      expect(result.extractedAmount).toBe(4500);
      expect(result.relatedInvoiceUUID).toBe('1A2B3C4D-5678-9012-ABCD-EF9876543210');
      expect(result.paymentMethod).toBe('03 - Transferencia electrónica de fondos');
    }, 30000);

    it('debe manejar errores cuando falta OPENAI_API_KEY', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const pdfPath = join(TEST_FILES_DIR, 'factura-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      await expect(
        analyzePaymentDocument(pdfBuffer, 'application/pdf')
      ).rejects.toThrow('OPENAI_API_KEY no está configurado');

      process.env.OPENAI_API_KEY = originalKey;
    });

    it('debe manejar archivos PDF inválidos', async () => {
      const invalidPath = join(TEST_FILES_DIR, 'archivo-invalido.pdf');
      const invalidBuffer = readFileSync(invalidPath);

      await expect(
        analyzePaymentDocument(invalidBuffer, 'application/pdf')
      ).rejects.toThrow();
    }, 30000);

    it('debe calcular confianza correctamente para facturas', async () => {
      const pdfPath = join(TEST_FILES_DIR, 'factura-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      const result = await analyzePaymentDocument(pdfBuffer, 'application/pdf');

      // Para facturas con todos los datos críticos, confianza debe ser alta
      expect(result.ocrConfidence).toBeGreaterThan(0.7);
    }, 30000);
  });

  describe('Extracción de texto de PDF', () => {
    it('debe extraer texto de un PDF válido sin errores', async () => {
      const pdfPath = join(TEST_FILES_DIR, 'factura-ejemplo.pdf');
      const pdfBuffer = readFileSync(pdfPath);

      // No debe lanzar el error ENOENT de pdf-parse
      await expect(
        analyzePaymentDocument(pdfBuffer, 'application/pdf')
      ).resolves.not.toThrow(/ENOENT.*test\/data/);
    }, 30000);
  });
});
