// Pinta un formulario declarado (`utils/comunica/forms.ts`, plan 12) con las
// piezas del plan 09: una `FormSection` por sección y, dentro, cada campo con
// la suya. No sabe de qué es el formulario: valores, opciones y qué hacer al
// cambiar le llegan de fuera. Una sección se puede pintar a mano
// (`renderSection`: la foto) o sustituir mientras carga (la salud).

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import {
  boldParts,
  type FieldSpec,
  type FormValue,
  type FormValues,
  type SectionSpec,
  visibleFields,
} from '@/utils/comunica/forms';
import DateTimeField from '../DateTimeField';
import { useComunicaTheme } from '../useComunicaTheme';
import { FieldHint, TextFormField } from './FormField';
import FormSection, { FormNote } from './FormSection';
import SelectField, { type SelectOption } from './SelectField';
import SwitchField from './SwitchField';

export type FormOptions = Readonly<
  Record<string, readonly SelectOption<string>[]>
>;

interface Props {
  spec: readonly SectionSpec[];
  values: FormValues;
  /** Lo confirmado por el servidor (para `onlyIfPresent`). */
  confirmed: FormValues;
  errors: Readonly<Record<string, string>>;
  options: FormOptions;
  onChange: (key: string, value: FormValue) => void;
  /** Una sección pintada a mano; `undefined` = la del motor. */
  renderSection?: (section: SectionSpec) => React.ReactNode | undefined;
  /** El texto bajo una autorización sin contestar. */
  unansweredLabel?: string;
  /** El enlace de una autorización. */
  conditionsLabel?: string;
}

export default function DeclarativeForm({
  spec,
  values,
  confirmed,
  errors,
  options,
  onChange,
  renderSection,
  unansweredLabel = 'Sin contestar',
  conditionsLabel = 'Ver condiciones',
}: Props) {
  return (
    <>
      {spec.map((section) => {
        const custom = renderSection?.(section);
        if (custom !== undefined) {
          return <React.Fragment key={section.id}>{custom}</React.Fragment>;
        }
        return (
          <FormSection key={section.id} title={section.title}>
            {visibleFields(section, values, confirmed).map((f) => (
              <Field
                key={f.key}
                field={f}
                value={values[f.key] ?? null}
                confirmed={confirmed[f.key] ?? null}
                error={errors[f.key]}
                options={f.optionsKey ? (options[f.optionsKey] ?? []) : []}
                onChange={(v) => onChange(f.key, v)}
                unansweredLabel={unansweredLabel}
                conditionsLabel={conditionsLabel}
              />
            ))}
          </FormSection>
        );
      })}
    </>
  );
}

/** Teclado y autorrelleno de cada tipo de campo de texto. */
const KEYBOARD = {
  email: { keyboardType: 'email-address', inputMode: 'email' },
  phone: { keyboardType: 'phone-pad', inputMode: 'tel' },
  postalCode: { keyboardType: 'number-pad', inputMode: 'numeric' },
  year: { keyboardType: 'number-pad', inputMode: 'numeric' },
} as const;

function Field({
  field: f,
  value,
  confirmed,
  error,
  options,
  onChange,
  unansweredLabel,
  conditionsLabel,
}: {
  field: FieldSpec;
  value: FormValue;
  confirmed: FormValue;
  error?: string;
  options: readonly SelectOption<string>[];
  onChange: (v: FormValue) => void;
  unansweredLabel: string;
  conditionsLabel: string;
}) {
  const t = useComunicaTheme();
  const text = typeof value === 'string' ? value : '';
  switch (f.kind) {
    case 'note':
      return <NoteField field={f} />;
    case 'locked':
      return <LockedField field={f} value={value} />;
    case 'select':
      return (
        <SelectField
          label={f.label}
          help={f.help}
          value={typeof value === 'string' && value !== '' ? value : null}
          options={options}
          onChange={onChange}
        />
      );
    case 'consent':
      return (
        <ConsentRow
          label={f.label}
          url={f.url}
          value={typeof value === 'boolean' ? value : null}
          // Sin contestar en el servidor y sin tocar aquí: se dice.
          unanswered={confirmed === null && value === null}
          onChange={onChange}
          unansweredLabel={unansweredLabel}
          conditionsLabel={conditionsLabel}
        />
      );
    case 'date':
      return (
        <View style={styles.dateField}>
          <DateTimeField
            mode="date"
            label={f.label}
            value={text}
            onChange={onChange}
          />
          <FieldHint hint={f.hint} error={error} />
        </View>
      );
    default: {
      const kb =
        f.kind in KEYBOARD ? KEYBOARD[f.kind as keyof typeof KEYBOARD] : {};
      return (
        <TextFormField
          label={f.label}
          help={f.help}
          hint={f.hint}
          error={error}
          placeholder={f.placeholder}
          value={text}
          onChangeText={onChange}
          maxLength={f.maxLength}
          autoComplete={f.autoComplete as never}
          autoCapitalize={
            f.kind === 'email' || f.kind === 'year' ? 'none' : undefined
          }
          autoCorrect={f.kind === 'email' ? false : undefined}
          multiline={f.kind === 'textarea'}
          inline={f.kind === 'year'}
          style={f.kind === 'textarea' ? styles.textarea : undefined}
          placeholderTextColor={t.textMuted}
          {...kb}
        />
      );
    }
  }
}

