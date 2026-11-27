// «Asignar grupos» encendido o apagado: una PREFERENCIA del móvil, no un dato
// del área (plan 05, regla 12; `sticpa-pl-asignar` del plugin).

import { useBoolPreference } from '@/hooks/comunica/useBoolPreference';

export const useAssignPreference = () =>
  useBoolPreference('comunica.assignGroups');
