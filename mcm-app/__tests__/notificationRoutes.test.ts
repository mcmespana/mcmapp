import {
  normalizeNotificationRoute,
  extractActionButton,
} from '@/utils/notificationRoutes';

describe('normalizeNotificationRoute', () => {
  it('deja pasar URLs externas sin tocar', () => {
    expect(normalizeNotificationRoute('https://mcmespana.com/x')).toBe(
      'https://mcmespana.com/x',
    );
  });

  it('prefija las tabs reales con el grupo (tabs)', () => {
    expect(normalizeNotificationRoute('cancionero')).toBe('/(tabs)/cancionero');
    expect(normalizeNotificationRoute('/fotos')).toBe('/(tabs)/fotos');
    expect(normalizeNotificationRoute('/(tabs)/calendario')).toBe(
      '/(tabs)/calendario',
    );
  });

  it('mapea rutas heredadas/incorrectas del panel a la ruta real', () => {
    expect(normalizeNotificationRoute('/(tabs)/actividades')).toBe(
      '/(tabs)/mas',
    );
    expect(normalizeNotificationRoute('/(tabs)/jubileo')).toBe('/(tabs)/mas');
    expect(normalizeNotificationRoute('/(tabs)/albums')).toBe('/(tabs)/fotos');
    expect(normalizeNotificationRoute('/(tabs)/wordle')).toBe('/wordle');
    expect(normalizeNotificationRoute('jubileo')).toBe('/(tabs)/mas');
    expect(normalizeNotificationRoute('albums')).toBe('/(tabs)/fotos');
  });

  it('corrige el centro de notificaciones a su ruta raíz', () => {
    expect(normalizeNotificationRoute('/(tabs)/notifications')).toBe(
      '/notifications',
    );
    expect(normalizeNotificationRoute('notifications')).toBe('/notifications');
  });

  it('colapsa barras y quita la barra final', () => {
    expect(normalizeNotificationRoute('//fotos//')).toBe('/(tabs)/fotos');
  });

  it('mantiene subrutas de contigo', () => {
    expect(normalizeNotificationRoute('contigo/evangelio')).toBe(
      '/(tabs)/contigo/evangelio',
    );
  });
});

describe('extractActionButton', () => {
  it('devuelve undefined sin datos', () => {
    expect(extractActionButton(undefined)).toBeUndefined();
    expect(extractActionButton({})).toBeUndefined();
  });

  it('lee el formato canónico actionButton (objeto)', () => {
    expect(
      extractActionButton({
        actionButton: { text: 'Ver', url: '/(tabs)/fotos', isInternal: true },
      }),
    ).toEqual({ text: 'Ver', url: '/(tabs)/fotos', isInternal: true });
  });

  it('acepta el formato del contrato actionButtons (array) usando el primero', () => {
    expect(
      extractActionButton({
        actionButtons: [{ text: 'Abrir', url: 'https://x.com' }],
      }),
    ).toEqual({ text: 'Abrir', url: 'https://x.com', isInternal: false });
  });

  it('infiere isInternal cuando no viene: http = externo, ruta = interno', () => {
    expect(
      extractActionButton({ actionButtons: [{ url: '/(tabs)/mas' }] }),
    ).toEqual({ text: 'Ver', url: '/(tabs)/mas', isInternal: true });
    expect(
      extractActionButton({ actionButtons: [{ url: 'http://x.com' }] }),
    ).toEqual({ text: 'Ver', url: 'http://x.com', isInternal: false });
  });
});
