/**
 * Tests para utilidades de canciones.
 *
 * ¿Qué testea?
 * - Que las categorías de Firebase se mapeen a las categorías internas correctamente
 * - Que las categorías desconocidas vayan a "catZotros"
 * - Que los títulos se limpien quitando números iniciales
 */
import {
  getCategoryFromFirebaseCategory,
  cleanSongTitle,
} from '@/utils/songUtils';

describe('getCategoryFromFirebaseCategory', () => {
  it('mapea "adoracion" a "catAadoracion"', () => {
    expect(getCategoryFromFirebaseCategory('adoracion')).toBe('catAadoracion');
  });

  it('mapea "aleluya" a "catBaleluya"', () => {
    expect(getCategoryFromFirebaseCategory('aleluya')).toBe('catBaleluya');
  });

  it('mapea "comunion" a "catCcomunion"', () => {
    expect(getCategoryFromFirebaseCategory('comunion')).toBe('catCcomunion');
  });

  it('mapea "entrada" a "catDentrada"', () => {
    expect(getCategoryFromFirebaseCategory('entrada')).toBe('catDentrada');
  });

  it('mapea "himnos" a "catEhimnos"', () => {
    expect(getCategoryFromFirebaseCategory('himnos')).toBe('catEhimnos');
  });

  it('mapea "salmos" a "catHsalmos"', () => {
    expect(getCategoryFromFirebaseCategory('salmos')).toBe('catHsalmos');
  });

  it('devuelve "catZotros" para categorías desconocidas', () => {
    expect(getCategoryFromFirebaseCategory('inventada')).toBe('catZotros');
    expect(getCategoryFromFirebaseCategory('')).toBe('catZotros');
  });
});

describe('cleanSongTitle', () => {
  it('quita número y punto del inicio', () => {
    expect(cleanSongTitle('1. Santo')).toBe('Santo');
    expect(cleanSongTitle('23. Aleluya')).toBe('Aleluya');
  });

  it('no modifica títulos sin número', () => {
    expect(cleanSongTitle('Santo')).toBe('Santo');
    expect(cleanSongTitle('Aleluya del Señor')).toBe('Aleluya del Señor');
  });

  it('quita espacios extra', () => {
    expect(cleanSongTitle('  Santo  ')).toBe('Santo');
  });

  it('maneja cadena vacía', () => {
    expect(cleanSongTitle('')).toBe('');
  });
});
