/**
 * Inicio vive en el grupo `(inicio)/` (pila propia → cabecera nativa), pero su
 * URL tiene que seguir siendo `/` y los enlaces que ya existen tienen que seguir
 * llegando: las notificaciones del panel llevan `/(tabs)/index` como
 * `internalRoute` (contrato en `docs/contratos/NOTIFICACIONES_CONTRATO.md`).
 *
 * Se prueba con el router de verdad (`renderRouter`) y pantallas de mentira con
 * la MISMA forma de carpetas que `app/(tabs)`.
 */
import React from 'react';
import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Slot, Stack, router } from 'expo-router';
import { normalizeNotificationRoute } from '@/utils/notificationRoutes';

const pantalla = (texto: string) =>
  function Pantalla() {
    return <Text>{texto}</Text>;
  };

const rutas = {
  '(tabs)/_layout': () => <Slot />,
  '(tabs)/(inicio)/_layout': () => <Stack />,
  '(tabs)/(inicio)/index': pantalla('PANTALLA INICIO'),
  '(tabs)/mas/_layout': () => <Stack />,
  '(tabs)/mas/index': pantalla('PANTALLA MAS'),
};

describe('Inicio dentro del grupo (inicio)', () => {
  it('la URL / es Inicio', async () => {
    await renderRouter(rutas, { initialUrl: '/' });
    expect(screen).toHavePathname('/');
    expect(await screen.findByText('PANTALLA INICIO')).toBeTruthy();
  });

  it('/(tabs)/index del panel se normaliza a / y llega a Inicio', async () => {
    expect(normalizeNotificationRoute('/(tabs)/index')).toBe('/');
    expect(normalizeNotificationRoute('index')).toBe('/');
    await renderRouter(rutas, { initialUrl: '/mas' });
    expect(await screen.findByText('PANTALLA MAS')).toBeTruthy();
    await act(async () =>
      router.push(normalizeNotificationRoute('/(tabs)/index') as never),
    );
    expect(await screen.findByText('PANTALLA INICIO')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('/(tabs) a secas (los «volver» sin historial) sigue llegando a Inicio', async () => {
    await renderRouter(rutas, { initialUrl: '/mas' });
    expect(await screen.findByText('PANTALLA MAS')).toBeTruthy();
    await act(async () => router.replace('/(tabs)' as never));
    expect(await screen.findByText('PANTALLA INICIO')).toBeTruthy();
  });

  it('la ruta literal /(tabs)/index YA NO existe: por eso se normaliza', async () => {
    await renderRouter(rutas, { initialUrl: '/mas' });
    expect(await screen.findByText('PANTALLA MAS')).toBeTruthy();
    await act(async () => router.push('/(tabs)/index' as never));
    expect(await screen.findByText('Unmatched Route')).toBeTruthy();
  });
});
