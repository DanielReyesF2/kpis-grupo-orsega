import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

// -----------------------------
// Helper para importar pdf-parse
// -----------------------------
async function getPdfParse(): Promise<(buffer: Buffer) => Promise<any>> {
  try {
    const pdfParseModule: any = await import("pdf-parse");
    
    // Intentar diferentes formas de acceso a la función
    if (typeof pdfParseModule === 'function') {
      return pdfParseModule;
    }
    
    if (pdfParseModule.default) {
      if (typeof pdfParseModule.default === 'function') {
        return pdfParseModule.default;
      }
      if (pdfParseModule.default.default && typeof pdfParseModule.default.default === 'function') {
        return pdfParseModule.default.default;
      }
    }
    
    if (pdfParseModule.pdfParse && typeof pdfParseModule.pdfParse === 'function') {
      return pdfParseModule.pdfParse;
    }
    
    // Buscar cualquier propiedad que sea una función
    if (typeof pdfParseModule === 'object' && pdfParseModule !== null) {
      for (const key in pdfParseModule) {
        if (typeof pdfParseModule[key] === 'function') {
          return pdfParseModule[key];
        }
      }
    }
    
    // Si llegamos aquí, intentar usar el módulo directamente
    if (typeof pdfParseModule === 'object' && pdfParseModule !== null) {
      // Algunas versiones exportan un objeto con métodos
      const possibleKeys = ['default', 'pdfParse', 'parse', 'extract'];
      for (const key of possibleKeys) {
        if (pdfParseModule[key] && typeof pdfParseModule[key] === 'function') {
          return pdfParseModule[key];
        }
      }
    }
    
    throw new Error(`pdf-parse no se pudo importar. Tipo del módulo: ${typeof pdfParseModule}, keys: ${Object.keys(pdfParseModule || {}).join(', ')}`);
  } catch (error: any) {
    console.error('❌ [Idrall Processor] Error importando pdf-parse:', error);
    throw new Error(`Error al importar pdf-parse: ${error.message}`);
  }
}

// Interface para un registro de CxP extraído de Idrall
export interface IdrallCxPRecord {
  supplierName: string; // Nombre del proveedor
  amount: number; // Monto
  currency: string; // MXN, USD
  dueDate: Date; // Fecha de vencimiento
  reference: string | null; // Número de factura o referencia
  status: string | null; // Estatus original de Idrall (si está disponible)
  notes: string | null; // Notas adicionales
}

// Interface para el resultado del procesamiento
export interface IdrallProcessingResult {
  records: IdrallCxPRecord[];
  totalRecords: number;
  processedFiles: number;
  errors: string[];
}

/**
 * Procesa archivos PDF o ZIP de Idrall para extraer información de Cuentas por Pagar
 */
export async function processIdrallFiles(
  filePaths: string[],
  companyId: number
): Promise<IdrallProcessingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurado");
  }

  const openai = new OpenAI({ apiKey });
  const records: IdrallCxPRecord[] = [];
  const errors: string[] = [];
  let processedFiles = 0;

  console.log(`📦 [Idrall Processor] Procesando ${filePaths.length} archivo(s) para empresa ${companyId}`);

  for (const filePath of filePaths) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      
      if (fileExt === '.zip') {
        // TODO: Implementar procesamiento de ZIP (por ahora se salta)
        console.log(`⚠️  [Idrall Processor] ZIP no soportado aún: ${path.basename(filePath)}`);
        errors.push(`ZIP no soportado aún: ${path.basename(filePath)}`);
      } else if (fileExt === '.pdf') {
        // Procesar PDF directamente
        console.log(`📄 [Idrall Processor] Procesando PDF: ${path.basename(filePath)}`);
        const pdfRecords = await processPDFFile(fileBuffer, openai, path.basename(filePath));
        records.push(...pdfRecords);
        processedFiles++;
      } else {
        errors.push(`Tipo de archivo no soportado: ${fileExt}`);
      }
    } catch (error: any) {
      errors.push(`Error procesando ${path.basename(filePath)}: ${error.message}`);
      console.error(`❌ [Idrall Processor] Error en ${filePath}:`, error);
    }
  }

  console.log(`✅ [Idrall Processor] Procesamiento completado: ${records.length} registros extraídos, ${errors.length} errores`);

  return {
    records,
    totalRecords: records.length,
    processedFiles,
    errors,
  };
}

