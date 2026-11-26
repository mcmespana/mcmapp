import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Chip,
  Button,
  Dialog,
  PressableFeedback,
  Skeleton,
} from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors, themeColors } from '@/constants/colors';
import { useTabBarPaddingBottom } from '@/hooks/useTabBarClearance';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import ComingSoon from '@/components/ui/ComingSoon';
import { hexAlpha } from '@/utils/colorUtils';
import typography from '@/constants/typography';

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
  const bottomPadding = useTabBarPaddingBottom(spacing.xl);
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const event = useCurrentEvent();
  const { data: appsData, loading } = useFirebaseData<AppInfo[]>(
    getEventFirebasePath(event, 'apps'),
    getEventCacheKey(event, 'apps'),
  );
  const [selected, setSelected] = useState<AppInfo | null>(null);

  const openApp = async (app: AppInfo) => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const schemeUrl =
          Platform.OS === 'ios' ? app.iosScheme : app.androidScheme;
        if (schemeUrl && Platform.OS === 'android') {
          // En Android 11+ `canOpenURL` dice que NO a cualquier esquema que no
          // esté declarado en <queries> del manifest, y estos vienen de
          // Firebase (no se pueden declarar de antemano): siempre acababa en
          // Play Store aunque la app estuviera instalada. Se intenta abrir
          // sin preguntar; si no hay quien la abra, `openURL` rechaza y se
          // cae a la tienda.
          try {
            await Linking.openURL(schemeUrl);
            return;
          } catch {
            // Sin la app instalada → tienda, abajo.
          }
        } else if (schemeUrl) {
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

  if (!appsData || appsData.length === 0) {
    const showSkeleton = loading && !appsData;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors[scheme ?? 'light'].background,
        }}
      >
        <PageContainer>
          {showSkeleton ? (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.md,
                paddingBottom: spacing.xl,
              }}
            >
              <ScreenHero title="Apps" hideOnWeb floatingHeaderInset />
              <View style={{ gap: spacing.sm }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    style={{ height: 72, borderRadius: radii.lg }}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <ScreenHero title="Apps" hideOnWeb floatingHeaderInset />
              <ComingSoon accentColor={event.tintColor} />
            </View>
          )}
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
            // La barra de pestañas flota: sin esto la última app quedaba
            // debajo de ella (antes solo reservaba el safe-area).
            paddingBottom: bottomPadding,
          }}
        >
          <ScreenHero title="Apps" hideOnWeb floatingHeaderInset />
          {/* Antes decía «Para el Jubileo» en cualquier evento. */}
          <Text style={styles.introSubtext}>
            {Platform.OS === 'web'
              ? 'Toca una app para abrirla, o el botón de la derecha para elegir iOS o Android.'
              : 'Toca una app para abrirla o ir a su tienda.'}{' '}
            Las marcadas con una estrella son necesarias.
          </Text>

          {apps.map((app, idx) => (
            // La fila NO es un único botón: dentro va el botón de descargar,
            // y en web un <button> dentro de otro es HTML inválido (React lo
            // avisaba en rojo). Dos pulsables hermanos sobre la misma tarjeta.
            <View key={idx} style={styles.listItemContainer}>
              <PressableFeedback
                onPress={() => openApp(app)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${app.nombre}`}
                style={styles.rowMain}
              >
                <PressableFeedback.Highlight />
                <View style={styles.iconContainer}>
                  <Image
                    source={{ uri: app.icono }}
                    style={styles.icon}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                </View>
                <View style={styles.contentContainer}>
                  <Text style={styles.title}>{app.nombre}</Text>
                  <Text style={styles.description}>{app.descripcion}</Text>
                </View>
                {app.tipo.toLowerCase() === 'necesaria' && (
                  <Chip
                    size="sm"
                    variant="primary"
                    color="warning"
                    accessibilityLabel="Necesaria"
                  >
                    <MaterialIcons name="star" size={12} color="#fff" />
                  </Chip>
                )}
              </PressableFeedback>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                onPress={() => setSelected(app)}
                accessibilityLabel={`Descargar ${app.nombre}`}
                style={styles.downloadBtn}
              >
                <MaterialIcons
                  name="add-circle-outline"
                  size={24}
                  color={themeColors(scheme === 'dark').icon}
                />
              </Button>
            </View>
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
    introText: {
      ...typography.body,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: spacing.xs,
      fontWeight: '500',
    },
    introSubtext: {
      ...typography.subhead,
      color: themeColors(scheme === 'dark').textSecondary,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.md,
    },
    listItemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: spacing.sm,
      backgroundColor: theme.card,
      borderRadius: radii.lg,
      marginBottom: spacing.sm,
      ...shadows.card,
    } as any,
    iconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
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
      ...typography.caption,
      lineHeight: 18,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
    downloadBtn: { minWidth: 44, minHeight: 44 },
    chipRow: { alignItems: 'center', marginBottom: spacing.sm },
    downloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
  });
};
