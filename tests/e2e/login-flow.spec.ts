/**
 * Tests E2E para flujo de login
 * Prueba el flujo completo de autenticación desde la UI
 */

import { test, expect } from '@playwright/test';

// Configuración
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Login Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar a la página de login
    await page.goto(`${BASE_URL}/login`);
  });

  test('debe mostrar la página de login correctamente', async ({ page }) => {
    // Verificar que estamos en la página correcta
    await expect(page).toHaveURL(/.*login/);

    // Verificar elementos de la UI
    await expect(page.getByLabel(/email|usuario|username/i)).toBeVisible();
    await expect(page.getByLabel(/password|contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|entrar|ingresar/i })).toBeVisible();
  });

  test('debe mostrar error con credenciales inválidas', async ({ page }) => {
    // Llenar formulario con credenciales incorrectas
    await page.getByLabel(/email|usuario|username/i).fill('invalid@example.com');
    await page.getByLabel(/password|contraseña/i).fill('wrongpassword');

    // Hacer click en login
    await page.getByRole('button', { name: /login|entrar|ingresar/i }).click();

    // Esperar mensaje de error
    await expect(page.getByText(/invalid|incorrecto|error/i)).toBeVisible({ timeout: 5000 });
  });

  test('debe validar campos requeridos', async ({ page }) => {
    // Intentar login sin llenar campos
    await page.getByRole('button', { name: /login|entrar|ingresar/i }).click();

    // Verificar validación HTML5 o mensajes de error
    const emailInput = page.getByLabel(/email|usuario|username/i);
    const passwordInput = page.getByLabel(/password|contraseña/i);

    // Verificar que los campos están marcados como inválidos
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test.skip('debe hacer login exitoso con credenciales válidas', async ({ page }) => {
    // SKIP: Requiere credenciales válidas en el sistema
    // Para habilitar, configurar TEST_USER_EMAIL y TEST_USER_PASSWORD en .env

    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    // Llenar formulario
    await page.getByLabel(/email|usuario|username/i).fill(testEmail);
    await page.getByLabel(/password|contraseña/i).fill(testPassword);

    // Hacer click en login
    await page.getByRole('button', { name: /login|entrar|ingresar/i }).click();

    // Esperar redirección al dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

    // Verificar que estamos autenticados
    await expect(page.getByText(/dashboard|panel|inicio/i)).toBeVisible();
  });

  test('debe prevenir multiple submissions (double-click)', async ({ page }) => {
    // Llenar formulario
    await page.getByLabel(/email|usuario|username/i).fill('test@example.com');
    await page.getByLabel(/password|contraseña/i).fill('password123');

    // Hacer doble click rápido en el botón
    const loginButton = page.getByRole('button', { name: /login|entrar|ingresar/i });
    await loginButton.click();
    await loginButton.click();

    // El botón debe estar deshabilitado después del primer click
    await expect(loginButton).toBeDisabled();
  });

  test('debe permitir navegar al registro si existe link', async ({ page }) => {
    // Buscar link de registro
    const registerLink = page.getByRole('link', { name: /register|registro|crear cuenta/i });

    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/.*register/);
    }
  });

  test('debe tener configuración de seguridad básica', async ({ page }) => {
    // Verificar que el input de password es de tipo password
    const passwordInput = page.getByLabel(/password|contraseña/i);
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Verificar que el formulario previene autocompletado (opcional)
    // await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('debe ser responsive en mobile', async ({ page }) => {
    // Cambiar a viewport móvil
    await page.setViewportSize({ width: 375, height: 667 });

    // Verificar que los elementos son visibles
    await expect(page.getByLabel(/email|usuario|username/i)).toBeVisible();
    await expect(page.getByLabel(/password|contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|entrar|ingresar/i })).toBeVisible();
  });
});

test.describe('Session Management', () => {
  test.skip('debe mantener sesión después de reload', async ({ page }) => {
    // Requiere login exitoso primero
    test.skip();
  });

  test.skip('debe cerrar sesión correctamente', async ({ page }) => {
    // Requiere login exitoso primero
    test.skip();
  });

  test.skip('debe redirigir a login cuando el token expira', async ({ page }) => {
    // Requiere mockear expiración de token
    test.skip();
  });
});
