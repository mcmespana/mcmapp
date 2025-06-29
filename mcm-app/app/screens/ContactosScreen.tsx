import React from 'react';
import { ScrollView, StyleSheet, View, Linking } from 'react-native';
import { List, IconButton, Avatar } from 'react-native-paper';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import colors, { Colors } from '@/constants/colors';
import { AppColors } from '@/app/styles/theme';
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
  AppColors.primary,
  AppColors.accentYellow,
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

  if (loading || !data) {
    return <ProgressWithMessage message="Cargando contactos..." />;
  }

  return (
    <ScrollView style={styles.container}>
      {(data || []).map((c, idx) => (
        <List.Item
          key={idx}
          title={c.nombre}
          titleStyle={styles.name}
          description={c.responsabilidad}
          left={() => (
            <View style={styles.avatarWrapper}>
              <Avatar.Text
                size={40}
                label={getInitials(c.nombre)}
                style={[
                  styles.avatar,
                  { backgroundColor: colorsForContacts[idx] },
                ]}
              />
            </View>
          )}
          right={() => (
            <View style={styles.actions}>
              <IconButton
                icon="phone"
                size={24}
                onPress={() => call(c.telefono)}
              />
              <IconButton
                icon="whatsapp"
                size={24}
                onPress={() => whatsapp(c.telefono)}
              />
            </View>
          )}
          contentStyle={styles.itemContent}
        />
      ))}
    </ScrollView>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    actions: { flexDirection: 'row' },
    name: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    avatarWrapper: { justifyContent: 'center' },
    avatar: { marginLeft: 8, marginRight: 12 },
    itemContent: { paddingVertical: 8, alignItems: 'center' },
  });
};
