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

# Puerto expuesto (Railway asigna dinámicamente via $PORT)
EXPOSE 5050

# Variables de entorno
ENV PYTHONUNBUFFERED=1
# Railway provee PORT automáticamente, fallback a 5050 para desarrollo local
ENV PORT=5050

# Comando de inicio
CMD ["python", "main.py"]
