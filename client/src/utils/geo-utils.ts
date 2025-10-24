// Coordenadas de códigos postales para México
// Datos de ejemplo para nuestro sistema
export const ZIP_CODE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Ciudad de México
  "01000": { lat: 19.3356, lng: -99.2045 },
  // Guadalajara
  "44100": { lat: 20.6597, lng: -103.3496 },
  // Zapopan
  "44130": { lat: 20.7238, lng: -103.3844 },
  // Tlaquepaque
  "44160": { lat: 20.6403, lng: -103.3101 },
  // Monterrey
  "64000": { lat: 25.6866, lng: -100.3161 },
  // Puebla
  "72000": { lat: 19.0414, lng: -98.2063 },
  // Aguascalientes
  "20000": { lat: 21.8818, lng: -102.2916 },
  // Tijuana
  "22000": { lat: 32.5027, lng: -117.0037 },
  // Hermosillo
  "83000": { lat: 29.0729, lng: -110.9559 },
  // San Luis Potosí
  "78000": { lat: 22.1565, lng: -100.9855 },
  // Mérida
  "97000": { lat: 20.9674, lng: -89.5926 },
  // Xalapa
  "91000": { lat: 19.5438, lng: -96.9102 },
  // Morelia
  "58000": { lat: 19.7060, lng: -101.1950 },
  // Cuernavaca
  "62000": { lat: 18.9242, lng: -99.2216 },
  // Tuxtla Gutiérrez
  "29000": { lat: 16.7569, lng: -93.1292 },
  // Pachuca
  "42000": { lat: 20.1168, lng: -98.7332 },
  // Querétaro
  "76000": { lat: 20.5888, lng: -100.3899 },
  // Chihuahua
  "31000": { lat: 28.6353, lng: -106.0889 },
  // Durango
  "34000": { lat: 24.0277, lng: -104.6532 },
  // Villahermosa
  "86000": { lat: 17.9904, lng: -92.9304 },
  // Altamira (solicitado por Thalia)
  "89600": { lat: 22.4025, lng: -97.9297 },
  // Nextipac (solicitado por Thalia)
  "45200": { lat: 20.7503, lng: -103.4500 }
};

/**
 * Obtiene las coordenadas de una dirección a partir de su código postal
 * @param address Dirección en formato "Ciudad, Estado (CP: XXXXX)"
 * @returns Coordenadas o un valor predeterminado si no se encuentra
 */
export function getCoordinates(address: string): { lat: number; lng: number } {
  const zipCode = extractZipCode(address);
  
  if (zipCode && ZIP_CODE_COORDINATES[zipCode]) {
    return ZIP_CODE_COORDINATES[zipCode];
  }
  
  // Valor predeterminado (Ciudad de México) si no se encuentra
  return { lat: 19.3356, lng: -99.2045 };
}

/**
 * Extrae el código postal de un string en diferentes formatos posibles
 * Soporta formatos como "Ciudad, Estado (CP: XXXXX)" o "Ciudad, Estado (XXXXX)"
 * o incluso simplemente texto que contenga "(XXXXX)" donde XXXXX son dígitos
 */
export function extractZipCode(address: string): string | null {
  // Formato exacto "CP: XXXXX"
  let match = address.match(/\(CP:\s*(\d+)\)/);
  if (match) return match[1];
  
  // Formato alternativo "(XXXXX)" donde XXXXX son 5 dígitos
  match = address.match(/\((\d{5})\)/);
  if (match) return match[1];
  
  // Búsqueda genérica de 5 dígitos consecutivos
  match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

/**
 * Calcular la distancia entre dos puntos usando la fórmula de Haversine
 * (distancia más corta entre dos puntos en una esfera)
 */
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distancia en km
  
  return Math.round(distance); // Redondear a km enteros
}

/**
 * Convertir grados a radianes
 */
function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calcular la distancia entre dos direcciones
 * Ahora más flexible para manejar entradas manuales
 */
export function calculateDistanceBetweenAddresses(
  originAddress: string,
  destinationAddress: string
): number | null {
  // Intentar extraer códigos postales de las direcciones
  const originZip = extractZipCode(originAddress);
  const destinationZip = extractZipCode(destinationAddress);
  
  // Si no se pueden extraer los códigos postales o encontrar coordenadas,
  // asignar distancias aproximadas según el patrón de la entrada manual
  
  if (!originZip || !destinationZip) {
    // Para entradas manuales, estimamos distancias predeterminadas según patrones comunes
    
    // Caso: Centro del país a frontera norte
    if (
      (originAddress.toLowerCase().includes("méxico") && 
       (destinationAddress.toLowerCase().includes("tijuana") || 
        destinationAddress.toLowerCase().includes("juárez") ||
        destinationAddress.toLowerCase().includes("juarez") ||
        destinationAddress.toLowerCase().includes("nuevo laredo"))) ||
      (destinationAddress.toLowerCase().includes("méxico") && 
       (originAddress.toLowerCase().includes("tijuana") || 
        originAddress.toLowerCase().includes("juárez") ||
        originAddress.toLowerCase().includes("juarez") ||
        originAddress.toLowerCase().includes("nuevo laredo")))
    ) {
      return 1800; // ~1800 km
    }
    
    // Caso: Guadalajara a Monterrey
    if (
      (originAddress.toLowerCase().includes("guadalajara") && destinationAddress.toLowerCase().includes("monterrey")) ||
      (destinationAddress.toLowerCase().includes("guadalajara") && originAddress.toLowerCase().includes("monterrey"))
    ) {
      return 850; // ~850 km
    }
    
    // Caso: Ciudad de México a Guadalajara
    if (
      (originAddress.toLowerCase().includes("méxico") && destinationAddress.toLowerCase().includes("guadalajara")) ||
      (destinationAddress.toLowerCase().includes("méxico") && originAddress.toLowerCase().includes("guadalajara"))
    ) {
      return 550; // ~550 km
    }
    
    // Caso: Ciudad de México a Monterrey
    if (
      (originAddress.toLowerCase().includes("méxico") && destinationAddress.toLowerCase().includes("monterrey")) ||
      (destinationAddress.toLowerCase().includes("méxico") && originAddress.toLowerCase().includes("monterrey"))
    ) {
      return 900; // ~900 km
    }
    
    // Caso: Distancia corta por defecto (destinos cercanos)
    if (originAddress && destinationAddress) {
      return 300; // Valor predeterminado ~300 km
    }
    
    return null; // No se puede calcular
  }
  
  // Intento tradicional con códigos postales
  const originCoords = ZIP_CODE_COORDINATES[originZip];
  const destinationCoords = ZIP_CODE_COORDINATES[destinationZip];
  
  if (!originCoords || !destinationCoords) {
    return 350; // Valor predeterminado si no encontramos las coordenadas
  }
  
  return calculateDistance(
    originCoords.lat,
    originCoords.lng,
    destinationCoords.lat,
    destinationCoords.lng
  );
}