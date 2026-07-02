/**
 * Tests para la normalización de URLs de Google Drive.
 *
 * ¿Qué testea?
 * - Que se extraiga el ID de las formas habituales de enlace de Drive
 *   (/file/d/ID/view, open?id=, uc?id=).
 * - Que `toDrivePreviewUrl` devuelva la URL de preview embebible.
 * - Que ante una URL que no es de Drive, devuelva null (fallback al navegador).
 */
import { extractDriveFileId, toDrivePreviewUrl } from '@/utils/googleDrive';

const ID = '1INTVujFZTFoHIeJiBGTaF8PRU65-W9qx';

describe('extractDriveFileId', () => {
  it('extrae el ID de un enlace de compartir /file/d/', () => {
    expect(
      extractDriveFileId(
        `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      ),
    ).toBe(ID);
  });

  it('extrae el ID de una URL de preview (idempotencia)', () => {
    expect(
      extractDriveFileId(`https://drive.google.com/file/d/${ID}/preview`),
    ).toBe(ID);
  });

  it('extrae el ID de open?id= y uc?export=download&id=', () => {
    expect(extractDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(
      ID,
    );
    expect(
      extractDriveFileId(`https://docs.google.com/uc?export=download&id=${ID}`),
    ).toBe(ID);
  });

  it('devuelve null para URLs que no son de Drive', () => {
    expect(extractDriveFileId('https://example.com/cancion.mp3')).toBeNull();
    expect(
      extractDriveFileId('https://example.com/file/d/abcdefghijk'),
    ).toBeNull();
    expect(extractDriveFileId('')).toBeNull();
  });
});

describe('toDrivePreviewUrl', () => {
  it('convierte un enlace de compartir en URL de preview', () => {
    expect(
      toDrivePreviewUrl(
        `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      ),
    ).toBe(`https://drive.google.com/file/d/${ID}/preview`);
  });

  it('devuelve null si no se reconoce', () => {
    expect(toDrivePreviewUrl('https://example.com/audio.mp3')).toBeNull();
  });
});
