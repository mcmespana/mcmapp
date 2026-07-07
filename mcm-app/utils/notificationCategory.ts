// utils/notificationCategory.ts
//
// Presentación visual de la categoría de negocio de una notificación
// (`data.category`, ver docs/contratos/NOTIFICACIONES_CONTRATO.md §6). Hasta
// ahora la app guardaba la categoría pero no la pintaba. Este helper puro
// traduce cada categoría a una etiqueta legible, un color con suficiente
// contraste y un icono de MaterialIcons para mostrar un chip en la tarjeta y en
// el modal de detalle.
//
// Decisión de diseño: la categoría por defecto (`general`), la ausente y las
// desconocidas NO pintan chip (devuelven null). Así solo destacan las
// categorías con significado propio y la lista no se llena de ruido.

import type { NotificationCategory } from '@/types/notifications';

export interface CategoryVisual {
  /** Etiqueta corta y legible para el chip. */
  label: string;
  /** Color del chip (borde + texto + tinte de fondo). Elegido por contraste. */
  color: string;
  /** Nombre de icono de `@expo/vector-icons/MaterialIcons`. */
  icon: string;
}

// Paleta pensada para contraste legible sobre fondo claro y oscuro (el chip usa
// el color como borde/texto y un tinte muy suave de fondo). Se apoya en los
// colores de marca (`constants/colors.ts`) donde son legibles y ajusta los que
// no lo serían (p. ej. el amarillo de `warning`).
const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  eventos: { label: 'Eventos', color: '#31AADF', icon: 'event' },
  cancionero: { label: 'Cantoral', color: '#4E8A1F', icon: 'music-note' },
  fotos: { label: 'Fotos', color: '#0E7490', icon: 'photo-library' },
  urgente: { label: 'Urgente', color: '#C62828', icon: 'priority-high' },
  mantenimiento: {
    label: 'Mantenimiento',
    color: '#8A6D00',
    icon: 'build',
  },
  celebraciones: {
    label: 'Celebración',
    color: '#9D1E74',
    icon: 'celebration',
  },
};

/**
 * Devuelve la presentación visual de una categoría, o `null` cuando no debe
 * pintarse chip (`general`, ausente o valor desconocido). Tolera cualquier
 * string para no romperse con categorías futuras que aún no conozca la app.
 */
export function categoryVisual(
  category?: NotificationCategory | string | null,
): CategoryVisual | null {
  if (!category || typeof category !== 'string') return null;
  return CATEGORY_VISUALS[category] ?? null;
}
