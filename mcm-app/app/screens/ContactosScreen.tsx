import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import colors, { Colors } from '@/constants/colors';
import { UIColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const PALETTE = [
  '#FF8A65',
  '#4FC3F7',
  '#81C784',
  '#BA68C8',
  '#FFD54F',
  '#9FA8DA',
  colors.primary,
  colors.secondary,
  colors.accent,
  colors.info,
  colors.success,
  colors.warning,
  colors.danger,
  UIColors.activePrimary,
  UIColors.accentYellow,
];

interface Contacto {
  nombre: string;
  responsabilidad: string;
  telefono: string;
}

export default function ContactosScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: contacts, loading } = useFirebaseData<Contacto[]>(
    'jubileo/contactos',
    'jubileo_contactos',
  );
  const data = contacts as Contacto[] | undefined;

  const colorsForContacts = React.useMemo(
    () =>
      (data || []).map(
        () => PALETTE[Math.floor(Math.random() * PALETTE.length)],
      ),
    [data],
  );

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const call = (tel: string) => Linking.openURL(`tel:${tel}`);
  const whatsapp = (tel: string) => {
    const clean = tel.replace('+', '');
    Linking.openURL(`https://wa.me/${clean}`);
  };

  if (!data) {
    return <ProgressWithMessage message="Cargando contactos..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando contactos..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        Platform.OS === 'ios' ? { paddingBottom: 100 } : undefined
      }
    >
      {(data || []).map((c, idx) => (
        <View key={idx} style={styles.listItem}>
          <View style={styles.avatarWrapper}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colorsForContacts[idx] },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(c.nombre)}</Text>
            </View>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.name}>{c.nombre}</Text>
            <Text style={styles.responsabilidad}>{c.responsabilidad}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => call(c.telefono)}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons name="phone" size={24} color={colors.info} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => whatsapp(c.telefono)}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons name="chat" size={24} color={colors.success} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: scheme === 'dark' ? '#333' : '#E0E0E0',
    },
    actions: { flexDirection: 'row' },
    actionBtn: { padding: 8 },
    name: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    responsabilidad: {
      fontSize: 13,
      color: scheme === 'dark' ? '#AAAAAA' : '#888',
      marginTop: 2,
    },
    avatarWrapper: { justifyContent: 'center', marginRight: 12 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    itemContent: { flex: 1 },
  });
};
