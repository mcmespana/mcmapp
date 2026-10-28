// El botón principal de marcar: «Guardar lista», «Guardar (N sin marcar)»,
// «Guardada ✓» o «Aún no ha llegado». Es la acción principal de la pantalla:
// la del degradado de Comunica (`AreaPrimaryButton`, territorio A). Lo usan la
// lista de un grupo (plan 04) y la de monitores (plan 06).

import React from 'react';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';

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
      onPress={onPress}
      disabled={!enabled}
      // La pantalla ya da su háptico al guardar (o al no poder).
      haptic={false}
    />
  );
}