/**
 * Procesa un archivo PDF individual para extraer registros de CxP
 */
async function processPDFFile(
  fileBuffer: Buffer,
  openai: OpenAI,
  fileName: string
): Promise<IdrallCxPRecord[]> {
  console.log(`🔍 [Idrall Processor] Analizando PDF: ${fileName}`);

  try {
    // Extraer texto del PDF usando helper
    const pdfParse = await getPdfParse();
    const pdfData = await pdfParse(fileBuffer);
    const textContent = pdfData.text;

    console.log(`📄 [Idrall Processor] Texto extraído (${textContent.length} caracteres)`);

    // Prompt optimizado para extraer información de CxP de Idrall
    const prompt = `Analiza este documento de Cuentas por Pagar (CxP) de Idrall y extrae TODOS los registros de pagos pendientes en formato JSON array.

Para CADA registro de pago, extrae:
{
  "supplierName": "nombre completo del proveedor o beneficiario",
  "amount": número del monto (solo número, sin símbolos de moneda),
  "currency": código de moneda (MXN, USD, etc.),
  "dueDate": fecha de vencimiento en formato ISO 8601 (YYYY-MM-DD),
  "reference": número de factura, folio o referencia del documento,
  "status": estatus del pago si está visible (ej: "pendiente", "vencido", "programado"),
  "notes": cualquier nota o comentario adicional
}

Si el documento contiene múltiples registros, devuelve un array JSON con todos ellos.
Si no puedes encontrar algún dato, usa null para ese campo.
Responde SOLO con el JSON array, sin texto adicional.`;

    // Llamar a OpenAI para extraer información
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nContenido del documento:\n${textContent.substring(0, 15000)}`, // Limitar a 15k caracteres para evitar límites
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const rawResponse = response.choices[0]?.message?.content || "";
    console.log(`📄 [Idrall Processor] Respuesta de OpenAI:`, rawResponse.substring(0, 200));

    // Parsear la respuesta JSON
    let parsedData: any;
    try {
      // Intentar extraer JSON si hay texto adicional
      const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = JSON.parse(rawResponse);
      }
    } catch (parseError) {
      console.error(`❌ [Idrall Processor] Error parseando JSON:`, parseError);
      throw new Error(`No se pudo parsear la respuesta de OpenAI: ${rawResponse}`);
    }

    // Normalizar: asegurar que sea un array
    const recordsArray = Array.isArray(parsedData) ? parsedData : [parsedData];

    // Convertir a IdrallCxPRecord
    const records: IdrallCxPRecord[] = recordsArray
      .map((record: any) => {
        try {
          return {
            supplierName: record.supplierName || record.proveedor || record.supplier || "",
            amount: record.amount ? parseFloat(String(record.amount)) : 0,
            currency: record.currency || "MXN",
            dueDate: record.dueDate ? new Date(record.dueDate) : new Date(),
            reference: record.reference || record.folio || record.factura || null,
            status: record.status || null,
            notes: record.notes || null,
          };
        } catch (error) {
          console.error(`❌ [Idrall Processor] Error procesando registro:`, record, error);
          return null;
        }
      })
      .filter((record): record is IdrallCxPRecord => record !== null && record.supplierName !== "" && record.amount > 0);

    console.log(`✅ [Idrall Processor] ${records.length} registro(s) extraído(s) de ${fileName}`);
    return records;
  } catch (error: any) {
    console.error(`❌ [Idrall Processor] Error procesando PDF ${fileName}:`, error);
    throw error;
  }
}

