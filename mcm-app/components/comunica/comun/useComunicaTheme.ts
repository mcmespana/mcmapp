import { useMemo } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { comunicaTheme } from './theme';

/** El tema del área para el modo activo (claro u oscuro). */
export function useComunicaTheme() {
  const isDark = useColorScheme() === 'dark';
  return useMemo(() => ({ ...comunicaTheme(isDark), isDark }), [isDark]);
}
