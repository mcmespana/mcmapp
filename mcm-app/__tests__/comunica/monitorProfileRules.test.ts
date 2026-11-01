/**
 * Reglas puras de «Mis datos de monitor» (plan 09, tarea 2).
 */
import type { MonitorProfile } from '@/services/comunica/contract';
import { nativeHrefFor } from '@/services/comunica/links';
import {
  changesFrom,
  DOCUMENT_MAX_BYTES,
  editableFrom,
  editableOf,
  fileProblem,
  fileSizeText,
  formErrors,
  formFrom,
  isCertificatePending,
  isFormDirty,
  uploadNameAndType,
  withPending,
  yearFromText,
} from '@/utils/comunica/monitorProfile';

const profile: MonitorProfile = {
  generatedAt: '2026-10-28T10:00:00+01:00',
  monitorSince: 2021,
  monitorOf: 'com',
  preMonitors1: 'finished',
  preMonitors2: null,
  preMonitorsYear: '2020',
  mat: 'in_progress',
  matCourse: null,
  dat: null,
  fa: null,
  datYearAndSchool: null,
  faYearAndSchool: null,
  foodHandling: null,
  congresses: ['b', 'a'],
  academicBackground: null,
  volunteeringDescription: null,
  volunteeringPrograms: null,
  sexOffenceCertificateMode: 'manual',
  files: {
    sexOffenceCertificate: false,
    mat: false,
    dat: false,
    otherTraining: false,
  },
  options: { matCourses: [], congresses: [] },
};
const confirmed = editableOf(profile);

describe('el año de «Monitor/a desde…»', () => {
  it('acepta 2019 y rechaza 19, 20199 y letras', () => {
    expect(yearFromText('2019')).toBe(2019);
    expect(yearFromText(' 2019 ')).toBe(2019);
    expect(yearFromText('')).toBeNull();
    expect(yearFromText('19')).toBe('invalid');
    expect(yearFromText('20199')).toBe('invalid');
    expect(yearFromText('20a9')).toBe('invalid');
    expect(yearFromText('dos mil')).toBe('invalid');
  });

  it('nunca enseña el 1 de enero: el formulario lleva el año solo', () => {
    expect(formFrom(confirmed).monitorSince).toBe('2021');
    expect(formErrors({ ...formFrom(confirmed), monitorSince: '19' })).toEqual({
      monitorSince: 'Escribe el año con cuatro cifras (AAAA).',
    });
    expect(formErrors(formFrom(confirmed))).toEqual({});
  });
});

describe('qué se manda', () => {
  it('nada si no se toca nada (y los textos vacíos siguen en null)', () => {
    const f = formFrom(confirmed);
    expect(f.academicBackground).toBe('');
    expect(changesFrom(confirmed, editableFrom(f))).toEqual({});
    expect(isFormDirty(confirmed, f)).toBe(false);
  });

  it('una casilla sin tocar sigue en null; tocarla sí cuenta', () => {
    const f = formFrom(confirmed);
    expect(editableFrom(f).foodHandling).toBeNull();
    expect(
      changesFrom(confirmed, editableFrom({ ...f, foodHandling: false })),
    ).toEqual({ foodHandling: false });
  });

  it('los congresos se comparan como conjunto', () => {
    const f = { ...formFrom(confirmed), congresses: ['a', 'b'] };
    expect(changesFrom(confirmed, editableFrom(f))).toEqual({});
    expect(
      changesFrom(confirmed, editableFrom({ ...f, congresses: ['a'] })),
    ).toEqual({ congresses: ['a'] });
  });

  it('volver a «Sin indicar» manda null; borrar un texto, también', () => {
    const f = { ...formFrom(confirmed), monitorOf: null, preMonitorsYear: ' ' };
    expect(changesFrom(confirmed, editableFrom(f))).toEqual({
      monitorOf: null,
      preMonitorsYear: null,
    });
  });

  it('dos guardados sin cobertura lo llevan todo (gana la última entrada)', () => {
    // Primer «Guardar»: el año.
    const first = changesFrom(
      confirmed,
      editableFrom({ ...formFrom(confirmed), monitorSince: '2019' }),
    );
    expect(first).toEqual({ monitorSince: 2019 });
    // La pantalla parte de lo confirmado CON lo pendiente encima…
    const base = withPending(confirmed, first);
    const form2 = { ...formFrom(base), mat: 'certified' as const };
    expect(isFormDirty(base, form2)).toBe(true);
    // …y lo que se encola se calcula contra lo CONFIRMADO: lleva las dos.
    expect(changesFrom(confirmed, editableFrom(form2))).toEqual({
      monitorSince: 2019,
      mat: 'certified',
    });
  });
});

describe('el aviso del certificado', () => {
  it.each([
    [null, false, false],
    [null, true, false],
    ['automatic', false, false],
    ['automatic', true, false],
    ['manual', false, true],
    ['manual', true, false],
  ] as const)('modo %s, con archivo %s → %s', (mode, hasFile, pending) => {
    expect(isCertificatePending({ mode, hasFile })).toBe(pending);
  });

  it('uno subiendo cuenta como en camino', () => {
    expect(
      isCertificatePending({ mode: 'manual', hasFile: false, uploading: true }),
    ).toBe(false);
  });
});

describe('qué archivo vale', () => {
  const f = (name: string, size: number, mimeType?: string) =>
    fileProblem({ name, size, mimeType });
  it('por tipo y extensión', () => {
    expect(f('a.pdf', 10, 'application/pdf')).toBeNull();
    expect(f('a.JPG', 10, 'image/jpeg')).toBeNull();
    expect(f('a.jpeg', 10)).toBeNull();
    expect(f('a.png', 10, 'image/png')).toBeNull();
    expect(f('foto.heic', 10, 'image/heic')).toBe('bad_type');
    expect(f('foto', 10, 'image/heic')).toBe('bad_type');
    expect(f('a.docx', 10)).toBe('bad_type');
    // Sin extensión, manda el tipo.
    expect(f('foto', 10, 'image/jpeg')).toBeNull();
  });
  it('0 bytes, 4 MB justos y 4 MB + 1', () => {
    expect(f('a.pdf', 0)).toBe('empty');
    expect(f('a.pdf', DOCUMENT_MAX_BYTES)).toBeNull();
    expect(f('a.pdf', DOCUMENT_MAX_BYTES + 1)).toBe('too_big');
  });
  it('pone nombre y tipo a lo que llega sin ellos', () => {
    expect(uploadNameAndType('mat', null, 'image/jpeg')).toEqual({
      name: 'titulo-mat.jpg',
      mimeType: 'image/jpeg',
    });
    expect(uploadNameAndType('dat', 'scan.PDF', null)).toEqual({
      name: 'scan.PDF',
      mimeType: 'application/pdf',
    });
  });
  it('tamaños legibles', () => {
    expect(fileSizeText(2.4 * 1024 * 1024)).toBe('2,4 MB');
    expect(fileSizeText(640 * 1024)).toBe('640 KB');
    expect(fileSizeText(10)).toBe('1 KB');
  });
});

describe('enlaces (plan 10)', () => {
  it('«Mis datos de monitor» del plugin abre la pantalla nativa', () => {
    expect(
      nativeHrefFor({ internalpage: 'single_stic_comunica_monitor' }),
    ).toEqual({ pathname: '/comunica/yo/monitor' });
  });
});
