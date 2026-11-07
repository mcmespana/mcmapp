/**
 * `utils/otaAutoApply.ts`: cuándo se aplica una OTA descargada sin preguntar.
 * Lo importante es lo que NO hace: interrumpir a alguien a media pantalla o
 * entrar en un bucle de recargas.
 */
import {
  AUTO_APPLY_COOLDOWN_MS,
  FRESH_WINDOW_MS,
  shouldAutoApply,
} from '@/utils/otaAutoApply';

const NOW = 1_000_000;
const ctx = (over: Partial<Parameters<typeof shouldAutoApply>[0]> = {}) => ({
  trigger: 'ready' as const,
  now: NOW,
  activeSince: NOW - 5_000,
  lastAutoApplyAt: null,
  ...over,
});

describe('shouldAutoApply', () => {
  it('update listo con la app recién abierta → se aplica', () => {
    expect(shouldAutoApply(ctx())).toBe(true);
    expect(shouldAutoApply(ctx({ activeSince: NOW - FRESH_WINDOW_MS }))).toBe(
      true,
    );
  });

  it('update listo con la app ya en uso → NO interrumpe', () => {
    expect(
      shouldAutoApply(ctx({ activeSince: NOW - FRESH_WINDOW_MS - 1 })),
    ).toBe(false);
  });

  it('al volver del fondo se aplica aunque llevara mucho abierta antes', () => {
    expect(
      shouldAutoApply(
        ctx({ trigger: 'foreground', activeSince: NOW - 3_600_000 }),
      ),
    ).toBe(true);
  });

  it('cortafuegos: tras una aplicación reciente no repite, ni al volver del fondo', () => {
    const recent = NOW - AUTO_APPLY_COOLDOWN_MS + 1;
    expect(shouldAutoApply(ctx({ lastAutoApplyAt: recent }))).toBe(false);
    expect(
      shouldAutoApply(ctx({ trigger: 'foreground', lastAutoApplyAt: recent })),
    ).toBe(false);
  });

  it('pasado el cortafuegos, vuelve a poder aplicar', () => {
    expect(
      shouldAutoApply(ctx({ lastAutoApplyAt: NOW - AUTO_APPLY_COOLDOWN_MS })),
    ).toBe(true);
  });
});
