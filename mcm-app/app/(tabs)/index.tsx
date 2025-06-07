import React, { useLayoutEffect, ComponentProps } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Badge } from 'react-native-paper';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

interface NavigationItem {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  backgroundColor: string;
  color: string;
}

const navigationItems: NavigationItem[] = [
  { href: '/cancionero', label: 'Cantoral', icon: 'library-music', backgroundColor: colors.warning, color: colors.black },
  { href: '/fotos', label: 'Fotos', icon: 'photo-library', backgroundColor: colors.accent, color: colors.black },
  { href: '/calendario', label: 'Calendario', icon: 'event', backgroundColor: colors.info, color: colors.black },
  { href: '/comunica', label: 'Comunica', icon: 'chat', backgroundColor: colors.success, color: colors.black },
  { href: '/jubileo', label: 'Jubileo', icon: 'party-mode', backgroundColor: colors.warning, color: colors.black },
  { label: 'Y mas cosas....', icon: 'hourglass-empty', backgroundColor: colors.danger, color: colors.black },
];

function NotificationsButton() {
  return (
    <Link href="/notifications" asChild>
      <TouchableOpacity style={{ padding: 8, marginLeft: 4 }}>
        <View>
          <MaterialIcons name="notifications" size={24} color={colors.primary} />
          <View style={{
            position: 'absolute',
            right: -4,
            top: -2,
            backgroundColor: colors.danger,
            borderRadius: 8,
            width: 16,
            height: 16,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>1</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function SettingsButton() {
  const handlePress = () => {
    // Mostrar un alert temporal
    alert('Configuración: Próximamente...');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={{ padding: 8, marginLeft: 0 }}>
      <MaterialIcons name="settings" size={24} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function Home() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerButtons, { paddingRight: spacing.md }]}>
          <SettingsButton />
          <NotificationsButton />
        </View>
      ),
      title: 'Inicio',
    });
  }, [navigation]);

  return (
    <FlatList
      data={navigationItems}
      keyExtractor={(_, index) => index.toString()}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => {
        const content = (
          <View style={[styles.item, { backgroundColor: item.backgroundColor }]}>
            <MaterialIcons name={item.icon} size={48} color={item.color} style={styles.icon} />
            <Text style={[styles.label, { color: item.color }]}>{item.label}</Text>
          </View>
        );
        return item.href ? (
          <Link href={item.href} asChild>
            <TouchableOpacity style={styles.itemWrapper}>{content}</TouchableOpacity>
          </Link>
        ) : (
          <View style={styles.itemWrapper}>{content}</View>
        );
      }}
    />
  );
}

interface Styles {
  container: ViewStyle;
  row: ViewStyle;
  itemWrapper: ViewStyle;
  item: ViewStyle;
  icon: TextStyle;
  label: TextStyle;
  headerButtons: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    padding: spacing.lg,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  itemWrapper: {
    flex: 1,
    marginHorizontal: spacing.sm / 2,
  },
  item: {
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    marginBottom: spacing.sm,
  },
  label: {
    ...(typography.button as TextStyle),
    fontWeight: 'bold',
    textAlign: 'center',
  },

  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
