// La parte de familia y miembro de la portada (plan 11, `single_stic_home.php`):
// saludo, «A quién tienes a tu cargo», «Actividades» (o «Tus pagos») y «Tu
// perfil». No tiene scroll propio: va dentro de la portada (`AreaScreen`),
// debajo de lo del equipo si lo hay (CAR-1: una sola portada). Lo del equipo
// es de quien ha entrado y no cambia con el selector; esto sí.
//
// Las filas abren DESTINOS del plugin (`useOpenDestination`): lo nativo si ya
// hay pantalla y, si no, la web con el perfil puesto.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { useOpenDestination } from '@/hooks/comunica/useOpenDestination';
import {
  greetingLead,
  greetingTitle,
  homeSections,
  isGreetingHidden,
  type HomeRowKey,
} from '@/utils/comunica/home';
import { firstNameOf } from '@/utils/comunica/profiles';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import ProfileCard from '../perfiles/ProfileCard';
import NavRow, { type NavIcon } from '../comun/NavRow';
import Section from '../comun/Section';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const ICON: Record<HomeRowKey, NavIcon> = {
  events: 'ticket',
  registrations: 'list.bullet.clipboard',
  calendar: 'calendar',
  payments: 'creditcard',
  documents: 'doc.text',
  profile: 'person.crop.circle',
  monitor: 'graduationcap',
};

const greetingKey = (personId: string) =>
  `comunica.greetingHiddenAt.${personId}`;

export default function MemberHome({
  isMonitor = false,
  showGreeting = true,
  agenda,
}: {
  isMonitor?: boolean;
  /** Con lo del equipo encima, el saludo ya lo da su cabecera. */
  showGreeting?: boolean;
  /** «Próximas actividades» (plan 16), entre las actividades y el perfil. */
  agenda?: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const active = useActiveProfile();
  const open = useOpenDestination();
  const selfId = active.self?.id ?? null;
  const [hidden, setHidden] = useState(true);

  // El saludo cerrado vuelve al mes, por persona.
  useEffect(() => {
    if (!selfId) return;
    let cancelled = false;
    AsyncStorage.getItem(greetingKey(selfId))
      .then((at) => {
        if (!cancelled) setHidden(isGreetingHidden(at, new Date()));
      })
      .catch(() => {
        if (!cancelled) setHidden(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selfId]);

  if (!active.ready || !active.pid) return null;

  const hideGreeting = () => {
    setHidden(true);
    if (selfId) {
      AsyncStorage.setItem(greetingKey(selfId), new Date().toISOString()).catch(
        () => {},
      );
    }
  };

  const blocks = homeSections({
    audience: active.audience,
    childFirstName: active.childFirstName,
    isMonitor,
  });
  const lead = greetingLead(active.audience, active.childFirstName);
  const guardianWithChildren =
    active.audience === 'guardian' && active.children.length > 0;

  return (
    <View style={styles.root}>
      {active.hasChildren ? <ActiveProfileBar /> : null}

      {showGreeting && !hidden ? (
        <View style={[styles.greeting, { backgroundColor: t.card }]}>
          <View style={styles.greetingBody}>
            <Text
              style={[styles.greetingTitle, { color: t.text }]}
              accessibilityRole="header"
            >
              {greetingTitle(firstNameOf(active.self?.firstName))}
            </Text>
            <Text style={[styles.greetingLead, { color: t.textSecondary }]}>
              {lead.map((p, i) => (
                <Text
                  key={i}
                  style={p.strong ? { fontWeight: '700', color: t.text } : null}
                >
                  {p.text}
                </Text>
              ))}
            </Text>
          </View>
          <PressableFeedback
            onPress={hideGreeting}
            accessibilityRole="button"
            accessibilityLabel="Ocultar el saludo (volverá dentro de un mes)"
            hitSlop={12}
            style={styles.close}
          >
            <IconSymbol name="xmark" size={16} color={t.textMuted} />
          </PressableFeedback>
        </View>
      ) : null}

      {guardianWithChildren ? (
        <Section title="A quién tienes a tu cargo">
          {active.children.map((c) => (
            <ProfileCard
              key={c.id}
              profile={c}
              isSelf={false}
              active={false}
              action="Ver su ficha"
              onPress={() => {
                active.choose(c.id);
              }}
            />
          ))}
        </Section>
      ) : null}

      {blocks.map((b, i) => (
        <React.Fragment key={b.key}>
          {b.rows.length > 0 ? (
            <Section title={b.title}>
              {b.rows.map((r) => (
                <NavRow
                  key={r.key}
                  icon={ICON[r.key]}
                  title={r.title}
                  subtitle={r.description}
                  onPress={() => open(r.destination, r.title)}
                />
              ))}
            </Section>
          ) : null}
          {/* La agenda va justo después de «Actividades». */}
          {i === 0 ? agenda : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  greeting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: radii.lg,
  },
  greetingBody: { flex: 1, gap: 6 },
  greetingTitle: { ...typography.h2 },
  greetingLead: { ...typography.body },
  close: { padding: 4 },
});
