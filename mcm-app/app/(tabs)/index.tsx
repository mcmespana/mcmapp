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
  FlatList,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Link, LinkProps } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import SettingsPanel from '@/components/SettingsPanel';
import AppFeedbackModal from '@/components/AppFeedbackModal';
import Toast from '@/components/Toast';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import featureFlags from '@/constants/featureFlags';

interface NavigationItem {
  href?: LinkProps['href'];
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  backgroundColor: string;
  color: string;
  onPress?: string; // Para acciones especiales como 'feedback'
}

const navigationItems: NavigationItem[] = [
  featureFlags.tabs.jubileo && {
    href: '/jubileo',
    label: 'Jubileo',
    icon: 'celebration',
    backgroundColor: colors.success,
    color: '#222',
  },
  featureFlags.tabs.cancionero && {
    href: '/cancionero',
    label: 'Cantoral',
    icon: 'library-music',
    backgroundColor: colors.warning,
    color: '#222',
  },
  featureFlags.tabs.calendario && {
    href: '/calendario',
    label: 'Calendario',
    icon: 'event',
    backgroundColor: colors.info, // Morado Jubileo
    color: '#222',
  },
  featureFlags.tabs.fotos && {
    href: '/fotos',
    label: 'Fotos',
    icon: 'photo-library',
    backgroundColor: colors.accent,
    color: '#222',
  },
  featureFlags.tabs.comunica && {
    href: '/comunica',
    label: 'Comunica',
    icon: 'chat',
    backgroundColor: '#9D1E74dd',
    color: '#222',
  },
  {
    label: '¿Nos ayudas?',
    icon: 'bug-report',
    backgroundColor: '#8E9AAFdd',
    color: '#222',
    onPress: 'feedback', // Indicador especial para abrir feedback
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

// Decoraciones contextuales para cada botón
function ContextualDecoration({ type }: { type: string }) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }],
  };

  switch (type) {
    case 'Jubileo':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Confeti y formas celebrativas */}
          <View style={[styles.confetti, styles.confetti1]} />
          <View style={[styles.confetti, styles.confetti2]} />
          <View style={[styles.confetti, styles.confetti3]} />
          <View style={[styles.star, styles.star1]} />
          <View style={[styles.star, styles.star2]} />
        </Animated.View>
      );

    case 'Cantoral':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Notas musicales y ondas */}
          <View style={[styles.musicNote, styles.note1]} />
          <View style={[styles.musicNote, styles.note2]} />
          <View style={[styles.musicWave, styles.wave1]} />
          <View style={[styles.musicWave, styles.wave2]} />
        </Animated.View>
      );

    case 'Calendario':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Puntos de calendario y líneas temporales */}
          <View style={[styles.calendarDot, styles.dot1]} />
          <View style={[styles.calendarDot, styles.dot2]} />
          <View style={[styles.calendarDot, styles.dot3]} />
          <View style={[styles.timelineBar, styles.timeline1]} />
          <View style={[styles.timelineBar, styles.timeline2]} />
        </Animated.View>
      );

    case 'Fotos':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Marcos de fotos y flashes */}
          <View style={[styles.photoFrame, styles.frame1]} />
          <View style={[styles.photoFrame, styles.frame2]} />
          <View style={[styles.flashRay, styles.ray1]} />
          <View style={[styles.flashRay, styles.ray2]} />
        </Animated.View>
      );

    case 'Comunica':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Burbujas de chat y conexiones */}
          <View style={[styles.chatBubble, styles.bubble1]} />
          <View style={[styles.chatBubble, styles.bubble2]} />
          <View style={[styles.connectionLine, styles.connection1]} />
          <View style={[styles.connectionLine, styles.connection2]} />
        </Animated.View>
      );

    case '¿Fallitos?':
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Decoración para fallitos/bugs */}
          <View style={[styles.bugDot, styles.bug1]} />
          <View style={[styles.bugDot, styles.bug2]} />
          <View style={[styles.bugDot, styles.bug3]} />
          <View style={[styles.debugLine, styles.debug1]} />
          <View style={[styles.debugLine, styles.debug2]} />
        </Animated.View>
      );

    default:
      return (
        <Animated.View style={[styles.decorationContainer, animatedStyle]}>
          {/* Decoración minimalista para otros casos */}
          <View style={[styles.hourglass, styles.sand1]} />
          <View style={[styles.hourglass, styles.sand2]} />
          <View style={[styles.dots, styles.loadingDot1]} />
          <View style={[styles.dots, styles.loadingDot2]} />
          <View style={[styles.dots, styles.loadingDot3]} />
        </Animated.View>
      );
  }
}

