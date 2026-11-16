/**
 * `services/panueloAwards.ts`: de dónde salen las piezas por asistencia.
 * Hoy, la SIMULACIÓN del Laboratorio Alpha (un sustituto local con la forma
 * de `/panueloAwards/{personId}`); en F4, el servidor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  PANUELO_AWARDS_SIM_KEY,
  SIMULATED_PIECES,
  clearSimulation,
  loadAwards,
  simulateAttendance,
  simulateCorrection,
  simulatedAttended,
  simulatedEvents,
} from '@/services/panueloAwards';

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('la simulación del Laboratorio', () => {
  it('las piezas de mentira son por asistencia y nunca intercambiables', () => {
    const pieces = Object.values(SIMULATED_PIECES);
    expect(pieces.map((p) => p.kind).sort()).toEqual([
      'chapa',
      'medalla',
      'pin',
    ]);
    for (const piece of pieces) {
      expect(piece.grant?.type).toBe('attendance');
      expect(piece.tradeable).toBe(false);
    }
  });

  it('ofrece los eventos del servidor falso de Comunica, con un nombre', () => {
    const events = simulatedEvents({});
    expect(events.map((e) => e.id).sort()).toEqual([
      'f-evt-convivencia',
      'f-evt-pascua',
      'f-evt-salida',
    ]);
    expect(events.find((e) => e.id === 'f-evt-salida')).toMatchObject({
      name: 'Salida a la sierra · Octubre 2026',
      pieces: ['chapa-salida-sierra'],
    });
  });

  it('sin simulación no hay piezas ni catálogo extra (y no es «no se sabe»)', async () => {
    expect(await loadAwards()).toEqual({ awards: {}, catalog: {} });
  });

  it('simular asistencia concede la pieza como lo haría el servidor', async () => {
    expect(await simulateAttendance('f-evt-salida')).toEqual({
      granted: ['chapa-salida-sierra'],
      revoked: [],
    });
    const snapshot = await loadAwards();
    expect(snapshot?.awards['chapa-salida-sierra']).toMatchObject({
      via: 'attendance',
      eventId: 'f-evt-salida',
    });
    expect(snapshot?.catalog['chapa-salida-sierra']).toBeDefined();
    expect(await simulatedAttended()).toEqual(['f-evt-salida']);
  });

  it('simular que la quitan la retira; borrar la simulación lo deja todo limpio', async () => {
    await simulateAttendance('f-evt-salida');
    expect(await simulateCorrection('f-evt-salida')).toEqual({
      granted: [],
      revoked: ['chapa-salida-sierra'],
    });
    expect((await loadAwards())?.awards).toEqual({});
    expect(await simulatedAttended()).toEqual([]);
    await clearSimulation();
    expect(await AsyncStorage.getItem(PANUELO_AWARDS_SIM_KEY)).toBeNull();
  });

  it('si no se puede leer, devuelve null: no se quita nada', async () => {
    await AsyncStorage.setItem(PANUELO_AWARDS_SIM_KEY, '{roto');
    expect(await loadAwards()).toBeNull();
  });
});
