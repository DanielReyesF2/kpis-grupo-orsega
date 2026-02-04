/**
 * Detección de intención "actualizar ventas" para el chat Nova.
 * Reconocimiento robusto: normalización, variantes, typos (Levenshtein), negación.
 */

const MAX_LEVENSHTEIN_DISTANCE = 2;
const MIN_WORD_LENGTH_FOR_FUZZY = 4;

/** Normaliza texto para comparación: minúsculas, sin acentos, espacios colapsados */
export function normalizeForIntent(s: string): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

/** Distancia de Levenshtein entre dos strings */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/** Frases que indican intención de actualizar/importar ventas (orden: más largas primero) */
const INTENT_PHRASES: string[] = [
  'actualiza con este archivo',
  'actualiza con este excel',
  'actualiza con el excel',
  'actualizalo por favor',
  'actualiza los datos',
  'actualizar los datos',
  'actualiza la base',
  'actualiza las ventas',
  'actualiza ventas',
  'actualizar ventas',
  'actualiza el excel',
  'actualiza números',
  'sube los datos',
  'subir los datos',
  'sube estos datos',
  'sube a la base',
  'sube el excel',
  'importa los datos',
  'importa el excel',
  'guarda en la base',
  'pon estos números',
  'pon los datos',
  'actualiza',
  'actualizar',
  'actualizalo',
  'sube',
  'subir',
  'subelo',
  'importa',
  'importar',
  'importalo',
  'guarda',
  'guardar',
  'pon',
].map(normalizeForIntent);

/** Subcadenas de negación: si el mensaje las contiene, no disparar importación */
const NEGATION_PHRASES: string[] = [
  'no actualic',
  'no subas',
  'no subir',
  'no import',
  'no guardes',
  'no guardar',
  'no actualizar',
  'no actualices',
  'no lo actualices',
  'no lo subas',
  'no lo importes',
].map(normalizeForIntent);

function hasNegation(normalizedMessage: string): boolean {
  return NEGATION_PHRASES.some((phrase) => normalizedMessage.includes(phrase));
}

function messageContainsIntentFuzzy(normalizedMessage: string): boolean {
  const words = normalizedMessage.split(/\s+/).filter((w) => w.length >= MIN_WORD_LENGTH_FOR_FUZZY);
  const shortPhrases = ['actualiza', 'actualizar', 'sube', 'subir', 'importa', 'importar', 'guarda', 'guardar', 'actualizalo', 'subelo', 'importalo'];
  const normalizedShort = shortPhrases.map(normalizeForIntent);

  for (const word of words) {
    const n = normalizeForIntent(word);
    if (normalizedShort.some((p) => n === p)) return true;
    if (n.length >= MIN_WORD_LENGTH_FOR_FUZZY) {
      const match = normalizedShort.some((p) => levenshtein(n, p) <= MAX_LEVENSHTEIN_DISTANCE);
      if (match) return true;
    }
  }
  return false;
}

function messageContainsIntentExact(normalizedMessage: string): boolean {
  return INTENT_PHRASES.some((phrase) => phrase.length >= 2 && normalizedMessage.includes(phrase));
}

/**
 * Devuelve true si el mensaje del usuario indica intención de actualizar ventas
 * (subir/importar el Excel a la base para que KPIs y gráficas se actualicen).
 */
export function messageMatchesUpdateIntent(message: string): boolean {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  if (hasNegation(normalized)) return false;
  return messageContainsIntentExact(normalized) || messageContainsIntentFuzzy(normalized);
}
