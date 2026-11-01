// «Mis datos» y «Datos de Lucía» (plan 12): la página `single_stic_comunica_perfil` del plugin en nativo. Una sola pantalla para las tres audiencias (el
// servidor decide las secciones: el miembro, las siete; el hijo y el familiar, sin MCM).
//
//   · Mismos campos, orden y textos que el plugin (`copy.ts`). Lo que aquí no se edita va como dato con candado, nunca como un campo apagado.
//   · Nada es obligatorio; solo los formatos mal escritos no dejan guardar (`personDetails.ts`).
//   · «Guardar» en la `BottomActionBar`, apagado sin cambios. Escribe DIRECTO y con conexión (sin cola: son datos personales y de salud) y solo lo que
//     cambia. Salir con cambios sin guardar pregunta.
//   · Nada de esto se guarda en el móvil (ver `usePersonDetails.ts`).
//   · La foto se cambia aquí mismo y se sube en el acto, sin esperar a «Guardar» (`PhotoBlock`, `usePhotoUpload`): directa, con conexión, sin cola.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, usePreventRemove, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useToast } from '@/contexts/AppToastContext';
import { isComunicaApiError } from '@/services/comunica/client';
import type { PersonDetails } from '@/services/comunica/contract';
import { SCARF_LABEL } from '../grupos/FichaParts';
import {
  useProfileDetails,
  useProfileHealth,
  useSaveProfile,
} from '@/hooks/comunica/usePersonDetails';
import { usePersonDetailsForm } from '@/hooks/comunica/usePersonDetailsForm';
import { useMyProfiles } from '@/hooks/comunica/useActiveProfile';
import { fullDay } from '@/utils/comunica/dates';
import {
  fillable,
  visibility,
  type DetailErrors,
} from '@/utils/comunica/personDetails';
import { dataTitle, firstNameOf } from '@/utils/comunica/profiles';
import { h } from '@/utils/haptics';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import DateTimeField from '../comun/DateTimeField';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { TextFormField } from '../comun/form/FormField';
import FormSection, { FormNote } from '../comun/form/FormSection';
import SelectField from '../comun/form/SelectField';
import { DATOS_COPY as C, HEALTH_FIELDS } from './copy';
import PhotoBlock from './PhotoBlock';
import {
  ConsentRow,
  LockedField,
  PayMissingAlert,
  ReferentLink,
} from './DataParts';

const SCARF_OPTIONS = (
  ['none', 'red', 'green', 'blue', 'yellow', 'cross'] as const
).map((v) => ({ value: v, label: SCARF_LABEL[v] }));

const labelOf = (list: { value: string; label: string }[], v: string | null) =>
  list.find((o) => o.value === v)?.label ?? v;

