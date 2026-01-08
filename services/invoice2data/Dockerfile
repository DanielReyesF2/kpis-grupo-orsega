FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5050

RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libpoppler-cpp-dev \
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    ghostscript \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${PORT}

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120 app:app"]