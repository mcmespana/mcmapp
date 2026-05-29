import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  useWindowDimensions,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import SocialLoginSection from '@/components/SocialLoginSection';
import {
  DEFAULT_DELEGATION_ID,
  DEFAULT_PROFILE_TYPE,
} from '@/constants/defaultProfileConfig';
import type { ProfileType } from '@/types/profileConfig';

type Step = 'welcome' | 'profile' | 'delegation' | 'login' | 'success';

// "Otros" es un atajo visual del onboarding. Internamente mapea a
// `miembro` + `mcm-espana`, así cubre a quien no se identifica con ningún
// perfil ni delegación sin tener que extender la taxonomía real.
const OTROS_PROFILE_ID = 'otros' as const;
const OTROS_DELEGATION_ID = '__otros__' as const;
const OTROS_PROFILE_DESCRIPTION =
  'Si no te identificas con ninguno de los anteriores o simplemente quieres probar la app';
const OTROS_DELEGATION_DESCRIPTION =
  'Si no perteneces a ninguna o solo quieres probar la app';
const OTROS_FALLBACK_PROFILE: ProfileType = 'miembro';
const OTROS_FALLBACK_DELEGATION = 'mcm-espana';

type OnboardingProfileId = ProfileType | typeof OTROS_PROFILE_ID;

const PROFILE_ICONS: Record<
  OnboardingProfileId,
  keyof typeof MaterialIcons.glyphMap
> = {
  familia: 'family-restroom',
  monitor: 'groups',
  miembro: 'person',
  otros: 'more-horiz',
};

function resolveOnboardingValues(
  selectedProfile: OnboardingProfileId | null,
  selectedDelegation: string | null,
): { profileType: ProfileType; delegationId: string } {
  const isOtrosProfile = selectedProfile === OTROS_PROFILE_ID;
  const isOtrosDelegation = selectedDelegation === OTROS_DELEGATION_ID;
  const profileType: ProfileType = isOtrosProfile
    ? OTROS_FALLBACK_PROFILE
    : ((selectedProfile as ProfileType | null) ?? DEFAULT_PROFILE_TYPE);
  const delegationId =
    isOtrosProfile || isOtrosDelegation
      ? OTROS_FALLBACK_DELEGATION
      : (selectedDelegation ?? DEFAULT_DELEGATION_ID);
  return { profileType, delegationId };
}

// Static light-mode T used only for module-level StyleSheet defaults
const T = {
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
  success: colors.success,
  text: '#11181C',
  muted: '#687076',
  bg: '#ffffff',
  border: 'rgba(0,0,0,0.07)',
};

function useThemeT() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    success: colors.success,
    text: isDark ? '#FFFFFF' : '#11181C',
    muted: isDark ? '#8E8E93' : '#687076',
    bg: isDark ? '#1C1C1E' : '#ffffff',
    card: isDark ? '#2C2C2E' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
    // Accent used for on-surface interactive elements (icons, selected text,
    // checks, links). In dark mode the deep primary blue is too low-contrast
    // over the dark background, so we switch to the lighter secondary blue.
    tint: isDark ? colors.secondary : colors.primary,
    // Tinted backgrounds for icon circles / selected cards / summary pills.
    iconBg: isDark ? 'rgba(149,210,242,0.14)' : 'rgba(37,56,131,0.09)',
    selectedBg: isDark ? 'rgba(149,210,242,0.12)' : 'rgba(37,56,131,0.055)',
    chipBg: isDark ? 'rgba(149,210,242,0.12)' : 'rgba(37,56,131,0.06)',
    chipBorder: isDark ? 'rgba(149,210,242,0.22)' : 'rgba(37,56,131,0.10)',
    isDark,
  };
}

const MAX_CONTENT_W = 520;

/* ─────────────────────────────────────
   Reusable bits
─────────────────────────────────────── */

