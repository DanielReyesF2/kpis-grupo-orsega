#!/bin/bash
# Script de Auditoría Pre-Deployment
# Ejecuta verificaciones exhaustivas antes de hacer deploy a Railway

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   AUDITORÍA PRE-DEPLOYMENT - VERIFICACIÓN COMPLETA${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

run_test() {
  local test_name="$1"
  local command="$2"
  local is_critical="${3:-false}"

  echo -n "Testing: $test_name... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
    return 0
  else
    if [ "$is_critical" = "true" ]; then
      echo -e "${RED}✗ FAIL (CRÍTICO)${NC}"
      ((FAILED++))
      return 1
    else
      echo -e "${YELLOW}⚠ WARNING${NC}"
      ((WARNINGS++))
      return 0
    fi
  fi
}

echo -e "${BLUE}[Fase 1] Verificación de Archivos Críticos${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "package.json existe" "[ -f package.json ]" true
run_test "server/index.ts existe" "[ -f server/index.ts ]" true
run_test "vite.config.ts existe" "[ -f vite.config.ts ]" true
run_test "tsconfig.json existe" "[ -f tsconfig.json ]" true
run_test ".env.example existe" "[ -f .env.example ]" false

echo ""
echo -e "${BLUE}[Fase 2] Verificación de Dependencias${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "node_modules existe" "[ -d node_modules ]" true
run_test "pdfjs-dist instalado" "npm list pdfjs-dist --depth=0" true
run_test "drizzle-orm instalado" "npm list drizzle-orm --depth=0" true
run_test "express instalado" "npm list express --depth=0" true
run_test "vite instalado" "npm list vite --depth=0" true

echo ""
echo -e "${BLUE}[Fase 3] Verificación de Binarios Nativos${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f node_modules/esbuild/bin/esbuild ]; then
  ESBUILD_ARCH=$(file node_modules/esbuild/bin/esbuild | grep -o -E '(ELF|Mach-O).*' || echo "unknown")
  SYSTEM_ARCH=$(uname -m)

  echo -n "Verificando arquitectura de esbuild... "

  if [[ "$ESBUILD_ARCH" == *"ELF"* ]] && [[ "$SYSTEM_ARCH" == "x86_64" ]]; then
    echo -e "${GREEN}✓ PASS${NC} (ELF x86-64)"
    ((PASSED++))
  elif [[ "$ESBUILD_ARCH" == *"Mach-O"* ]] && [[ "$SYSTEM_ARCH" == "arm64" ]]; then
    echo -e "${GREEN}✓ PASS${NC} (Mach-O ARM64)"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Sistema: $SYSTEM_ARCH"
    echo "  esbuild: $ESBUILD_ARCH"
    echo "  ⚠️  ARQUITECTURA INCOMPATIBLE - Ejecuta: npm install esbuild --force"
    ((FAILED++))
  fi
else
  echo -e "${RED}✗ FAIL${NC} - esbuild binary not found"
  ((FAILED++))
fi

# Test esbuild execution
run_test "esbuild es ejecutable" "./node_modules/.bin/esbuild --version" true

echo ""
echo -e "${BLUE}[Fase 4] TypeScript & Linting${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Ejecutando tsc --noEmit... "
if npm run check > /tmp/tsc-output.txt 2>&1; then
  echo -e "${GREEN}✓ PASS${NC} (0 errores)"
  ((PASSED++))
else
  ERROR_COUNT=$(grep -c "error TS" /tmp/tsc-output.txt 2>/dev/null || echo "unknown")
  echo -e "${YELLOW}⚠ WARNING${NC} ($ERROR_COUNT errores)"
  echo "  Los errores de TypeScript no bloquean el build pero deben revisarse"
  ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}[Fase 5] Build Completo${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean previous build
echo "Limpiando dist/ anterior..."
rm -rf dist

# Run full build
echo -n "Ejecutando npm run build... "
if npm run build > /tmp/build-output.txt 2>&1; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC}"
  echo "Ver /tmp/build-output.txt para detalles"
  ((FAILED++))

  echo ""
  echo -e "${RED}BUILD FAILED - Últimas líneas del error:${NC}"
  tail -20 /tmp/build-output.txt
  exit 1
fi

# Verify build outputs
run_test "dist/ directorio existe" "[ -d dist ]" true
run_test "dist/index.js existe" "[ -f dist/index.js ]" true
run_test "dist/public/ existe" "[ -d dist/public ]" true
run_test "dist/public/index.html existe" "[ -f dist/public/index.html ]" true

# Check build sizes
if [ -f dist/index.js ]; then
  BACKEND_SIZE=$(du -h dist/index.js | cut -f1)
  echo "  Backend bundle: $BACKEND_SIZE"
fi

if [ -d dist/public ]; then
  FRONTEND_SIZE=$(du -sh dist/public | cut -f1)
  echo "  Frontend bundle: $FRONTEND_SIZE"
fi

