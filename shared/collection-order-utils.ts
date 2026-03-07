/**
 * Utilidades para cálculos de órdenes de recolección
 * Reglas de negocio:
 *   1 tambo = 200 kg
 *   4 tambos = 1 tarima
 */

export const KG_PER_DRUM = 200;
export const DRUMS_PER_PALLET = 4;

export interface PalletDistribution {
  totalWeightKg: number;
  totalTarimas: number;
  fullPallets: number;
  remainderDrums: number;
  description: string;
}

/**
 * Calcula la distribución de tarimas a partir del número de tambos.
 * Ejemplo: 10 tambos -> 2,000 kg -> 2 tarimas de 4 + 1 tarima de 2
 */
export function calculatePalletDistribution(drumCount: number): PalletDistribution {
  if (drumCount <= 0) {
    return {
      totalWeightKg: 0,
      totalTarimas: 0,
      fullPallets: 0,
      remainderDrums: 0,
      description: '',
    };
  }

  const totalWeightKg = drumCount * KG_PER_DRUM;
  const fullPallets = Math.floor(drumCount / DRUMS_PER_PALLET);
  const remainderDrums = drumCount % DRUMS_PER_PALLET;
  const totalTarimas = fullPallets + (remainderDrums > 0 ? 1 : 0);

  const parts: string[] = [];
  if (fullPallets > 0) {
    parts.push(`${fullPallets} TARIMA${fullPallets > 1 ? 'S' : ''} CON ${DRUMS_PER_PALLET} TAMBORES`);
  }
  if (remainderDrums > 0) {
    parts.push(`1 TARIMA CON ${remainderDrums} TAMBOR${remainderDrums > 1 ? 'ES' : ''}`);
  }

  return {
    totalWeightKg,
    totalTarimas,
    fullPallets,
    remainderDrums,
    description: parts.join(' y '),
  };
}
