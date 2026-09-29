// Utilidad para mapear categorías de Firebase a categorías con prefijos para organización

// Nueva función para mapear categorías de Firebase a categorías organizadas
export function getCategoryFromFirebaseCategory(
  firebaseCategory: string,
): string {
  const categoryMap: Record<string, string> = {
    adoracion: 'catAadoracion',
    aleluya: 'catBaleluya',
    comunion: 'catCcomunion',
    entrada: 'catDentrada',
    himnos: 'catEhimnos',
    ofertorio: 'catFofertorio',
    salida: 'catGsalida',
    salmos: 'catHsalmos',
    santo: 'catIsanto',
  };

  return categoryMap[firebaseCategory] || 'catZotros';
}

/**
 * Quita el prefijo de ordenación del título de una categoría del cantoral.
 *
 * Las categorías llegan de Firebase como `"C. Cantos de entrada"`: la letra
 * está solo para ordenarlas y no se enseña. El prefijo se reconoce por el
 * SEPARADOR (`.` o `)`), no por la letra suelta.
 *
 * Antes esto era un `replace` en línea dentro de `CategoriesScreen` cuyo
 * patrón hacía OPCIONAL el punto (`\w` + punto opcional + espacios): una
 * categoría SIN prefijo perdía su primera letra («Adoración» → «doración»,
 * «Entrada» → «ntrada»). Hoy no se nota porque todas las categorías reales
 * traen su «X. », pero basta con que alguien cree una desde el panel sin
 * prefijo. Se vio el 2026-09-09 renderizando el cantoral con datos de prueba.
 */
export function stripCategoryPrefix(title: string): string {
  return title.replace(/^\w[.)]\s*/, '').trim();
}

// Función para limpiar el título de la canción (quitar números y puntos iniciales)
export function cleanSongTitle(title: string): string {
  return title.replace(/^\d+\.\s*/, '').trim();
}