/** Una nota de sección: el texto (con negrita) y, si lo hay, su enlace. */
function NoteField({ field: f }: { field: FieldSpec }) {
  const t = useComunicaTheme();
  return (
    <FormNote
      icon={f.tone === 'warning' ? 'exclamationmark.triangle.fill' : undefined}
    >
      {boldParts(f.label).map((p, i) =>
        p.bold ? (
          <Text key={i} style={[styles.bold, { color: t.text }]}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
      {f.url ? (
        <>
          {' '}
          <Text
            accessibilityRole="link"
            onPress={() => void Linking.openURL(f.url!)}
            style={[styles.link, { color: t.accentText }]}
          >
            {f.urlLabel ?? f.url}
          </Text>
          .
        </>
      ) : null}
    </FormNote>
  );
}

/**
 * Lo bloqueado: el dato COMO TEXTO, con candado (plugin `design.md` §6.5),
 * nunca un campo apagado que parezca que guarda.
 */
function LockedField({
  field: f,
  value,
}: {
  field: FieldSpec;
  value: FormValue;
}) {
  const t = useComunicaTheme();
  const shown =
    (f.format ? f.format(value) : typeof value === 'string' ? value : '') ||
    'Sin indicar';
  return (
    <View
      style={styles.locked}
      accessible
      accessibilityLabel={`${f.label}: ${shown}. No se puede editar`}
    >
      <View style={styles.lockedBody}>
        <Text style={[styles.lockedLabel, { color: t.textSecondary }]}>
          {f.label}
        </Text>
        <Text style={[styles.lockedValue, { color: t.text }]}>{shown}</Text>
      </View>
      <IconSymbol name="lock" size={16} color={t.textMuted} />
    </View>
  );
}

/** Una autorización: interruptor, «Sin contestar» y «Ver condiciones». */
export function ConsentRow({
  label,
  url,
  value,
  unanswered,
  onChange,
  unansweredLabel,
  conditionsLabel,
}: {
  label: string;
  url?: string;
  value: boolean | null;
  unanswered: boolean;
  onChange: (v: boolean) => void;
  unansweredLabel: string;
  conditionsLabel: string;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.consent}>
      <SwitchField label={label} value={value} onChange={onChange} />
      <View style={styles.consentFoot}>
        {unanswered ? (
          <Text style={[styles.unanswered, { color: t.textSecondary }]}>
            {unansweredLabel}
          </Text>
        ) : (
          <View />
        )}
        {url ? (
          <PressableFeedback
            onPress={() => void Linking.openURL(url)}
            accessibilityRole="link"
            accessibilityLabel={`${conditionsLabel}: ${label}`}
            style={styles.conditions}
          >
            <Text style={[styles.link, { color: t.accentText }]}>
              {conditionsLabel}
            </Text>
            <IconSymbol name="arrow.up.right" size={14} color={t.accentText} />
          </PressableFeedback>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  link: { ...typography.subhead, fontWeight: '600' },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  dateField: { paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockedBody: { flex: 1, gap: 2 },
  lockedLabel: { ...typography.caption },
  lockedValue: { ...typography.body },
  consent: { paddingBottom: 6 },
  consentFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -6,
  },
  unanswered: { ...typography.caption },
  conditions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
});
