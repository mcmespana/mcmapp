/**
 * Abrir una pantalla del área en frío (un enlace, un aviso, recargar la web):
 * la pantalla se monta y pide sus datos ANTES de que la sesión termine de
 * restaurarse. Al saberse quién es, el proveedor cambiaba de caché con
 * `clear()` y la consulta ya montada se quedaba huérfana: esqueleto para
 * siempre (pasaba en el resumen de grupos, el árbol y el historial).
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import ComunicaAreaProvider from '@/components/comunica/comun/ComunicaAreaProvider';
import {
  __resetComunicaApiForTests,
  getComunicaApi,
  getFakeServer,
} from '@/services/comunica';
import { __resetSessionForTests, signIn } from '@/services/comunica/session';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { useCoordinationSummary } from '@/hooks/comunica/coordination';

jest.mock('expo-image', () => ({
  Image: {
    clearDiskCache: jest.fn().mockResolvedValue(true),
    clearMemoryCache: jest.fn().mockResolvedValue(true),
    prefetch: jest.fn().mockResolvedValue(true),
  },
}));

const seen: { status: string; error?: string } = { status: 'none' };

function Summary() {
  const q = useCoordinationSummary();
  seen.status = q.status;
  seen.error = q.error ? String(q.error) : '';
  return null;
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

afterEach(() => {
  __resetComunicaApiForTests();
  __resetSessionForTests();
});

it('una pantalla montada antes de entrar recibe sus datos al entrar', async () => {
  __resetSessionForTests();
  __resetComunicaApiForTests();
  setStorageBackend(memoryBackend());
  getComunicaApi();
  const fake = getFakeServer()!;
  fake.setControls({ latencyMs: 0 });

  // Sin `client`: el proveedor crea el suyo, como en la app.
  await act(async () => {
    create(
      <ComunicaAreaProvider>
        <Summary />
      </ComunicaAreaProvider>,
    );
  });
  await wait(50);

  // La sesión termina de restaurarse DESPUÉS de montar la pantalla.
  const t = fake.issueSession('coordination');
  await act(async () => {
    await signIn(t, t.me);
  });

  for (let i = 0; i < 80 && seen.status !== 'success'; i++) await wait(25);
  expect(seen).toEqual({ status: 'success', error: '' });
});
