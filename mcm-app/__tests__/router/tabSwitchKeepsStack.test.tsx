/**
 * Guardarraíl (build 61): cambiar de pestaña con NUESTRA barra no puede
 * devolver la pestaña a su portada. Con expo-router 58,
 * `router.navigate('/cancionero')` va a la ruta `/cancionero` (la portada de
 * esa pila), y al volver al cantoral o a Contigo se perdía la canción o la
 * pantalla en la que se estaba. La barra hace ahora lo que la del sistema:
 * `JUMP_TO` al navegador de pestañas (`components/tabs/jumpToTab.ts`).
 */
import React from 'react';
import { Text } from 'react-native';
import {
  act,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';
import { Slot, Stack, Tabs, useNavigationContainerRef } from 'expo-router';
import { findTabNavigatorKey, jumpToTab } from '@/components/tabs/jumpToTab';

let navRef: ReturnType<typeof useNavigationContainerRef> | null = null;
const Raiz = () => {
  navRef = useNavigationContainerRef();
  return <Slot />;
};
const T = (t: string) => () => <Text>{t}</Text>;
const pila = {
  default: () => <Stack />,
  unstable_settings: { anchor: 'index' },
};
const rutas = () =>
  ({
    _layout: Raiz,
    '(tabs)/_layout': () => <Tabs />,
    '(tabs)/index': T('Inicio'),
    '(tabs)/cancionero/_layout': pila,
    '(tabs)/cancionero/index': T('Categorías'),
    '(tabs)/cancionero/categoria': T('Lista'),
  }) as never;

it('volver a una pestaña con la barra la deja donde estaba', async () => {
  await renderRouter(rutas(), {
    initialUrl: '/cancionero/categoria?categoryId=entrada',
  });
  await act(async () => jumpToTab(navRef, 'index', '/'));
  await waitFor(() => expect(screen).toHavePathname('/'));
  await act(async () => jumpToTab(navRef, 'cancionero', '/cancionero'));
  await waitFor(() => expect(screen).toHavePathname('/cancionero/categoria'));
});

it('encuentra el navegador de pestañas en el estado', () => {
  const estado = {
    type: 'stack',
    key: 'raiz',
    routes: [
      {
        name: '(tabs)',
        state: {
          type: 'tab',
          key: 'pestañas',
          routeNames: ['index', 'cancionero'],
          routes: [],
        },
      },
    ],
  };
  expect(findTabNavigatorKey(estado, 'cancionero')).toBe('pestañas');
  expect(findTabNavigatorKey(estado, 'otra')).toBeNull();
});
