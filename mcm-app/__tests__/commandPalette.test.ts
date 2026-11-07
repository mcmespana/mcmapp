/**
 * Lógica pura de la paleta ⌘K de la web (`utils/commandPalette`) y de cómo se
 * anuncia su atajo (`utils/shortcutLabel`).
 */
import {
  PALETTE_COMMANDS,
  matchCommand,
  stepIndex,
} from '@/utils/commandPalette';
import { isApplePlatform, modShortcutLabel } from '@/utils/shortcutLabel';

const byId = (id: string) => PALETTE_COMMANDS.find((c) => c.id === id)!;

describe('matchCommand', () => {
  it('sin búsqueda casan todos', () => {
    expect(PALETTE_COMMANDS.every((c) => matchCommand(c, '  '))).toBe(true);
  });

  it('busca en título, subtítulo y sinónimos, sin tildes', () => {
    expect(matchCommand(byId('fotos'), 'galeria')).toBe(true);
    expect(matchCommand(byId('mas'), 'MAS')).toBe(true);
    expect(matchCommand(byId('cancionero'), 'acordes')).toBe(true);
    expect(matchCommand(byId('calendario'), 'acordes')).toBe(false);
  });
});

describe('stepIndex', () => {
  it('baja y sube dando la vuelta en los extremos', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
  });

  it('sin resultados se queda en 0', () => {
    expect(stepIndex(4, 1, 0)).toBe(0);
  });
});

describe('modShortcutLabel', () => {
  it('⌘ en Mac y en iPad', () => {
    expect(isApplePlatform({ platform: 'MacIntel' })).toBe(true);
    expect(isApplePlatform({ userAgentData: { platform: 'macOS' } })).toBe(
      true,
    );
    expect(modShortcutLabel('k', { platform: 'iPad' })).toBe('⌘K');
  });

  it('Ctrl en Windows, Linux y cuando no hay navegador', () => {
    expect(modShortcutLabel('k', { platform: 'Win32' })).toBe('Ctrl+K');
    expect(modShortcutLabel('k', { platform: 'Linux x86_64' })).toBe('Ctrl+K');
    expect(modShortcutLabel('k', null)).toBe('Ctrl+K');
  });
});
