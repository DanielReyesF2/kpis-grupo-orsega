#!/bin/bash

# Script de deployment para Econova KPI Dashboard
# Uso: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
echo "🚀 Iniciando deployment para ambiente: $ENVIRONMENT"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "No se encontró package.json. Ejecuta este script desde el directorio raíz del proyecto."
fi

log "Verificando dependencias..."
npm ci --only=production

log "Ejecutando verificaciones de TypeScript..."
npm run check

log "Construyendo aplicación..."
npm run build

log "Verificando variables de entorno..."
if [ ! -f ".env" ]; then
    error "Archivo .env no encontrado. Crea uno basado en .env.example"
fi

# Verificar variables críticas
source .env
if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL no está configurada"
fi

if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET no está configurada"
fi

log "Creando directorio de logs..."
mkdir -p logs

log "Configurando permisos..."
chmod +x dist/index.js

log "✅ Deployment completado exitosamente!"
log "Para iniciar la aplicación: npm start"
log "Para desarrollo: npm run dev"

# Mostrar información del sistema
log "Información del sistema:"
echo "  - Node.js: $(node --version)"
echo "  - NPM: $(npm --version)"
echo "  - Ambiente: $ENVIRONMENT"
echo "  - Puerto: ${PORT:-8080}"

