# Invoice Extractor Microservice
# Usa invoice2data para extraer datos de facturas PDF

FROM python:3.11-slim

# Instalar dependencias del sistema necesarias para pdf processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    poppler-utils \
    libpoppler-cpp-dev \
    pkg-config \
    tesseract-ocr \
    tesseract-ocr-spa \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements primero para aprovechar cache de Docker
COPY requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Puerto expuesto
EXPOSE 5050

# Variables de entorno
ENV INVOICE_EXTRACTOR_PORT=5050
ENV PYTHONUNBUFFERED=1

# Comando de inicio
CMD ["python", "main.py"]
