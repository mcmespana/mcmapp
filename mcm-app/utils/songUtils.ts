// Utilidad para mapear filenames a categorías según el ejemplo del JSON
export function getCategoryFromFilename(filename: string): string {
  // Extraer el número del filename para determinar la categoría
  const numberMatch = filename.match(/^(\d+)\./);
  if (!numberMatch) {
    return 'otros'; // Categoría por defecto
  }

  const number = parseInt(numberMatch[1]);

  // Mapear números a categorías basándose en rangos típicos
  // Esto se puede ajustar según la estructura real del cantoral
  if (number >= 1 && number <= 30) {
    return 'entrada';
  } else if (number >= 31 && number <= 60) {
    return 'salmos';
  } else if (number >= 61 && number <= 90) {
    return 'aleluya';
  } else if (number >= 91 && number <= 120) {
    return 'comunion';
  } else if (number >= 121 && number <= 150) {
    return 'salida';
  }

  return 'otros';
}

// Función para limpiar el título de la canción (quitar números y puntos iniciales)
export function cleanSongTitle(title: string): string {
  return title.replace(/^\d+\.\s*/, '').trim();
}
