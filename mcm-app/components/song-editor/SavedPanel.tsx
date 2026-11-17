/**
 * Lo que pasa después de «Guardar», dicho claro: dónde está el cambio ahora y
 * cuándo lo verán los demás. Y el aviso de lo que sigue pendiente de enviar.
 */
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import { SwipeColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  flushOutbox,
  getOutbox,
  subscribeOutbox,
  type SaveResult,
} from '@/services/songEditorService';

type IconName = keyof typeof MaterialIcons.glyphMap;

export default function SavedPanel({
  result,
  isNew,
  onClose,
}: {
  result: SaveResult;
  isNew: boolean;
  onClose: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const sent = result.where === 'sent';

  const steps: { icon: IconName; text: string }[] = sent
    ? [
        ...(isNew
          ? []
          : [
              {
                icon: 'smartphone' as const,
                text: 'En este móvil ya ves el cambio.',
              },
            ]),
        {
          icon: 'cloud-done',
          text: result.pushed
            ? 'El cantoral lo ha recibido y lo está publicando (un par de minutos).'
            : 'El cantoral lo ha guardado, pero aún no ha podido subirlo. Lo reintenta al próximo cambio.',
        },
        {
          icon: 'groups',
          text: 'Los demás lo verán la próxima vez que abran la app.',
        },
      ]
    : [
        {
          icon: 'smartphone',
          text: isNew
            ? 'La canción está guardada en este móvil.'
            : 'En este móvil ya ves el cambio.',
        },
        {
          icon: 'cloud-off',
          text: 'El cantoral no contesta ahora. Se enviará solo en cuanto vuelva; no cierres sesión ni borres la app.',
        },
      ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <MaterialIcons
        name={sent ? 'check-circle' : 'schedule-send'}
        size={56}
        color={sent ? SwipeColors.add : theme.textSecondary}
      />
      <Text style={[styles.title, { color: theme.text }]}>
        {sent ? 'Enviado al cantoral' : 'Guardado en este móvil'}
      </Text>
      <View style={[styles.steps, { backgroundColor: theme.backgroundSunken }]}>
        {steps.map((s) => (
          <View key={s.text} style={styles.step}>
            <MaterialIcons name={s.icon} size={20} color={theme.link} />
            <Text style={[styles.stepText, { color: theme.text }]}>
              {s.text}
            </Text>
          </View>
        ))}
      </View>
      <AppPrimaryButton label="Hecho" onPress={onClose} color={theme.link} />
    </View>
  );
}

/** Cuántos cambios siguen en el móvil; intenta enviarlos al entrar y al volver. */
export function useOutboxCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void getOutbox().then((items) => alive && setCount(items.length));
    const unsub = subscribeOutbox(read);
    read();
    void flushOutbox().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox().catch(() => {});
    });
    return () => {
      alive = false;
      unsub();
      sub.remove();
    };
  }, []);
  return count;
}

export function OutboxNotice({ count }: { count: number }) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundSunken }]}>
      <MaterialIcons
        name="schedule-send"
        size={18}
        color={theme.textSecondary}
      />
      <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
        {count === 1
          ? '1 cambio sin enviar al cantoral'
          : `${count} cambios sin enviar al cantoral`}
      </Text>
      <PressableFeedback
        onPress={async () => {
          setBusy(true);
          await flushOutbox().catch(() => {});
          setBusy(false);
        }}
        isDisabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Enviar ahora"
      >
        <Text style={[styles.noticeAction, { color: theme.link }]}>
          {busy ? 'Enviando…' : 'Enviar ahora'}
        </Text>
      </PressableFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { ...typography.h2, textAlign: 'center' },
  steps: {
    alignSelf: 'stretch',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { ...typography.body, flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md - spacing.xs,
    minHeight: 40,
    borderRadius: radii.md,
  },
  noticeText: { ...typography.caption, flex: 1 },
  noticeAction: { ...typography.caption, fontWeight: '700' },
});
