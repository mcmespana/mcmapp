// Utilidad para mapear categorías de Firebase a categorías con prefijos para organización

// Nueva función para mapear categorías de Firebase a categorías organizadas
export function getCategoryFromFirebaseCategory(firebaseCategory: string): string {
  const categoryMap: Record<string, string> = {
    'adoracion': 'catAadoracion',
    'aleluya': 'catBaleluya',
    'comunion': 'catCcomunion',
    'entrada': 'catDentrada',
    'himnos': 'catEhimnos',
    'ofertorio': 'catFofertorio',
    'salida': 'catGsalida',
    'salmos': 'catHsalmos',
    'santo': 'catIsanto',
  };

  return categoryMap[firebaseCategory] || 'catZotros';
}

// Función para limpiar el título de la canción (quitar números y puntos iniciales)
export function cleanSongTitle(title: string): string {
  return title.replace(/^\d+\.\s*/, '').trim();
}
