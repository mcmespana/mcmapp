import React, { useMemo } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@/components/BottomSheet';
import { useToast } from '@/contexts/AppToastContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';

interface Props {
  visible: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  calendarConfig: CalendarConfig | undefined;
}

// Matches http(s) URLs to make description links tappable.
const URL_PATTERN = 'https?:\\/\\/[^\\s<>"\')]+';

// Sentinels used to preserve bold runs while stripping the rest of the HTML.
const BOLD_OPEN = '\u0001';
const BOLD_CLOSE = '\u0002';

type DescriptionToken = {
  key: string;
  text: string;
  isUrl: boolean;
  bold: boolean;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

// Google Calendar descriptions can arrive as HTML (<br>, <b>, &amp;, …).
// Normalize them to plain text with basic line breaks + bold runs.
function normalizeDescription(input: string): string {
  return decodeHtmlEntities(
    input
      // Keep <a href> links reachable: show the label and surface the URL so
      // the plain-text URL tokenizer can make it tappable.
      .replace(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_full, href, inner) => {
          const label = inner.replace(/<[^>]+>/g, '').trim();
          if (!label || href.includes(label) || label.includes(href)) {
            return href;
          }
          return `${label} (${href})`;
        },
      )
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<(b|strong)>/gi, BOLD_OPEN)
      .replace(/<\/(b|strong)>/gi, BOLD_CLOSE)
      .replace(/<[^>]+>/g, '') // strip any remaining tags
      .replace(/\n{3,}/g, '\n\n'), // collapse excess blank lines
  );
}

function tokenizeDescription(rawText: string): DescriptionToken[] {
  const normalized = normalizeDescription(rawText);
  const urlRegex = new RegExp(URL_PATTERN, 'gi');
  const tokens: DescriptionToken[] = [];
  let bold = false;
  let i = 0;

  // Split on bold sentinels, keeping track of the current bold state.
  for (const segment of normalized.split(/([\u0001\u0002])/)) {
    if (segment === BOLD_OPEN) {
      bold = true;
      continue;
    }
    if (segment === BOLD_CLOSE) {
      bold = false;
      continue;
    }
    if (!segment) continue;

    urlRegex.lastIndex = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          key: `t${i++}`,
          text: segment.slice(lastIndex, match.index),
          isUrl: false,
          bold,
        });
      }
      tokens.push({ key: `u${i++}`, text: match[0], isUrl: true, bold });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < segment.length) {
      tokens.push({
        key: `t${i++}`,
        text: segment.slice(lastIndex),
        isUrl: false,
        bold,
      });
    }
  }
  return tokens;
}

