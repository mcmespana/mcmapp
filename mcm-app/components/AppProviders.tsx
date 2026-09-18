import React from 'react';
import { HeroUINativeProvider } from 'heroui-native';

import { ActiveEventProvider } from '@/contexts/ActiveEventContext';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { AppToastProvider } from '@/contexts/AppToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { CalendarConfigProvider } from '@/contexts/CalendarConfigContext';
import { CarismochitoProvider } from '@/contexts/CarismochitoContext';
import { ChoirSessionProvider } from '@/contexts/ChoirSessionContext';
import { EventSubscriptionsProvider } from '@/contexts/EventSubscriptionsContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { OTAProvider } from '@/contexts/OTAContext';
import { OverlayStackProvider } from '@/contexts/OverlayStackContext';
import { PreviewChannelProvider } from '@/contexts/PreviewChannelContext';
import { ProfileConfigProvider } from '@/contexts/ProfileConfigContext';
import { SelectedSongsProvider } from '@/contexts/SelectedSongsContext';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { VersionGateProvider } from '@/contexts/VersionGateContext';
import UniwindThemeBridge from '@/components/UniwindThemeBridge';

/**
 * La torre de providers de la app, en su orden exacto.
 *
 * **Por qué está aquí y no en `app/_layout.tsx`.** El orden importa —
 * `AuthProvider` necesita el perfil, `OTAProvider` el canal de preview,
 * `VersionGateProvider` la config remota— así que no se puede reconstruir "a
 * mano" en otro sitio sin que se desincronice. Y hace falta reconstruirlo:
 * `__tests__/screenSmoke.test.tsx` monta las pantallas DENTRO de los
 * providers de verdad, que es la única forma de que un test se enterase de
 * fallos como los del 2026-09-09 (dos pantallas que petaban al montar en
 * cualquier plataforma sin que lo viera `tsc`, el lint ni 1.600 tests).
 *
 * Teniéndolo en un solo componente, añadir un provider lo mete en la app Y en
 * el test a la vez. Si esto se vuelve a copiar en el layout, el test empieza a
 * mentir el día que cambie el orden.
 *
 * Fuera de aquí se quedan, a propósito, `ErrorBoundary`,
 * `GestureHandlerRootView` y `SafeAreaProvider`: son la cáscara de la app (uno
 * captura, los otros dos necesitan medidas de pantalla reales) y en un test se
 * quieren controlar a mano — el ErrorBoundary, sobre todo, porque un test que
 * lo lleve dentro se traga el error que queremos ver.
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
      <AppToastProvider>
        <OverlayStackProvider>
          <ProfileConfigProvider>
            <AppSettingsProvider>
              <UniwindThemeBridge />
              <UserProfileProvider>
                <EventSubscriptionsProvider>
                  <AuthProvider>
                    <SelectedSongsProvider>
                      <ChoirSessionProvider>
                        <NotificationsProvider>
                          <CalendarConfigProvider>
                            <PreviewChannelProvider>
                              <OTAProvider>
                                <CarismochitoProvider>
                                  <ActiveEventProvider>
                                    <VersionGateProvider>
                                      {children}
                                    </VersionGateProvider>
                                  </ActiveEventProvider>
                                </CarismochitoProvider>
                              </OTAProvider>
                            </PreviewChannelProvider>
                          </CalendarConfigProvider>
                        </NotificationsProvider>
                      </ChoirSessionProvider>
                    </SelectedSongsProvider>
                  </AuthProvider>
                </EventSubscriptionsProvider>
              </UserProfileProvider>
            </AppSettingsProvider>
          </ProfileConfigProvider>
        </OverlayStackProvider>
      </AppToastProvider>
    </HeroUINativeProvider>
  );
}
