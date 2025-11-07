# Archivos de Prueba para Tests

Este directorio contiene archivos de ejemplo para tests automatizados.

## Archivos Disponibles

### PDFs
- **factura-ejemplo.pdf**: Factura CFDI con datos completos
- **comprobante-pago-ejemplo.pdf**: Comprobante de transferencia SPEI
- **rep-ejemplo.pdf**: Recibo Electrónico de Pago (Complemento de Pago CFDI)
- **archivo-invalido.pdf**: Archivo inválido para tests de manejo de errores

## Uso

Estos archivos son usados por:
- Tests unitarios en `tests/unit/`
- Tests de integración en `tests/integration/`
- Tests E2E en `tests/e2e/`

## Regenerar Archivos

Para regenerar estos archivos:

```bash
node scripts/generate-test-files.mjs
```

## Notas

- Todos los datos en estos archivos son ficticios
- Los RFCs, UUIDs y números de cuenta son ejemplos
- No usar estos archivos en producción
