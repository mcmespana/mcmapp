/**
 * Tests de `hooks/useCarismochitoAvailable.ts`: junta la configuración del
 * panel (`global.carismochito`) con el modo tester. Lo delicado es `settled`:
 * mientras no se haya leído la configuración Y el modo tester, "no disponible"
 * es solo "no lo sé aún" y no se debe apagar nada por ello.
 */
import { renderHook } from '@testing-library/react-native';
import { useCarismochitoAvailable } from '@/hooks/useCarismochitoAvailable';

const mockProfile: { rawConfig: unknown; loading: boolean } = {
  rawConfig: null,
  loading: false,
};
const mockPreview = { enabled: false, hydrated: true };

jest.mock('@/contexts/ProfileConfigContext', () => ({
  useProfileConfigContext: () => mockProfile,
}));
jest.mock('@/contexts/PreviewChannelContext', () => ({
  usePreviewChannel: () => mockPreview,
}));

beforeEach(() => {
  mockProfile.rawConfig = null;
  mockProfile.loading = false;
  mockPreview.enabled = false;
  mockPreview.hydrated = true;
});

it('sin configuración y sin modo tester: no disponible, pero ya se sabe', async () => {
  const { result } = await renderHook(() => useCarismochitoAvailable());
  expect(result.current).toEqual({ available: false, settled: true });
});

it('"alpha" (defecto) + modo tester: disponible', async () => {
  mockPreview.enabled = true;
  const { result } = await renderHook(() => useCarismochitoAvailable());
  expect(result.current.available).toBe(true);
});

it('"all" abre a todos; "off" cierra incluso al modo tester', async () => {
  mockProfile.rawConfig = { global: { carismochito: 'all' } };
  const open = await renderHook(() => useCarismochitoAvailable());
  expect(open.result.current.available).toBe(true);

  mockProfile.rawConfig = { global: { carismochito: 'off' } };
  mockPreview.enabled = true;
  const closed = await renderHook(() => useCarismochitoAvailable());
  expect(closed.result.current.available).toBe(false);
});

it('no está "settled" mientras carga la configuración o el modo tester', async () => {
  mockProfile.loading = true;
  const a = await renderHook(() => useCarismochitoAvailable());
  expect(a.result.current.settled).toBe(false);

  mockProfile.loading = false;
  mockPreview.hydrated = false;
  const b = await renderHook(() => useCarismochitoAvailable());
  expect(b.result.current.settled).toBe(false);
});
