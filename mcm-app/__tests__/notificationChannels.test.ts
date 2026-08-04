import {
  channelIdForCategory,
  DEFAULT_CHANNEL_ID,
  isKnownChannelId,
  NOTIFICATION_CHANNELS,
} from '@/constants/notificationChannels';
import type { NotificationCategory } from '@/types/notifications';

/**
 * Las categorías que el Panel puede mandar en `data.category`. Copiadas a mano
 * a propósito: si alguien añade una a `NotificationCategory` y no le da canal,
 * este test lo canta.
 */
const PANEL_CATEGORIES: NotificationCategory[] = [
  'general',
  'eventos',
  'cancionero',
  'fotos',
  'urgente',
  'mantenimiento',
  'celebraciones',
];

describe('catálogo de canales', () => {
  it('tiene un canal por cada categoría del Panel', () => {
    const covered = NOTIFICATION_CHANNELS.map((c) => c.category).sort();
    expect(covered).toEqual([...PANEL_CATEGORIES].sort());
  });

  it('no repite ids', () => {
    const ids = NOTIFICATION_CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('conserva `default` como id del canal general', () => {
    // Es el canal que ya existe en las instalaciones actuales: renombrar el id
    // crearía uno nuevo y perdería los ajustes del usuario.
    const general = NOTIFICATION_CHANNELS.find((c) => c.category === 'general');
    expect(general?.id).toBe(DEFAULT_CHANNEL_ID);
  });

  it('da nombre y descripción a todos los canales', () => {
    for (const channel of NOTIFICATION_CHANNELS) {
      expect(channel.name.length).toBeGreaterThan(0);
      expect(channel.description.length).toBeGreaterThan(0);
      expect(channel.lightColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('reserva heads-up (max) solo para lo que de verdad urge', () => {
    const max = NOTIFICATION_CHANNELS.filter((c) => c.importance === 'max');
    expect(max.map((c) => c.id).sort()).toEqual(['default', 'urgente']);
  });
});

describe('channelIdForCategory', () => {
  it('mapea cada categoría a su canal', () => {
    expect(channelIdForCategory('urgente')).toBe('urgente');
    expect(channelIdForCategory('eventos')).toBe('eventos');
    expect(channelIdForCategory('cancionero')).toBe('cancionero');
  });

  it('manda `general` al canal por defecto', () => {
    expect(channelIdForCategory('general')).toBe(DEFAULT_CHANNEL_ID);
  });

  it('cae en el canal por defecto con categorías desconocidas o ausentes', () => {
    // Una categoría nueva en el Panel no puede hacer desaparecer un aviso.
    expect(channelIdForCategory('inventada')).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdForCategory(undefined)).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdForCategory(null)).toBe(DEFAULT_CHANNEL_ID);
    expect(channelIdForCategory('')).toBe(DEFAULT_CHANNEL_ID);
  });
});

describe('isKnownChannelId', () => {
  it('reconoce los canales del catálogo', () => {
    for (const channel of NOTIFICATION_CHANNELS) {
      expect(isKnownChannelId(channel.id)).toBe(true);
    }
  });

  it('rechaza los que no están (se borran del sistema al sincronizar)', () => {
    expect(isKnownChannelId('canal-viejo')).toBe(false);
  });
});
