-- MIGRATION SQL - Versión corregida para Production (snake_case)
-- Fecha: 2025-09-30T00:20:00.000Z

-- ========== COMPANIES ==========
INSERT INTO companies (id, name, description, sector) VALUES
  (1, 'Dura International', 'Empresa líder en la industria química', 'Química'),
  (2, 'Grupo Orsega', 'Empresa especializada en productos químicos', 'Química')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sector = EXCLUDED.sector;

-- ========== AREAS ==========
INSERT INTO areas (id, name, description, company_id) VALUES
  (1, 'Ventas', 'Área de Ventas para Dura International', 1),
  (2, 'Logística', 'Área de Logística para Dura International', 1),
  (3, 'Contabilidad y Finanzas', 'Área de Contabilidad y Finanzas para Dura International', 1),
  (4, 'Ventas', 'Área de Ventas para Grupo Orsega', 2),
  (5, 'Logística', 'Área de Logística para Grupo Orsega', 2),
  (6, 'Contabilidad y Finanzas', 'Área de Contabilidad y Finanzas para Grupo Orsega', 2),
  (7, 'Compras', 'Área de Compras para Dura International', 1),
  (8, 'Almacén', 'Área de Almacén para Dura International', 1),
  (9, 'Tesorería', 'Área de Tesorería para Dura International', 1),
  (10, 'Compras', 'Área de Compras para Grupo Orsega', 2),
  (11, 'Almacén', 'Área de Almacén para Grupo Orsega', 2),
  (12, 'Tesorería', 'Área de Tesorería para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- ========== USERS ==========
INSERT INTO users (id, email, password, name, role, company_id, area_id) VALUES
  (23, 'daniel@econova.com.mx', '$2b$10$bab3BVAPlTG.DsuCvTa6u.bAH6.URGoX9bCLp/t.EW6gG2giefR2C', 'Daniel Martinez', 'admin', NULL, NULL),
  (22, 'test@test.com', '$2b$10$z0DmCtChlS0ksWIlVB6/z.WrOhRjwGxGvXJvdR.8u1K6gdr9UjRwy', 'Test User', 'admin', NULL, NULL),
  (7, 'andreanavarro@duraintal.com', '', 'Andrea Navarro', 'collaborator', 1, 10),
  (6, 'doloresnavarro@grupoorsega.com', '', 'Dolores Navarro', 'collaborator', 1, 9),
  (1, 'admin@econova.com', '$2b$10$EXZbYmXcqYWuxCuptii4n.d.jhqbIH4z7nCfv6t1X2YXLa70HnMPm', 'Admin', 'admin', NULL, NULL),
  (10, 'guillermo.galindo@econova.com', '$2b$10$AX0oQn/dE/mC138Yly2Qm.T15iLEnRimyh3SaksFxaqsqvWO9e8Y2', 'Guillermo Galindo', 'collaborator', 1, 1),
  (8, 'miranda.dekoster@econova.com', '$2b$10$AX0oQn/dE/mC138Yly2Qm.T15iLEnRimyh3SaksFxaqsqvWO9e8Y2', 'Miranda de Koster', 'collaborator', 1, 1),
  (12, 'marioreynoso@grupoorsega.com', '$2b$10$gtQO8rHn/c.44cfF.fPhnuaoyI5VnuUKubqThaIHkDspUjApWweTu', 'Mario Reynoso', 'manager', NULL, NULL),
  (4, 'omarnavarro@duraintal.com', '$2b$10$vAH5Nrr65JWOl.ivwYhZZOdbG94GyNTzam9A9sPC18PhW39ArqdjK', 'Omar Navarro', 'collaborator', 1, 1),
  (24, 'testcorrected@econova.com.mx', '$2b$10$8vhRCoWGZKyWISsJzS0izu83dNsIoqbVDlqaN41ilMcKQAT45Rz.C', 'Test Usuario Corregido', 'collaborator', 1, 1),
  (5, 'thaliarodriguez@grupoorsega.com', '', 'Thalia Rodriguez', 'collaborator', 2, 5),
  (11, 'julio.hernandez@econova.com', '', 'Julio Martell', 'collaborator', 2, 6),
  (9, 'jesus.martinez@econova.com', '', 'Jesus Espinoza', 'collaborator', 2, 4),
  (21, 'alejandrapalomera@grupoorsega.com', '$2b$10$Zt6oU4gOH1jBcm9hhLx6eOIW8Z4nZtQhYZxZQJ9j1VwVziPoaaxa.', 'Alejandra Palomera', 'collaborator', NULL, 10)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  area_id = EXCLUDED.area_id;

-- ========== KPIs ==========
INSERT INTO kpis (id, name, description, area_id, company_id, unit, target, frequency, calculation_method, responsible, inverted_metric) VALUES
  (1, 'Precisión en estados financieros', 'Mide la exactitud de los estados financieros generados. Objetivo: cero errores en emisión de información financiera. Limitar las salvedades a menos de 5 al mes.', 3, 1, '%', '100%', 'monthly', 'Conteo de errores y salvedades. Los datos son procesados por Julio.', 'Mario Reynoso', false),
  (2, 'Precisión en estados financieros', 'Mide la exactitud de los estados financieros generados. Objetivo: cero errores en emisión de información financiera. Limitar las salvedades a menos de 5 al mes.', 6, 2, '%', '100%', 'monthly', 'Conteo de errores y salvedades. Los datos son procesados por Julio.', 'Mario Reynoso', false),
  (3, 'Velocidad de rotación de cuentas por cobrar', 'Mide el tiempo promedio para cobrar cuentas pendientes. Considerando que para Orsega un cliente clave representa el 80% de ventas.', 3, 1, 'días', '45 días', 'monthly', 'Promedio de días para cobrar', 'Mario Reynoso', true),
  (4, 'Velocidad de rotación de cuentas por cobrar', 'Mide el tiempo promedio para cobrar cuentas pendientes. Considerando que para Orsega un cliente clave representa el 80% de ventas.', 6, 2, 'días', '60 días', 'monthly', 'Promedio de días para cobrar', 'Mario Reynoso', true),
  (5, 'Cumplimiento de obligaciones fiscales', 'Monitoreo mediante checklist para la presentación de impuestos. Objetivo de cumplimiento 100% para evitar confusiones.', 3, 1, '%', '100%', 'monthly', 'Checklist de obligaciones fiscales. Mario enviará el WordCat con la información a Daniel.', 'Mario Reynoso', false),
  (6, 'Cumplimiento de obligaciones fiscales', 'Monitoreo mediante checklist para la presentación de impuestos. Objetivo de cumplimiento 100% para evitar confusiones.', 6, 2, '%', '100%', 'monthly', 'Checklist de obligaciones fiscales. Mario enviará el WordCat con la información a Daniel.', 'Mario Reynoso', false),
  (7, 'Facturación sin errores', 'Mide la precisión en la generación de facturas', 3, 1, '%', '100%', 'weekly', '(Facturas sin errores / Total de facturas) x 100', 'Mario Reynoso', false),
  (8, 'Facturación sin errores', 'Mide la precisión en la generación de facturas', 6, 2, '%', '100%', 'weekly', '(Facturas sin errores / Total de facturas) x 100', 'Mario Reynoso', false),
  (12, 'Porcentaje de crecimiento en ventas', 'Porcentaje de crecimiento en comparación con el año anterior', 4, 2, '%', '+10%', 'monthly', '((Ventas actuales - Ventas año anterior) / Ventas año anterior) * 100', 'Omar Navarro', false),
  (14, 'Nuevos clientes adquiridos', 'Cantidad de nuevos clientes en el período', 4, 2, 'clientes', '2', 'monthly', 'Conteo total de nuevos clientes por mes', 'Omar Navarro', false),
  (15, 'Tiempo de entrega promedio', 'Tiempo promedio de entrega desde la salida del almacén hasta el cliente', 2, 1, 'horas', '48', 'monthly', 'Promedio de horas de entrega de todos los envíos', 'Thalia Rodriguez', true),
  (16, 'Tiempo de entrega promedio', 'Tiempo promedio de entrega desde la salida del almacén hasta el cliente', 5, 2, 'horas', '72', 'monthly', 'Promedio de horas de entrega de todos los envíos', 'Thalia Rodriguez', true),
  (17, 'Índice de entregas a tiempo', 'Porcentaje de entregas realizadas dentro del plazo comprometido', 2, 1, '%', '95%', 'monthly', 'Entregas a tiempo / Total de entregas * 100', 'Thalia Rodriguez', false),
  (18, 'Índice de entregas a tiempo', 'Porcentaje de entregas realizadas dentro del plazo comprometido', 5, 2, '%', '90%', 'monthly', 'Entregas a tiempo / Total de entregas * 100', 'Thalia Rodriguez', false),
  (19, 'Huella de carbono promedio', 'Emisiones de CO2 promedio por envío', 2, 1, 'kg CO2', '350', 'quarterly', 'Emisiones totales / Número de envíos', 'Thalia Rodriguez', true),
  (20, 'Huella de carbono promedio', 'Emisiones de CO2 promedio por envío', 5, 2, 'kg CO2', '500', 'quarterly', 'Emisiones totales / Número de envíos', 'Thalia Rodriguez', true),
  (42, 'Porcentaje de crecimiento en ventas', 'Medir el crecimiento en ventas comparado con el año anterior', 1, 1, '%', '+10%', 'monthly', 'Comparativo anual', 'Jefe de Ventas', false),
  (10, 'Volumen de ventas alcanzado', 'Volumen de ventas en unidades', 4, 2, 'unidades', '10.300.476 unidades', 'monthly', 'Suma de unidades vendidas en el período', 'Omar Navarro', false),
  (21, 'Tiempo de respuesta a cotizaciones', NULL, 7, 1, 'horas', '24', 'monthly', NULL, NULL, false),
  (22, 'Porcentaje de proveedores certificados', NULL, 7, 1, '%', '95%', 'quarterly', NULL, NULL, false),
  (23, 'Reducción de costos de compras', NULL, 7, 1, '%', '5%', 'monthly', NULL, NULL, false),
  (24, 'Precisión de inventario', NULL, 8, 1, '%', '98%', 'monthly', NULL, NULL, false),
  (25, 'Tiempo de despacho', NULL, 8, 1, 'horas', '2', 'daily', NULL, NULL, false),
  (26, 'Rotación de inventario', NULL, 8, 1, 'veces/año', '12', 'monthly', NULL, NULL, false),
  (27, 'Liquidez corriente', NULL, 9, 1, 'ratio', '1.5', 'monthly', NULL, NULL, false),
  (28, 'Tiempo de cobranza', NULL, 9, 1, 'días', '30', 'monthly', NULL, NULL, false),
  (29, 'Rentabilidad financiera', NULL, 9, 1, '%', '8%', 'monthly', NULL, NULL, false),
  (30, 'Tiempo de respuesta a cotizaciones', NULL, 10, 2, 'horas', '24', 'monthly', NULL, NULL, false),
  (31, 'Porcentaje de proveedores certificados', NULL, 10, 2, '%', '95%', 'quarterly', NULL, NULL, false),
  (32, 'Reducción de costos de compras', NULL, 10, 2, '%', '5%', 'monthly', NULL, NULL, false),
  (33, 'Precisión de inventario', NULL, 11, 2, '%', '98%', 'monthly', NULL, NULL, false),
  (34, 'Tiempo de despacho', NULL, 11, 2, 'horas', '2', 'daily', NULL, NULL, false),
  (35, 'Rotación de inventario', NULL, 11, 2, 'veces/año', '12', 'monthly', NULL, NULL, false),
  (36, 'Liquidez corriente', NULL, 12, 2, 'ratio', '1.5', 'monthly', NULL, NULL, false),
  (37, 'Tiempo de cobranza', NULL, 12, 2, 'días', '30', 'monthly', NULL, NULL, false),
  (38, 'Rentabilidad financiera', NULL, 12, 2, '%', '8%', 'monthly', NULL, NULL, false),
  (39, 'Volumen de ventas alcanzado', 'Medir el volumen total de ventas alcanzado', 1, 1, 'KG', '667.449 KG', 'monthly', 'Sumatoria de ventas mensuales', 'Jefe de Ventas', false),
  (44, 'Tasa de retencion de clientes', 'Retencion', 1, 2, 'Porcentaje', '100%', 'monthly', NULL, NULL, false),
  (45, 'Tiempo de entrega promedio', 'Tiempo promedio desde recepción hasta entrega de productos al cliente', 2, 1, 'días', '3 días', 'weekly', 'Promedio de días entre orden y entrega', 'María González', true),
  (46, 'Nivel de inventario disponible', 'Porcentaje de disponibilidad de productos en almacén principal', 8, 1, '%', '95%', 'daily', 'Conteo de productos disponibles vs demanda', 'Carlos Ruiz', false),
  (47, 'Eficiencia en compras', 'Porcentaje de órdenes de compra procesadas dentro del tiempo objetivo', 7, 2, '%', '90%', 'monthly', 'Órdenes a tiempo / Total órdenes', 'Ana Martínez', false),
  (43, 'Nuevos clientes adquiridos', 'Número de nuevos clientes adquiridos', 1, 1, 'Clientes', '2', 'monthly', 'Conteo de clientes nuevos', 'Jefe de Ventas', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  area_id = EXCLUDED.area_id,
  company_id = EXCLUDED.company_id,
  unit = EXCLUDED.unit,
  target = EXCLUDED.target,
  frequency = EXCLUDED.frequency,
  calculation_method = EXCLUDED.calculation_method,
  responsible = EXCLUDED.responsible,
  inverted_metric = EXCLUDED.inverted_metric;