function ProgressDots({
  current,
  total,
  onDark,
}: {
  current: number;
  total: number;
  onDark?: boolean;
}) {
  const TT = useThemeT();
  const activeColor = onDark ? '#ffffff' : TT.tint;
  const doneColor = onDark ? 'rgba(255,255,255,0.7)' : TT.tint;
  const inactiveColor = onDark
    ? 'rgba(255,255,255,0.28)'
    : TT.isDark
      ? 'rgba(255,255,255,0.22)'
      : 'rgba(37,56,131,0.18)';
  return (
    <View
      style={dotsStyles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View
            key={i}
            style={[
              dotsStyles.dot,
              {
                width: active ? 22 : 6,
                backgroundColor: active
                  ? activeColor
                  : done
                    ? doneColor
                    : inactiveColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});

function PrimaryButton({
  label,
  onPress,
  disabled,
  color,
  shimmer,
  textColor,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  shimmer?: boolean;
  textColor?: string;
}) {
  const { isDark } = useThemeT();
  const disabledBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(37,56,131,0.13)';
  const disabledFg = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(37,56,131,0.35)';
  const bg = disabled ? disabledBg : color || T.primary;
  const fg = disabled ? disabledFg : textColor || '#fff';

  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shimmerX = useSharedValue(-1);
  useEffect(() => {
    if (!shimmer) return;
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(
          1200,
          withTiming(1.2, {
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        withDelay(900, withTiming(-1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [shimmer, shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 240 }, { rotate: '20deg' }],
  }));

  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 140 });
        }}
        onPress={onPress}
        style={[
          btnStyles.btn,
          {
            backgroundColor: bg,
            shadowOpacity: disabled ? 0 : 0.22,
          },
        ]}
      >
        {shimmer && !disabled && (
          <View style={btnStyles.shimmerWrap} pointerEvents="none">
            <Animated.View style={[btnStyles.shimmer, shimmerStyle]} />
          </View>
        )}
        <Text style={[btnStyles.label, { color: fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#253883',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  } as ViewStyle,
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  } as TextStyle,
  shimmerWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 16,
  } as ViewStyle,
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.55)',
    opacity: 0.9,
  } as ViewStyle,
});

function SkipButton({ onPress }: { onPress: () => void }) {
  const TT = useThemeT();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Saltar configuración"
      style={({ pressed }) => [
        skipBtnStyles.pill,
        {
          borderColor: TT.isDark
            ? 'rgba(149,210,242,0.30)'
            : 'rgba(37,56,131,0.28)',
          backgroundColor: TT.isDark
            ? 'rgba(149,210,242,0.10)'
            : 'rgba(37,56,131,0.06)',
        },
        pressed && { opacity: 0.65 },
      ]}
    >
      <Text style={[skipBtnStyles.text, { color: TT.tint }]}>Saltar</Text>
      <MaterialIcons name="arrow-forward" size={13} color={TT.tint} />
    </Pressable>
  );
}

const skipBtnStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(37,56,131,0.28)',
    backgroundColor: 'rgba(37,56,131,0.06)',
  } as ViewStyle,
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
    letterSpacing: -0.1,
  } as TextStyle,
});

/* ─────────────────────────────────────
   Welcome screen
─────────────────────────────────────── */

function WelcomeScreen({
  onStart,
  applySafeArea,
}: {
  onStart: () => void;
  applySafeArea: boolean;
}) {
  const insets = useSafeAreaInsets();
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    ripple1.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    ripple2.value = withDelay(
      900,
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    float.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [ripple1, ripple2, float]);

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ripple1.value),
    transform: [{ scale: 1 + ripple1.value * 1.4 }],
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - ripple2.value),
    transform: [{ scale: 1 + ripple2.value * 1.4 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * float.value }],
  }));

  const padTop = applySafeArea ? insets.top : 0;
  const padBottom = applySafeArea ? insets.bottom : 0;

  return (
    <Animated.View
      style={[welcomeStyles.root, { backgroundColor: T.primary }]}
      entering={FadeIn.duration(420)}
    >
      <StatusBar style="light" animated />
      {/* decorative circles — pueden invadir el notch sin problema */}
      <View
        style={[
          welcomeStyles.deco,
          {
            top: -100,
            right: -80,
            width: 280,
            height: 280,
            backgroundColor: 'rgba(149,210,242,0.10)',
          },
        ]}
      />
      <View
        style={[
          welcomeStyles.deco,
          {
            top: 80,
            right: -50,
            width: 160,
            height: 160,
            backgroundColor: 'rgba(149,210,242,0.07)',
          },
        ]}
      />
      <View
        style={[
          welcomeStyles.deco,
          {
            bottom: 200,
            left: -70,
            width: 240,
            height: 240,
            backgroundColor: 'rgba(149,210,242,0.06)',
          },
        ]}
      />
      <View
        style={[
          welcomeStyles.deco,
          {
            bottom: -40,
            right: 20,
            width: 120,
            height: 120,
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        ]}
      />

      <View
        style={[
          welcomeStyles.safeContent,
          { paddingTop: padTop, paddingBottom: padBottom },
        ]}
      >
        <View style={welcomeStyles.center}>
          <Animated.View
            entering={FadeInDown.delay(60)
              .duration(420)
              .easing(Easing.bezier(0.22, 1, 0.36, 1))}
            style={welcomeStyles.badge}
          >
            <MaterialIcons name="favorite" size={12} color="#FCD200" />
            <Text style={welcomeStyles.badgeText}>Te damos la bienvenida</Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(550).easing(
              Easing.bezier(0.34, 1.56, 0.64, 1),
            )}
            style={[welcomeStyles.logoWrap, floatStyle]}
          >
            <Animated.View style={[welcomeStyles.ripple, ripple1Style]} />
            <Animated.View
              style={[
                welcomeStyles.ripple,
                ripple2Style,
                { top: 10, left: 10, right: 10, bottom: 10 },
              ]}
            />
            <View style={welcomeStyles.logoCircle}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={welcomeStyles.logoImg}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(120).duration(420)}
            style={welcomeStyles.title}
          >
            ¡Hola!{'\n'}Bienvenido/a a MCM
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(200).duration(420)}
            style={welcomeStyles.tagline}
          >
            Movimiento Consolación para el Mundo
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.delay(280).duration(420)}
            style={welcomeStyles.body}
          >
            Tu comunidad en el bolsillo: calendario, cantoral, fotos,
            reflexiones y mucho más. ¿Vamos?
          </Animated.Text>
        </View>

        <Animated.View
          entering={FadeInUp.delay(360).duration(420)}
          style={welcomeStyles.cta}
        >
          <PrimaryButton
            label="¡Vamos allá!"
            onPress={onStart}
            color="#ffffff"
            textColor={T.primary}
            shimmer
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const welcomeStyles = StyleSheet.create({
  root: { flex: 1, position: 'relative', overflow: 'hidden' } as ViewStyle,
  safeContent: { flex: 1 } as ViewStyle,
  deco: { position: 'absolute', borderRadius: 999 } as ViewStyle,
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 18,
  } as ViewStyle,
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  } as TextStyle,
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  } as ViewStyle,
  logoWrap: {
    width: 130,
    height: 130,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  } as ViewStyle,
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(149,210,242,0.18)',
  } as ViewStyle,
  logoCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as ViewStyle,
  logoImg: { width: 78, height: 78 } as any,
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,
  tagline: {
    color: T.secondary,
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    marginBottom: 20,
    textAlign: 'center',
  } as TextStyle,
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  } as TextStyle,
  cta: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  } as ViewStyle,
});

