import React, { useLayoutEffect, ComponentProps, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import SettingsPanel from '@/components/SettingsPanel';

interface NavigationItem {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  backgroundColor: string;
  color: string;
}

const navigationItems: NavigationItem[] = [
  {
    href: '/cancionero',
    label: 'Cantoral',
    icon: 'library-music',
    backgroundColor: colors.warning,
    color: colors.black,
  },
  {
    href: '/fotos',
    label: 'Fotos',
    icon: 'photo-library',
    backgroundColor: colors.accent,
    color: colors.black,
  },
  {
    href: '/calendario',
    label: 'Calendario',
    icon: 'event',
    backgroundColor: colors.info,
    color: colors.black,
  },
  {
    href: '/comunica',
    label: 'Comunica',
    icon: 'chat',
    backgroundColor: colors.info,
    color: colors.black,
  },
  {
    href: '/jubileo',
    label: 'Jubileo',
    icon: 'celebration',
    backgroundColor: colors.success,
    color: colors.black,
  },
  {
    label: 'Y mas cosas....',
    icon: 'hourglass-empty',
    backgroundColor: colors.danger,
    color: colors.black,
  },
];

interface IconButtonProps {
  color: string;
  onPress?: () => void;
}

function NotificationsButton({ color }: IconButtonProps) {
  return (
    <Link href="/notifications" asChild>
      <TouchableOpacity style={{ padding: 8, marginLeft: 4 }}>
        <View>
          <MaterialIcons name="notifications" size={24} color={color} />
          <View
            style={{
              position: 'absolute',
              right: -4,
              top: -2,
              backgroundColor: colors.danger,
              borderRadius: 8,
              width: 16,
              height: 16,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
              1
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

function SettingsButton({
  color,
  onPress,
}: IconButtonProps & { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 8, marginLeft: 0 }}>
      <MaterialIcons name="settings" size={24} color={color} />
    </TouchableOpacity>
  );
}

function DecorationCircles() {
  return (
    <>
      <View style={[styles.circle, styles.circleSmall]} />
      <View style={[styles.circle, styles.circleLarge]} />
    </>
  );
}

export default function Home() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth = (width - containerPadding * 2 - gap) / 2;
  const itemHeight = Math.min(
    160,
    (height - containerPadding * 2 - gap * 3) / 3,
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerButtons, { paddingRight: spacing.md }]}>
          <SettingsButton
            color={Colors[scheme ?? 'light'].icon}
            onPress={() => setSettingsVisible(true)}
          />
          <NotificationsButton color={Colors[scheme ?? 'light'].icon} />
        </View>
      ),
      title: 'Inicio',
    });
  }, [navigation, scheme]);

  return (
    <>
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <FlatList
        style={{ backgroundColor: Colors[scheme ?? 'light'].background }}
        data={navigationItems}
        keyExtractor={(_, index) => index.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.container,
          { padding: containerPadding },
        ]}
        renderItem={({ item }) => {
          const content = (
            <View
              style={[
                styles.item,
                {
                  backgroundColor: item.backgroundColor,
                  width: itemWidth,
                  height: itemHeight,
                },
              ]}
            >
              <DecorationCircles />
              <MaterialIcons
                name={item.icon}
                size={48}
                color={item.color}
                style={styles.icon}
              />
              <Text style={[styles.label, { color: item.color }]}>
                {item.label}
              </Text>
            </View>
          );
          return item.href ? (
            <Link href={item.href} asChild>
              <TouchableOpacity style={styles.itemWrapper}>
                {content}
              </TouchableOpacity>
            </Link>
          ) : (
            <View style={styles.itemWrapper}>{content}</View>
          );
        }}
      />
    </>
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
  circle: ViewStyle;
  circleSmall: ViewStyle;
  circleLarge: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  itemWrapper: {
    flex: 1,
    marginHorizontal: spacing.sm / 2,
  },
  item: {
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
  circle: {
    position: 'absolute',
    opacity: 0.2,
    backgroundColor: '#ffffff',
  },
  circleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    top: 8,
    left: 8,
  },
  circleLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    bottom: 8,
    right: 8,
  },
});
