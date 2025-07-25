import React, {
  useLayoutEffect,
  ComponentProps,
  useState,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  Animated,
  Alert,
} from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import SettingsPanel from '@/components/SettingsPanel';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import featureFlags from '@/constants/featureFlags';

interface NavigationItem {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  gradientColors: string[];
  color: string;
  onPress?: string;
  size: 'small' | 'medium' | 'large';
  position: {
    row: number;
    col: number;
    rowSpan?: number;
    colSpan?: number;
  };
}

const navigationItems: NavigationItem[] = [
  featureFlags.tabs.jubileo && {
    href: '/jubileo',
    label: 'JUBILEO',
    icon: 'celebration',
    gradientColors: ['#A3BD31', '#8AA528'], // Verde COM
    color: '#FFFFFF',
    size: 'medium',
    position: { row: 0, col: 0 },
  },
  featureFlags.tabs.cancionero && {
    href: '/cancionero',
    label: 'CANTORAL',
    icon: 'library-music',
    gradientColors: ['#FCD200', '#E6BD00'], // Amarillo COM
    color: '#222222',
    size: 'large',
    position: { row: 0, col: 1, rowSpan: 2 },
  },
  featureFlags.tabs.calendario && {
    href: '/calendario',
    label: 'CALENDARIO',
    icon: 'event',
    gradientColors: ['#31AADF', '#2B96C7'], // Celeste
    color: '#FFFFFF',
    size: 'medium',
    position: { row: 1, col: 0 },
  },
  featureFlags.tabs.fotos && {
    href: '/fotos',
    label: 'FOTOS',
    icon: 'photo-library',
    gradientColors: ['#E15C62', '#C7474E'], // Rojo MIC
    color: '#FFFFFF',
    size: 'large',
    position: { row: 2, col: 0, colSpan: 2 },
  },
  featureFlags.tabs.comunica && {
    href: '/comunica',
    label: 'COMUNICA',
    icon: 'chat',
    gradientColors: ['#9D1E74', '#821A61'], // Morado LC
    color: '#FFFFFF',
    size: 'medium',
    position: { row: 3, col: 0 },
  },
  {
    label: '¿Nos ayudas?',
    icon: 'bug-report',
    gradientColors: ['#8E9AAF', '#7A869C'],
    color: '#FFFFFF',
    size: 'small',
    position: { row: 3, col: 1 },
    onPress: 'feedback',
  },
].filter(Boolean) as NavigationItem[];

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

// Componente para formas orgánicas decorativas
function OrganicShape({ style, color }: { style: ViewStyle; color: string }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          backgroundColor: color,
          opacity: 0.15,
        },
        style,
      ]}
    />
  );
}

// Decoraciones contextuales para cada botón - versión moderna
function ModernDecoration({ type, size }: { type: string; size: string }) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }],
  };

  const isLarge = size === 'large';
  const isMedium = size === 'medium';

  return (
    <Animated.View style={[styles.decorationContainer, animatedStyle]}>
      {/* Formas orgánicas grandes inspiradas en la imagen */}
      <OrganicShape
        style={{
          width: isLarge ? 120 : isMedium ? 80 : 60,
          height: isLarge ? 120 : isMedium ? 80 : 60,
          borderRadius: isLarge ? 60 : isMedium ? 40 : 30,
          top: -30,
          right: -30,
        }}
        color="rgba(255, 255, 255, 0.1)"
      />
      <OrganicShape
        style={{
          width: isLarge ? 100 : isMedium ? 70 : 50,
          height: isLarge ? 100 : isMedium ? 70 : 50,
          borderRadius: isLarge ? 50 : isMedium ? 35 : 25,
          bottom: -25,
          left: -25,
        }}
        color="rgba(0, 0, 0, 0.05)"
      />
      {/* Círculos pequeños decorativos */}
      <OrganicShape
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          top: isLarge ? 20 : 15,
          left: isLarge ? 20 : 15,
        }}
        color="rgba(255, 255, 255, 0.2)"
      />
      <OrganicShape
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          bottom: isLarge ? 25 : 20,
          right: isLarge ? 25 : 20,
        }}
        color="rgba(255, 255, 255, 0.15)"
      />
    </Animated.View>
  );
}