/* ─────────────────────────────────────
   Profile screen
─────────────────────────────────────── */

function ProfileScreen({
  profiles,
  selected,
  setSelected,
  onContinue,
  onSkip,
  animDir,
  applySafeArea,
  totalSteps,
}: {
  profiles: { id: OnboardingProfileId; label: string; description: string }[];
  selected: OnboardingProfileId | null;
  setSelected: (id: OnboardingProfileId) => void;
  onContinue: () => void;
  onSkip: () => void;
  animDir: 'forward' | 'back';
  applySafeArea: boolean;
  totalSteps: number;
}) {
  const TT = useThemeT();
  const insets = useSafeAreaInsets();
  const Entering = animDir === 'back' ? SlideInLeft : SlideInRight;
  const topPad = (applySafeArea ? insets.top : 0) + 8;
  const bottomPad =
    (applySafeArea ? insets.bottom : 0) + (Platform.OS === 'ios' ? 12 : 24);

  return (
    <Animated.View
      entering={Entering.duration(320).easing(Easing.bezier(0.22, 1, 0.36, 1))}
      style={[stepStyles.root, { backgroundColor: TT.bg }]}
    >
      <StatusBar style={TT.isDark ? 'light' : 'dark'} animated />
      <View style={[stepStyles.topBar, { paddingTop: topPad }]}>
        <View />
        <SkipButton onPress={onSkip} />
      </View>

      <View style={stepStyles.dotsWrap}>
        <ProgressDots current={0} total={totalSteps} />
      </View>

      <Animated.View entering={FadeInUp.duration(420)} style={stepStyles.hero}>
        <View style={[stepStyles.heroIcon, { backgroundColor: TT.iconBg }]}>
          <MaterialIcons name="person-search" size={28} color={TT.tint} />
        </View>
        <Text style={[stepStyles.heroTitle, { color: TT.text }]}>
          ¿Quién eres?
        </Text>
        <Text style={[stepStyles.heroSub, { color: TT.muted }]}>
          Dinos quién eres y te mostraremos lo que más te interesa.
        </Text>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={stepStyles.list}
        showsVerticalScrollIndicator={false}
      >
        {profiles.map((p, i) => {
          const sel = selected === p.id;
          return (
            <Animated.View
              key={p.id}
              entering={FadeInUp.delay(80 + i * 80).duration(380)}
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                onPress={() => setSelected(p.id)}
                style={({ pressed }) => [
                  cardStyles.card,
                  { backgroundColor: TT.card, borderColor: TT.border },
                  sel && cardStyles.cardSelected,
                  sel && {
                    borderColor: TT.tint,
                    backgroundColor: TT.selectedBg,
                  },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View
                  style={[
                    cardStyles.iconCircle,
                    { backgroundColor: TT.iconBg },
                    sel && cardStyles.iconCircleSelected,
                    sel && { backgroundColor: TT.tint },
                  ]}
                >
                  <MaterialIcons
                    name={PROFILE_ICONS[p.id]}
                    size={24}
                    color={sel ? (TT.isDark ? '#1C1C1E' : '#fff') : TT.tint}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      cardStyles.cardTitle,
                      { color: sel ? TT.tint : TT.text },
                    ]}
                  >
                    {p.label}
                  </Text>
                  <Text
                    style={[cardStyles.cardDesc, { color: TT.muted }]}
                    numberOfLines={3}
                  >
                    {p.description}
                  </Text>
                </View>
                {sel && (
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={TT.tint}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View
        style={[
          stepStyles.footer,
          { paddingBottom: bottomPad, borderTopColor: TT.border },
        ]}
      >
        <PrimaryButton
          label="Continuar"
          onPress={onContinue}
          disabled={!selected}
        />
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────
   Delegation screen
─────────────────────────────────────── */

function DelegationScreen({
  delegations,
  selected,
  setSelected,
  onFinish,
  onBack,
  onSkip,
  applySafeArea,
  stepIndex,
  totalSteps,
  finishLabel,
}: {
  delegations: { id: string; label: string; description?: string }[];
  selected: string | null;
  setSelected: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
  onSkip: () => void;
  applySafeArea: boolean;
  stepIndex: number;
  totalSteps: number;
  finishLabel: string;
}) {
  const TT = useThemeT();
  const insets = useSafeAreaInsets();
  const topPad = (applySafeArea ? insets.top : 0) + 8;
  const bottomPad =
    (applySafeArea ? insets.bottom : 0) + (Platform.OS === 'ios' ? 12 : 24);

  return (
    <Animated.View
      entering={SlideInRight.duration(320).easing(
        Easing.bezier(0.22, 1, 0.36, 1),
      )}
      style={[stepStyles.root, { backgroundColor: TT.bg }]}
    >
      <StatusBar style={TT.isDark ? 'light' : 'dark'} animated />
      <View style={[stepStyles.topBar, { paddingTop: topPad }]}>
        <Pressable onPress={onBack} hitSlop={12} style={stepStyles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={16} color={TT.tint} />
          <Text style={[stepStyles.backLabel, { color: TT.tint }]}>Atrás</Text>
        </Pressable>
        <SkipButton onPress={onSkip} />
      </View>

      <View style={stepStyles.dotsWrap}>
        <ProgressDots current={stepIndex} total={totalSteps} />
      </View>

      <Animated.View entering={FadeInUp.duration(420)} style={stepStyles.hero}>
        <View style={[stepStyles.heroIcon, { backgroundColor: TT.iconBg }]}>
          <MaterialIcons name="location-on" size={28} color={TT.tint} />
        </View>
        <Text style={[stepStyles.heroTitle, { color: TT.text }]}>
          ¿De qué delegación?
        </Text>
        <Text style={[stepStyles.heroSub, { color: TT.muted }]}>
          Recibirás las notificaciones y el calendario de tu delegación.
        </Text>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[stepStyles.list, { gap: 7 }]}
        showsVerticalScrollIndicator={false}
      >
        {delegations.map((d, i) => {
          const sel = selected === d.id;
          return (
            <Animated.View
              key={d.id}
              entering={FadeInUp.delay(40 + i * 25).duration(320)}
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                onPress={() => setSelected(d.id)}
                style={({ pressed }) => [
                  delegStyles.row,
                  { borderColor: TT.border, backgroundColor: TT.card },
                  sel && delegStyles.rowSelected,
                  sel && {
                    borderColor: TT.tint,
                    backgroundColor: TT.selectedBg,
                  },
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      delegStyles.label,
                      {
                        color: sel ? TT.tint : TT.text,
                        fontWeight: sel ? '700' : '500',
                      },
                    ]}
                  >
                    {d.label}
                  </Text>
                  {d.description ? (
                    <Text
                      style={[delegStyles.desc, { color: TT.muted }]}
                      numberOfLines={2}
                    >
                      {d.description}
                    </Text>
                  ) : null}
                </View>
                {sel && (
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={TT.tint}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View
        style={[
          stepStyles.footer,
          { paddingBottom: bottomPad, borderTopColor: TT.border },
        ]}
      >
        <PrimaryButton
          label={finishLabel}
          onPress={onFinish}
          disabled={!selected}
          color={TT.accent}
        />
      </View>
    </Animated.View>
  );
}

/* ─────────────────────────────────────
   Success screen
─────────────────────────────────────── */

function SuccessScreen({
  profile,
  delegation,
  onContinue,
  applySafeArea,
}: {
  profile: { id: OnboardingProfileId; label: string } | null;
  delegation: { id: string; label: string } | null;
  onContinue: () => void;
  applySafeArea: boolean;
}) {
  const TT = useThemeT();
  const insets = useSafeAreaInsets();
  const ripple = useSharedValue(0);
  const wiggle = useSharedValue(0);
  useEffect(() => {
    ripple.value = withDelay(
      300,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    wiggle.value = withSequence(
      withDelay(
        120,
        withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }),
      ),
      withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) }),
    );
  }, [ripple, wiggle]);
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - ripple.value),
    transform: [{ scale: 1 + ripple.value * 1.6 }],
  }));
  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + wiggle.value * 0.08 }],
  }));

  const padTop = applySafeArea ? insets.top : 0;
  const padBottom = applySafeArea ? insets.bottom : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(380)}
      style={[
        successStyles.root,
        {
          backgroundColor: TT.bg,
          paddingTop: padTop + 28,
          paddingBottom: padBottom + 28,
        },
      ]}
    >
      <StatusBar style={TT.isDark ? 'light' : 'dark'} animated />
      <Animated.View
        entering={FadeIn.duration(550).easing(
          Easing.bezier(0.34, 1.56, 0.64, 1),
        )}
        style={[successStyles.iconWrap, wiggleStyle]}
      >
        <Animated.View style={[successStyles.iconRipple, rippleStyle]} />
        <View style={successStyles.iconCircle}>
          <MaterialIcons name="celebration" size={48} color={TT.success} />
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(380)}
        style={[successStyles.title, { color: TT.text }]}
      >
        ¡Todo listo!
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(180).duration(380)}
        style={[successStyles.sub, { color: TT.muted }]}
      >
        Tu comunidad te espera. ¡A disfrutarla!
      </Animated.Text>

      {(profile || delegation) && (
        <Animated.View
          entering={FadeInUp.delay(260).duration(380)}
          style={successStyles.pills}
        >
          {profile && (
            <View
              style={[
                successStyles.pill,
                { backgroundColor: TT.chipBg, borderColor: TT.chipBorder },
              ]}
            >
              <MaterialIcons
                name={PROFILE_ICONS[profile.id]}
                size={20}
                color={TT.tint}
              />
              <Text style={[successStyles.pillText, { color: TT.tint }]}>
                {profile.label}
              </Text>
            </View>
          )}
          {delegation && (
            <View
              style={[
                successStyles.pill,
                { backgroundColor: TT.chipBg, borderColor: TT.chipBorder },
              ]}
            >
              <MaterialIcons name="location-on" size={20} color={TT.tint} />
              <Text style={[successStyles.pillText, { color: TT.tint }]}>
                {delegation.label}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInUp.delay(340).duration(380)}
        style={successStyles.cta}
      >
        <PrimaryButton label="Ir a la app" onPress={onContinue} />
      </Animated.View>
    </Animated.View>
  );
}

const successStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: T.bg,
  } as ViewStyle,
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  } as ViewStyle,
  iconRipple: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(163,189,49,0.18)',
  } as ViewStyle,
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(163,189,49,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(163,189,49,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,
  sub: {
    fontSize: 14,
    color: T.muted,
    lineHeight: 22,
    marginBottom: 28,
    textAlign: 'center',
  } as TextStyle,
  pills: {
    width: '100%',
    gap: 8,
    marginBottom: 28,
  } as ViewStyle,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(37,56,131,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,56,131,0.10)',
  } as ViewStyle,
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.primary,
  } as TextStyle,
  cta: { width: '100%' } as ViewStyle,
});

