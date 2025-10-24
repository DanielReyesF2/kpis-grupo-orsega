"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPaymentDataFromPDF = extractPaymentDataFromPDF;
exports.extractInvoiceDataFromPDF = extractInvoiceDataFromPDF;
exports.extractPaymentDataFromImage = extractPaymentDataFromImage;
exports.comparePaymentData = comparePaymentData;
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
async function extractPaymentDataFromPDF(pdfPath) {
    try {
        // Para PDFs, usamos un enfoque de texto plano ya que OpenAI no acepta PDFs directamente
        // Leer el archivo PDF como base64 para procesar como texto
        const pdfBuffer = fs.readFileSync(pdfPath);
        const base64Pdf = pdfBuffer.toString('base64');
        // Usar OpenAI para extraer datos del PDF como texto
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // el modelo más reciente de OpenAI
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en extraer información de comprobantes de pago y facturas mexicanas. 
          
          Se te enviará un archivo PDF codificado en base64. Analiza el contenido y extrae la siguiente información:
          1. Monto del pago (solo números, sin símbolos)
          2. Fecha de pago (formato YYYY-MM-DD)
          3. Número de factura o folio
          4. Descripción del concepto o servicio
          5. Moneda (MXN, USD, etc.)
          
          Responde ÚNICAMENTE con un JSON válido en este formato:
          {
            "amount": "123456.78",
            "paymentDate": "2024-07-15",
            "invoiceNumber": "FAC-2024-001",
            "description": "Servicios de consultoría",
            "currency": "MXN",
            "confidence": 0.95
          }
          
          Si no puedes extraer algún dato, usa "" (string vacío) para ese campo.
          El confidence debe ser un número entre 0 y 1 que represente qué tan seguro estás de la extracción.`
                },
                {
                    role: "user",
                    content: `Extrae la información de pago de este documento PDF codificado en base64: ${base64Pdf.substring(0, 4000)}...`
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 500
        });
        const extractedData = JSON.parse(response.choices[0].message.content || "{}");
        return {
            amount: extractedData.amount || "",
            paymentDate: extractedData.paymentDate || "",
            invoiceNumber: extractedData.invoiceNumber || "",
            description: extractedData.description || "",
            currency: extractedData.currency || "MXN",
            confidence: extractedData.confidence || 0.5
        };
    }
    catch (error) {
        console.error("Error extracting payment data from PDF:", error);
        throw new Error("No se pudo extraer información del documento PDF");
    }
}
async function extractInvoiceDataFromPDF(pdfPath) {
    try {
        console.log("Procesando factura PDF...");
        // Para PDFs, intentaremos usar la API de texto de OpenAI
        // Leer el PDF como texto plano primero
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfText = pdfBuffer.toString('utf8');
        console.log("Texto del PDF (primeros 200 caracteres):", pdfText.substring(0, 200));
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en extraer información de facturas mexicanas (CFDi). 
          
          BUSCA ESPECÍFICAMENTE estos campos en el texto de la factura:
          
          1. TOTAL/IMPORTE: Busca montos como "Total: $27,840.00" o "Importe: 27840.00"
          2. FECHA: Busca "Fecha de emisión", "Fecha factura" o fechas en formato DD/MM/YYYY
          3. FOLIO: Busca "Folio fiscal", "Número de factura" o códigos alfanuméricos
          4. CONCEPTO: Busca "Concepto", "Descripción" o detalles del servicio
          5. MONEDA: Busca "MXN", "USD", "PESOS" o referencias a moneda
          
          INSTRUCCIONES ESPECÍFICAS:
          - Para el monto: extrae solo números y punto decimal, SIN comas ni símbolos
          - Para la fecha: convierte a formato YYYY-MM-DD
          - Para descripción: usa el concepto completo
          - Para factura: extrae el número o folio principal
          - Para moneda: usa "MXN" como default para facturas mexicanas
          
          Responde ÚNICAMENTE con un JSON válido en este formato:
          {
            "amount": "27840.00",
            "paymentDate": "2025-07-02",
            "invoiceNumber": "28D1",
            "description": "Consultoría sistema gestión",
            "currency": "MXN",
            "confidence": 0.85
          }
          
          Si no puedes extraer algún dato, usa "" (string vacío) para ese campo.
          El confidence debe ser un número entre 0 y 1.`
                },
                {
                    role: "user",
                    content: `Extrae la información de esta factura:\n\n${pdfText.substring(0, 2000)}`
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: 500
        });
        const extractedData = JSON.parse(response.choices[0].message.content || "{}");
        return {
            amount: extractedData.amount || "",
            paymentDate: extractedData.paymentDate || "",
            invoiceNumber: extractedData.invoiceNumber || "",
            description: extractedData.description || "",
            currency: extractedData.currency || "MXN",
            confidence: extractedData.confidence || 0.5
        };
    }
    catch (error) {
        console.error("Error extracting invoice data from PDF:", error);
        throw new Error("No se pudo extraer información de la factura PDF");
    }
}
// Nueva función para extraer datos de imágenes (screenshots, fotos de documentos)
async function extractPaymentDataFromImage(imagePath) {
    try {
        console.log("Iniciando extracción de datos de imagen...");
        // Leer la imagen y convertirla a base64
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        // Detectar el tipo de imagen
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png')
            mimeType = 'image/png';
        else if (ext === '.gif')
            mimeType = 'image/gif';
        else if (ext === '.webp')
            mimeType = 'image/webp';
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [
                {
                    role: "system",
                    content: `Eres un experto en extraer información de comprobantes bancarios mexicanos desde imágenes.
          
          BUSCA ESPECÍFICAMENTE estos campos en el comprobante:
          
          1. IMPORTE/MONTO: Busca cantidades con formato como "$ 27,840.00 MN" o similar
          2. FECHA DE OPERACIÓN: Busca fechas como "02-Jul-2025" o "02/07/2025"
          3. CONCEPTO DE PAGO: Busca el concepto que describe el pago
          4. BENEFICIARIO: Nombre de quien recibe el pago
          5. REFERENCIA: Número de referencia de la operación
          
          INSTRUCCIONES ESPECÍFICAS:
          - Para el monto: extrae solo números y punto decimal, SIN comas ni símbolos
          - Para la fecha: convierte a formato YYYY-MM-DD
          - Para descripción: usa el concepto completo del pago
          - Para factura: busca números de factura en el concepto
          - Para moneda: usa "MXN" para pesos mexicanos
          
          EJEMPLOS DE CONVERSIÓN:
          - "$ 27,840.00 MN" → amount: "27840.00"
          - "02-Jul-2025" → paymentDate: "2025-07-02"
          - "FAC 28D1 CONSULT SISTEMA GESTION" → description: "FAC 28D1 CONSULT SISTEMA GESTION"
          
          Responde ÚNICAMENTE con un JSON válido en este formato:
          {
            "amount": "27840.00",
            "paymentDate": "2025-07-02", 
            "invoiceNumber": "28D1",
            "description": "FAC 28D1 CONSULT SISTEMA GESTION",
            "currency": "MXN",
            "confidence": 0.95
          }
          
          Si no puedes extraer algún dato, usa "" (string vacío) para ese campo.
          El confidence debe ser un número entre 0 y 1.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extrae la información de pago de esta imagen:" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });
        const extractedData = JSON.parse(response.choices[0].message.content || "{}");
        console.log("Datos extraídos de imagen:", extractedData);
        return {
            amount: extractedData.amount || "",
            paymentDate: extractedData.paymentDate || "",
            invoiceNumber: extractedData.invoiceNumber || "",
            description: extractedData.description || "",
            currency: extractedData.currency || "MXN",
            confidence: extractedData.confidence || 0.5
        };
    }
    catch (error) {
        console.error("Error extrayendo datos de imagen:", error);
        throw new Error("No se pudo extraer información de la imagen");
    }
}
// Función para comparar datos entre comprobante y factura
function comparePaymentData(receiptData, invoiceData) {
    const differences = [];
    // Comparar monto
    if (receiptData.amount !== invoiceData.amount) {
        differences.push(`Monto: Comprobante $${receiptData.amount} vs Factura $${invoiceData.amount}`);
    }
    // Comparar número de factura
    if (receiptData.invoiceNumber !== invoiceData.invoiceNumber) {
        differences.push(`Número de factura: Comprobante "${receiptData.invoiceNumber}" vs Factura "${invoiceData.invoiceNumber}"`);
    }
    // Comparar moneda
    if (receiptData.currency !== invoiceData.currency) {
        differences.push(`Moneda: Comprobante ${receiptData.currency} vs Factura ${invoiceData.currency}`);
    }
    // Usar los datos del comprobante como base (generalmente más confiable)
    const matches = differences.length === 0;
    const combinedConfidence = Math.min(receiptData.confidence, invoiceData.confidence);
    return {
        amount: receiptData.amount,
        paymentDate: receiptData.paymentDate,
        invoiceNumber: receiptData.invoiceNumber,
        description: receiptData.description,
        currency: receiptData.currency,
        confidence: combinedConfidence,
        matches,
        differences: differences.length > 0 ? differences : undefined,
        receiptData,
        invoiceData
    };
}
//# sourceMappingURL=pdfExtractor.js.map