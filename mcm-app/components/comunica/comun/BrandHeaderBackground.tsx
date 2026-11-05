// El fondo de la cabecera de TODO el área (`Stack` de `app/(tabs)/comunica/`):
// la barra de navegación con el degradado de marca del plugin, en iOS, Android
// y web. La tinta de encima (título, atrás, iconos) es blanca: `t.onGradient`.
//
// Es un BLOQUE de marca (full width, sin brillo) y cuenta como uno de los dos
// que admite una pantalla: el contenido solo puede llevar otro (hero, tarjeta
// destacada o acción principal). `territorio.test.ts` limita cada fichero a uno.
// En la portada convive con el hero, que se cierra con su × (regla «nunca dos
// bloques seguidos que no se puedan cerrar» de `theme.ts`).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import BrandGradient from './BrandGradient';

export default function BrandHeaderBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BrandGradient variant="block" />
    </View>
  );
}
