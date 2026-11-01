// El color de cada estado del calendario de familias (plan 16, «Colores»):
// tokens de la app, ningún hex. Próxima, el informativo; Asististe y No
// asististe, éxito y error (los del sistema, como las marcas de asistencia);
// Sin registrar, gris; Abierto, el acento del área; Con plaza, el primario
// (el celeste claro en oscuro, que el azul marino no se ve).

import brand, {
  ComunicaColors,
  SwipeColors,
  SystemGray,
} from '@/constants/colors';
import type { CalendarBucket } from '@/utils/comunica/calendar';

export function calendarFill(bucket: CalendarBucket, isDark: boolean): string {
  switch (bucket) {
    case 'upcoming':
      return brand.info;
    case 'attended':
      return SwipeColors.add;
    case 'absent':
      return SwipeColors.remove;
    case 'pending':
      return isDark ? SystemGray.dark.gray : SystemGray.light.gray;
    case 'open':
      return ComunicaColors.accent;
    case 'registered':
      return isDark ? brand.secondary : brand.primary;
  }
}