/* ─────────────────────────────────────
   Shared step styles
─────────────────────────────────────── */

const stepStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg } as ViewStyle,
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    minHeight: 32,
  } as ViewStyle,
  skip: { fontSize: 14, fontWeight: '600', color: T.muted } as TextStyle,
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  } as ViewStyle,
  backLabel: { fontSize: 14, fontWeight: '600', color: T.primary } as TextStyle,
  dotsWrap: { paddingHorizontal: 24, paddingTop: 10 } as ViewStyle,
  hero: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 4,
    alignItems: 'center',
    gap: 8,
  } as ViewStyle,
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(37,56,131,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  } as ViewStyle,
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  } as TextStyle,
  heroSub: {
    fontSize: 14,
    color: T.muted,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  } as TextStyle,
  list: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  } as ViewStyle,
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  } as ViewStyle,
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as ViewStyle,
  cardSelected: {
    borderColor: T.primary,
    backgroundColor: 'rgba(37,56,131,0.055)',
    shadowColor: '#253883',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  } as ViewStyle,
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37,56,131,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  iconCircleSelected: {
    backgroundColor: T.primary,
    shadowColor: '#253883',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  } as ViewStyle,
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  cardDesc: {
    fontSize: 12,
    color: T.muted,
    marginTop: 2,
    lineHeight: 16,
  } as TextStyle,
});

const delegStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: '#fff',
  } as ViewStyle,
  rowSelected: {
    borderWidth: 2,
    borderColor: T.primary,
    backgroundColor: 'rgba(37,56,131,0.055)',
    shadowColor: '#253883',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } as ViewStyle,
  label: {
    fontSize: 14,
    flex: 1,
  } as TextStyle,
  desc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  } as TextStyle,
});

/* ─────────────────────────────────────
   Login screen (onboarding step)
─────────────────────────────────────── */

function LoginOnboardingScreen({
  onFinish,
  onSkip,
  onBack,
  animDir,
  profile,
  delegation,
  stepIndex,
  totalSteps,
}: {
  onFinish: () => void;
  onSkip: () => void;
  onBack: () => void;
  animDir: 'forward' | 'back';
  profile: { id: OnboardingProfileId; label: string } | null;
  delegation: { id: string; label: string } | null;
  stepIndex: number;
  totalSteps: number;
}) {
  const Entering = animDir === 'back' ? SlideInLeft : SlideInRight;
  const { width: screenW } = useWindowDimensions();
  const isWide = screenW >= 640;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={Entering.duration(320).easing(Easing.bezier(0.22, 1, 0.36, 1))}
      style={loginOnbStyles.root}
    >
      {/* Decorative background circles */}
      <View
        style={[
          loginOnbStyles.deco,
          {
            top: -80,
            right: -60,
            width: 220,
            height: 220,
            backgroundColor: 'rgba(149,210,242,0.10)',
          },
        ]}
      />
      <View
        style={[
          loginOnbStyles.deco,
          {
            bottom: 120,
            left: -60,
            width: 180,
            height: 180,
            backgroundColor: 'rgba(149,210,242,0.07)',
          },
        ]}
      />
      <View
        style={[
          loginOnbStyles.deco,
          {
            bottom: -30,
            right: 10,
            width: 120,
            height: 120,
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
        ]}
      />

      {/* Back button */}
      <Pressable
        onPress={onBack}
        style={[loginOnbStyles.backBtn, { top: insets.top + 4 }]}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <MaterialIcons
          name="arrow-back"
          size={22}
          color="rgba(255,255,255,0.75)"
        />
      </Pressable>

      {/* Step indicator */}
      <View style={[loginOnbStyles.dotsTop, { top: insets.top + 14 }]}>
        <ProgressDots current={stepIndex} total={totalSteps} onDark />
      </View>

      {/* Content — al iniciar sesión esta pantalla pasa a ser el resumen
          final del onboarding, con el CTA centrado verticalmente. */}
      <View
        style={[loginOnbStyles.center, isWide && { paddingHorizontal: 48 }]}
      >
        {/* Logo */}
        <Animated.View
          entering={FadeIn.delay(80).duration(500)}
          style={loginOnbStyles.logoWrap}
        >
          <View style={loginOnbStyles.logoCircle}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={loginOnbStyles.logoImg}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(120).duration(400)}
          style={loginOnbStyles.title}
        >
          {user ? '¡Todo listo!' : 'Guarda tu progreso'}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(180).duration(400)}
          style={loginOnbStyles.body}
        >
          {user
            ? 'Tu sesión está activa y tu progreso se sincronizará entre dispositivos. ¡A disfrutar de tu comunidad!'
            : 'Sincroniza tus hábitos de oración, evangelios guardados y reflexiones entre todos tus dispositivos.'}
        </Animated.Text>

        {/* Login buttons / authenticated card */}
        <Animated.View
          entering={FadeInUp.delay(240).duration(400)}
          style={loginOnbStyles.buttonsWrap}
        >
          <SocialLoginSection onDarkBackground />
        </Animated.View>

        {/* Resumen + CTA cuando hay sesión (centrado verticalmente) */}
        {user && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={loginOnbStyles.summaryWrap}
          >
            {(profile || delegation) && (
              <View style={loginOnbStyles.summaryPills}>
                {profile && (
                  <View style={loginOnbStyles.summaryPill}>
                    <MaterialIcons
                      name={PROFILE_ICONS[profile.id]}
                      size={16}
                      color="#fff"
                    />
                    <Text style={loginOnbStyles.summaryPillText}>
                      {profile.label}
                    </Text>
                  </View>
                )}
                {delegation && (
                  <View style={loginOnbStyles.summaryPill}>
                    <MaterialIcons name="location-on" size={16} color="#fff" />
                    <Text style={loginOnbStyles.summaryPillText}>
                      {delegation.label}
                    </Text>
                  </View>
                )}
              </View>
            )}
            <PrimaryButton
              label="Ir a la app"
              onPress={onFinish}
              color="#ffffff"
              textColor={T.primary}
              shimmer
            />
          </Animated.View>
        )}
      </View>

      {/* Cuando NO hay sesión, enlace inferior para continuar sin cuenta
          (lleva al resumen final). */}
      {!user && (
        <Animated.View
          entering={FadeInUp.delay(320).duration(380)}
          style={loginOnbStyles.skipWrap}
        >
          <Pressable
            onPress={onSkip}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Continuar sin cuenta"
            style={({ pressed }) => [pressed && { opacity: 0.65 }]}
          >
            <Text style={loginOnbStyles.skipText}>Continuar sin cuenta →</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const loginOnbStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.primary,
    position: 'relative',
    overflow: 'hidden',
  } as ViewStyle,
  deco: { position: 'absolute', borderRadius: 999 } as ViewStyle,
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
  } as ViewStyle,
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 0,
  } as ViewStyle,
  logoWrap: {
    marginBottom: 28,
  } as ViewStyle,
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  logoImg: { width: 60, height: 60 } as any,
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 32,
  } as TextStyle,
  buttonsWrap: {
    width: '100%',
    maxWidth: 320,
  } as ViewStyle,
  dotsTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  } as ViewStyle,
  summaryWrap: {
    width: '100%',
    maxWidth: 320,
    marginTop: 24,
    gap: 16,
  } as ViewStyle,
  summaryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  } as ViewStyle,
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  } as ViewStyle,
  summaryPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  skipWrap: {
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    alignItems: 'center',
  } as ViewStyle,
  skipText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
});