export default function Home() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const featureFlags = useFeatureFlags();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const { width, height } = useWindowDimensions();

  // Configuración del grid asimétrico
  const padding = spacing.lg;
  const gap = spacing.md;
  const availableWidth = width - padding * 2;
  const availableHeight = height - 200; // Espacio para header y título

  // Tamaños para el grid
  const getSizeForItem = (item: NavigationItem) => {
    const baseWidth = (availableWidth - gap) / 2;
    const baseHeight = Math.min(140, availableHeight / 4);

    switch (item.size) {
      case 'large':
        return {
          width: item.position.colSpan === 2 ? availableWidth : baseWidth * 1.2,
          height: item.position.rowSpan === 2 ? baseHeight * 2 + gap : baseHeight * 1.4,
        };
      case 'medium':
        return {
          width: baseWidth,
          height: baseHeight,
        };
      case 'small':
        return {
          width: baseWidth * 0.8,
          height: baseHeight * 0.8,
        };
      default:
        return {
          width: baseWidth,
          height: baseHeight,
        };
    }
  };

  // Animaciones para cada elemento
  const [itemAnimations] = useState(() =>
    navigationItems.map(() => ({
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8),
    })),
  );

  // Función para manejar acciones especiales
  const handleSpecialAction = (action: string) => {
    if (action === 'feedback') {
      setFeedbackVisible(true);
    }
  };

  // Función para mostrar toast de éxito
  const handleFeedbackSuccess = () => {
    Alert.alert(
      '¡Gracias!',
      'Tu comentario ha sido enviado correctamente. Nos ayudas a mejorar la app 🙌',
      [{ text: 'De nada cracks 😊' }],
    );
  };

  useEffect(() => {
    // Animar entrada con delay escalonado
    const animations = itemAnimations.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 600,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 400,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          delay: index * 100,
          useNativeDriver: true,
        }),
      ]),
    );

    // Posiciones iniciales
    itemAnimations.forEach((anim, index) => {
      anim.translateY.setValue(50);
      anim.opacity.setValue(0);
      anim.scale.setValue(0.8);
    });

    Animated.stagger(0, animations).start();
  }, [itemAnimations]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerButtons, { paddingRight: spacing.md }]}>
          <SettingsButton
            color={Colors[scheme ?? 'light'].icon}
            onPress={() => setSettingsVisible(true)}
          />
          {featureFlags.showNotificationsIcon && (
            <NotificationsButton color={Colors[scheme ?? 'light'].icon} />
          )}
        </View>
      ),
      title: '', // Sin título para usar el personalizado
    });
  }, [navigation, scheme, featureFlags.showNotificationsIcon]);

  return (
    <>
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: Colors[scheme ?? 'light'].background },
        ]}
        contentContainerStyle={{ padding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Título personalizado estilo "Te daré la MAESTRA" */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleTop}>Te daremos la</Text>
          <Text style={styles.titleMain}>EXPERIENCIA</Text>
        </View>

        {/* Grid de navegación personalizado */}
        <View style={styles.gridContainer}>
          {navigationItems.map((item, index) => {
            const size = getSizeForItem(item);
            const animStyle = itemAnimations[index]
              ? {
                  opacity: itemAnimations[index].opacity,
                  transform: [
                    { translateY: itemAnimations[index].translateY },
                    { scale: itemAnimations[index].scale },
                  ],
                }
              : {};

            const content = (
              <Animated.View style={[animStyle]}>
                <LinearGradient
                  colors={
                    [item.gradientColors[0], item.gradientColors[1]] as const
                  }
                  style={[
                    styles.gridItem,
                    {
                      width: size.width,
                      height: size.height,
                    },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <ModernDecoration type={item.label} size={item.size} />
                  <MaterialIcons
                    name={item.icon}
                    size={
                      item.size === 'large'
                        ? 56
                        : item.size === 'small'
                          ? 32
                          : 40
                    }
                    color={item.color}
                    style={styles.gridIcon}
                  />
                  <Text style={[styles.gridLabel, { color: item.color }]}>
                    {item.label}
                  </Text>
                </LinearGradient>
              </Animated.View>
            );

            return item.href ? (
              <Link href={item.href} asChild key={index}>
                <TouchableOpacity
                  style={[styles.gridItemWrapper, { marginBottom: gap }]}
                >
                  {content}
                </TouchableOpacity>
              </Link>
            ) : item.onPress ? (
              <TouchableOpacity
                key={index}
                style={[styles.gridItemWrapper, { marginBottom: gap }]}
                onPress={() => handleSpecialAction(item.onPress!)}
              >
                {content}
              </TouchableOpacity>
            ) : (
              <View
                key={index}
                style={[styles.gridItemWrapper, { marginBottom: gap }]}
              >
                {content}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de feedback */}
      <AppFeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        onSuccess={handleFeedbackSuccess}
      />
    </>
  );
}

interface Styles {
  container: ViewStyle;
  titleContainer: ViewStyle;
  titleTop: TextStyle;
  titleMain: TextStyle;
  gridContainer: ViewStyle;
  gridItemWrapper: ViewStyle;
  gridItem: ViewStyle;
  gridIcon: TextStyle;
  gridLabel: TextStyle;
  headerButtons: ViewStyle;
  decorationContainer: ViewStyle;
  // Mantener algunos estilos legacy por compatibilidad
  row: ViewStyle;
  itemWrapper: ViewStyle;
  item: ViewStyle;
  icon: TextStyle;
  label: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  titleTop: {
    ...(typography.caption as TextStyle),
    fontSize: 24,
    fontWeight: '300',
    color: '#4A9EE7',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  titleMain: {
    ...(typography.h1 as TextStyle),
    fontSize: 36,
    fontWeight: '900',
    color: '#253883',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  gridItemWrapper: {
    marginHorizontal: spacing.xs,
  },
  gridItem: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  gridIcon: {
    marginBottom: spacing.sm,
    zIndex: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gridLabel: {
    ...(typography.button as TextStyle),
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 3,
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  decorationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  
  // Estilos legacy para compatibilidad (se pueden remover después)
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
    overflow: 'hidden',
  },
  icon: {
    marginBottom: spacing.sm,
    zIndex: 2,
  },
  label: {
    ...(typography.button as TextStyle),
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 2,
  },
});
