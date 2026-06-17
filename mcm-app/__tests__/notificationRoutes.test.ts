import {
  normalizeNotificationRoute,
  extractActionButton,
  extractActionButtons,
  MAX_ACTION_BUTTONS,
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

describe('extractActionButtons', () => {
  it('devuelve un array vacío sin datos', () => {
    expect(extractActionButtons(undefined)).toEqual([]);
    expect(extractActionButtons({})).toEqual([]);
  });

  it('devuelve varios botones desde el array actionButtons', () => {
    expect(
      extractActionButtons({
        actionButtons: [
          { text: 'Sí', url: 'https://x.com/si' },
          { text: 'No', url: 'https://x.com/no' },
          { text: 'Fotos', url: '/(tabs)/fotos' },
        ],
      }),
    ).toEqual([
      { text: 'Sí', url: 'https://x.com/si', isInternal: false },
      { text: 'No', url: 'https://x.com/no', isInternal: false },
      { text: 'Fotos', url: '/(tabs)/fotos', isInternal: true },
    ]);
  });

  it('envuelve el actionButton único (legacy) en un array', () => {
    expect(
      extractActionButtons({
        actionButton: { text: 'Ver', url: '/(tabs)/mas', isInternal: true },
      }),
    ).toEqual([{ text: 'Ver', url: '/(tabs)/mas', isInternal: true }]);
  });

  it('combina actionButton + actionButtons y deduplica por url|text', () => {
    expect(
      extractActionButtons({
        actionButton: { text: 'A', url: 'https://x.com/a' },
        actionButtons: [
          { text: 'A', url: 'https://x.com/a' }, // duplicado → se ignora
          { text: 'B', url: 'https://x.com/b' },
        ],
      }),
    ).toEqual([
      { text: 'A', url: 'https://x.com/a', isInternal: false },
      { text: 'B', url: 'https://x.com/b', isInternal: false },
    ]);
  });

  it(`limita el número de botones a ${MAX_ACTION_BUTTONS}`, () => {
    const result = extractActionButtons({
      actionButtons: [
        { text: '1', url: 'https://x.com/1' },
        { text: '2', url: 'https://x.com/2' },
        { text: '3', url: 'https://x.com/3' },
        { text: '4', url: 'https://x.com/4' },
      ],
    });
    expect(result).toHaveLength(MAX_ACTION_BUTTONS);
    expect(result.map((b) => b.text)).toEqual(['1', '2', '3']);
  });

  it('descarta botones inválidos (sin url)', () => {
    expect(
      extractActionButtons({
        actionButtons: [
          { text: 'Sin url' },
          { text: 'OK', url: '/(tabs)/mas' },
        ],
      }),
    ).toEqual([{ text: 'OK', url: '/(tabs)/mas', isInternal: true }]);
  });
});
