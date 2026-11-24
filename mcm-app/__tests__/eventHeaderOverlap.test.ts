// Dos maneras en que la cabecera de un evento ha tapado contenido arriba
// (revisión de las pantallas de evento, 2026-11-24):
//
// 1. En iOS el stack del evento pone `headerTransparent` para las pantallas con
//    hero propio. Las que usan la barra de color con título (Material, Comida,
//    el visor web) no reservan esa altura: con la barra transparente su
//    contenido empezaba DEBAJO de ella y salía cortado.
// 2. Los botones flotantes del evento (Compartiendo + Ajustes) van arriba a la
//    derecha. En la Evaluación, que no tiene cabecera, tapaban su X de cerrar;
//    en el visor web, su botón de «abrir fuera».
import { Platform } from 'react-native';

jest.mock('@/components/ui/GlassHeader.ios', () => () => null);
jest.mock('@/components/ui/GlassBackButton', () => () => null);

import { eventScreenOptions } from '@/app/screens/eventStackScreens';
import {
  EVENT_ACTION_SLUGS,
  EVENT_SLUGS,
  EVENT_SUB_SLUGS,
} from '@/utils/eventRoutes';

describe('cabecera de las pantallas de evento', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('en iOS, la barra con título NO es transparente (ocupa su sitio)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const opts = eventScreenOptions('Material')({
      route: { params: {} },
      theme: { dark: false },
    }) as { headerTransparent?: boolean };
    expect(opts.headerTransparent).toBe(false);
  });

  it('en iOS, el texto de la barra con título sigue el tema (legible en oscuro)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const light = eventScreenOptions('Material')({
      route: { params: {} },
      theme: { dark: false },
    }) as { headerTintColor?: string };
    const dark = eventScreenOptions('Material')({
      route: { params: {} },
      theme: { dark: true },
    }) as { headerTintColor?: string };
    expect(light.headerTintColor).not.toBe(dark.headerTintColor);
  });

  it('los botones flotantes no salen donde hay un control propio arriba', () => {
    expect(EVENT_ACTION_SLUGS).not.toContain(EVENT_SLUGS.Evaluacion);
    expect(EVENT_ACTION_SLUGS).not.toContain(EVENT_SLUGS.ComidaWeb);
    // …y siguen en el resto.
    expect(EVENT_ACTION_SLUGS).toContain(EVENT_SLUGS.Horario);
    expect(EVENT_ACTION_SLUGS.length).toBe(EVENT_SUB_SLUGS.length - 2);
  });
});
