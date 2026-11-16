import {
  collectExportDays,
  exportAsHtml,
  exportAsText,
  longDateLabel,
  sharePhrases,
} from '@/utils/contigoExport';
import { buildRecap, formatCount, recapYears } from '@/utils/contigoRecap';
import {
  cardSvgXml,
  clipText,
  fitText,
  gospelCardSpec,
  recapCardSpec,
  wrapText,
} from '@/utils/shareCard';

const empty = {
  evangelio: '',
  comentario: '',
  lectura1: '',
  salmo: '',
  lectura2: '',
};

describe('tarjetas', () => {
  it('parte por palabras y recorta con puntos', () => {
    expect(wrapText('uno dos tres cuatro', 8)).toEqual([
      'uno dos',
      'tres',
      'cuatro',
    ]);
    expect(clipText('a'.repeat(5) + ' ' + 'b'.repeat(50), 20)).toBe('aaaaa…');
  });

  it('elige el tamaño mayor que cabe', () => {
    const big = fitText('Corto', 800, 400, [76, 40]);
    expect(big.size).toBe(76);
    const small = fitText('palabra '.repeat(60), 800, 500, [76, 40, 30]);
    expect(small.size).toBeLessThan(76);
  });

  it('la tarjeta del evangelio lleva la frase, la cita y es SVG válido', () => {
    const spec = gospelCardSpec({
      phrase: 'Venid a mí <todos>',
      cita: 'Mt 11, 28',
      kicker: 'Evangelio',
      dateLabel: '16 de noviembre de 2026',
      style: 'papel',
      format: 'square',
    });
    expect(spec.height).toBe(1080);
    const xml = cardSvgXml(spec);
    expect(xml).toContain('Mt 11, 28');
    expect(xml).toContain('&lt;todos&gt;');
    expect(xml.startsWith('<svg')).toBe(true);
  });

  it('la del año cabe en los dos formatos', () => {
    for (const format of ['story', 'square'] as const) {
      const spec = recapCardSpec({
        year: 2026,
        stats: [
          { value: '120', label: 'días contigo' },
          { value: '21', label: 'días seguidos' },
        ],
        months: new Array(12).fill(0.5),
        style: 'noche',
        format,
      });
      for (const s of spec.shapes) expect(s.y).toBeLessThanOrEqual(spec.height);
    }
  });
});

describe('frases y exportación', () => {
  it('sin subrayados, el evangelio', () => {
    const out = sharePhrases(
      {
        evangelio: {
          texto: 'x',
          cita: 'Jn 1',
          comentario: '',
          comentarista: '',
          url: '',
        },
      },
      { ...empty, evangelio: 'En el principio' },
      { evangelio: [], comentario: [], lectura1: [], salmo: [], lectura2: [] },
    );
    expect(out).toEqual([
      { text: 'En el principio', kicker: 'Evangelio', cita: 'Jn 1' },
    ]);
  });

  it('junta subrayados y revisiones por día', () => {
    const days = collectExportDays(
      [
        {
          date: '2026-11-02',
          bookmarkedAt: 1,
          readings: null,
          highlights: {
            evangelio: [
              { start: 0, end: 4, color: 'sun', text: 'Luz' },
              'vieja',
            ],
          },
        },
      ],
      [
        {
          date: '2026-11-03',
          grateful: { items: ['la familia', ' '], revision: 'Bien' },
        },
        { date: '2026-11-04', grateful: { items: [], revision: '' } },
      ],
      { highlights: true, revisions: true },
    );
    expect(days.map((d) => d.date)).toEqual(['2026-11-03', '2026-11-02']);
    const text = exportAsText(days);
    expect(text).toContain('«Luz» (Evangelio)');
    expect(text).toContain('· la familia');
    expect(exportAsHtml(days)).toContain('<mark');
    expect(
      collectExportDays([], [], { highlights: true, revisions: true }),
    ).toEqual([]);
  });

  it('fechas largas', () => {
    expect(longDateLabel('2026-11-16')).toBe('16 de noviembre de 2026');
    expect(longDateLabel('2026-11-16', true)).toBe(
      'lunes 16 de noviembre de 2026',
    );
  });
});

describe('tu año', () => {
  const rec = (date: string, extra = {}) => ({
    date,
    readingDone: true,
    prayerDone: false,
    timestamp: 1,
    ...extra,
  });
  it('cuenta días, racha, minutos y frases', () => {
    const records = {
      '2026-01-01': rec('2026-01-01'),
      '2026-01-02': rec('2026-01-02', {
        prayerDone: true,
        prayerDurationMinutes: 10,
      }),
      '2026-01-03': rec('2026-01-03'),
      '2026-03-10': rec('2026-03-10'),
      '2025-12-31': rec('2025-12-31'),
    };
    const recap = buildRecap(
      records,
      [
        {
          date: '2026-03-10',
          bookmarkedAt: 1,
          readings: null,
          highlights: {
            salmo: [{ start: 0, end: 1, color: 'mint', text: 'Aleluya' }],
          },
        },
      ],
      2026,
    );
    expect(recap.activeDays).toBe(4);
    expect(recap.longestStreak).toBe(3);
    expect(recap.prayerMinutes).toBe(10);
    expect(recap.highlights).toBe(1);
    expect(recap.months[0].days[1]).toBe(2);
    expect(recap.months[2].highlights[0].text).toBe('Aleluya');
    expect(recap.bestMonth).toBe(0);
    expect(recapYears(records, [], 2026)).toEqual([2026, 2025]);
  });

  it('miles con punto', () => {
    expect(formatCount(1240)).toBe('1.240');
    expect(formatCount(58)).toBe('58');
  });
});
