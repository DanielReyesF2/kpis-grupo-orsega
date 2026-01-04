"""
Invoice Extractor Microservice
Utiliza invoice2data para extraer datos de facturas PDF

Endpoints:
- POST /extract - Recibe PDF y devuelve datos extraídos
- GET /health - Health check
"""

import os
import tempfile
import json
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# invoice2data imports
try:
    from invoice2data import extract_data
    from invoice2data.extract.loader import read_templates
    INVOICE2DATA_AVAILABLE = True
except ImportError:
    INVOICE2DATA_AVAILABLE = False
    print("⚠️ invoice2data no instalado, usando extracción básica")

# Configuración
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
# Railway usa PORT, localmente usa INVOICE_EXTRACTOR_PORT o 5050
PORT = int(os.environ.get("PORT", os.environ.get("INVOICE_EXTRACTOR_PORT", 5050)))

app = FastAPI(
    title="Invoice Extractor API",
    description="Microservicio para extraer datos de facturas usando invoice2data",
    version="1.0.0"
)

# CORS para permitir llamadas desde Node.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cargar templates al iniciar
templates = []
if INVOICE2DATA_AVAILABLE and os.path.exists(TEMPLATES_DIR):
    try:
        templates = read_templates(TEMPLATES_DIR)
        print(f"✅ Cargados {len(templates)} templates personalizados")
    except Exception as e:
        print(f"⚠️ Error cargando templates: {e}")

# También cargar templates built-in de invoice2data
if INVOICE2DATA_AVAILABLE:
    try:
        builtin_templates = read_templates()
        templates.extend(builtin_templates)
        print(f"✅ Total templates disponibles: {len(templates)}")
    except Exception as e:
        print(f"⚠️ Error cargando templates built-in: {e}")


class ExtractionResult(BaseModel):
    success: bool
    supplier_name: Optional[str] = None
    amount: Optional[float] = None
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = None
    tax_id: Optional[str] = None
    vat: Optional[float] = None
    subtotal: Optional[float] = None
    items: Optional[list] = None
    raw_data: Optional[dict] = None
    confidence: float = 0.0
    method: str = "none"
    error: Optional[str] = None


def serialize_value(value):
    """Serializa valores para JSON, incluyendo fechas"""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: serialize_value(v) for k, v in value.items()}
    return value


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "invoice2data_available": INVOICE2DATA_AVAILABLE,
        "templates_loaded": len(templates),
        "version": "1.0.0"
    }


@app.post("/extract", response_model=ExtractionResult)
async def extract_invoice(file: UploadFile = File(...)):
    """
    Extrae datos de una factura PDF

    Proceso:
    1. Guarda el archivo temporalmente
    2. Intenta extraer con invoice2data + templates
    3. Devuelve datos estructurados
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se proporcionó archivo")

    # Verificar que sea PDF
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")

    # Guardar archivo temporalmente
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando archivo: {str(e)}")

    result = ExtractionResult(success=False, confidence=0.0, method="none")

    try:
        if INVOICE2DATA_AVAILABLE and templates:
            # Intentar con invoice2data
            print(f"📄 Procesando: {file.filename}")

            extracted = extract_data(tmp_path, templates=templates)

            if extracted:
                print(f"✅ Extracción exitosa con template")

                # Mapear campos de invoice2data a nuestro formato
                result.success = True
                result.method = "invoice2data"
                result.confidence = 0.95  # Alta confianza con template match

                # Campos comunes
                result.supplier_name = extracted.get('issuer') or extracted.get('partner_name')
                result.invoice_number = extracted.get('invoice_number')
                result.currency = extracted.get('currency', 'MXN')
                result.tax_id = extracted.get('vat_number') or extracted.get('rfc')

                # Montos
                if 'amount' in extracted:
                    try:
                        result.amount = float(extracted['amount'])
                    except (ValueError, TypeError):
                        pass

                if 'amount_untaxed' in extracted:
                    try:
                        result.subtotal = float(extracted['amount_untaxed'])
                    except (ValueError, TypeError):
                        pass

                if 'vat' in extracted:
                    try:
                        result.vat = float(extracted['vat'])
                    except (ValueError, TypeError):
                        pass

                # Fechas
                if 'date' in extracted:
                    date_val = extracted['date']
                    if isinstance(date_val, datetime):
                        result.date = date_val.strftime('%Y-%m-%d')
                    elif isinstance(date_val, str):
                        result.date = date_val

                if 'date_due' in extracted:
                    due_val = extracted['date_due']
                    if isinstance(due_val, datetime):
                        result.due_date = due_val.strftime('%Y-%m-%d')
                    elif isinstance(due_val, str):
                        result.due_date = due_val

                # Items/líneas
                if 'lines' in extracted:
                    result.items = serialize_value(extracted['lines'])

                # Raw data para debugging
                result.raw_data = serialize_value(extracted)
            else:
                print(f"⚠️ No se encontró template matching")
                result.success = False
                result.method = "no_match"
                result.error = "No se encontró un template que coincida con esta factura"
        else:
            result.success = False
            result.method = "unavailable"
            result.error = "invoice2data no está disponible o no hay templates"

    except Exception as e:
        print(f"❌ Error en extracción: {str(e)}")
        result.success = False
        result.error = str(e)

    finally:
        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except:
            pass

    return result


@app.get("/templates")
async def list_templates():
    """Lista los templates disponibles"""
    template_info = []
    for t in templates:
        try:
            info = {
                "name": getattr(t, 'name', 'Unknown'),
                "keywords": getattr(t, 'keywords', []),
            }
            template_info.append(info)
        except:
            pass

    return {
        "count": len(templates),
        "templates": template_info[:20]  # Limitar a 20 para no saturar
    }


if __name__ == "__main__":
    print(f"🚀 Iniciando Invoice Extractor en puerto {PORT}")
    print(f"📋 Templates cargados: {len(templates)}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
