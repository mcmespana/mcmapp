/**
 * Test de `contexts/CalendarConfigContext.tsx`.
 *
 * Wrapper fino sobre `useCalendarConfigs` (ya testeado a fondo en
 * `useCalendarConfigs.test.ts`): aquí solo importa que el Provider exponga
 * ese mismo valor y que usar el hook fuera del Provider falle alto y claro
 * en vez de devolver `undefined` en silencio.
 */
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import {
  CalendarConfigProvider,
  useCalendarConfig,
} from '@/contexts/CalendarConfigContext';

const mockValue = {
  calendarConfigs: [{ id: 'a', name: 'a', url: 'https://x', color: '#000' }],
  visibleCalendars: [true],
  toggleCalendarVisibility: jest.fn(),
  loading: false,
  offline: false,
};

jest.mock('@/hooks/useCalendarConfigs', () => ({
  useCalendarConfigs: () => mockValue,
}));

describe('CalendarConfigProvider / useCalendarConfig', () => {
  it('expone el valor de useCalendarConfigs a través del contexto', async () => {
    const { result } = await renderHook(() => useCalendarConfig(), {
      wrapper: ({ children }) => (
        <CalendarConfigProvider>{children}</CalendarConfigProvider>
      ),
    });
    expect(result.current).toBe(mockValue);
  });

  it('lanza si se usa fuera del Provider', async () => {
    const { result } = await renderHook(() => {
      try {
        return useCalendarConfig();
      } catch (err) {
        return err;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toContain(
      'useCalendarConfig must be used within CalendarConfigProvider',
    );
  });
});