export default function Home() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const featureFlags = useFeatureFlags();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const containerPadding = spacing.md;
  const gap = spacing.md;
  const itemWidth = (width - containerPadding * 2 - gap) / 2;
  const itemHeight = Math.min(
    160,
    (height - containerPadding * 2 - gap * 3) / 3,
  );

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
    setToastVisible(true);
  };

  useEffect(() => {
    // Definir direcciones de entrada para cada elemento
    const getInitialPosition = (index: number) => {
      switch (index % 6) {
        case 0:
          return { x: -100, y: 0 }; // Desde la izquierda
        case 1:
          return { x: 100, y: 0 }; // Desde la derecha
        case 2:
          return { x: -80, y: -50 }; // Desde izquierda-arriba
        case 3:
          return { x: 80, y: -50 }; // Desde derecha-arriba
        case 4:
          return { x: -60, y: 50 }; // Desde izquierda-abajo
        case 5:
          return { x: 60, y: 50 }; // Desde derecha-abajo
        default:
          return { x: 0, y: -80 }; // Desde arriba
      }
    };

    // Establecer posiciones iniciales
    itemAnimations.forEach((anim, index) => {
      const { x, y } = getInitialPosition(index);
      anim.translateX.setValue(x);
      anim.translateY.setValue(y);
      anim.opacity.setValue(0);
      anim.scale.setValue(0.8);
    });

    // Animar entrada con delay escalonado
    const animations = itemAnimations.map((anim, index) =>
      Animated.parallel([
        Animated.timing(anim.translateX, {
          toValue: 0,
          duration: 400,
          delay: index * 80, // Delay muy breve entre elementos
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: 0,
          duration: 400,
          delay: index * 80,
          useNativeDriver: true,
        }),
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 300,
          delay: index * 80,
          useNativeDriver: true,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          delay: index * 80,
          useNativeDriver: true,
        }),
      ]),
    );

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
      title: 'Inicio',
    });
  }, [navigation, scheme, featureFlags.showNotificationsIcon]);

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
        renderItem={({ item, index }) => {
          const animStyle = itemAnimations[index]
            ? {
                opacity: itemAnimations[index].opacity,
                transform: [
                  { translateX: itemAnimations[index].translateX },
                  { translateY: itemAnimations[index].translateY },
                  { scale: itemAnimations[index].scale },
                ],
              }
            : {};

          const content = (
            <Animated.View
              style={[
                styles.item,
                {
                  backgroundColor: item.backgroundColor, // Color principal
                  width: itemWidth,
                  height: itemHeight,
                },
                animStyle,
              ]}
            >
              {/* Overlay sutil para dar profundidad */}
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 16,
                  },
                ]}
              />
              <ContextualDecoration type={item.label} />
              <MaterialIcons
                name={item.icon}
                size={48}
                color={item.color}
                style={styles.icon}
              />
              <Text style={[styles.label, { color: item.color }]}>
                {item.label}
              </Text>
            </Animated.View>
          );
          return item.href ? (
            <Link href={item.href} asChild>
              <TouchableOpacity style={styles.itemWrapper}>
                {content}
              </TouchableOpacity>
            </Link>
          ) : item.onPress ? (
            <TouchableOpacity
              style={styles.itemWrapper}
              onPress={() => handleSpecialAction(item.onPress!)}
            >
              {content}
            </TouchableOpacity>
          ) : (
            <View style={styles.itemWrapper}>{content}</View>
          );
        }}
      />

      {/* Modal de feedback */}
      <AppFeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        onSuccess={handleFeedbackSuccess}
      />

      {/* Toast de éxito para feedback */}
      <Toast
        visible={toastVisible}
        message="¡Gracias! Tu comentario ha sido enviado correctamente. Nos ayudas a mejorar la app 🙌"
        type="success"
        duration={4000}
        onDismiss={() => setToastVisible(false)}
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
  // Decoraciones contextuales
  decorationContainer: ViewStyle;
  // Jubileo - confeti y estrellas
  confetti: ViewStyle;
  confetti1: ViewStyle;
  confetti2: ViewStyle;
  confetti3: ViewStyle;
  star: ViewStyle;
  star1: ViewStyle;
  star2: ViewStyle;
  // Cantoral - notas musicales
  musicNote: ViewStyle;
  note1: ViewStyle;
  note2: ViewStyle;
  musicWave: ViewStyle;
  wave1: ViewStyle;
  wave2: ViewStyle;
  // Calendario - puntos y líneas
  calendarDot: ViewStyle;
  dot1: ViewStyle;
  dot2: ViewStyle;
  dot3: ViewStyle;
  timelineBar: ViewStyle;
  timeline1: ViewStyle;
  timeline2: ViewStyle;
  // Fotos - marcos y flashes
  photoFrame: ViewStyle;
  frame1: ViewStyle;
  frame2: ViewStyle;
  flashRay: ViewStyle;
  ray1: ViewStyle;
  ray2: ViewStyle;
  // Comunica - burbujas y conexiones
  chatBubble: ViewStyle;
  bubble1: ViewStyle;
  bubble2: ViewStyle;
  connectionLine: ViewStyle;
  connection1: ViewStyle;
  connection2: ViewStyle;
  // Fallitos - bugs y debug
  bugDot: ViewStyle;
  bug1: ViewStyle;
  bug2: ViewStyle;
  bug3: ViewStyle;
  debugLine: ViewStyle;
  debug1: ViewStyle;
  debug2: ViewStyle;
  // Próximamente - reloj de arena
  hourglass: ViewStyle;
  sand1: ViewStyle;
  sand2: ViewStyle;
  dots: ViewStyle;
  loadingDot1: ViewStyle;
  loadingDot2: ViewStyle;
  loadingDot3: ViewStyle;
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

  // Decoraciones contextuales
  decorationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },

  // Jubileo - confeti y estrellas
  confetti: {
    position: 'absolute',
    opacity: 0.4,
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  confetti1: {
    width: 12,
    height: 20,
    top: 10,
    left: 12,
    transform: [{ rotate: '25deg' }],
  },
  confetti2: {
    width: 16,
    height: 16,
    top: 20,
    right: 16,
    backgroundColor: '#FF6B9D',
    borderRadius: 8,
  },
  confetti3: {
    width: 8,
    height: 16,
    bottom: 16,
    left: 8,
    backgroundColor: '#4ECDC4',
    transform: [{ rotate: '-15deg' }],
  },
  star: {
    position: 'absolute',
    opacity: 0.35,
    backgroundColor: '#FFEB3B',
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
  },
  star1: {
    top: 12,
    right: 8,
  },
  star2: {
    bottom: 12,
    right: 20,
    backgroundColor: '#FF9800',
    width: 10,
    height: 10,
  },

  // Cantoral - notas musicales
  musicNote: {
    position: 'absolute',
    opacity: 0.25,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  note1: {
    width: 6,
    height: 6,
    top: 14,
    left: 14,
  },
  note2: {
    width: 4,
    height: 4,
    bottom: 20,
    right: 16,
    backgroundColor: '#555',
  },
  musicWave: {
    position: 'absolute',
    opacity: 0.2,
    backgroundColor: 'transparent',
    borderTopWidth: 2,
    borderTopColor: '#333',
    borderStyle: 'solid',
  },
  wave1: {
    width: 20,
    height: 2,
    top: 18,
    right: 12,
    borderRadius: 1,
  },
  wave2: {
    width: 16,
    height: 2,
    bottom: 24,
    left: 14,
    borderRadius: 1,
  },

  // Calendario - puntos y líneas
  calendarDot: {
    position: 'absolute',
    opacity: 0.3,
    backgroundColor: '#673AB7',
    borderRadius: 3,
    width: 6,
    height: 6,
  },
  dot1: {
    top: 16,
    left: 16,
  },
  dot2: {
    top: 20,
    right: 20,
    backgroundColor: '#9C27B0',
  },
  dot3: {
    bottom: 20,
    left: 20,
    backgroundColor: '#3F51B5',
  },
  timelineBar: {
    position: 'absolute',
    opacity: 0.2,
    backgroundColor: '#673AB7',
    borderRadius: 1,
  },
  timeline1: {
    width: 2,
    height: 20,
    top: 12,
    right: 14,
  },
  timeline2: {
    width: 16,
    height: 2,
    bottom: 16,
    right: 12,
  },

  // Fotos - marcos y flashes
  photoFrame: {
    position: 'absolute',
    opacity: 0.25,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'transparent',
  },
  frame1: {
    width: 16,
    height: 12,
    top: 12,
    left: 12,
    borderRadius: 2,
  },
  frame2: {
    width: 12,
    height: 10,
    bottom: 16,
    right: 14,
    borderRadius: 1,
  },
  flashRay: {
    position: 'absolute',
    opacity: 0.3,
    backgroundColor: '#FFEB3B',
    transform: [{ rotate: '45deg' }],
  },
  ray1: {
    width: 12,
    height: 2,
    top: 20,
    right: 20,
    borderRadius: 1,
  },
  ray2: {
    width: 8,
    height: 1,
    bottom: 24,
    left: 18,
    borderRadius: 0.5,
  },

  // Comunica - burbujas y conexiones
  chatBubble: {
    position: 'absolute',
    opacity: 0.25,
    backgroundColor: '#FFF',
    borderRadius: 6,
  },
  bubble1: {
    width: 12,
    height: 8,
    top: 14,
    left: 14,
  },
  bubble2: {
    width: 8,
    height: 6,
    bottom: 18,
    right: 16,
  },
  connectionLine: {
    position: 'absolute',
    opacity: 0.2,
    backgroundColor: '#FFF',
    borderRadius: 1,
  },
  connection1: {
    width: 2,
    height: 16,
    top: 16,
    right: 12,
  },
  connection2: {
    width: 14,
    height: 2,
    bottom: 20,
    left: 12,
  },

  // Fallitos - bugs y debug
  bugDot: {
    position: 'absolute',
    opacity: 0.3,
    backgroundColor: '#666',
    borderRadius: 2,
    width: 4,
    height: 4,
  },
  bug1: {
    top: 14,
    left: 14,
  },
  bug2: {
    top: 20,
    right: 20,
    backgroundColor: '#888',
  },
  bug3: {
    bottom: 18,
    left: 18,
    backgroundColor: '#999',
  },
  debugLine: {
    position: 'absolute',
    opacity: 0.2,
    backgroundColor: '#666',
    borderRadius: 1,
  },
  debug1: {
    width: 2,
    height: 12,
    top: 16,
    right: 16,
  },
  debug2: {
    width: 10,
    height: 2,
    bottom: 22,
    right: 14,
  },

  // Próximamente - reloj de arena
  hourglass: {
    position: 'absolute',
    opacity: 0.25,
    backgroundColor: '#FFF',
    borderRadius: 1,
  },
  sand1: {
    width: 6,
    height: 3,
    top: 16,
    left: 16,
  },
  sand2: {
    width: 4,
    height: 2,
    bottom: 20,
    right: 18,
  },
  dots: {
    position: 'absolute',
    opacity: 0.3,
    backgroundColor: '#FFF',
    borderRadius: 2,
    width: 4,
    height: 4,
  },
  loadingDot1: {
    top: 20,
    right: 24,
  },
  loadingDot2: {
    top: 20,
    right: 16,
    opacity: 0.2,
  },
  loadingDot3: {
    top: 20,
    right: 8,
    opacity: 0.1,
  },
});
