import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  Platform,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Chip,
  Button,
  Dialog,
  PressableFeedback,
  Skeleton,
} from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import { hexAlpha } from '@/utils/colorUtils';

interface AppInfo {
  orden: number;
  nombre: string;
  descripcion: string;
  tipo: string;
  icono: string;
  iosLink: string;
  androidLink: string;
  iosScheme?: string;
  androidScheme?: string;
}

export default function AppsScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const event = useCurrentEvent();
  const { data: appsData } = useFirebaseData<AppInfo[]>(
    getEventFirebasePath(event, 'apps'),
    getEventCacheKey(event, 'apps'),
  );
  const [selected, setSelected] = useState<AppInfo | null>(null);

  const openApp = async (app: AppInfo) => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const schemeUrl =
          Platform.OS === 'ios' ? app.iosScheme : app.androidScheme;
        if (schemeUrl) {
          const canOpen = await Linking.canOpenURL(schemeUrl);
          if (canOpen) {
            await Linking.openURL(schemeUrl);
            return;
          }
        }
      }
      const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
      if (storeUrl) {
        await Linking.openURL(storeUrl);
      }
    } catch {
      const storeUrl = Platform.OS === 'ios' ? app.iosLink : app.androidLink;
      if (storeUrl) {
        try {
          await Linking.openURL(storeUrl);
        } catch {
          // ignore
        }
      }
    }
  };

  const apps = useMemo(
    () => (appsData ? [...appsData].sort((a, b) => a.orden - b.orden) : []),
    [appsData],
  );

  if (!appsData) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors[scheme ?? 'light'].background,
        }}
      >
        <PageContainer>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.xl,
            }}
          >
            <ScreenHero
              title="Apps"
              subtitle="Lista de aplicaciones móviles (algunas necesarias 🌟, otras opcionales ℹ️) que necesitaremos durante el Jubileo."
            />
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  style={{ height: 72, borderRadius: radii.lg }}
                />
              ))}
            </View>
          </ScrollView>
        </PageContainer>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageContainer>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
          }}
        >
          <ScreenHero
            title="Apps"
            subtitle="Lista de aplicaciones móviles (algunas necesarias 🌟, otras opcionales ℹ️) que necesitaremos durante el Jubileo."
          />
          <View style={styles.introContainer}>
            <Text style={styles.introSubtext}>
              {Platform.OS === 'web'
                ? 'Si tocas el icono de la app te la abrirá directamente. En el modal puedes elegir entre iOS y Android ✨'
                : 'Si tocas el icono de la app te la abrirá directamente o te llevará a la tienda de tu plataforma ✨'}
            </Text>
          </View>

          {apps.map((app, idx) => (
            <PressableFeedback
              key={idx}
              onPress={() => openApp(app)}
              accessibilityRole="button"
              accessibilityLabel={app.nombre}
            >
              <PressableFeedback.Highlight />
              <View style={styles.listItemContainer}>
                <View style={styles.iconContainer}>
                  <Image source={{ uri: app.icono }} style={styles.icon} />
                </View>
                <View style={styles.contentContainer}>
                  <Text style={styles.title}>{app.nombre}</Text>
                  <Text style={styles.description}>{app.descripcion}</Text>
                </View>
                <View style={styles.rightContainer}>
                  {app.tipo.toLowerCase() === 'necesaria' && (
                    <Chip size="sm" variant="primary" color="warning">
                      <MaterialIcons name="star" size={12} color="#fff" />
                    </Chip>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    onPress={() => setSelected(app)}
                  >
                    <MaterialIcons
                      name="add-circle-outline"
                      size={24}
                      color={scheme === 'dark' ? '#ccc' : '#555'}
                    />
                  </Button>
                </View>
              </View>
            </PressableFeedback>
          ))}
        </ScrollView>
      </PageContainer>

      <Dialog
        isOpen={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            {selected && (
              <View style={{ gap: 12 }}>
                <Dialog.Title>{selected.nombre}</Dialog.Title>
                <Dialog.Description>{selected.descripcion}</Dialog.Description>
                <View style={styles.chipRow}>
                  <Chip
                    variant="primary"
                    color={
                      selected.tipo.toLowerCase() === 'necesaria'
                        ? 'warning'
                        : 'accent'
                    }
                  >
                    <MaterialIcons
                      name={
                        selected.tipo.toLowerCase() === 'necesaria'
                          ? 'star'
                          : 'info'
                      }
                      size={14}
                      color="#fff"
                    />
                    <Chip.Label>{selected.tipo}</Chip.Label>
                  </Chip>
                </View>
                <View style={styles.downloadRow}>
                  {Platform.OS === 'web' ? (
                    <>
                      <Button
                        variant="outline"
                        onPress={() => Linking.openURL(selected.iosLink)}
                      >
                        <MaterialIcons
                          name="phone-iphone"
                          size={20}
                          color={scheme === 'dark' ? '#fff' : '#333'}
                        />
                        <Button.Label>iOS</Button.Label>
                      </Button>
                      <Button
                        variant="outline"
                        onPress={() => Linking.openURL(selected.androidLink)}
                      >
                        <MaterialIcons
                          name="android"
                          size={20}
                          color="#3DDC84"
                        />
                        <Button.Label>Android</Button.Label>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onPress={() => {
                        openApp(selected);
                        setSelected(null);
                      }}
                    >
                      <MaterialIcons
                        name={
                          Platform.OS === 'ios' ? 'phone-iphone' : 'android'
                        }
                        size={20}
                        color="#fff"
                      />
                      <Button.Label>
                        {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
                      </Button.Label>
                    </Button>
                  )}
                </View>
              </View>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    introContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: hexAlpha(colors.accent, '12'),
      borderColor: hexAlpha(colors.accent, '30'),
      borderWidth: 1,
      borderRadius: radii.md,
      marginBottom: spacing.md,
    },
    introText: {
      fontSize: 16,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: spacing.xs,
      fontWeight: '500',
    },
    introSubtext: {
      fontSize: 14,
      color: theme.text,
      textAlign: 'center',
      opacity: 0.7,
      fontStyle: 'italic',
    },
    listItemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: theme.card,
      borderRadius: radii.lg,
      marginBottom: spacing.sm,
      ...shadows.sm,
    } as any,
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
      width: 56,
      height: 56,
      borderRadius: radii.md,
      backgroundColor: hexAlpha(colors.accent, '15'),
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.xs,
    },
    title: {
      fontWeight: '700',
      color: theme.text,
      fontSize: 15,
    },
    description: {
      color: theme.text,
      opacity: 0.7,
      fontSize: 13,
      lineHeight: 18,
    },
    rightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    chipRow: { alignItems: 'center', marginBottom: spacing.sm },
    downloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
  });
};
