import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';
import {
  buildWebcalUrl,
  buildGoogleCalendarSubscribeUrl,
  isValidIcsUrl,
} from '@/utils/calendarSubscription';

interface Props {
  visible: boolean;
  onClose: () => void;
  calendars: CalendarConfig[];
}

const INSTRUCTIONS = [
  {
    key: 'apple',
    title: 'Apple Calendario (iPhone, iPad o Mac)',
    icon: 'calendar-today' as const,
    steps: [
      'Pulsa "Apple Calendario" en el calendario que quieras.',
      'Confirma "Suscribirse a este calendario".',
      'Los eventos aparecerán en la app Calendario del sistema.',
    ],
  },
  {
    key: 'google',
    title: 'Google Calendar (web o Android)',
    icon: 'today' as const,
    steps: [
      'Pulsa "Google Calendar".',
      'Inicia sesión si te lo pide y confirma "Añadir calendario".',
      'En Android, los eventos aparecerán también en la app Google Calendar tras unos minutos.',
    ],
  },
  {
    key: 'outlook',
    title: 'Outlook',
    icon: 'mail-outline' as const,
    steps: [
      'Pulsa "Copiar enlace".',
      'En Outlook → Calendario → Añadir calendario → Suscribirse desde la web.',
      'Pega el enlace y confirma.',
    ],
  },
  {
    key: 'other',
    title: 'Otra app de calendario',
    icon: 'perm-contact-calendar' as const,
    steps: [
      'Pulsa "Copiar enlace".',
      'Busca "Suscribirse a calendario" o "Añadir por URL" en tu app.',
      'Pega el enlace.',
    ],
  },
];

