-- SQL para actualizar contraseñas de usuarios
-- Ejecutar directamente en Neon Database

-- Actualizar contraseña de todos los usuarios a "password123"
-- Hash generado: $2b$10$uQsm.yIboPJERHbI5pGOuObSNZfnmQgOB6ZXZSeRWgK3Z20zGzGG6

UPDATE users 
SET password = '$2b$10$uQsm.yIboPJERHbI5pGOuObSNZfnmQgOB6ZXZSeRWgK3Z20zGzGG6'
WHERE email IN (
  'admin@dura.com',
  'omarnavarro@duraintal.com', 
  'thalia@duraintal.com',
  'mario@dura.com',
  'admin@orsega.com',
  'omar@orsega.com',
  'thalia@orsega.com',
  'mario@orsega.com',
  'daniel@econova.com.mx'
);

-- Verificar que se actualizaron correctamente
SELECT name, email, role, 
       CASE 
         WHEN password = '$2b$10$uQsm.yIboPJERHbI5pGOuObSNZfnmQgOB6ZXZSeRWgK3Z20zGzGG6' 
         THEN '✅ Updated' 
         ELSE '❌ Not updated' 
       END as password_status
FROM users 
ORDER BY company_id, role;

-- Mostrar usuarios disponibles para login
SELECT 
  u.name,
  u.email,
  u.role,
  c.name as company,
  a.name as area
FROM users u 
LEFT JOIN companies c ON u.company_id = c.id 
LEFT JOIN areas a ON u.area_id = a.id 
ORDER BY u.company_id, u.role;
