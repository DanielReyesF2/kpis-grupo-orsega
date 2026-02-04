# Estructura Excel ACUMULADO 2026 (GO - VENTAS 2026.xlsx)

> Hoja transaccional de Grupo Orsega para importación a `sales_data`. Este formato se detecta por el nombre de la hoja y se procesa con `company_id=2` (GO).

---

## 1. Hoja: "ACUMULADO 2026"

Una sola hoja con datos transaccionales. Nombres de columna esperados (por orden o por cabecera):

| Columna / Índice | Nombre esperado      | Uso en sales_data / notas                    |
|------------------|---------------------|----------------------------------------------|
| # MES            | Número de mes (1-12)| sale_month                                   |
| Factura          | Folio (ej: "101741 / 73") | invoice_number, folio                  |
| Fecha            | Fecha de venta      | sale_date, sale_year                         |
| Cliente          | Nombre del cliente  | client_name. **Excluir** si valor = "C A N C E L A D A" |
| Producto         | Nombre del producto | product_name                                 |
| FAMILIA DEL PRODUCTO | Opcional       | familia_producto (productos)                 |
| UNIDAD           | KG, UNIDADES, etc.  | unit                                         |
| Cantidad         | Número              | quantity (requerido > 0)                     |
| USD              | Importe en USD      | Opcional                                     |
| MN               | Moneda (MXN)        | Opcional                                     |
| TIPO DE CAMBIO   | Tipo de cambio      | tipo_cambio                                  |
| IMPORTE M.N.     | Importe en MXN      | total_amount, importe_mn                      |
| COMPRA           | Costo               | Opcional                                     |
| FLETE            | Flete               | Opcional                                     |
| UTILIDAD BRUTA   | Utilidad            | Opcional                                     |

- **Fila de encabezado:** Primera fila (row 1).
- **Filas a excluir:**
  - Donde **Cliente** sea "C A N C E L A D A" (o similar): no importar (factura cancelada).
  - Filas tipo "NACIONALES" en Cliente: pueden ser separadores; excluir o tratar según regla de negocio (por defecto excluir de transacciones).
- **company_id:** 2 (Grupo Orsega). Asignado por formato/archivo "GO - VENTAS 2026".
- **Año:** Si no viene en Fecha, usar 2026 a partir del nombre de la hoja "ACUMULADO 2026".

---

## 2. Detección en kpis-grupo-orsega

- `detectExcelFormat(workbook)` devuelve `'ACUM_GO_2026'` si existe una hoja cuyo nombre contenga "ACUMULADO" y "2026" (p. ej. "ACUMULADO 2026").
- Parser: `parseAcumGO2026(workbook)` en `server/sales-acum-go-parser.ts`.
- Handler: `handleACUMGO2026Upload` en `server/sales-acum-go-handler.ts`; inserta en `sales_data` con `company_id=2`, `submodulo='GO'`.

---

## 3. Referencias

- Import ventas: `server/routes/sales-data.ts`, `server/sales-acum-go-handler.ts`, `server/sales-acum-go-parser.ts`.
- Nova chat + import: `docs/NOVA_CHAT_VENTAS_ENERO.md`, `docs/nova-ai-integration-spec.md`.
