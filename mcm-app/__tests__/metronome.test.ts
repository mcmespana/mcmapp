import {
  DEFAULT_BPM,
  MAX_BPM,
  MIN_BPM,
  TAP_RESET_MS,
  beatInterval,
  beatsUntil,
  clampBpm,
  isBeatsPerBar,
  tapTempo,
} from '@/utils/metronome';

describe('metronome · tempo', () => {
  it('redondea y no sale de los topes', () => {
    expect(clampBpm(92.4)).toBe(92);
    expect(clampBpm(5)).toBe(MIN_BPM);
    expect(clampBpm(999)).toBe(MAX_BPM);
    expect(clampBpm(NaN)).toBe(DEFAULT_BPM);
  });

  it('a 120 hay un pulso cada medio segundo', () => {
    expect(beatInterval(120)).toBeCloseTo(0.5);
  });

  it('solo acepta los compases que se ofrecen', () => {
    expect(isBeatsPerBar(4)).toBe(true);
    expect(isBeatsPerBar(5)).toBe(false);
    expect(isBeatsPerBar('4')).toBe(false);
  });
});

describe('metronome · programar pulsos', () => {
  it('da los pulsos de la ventana y deja el cursor en el siguiente', () => {
    const { beats, cursor } = beatsUntil(
      { nextTime: 1, nextIndex: 0 },
      2.1,
      120,
      4,
    );
    expect(beats.map((b) => b.time)).toEqual([1, 1.5, 2]);
    expect(beats.map((b) => b.index)).toEqual([0, 1, 2]);
    expect(beats.map((b) => b.accent)).toEqual([true, false, false]);
    expect(cursor).toEqual({ nextTime: 2.5, nextIndex: 3 });
  });

  it('vuelve al primero al acabar el compás', () => {
    const { beats } = beatsUntil({ nextTime: 0, nextIndex: 2 }, 1.4, 120, 3);
    expect(beats.map((b) => b.index)).toEqual([2, 0, 1]);
    expect(beats[1].accent).toBe(true);
  });

  it('con un solo pulso por compás no hay acento', () => {
    const { beats } = beatsUntil({ nextTime: 0, nextIndex: 0 }, 1.1, 60, 1);
    expect(beats).toHaveLength(2);
    expect(beats.every((b) => !b.accent)).toBe(true);
  });

  it('sin pulsos en la ventana, el cursor no se mueve', () => {
    const start = { nextTime: 5, nextIndex: 1 };
    const { beats, cursor } = beatsUntil(start, 4.9, 100, 4);
    expect(beats).toEqual([]);
    expect(cursor).toEqual(start);
  });

  it('si se acorta el compás, el índice vuelve a caber', () => {
    const { beats } = beatsUntil({ nextTime: 0, nextIndex: 5 }, 0.1, 60, 4);
    expect(beats[0].index).toBe(1);
  });

  it('una ventana absurda no programa pulsos sin fin', () => {
    const { beats } = beatsUntil({ nextTime: 0, nextIndex: 0 }, 9999, 220, 4);
    expect(beats.length).toBeLessThanOrEqual(16);
  });
});

describe('metronome · marcar el tempo', () => {
  it('un toque solo no da tempo', () => {
    expect(tapTempo([], 1000)).toEqual({ taps: [1000], bpm: null });
  });

  it('toques cada medio segundo son 120', () => {
    let state = tapTempo([], 0);
    for (const t of [500, 1000, 1500]) state = tapTempo(state.taps, t);
    expect(state.bpm).toBe(120);
  });

  it('promedia: un toque adelantado no lo descoloca', () => {
    let state = tapTempo([], 0);
    for (const t of [600, 1150, 1800]) state = tapTempo(state.taps, t);
    expect(state.bpm).toBe(100);
  });

  it('tras una pausa larga se empieza de nuevo', () => {
    const first = tapTempo([0, 500], 500 + TAP_RESET_MS + 1);
    expect(first.bpm).toBeNull();
    expect(first.taps).toHaveLength(1);
  });

  it('solo cuentan los últimos toques', () => {
    let state = tapTempo([], 0);
    // Empieza lento y acaba rápido: manda lo último.
    for (const t of [1000, 2000, 2400, 2800, 3200, 3600, 4000, 4400])
      state = tapTempo(state.taps, t);
    expect(state.bpm).toBe(150);
  });

  it('el tempo marcado respeta los topes', () => {
    expect(tapTempo([0], 50).bpm).toBe(MAX_BPM);
    expect(tapTempo([0], 1900).bpm).toBe(MIN_BPM);
  });
});