/* ─────────────────────────────────────
   Coordinator
─────────────────────────────────────── */

export default function OnboardingScreen() {
  const { rawConfig } = useProfileConfigContext();
  const { setProfile } = useUserProfile();
  const TT = useThemeT();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isWide = screenW >= 640;

  const [step, setStep] = useState<Step>('welcome');
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
  const [profileType, setProfileType] = useState<OnboardingProfileId | null>(
    null,
  );
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const profileEntries = useMemo<
    { id: OnboardingProfileId; label: string; description: string }[]
  >(
    () => [
      ...(Object.keys(rawConfig.profiles) as ProfileType[]).map((key) => ({
        id: key as OnboardingProfileId,
        label: rawConfig.profiles[key].label,
        description: rawConfig.profiles[key].description,
      })),
      {
        id: OTROS_PROFILE_ID,
        label: 'Otros',
        description: OTROS_PROFILE_DESCRIPTION,
      },
    ],
    [rawConfig],
  );

  // Pseudo-delegación "Sin delegación" como primera opción del selector.
  // Permite terminar el onboarding sin pertenecer a ninguna delegación local
  // (selecciona `_default`), evitando que esos usuarios queden con el banner
  // "completa tu perfil" para siempre.
  // "Otros" va inmediatamente después: en una lista larga (>15 delegaciones)
  // queremos que el atajo "no me identifico con ninguna" sea visible sin
  // scrollear. Internamente se persiste como `mcm-espana`.
  const delegationEntries = useMemo<
    { id: string; label: string; description?: string }[]
  >(
    () => [
      { id: DEFAULT_DELEGATION_ID, label: 'Sin delegación / General' },
      {
        id: OTROS_DELEGATION_ID,
        label: 'Otros',
        description: OTROS_DELEGATION_DESCRIPTION,
      },
      ...rawConfig.delegationList,
    ],
    [rawConfig.delegationList],
  );

  const go = (next: Step, dir: 'forward' | 'back' = 'forward') => {
    setAnimDir(dir);
    setStep(next);
  };

  const persistAndExit = (values: {
    profileType: ProfileType;
    delegationId: string;
    onboardingCompleted: boolean;
  }) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setProfile(values);
    router.replace('/');
  };

  const handleSkip = () => {
    const resolved = resolveOnboardingValues(profileType, delegationId);
    persistAndExit({
      profileType: resolved.profileType,
      delegationId: resolved.delegationId,
      onboardingCompleted: false,
    });
  };

  // Si el usuario eligió "Otros" como perfil, no le mostramos la pantalla de
  // delegación: por dentro fijamos `miembro` + `mcm-espana`. El usuario no
  // tiene por qué saber este mapeo.
  const handleProfileContinue = () => {
    if (profileType === OTROS_PROFILE_ID) {
      setDelegationId(OTROS_DELEGATION_ID);
      go('success');
      return;
    }
    go('delegation');
  };

  // Monitor y miembro van al paso de login antes del éxito
  const needsLoginStep = (p: OnboardingProfileId | null) =>
    p === 'monitor' || p === 'miembro';

  const handleFinishToSuccess = () => {
    if (needsLoginStep(profileType)) {
      go('login');
    } else {
      go('success');
    }
  };

  // Al iniciar sesión, la pantalla de login pasa a ser el resumen final: el
  // botón "Ir a la app" cierra el onboarding directamente (sin pantalla
  // `success` extra).
  const handleLoginFinish = () => {
    const resolved = resolveOnboardingValues(profileType, delegationId);
    persistAndExit({
      profileType: resolved.profileType,
      delegationId: resolved.delegationId,
      onboardingCompleted: true,
    });
  };

  // Indicador de pasos: el total depende del perfil elegido (otros → 1,
  // familia → 2, monitor/miembro → 3). Bienvenida y resumen no cuentan.
  const needsDelegation = profileType !== OTROS_PROFILE_ID;
  const totalSteps =
    1 + (needsDelegation ? 1 : 0) + (needsLoginStep(profileType) ? 1 : 0);
  const loginStepIndex = needsDelegation ? 2 : 1;

  const profile = useMemo(() => {
    if (!profileType) return null;
    if (profileType === OTROS_PROFILE_ID) {
      return { id: OTROS_PROFILE_ID, label: 'Otros' };
    }
    return { id: profileType, label: rawConfig.profiles[profileType].label };
  }, [profileType, rawConfig]);

  const delegation = useMemo(() => {
    if (!delegationId) return null;
    // Si el perfil ya es "Otros", evitamos un segundo pill duplicado.
    if (profileType === OTROS_PROFILE_ID) return null;
    return delegationEntries.find((d) => d.id === delegationId) ?? null;
  }, [delegationId, delegationEntries, profileType]);

  const frameWidth = isWide
    ? Math.min(screenW * 0.88, MAX_CONTENT_W)
    : ('100%' as const);
  const frameHeight = isWide ? Math.min(screenH * 0.88, 740) : undefined;

  // El shell se pinta del color del paso actual para que el safe-area
  // (notch / status bar / home indicator) quede del mismo color que el
  // contenido. Cuando estamos en modo "wide" (tableta/desktop) la pantalla
  // se muestra como tarjeta centrada y el fondo del shell es la moqueta gris.
  const shellBg = isWide
    ? TT.isDark
      ? '#0F1320'
      : '#EBEEf6'
    : step === 'welcome'
      ? T.primary
      : TT.bg;

  // En "wide" la tarjeta es de ancho fijo y NO está pegada a los bordes, así
  // que no necesitamos aplicar safe-area dentro de cada paso.
  const applySafeArea = !isWide;

  return (
    <View
      style={[
        shellStyles.safe,
        isWide && shellStyles.safeWide,
        { backgroundColor: shellBg },
      ]}
    >
      <View
        style={[
          shellStyles.frame,
          { width: frameWidth },
          isWide && shellStyles.frameWide,
          isWide && frameHeight ? { height: frameHeight } : undefined,
        ]}
      >
        {step === 'welcome' && (
          <WelcomeScreen
            onStart={() => go('profile')}
            applySafeArea={applySafeArea}
          />
        )}
        {step === 'profile' && (
          <ProfileScreen
            profiles={profileEntries}
            selected={profileType}
            setSelected={setProfileType}
            animDir={animDir}
            onContinue={handleProfileContinue}
            onSkip={handleSkip}
            applySafeArea={applySafeArea}
            totalSteps={totalSteps}
          />
        )}
        {step === 'delegation' && (
          <DelegationScreen
            delegations={delegationEntries}
            selected={delegationId}
            setSelected={setDelegationId}
            onFinish={handleFinishToSuccess}
            onBack={() => go('profile', 'back')}
            onSkip={handleSkip}
            applySafeArea={applySafeArea}
            stepIndex={1}
            totalSteps={totalSteps}
            finishLabel={
              needsLoginStep(profileType) ? 'Continuar' : '¡Empezar!'
            }
          />
        )}
        {step === 'login' && (
          <LoginOnboardingScreen
            onFinish={handleLoginFinish}
            onSkip={() => go('success')}
            onBack={() => go('delegation', 'back')}
            animDir={animDir}
            profile={profile}
            delegation={delegation}
            stepIndex={loginStepIndex}
            totalSteps={totalSteps}
          />
        )}
        {step === 'success' && (
          <SuccessScreen
            profile={profile}
            delegation={delegation}
            applySafeArea={applySafeArea}
            onContinue={() => {
              const resolved = resolveOnboardingValues(
                profileType,
                delegationId,
              );
              persistAndExit({
                profileType: resolved.profileType,
                delegationId: resolved.delegationId,
                onboardingCompleted: true,
              });
            }}
          />
        )}
      </View>
    </View>
  );
}

const shellStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
  } as ViewStyle,
  safeWide: {
    backgroundColor: '#EBEEf6',
    justifyContent: 'center',
    paddingVertical: 32,
  } as ViewStyle,
  frame: { flex: 1, alignSelf: 'center' } as ViewStyle,
  frameWide: {
    flex: undefined,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#253883',
    shadowOpacity: 0.14,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  } as ViewStyle,
});
