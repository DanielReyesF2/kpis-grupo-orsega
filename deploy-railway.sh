#!/bin/bash

# Script de deployment específico para Railway
# KPIs Grupo Orsega

echo "🚀 Deploying KPIs Grupo Orsega en Railway..."

# Verificar que Railway CLI está disponible
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx no está disponible"
    exit 1
fi

echo "✅ npx disponible"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Ejecuta este script desde la raíz del proyecto."
    exit 1
fi

echo "✅ Estructura del proyecto verificada"

# Verificar que el proyecto está inicializado con Railway
if [ ! -f ".railway" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .railway"
    echo "📝 Ejecuta primero: npx @railway/cli init"
    echo "   Y luego: npx @railway/cli add postgresql"
    exit 1
fi

echo "✅ Proyecto Railway configurado"

# Compilar la aplicación
echo "🔧 Compilando aplicación..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error: Falló la compilación"
    exit 1
fi

echo "✅ Compilación exitosa"

# Verificar archivos de distribución
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: No se generó dist/index.js"
    exit 1
fi

echo "✅ Archivos de distribución listos"

# Mostrar instrucciones para configurar variables de entorno
echo ""
echo "🔐 IMPORTANTE: Configura las variables de entorno en Railway:"
echo ""
echo "1. Ve a tu proyecto en Railway Dashboard"
echo "2. Ve a la pestaña 'Variables'"
echo "3. Agrega las siguientes variables:"
echo ""
echo "   JWT_SECRET=tu-clave-secreta-super-segura-aqui"
echo "   SESSION_SECRET=tu-clave-de-sesion-secreta"
echo "   SENDGRID_API_KEY=tu-clave-de-sendgrid"
echo "   FROM_EMAIL=noreply@grupoorsega.com"
echo "   OPENAI_API_KEY=tu-clave-de-openai (opcional)"
echo "   NODE_ENV=production"
echo "   PORT=3000"
echo ""
echo "📋 Las variables están listadas en: railway-env-vars.txt"
echo ""

# Preguntar si quiere continuar con el deployment
read -p "¿Has configurado las variables de entorno? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⏸️  Configura las variables de entorno primero y luego ejecuta:"
    echo "   npx @railway/cli up"
    exit 0
fi

# Hacer deployment
echo "🚀 Iniciando deployment en Railway..."
npx @railway/cli up

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ¡Deployment exitoso!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "1. Verifica que la aplicación esté funcionando"
    echo "2. Prueba el login de administrador"
    echo "3. Configura usuarios y datos iniciales"
    echo ""
    echo "🔗 Tu aplicación estará disponible en la URL que Railway te proporcione"
else
    echo "❌ Error en el deployment"
    echo "📝 Revisa los logs en Railway Dashboard"
    exit 1
fi
