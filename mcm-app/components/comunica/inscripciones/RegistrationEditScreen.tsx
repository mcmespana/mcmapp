// «Modificar mi inscripción» (plan 14, `single_stic_registrations&action=edit`): SOLO las respuestas y las necesidades especiales. Cambiar de evento o de
// estado no se puede (`inc/stic-action.php:622-634`). Lo contestado sale marcado.
//
//   · «Guardar cambios» → «Cambios guardados.» en la ficha. Directo y con conexión, sin cola.
//   · Sin derechos (cancelada, evento pasado, plazo cerrado): «Esta inscripción ya no se puede cambiar» con el motivo y «Ver mi inscripción».

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { isComunicaApiError } from '@/services/comunica/client';
import type { RegistrationDetail } from '@/services/comunica/contract';
import {
  useRegistration,
  useRegistrationWrites,
} from '@/hooks/comunica/useRegistrations';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { firstNameOf } from '@/utils/comunica/profiles';
import { questionTitle } from '@/utils/comunica/signupForm';
import { SAVE_ERROR } from '@/utils/comunica/registrationNotes';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import RecordNote from '../comun/record/RecordNote';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { ChoiceGroup, SpecialNeedsField } from './parts';

export default function RegistrationEditScreen({
  registrationId,
}: {
  registrationId: string;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { active } = useActiveProfile();
  const q = useRegistration(active?.id, registrationId);
  const back = () =>
    router.replace({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId },
    } as never);
  const colors = {
    accentColor: t.accentText,
    titleColor: t.text,
    subtitleColor: t.textSecondary,
  };
  if (!q.data) {
    return (
      <AreaScreen>
        {q.error ? (
          <EmptyState
            icon={isNetwork(q.error) ? 'wifi-off' : 'lock'}
            title={
              isNetwork(q.error)
                ? 'Necesitas conexión para ver la inscripción'
                : 'Esta inscripción ya no está disponible'
            }
            actionLabel="Ver mis inscripciones"
            onAction={() => router.replace('/comunica/inscripciones' as never)}
            {...colors}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  const reg = q.data;
  if (!reg.manage.canEdit || !reg.edit) {
    return (
      <AreaScreen>
        <Stack.Screen options={{ title: 'Modificar inscripción' }} />
        <RecordNote
          tone="warn"
          title="Esta inscripción ya no se puede cambiar"
          text={
            reg.manage.reason ??
            'Si necesitas cambiar algo o no puedes ir, habla con tu delegación.'
          }
        />
        <Text
          accessibilityRole="link"
          onPress={back}
          style={[styles.link, { color: t.accentText }]}
        >
          Ver mi inscripción
        </Text>
      </AreaScreen>
    );
  }
  const first = active ? firstNameOf(active) : '';
  return (
    <Form
      pid={active!.id}
      reg={reg}
      edit={reg.edit}
      child={first || null}
      offline={isNetwork(q.error)}
    />
  );
}

function Form({
  pid,
  reg,
  edit,
  offline,
}: {
  pid: string;
  reg: RegistrationDetail;
  edit: NonNullable<RegistrationDetail['edit']>;
  child: string | null;
  offline: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { edit: save, busy } = useRegistrationWrites(pid, reg.id);
  const [answers, setAnswers] = useState<Partial<Record<1 | 2, number>>>(() =>
    Object.fromEntries(
      edit.questions.map((q) => [q.n, q.current ?? undefined]),
    ),
  );
  const [needs, setNeeds] = useState<string | null>(reg.specialNeeds);
  const [description, setDescription] = useState(
    reg.specialNeedsDescription ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const missing = edit.questions.some((q) => !answers[q.n]);
  const toDetail = (note?: string) =>
    router.replace({
      pathname: '/comunica/inscripciones/[registrationId]',
      params: { registrationId: reg.id, ...(note ? { note } : {}) },
    } as never);

  const onSave = async () => {
    if (missing) {
      setError('Contesta a todas las preguntas de la actividad.');
      h.error();
      return;
    }
    setError(null);
    try {
      await save({
        answers: edit.questions.map((q) => ({
          n: q.n,
          option: answers[q.n] as number,
        })),
        specialNeeds: needs,
        specialNeedsDescription:
          needs !== null && needs === edit.specialNeeds.yesValue
            ? description.trim() || null
            : null,
      });
      h.formSuccess();
      toDetail('saved');
    } catch (e) {
      h.error();
      // Con el plazo cerrado entre medias, no se ha tocado nada.
      if (isComunicaApiError(e) && e.code === 'conflict')
        return toDetail('closed');
      setError(SAVE_ERROR);
    }
  };

  return (
    <AreaScreen
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              Necesitas conexión para guardar
            </Text>
          ) : null}
          <AreaPrimaryButton
            label="Guardar cambios"
            onPress={() => void onSave()}
            disabled={offline}
            loading={busy === 'edit'}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: 'Modificar inscripción' }} />
      <View style={styles.head}>
        <Text style={[styles.kicker, { color: t.textSecondary }]}>
          Tu inscripción a
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: t.text }]}
        >
          {reg.title}
        </Text>
      </View>
      {edit.questions.map((q) => (
        <ChoiceGroup
          key={q.n}
          title={questionTitle(q, edit.questions.length)}
          options={q.options.map((o, k) => ({ value: k + 1, label: o }))}
          value={answers[q.n]}
          onChange={(v) => {
            setAnswers((a) => ({ ...a, [q.n]: v }));
            setError(null);
          }}
        />
      ))}
      <SpecialNeedsField
        def={edit.specialNeeds}
        value={needs}
        description={description}
        onValue={setNeeds}
        onDescription={setDescription}
      />
      {error ? <RecordNote tone="danger" text={error} /> : null}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  kicker: { ...typography.subhead },
  name: { ...typography.h2 },
  link: { ...typography.button, minHeight: 44, textAlignVertical: 'center' },
  hint: { ...typography.caption, textAlign: 'center' },
});
