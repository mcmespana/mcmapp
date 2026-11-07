/**
 * Título de la pestaña del navegador (`utils/documentTitle`).
 *
 * expo-router lo tiene desactivado, así que si esto falla la pestaña vuelve a
 * quedarse sin nombre, o se queda con el título de una canción ya cerrada.
 */
import { Platform } from 'react-native';
import {
  APP_TITLE,
  setBaseDocumentTitle,
  setDetailDocumentTitle,
  songDocumentTitle,
  titleForPath,
} from '@/utils/documentTitle';

describe('titleForPath', () => {
  it('la raíz es el nombre de la app', () => {
    expect(titleForPath('/')).toBe(APP_TITLE);
  });

  it('cada pestaña con su etiqueta, también en sus rutas anidadas', () => {
    expect(titleForPath('/cancionero')).toBe('Cantoral · MCM');
    expect(titleForPath('/contigo/evangelio')).toBe('Contigo · MCM');
    expect(titleForPath('/calendario?x=1')).toBe('Calendario · MCM');
  });

  it('las rutas sueltas conocidas y, si no, el nombre de la app', () => {
    expect(titleForPath('/notifications')).toBe('Notificaciones · MCM');
    expect(titleForPath('/cancion')).toBe('Cantoral · MCM');
    expect(titleForPath('/no-existe')).toBe(APP_TITLE);
  });
});

describe('songDocumentTitle', () => {
  it('título de la canción y la sección', () => {
    expect(songDocumentTitle(' Alzad las manos ')).toBe(
      'Alzad las manos · Cantoral',
    );
    expect(songDocumentTitle('')).toBeNull();
    expect(songDocumentTitle(undefined)).toBeNull();
  });
});

describe('capas base / detalle (web)', () => {
  const os = Platform.OS;
  beforeAll(() => {
    (Platform as { OS: string }).OS = 'web';
    (global as unknown as { document: { title: string } }).document = {
      title: '',
    };
  });
  afterAll(() => {
    (Platform as { OS: string }).OS = os;
    delete (global as { document?: unknown }).document;
  });
  const title = () =>
    (global as unknown as { document: { title: string } }).document.title;

  it('el detalle gana a la base mientras está puesto, en cualquier orden', () => {
    setBaseDocumentTitle('Cantoral · MCM');
    expect(title()).toBe('Cantoral · MCM');
    const quitar = setDetailDocumentTitle('Alzad · Cantoral');
    setBaseDocumentTitle('Inicio · MCM');
    expect(title()).toBe('Alzad · Cantoral');
    quitar();
    expect(title()).toBe('Inicio · MCM');
  });

  it('quitar un detalle viejo no borra el de otra canción', () => {
    setBaseDocumentTitle('Cantoral · MCM');
    const quitarA = setDetailDocumentTitle('A · Cantoral');
    const quitarB = setDetailDocumentTitle('B · Cantoral');
    quitarA();
    expect(title()).toBe('B · Cantoral');
    quitarB();
    expect(title()).toBe('Cantoral · MCM');
  });
});
