/**
 * Lo que solo lleva el documento de la pantalla completa, y el tamaño de
 * los arreglos (`{arr:}`), que con la letra grande salían más grandes que
 * la propia letra.
 */
import { renderSongDocument, type SongStyleState } from '@/utils/songDocument';

const style: SongStyleState = {
  fontSize: 1.6,
  fontFamily: 'system-ui',
  isDark: false,
  chordsVisible: true,
  arrangementsVisible: true,
  compact: false,
  verseNumbers: true,
  chorusStyle: 'negrita',
  chorusLabel: true,
  airy: false,
  paged: false,
  topPadding: 16,
  bottomPadding: 40,
};
const cho = '{arr: Intro: Violín}\n[C]Letra de [G]prueba';
const doc = (isFullscreen: boolean) =>
  renderSongDocument(cho, {
    style,
    currentTranspose: 0,
    notation: 'ES',
    isFullscreen,
  }).html;

it('la pantalla completa avisa de los toques para enseñar los controles', () => {
  expect(doc(true)).toContain("type: 'sheet-touch'");
});

it('el detalle (y el admin) no mandan nada por cada toque', () => {
  expect(doc(false)).not.toContain('sheet-touch');
});

it('dentro de la hoja el arreglo mide en proporción a la letra, sin multiplicar dos veces', () => {
  expect(doc(false)).toContain('.sheet .arrangement { font-size: 0.78em; }');
});
