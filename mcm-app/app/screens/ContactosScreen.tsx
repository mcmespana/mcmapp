import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { PressableFeedback, SearchField, Skeleton } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import ComingSoon from '@/components/ui/ComingSoon';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Contacto {
  nombre: string;
  responsabilidad: string;
  telefono: string;
}

const AVATAR_TINTS = [
  { bg: '#FFE4D6', fg: '#C44519' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#DCFCE7', fg: '#15803D' },
  { bg: '#FEF3C7', fg: '#A16207' },
  { bg: '#F3E8FF', fg: '#7E22CE' },
  { bg: '#FCE7F3', fg: '#BE185D' },
] as const;

const AVATAR_TINTS_DARK = [
  { bg: 'rgba(196,69,25,0.22)', fg: '#FDA4AF' },
  { bg: 'rgba(3,105,161,0.22)', fg: '#7DD3FC' },
  { bg: 'rgba(21,128,61,0.22)', fg: '#86EFAC' },
  { bg: 'rgba(161,98,7,0.22)', fg: '#FDE68A' },
  { bg: 'rgba(126,34,206,0.22)', fg: '#D8B4FE' },
  { bg: 'rgba(190,24,93,0.22)', fg: '#F9A8D4' },
] as const;

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface ContactRowProps {
  contact: Contacto;
  tint: { bg: string; fg: string };
  isLast: boolean;
  isDark: boolean;
  styles: ReturnType<typeof createStyles>;
  onCall: (tel: string) => void;
  onWhatsapp: (tel: string) => void;
}

const ContactRow = React.memo(function ContactRow({
  contact,
  tint,
  isLast,
  isDark,
  styles,
  onCall,
  onWhatsapp,
}: ContactRowProps) {
  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
          <Text style={[styles.avatarText, { color: tint.fg }]}>
            {getInitials(contact.nombre)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {contact.nombre}
          </Text>
          {contact.responsabilidad ? (
            <Text style={styles.role} numberOfLines={1}>
              {contact.responsabilidad}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          <PressableFeedback
            onPress={() => onCall(contact.telefono)}
            style={[styles.iconBtn, styles.iconBtnCall]}
            accessibilityRole="button"
            accessibilityLabel={`Llamar a ${contact.nombre}`}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons
              name="phone"
              size={20}
              color={isDark ? '#7AB3FF' : colors.info}
            />
          </PressableFeedback>
          <PressableFeedback
            onPress={() => onWhatsapp(contact.telefono)}
            style={[styles.iconBtn, styles.iconBtnWa]}
            accessibilityRole="button"
            accessibilityLabel={`WhatsApp a ${contact.nombre}`}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons
              name="chat"
              size={20}
              color={isDark ? '#A8E0AB' : colors.success}
            />
          </PressableFeedback>
        </View>
      </View>
      {!isLast ? <View style={styles.divider} /> : null}
    </View>
  );
});

export default function ContactosScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const event = useCurrentEvent();
  const { data: contacts, loading } = useFirebaseData<Contacto[]>(
    getEventFirebasePath(event, 'contactos'),
    getEventCacheKey(event, 'contactos'),
  );
  const data = contacts as Contacto[] | undefined;
  const [query, setQuery] = useState('');

  const call = (tel: string) => Linking.openURL(`tel:${tel}`);
  const whatsapp = (tel: string) => {
    const clean = tel.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  const filtered = useMemo(() => {
    if (!data) return [] as Contacto[];
    const q = query.trim();
    if (q.length < 2) return data;
    const nq = normalize(q);
    return data.filter(
      (c) =>
        (c.nombre && normalize(c.nombre).includes(nq)) ||
        (c.responsabilidad && normalize(c.responsabilidad).includes(nq)) ||
        (c.telefono && c.telefono.replace(/\s/g, '').includes(q)),
    );
  }, [data, query]);

  const tints = isDark ? AVATAR_TINTS_DARK : AVATAR_TINTS;

  if (!data || data.length === 0) {
    const showSkeleton = loading && !data;
    return (
      <PageContainer>
        <View style={styles.container}>
          <ScreenHero title="Contactos" />
          {showSkeleton ? (
            <View style={{ padding: 16, gap: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  style={{ height: 68, borderRadius: radii.lg }}
                />
              ))}
            </View>
          ) : (
            <ComingSoon accentColor={event.tintColor} />
          )}
        </View>
      </PageContainer>
    );
  }

  const showSearch = data.length > 6;

  const ListHeader = (
    <View>
      <ScreenHero title="Contactos" />
      {showSearch ? (
        <View style={styles.searchContainer}>
          <SearchField value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder="Buscar contacto"
                autoCorrect={false}
                autoCapitalize="words"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {query.trim().length >= 2 ? (
            <Text style={styles.resultsMeta}>
              {filtered.length} de {data.length}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <PageContainer>
      <View style={styles.container}>
        <FlatList
          data={filtered}
          keyExtractor={(c, idx) => `${c.nombre}-${idx}`}
          ListHeaderComponent={ListHeader}
          renderItem={({ item, index }) => (
            <View style={styles.cardWrapper}>
              <View
                style={[
                  styles.card,
                  // The card wraps each row individually so the FlatList can
                  // virtualize. The visual "card grouping" is preserved with
                  // top/bottom corners on first/last and seamless dividers via
                  // negative marginTop on intermediate rows.
                  index === 0 && styles.cardFirst,
                  index === filtered.length - 1 && styles.cardLast,
                  index !== 0 &&
                    index !== filtered.length - 1 &&
                    styles.cardMiddle,
                ]}
              >
                <ContactRow
                  contact={item}
                  tint={tints[index % tints.length]}
                  isLast={index === filtered.length - 1}
                  isDark={isDark}
                  styles={styles}
                  onCall={call}
                  onWhatsapp={whatsapp}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            query.trim().length >= 2 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="search-off" size={40} color="#999" />
                <Text style={styles.emptyText}>
                  No hay contactos que coincidan con &quot;{query}&quot;.
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={9}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      </View>
    </PageContainer>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },
    searchContainer: {
      marginHorizontal: 16,
      marginVertical: 12,
      gap: 6,
    },
    resultsMeta: {
      paddingHorizontal: 4,
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      fontWeight: '500',
    },
    cardWrapper: {
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      overflow: 'hidden',
    },
    cardFirst: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.35)'
            : '0 2px 8px rgba(0,0,0,0.06)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.06,
          shadowRadius: 6,
          elevation: 2,
        },
      }),
    },
    cardLast: {
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    cardMiddle: {},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      letterSpacing: -0.2,
    },
    role: {
      fontSize: 13,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnCall: {
      backgroundColor: isDark ? 'rgba(122,179,255,0.15)' : '#E8F0FE',
    },
    iconBtnWa: {
      backgroundColor: isDark ? 'rgba(168,224,171,0.15)' : '#E6F7E8',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      marginLeft: 70,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      fontSize: 15,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      textAlign: 'center',
    },
  });
};