function formatLongDate(dateStr: string): string {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMapsUrl(location: string): string {
  const q = encodeURIComponent(location);
  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?q=${q}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function conferenceLabel(url: string): string {
  if (/meet\.google\.com/i.test(url)) return 'Google Meet';
  if (/zoom\.us/i.test(url)) return 'Zoom';
  if (/teams\.(microsoft|live)\.com/i.test(url)) return 'Microsoft Teams';
  if (/webex\.com/i.test(url)) return 'Webex';
  if (/jit\.si/i.test(url)) return 'Jitsi';
  return 'Videollamada';
}

export default function EventDetailsBottomSheet({
  visible,
  onClose,
  event,
  calendarConfig,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { toast } = useToast();

  const accentColor = calendarConfig?.color || colors.info;
  const surfaceBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';

  const descriptionParts = useMemo(
    () => (event?.description ? tokenizeDescription(event.description) : null),
    [event?.description],
  );

  const handleOpenUrl = async (
    url: string,
    errorMsg = 'No se pudo abrir el enlace.',
  ) => {
    h.tap();
    try {
      await Linking.openURL(url);
    } catch {
      toast.show({ variant: 'danger', label: errorMsg });
    }
  };

  if (!event) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title="Evento">
        <View />
      </BottomSheet>
    );
  }

  const showDateRange = event.endDate && event.endDate !== event.startDate;
  const timeRange = event.startTime
    ? event.endTime
      ? `${event.startTime} – ${event.endTime}`
      : event.startTime
    : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} dragFromContent>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: calendar badge + title */}
        <View
          style={[
            styles.calendarBadge,
            { backgroundColor: hexAlpha(accentColor, '18') },
          ]}
        >
          <View
            style={[styles.calendarDot, { backgroundColor: accentColor }]}
          />
          <Text
            style={[styles.calendarName, { color: accentColor }]}
            numberOfLines={1}
          >
            {calendarConfig?.name || 'Evento'}
          </Text>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>

        {/* Date + time */}
        <View style={[styles.infoRow, { backgroundColor: surfaceBg }]}>
          <View
            style={[
              styles.infoIconWrap,
              { backgroundColor: hexAlpha(accentColor, '18') },
            ]}
          >
            <MaterialIcons name="event" size={18} color={accentColor} />
          </View>
          <View style={styles.infoTextWrap}>
            <Text style={[styles.infoPrimary, { color: theme.text }]}>
              {formatLongDate(event.startDate)}
            </Text>
            {timeRange ? (
              <Text style={[styles.infoSecondary, { color: theme.icon }]}>
                {timeRange}
              </Text>
            ) : event.isAllDay ? (
              <Text style={[styles.infoSecondary, { color: theme.icon }]}>
                Todo el día
              </Text>
            ) : null}
            {showDateRange ? (
              <Text style={[styles.infoSecondary, { color: theme.icon }]}>
                Hasta {formatLongDate(event.endDate as string)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Location */}
        {event.location ? (
          <TouchableOpacity
            style={[styles.infoRow, { backgroundColor: surfaceBg }]}
            onPress={() =>
              handleOpenUrl(
                buildMapsUrl(event.location as string),
                'No se pudo abrir el mapa.',
              )
            }
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ubicación en mapas: ${event.location}`}
          >
            <View
              style={[
                styles.infoIconWrap,
                { backgroundColor: hexAlpha(accentColor, '18') },
              ]}
            >
              <MaterialIcons name="place" size={18} color={accentColor} />
            </View>
            <View style={styles.infoTextWrap}>
              <Text
                style={[styles.infoPrimary, { color: theme.text }]}
                numberOfLines={3}
              >
                {event.location}
              </Text>
              <Text style={[styles.infoLink, { color: colors.info }]}>
                Abrir en {Platform.OS === 'ios' ? 'Mapas' : 'Maps'}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={theme.icon}
              style={{ opacity: 0.5 }}
            />
          </TouchableOpacity>
        ) : null}

        {/* Conference call */}
        {event.conferenceUrl ? (
          <TouchableOpacity
            style={styles.conferenceBtn}
            onPress={() =>
              handleOpenUrl(
                event.conferenceUrl as string,
                'No se pudo abrir la videollamada.',
              )
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Unirse a la videollamada"
          >
            <MaterialIcons name="videocam" size={20} color="#fff" />
            <Text style={styles.conferenceBtnLabel}>
              Unirse a {conferenceLabel(event.conferenceUrl)}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Description */}
        {event.description ? (
          <View style={styles.descriptionWrap}>
            <Text style={[styles.sectionLabel, { color: theme.icon }]}>
              DESCRIPCIÓN
            </Text>
            <Text style={[styles.descriptionText, { color: theme.text }]}>
              {descriptionParts?.map((p) => {
                if (p.isUrl) {
                  return (
                    <Text
                      key={p.key}
                      style={{
                        color: colors.info,
                        textDecorationLine: 'underline',
                        fontWeight: p.bold ? '700' : undefined,
                      }}
                      onPress={() => handleOpenUrl(p.text)}
                    >
                      {p.text}
                    </Text>
                  );
                }
                return (
                  <Text
                    key={p.key}
                    style={p.bold ? { fontWeight: '700' } : undefined}
                  >
                    {p.text}
                  </Text>
                );
              })}
            </Text>
          </View>
        ) : null}

        {/* Google Calendar link */}
        {event.url ? (
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { borderColor: hexAlpha(colors.info, '40') },
            ]}
            onPress={() =>
              handleOpenUrl(
                event.url as string,
                'No se pudo abrir Google Calendar.',
              )
            }
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Abrir evento en Google Calendar"
          >
            <MaterialIcons name="open-in-new" size={16} color={colors.info} />
            <Text style={[styles.secondaryBtnLabel, { color: colors.info }]}>
              Abrir en Google Calendar
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 600,
  } as ViewStyle,
  scrollContent: {
    paddingBottom: 32,
    gap: spacing.sm,
  } as ViewStyle,

  calendarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    gap: 6,
  } as ViewStyle,
  calendarDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pillFull,
  } as ViewStyle,
  calendarName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as TextStyle,

  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  } as TextStyle,

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
  } as ViewStyle,
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  infoTextWrap: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  infoPrimary: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  infoSecondary: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  infoLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  } as TextStyle,

  conferenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.info,
    borderRadius: radii.md,
    paddingVertical: 14,
    marginTop: spacing.xs,
  } as ViewStyle,
  conferenceBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  } as TextStyle,

  descriptionWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs + 2,
  } as ViewStyle,
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  } as TextStyle,
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    marginTop: spacing.xs,
  } as ViewStyle,
  secondaryBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
});
