import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  Linking,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import colors, { Colors } from '@/constants/colors';
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

  const call = (tel: string) => Linking.openURL(`tel:${tel}`);
  const whatsapp = (tel: string) => {
    const clean = tel.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  if (!data) {
    return <ProgressWithMessage message="Cargando contactos..." />;
  }
  if (loading) {
    return <ProgressWithMessage message="Actualizando contactos..." />;
  }

  const tints = isDark ? AVATAR_TINTS_DARK : AVATAR_TINTS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        {(data || []).map((c, idx) => {
          const tint = tints[idx % tints.length];
          const isLast = idx === (data?.length ?? 0) - 1;
          return (
            <View key={`${c.nombre}-${idx}`}>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                  <Text style={[styles.avatarText, { color: tint.fg }]}>
                    {getInitials(c.nombre)}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.nombre}
                  </Text>
                  {c.responsabilidad ? (
                    <Text style={styles.role} numberOfLines={1}>
                      {c.responsabilidad}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => call(c.telefono)}
                    style={[styles.iconBtn, styles.iconBtnCall]}
                    activeOpacity={0.7}
                    accessibilityLabel={`Llamar a ${c.nombre}`}
                  >
                    <MaterialIcons
                      name="phone"
                      size={20}
                      color={isDark ? '#7AB3FF' : colors.info}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => whatsapp(c.telefono)}
                    style={[styles.iconBtn, styles.iconBtnWa]}
                    activeOpacity={0.7}
                    accessibilityLabel={`WhatsApp a ${c.nombre}`}
                  >
                    <MaterialIcons
                      name="chat"
                      size={20}
                      color={isDark ? '#A8E0AB' : colors.success}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {!isLast ? <View style={styles.divider} /> : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },
    card: {
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 16,
      overflow: 'hidden',
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
  });
};
