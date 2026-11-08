/**
 * Reglas de plataforma del `BottomSheet` compartido (lo usan ~30 hojas).
 *
 *  · Teclado: en Android la hoja no subía nunca (solo se escuchaba
 *    `keyboardWillShow`, que Android no emite), y el teclado tapaba el campo
 *    y el botón de enviar de Feedback, Sugerir canción, login, código de coro…
 *  · Ancho: en web de escritorio y iPad las hojas ocupaban todo el ancho del
 *    monitor. Decisión del usuario (2026-10-16): ~560 px y centradas.
 */
import {
  keyboardHeightFromFrame,
  keyboardShiftDuration,
  sheetWidthFor,
} from '@/components/BottomSheet';
import { keyboardEventsFor } from '@/hooks/useKeyboardVisible';
import { durations } from '@/constants/animations';
import { breakpoints, sheetMaxWidth } from '@/constants/breakpoints';

describe('keyboardEventsFor', () => {
  it('iOS escucha los avisos previos para subir a la vez que el teclado', () => {
    expect(keyboardEventsFor('ios')).toEqual({
      show: 'keyboardWillShow',
      hide: 'keyboardWillHide',
    });
  });

  it('Android escucha los Did*, que son los únicos que emite', () => {
    expect(keyboardEventsFor('android')).toEqual({
      show: 'keyboardDidShow',
      hide: 'keyboardDidHide',
    });
  });

  it('web no mueve la hoja', () => {
    expect(keyboardEventsFor('web')).toBeNull();
  });
});

describe('keyboardShiftDuration', () => {
  it('respeta la duración del teclado de iOS', () => {
    expect(keyboardShiftDuration(250)).toBe(250);
  });

  it('un 0 (Android) o ausente no es un salto seco', () => {
    expect(keyboardShiftDuration(0)).toBe(durations.quick);
    expect(keyboardShiftDuration(undefined)).toBe(durations.quick);
  });
});

describe('keyboardHeightFromFrame', () => {
  it('altura = pie de la ventana menos el borde superior del teclado', () => {
    expect(
      keyboardHeightFromFrame({ screenY: 550, width: 390 }, 844, 390),
    ).toBe(294);
  });

  it('teclado cerrado (borde en el pie) = 0', () => {
    expect(
      keyboardHeightFromFrame({ screenY: 844, width: 390 }, 844, 390),
    ).toBe(0);
  });

  it('teclado flotante del iPad (más estrecho que la ventana) = 0', () => {
    expect(
      keyboardHeightFromFrame({ screenY: 300, width: 320 }, 1180, 820),
    ).toBe(0);
  });
});

describe('sheetWidthFor', () => {
  it('en móvil ocupa todo el ancho (sin ancho fijo)', () => {
    expect(sheetWidthFor(390)).toBeUndefined();
    expect(sheetWidthFor(breakpoints.md - 1)).toBeUndefined();
  });

  it('en pantalla ancha se limita a sheetMaxWidth', () => {
    expect(sheetWidthFor(breakpoints.md)).toBe(sheetMaxWidth);
    expect(sheetWidthFor(1440)).toBe(sheetMaxWidth);
  });
});
