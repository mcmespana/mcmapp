// Helpers puros de la barra de pestañas flotante: de tab a ruta y de ruta a
// tab seleccionado.
//
// Viven aparte del componente (`components/tabs/CompactTabBar.tsx`) a
// propósito: no dependen de React ni de expo-router, así que se pueden testear
// sin montar nada.

import type { TabConfig } from '@/constants/tabsCatalog';

/** Ruta de expo-router de un tab. `index` es la raíz del grupo. */
export function hrefForTab(name: string): string {
  return name === 'index' ? '/' : `/${name}`;
}

/**
 * Índice del tab activo según el pathname. Se compara por prefijo para que las
 * rutas anidadas (`/cancionero/detalle`, `/contigo/evangelio`) sigan marcando
 * su tab. Si la ruta actual no está en la barra —un tab en overflow, al que se
 * llega desde Más— se marca "Más", que es de donde cuelga.
 */
export function selectedIndexFor(tabs: TabConfig[], pathname: string): number {
  const exact = tabs.findIndex((tab) => hrefForTab(tab.name) === pathname);
  if (exact >= 0) return exact;

  const nested = tabs.findIndex(
    (tab) => tab.name !== 'index' && pathname.startsWith(`/${tab.name}/`),
  );
  if (nested >= 0) return nested;

  const mas = tabs.findIndex((tab) => tab.name === 'mas');
  return mas >= 0 ? mas : 0;
}
