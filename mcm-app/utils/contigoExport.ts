/**
 * Sacar de Contigo lo que es de cada uno: los subrayados y las revisiones del
 * día. Puro: junta los datos y los escribe como texto o como HTML (para el
 * PDF). Quién lee el almacenamiento y quién comparte, fuera
 * (`services/contigoExport.ts`).
 */
import type { DailyReadings } from '@/hooks/useDailyReadings';
import type { HighlightSource, StoredBookmark } from '@/utils/contigoBookmarks';
import { HIGHLIGHT_SOURCES } from '@/utils/contigoBookmarks';
import {
  HIGHLIGHT_COLORS,
  type HighlightColorKey,
  type HighlightRange,
} from '@/utils/highlightRanges';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export const MONTH_NAMES = MONTHS;

/** «16 de noviembre de 2026» (o con el día de la semana delante). */
export function longDateLabel(iso: string, withWeekday = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const base = `${d} de ${MONTHS[m - 1]} de ${y}`;
  if (!withWeekday) return base;
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${base}`;
}

export const SOURCE_LABELS: Record<HighlightSource, string> = {
  evangelio: 'Evangelio',
  comentario: 'Comentario',
  lectura1: 'Primera lectura',
  salmo: 'Salmo',
  lectura2: 'Segunda lectura',
};

function citaOf(readings: DailyReadings | null, source: HighlightSource) {
  if (!readings) return '';
  if (source === 'evangelio' || source === 'comentario')
    return readings.evangelio?.cita ?? '';
  return readings[source]?.cita ?? '';
}

export interface SharePhrase {
  text: string;
  color?: HighlightColorKey;
  kicker: string;
  cita: string;
}

/**
 * Frases del día que se pueden compartir como imagen: los subrayados (el
 * evangelio primero) y, si no hay ninguno, el arranque del evangelio.
 */
export function sharePhrases(
  readings: DailyReadings | null,
  canonical: Record<HighlightSource, string>,
  ranges: Record<HighlightSource, HighlightRange[]>,
): SharePhrase[] {
  const out: SharePhrase[] = [];
  for (const source of HIGHLIGHT_SOURCES) {
    const sorted = [...(ranges[source] ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    for (const r of sorted) {
      const text = (r.text || canonical[source].slice(r.start, r.end)).trim();
      if (text.length < 3) continue;
      out.push({
        text,
        color: r.color,
        kicker: SOURCE_LABELS[source],
        cita: citaOf(readings, source),
      });
    }
  }
  if (out.length === 0 && canonical.evangelio) {
    out.push({
      // Sin la entradilla «En aquel tiempo…», si hay algo más después.
      text: canonical.evangelio,
      kicker: 'Evangelio',
      cita: citaOf(readings, 'evangelio'),
    });
  }
  return out;
}

// ── Exportar ──

export interface StoredRevision {
  date: string;
  grateful?: { mode?: string; items?: string[]; revision?: string };
}

export interface ExportDay {
  date: string;
  cita: string;
  highlights: { source: HighlightSource; text: string; color?: string }[];
  grateful: string[];
  revision: string;
}

export interface ExportOptions {
  highlights: boolean;
  revisions: boolean;
}

/** Junta guardados y revisiones por día, del más reciente al más antiguo. */
export function collectExportDays(
  bookmarks: StoredBookmark[],
  revisions: StoredRevision[],
  opts: ExportOptions,
): ExportDay[] {
  const days = new Map<string, ExportDay>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = { date, cita: '', highlights: [], grateful: [], revision: '' };
      days.set(date, d);
    }
    return d;
  };
  if (opts.highlights) {
    for (const b of bookmarks) {
      const list: ExportDay['highlights'] = [];
      for (const source of HIGHLIGHT_SOURCES) {
        for (const hl of b.highlights?.[source] ?? []) {
          const text = (typeof hl === 'string' ? hl : hl.text)?.trim();
          if (!text) continue;
          list.push({
            source,
            text,
            color:
              typeof hl === 'string'
                ? undefined
                : HIGHLIGHT_COLORS[hl.color]?.swatch,
          });
        }
      }
      if (!list.length) continue;
      const d = day(b.date);
      d.highlights = list;
      d.cita = b.readings?.evangelio?.cita ?? '';
    }
  }
  if (opts.revisions) {
    for (const r of revisions) {
      const grateful = (r.grateful?.items ?? [])
        .map((t) => String(t).trim())
        .filter(Boolean);
      const revision = (r.grateful?.revision ?? '').trim();
      if (!grateful.length && !revision) continue;
      const d = day(r.date);
      d.grateful = grateful;
      d.revision = revision;
    }
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function exportAsText(days: ExportDay[]): string {
  const out: string[] = ['Contigo · mis subrayados y revisiones', ''];
  for (const d of days) {
    out.push(`${longDateLabel(d.date, true)}${d.cita ? ` · ${d.cita}` : ''}`);
    for (const hl of d.highlights) {
      out.push(`  «${hl.text}» (${SOURCE_LABELS[hl.source]})`);
    }
    if (d.grateful.length) {
      out.push('  Doy gracias por:');
      d.grateful.forEach((g) => out.push(`   · ${g}`));
    }
    if (d.revision) out.push(`  Revisión: ${d.revision}`);
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

export function exportAsHtml(days: ExportDay[]): string {
  const body = days
    .map((d) => {
      const hl = d.highlights
        .map(
          (x) =>
            `<p class="hl"><mark style="background:${x.color ?? '#FFE9A8'}">${esc(x.text)}</mark><span class="src">${SOURCE_LABELS[x.source]}</span></p>`,
        )
        .join('');
      const gr = d.grateful.length
        ? `<h3>Doy gracias por</h3><ul>${d.grateful.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`
        : '';
      const rev = d.revision
        ? `<h3>Revisión del día</h3><p>${esc(d.revision)}</p>`
        : '';
      return `<section><h2>${esc(longDateLabel(d.date, true))}${d.cita ? `<span class="cita">${esc(d.cita)}</span>` : ''}</h2>${hl}${gr}${rev}</section>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contigo</title><style>
@page { size: A4; margin: 18mm 16mm; }
body { font-family: Palatino, 'Palatino Linotype', Georgia, serif; color: #1C1610; font-size: 12pt; line-height: 1.5; }
h1 { font-size: 22pt; margin: 0 0 4pt; }
.sub { color: #7A6550; margin: 0 0 18pt; font-size: 10pt; }
section { margin-bottom: 16pt; page-break-inside: avoid; }
h2 { font-size: 12pt; margin: 0 0 6pt; text-transform: capitalize; border-bottom: 0.5pt solid #E5DCCB; padding-bottom: 3pt; }
h2 .cita { float: right; font-weight: normal; font-style: italic; color: #876208; text-transform: none; }
h3 { font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; color: #7A6550; margin: 8pt 0 2pt; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
p { margin: 0 0 5pt; }
.hl mark { padding: 1pt 3pt; border-radius: 2pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.src { color: #7A6550; font-size: 9pt; margin-left: 6pt; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
ul { margin: 0 0 4pt; padding-left: 16pt; }
</style></head><body><h1>Contigo</h1><p class="sub">Mis subrayados y revisiones</p>${body}</body></html>`;
}
