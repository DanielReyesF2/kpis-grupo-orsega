/**
 * ✅ SECURITY FIX: Política de contraseñas robusta
 *
 * Implementa validación de contraseñas según mejores prácticas:
 * - NIST SP 800-63B
 * - OWASP Guidelines
 *
 * Requisitos:
 * - Mínimo 12 caracteres (NIST recomienda 8+, pero 12 es más seguro)
 * - Al menos 1 mayúscula
 * - Al menos 1 minúscula
 * - Al menos 1 número
 * - Al menos 1 carácter especial
 * - No puede ser una contraseña común (breached passwords)
 * - No puede contener el nombre de usuario
 */

// Lista de contraseñas comunes/comprometidas (top 100 más comunes)
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789',
  '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
  'master', '123321', 'welcome', 'shadow', 'ashley',
  'football', 'jesus', 'michael', 'ninja', 'mustang',
  'password1', 'password123', 'admin', 'admin123', 'letmein',
  'monkey', 'access', 'abc123', 'login', 'princess',
  '654321', 'superman', 'hello', 'charlie', 'donald',
  'passw0rd', 'p@ssword', 'p@ssw0rd', 'qwerty123', 'qwertyuiop',
  'azerty', 'zaq1zaq1', 'zxcvbnm', 'asdfgh', 'asdf1234',
  'aaaaaa', 'test', 'test123', 'testing', 'temp',
  'temp123', 'pass', 'pass123', 'root', 'toor',
  'administrator', 'guest', 'changeme', 'default', '000000',
  '121212', '131313', '666666', '696969', '7777777',
  '88888888', '0987654321', '1q2w3e4r', '1qaz2wsx', 'qweasd',
  'system', 'oracle', 'windows', 'microsoft', 'office',
  // Contraseñas en español
  'contraseña', 'hola', 'amor', 'estrella', 'hermoso',
  'secreto', 'clave', 'acceso', 'cuenta', 'entrada',
]);

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUsernameSimilarity: boolean;
}

const DEFAULT_POLICY: PasswordPolicyConfig = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUsernameSimilarity: true,
};

/**
 * Valida una contraseña según la política de seguridad
 *
 * @param password - Contraseña a validar
 * @param username - Nombre de usuario (opcional, para evitar similitud)
 * @param config - Configuración de política (opcional)
 */
export function validatePassword(
  password: string,
  username?: string,
  config: Partial<PasswordPolicyConfig> = {}
): PasswordValidationResult {
  const policy = { ...DEFAULT_POLICY, ...config };
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // 1. Verificar longitud
  if (password.length < policy.minLength) {
    errors.push(`La contraseña debe tener al menos ${policy.minLength} caracteres`);
  } else {
    score += 20;
    if (password.length >= 16) {
      score += 10;
    }
  }

  if (password.length > policy.maxLength) {
    errors.push(`La contraseña no puede exceder ${policy.maxLength} caracteres`);
  }

  // 2. Verificar mayúsculas
  if (policy.requireUppercase) {
    if (!/[A-Z]/.test(password)) {
      errors.push('La contraseña debe incluir al menos una letra mayúscula');
    } else {
      score += 15;
    }
  }

  // 3. Verificar minúsculas
  if (policy.requireLowercase) {
    if (!/[a-z]/.test(password)) {
      errors.push('La contraseña debe incluir al menos una letra minúscula');
    } else {
      score += 15;
    }
  }

  // 4. Verificar números
  if (policy.requireNumbers) {
    if (!/[0-9]/.test(password)) {
      errors.push('La contraseña debe incluir al menos un número');
    } else {
      score += 15;
    }
  }

  // 5. Verificar caracteres especiales
  if (policy.requireSpecialChars) {
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      errors.push('La contraseña debe incluir al menos un carácter especial (!@#$%^&*...)');
    } else {
      score += 15;
    }
  }

  // 6. Verificar contraseñas comunes
  if (policy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('Esta contraseña es muy común y no es segura');
      score -= 30;
    } else {
      score += 10;
    }

    // Verificar variaciones simples de contraseñas comunes
    const stripped = lowerPassword.replace(/[0-9!@#$%^&*]/g, '');
    if (COMMON_PASSWORDS.has(stripped)) {
      suggestions.push('Evita usar variaciones de contraseñas comunes');
      score -= 10;
    }
  }

  // 7. Verificar similitud con username
  if (policy.preventUsernameSimilarity && username) {
    const lowerPassword = password.toLowerCase();
    const lowerUsername = username.toLowerCase();

    if (lowerPassword.includes(lowerUsername)) {
      errors.push('La contraseña no puede contener tu nombre de usuario');
      score -= 20;
    }

    if (lowerUsername.includes(lowerPassword)) {
      errors.push('La contraseña es muy similar a tu nombre de usuario');
      score -= 20;
    }
  }

  // 8. Verificar patrones secuenciales
  if (hasSequentialPattern(password)) {
    suggestions.push('Evita patrones secuenciales como "123" o "abc"');
    score -= 10;
  }

  // 9. Verificar repeticiones
  if (hasRepeatingPattern(password)) {
    suggestions.push('Evita caracteres repetidos como "aaa" o "111"');
    score -= 10;
  }

  // Asegurar score entre 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions,
  };
}

/**
 * Detecta patrones secuenciales (123, abc, qwerty, etc.)
 */
function hasSequentialPattern(password: string): boolean {
  const sequences = [
    '0123456789',
    '9876543210',
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
  ];

  const lower = password.toLowerCase();

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 3; i++) {
      if (lower.includes(seq.substring(i, i + 3))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detecta patrones de repetición (aaa, 111, etc.)
 */
function hasRepeatingPattern(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

/**
 * Genera sugerencias para mejorar la fortaleza de una contraseña
 */
export function getPasswordSuggestions(password: string): string[] {
  const suggestions: string[] = [];

  if (password.length < 16) {
    suggestions.push('Considera usar una contraseña más larga (16+ caracteres)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    suggestions.push('Agrega caracteres especiales para mayor seguridad');
  }

  if (password === password.toLowerCase() || password === password.toUpperCase()) {
    suggestions.push('Mezcla mayúsculas y minúsculas');
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    suggestions.push('Agrega números para mayor seguridad');
  }

  return suggestions;
}

/**
 * Calcula la entropía de una contraseña (bits)
 * Mayor entropía = mayor seguridad
 */
export function calculateEntropy(password: string): number {
  let charsetSize = 0;

  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) charsetSize += 32;

  if (charsetSize === 0) return 0;

  return Math.log2(Math.pow(charsetSize, password.length));
}