export default function ProfileDataScreen({
  pid,
  completar = false,
}: {
  pid: string;
  /** El rebote del pago (`?completar=pago`): se pueden escribir los datos de identidad que faltan. */
  completar?: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const mine = useMyProfiles();
  const q = useProfileDetails(pid);
  const ref =
    mine.data?.self.id === pid
      ? mine.data.self
      : mine.data?.children.find((c) => c.id === pid);
  const isSelf = mine.data?.self.id === pid;
  const title = dataTitle(ref ?? { firstName: null }, isSelf || !mine.data);

  const back = (
    <EmptyState
      icon="lock"
      title={C.forbidden.title}
      subtitle={C.forbidden.subtitle}
      actionLabel={C.forbidden.action}
      onAction={() => router.back()}
      accentColor={t.accentText}
      titleColor={t.text}
      subtitleColor={t.textSecondary}
    />
  );

  if (isComunicaApiError(q.error) && q.error.code === 'forbidden') {
    return (
      <AreaScreen>
        <Stack.Screen options={{ title }} />
        {back}
      </AreaScreen>
    );
  }
  if (!q.data) {
    // Sin datos y sin red: estos datos no se guardan en el móvil, así que no hay nada que enseñar.
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <Stack.Screen options={{ title }} />
        {isNetwork(q.error) ? (
          <EmptyState
            icon="wifi-off"
            title={C.offlineEmpty.title}
            subtitle={C.offlineEmpty.subtitle}
            actionLabel={C.offlineEmpty.action}
            onAction={() => void q.refetch()}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : q.error ? (
          <EmptyState
            icon="error-outline"
            title="No se ha podido cargar"
            subtitle="Puede ser un fallo puntual."
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : (
          <AreaSkeleton kind="cards" />
        )}
      </AreaScreen>
    );
  }
  return (
    <DataForm
      pid={pid}
      title={title}
      details={q.data}
      firstName={ref ? firstNameOf(ref) : ''}
      isSelf={isSelf}
      offline={isNetwork(q.error)}
      completar={completar}
      refetch={() => q.refetch()}
    />
  );
}

function DataForm({
  pid,
  title,
  details,
  firstName,
  isSelf,
  offline,
  completar,
  refetch,
}: {
  pid: string;
  title: string;
  details: PersonDetails;
  firstName: string;
  isSelf: boolean;
  offline: boolean;
  completar: boolean;
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const vis0 = details.sections.includes('health');
  const healthQ = useProfileHealth(pid, vis0);
  const { save, saving } = useSaveProfile(pid);
  const f = usePersonDetailsForm(
    details,
    healthQ.data?.health ?? null,
    completar,
  );
  const { form, set } = f;
  const vis = visibility(details, form);
  const can = fillable(details, completar);
  const [serverErrors, setServerErrors] = useState<DetailErrors>({});
  const [saved, setSaved] = useState(false);
  const errors: DetailErrors = { ...serverErrors, ...f.errors };
  const blocked = Object.keys(f.errors).length > 0;
  const opt = details.options;

  usePreventRemove(f.dirty, ({ repeat }) => {
    void confirmAction(
      C.leave.title,
      C.leave.message,
      C.leave.action,
      true,
    ).then((leave) => {
      if (leave) repeat();
    });
  });

  const onSave = async () => {
    if (blocked) {
      h.error();
      return;
    }
    setServerErrors({});
    try {
      const out = await save({
        changes: f.changes(),
        health: f.healthChanges(),
        confirmedHealth: healthQ.data?.health ?? null,
      });
      f.rebaseTo(out.details, out.health);
      h.formSuccess();
      toast.show({ variant: 'success', label: C.saved });
      setSaved(true);
    } catch (e) {
      h.error();
      if (isComunicaApiError(e) && e.code === 'validation') {
        const field = FIELD_OF_REASON[e.reason ?? ''];
        if (field) {
          setServerErrors({ [field]: e.message });
          return;
        }
      }
      if (isComunicaApiError(e) && e.code === 'forbidden') {
        toast.show({ variant: 'danger', label: C.forbidden.title });
        return;
      }
      toast.show({ variant: 'danger', label: C.saveError });
    }
  };

  // Guardado el rebote del pago: la acción pasa a ser «Volver al pago».
  const backToPay = saved && !f.dirty && completar;

  const greeting = firstName
    ? isSelf
      ? C.greetingOwn(firstName)
      : C.greetingChild(firstName)
    : C.greetingNoName;
  const person = {
    id: pid,
    firstName: details.identity.firstName,
    lastName: details.identity.lastName,
    photoUrl: details.photoUrl ?? undefined,
  };

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          {offline ? (
            <Text style={[styles.offline, { color: t.textSecondary }]}>
              {C.offlineSave}
            </Text>
          ) : null}
          <AreaPrimaryButton
            label={backToPay ? C.pay.back : saving ? C.saving : C.save}
            onPress={() => (backToPay ? router.back() : void onSave())}
            disabled={!backToPay && (!f.dirty || offline)}
            loading={saving}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title }} />
      {completar ? <PayMissingAlert /> : null}

      {vis.sections.has('identity') ? (
        <FormSection title={C.sections.identity}>
          <FormNote>{greeting}</FormNote>
          {can.firstName ? (
            <TextFormField
              label={C.identity.firstName}
              value={form.fillFirstName}
              onChangeText={(v) => set('fillFirstName', v)}
              autoComplete="given-name"
              maxLength={100}
            />
          ) : (
            <LockedField
              label={C.identity.firstName}
              value={details.identity.firstName || null}
            />
          )}
          {can.lastName ? (
            <TextFormField
              label={C.identity.lastName}
              value={form.fillLastName}
              onChangeText={(v) => set('fillLastName', v)}
              autoComplete="family-name"
              maxLength={100}
            />
          ) : (
            <LockedField
              label={C.identity.lastName}
              value={details.identity.lastName || null}
            />
          )}
          {can.documentType ? (
            <SelectField
              label={C.identity.documentType}
              value={form.fillDocumentType}
              options={opt.documentType}
              onChange={(v) => set('fillDocumentType', v)}
            />
          ) : (
            <LockedField
              label={C.identity.documentType}
              value={labelOf(opt.documentType, details.identity.documentType)}
            />
          )}
          {can.documentNumber ? (
            <TextFormField
              label={C.identity.documentNumber}
              value={form.fillDocumentNumber}
              onChangeText={(v) => set('fillDocumentNumber', v)}
              error={errors.fillDocumentNumber}
              autoCapitalize="characters"
              maxLength={30}
            />
          ) : (
            <LockedField
              label={C.identity.documentNumber}
              value={details.identity.documentNumber}
            />
          )}
          <LockedField
            label={C.identity.birthDate}
            value={
              details.identity.birthDate
                ? fullDay(details.identity.birthDate)
                : null
            }
          />
          <SelectField
            label={C.identity.gender}
            value={form.gender}
            options={opt.gender}
            onChange={(v) => set('gender', v)}
          />
          {vis.support ? (
            <TextFormField
              label={C.identity.support}
              hint={`✓ ${C.identity.have}`}
              value={form.supportNumber}
              onChangeText={(v) => set('supportNumber', v)}
              autoCapitalize="characters"
              maxLength={20}
            />
          ) : null}
          {vis.issueDate ? (
            <View>
              <DateTimeField
                mode="date"
                label={C.identity.issueDate}
                value={form.issueDate}
                onChange={(v) => set('issueDate', v)}
              />
              <Text style={[styles.hint, { color: t.textSecondary }]}>
                {`✓ ${C.identity.have}`}
              </Text>
            </View>
          ) : null}
          <FormNote icon="lock">
            {C.identity.locked}
            <ReferentLink />.
          </FormNote>
        </FormSection>
      ) : null}

      {vis.sections.has('contact') ? (
        <FormSection title={C.sections.contact}>
          {details.emailNote === 'mcm_email_warning' ? (
            <FormNote icon="exclamationmark.triangle.fill">
              {C.contact.warning.before}
              <Text style={styles.strong}>{C.contact.warning.strong}</Text>
              {C.contact.warning.after}
            </FormNote>
          ) : null}
          {details.emailNote === 'mcm_email_soft' ? (
            <FormNote>
              {C.contact.soft.before}
              <Text style={styles.strong}>{C.contact.soft.strong}</Text>
              {C.contact.soft.after}
            </FormNote>
          ) : null}
          <TextFormField
            label={C.contact.email}
            value={form.email}
            onChangeText={(v) => set('email', v)}
            error={errors.email}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
          />
          <TextFormField
            label={C.contact.mobile}
            value={form.mobile}
            onChangeText={(v) => set('mobile', v)}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={30}
          />
          <TextFormField
            label={C.contact.emergency}
            help={C.contact.emergencyHelp}
            value={form.emergencyPhone}
            onChangeText={(v) => set('emergencyPhone', v)}
            keyboardType="phone-pad"
            maxLength={30}
          />
        </FormSection>
      ) : null}

      {vis.sections.has('address') ? (
        <FormSection title={C.sections.address}>
          <TextFormField
            label={C.address.street}
            value={form.street}
            onChangeText={(v) => set('street', v)}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            maxLength={255}
          />
          <TextFormField
            label={C.address.city}
            value={form.city}
            onChangeText={(v) => set('city', v)}
            textContentType="addressCity"
            maxLength={100}
          />
          <TextFormField
            label={C.address.province}
            value={form.province}
            onChangeText={(v) => set('province', v)}
            textContentType="addressState"
            maxLength={100}
          />
          <TextFormField
            label={C.address.postalCode}
            value={form.postalCode}
            onChangeText={(v) => set('postalCode', v)}
            error={errors.postalCode}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="postal-code"
            textContentType="postalCode"
            maxLength={5}
            inline
          />
          <SelectField
            label={C.address.region}
            value={form.region}
            options={opt.region}
            onChange={(v) => set('region', v)}
          />
        </FormSection>
      ) : null}

      {vis.sections.has('photo') ? (
        <FormSection title={C.sections.photo}>
          <PhotoBlock pid={pid} person={person} offline={offline} />
        </FormSection>
      ) : null}

      {vis.sections.has('mcm') && details.mcm ? (
        <FormSection title={C.sections.mcm}>
          <SelectField
            label={C.mcm.stage}
            value={form.stage}
            options={opt.stage}
            onChange={(v) => set('stage', v)}
          />
          <SelectField
            label={C.mcm.scarf}
            value={form.scarf === 'unknown' ? null : form.scarf}
            options={SCARF_OPTIONS}
            onChange={(v) => set('scarf', v)}
          />
          {vis.comLevel ? (
            <SelectField
              label={C.mcm.comLevel}
              value={form.comLevel}
              options={opt.comLevel}
              onChange={(v) => set('comLevel', v)}
            />
          ) : null}
          {vis.lcYear ? (
            <TextFormField
              label={C.mcm.lcYear}
              help={C.mcm.lcYearHelp}
              placeholder={C.mcm.year}
              value={form.lcYear}
              onChangeText={(v) => set('lcYear', v)}
              error={errors.lcYear}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={4}
              inline
            />
          ) : null}
          <SelectField
            label={C.mcm.shirtSize}
            value={form.shirtSize}
            options={opt.shirtSize}
            onChange={(v) => set('shirtSize', v)}
          />
          <TextFormField
            label={C.mcm.groupName}
            help={C.mcm.groupHelp}
            value={form.groupName}
            onChangeText={(v) => set('groupName', v)}
            maxLength={255}
          />
          <SelectField
            label={C.mcm.localMcm}
            value={form.localMcm}
            options={opt.localMcm}
            onChange={(v) => set('localMcm', v)}
          />
          <TextFormField
            label={C.mcm.memberSince}
            help={C.mcm.memberSinceHelp}
            placeholder={C.mcm.year}
            value={form.memberSince}
            onChangeText={(v) => set('memberSince', v)}
            error={errors.memberSince}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            inline
          />
        </FormSection>
      ) : null}

      {vis.sections.has('health') ? (
        <FormSection title={C.sections.health}>
          <FormNote>{C.health.note}</FormNote>
          {f.healthForm ? (
            HEALTH_FIELDS.map((k) => (
              <TextFormField
                key={k}
                label={C.health[k].label}
                help={C.health[k].help}
                value={f.healthForm![k]}
                onChangeText={(v) => f.setHealth(k, v)}
                multiline
                maxLength={2000}
              />
            ))
          ) : healthQ.error ? (
            <View style={styles.healthState}>
              <Text style={[styles.hintPlain, { color: t.textSecondary }]}>
                {C.health.error}
              </Text>
              <PressableFeedback
                onPress={() => void healthQ.refetch()}
                accessibilityRole="button"
                accessibilityLabel={C.health.retry}
                style={styles.retry}
              >
                <Text style={[styles.retryText, { color: t.accentText }]}>
                  {C.health.retry}
                </Text>
              </PressableFeedback>
            </View>
          ) : (
            <Text style={[styles.healthState, { color: t.textSecondary }]}>
              {C.health.loading}
            </Text>
          )}
        </FormSection>
      ) : null}

      {vis.sections.has('consents') ? (
        <FormSection title={C.sections.consents}>
          {C.consents.items.map((c) => (
            <ConsentRow
              key={c.key}
              statement={c.statement}
              url={c.url}
              value={form[c.key]}
              onChange={(v) => set(c.key, v)}
            />
          ))}
        </FormSection>
      ) : null}
    </AreaScreen>
  );
}

/** Qué campo señala cada motivo de `validation` del servidor. */
const FIELD_OF_REASON: Record<string, keyof DetailErrors> = {
  bad_email: 'email',
  bad_postal_code: 'postalCode',
  bad_year: 'memberSince',
  bad_document: 'fillDocumentNumber',
};

const styles = StyleSheet.create({
  strong: { fontWeight: '600' },
  offline: { ...typography.caption, textAlign: 'center' },
  hint: { ...typography.caption, paddingHorizontal: 16, paddingBottom: 12 },
  hintPlain: { ...typography.caption },
  healthState: { padding: 16, gap: 8 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { ...typography.button },
});
