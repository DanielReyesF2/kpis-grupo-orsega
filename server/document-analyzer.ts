import OpenAI from "openai";
// @ts-ignore - pdf-parse no tiene tipos exportados correctamente
import pdf from "pdf-parse";

// Interface for document analysis results
export interface DocumentAnalysisResult {
  extractedAmount: number | null;
  extractedDate: Date | null;
  extractedBank: string | null;
  extractedReference: string | null;
  extractedCurrency: string | null;
  ocrConfidence: number; // 0-1
  rawResponse?: string;
}

/**
 * Analiza un documento bancario (comprobante de pago) usando OpenAI Vision
 * @param fileBuffer - Buffer del archivo a analizar
 * @param fileType - Tipo MIME del archivo (application/pdf, image/png, etc.)
 * @returns Datos extraídos del documento
 */
export async function analyzePaymentDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurado");
  }

  const openai = new OpenAI({ apiKey });

  console.log(`🔍 [Document Analyzer] Analizando documento tipo: ${fileType}`);

  try {
    let textContent = '';
    let base64Data = '';
    
    // Manejar PDFs - extraer texto directamente
    if (fileType.includes('pdf')) {
      console.log(`📄 [Document Analyzer] Procesando PDF...`);
      const pdfData = await pdf(fileBuffer);
      textContent = pdfData.text;
      console.log(`📄 [Document Analyzer] Texto extraído del PDF (${textContent.length} caracteres)`);
    } else {
      // Para imágenes, convertir a base64
      base64Data = fileBuffer.toString('base64');
    }
    
    // Determinar el tipo de imagen para OpenAI (solo para imágenes)
    let imageType = 'image/jpeg';
    if (fileType.includes('png')) imageType = 'image/png';
    const dataUrl = base64Data ? `data:${imageType};base64,${base64Data}` : '';

    // Prompt optimizado para extraer información de comprobantes bancarios
    const prompt = `Analiza este comprobante de pago bancario y extrae la siguiente información en formato JSON:

{
  "amount": número del monto total (solo número, sin símbolos de moneda),
  "date": fecha del comprobante en formato ISO 8601 (YYYY-MM-DD),
  "bank": nombre del banco emisor,
  "reference": número de referencia, folio o número de operación,
  "currency": código de moneda (MXN, USD, etc.)
}

Si no puedes encontrar algún dato, usa null para ese campo.
Responde SOLO con el JSON, sin texto adicional.`;

    // Llamar a OpenAI - usar Vision API para imágenes, texto para PDFs
    let response;
    if (fileType.includes('pdf')) {
      // Para PDFs, usar el texto extraído directamente
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nContenido del documento:\n${textContent}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });
    } else {
      // Para imágenes, usar Vision API
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });
    }

    const rawResponse = response.choices[0]?.message?.content || "";
    console.log(`📄 [Document Analyzer] Respuesta de OpenAI:`, rawResponse);

    // Parsear la respuesta JSON
    let parsedData: any;
    try {
      // Intentar extraer JSON del texto (por si hay texto adicional)
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : rawResponse;
      parsedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`❌ [Document Analyzer] Error parseando JSON:`, parseError);
      // Si no se puede parsear JSON, intentar extraer información básica del texto
      const amountMatch = rawResponse.match(/\$?[\d,]+\.?\d*/);
      const bankMatch = rawResponse.match(/(banco|bank|bbva|santander|hsbc|banorte|banamex)/i);
      const referenceMatch = rawResponse.match(/(referencia|ref|folio|no\.?\s*\d+)/i);
      
      return {
        extractedAmount: amountMatch ? parseFloat(amountMatch[0].replace(/[$,]/g, '')) : null,
        extractedDate: null,
        extractedBank: bankMatch ? bankMatch[0] : null,
        extractedReference: referenceMatch ? referenceMatch[0] : null,
        extractedCurrency: 'MXN',
        ocrConfidence: 0.3, // Baja confianza para datos extraídos manualmente
        rawResponse,
      };
    }

    // Procesar y validar los datos extraídos
    const result: DocumentAnalysisResult = {
      extractedAmount: parsedData.amount ? parseFloat(parsedData.amount) : null,
      extractedDate: parsedData.date ? new Date(parsedData.date) : null,
      extractedBank: parsedData.bank || null,
      extractedReference: parsedData.reference || null,
      extractedCurrency: parsedData.currency || null,
      ocrConfidence: calculateConfidence(parsedData),
      rawResponse,
    };

    console.log(`✅ [Document Analyzer] Análisis completado:`, {
      amount: result.extractedAmount,
      bank: result.extractedBank,
      confidence: result.ocrConfidence,
    });

    return result;
  } catch (error) {
    console.error(`❌ [Document Analyzer] Error en análisis:`, error);
    throw new Error(`Error al analizar documento: ${error}`);
  }
}

/**
 * Calcula un score de confianza basado en cuántos campos fueron extraídos exitosamente
 */
function calculateConfidence(data: any): number {
  let fieldsFound = 0;
  let totalFields = 5;

  if (data.amount !== null && data.amount !== undefined) fieldsFound++;
  if (data.date !== null && data.date !== undefined) fieldsFound++;
  if (data.bank !== null && data.bank !== undefined) fieldsFound++;
  if (data.reference !== null && data.reference !== undefined) fieldsFound++;
  if (data.currency !== null && data.currency !== undefined) fieldsFound++;

  return fieldsFound / totalFields;
}
