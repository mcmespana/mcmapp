/**
 * Test de `contexts/OTAContext.tsx`.
 *
 * Wrapper de `useOTAUpdate` que espera a que `PreviewChannelContext` esté
 * hidratado antes de comprobar updates — si `OTAProvider` pidiera el update
 * antes de tiempo, un tester en modo alpha podría acabar pidiéndoselo a
 * `production` por ganarle la carrera al override del canal.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { OTAProvider, useOTAContext } from '@/contexts/OTAContext';

let mockHydrated = true;
const mockOta = {
  isReady: false,
  isDownloading: false,
  error: null as Error | null,
  applyUpdate: jest.fn(),
};
const mockUseOTAUpdate = jest.fn((opts: { ready: boolean }) => {
  mockLastReadyArg = opts.ready;
  return mockOta;
});
let mockLastReadyArg: boolean | undefined;

jest.mock('@/contexts/PreviewChannelContext', () => ({
  usePreviewChannel: () => ({ hydrated: mockHydrated }),
}));

jest.mock('@/hooks/useOTAUpdate', () => ({
  __esModule: true,
  default: (opts: { ready: boolean }) => mockUseOTAUpdate(opts),
}));

beforeEach(() => {
  mockHydrated = true;
  mockLastReadyArg = undefined;
  mockOta.isReady = false;
  mockOta.isDownloading = false;
  mockOta.error = null;
  jest.clearAllMocks();
});

describe('useOTAContext sin Provider', () => {
  it('devuelve los valores por defecto', async () => {
    const { result } = await renderHook(() => useOTAContext());
    expect(result.current.isReady).toBe(false);
    expect(result.current.dismissed).toBe(false);
  });
});

describe('OTAProvider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <OTAProvider>{children}</OTAProvider>
  );

  it('pasa `ready` a useOTAUpdate desde el hydrated del canal', async () => {
    mockHydrated = false;
    await renderHook(() => useOTAContext(), { wrapper });
    expect(mockLastReadyArg).toBe(false);
  });

  it('espera a hydrated: true para permitir la comprobación', async () => {
    mockHydrated = true;
    await renderHook(() => useOTAContext(), { wrapper });
    expect(mockLastReadyArg).toBe(true);
  });

  it('expone isReady/isDownloading/error/applyUpdate de useOTAUpdate', async () => {
    mockOta.isReady = true;
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    expect(result.current.isReady).toBe(true);
    expect(result.current.applyUpdate).toBe(mockOta.applyUpdate);
  });

  it('dismissed empieza en false y setDismissed lo cambia', async () => {
    const { result } = await renderHook(() => useOTAContext(), { wrapper });
    expect(result.current.dismissed).toBe(false);
    expect(typeof result.current.setDismissed).toBe('function');
  });
});
