// components/contigo/CelebrationAnimation.tsx
//
// El burst de celebración de Contigo (hábito completado). Era una copia literal
// de `components/ui/CelebrationBurst` —mismas 12 partículas, mismos colores,
// mismas duraciones (900/800 ms) y la misma curva bezier(0.2, 0.8, 0.3, 1)—
// mantenida por duplicado. Ahora delega, así que la animación vive en un solo
// sitio y se benefició de la migración a Reanimated (corre en el hilo de UI, y
// ya no se entrecorta si JS está ocupado guardando el hábito justo al lanzarla).
//
// Se conserva el nombre y la firma porque lo usan las tres pantallas de Contigo
// (evangelio, oración y revisión).

import React from 'react';
import CelebrationBurst from '@/components/ui/CelebrationBurst';

export function CelebrationAnimation({
  visible,
}: {
  visible: boolean;
  /** Sin uso: el burst tiene su propia paleta y no depende del tema. */
  isDark?: boolean;
}) {
  return <CelebrationBurst visible={visible} />;
}

export default CelebrationAnimation;
