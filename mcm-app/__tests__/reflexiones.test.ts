/**
 * El modelo de Compartiendo (`utils/reflexiones.ts`) y su imagen para
 * compartir (`utils/reflexionCard.ts`).
 *
 * `buildReflexionUpdate` es el payload multi-path que hace atómica la
 * publicación de una reflexión (`data/<key>` + `updatedAt` en un único
 * `update()`, en vez de dos `set()` separados que podían dejar la entrada
 * escrita pero invisible para otros dispositivos si el segundo fallaba).
 */
import {
  buildReflexionUpdate,
  REFLEXION_TONES,
  composerDays,
  createdAtOf,
  dayLabel,
  groupByDay,
  initialsOf,
  newReflexion,
  normalizeReflexiones,
  reflexionShape,
  reflexionTone,
  relativeTime,
  sortReflexiones,
  splitAuthor,
  storyDurationMs,
  wallStats,
  type Reflexion,
} from '@/utils/reflexiones';
import { reflexionCardSpec } from '@/utils/reflexionCard';

describe('buildReflexionUpdate', () => {
  it('genera las dos claves exactas: data/<key> y updatedAt', () => {
    const reflexion = { id: '1', titulo: 'Hola', contenido: 'Mundo' };
    const result = buildReflexionUpdate('abc123', reflexion, 1_700_000_000_000);

    expect(Object.keys(result).sort()).toEqual(['data/abc123', 'updatedAt']);
    expect(result['data/abc123']).toBe(reflexion);
  });

  it('serializa updatedAt como string (contrato de useFirebaseData)', () => {
    const result = buildReflexionUpdate('k', {}, 1_700_000_000_000);
    expect(result.updatedAt).toBe('1700000000000');
    expect(typeof result.updatedAt).toBe('string');
  });

  it('usa la key dada tal cual en el path (push key real de Firebase)', () => {
    const result = buildReflexionUpdate('-Nabc_XYZ', { a: 1 }, 1);
    expect(result['data/-Nabc_XYZ']).toEqual({ a: 1 });
  });
});

const r = (over: Partial<Reflexion>): Reflexion => ({
  id: '1764200000000',
  contenido: 'Gracias',
  fecha: '2026-11-27',
  grupal: false,
  ...over,
});

