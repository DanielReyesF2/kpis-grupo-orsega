#!/bin/bash

# Script de deployment para KPIs Grupo Orsega
# Este script prepara la aplicación para deployment en Railway/Heroku

echo "🚀 Preparando aplicación para deployment..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

# Verificar que existe el archivo .env.example
if [ ! -f ".env.example" ]; then
    echo "❌ Error: No se encontró .env.example"
    exit 1
fi

echo "✅ Verificando estructura del proyecto..."

# Verificar que existen los archivos necesarios
required_files=("package.json" "Dockerfile" "railway.json" "Procfile" "drizzle.config.ts")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: No se encontró $file"
        exit 1
    fi
    echo "✅ $file encontrado"
done

echo "🔧 Compilando aplicación..."

# Limpiar builds anteriores
rm -rf dist/

# Compilar la aplicación
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error: Falló la compilación"
    exit 1
fi

echo "✅ Compilación exitosa"

# Verificar que se crearon los archivos de distribución
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: No se generó dist/index.js"
    exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Error: No se generó dist/public/index.html"
    exit 1
fi

echo "✅ Archivos de distribución generados correctamente"

# Verificar variables de entorno
echo "🔐 Verificando configuración de variables de entorno..."

if [ ! -f ".env" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .env"
    echo "📝 Copia .env.example a .env y configura las variables necesarias:"
    echo "   cp .env.example .env"
    echo "   # Luego edita .env con tus valores reales"
fi

echo ""
echo "🎉 ¡Aplicación lista para deployment!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configura las variables de entorno en tu plataforma de deployment"
echo "2. Asegúrate de tener una base de datos PostgreSQL configurada"
echo "3. Configura las claves de API (SendGrid, OpenAI, etc.)"
echo ""
echo "🚀 Para deployar en Railway:"
echo "   railway login"
echo "   railway link"
echo "   railway up"
echo ""
echo "🚀 Para deployar en Heroku:"
echo "   heroku create tu-app-name"
echo "   heroku addons:create heroku-postgresql:hobby-dev"
echo "   git push heroku main"
echo ""
echo "📊 Variables de entorno requeridas:"
echo "   - DATABASE_URL (PostgreSQL connection string)"
echo "   - JWT_SECRET (clave secreta para JWT)"
echo "   - SENDGRID_API_KEY (para emails)"
echo "   - OPENAI_API_KEY (para análisis de documentos)"
echo "   - SESSION_SECRET (para sesiones)"
echo ""
echo "✅ Deployment checklist completado!"