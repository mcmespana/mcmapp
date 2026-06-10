/**
 * Tests para la normalización de URLs de YouTube.
 *
 * ¿Qué testea?
 * - Que se extraiga el ID de las formas habituales (watch?v=, youtu.be, embed,
 *   shorts, live) y con parámetros extra.
 * - Que `toYouTubeEmbedUrl` devuelva la URL de embed correcta.
 * - Que ante una entrada no reconocible, se conserve el texto tal cual.
 */
import { extractYouTubeId, toYouTubeEmbedUrl } from '@/utils/youtube';

describe('extractYouTubeId', () => {
  it('extrae el ID de una URL watch?v=', () => {
    expect(
      extractYouTubeId('https://www.youtube.com/watch?v=yffsxTH2DiE'),
    ).toBe('yffsxTH2DiE');
  });

  it('extrae el ID con parámetros extra', () => {
    expect(
      extractYouTubeId(
        'https://www.youtube.com/watch?v=yffsxTH2DiE&list=ABC&t=30s',
      ),
    ).toBe('yffsxTH2DiE');
  });

  it('extrae el ID de youtu.be', () => {
    expect(extractYouTubeId('https://youtu.be/yffsxTH2DiE')).toBe(
      'yffsxTH2DiE',
    );
  });

  it('extrae el ID de /embed/, /shorts/ y /live/', () => {
    expect(extractYouTubeId('https://www.youtube.com/embed/yffsxTH2DiE')).toBe(
      'yffsxTH2DiE',
    );
    expect(extractYouTubeId('https://www.youtube.com/shorts/yffsxTH2DiE')).toBe(
      'yffsxTH2DiE',
    );
    expect(extractYouTubeId('https://www.youtube.com/live/yffsxTH2DiE')).toBe(
      'yffsxTH2DiE',
    );
  });

  it('acepta el ID a secas', () => {
    expect(extractYouTubeId('yffsxTH2DiE')).toBe('yffsxTH2DiE');
  });

  it('devuelve null si no se reconoce', () => {
    expect(extractYouTubeId('https://example.com/cosa')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
  });
});

describe('toYouTubeEmbedUrl', () => {
  it('convierte una URL normal en URL de embed', () => {
    expect(
      toYouTubeEmbedUrl('https://www.youtube.com/watch?v=yffsxTH2DiE'),
    ).toBe('https://www.youtube.com/embed/yffsxTH2DiE');
    expect(toYouTubeEmbedUrl('https://youtu.be/yffsxTH2DiE')).toBe(
      'https://www.youtube.com/embed/yffsxTH2DiE',
    );
  });

  it('es idempotente sobre una URL de embed', () => {
    const embed = 'https://www.youtube.com/embed/yffsxTH2DiE';
    expect(toYouTubeEmbedUrl(embed)).toBe(embed);
  });

  it('conserva la entrada si no se reconoce', () => {
    expect(toYouTubeEmbedUrl('https://example.com/x')).toBe(
      'https://example.com/x',
    );
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(toYouTubeEmbedUrl('')).toBe('');
    expect(toYouTubeEmbedUrl('   ')).toBe('');
  });
});
