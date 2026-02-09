# Usuarios del Sistema KPI - Credenciales y Accesos

**Sistema:** KPIs Grupo Orsega
**Fecha de generacion:** 2026-02-09

---

## Tabla de Usuarios

| # | Nombre | Email (Usuario) | Password | Rol | Empresa | Area | Puede Login? |
|---|--------|-----------------|----------|-----|---------|------|:------------:|
| 1 | Admin | admin@econova.com | *(hash bcrypt - ver nota 1)* | admin | Todas | Todas | Si |
| 23 | Daniel Martinez | daniel@econova.com.mx | *(hash bcrypt - ver nota 1)* | admin | Todas | Todas | Si |
| 22 | Test User | test@test.com | *(hash bcrypt - ver nota 1)* | admin | Todas | Todas | Si |
| 12 | Mario Reynoso | marioreynoso@grupoorsega.com | *(hash bcrypt - ver nota 1)* | manager | Todas (acceso especial) | Todas | Si |
| 4 | Omar Navarro | omarnavarro@duraintal.com | *(hash bcrypt - ver nota 1)* | collaborator | Dura International | Ventas (Dura) | Si |
| 10 | Guillermo Galindo | guillermo.galindo@econova.com | *(hash bcrypt - ver nota 1)* | collaborator | Dura International | Ventas (Dura) | Si |
| 8 | Miranda de Koster | miranda.dekoster@econova.com | *(hash bcrypt - ver nota 1)* | collaborator | Dura International | Ventas (Dura) | Si |
| 24 | Test Usuario Corregido | testcorrected@econova.com.mx | *(hash bcrypt - ver nota 1)* | collaborator | Dura International | Ventas (Dura) | Si |
| 21 | Alejandra Palomera | alejandrapalomera@grupoorsega.com | *(hash bcrypt - ver nota 1)* | collaborator | *(sin asignar)* | Compras (Orsega) | Si |
| 5 | Thalia Rodriguez | thaliarodriguez@grupoorsega.com | *(sin password)* | collaborator | Grupo Orsega | Logistica (Orsega) | NO |
| 6 | Dolores Navarro | doloresnavarro@grupoorsega.com | *(sin password)* | collaborator | Dura International | Tesoreria (Dura) | NO |
| 7 | Andrea Navarro | andreanavarro@duraintal.com | *(sin password)* | collaborator | Dura International | Compras (Orsega) | NO |
| 11 | Julio Martell | julio.hernandez@econova.com | *(sin password)* | collaborator | Grupo Orsega | Contabilidad y Finanzas (Orsega) | NO |
| 9 | Jesus Espinoza | jesus.martinez@econova.com | *(sin password)* | collaborator | Grupo Orsega | Ventas (Orsega) | NO |

---

## Notas sobre Passwords

1. **Passwords con hash bcrypt:** Las passwords estan almacenadas con hash bcrypt en la base de datos y no se pueden revertir. Fueron configuradas al momento de crear cada usuario. El script `scripts/fix_users_data.js` usa un fallback de `changeMe123` cuando la variable de entorno `DEFAULT_USER_PASSWORD` no esta configurada. El password real depende de lo que se haya configurado en produccion.

2. **Usuarios sin password:** 5 usuarios (Thalia, Dolores, Andrea, Julio, Jesus) tienen el campo de password vacio en la migracion de produccion. Estos usuarios **no pueden iniciar sesion** hasta que un administrador les resetee la password.

3. **Para resetear passwords:** Solo un usuario con rol `admin` puede resetear passwords de otros usuarios desde el panel de administracion.

---

## Roles y Accesos

### admin - Administrador (Acceso total)

| Modulo | Acceso |
|--------|--------|
| KPIs | Ver, crear, editar, eliminar KPIs de TODAS las empresas |
| Ventas | Actualizar ventas, cerrar mes, override en periodos cerrados |
| Tesoreria | Gestionar pagos, importar tipos de cambio Banxico, ver todas las empresas |
| Logistica | Crear, editar, eliminar envios de cualquier empresa |
| Catalogos | CRUD completo de clientes, productos, proveedores |
| Usuarios | Crear, editar, eliminar usuarios, resetear passwords |
| Sistema | Diagnosticos, health checks, importacion masiva de datos |

**Usuarios con este rol:** Admin, Daniel Martinez, Test User

---

### manager - Gerente (Acceso casi completo)

| Modulo | Acceso |
|--------|--------|
| KPIs | Crear, editar, eliminar KPIs de su empresa |
| Ventas | Actualizar ventas semanales y mensuales (si el mes no esta cerrado) |
| Tesoreria | Gestionar pagos, subir comprobantes, registrar tipos de cambio |
| Logistica | Crear, editar envios, actualizar estados |
| Catalogos | Crear proveedores, clientes, productos |
| Usuarios | Crear, editar, eliminar usuarios de su empresa |

**NO puede:** Cerrar mes, actualizar periodos cerrados, resetear passwords, importar datos masivos, ver datos de otras empresas.

**Usuarios con este rol:** Mario Reynoso *(nota: tiene acceso especial de admin por nombre)*

---

### collaborator - Colaborador (Operaciones estandar)

| Modulo | Acceso |
|--------|--------|
| KPIs | Actualizar sus propios KPIs semanalmente, ver KPIs de su area |
| Ventas | Actualizar ventas semanales y mensuales (si el mes no esta cerrado) |
| Tesoreria | Subir comprobantes, crear pagos, registrar tipos de cambio |
| Logistica | Crear y editar envios de su empresa |
| Catalogos | Crear clientes y productos |
| Usuarios | No puede gestionar usuarios |

**NO puede:** Crear/editar/eliminar definiciones de KPIs, cerrar mes, gestionar usuarios, ver datos de otras empresas.

**Usuarios con este rol:** Omar Navarro, Guillermo Galindo, Miranda de Koster, Test Usuario Corregido, Alejandra Palomera, Thalia Rodriguez, Dolores Navarro, Andrea Navarro, Julio Martell, Jesus Espinoza

---

### viewer - Visualizador (Solo lectura)

| Modulo | Acceso |
|--------|--------|
| KPIs | Solo ver dashboard y KPIs de su empresa |
| Ventas | Solo ver historial |
| Tesoreria | Solo ver tipos de cambio |
| Logistica | Solo ver envios, rastrear |
| Catalogos | Solo ver catalogos |
| Usuarios | Sin acceso |

**NO puede:** Editar nada. Rol por defecto para usuarios nuevos.

**Usuarios con este rol:** Ninguno actualmente registrado.

---

## Estructura de Empresas y Areas

### Dura International (company_id = 1)

| Area ID | Area |
|---------|------|
| 1 | Ventas |
| 2 | Logistica |
| 3 | Contabilidad y Finanzas |
| 7 | Compras |
| 8 | Almacen |
| 9 | Tesoreria |

### Grupo Orsega (company_id = 2)

| Area ID | Area |
|---------|------|
| 4 | Ventas |
| 5 | Logistica |
| 6 | Contabilidad y Finanzas |
| 10 | Compras |
| 11 | Almacen |
| 12 | Tesoreria |

---

## Seguridad

- **Rate limiting en login:** 5 intentos cada 15 minutos por IP
- **Rate limiting en registro:** 3 registros por hora
- **JWT:** Tokens expiran en 7 dias
- **Passwords:** Minimo 8 caracteres, almacenadas con bcrypt (10 rounds)
- **Multi-tenant:** Cada usuario solo ve datos de su empresa (excepto admins)
