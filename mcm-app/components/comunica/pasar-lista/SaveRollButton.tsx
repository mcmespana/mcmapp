// El botón principal de marcar: «Guardar lista», «Guardar (N sin marcar)»,
// «Guardada» (con su icono) o «Aún no ha llegado». Es la acción principal:
// la del degradado de Comunica (`AreaPrimaryButton`, territorio A). Lo usan la
// lista de un grupo (plan 04) y la de monitores (plan 06).

import React from 'react';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';

/** La lista ya está guardada: el botón lo dice con el icono, no con un «✓» de texto. */
export const SAVED_LABEL = 'Guardada';

export default function SaveRollButton({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <AreaPrimaryButton
      label={label}
      icon={label === SAVED_LABEL ? 'checkmark' : undefined}
      onPress={onPress}
      disabled={!enabled}
      // La pantalla ya da su háptico al guardar (o al no poder).
      haptic={false}
    />
  );
}
