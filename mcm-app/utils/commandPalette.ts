/**
 * Lógica pura de la paleta de comandos de la web (⌘K / Ctrl+K): destinos
 * fijos, filtrado sin tildes y movimiento con las flechas. El componente
 * (`components/CommandPalette.tsx`) solo pinta y navega.
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@/components/ui/icons';
import { foldForSearch } from '@/utils/songTags';

export type PaletteIconName = ComponentProps<typeof MaterialIcons>['name'];

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon: PaletteIconName;
  /** Ruta de expo-router (`router.push`). Solo pantallas de primer nivel. */
  path: string;
  /** Sinónimos y términos relacionados que también lo encuentran. */
  keywords?: string[];
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  {
    id: 'home',
    title: 'Inicio',
    subtitle: 'Pantalla principal',
    icon: 'home',
    path: '/',
    keywords: ['home', 'principal', 'menú'],
  },
  {
    id: 'cancionero',
    title: 'Cantoral',
    subtitle: 'Canciones con acordes',
    icon: 'music-note',
    path: '/cancionero',
    keywords: ['canciones', 'songs', 'acordes', 'cantar', 'cancionero'],
  },
  {
    id: 'calendario',
    title: 'Calendario',
    subtitle: 'Eventos y celebraciones',
    icon: 'event',
    path: '/calendario',
    keywords: ['eventos', 'agenda', 'fechas', 'calendar'],
  },
  {
    id: 'fotos',
    title: 'Fotos',
    subtitle: 'Galería de imágenes',
    icon: 'photo-library',
    path: '/fotos',
    keywords: ['gallery', 'imágenes', 'galería', 'álbum'],
  },
  {
    id: 'mas',
    title: 'Más',
    subtitle: 'Grupos, Materiales, Visitas...',
    icon: 'apps',
    path: '/mas',
    keywords: ['más', 'grupos', 'materiales', 'visitas', 'contactos'],
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    icon: 'notifications',
    path: '/notifications',
    keywords: ['avisos', 'mensajes', 'noti'],
  },
  {
    id: 'wordle',
    title: 'Wordle',
    subtitle: 'Juego diario',
    icon: 'sports-esports',
    path: '/wordle',
    keywords: ['juego', 'game', 'palabras'],
  },
];

/** ¿Casa el comando con lo tecleado? Sin tildes: «galeria» encuentra «Galería». */
export function matchCommand(cmd: PaletteCommand, query: string): boolean {
  const q = foldForSearch(query).trim();
  if (!q) return true;
  return [cmd.title, cmd.subtitle ?? '', ...(cmd.keywords ?? [])].some((t) =>
    foldForSearch(t).includes(q),
  );
}

/**
 * Siguiente resultado resaltado al pulsar ↓ (`+1`) o ↑ (`-1`). Da la vuelta
 * en los extremos, como cualquier paleta; sin resultados se queda en 0.
 */
export function stepIndex(current: number, delta: 1 | -1, count: number) {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
