import {
  CONGRESO_MC,
  CONGRESO_PREMONIS,
  EVENTS,
  getEvent,
  getEventFirebasePath,
  getArchivedEvents,
  isEventArchived,
} from '@/constants/events';
import { TABS_CONFIG } from '@/constants/tabsCatalog';

describe('registry de eventos', () => {
  it('cada evento está registrado bajo su propio id', () => {
    for (const [key, event] of Object.entries(EVENTS)) {
      expect(event.id).toBe(key);
    }
  });

  describe('Congreso M+C', () => {
    it('está registrado y se resuelve por id', () => {
      expect(getEvent('congresomc26')).toBe(CONGRESO_MC);
    });

    it('vive en activities/congresomc26 (creado desde el panel)', () => {
      expect(CONGRESO_MC.firebasePrefix).toBe('activities/congresomc26');
      expect(getEventFirebasePath(CONGRESO_MC, 'horario')).toBe(
        'activities/congresomc26/horario',
      );
    });

    it('su color es un hex #RRGGBB válido (mergeEventMeta descarta el resto)', () => {
      expect(CONGRESO_MC.tintColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('no está archivado: no sale en «Eventos pasados» antes de tiempo', () => {
      expect(isEventArchived(CONGRESO_MC)).toBe(false);
      expect(getArchivedEvents()).not.toContain(CONGRESO_MC);
    });

    it('su tabId existe en la barra (es el hueco del evento en curso)', () => {
      expect(TABS_CONFIG.map((t) => t.name)).toContain(CONGRESO_MC.tabId);
    });

    it('sus secciones apuntan a claves de Firebase distintas', () => {
      const keys = CONGRESO_MC.sections.map((s) => s.firebaseKey);
      expect(keys.every(Boolean)).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('Congreso M+C: dos actividades el mismo fin de semana', () => {
    it('Despierta es naranja y Pre-monitores azul, con su texto', () => {
      expect(CONGRESO_MC.tintColor).toBe('#F07C2B');
      expect(CONGRESO_MC.bannerText).toBe(
        'Curso Despierta: Despertando Evangelizadores',
      );
      expect(CONGRESO_PREMONIS.tintColor).toBe('#2F80ED');
      expect(getEvent('congresomc26-premonis')).toBe(CONGRESO_PREMONIS);
    });

    it('cada una lee su horario de su propio nodo', () => {
      expect(getEventFirebasePath(CONGRESO_PREMONIS, 'horario')).toBe(
        'activities/congresomc26-premonis/horario',
      );
      expect(getEventFirebasePath(CONGRESO_MC, 'horario')).not.toBe(
        getEventFirebasePath(CONGRESO_PREMONIS, 'horario'),
      );
    });

    it('no se pisan: ids y colores distintos', () => {
      expect(CONGRESO_MC.id).not.toBe(CONGRESO_PREMONIS.id);
      expect(CONGRESO_MC.tintColor).not.toBe(CONGRESO_PREMONIS.tintColor);
    });
  });
});
