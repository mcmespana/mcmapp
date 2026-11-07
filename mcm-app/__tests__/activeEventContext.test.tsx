/**
 * Tests de `ActiveEventContext`: qué evento está "en curso" (tab propia,
 * botón en Home, banner) — configurable desde el panel MCM vía
 * `activities/_meta` sin publicar una versión nueva de la app. Lo
 * importante:
 *
 *  - Sin dato remoto (o mientras carga), cae al `ACTIVE_EVENT_ID` hardcoded.
 *  - Con `activeEventId` remoto, cambia de evento activo.
 *  - Se piden los metadatos (`_meta` per-evento) de TODOS los eventos del
 *    registry, no solo el activo — así "Eventos pasados" también ve
 *    archivados/renombrados por el panel.
 *  - `mergeEventMeta` (ya testeado aparte) se aplica tanto al evento activo
 *    como a la lista completa.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useEventsMeta } from '@/hooks/useEventMeta';
import {
  ActiveEventProvider,
  useActiveMeta,
} from '@/contexts/ActiveEventContext';
import { ACTIVE_EVENT_ID, EVENTS, getEvent } from '@/constants/events';

jest.mock('@/hooks/useFirebaseData', () => ({
  useFirebaseData: jest.fn(() => ({ data: null })),
}));
jest.mock('@/hooks/useEventMeta', () => ({
  useEventsMeta: jest.fn(() => ({})),
}));

const JUBILEO_ID = Object.keys(EVENTS).find((id) => id !== ACTIVE_EVENT_ID)!;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ActiveEventProvider>{children}</ActiveEventProvider>
);

async function mount() {
  return renderHook(() => useActiveMeta(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useFirebaseData as jest.Mock).mockReturnValue({ data: null });
  (useEventsMeta as jest.Mock).mockReturnValue({});
});

describe('evento activo por defecto', () => {
  it('sin dato remoto, usa ACTIVE_EVENT_ID', async () => {
    const { result } = await mount();
    expect(result.current.activeEventId).toBe(ACTIVE_EVENT_ID);
    expect(result.current.activeEvent).toEqual(getEvent(ACTIVE_EVENT_ID));
  });

  it('pide los metadatos de TODOS los eventos del registry', async () => {
    await mount();
    const idsArg = (useEventsMeta as jest.Mock).mock.calls[0][0] as string[];
    expect(new Set(idsArg)).toEqual(
      new Set([...Object.keys(EVENTS), ACTIVE_EVENT_ID]),
    );
  });
});

describe('override remoto del evento activo', () => {
  it('cambia de evento activo si Firebase lo indica', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: { activeEventId: JUBILEO_ID },
    });
    const { result } = await mount();
    expect(result.current.activeEventId).toBe(JUBILEO_ID);
    expect(result.current.activeEvent).toEqual(getEvent(JUBILEO_ID));
  });

  it('incluye el evento activo remoto en la lista pedida a useEventsMeta', async () => {
    (useFirebaseData as jest.Mock).mockReturnValue({
      data: { activeEventId: JUBILEO_ID },
    });
    await mount();
    const idsArg = (useEventsMeta as jest.Mock).mock.calls[0][0] as string[];
    expect(idsArg).toEqual(expect.arrayContaining([JUBILEO_ID]));
  });
});

describe('aplicación de mergeEventMeta', () => {
  it('el evento activo refleja el override remoto (título)', async () => {
    (useEventsMeta as jest.Mock).mockReturnValue({
      [ACTIVE_EVENT_ID]: { title: 'Título nuevo del panel' },
    });
    const { result } = await mount();
    expect(result.current.activeEvent.title).toBe('Título nuevo del panel');
  });

  it('la lista `events` completa también refleja los overrides por id', async () => {
    (useEventsMeta as jest.Mock).mockReturnValue({
      [JUBILEO_ID]: { status: 'archived' },
    });
    const { result } = await mount();
    const jubileo = result.current.events.find((e) => e.id === JUBILEO_ID);
    expect(jubileo?.status).toBe('archived');
  });

  it('sin meta para un evento, conserva su config del registry tal cual', async () => {
    const { result } = await mount();
    expect(result.current.events).toEqual(Object.values(EVENTS));
  });
});

describe('fuera del provider', () => {
  it('devuelve el fallback hardcoded (createContext con default real)', async () => {
    const { result } = await renderHook(() => useActiveMeta());
    expect(result.current.activeEventId).toBe(ACTIVE_EVENT_ID);
    expect(result.current.activeEvent).toEqual(getEvent(ACTIVE_EVENT_ID));
    expect(result.current.events).toEqual(Object.values(EVENTS));
  });
});
