#!/bin/bash

# ============================================
# SMOKE TESTS - Verificación Rápida Pre-Deploy
# ============================================
# Tests básicos para verificar que la aplicación funciona
# antes de hacer deploy o después de cambios grandes

set -e  # Terminar si algún comando falla

echo "🔥 SMOKE TESTS - Verificación Rápida"
echo "===================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de tests
PASSED=0
FAILED=0

# Función para ejecutar test
run_test() {
  local test_name="$1"
  local command="$2"

  echo -n "Testing: $test_name... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
    return 1
  fi
}

# Función para test con curl
curl_test() {
  local test_name="$1"
  local url="$2"
  local expected_status="$3"

  echo -n "Testing: $test_name... "

  local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $status)"
    ((FAILED++))
    return 1
  fi
}

# ============================================
# 1. VERIFICACIONES DE ARCHIVOS
# ============================================
echo "📁 1. Verificando archivos críticos..."
run_test "package.json existe" "[ -f package.json ]"
run_test "server/index.ts existe" "[ -f server/index.ts ]"
run_test "server/routes.ts existe" "[ -f server/routes.ts ]"
run_test ".env existe" "[ -f .env ]"
run_test "node_modules existe" "[ -d node_modules ]"
echo ""

# ============================================
# 2. VERIFICACIONES DE DEPENDENCIAS
# ============================================
echo "📦 2. Verificando dependencias..."
run_test "pdfjs-dist instalado" "npm list pdfjs-dist"
run_test "express instalado" "npm list express"
run_test "drizzle-orm instalado" "npm list drizzle-orm"
run_test "openai instalado" "npm list openai"
echo ""

# ============================================
# 3. VERIFICACIONES DE TYPESCRIPT
# ============================================
echo "🔍 3. Verificando TypeScript..."
run_test "TypeScript compila sin errores" "npm run check"
echo ""

# ============================================
# 4. VERIFICACIONES DEL SERVIDOR (si está corriendo)
# ============================================
echo "🌐 4. Verificando servidor (si está corriendo)..."
echo "   Nota: Si el servidor no está corriendo, estos tests fallarán (es normal)"

# Esperar un momento para que el servidor responda
sleep 1

# Verificar endpoints básicos
curl_test "Health check endpoint" "http://localhost:8080/health" "200"
curl_test "API responde" "http://localhost:8080/api" "404"  # 404 es esperado para /api sin ruta específica

# Login endpoint (debe dar 400 sin credenciales)
echo -n "Testing: Login endpoint responde... "
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/login)
if [ "$status" = "400" ] || [ "$status" = "401" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $status - esperado sin credenciales)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Got HTTP $status)"
  ((FAILED++))
fi

echo ""

# ============================================
# 5. VERIFICACIONES DE VARIABLES DE ENTORNO
# ============================================
echo "🔐 5. Verificando variables de entorno..."

check_env_var() {
  local var_name="$1"
  echo -n "Testing: $var_name está configurado... "

  if grep -q "^${var_name}=" .env 2>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠ SKIP${NC} (no encontrado en .env)"
  fi
}

check_env_var "DATABASE_URL"
check_env_var "JWT_SECRET"
check_env_var "OPENAI_API_KEY"
echo ""

# ============================================
# 6. VERIFICACIONES DE ARCHIVOS DE TEST
# ============================================
echo "🧪 6. Verificando archivos de test..."
run_test "Directorio tests/ existe" "[ -d tests ]"
run_test "Test files generados" "[ -f tests/test-files/factura-ejemplo.pdf ]"
run_test "Jest config existe" "[ -f jest.config.js ]"
echo ""

# ============================================
# RESUMEN
# ============================================
echo "===================================="
echo "📊 RESUMEN"
echo "===================================="
echo -e "Tests ejecutados: $((PASSED + FAILED))"
echo -e "${GREEN}Pasados: $PASSED${NC}"
echo -e "${RED}Fallados: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ TODOS LOS SMOKE TESTS PASARON${NC}"
  echo ""
  echo "La aplicación está lista para:"
  echo "  • Deploy a producción"
  echo "  • Pull request"
  echo "  • Testing manual"
  exit 0
else
  echo -e "${RED}❌ ALGUNOS TESTS FALLARON${NC}"
  echo ""
  echo "Revisa los errores arriba antes de:"
  echo "  • Hacer deploy"
  echo "  • Crear pull request"
  echo "  • Testing con usuarios"
  exit 1
fi
