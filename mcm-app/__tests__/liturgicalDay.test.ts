/**
 * El día litúrgico (`utils/liturgicalDay.ts`): domingo N, ciclo A/B/C por año
 * litúrgico, fiestas fijas en domingo y el domingo que toca.
 */
import {
  addDays,
  cycleOf,
  getLiturgicalInfo,
  isIsoDate,
  isoDateLocal,
  longDateEs,
  shortDateEs,
  liturgicalDayOf,
  targetSunday,
  toRoman,
  weekdayOf,
} from '@/utils/liturgicalDay';
import { LiturgicalColors } from '@/constants/colors';

describe('fechas', () => {
  it('weekdayOf y addDays', () => {
    expect(weekdayOf('2026-11-22')).toBe(0);
    expect(weekdayOf('2026-11-16')).toBe(1);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // cambio de hora
  });

  it('isoDateLocal usa el día local, no el UTC', () => {
    expect(isoDateLocal(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
  });

  it('isIsoDate rechaza lo que no es una fecha', () => {
    expect(isIsoDate('2026-11-22')).toBe(true);
    expect(isIsoDate('2026-13-40')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('domingo')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it('toRoman', () => {
    expect(toRoman(34)).toBe('XXXIV');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(9)).toBe('IX');
  });
});

describe('targetSunday', () => {
  it('un domingo es él mismo', () => {
    expect(targetSunday('2026-11-22')).toBe('2026-11-22');
  });
  it('de lunes a sábado, el domingo siguiente', () => {
    expect(targetSunday('2026-11-16')).toBe('2026-11-22'); // lunes
    expect(targetSunday('2026-11-19')).toBe('2026-11-22'); // jueves
    expect(targetSunday('2026-11-21')).toBe('2026-11-22'); // sábado (vigilia)
  });
  it('cruza el fin de año y el de mes', () => {
    expect(targetSunday('2026-12-29')).toBe('2027-01-03');
    expect(targetSunday('2026-10-30')).toBe('2026-11-01');
  });
});

describe('liturgicalDayOf — domingo N en los cinco tiempos', () => {
  it('Tiempo Ordinario, tramo 1 (desde el Bautismo): 2026-01-18 = II', () => {
    const d = liturgicalDayOf('2026-01-18');
    expect(d.season).toBe('ordinario');
    expect(d.sundayNumber).toBe(2);
    expect(d.name).toBe('II Domingo del Tiempo Ordinario');
    expect(d.feastId).toBeUndefined();
  });

  it('el Bautismo del Señor es fiesta y no lleva número', () => {
    const d = liturgicalDayOf('2026-01-11');
    expect(d.feastId).toBe('bautismo_del_senor');
    expect(d.sundayNumber).toBeUndefined();
    expect(d.name).toBe('Bautismo del Señor');
  });

  it('Tiempo Ordinario, tramo 2 (hacia atrás desde Cristo Rey)', () => {
    expect(liturgicalDayOf('2026-11-15').sundayNumber).toBe(33);
    expect(liturgicalDayOf('2026-06-14').sundayNumber).toBe(11);
    expect(liturgicalDayOf('2026-11-15').name).toBe(
      'XXXIII Domingo del Tiempo Ordinario',
    );
  });

  it('Cristo Rey = XXXIV, con su fiesta', () => {
    const d = liturgicalDayOf('2026-11-22');
    expect(d.sundayNumber).toBe(34);
    expect(d.feastId).toBe('cristo_rey');
    expect(d.feastName).toBe('Jesucristo, Rey del Universo');
    expect(d.name).toBe('XXXIV Domingo del Tiempo Ordinario');
  });

  it('Adviento: 2026-11-29 = I', () => {
    const d = liturgicalDayOf('2026-11-29');
    expect(d.season).toBe('adviento');
    expect(d.sundayNumber).toBe(1);
    expect(d.name).toBe('I Domingo de Adviento');
    expect(liturgicalDayOf('2026-12-13').sundayNumber).toBe(3);
    expect(liturgicalDayOf('2026-12-13').colorHex).toBe(LiturgicalColors.rose);
  });

  it('Cuaresma: 2026-03-15 = IV (Laetare, rosa)', () => {
    const d = liturgicalDayOf('2026-03-15');
    expect(d.season).toBe('cuaresma');
    expect(d.sundayNumber).toBe(4);
    expect(d.colorHex).toBe(LiturgicalColors.rose);
    expect(liturgicalDayOf('2026-02-22').sundayNumber).toBe(1);
  });

  it('Semana Santa: Ramos es fiesta, sin número', () => {
    const d = liturgicalDayOf('2026-03-29');
    expect(d.season).toBe('semana_santa');
    expect(d.feastId).toBe('domingo_ramos');
    expect(d.sundayNumber).toBeUndefined();
  });

  it('Pascua: 2026-04-26 = IV; Resurrección y Pentecostés, fiestas', () => {
    expect(liturgicalDayOf('2026-04-26').sundayNumber).toBe(4);
    expect(liturgicalDayOf('2026-04-26').season).toBe('pascua');
    expect(liturgicalDayOf('2026-04-05').feastId).toBe('domingo_resurreccion');
    expect(liturgicalDayOf('2026-04-05').sundayNumber).toBeUndefined();
    const pente = liturgicalDayOf('2026-05-24');
    expect(pente.feastId).toBe('pentecostes');
    expect(pente.sundayNumber).toBeUndefined();
  });

  it('la Ascensión trasladada es el VII de Pascua con su fiesta', () => {
    const d = liturgicalDayOf('2026-05-17');
    expect(d.sundayNumber).toBe(7);
    expect(d.feastId).toBe('ascension_domingo');
    expect(d.feastName).toBe('Ascensión del Señor');
  });

  it('Corpus sin el paréntesis del calendario', () => {
    expect(liturgicalDayOf('2026-06-07').feastName).toBe('Corpus Christi');
  });

  it('un día que no es domingo no lleva número', () => {
    expect(liturgicalDayOf('2026-11-18').sundayNumber).toBeUndefined();
  });

  it('el primer domingo de Tiempo Ordinario de cada año es siempre el II', () => {
    for (const year of [2026, 2027, 2028, 2029]) {
      let f = `${year}-01-08`;
      while (liturgicalDayOf(f).season === 'navidad' || weekdayOf(f) !== 0) {
        f = addDays(f, 1);
      }
      expect(liturgicalDayOf(f).sundayNumber).toBe(2);
    }
  });
});

describe('solemnidades fijas en domingo', () => {
  it('2026-11-01 (domingo) es Todos los Santos y no el XXXI a secas', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    const d = liturgicalDayOf('2026-11-01');
    expect(d.feastId).toBe('todos_los_santos');
    expect(d.feastName).toBe('Todos los Santos');
    expect(d.sundayNumber).toBe(31);
    expect(d.colorHex).toBe(LiturgicalColors.white);
  });

  it('la Inmaculada (8 dic) y Santiago (25 jul) están en el calendario', () => {
    expect(liturgicalDayOf('2026-12-08').feastId).toBe('inmaculada');
    expect(liturgicalDayOf('2026-07-25').feastId).toBe('santiago_apostol');
    expect(liturgicalDayOf('2026-07-25').colorHex).toBe(LiturgicalColors.red);
  });
});

describe('ciclo A/B/C por año litúrgico', () => {
  it('cambia en el 1.er domingo de Adviento, no el 1 de enero', () => {
    expect(cycleOf('2026-01-18')).toBe('A');
    expect(cycleOf('2026-11-22')).toBe('A');
    expect(cycleOf('2026-11-29')).toBe('B');
    expect(cycleOf('2026-12-31')).toBe('B');
    expect(cycleOf('2027-01-03')).toBe('B');
    expect(cycleOf('2027-11-28')).toBe('C');
    expect(cycleOf('2025-11-30')).toBe('A');
    expect(cycleOf('2025-11-23')).toBe('C');
  });

  it('liturgicalDayOf lo trae', () => {
    expect(liturgicalDayOf('2026-11-22').cycle).toBe('A');
    expect(liturgicalDayOf('2026-11-29').cycle).toBe('B');
  });
});

describe('fuera de la ventana del calendario', () => {
  it('no lanza: Tiempo Ordinario sin número, con ciclo', () => {
    const d = liturgicalDayOf('2099-06-14');
    expect(d.season).toBe('ordinario');
    expect(d.sundayNumber).toBeUndefined();
    expect(['A', 'B', 'C']).toContain(d.cycle);
  });
});

describe('getLiturgicalInfo conserva lo que ya pintaba el badge', () => {
  it('Pentecostés y Ramos en rojo, Ceniza en morado', () => {
    expect(getLiturgicalInfo('2026-05-24').hex).toBe(LiturgicalColors.red);
    expect(getLiturgicalInfo('2026-03-29').hex).toBe(LiturgicalColors.red);
    expect(getLiturgicalInfo('2026-02-18').hex).toBe(LiturgicalColors.purple);
  });
  it('el nombre de Gaudete / Laetare', () => {
    expect(getLiturgicalInfo('2026-12-13').name).toBe('Adviento (Gaudete)');
    expect(getLiturgicalInfo('2026-03-15').name).toBe('Cuaresma (Laetare)');
  });
});

describe('fechas en español', () => {
  it('longDateEs y shortDateEs', () => {
    expect(longDateEs('2026-11-22')).toBe('Domingo 22 de noviembre');
    expect(longDateEs('2026-12-31')).toBe('Jueves 31 de diciembre');
    expect(shortDateEs('2026-11-22')).toBe('22 nov');
    expect(shortDateEs('2027-03-07')).toBe('7 mar');
  });
});