export default function CalendarSubscribeBottomSheet({
  visible,
  onClose,
  calendars,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { toast } = useToast();

  const [openInstruction, setOpenInstruction] = useState<string | null>(null);

  const surfaceBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const accentColor = isDark ? colors.info : colors.primary;

  const handleOpenApple = async (cal: CalendarConfig) => {
    h.tap();
    if (!isValidIcsUrl(cal.url)) return;
    const webcalUrl = buildWebcalUrl(cal.url);
    try {
      const canOpen = await Linking.canOpenURL(webcalUrl);
      if (canOpen) {
        await Linking.openURL(webcalUrl);
      } else {
        await handleCopyLink(cal, true);
        toast.show({
          variant: 'danger',
          label: 'No se pudo abrir Apple Calendario. Enlace copiado.',
        });
      }
    } catch {
      await handleCopyLink(cal, true);
      toast.show({
        variant: 'danger',
        label: 'No se pudo abrir Apple Calendario. Enlace copiado.',
      });
    }
  };

  const handleOpenGoogle = (cal: CalendarConfig) => {
    h.tap();
    if (!isValidIcsUrl(cal.url)) return;
    Linking.openURL(buildGoogleCalendarSubscribeUrl(cal.url)).catch(() => {
      toast.show({ variant: 'danger', label: 'No se pudo abrir el enlace.' });
    });
  };

  const handleCopyLink = async (cal: CalendarConfig, silent = false) => {
    try {
      await Clipboard.setStringAsync(cal.url);
      if (!silent) {
        h.formSuccess();
        toast.show({ variant: 'success', label: 'Enlace copiado' });
      }
    } catch {
      toast.show({ variant: 'danger', label: 'No se pudo copiar el enlace.' });
    }
  };

  const toggleInstruction = (key: string) => {
    h.tap();
    setOpenInstruction((prev) => (prev === key ? null : key));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Suscribirse a calendarios"
      dragFromContent
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: theme.icon }]}>
          Recibe los eventos en tu app de calendario favorita
        </Text>

        {/* Calendar cards */}
        {calendars.map((cal, idx) => {
          const valid = isValidIcsUrl(cal.url);
          return (
            <View
              key={idx}
              style={[styles.calCard, { backgroundColor: surfaceBg }]}
            >
              {/* Calendar name row */}
              <View style={styles.calNameRow}>
                <View
                  style={[styles.calDot, { backgroundColor: cal.color }]}
                />
                <Text
                  style={[styles.calName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {cal.name}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.actionsRow}>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.actionBtnPrimary,
                      !valid && styles.actionBtnDisabled,
                    ]}
                    onPress={() => handleOpenApple(cal)}
                    disabled={!valid}
                    activeOpacity={0.75}
                    accessibilityLabel={`Suscribirse a ${cal.name} en Apple Calendario`}
                    accessibilityRole="button"
                  >
                    <MaterialIcons
                      name="calendar-today"
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.actionBtnTextPrimary}>
                      Apple Calendario
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    Platform.OS === 'ios'
                      ? styles.actionBtnSecondary
                      : styles.actionBtnPrimary,
                    !valid && styles.actionBtnDisabled,
                  ]}
                  onPress={() => handleOpenGoogle(cal)}
                  disabled={!valid}
                  activeOpacity={0.75}
                  accessibilityLabel={`Añadir ${cal.name} a Google Calendar`}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name="today"
                    size={14}
                    color={Platform.OS === 'ios' ? accentColor : '#fff'}
                  />
                  <Text
                    style={[
                      Platform.OS === 'ios'
                        ? styles.actionBtnTextSecondary
                        : styles.actionBtnTextPrimary,
                      Platform.OS === 'ios' && { color: accentColor },
                    ]}
                  >
                    Google Calendar
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Copy link */}
              <TouchableOpacity
                style={styles.copyRow}
                onPress={() => handleCopyLink(cal)}
                activeOpacity={0.7}
                accessibilityLabel={`Copiar enlace de ${cal.name}`}
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="content-copy"
                  size={14}
                  color={theme.icon}
                />
                <Text style={[styles.copyLabel, { color: theme.icon }]}>
                  Copiar enlace ICS
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Instructions accordion */}
        <View style={styles.instructionsSection}>
          <Text style={[styles.instructionsTitle, { color: theme.icon }]}>
            ¿CÓMO ME SUSCRIBO?
          </Text>

          {INSTRUCTIONS.map((item) => {
            const isOpen = openInstruction === item.key;
            const hideApple =
              Platform.OS !== 'ios' && item.key === 'apple';
            if (hideApple) return null;

            return (
              <View key={item.key}>
                <TouchableOpacity
                  style={[styles.accordionHeader, { backgroundColor: surfaceBg }]}
                  onPress={() => toggleInstruction(item.key)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <MaterialIcons name={item.icon} size={18} color={theme.icon} />
                  <Text
                    style={[styles.accordionTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <MaterialIcons
                    name={isOpen ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={theme.icon}
                  />
                </TouchableOpacity>

                {isOpen && (
                  <View
                    style={[
                      styles.accordionBody,
                      { backgroundColor: hexAlpha(accentColor, '08') },
                    ]}
                  >
                    {item.steps.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <Text
                          style={[styles.stepNumber, { color: accentColor }]}
                        >
                          {i + 1}.
                        </Text>
                        <Text style={[styles.stepText, { color: theme.text }]}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={[styles.footer, { color: theme.icon }]}>
          Los eventos se actualizan automáticamente cada pocas horas, según tu
          app de calendario.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 560,
  } as ViewStyle,
  scrollContent: {
    paddingBottom: 32,
  } as ViewStyle,

  subtitle: {
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  } as TextStyle,

  calCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  } as ViewStyle,

  calNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,

  calDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pillFull,
  } as ViewStyle,

  calName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  } as TextStyle,

  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  } as ViewStyle,

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: 'center',
    minWidth: 120,
  } as ViewStyle,
  actionBtnPrimary: {
    backgroundColor: colors.info,
  } as ViewStyle,
  actionBtnSecondary: {
    borderWidth: 1.5,
    borderColor: colors.info,
    backgroundColor: 'transparent',
  } as ViewStyle,
  actionBtnDisabled: {
    opacity: 0.35,
  } as ViewStyle,
  actionBtnTextPrimary: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  actionBtnTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,

  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  } as ViewStyle,
  copyLabel: {
    fontSize: 13,
  } as TextStyle,

  instructionsSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  } as ViewStyle,
  instructionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    marginLeft: 2,
  } as TextStyle,

  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.lg,
    marginBottom: spacing.xs,
  } as ViewStyle,
  accordionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  } as TextStyle,

  accordionBody: {
    marginHorizontal: 2,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  } as ViewStyle,
  stepNumber: {
    fontSize: 13,
    fontWeight: '700',
    width: 18,
  } as TextStyle,
  stepText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  } as TextStyle,

  footer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.md,
    textAlign: 'center',
    opacity: 0.7,
  } as TextStyle,
});