echo ""
echo -e "${BLUE}[Fase 6] Verificación Post-Build${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test that the built server can be loaded
echo -n "Verificando dist/index.js es ejecutable... "
if node -c dist/index.js 2>/dev/null; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILED++))
fi

echo ""
echo -e "${BLUE}[Fase 7] Seguridad & Vulnerabilidades${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Ejecutando npm audit... "
if npm audit --json > /tmp/audit-output.json 2>&1; then
  echo -e "${GREEN}✓ PASS${NC} (0 vulnerabilidades)"
  ((PASSED++))
else
  VULN_COUNT=$(jq '.metadata.vulnerabilities | to_entries | map(.value) | add' /tmp/audit-output.json 2>/dev/null || echo "unknown")
  HIGH_VULN=$(jq '.metadata.vulnerabilities.high // 0' /tmp/audit-output.json 2>/dev/null || echo "0")
  CRITICAL_VULN=$(jq '.metadata.vulnerabilities.critical // 0' /tmp/audit-output.json 2>/dev/null || echo "0")

  if [ "$CRITICAL_VULN" -gt 0 ]; then
    echo -e "${RED}✗ FAIL${NC} ($VULN_COUNT vulnerabilidades, $CRITICAL_VULN críticas)"
    ((FAILED++))
  elif [ "$HIGH_VULN" -gt 0 ]; then
    echo -e "${YELLOW}⚠ WARNING${NC} ($VULN_COUNT vulnerabilidades, $HIGH_VULN altas)"
    ((WARNINGS++))
  else
    echo -e "${YELLOW}⚠ WARNING${NC} ($VULN_COUNT vulnerabilidades)"
    ((WARNINGS++))
  fi
fi

echo ""
echo -e "${BLUE}[Fase 8] Git & Deployment${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Git repositorio inicializado" "[ -d .git ]" true
run_test "Branch actual es conocido" "git branch --show-current" true

# Check for uncommitted changes
echo -n "Verificando cambios sin commit... "
if [ -z "$(git status --porcelain | grep -v '^??')" ]; then
  echo -e "${GREEN}✓ PASS${NC} (todo committeado)"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING${NC}"
  echo "  Hay cambios sin commit:"
  git status --short | grep -v '^??' | head -5
  ((WARNINGS++))
fi

# Check for untracked files that should be tracked
echo -n "Verificando archivos no trackeados críticos... "
UNTRACKED_CRITICAL=$(git status --porcelain | grep '^??' | grep -E '\.(ts|tsx|js|jsx)$' || true)
if [ -z "$UNTRACKED_CRITICAL" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING${NC}"
  echo "  Archivos .ts/.tsx no trackeados (no se deployarán):"
  echo "$UNTRACKED_CRITICAL" | head -5
  ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}[Fase 9] Smoke Tests${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f scripts/smoke-tests.sh ]; then
  echo "Ejecutando smoke tests..."
  if bash scripts/smoke-tests.sh > /tmp/smoke-tests.txt 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} - Smoke tests"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠ WARNING${NC} - Algunos smoke tests fallaron"
    ((WARNINGS++))
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC} - scripts/smoke-tests.sh no existe"
  ((WARNINGS++))
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                 RESUMEN FINAL                     ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

echo -e "  ${GREEN}✓ Passed:${NC}    $PASSED"
echo -e "  ${YELLOW}⚠ Warnings:${NC}  $WARNINGS"
echo -e "  ${RED}✗ Failed:${NC}    $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                                                   ║${NC}"
  echo -e "${RED}║  ❌ AUDITORÍA FALLIDA - NO DEPLOYAR              ║${NC}"
  echo -e "${RED}║                                                   ║${NC}"
  echo -e "${RED}║  Corrige los errores críticos antes de continuar ║${NC}"
  echo -e "${RED}║                                                   ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════╝${NC}"
  exit 1
elif [ $WARNINGS -gt 3 ]; then
  echo -e "${YELLOW}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║                                                   ║${NC}"
  echo -e "${YELLOW}║  ⚠️  AUDITORÍA PASÓ CON ADVERTENCIAS             ║${NC}"
  echo -e "${YELLOW}║                                                   ║${NC}"
  echo -e "${YELLOW}║  Revisa los warnings antes de hacer deploy       ║${NC}"
  echo -e "${YELLOW}║  Deploy bajo tu propio riesgo                    ║${NC}"
  echo -e "${YELLOW}║                                                   ║${NC}"
  echo -e "${YELLOW}╚═══════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                   ║${NC}"
  echo -e "${GREEN}║  ✅ AUDITORÍA EXITOSA - LISTO PARA DEPLOYMENT     ║${NC}"
  echo -e "${GREEN}║                                                   ║${NC}"
  echo -e "${GREEN}║  Todos los checks críticos pasaron               ║${NC}"
  echo -e "${GREEN}║  Puedes hacer deploy con confianza               ║${NC}"
  echo -e "${GREEN}║                                                   ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
  exit 0
fi