describe('normalizeReflexiones', () => {
  it('acepta el objeto de push() y el array antiguo con huecos', () => {
    expect(
      normalizeReflexiones({ a: r({ id: '1' }), b: r({ id: '2' }) }).map(
        (x) => x.id,
      ),
    ).toEqual(['1', '2']);
    expect(normalizeReflexiones([null, r({ id: '3' })])).toHaveLength(1);
  });

  it('descarta las vacías y rellena el id con la key', () => {
    const out = normalizeReflexiones({
      k1: { contenido: '  ', fecha: '2026-11-27' },
      k2: { contenido: 'Hola', fecha: '2026-11-27' },
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('k2');
  });

  it('no revienta con lo que no es una lista', () => {
    expect(normalizeReflexiones(null)).toEqual([]);
    expect(normalizeReflexiones('x')).toEqual([]);
  });
});

describe('orden y días', () => {
  it('más reciente primero: por día y, dentro del día, por hora', () => {
    const list = [
      r({ id: '1764200000000', fecha: '2026-11-26' }),
      r({ id: '1764200000001', fecha: '2026-11-27' }),
      r({ id: '1764200000009', fecha: '2026-11-27' }),
    ];
    expect(sortReflexiones(list).map((x) => x.id)).toEqual([
      '1764200000009',
      '1764200000001',
      '1764200000000',
    ]);
  });

  it('agrupa por día conservando el orden', () => {
    const sorted = sortReflexiones([
      r({ id: '1764200000000', fecha: '2026-11-26' }),
      r({ id: '1764200000001', fecha: '2026-11-27' }),
    ]);
    expect(groupByDay(sorted).map((g) => [g.day, g.items.length])).toEqual([
      ['2026-11-27', 1],
      ['2026-11-26', 1],
    ]);
  });

  it('dice Hoy, Ayer o el día de la semana', () => {
    expect(dayLabel('2026-11-27', '2026-11-27')).toBe('Hoy');
    expect(dayLabel('2026-11-26', '2026-11-27')).toBe('Ayer');
    expect(dayLabel('2026-11-25', '2026-11-27')).toBe('miércoles 25 nov');
  });

  it('ofrece hoy, ayer y anteayer al escribir', () => {
    const days = composerDays(new Date(2026, 10, 27));
    expect(days.map((d) => d.iso)).toEqual([
      '2026-11-27',
      '2026-11-26',
      '2026-11-25',
    ]);
    expect(days.map((d) => d.label)).toEqual(['Hoy', 'Ayer', 'Miércoles']);
  });

  it('tiempo relativo solo durante el primer día', () => {
    const now = 1_764_200_000_000;
    expect(relativeTime(now - 30_000, now)).toBe('ahora');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('hace 5 min');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('hace 3 h');
    expect(relativeTime(now - 30 * 3_600_000, now)).toBeNull();
    expect(createdAtOf({ id: '-Nabc' })).toBeNull();
  });
});

describe('tarjetas', () => {
  it('el tono elegido manda; sin tono, uno estable por id', () => {
    expect(reflexionTone({ id: 'x', tono: 'purple' })).toBe('purple');
    const t = reflexionTone({ id: 'abc' });
    expect(REFLEXION_TONES).toContain(t);
    expect(reflexionTone({ id: 'abc' })).toBe(t);
    // Un valor desconocido (de otra versión) no se pinta: cae al estable.
    expect(reflexionTone({ id: 'abc', tono: 'neon' as never })).toBe(t);
  });

  it('una frase corta es cartel; con título o larga, nota', () => {
    expect(reflexionShape({ contenido: 'Gracias por tanto' })).toBe('poster');
    expect(reflexionShape({ contenido: 'Hola', titulo: 'Título' })).toBe(
      'note',
    );
    expect(reflexionShape({ contenido: 'a'.repeat(141) })).toBe('note');
  });

  it('firma: nombre, delegación e iniciales', () => {
    expect(splitAuthor('Marta López · Valencia')).toEqual({
      name: 'Marta López',
      detail: 'Valencia',
    });
    expect(initialsOf('Marta López · Valencia')).toBe('ML');
    expect(initialsOf('')).toBe('');
  });

  it('cuenta personas distintas sin contar anónimos', () => {
    const list = [
      r({ id: '3', autor: 'Marta · Valencia' }),
      r({ id: '2', autor: 'marta · Valencia' }),
      r({ id: '1' }),
      r({ id: '0', autor: 'Pablo' }),
    ];
    const s = wallStats(list, (x) => x.autor ?? '');
    expect(s.total).toBe(4);
    expect(s.people).toBe(2);
    expect(s.recentAuthors).toEqual(['Marta · Valencia', 'Pablo']);
  });

  it('newReflexion no deja claves undefined (RTDB rechazaría el update)', () => {
    const out = newReflexion({
      contenido: '  Gracias  ',
      fecha: '2026-11-27',
      autor: '   ',
      tono: 'green',
      now: 1,
    });
    expect(out).toEqual({
      id: '1',
      contenido: 'Gracias',
      fecha: '2026-11-27',
      grupal: false,
      tono: 'green',
    });
    expect(Object.values(out).includes(undefined)).toBe(false);
  });

  it('una historia dura entre 5 y 15 segundos', () => {
    expect(storyDurationMs('hola')).toBe(5_000);
    expect(storyDurationMs('x'.repeat(5000))).toBe(15_000);
  });

  it('la imagen para compartir lleva el texto, la firma y el evento', () => {
    const spec = reflexionCardSpec({
      text: 'Hoy he entendido que despertar es dejar que otro te despierte',
      author: 'Marta · Valencia',
      eventTitle: 'Congreso M+C',
      background: '#253883',
    });
    expect(spec.width).toBe(1080);
    expect(spec.height).toBe(1920);
    const texts = spec.shapes
      .filter((s) => s.type === 'text')
      .map((s) => (s as { text: string }).text)
      .join(' ');
    expect(texts).toContain('despertar');
    expect(texts).toContain('Marta · Valencia');
    expect(texts).toContain('CONGRESO M+C · COMPARTIENDO');
    // Sobre el azul MCM, la tinta es blanca.
    const body = spec.shapes.find(
      (s) => s.type === 'text' && s.text.includes('despertar'),
    ) as { fill: string };
    expect(body.fill.toLowerCase()).toBe('#ffffff');
  });
});
