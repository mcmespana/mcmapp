// La parte de familia de la portada (plan 11, `single_stic_home.php`): quien ha entrado y, si tiene hijos, a quién está viendo.
//
//   1. «Viendo a · Lucía ▾» (solo con hijos).
//   2. El saludo, con su × (vuelve dentro de un mes). No sale debajo de lo del equipo, que ya empieza con su propio encabezado.
//   3. «A quién tienes a cargo» (solo el familiar a secas): las mismas tarjetas de «¿A quién ves?» con «Ver su ficha».
//   4. «Actividades» (o «Tus pagos» para el familiar a secas), con la descripción de cada sección.
//   4b. «Próximas actividades» (si hay Calendario y algo cerca) y «Ver calendario».
//   5. «Tu perfil»: «Mis datos» o «Datos de Lucía» y, a un monitor viéndose a sí mismo, «Mis datos de monitor».
//
// La portada no conoce las rutas de los otros planes: abre DESTINOS DEL PLUGIN (`SECTION_PAGE`) con `nativeHrefFor` y, si aún no hay pantalla nativa
// (planes 12-16), la web con la sesión puesta y, viendo a un hijo, con él ya elegido. «Próximas actividades» (`UpcomingAgenda`) sale del calendario (plan 16), si se enseña Calendario y hay algo.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { nativeHrefFor, type Destination } from '@/services/comunica/links';
import {
  useActiveProfile,
  useMyProfiles,
} from '@/hooks/comunica/useActiveProfile';
import { useGreetingHidden } from '@/hooks/comunica/useHomePrefs';
import { useMe } from '@/hooks/comunica/useMe';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import {
  dataTitle,
  firstNameOf,
  greeting,
  greetingIntro,
  homeSections,
  SECTION_PAGE,
  type FamilySection,
} from '@/utils/comunica/profiles';
import AreaState from '../comun/AreaState';
import NavRow, { type NavIcon } from '../comun/NavRow';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import ProfileCard from '../perfiles/ProfileCard';
import UpcomingAgenda from './UpcomingAgenda';

const ICON: Record<FamilySection, NavIcon> = {
  profile: 'person.crop.circle',
  events: 'calendar',
  registrations: 'list.bullet.clipboard',
  calendar: 'calendar',
  payments: 'creditcard',
  documents: 'doc.text',
};

/** Abrir una sección: la pantalla nativa si ya existe; si no, la web con la sesión (y el hijo elegido, si se ve a uno). */
export function useOpenSection() {
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  const { active, isSelf } = useActiveProfile();
  return (section: FamilySection, title: string) => {
    const destination: Destination = { internalpage: SECTION_PAGE[section] };
    const native = nativeHrefFor(destination);
    if (native) router.push(native as never);
    else
      void openLegacy(
        destination,
        title,
        !isSelf && active ? active.id : undefined,
      );
  };
}

export default function MemberHome({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const query = useMyProfiles();
  // Debajo de lo del equipo, un fallo o una espera no estropean la portada: simplemente no sale.
  if (embedded && !query.data) return null;
  return (
    <AreaState query={query} skeleton="list">
      {() => <Content embedded={embedded} />}
    </AreaState>
  );
}

function Content({ embedded }: { embedded: boolean }) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { me } = useMe();
  const { ready, profiles, active, isSelf, audience, setActive } =
    useActiveProfile();
  const greetingState = useGreetingHidden();
  const openSection = useOpenSection();
  const openLegacy = useOpenLegacy();
  if (!me || !ready || !profiles || !active) return null;
  const sections = homeSections(audience);
  const activeFirst = firstNameOf(active);
  const showGreeting = !embedded && !greetingState.hidden;

  return (
    <View style={styles.wrap}>
      <ActiveProfileBar scope="personal" />
      {showGreeting ? (
        <View style={styles.greeting}>
          <View style={styles.greetingText}>
            <Text
              accessibilityRole="header"
              style={[styles.greetingTitle, { color: t.text }]}
            >
              {greeting(me)}
            </Text>
            <Text style={[styles.greetingBody, { color: t.textSecondary }]}>
              {greetingIntro(audience, activeFirst)}
            </Text>
          </View>
          <PressableFeedback
            onPress={greetingState.hide}
            accessibilityRole="button"
            accessibilityLabel="Ocultar el saludo (volverá dentro de un mes)"
            hitSlop={12}
            style={styles.close}
          >
            <IconSymbol name="xmark" size={16} color={t.textMuted} />
          </PressableFeedback>
        </View>
      ) : null}

      {audience === 'guardian' && profiles.children.length > 0 ? (
        <Section title="A quién tienes a tu cargo" bare>
          {profiles.children.map((c) => (
            <ProfileCard
              key={c.id}
              profile={c}
              isSelf={false}
              isActive={false}
              actionLabel="Ver su ficha"
              onPress={() => {
                setActive(c.id);
                const destination: Destination = {
                  internalpage: SECTION_PAGE.profile,
                };
                const native = nativeHrefFor(destination);
                if (native) router.push(native as never);
                else void openLegacy(destination, 'Datos', c.id);
              }}
            />
          ))}
        </Section>
      ) : null}

      <Section title={sections.title}>
        {sections.rows.map((r) => (
          <NavRow
            key={r.section}
            icon={ICON[r.section]}
            title={r.title}
            subtitle={r.description}
            onPress={() => openSection(r.section, r.title)}
          />
        ))}
      </Section>

      {sections.rows.some((r) => r.section === 'calendar') ? (
        <UpcomingAgenda />
      ) : null}

      {audience !== 'guardian' || isSelf ? (
        <Section title="Tu perfil">
          <NavRow
            icon="person.crop.circle"
            title={dataTitle(active, isSelf)}
            subtitle="Tus datos personales, de contacto, MCM, salud y RGPD."
            onPress={() => openSection('profile', dataTitle(active, isSelf))}
          />
          {isSelf && me.roles.includes('monitor') ? (
            <NavRow
              icon="person.crop.circle"
              title="Mis datos de monitor"
              subtitle="Tu trayectoria, formación y certificado de delitos sexuales."
              onPress={() => router.push('/comunica/yo/monitor')}
            />
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  greeting: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greetingText: { flex: 1, gap: 4 },
  greetingTitle: { ...typography.h2 },
  greetingBody: { ...typography.body },
  close: { padding: 8 },
});
