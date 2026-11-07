/**
 * Último paso del onboarding del cantoral: «¿Formas parte de un coro?».
 *
 * Elegir tu coro (o registrar el tuyo si no está) es lo mismo que hace la hoja
 * del coro de «Tu selección»: se guarda con `useMyChoir` y, a partir de ahí,
 * importar la playlist del domingo es un toque. Es opcional: quien no está en
 * ningún coro pulsa «Listo» y no pasa nada.
 *
 * No usa toasts: el onboarding es un Modal y un toast saldría por detrás. El
 * resultado se ve en la propia lista (el coro queda marcado).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import EmptyState from '@/components/ui/EmptyState';
import OptionRow from '@/components/song-onboarding/OptionRow';
import {
  valueBoxStyle,
  type SheetPalette,
} from '@/components/song-sheet/sheetKit';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useMyChoir } from '@/hooks/useMyChoir';
import {
  createChoir,
  listChoirs,
  type Choir,
} from '@/services/choirDirectoryService';
import { choirCreateErrorMessage } from '@/utils/cantoralOnboarding';
import { MAX_CHOIR_NAME_LENGTH, normalizeChoirName } from '@/utils/choirIds';
import { logger } from '@/utils/logger';
import { h } from '@/utils/haptics';
import { themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

const MIN_NAME = 3;

export default function ChoirStep({
  palette: p,
  isDark,
}: {
  palette: SheetPalette;
  isDark: boolean;
}) {
  const t = themeColors(isDark);
  const { choir: myChoir, setChoir } = useMyChoir();
  const { deviceId } = useChoirSession();
  const { profile } = useUserProfile();

  const [choirs, setChoirs] = useState<Choir[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Cada cambio de `attempt` vuelve a pedir la lista (el primero, al montar).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listChoirs()
      .then((list) => {
        if (!cancelled) setChoirs(list);
      })
      .catch((e) => {
        logger.error('onboarding choirs load error', e);
        if (cancelled) return;
        setLoadError(true);
        setChoirs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = () => {
    setLoadError(false);
    setChoirs(null);
    setAttempt((n) => n + 1);
  };

  const canCreate = normalizeChoirName(name).length >= MIN_NAME;

  const register = async () => {
    if (busy || !canCreate) return;
    setBusy(true);
    setCreateError(null);
    try {
      const created = await createChoir(name, {
        deviceId,
        name: profile.name?.trim() || undefined,
      });
      h.formSuccess();
      setChoir({ id: created.id, name: created.name });
      setChoirs((prev) =>
        [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setCreating(false);
      setName('');
    } catch (e) {
      logger.warn('onboarding choir create error', e);
      setCreateError(choirCreateErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.group}>
      {choirs === null ? (
        <ActivityIndicator color={t.link} style={styles.loading} />
      ) : loadError ? (
        <EmptyState
          compact
          icon="cloud-off"
          title="No se ha podido cargar la lista de coros. ¿Tienes internet?"
          actionLabel="Reintentar"
          onAction={retry}
          accentColor={t.link}
        />
      ) : choirs.length === 0 ? (
        <EmptyState
          compact
          icon="groups"
          title="Todavía no hay ningún coro. Registra el primero."
          accentColor={t.link}
        />
      ) : (
        choirs.map((c) => {
          const n = Object.keys(c.playlists).length;
          return (
            <OptionRow
              key={c.id}
              palette={p}
              icon="groups"
              title={c.name}
              desc={`${n} ${n === 1 ? 'playlist' : 'playlists'}`}
              active={myChoir?.id === c.id}
              onPress={() => setChoir({ id: c.id, name: c.name })}
            />
          );
        })
      )}

      {creating ? (
        <View style={[styles.form, valueBoxStyle(p, false)]}>
          <Text style={[styles.formLabel, { color: p.text }]}>
            Nombre de tu coro
          </Text>
          <AppTextField
            value={name}
            onChangeText={setName}
            placeholder="Coro Consolación Castellón"
            maxLength={MAX_CHOIR_NAME_LENGTH}
            autoFocus
            editable={!busy}
            error={!!createError}
            accentColor={t.link}
            accessibilityLabel="Nombre de tu coro"
            returnKeyType="done"
            onSubmitEditing={() => void register()}
          />
          <Text style={[styles.formHint, { color: p.textSecondary }]}>
            Cualquiera podrá elegirlo y subirle playlists, así que ponle el
            nombre por el que lo conoce la gente.
          </Text>
          {createError ? (
            <Text
              style={[styles.formHint, { color: t.text }]}
              accessibilityRole="alert"
            >
              {createError}
            </Text>
          ) : null}
          <View style={styles.formButtons}>
            <PressableFeedback
              onPress={() => {
                setCreating(false);
                setCreateError(null);
              }}
              isDisabled={busy}
              style={styles.cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancelar el registro del coro"
            >
              <PressableFeedback.Highlight />
              <Text style={[styles.cancelText, { color: t.link }]}>
                Cancelar
              </Text>
            </PressableFeedback>
            <AppPrimaryButton
              label="Registrar coro"
              icon="check"
              onPress={() => void register()}
              disabled={!canCreate}
              loading={busy}
              style={styles.register}
            />
          </View>
        </View>
      ) : (
        <PressableFeedback
          onPress={() => {
            h.tap();
            setCreateError(null);
            setCreating(true);
          }}
          style={[styles.addRow, valueBoxStyle(p, false)]}
          accessibilityRole="button"
          accessibilityLabel="Registrar mi coro. Para cuando tu coro no está en la lista"
        >
          <PressableFeedback.Highlight />
          <MaterialIcons name="add-circle-outline" size={24} color={t.link} />
          <View style={styles.addText}>
            <Text style={[styles.addTitle, { color: p.text }]}>
              Registrar mi coro
            </Text>
            <Text style={[styles.addDesc, { color: p.textSecondary }]}>
              Si el tuyo no está en la lista
            </Text>
          </View>
        </PressableFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm, marginTop: spacing.xs },
  loading: { paddingVertical: spacing.md },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  addText: { flex: 1 },
  addTitle: { ...typography.title },
  addDesc: { ...typography.footnote },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  formLabel: { ...typography.subhead, fontWeight: '600' },
  formHint: { ...typography.footnote },
  formButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cancel: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...typography.button },
  register: { flex: 1 },
});
