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
  stripCategoryPrefix,
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

describe('stripCategoryPrefix', () => {
  it('quita el prefijo de ordenación con punto', () => {
    expect(stripCategoryPrefix('C. Cantos de entrada')).toBe(
      'Cantos de entrada',
    );
  });

  it('quita el prefijo con paréntesis', () => {
    expect(stripCategoryPrefix('A) Adoración')).toBe('Adoración');
  });

  it('quita el prefijo numérico', () => {
    expect(stripCategoryPrefix('1. Entrada')).toBe('Entrada');
  });

  it('NO se come la primera letra de una categoría sin prefijo', () => {
    // El bug que tenía la versión anterior (`/^\w\.?\s*/`, con el punto
    // opcional): sin prefijo, se comía la inicial. Hoy no salta porque todas
    // las categorías reales traen su «X. », pero basta una creada a mano.
    expect(stripCategoryPrefix('Adoración')).toBe('Adoración');
    expect(stripCategoryPrefix('Entrada')).toBe('Entrada');
    expect(stripCategoryPrefix('María')).toBe('María');
  });

  it('deja en paz un título de una sola palabra corta', () => {
    expect(stripCategoryPrefix('Santo')).toBe('Santo');
  });

  it('maneja cadena vacía', () => {
    expect(stripCategoryPrefix('')).toBe('');
  });
});
