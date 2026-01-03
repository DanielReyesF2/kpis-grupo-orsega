# Invoice Extractor Microservice

Microservicio Python que usa [invoice2data](https://github.com/invoice-x/invoice2data) para extraer datos de facturas PDF.

## Instalación Rápida

### Opción 1: Docker (Recomendado)

```bash
cd services/invoice-extractor
docker-compose up -d
```

### Opción 2: Local (Desarrollo)

```bash
cd services/invoice-extractor

# Instalar dependencias del sistema (Ubuntu/Debian)
sudo apt-get install poppler-utils tesseract-ocr tesseract-ocr-spa

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias Python
pip install -r requirements.txt

# Ejecutar servicio
python main.py
```

## Uso

El servicio expone los siguientes endpoints:

### Health Check
```bash
curl http://localhost:5050/health
```

### Extraer datos de factura
```bash
curl -X POST http://localhost:5050/extract \
  -F "file=@factura.pdf"
```

### Listar templates disponibles
```bash
curl http://localhost:5050/templates
```

## Agregar Templates Personalizados

Crea archivos YAML en la carpeta `templates/` siguiendo el formato de invoice2data:

```yaml
issuer: Mi Proveedor SA
keywords:
  - mi proveedor
  - factura xyz

fields:
  amount:
    parser: regex
    regex: Total[\s:$]*\$?\s*([\d,]+\.?\d*)
    group: 1
    type: float

  invoice_number:
    parser: regex
    regex: Factura[\s:]+([A-Z0-9\-]+)
    group: 1

options:
  currency: MXN
  date_formats:
    - "%d/%m/%Y"
```

## Integración con Node.js

El servicio se integra automáticamente con `document-analyzer.ts`. Configura la URL con:

```bash
export INVOICE2DATA_URL=http://localhost:5050
```

## Arquitectura

```
PDF → invoice2data → Templates YAML → JSON estructurado
                 ↓
          Tesseract OCR (si es necesario)
```

## Templates Incluidos

- `cfdi_generic.yml` - Facturas CFDI mexicanas
- `servicios_publicos.yml` - CFE, Telmex, Izzi, etc.
- `internacional_usd.yml` - Facturas en USD
