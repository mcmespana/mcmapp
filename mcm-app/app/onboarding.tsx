import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  DEFAULT_DELEGATION_ID,
  DEFAULT_PROFILE_TYPE,
} from '@/constants/defaultProfileConfig';
import type { ProfileType } from '@/types/profileConfig';

type Step = 'welcome' | 'profile' | 'delegation' | 'success';

const PROFILE_ICONS: Record<ProfileType, keyof typeof MaterialIcons.glyphMap> =
  {
    familia: 'family-restroom',
    monitor: 'groups',
    miembro: 'person',
  };

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

const SCREEN_W = Dimensions.get('window').width;
const DEVICE_W = Math.min(SCREEN_W, 460);

/* ─────────────────────────────────────
   Reusable bits
─────────────────────────────────────── */

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dotsStyles.row}>
      {Array.from({ length: total }, (_, i) => {
        const active = i === current;
        return (
          <View
            key={i}
            style={[
              dotsStyles.dot,
              {
                width: active ? 22 : 6,
                backgroundColor: active ? T.primary : 'rgba(37,56,131,0.18)',
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
  const bg = disabled ? 'rgba(37,56,131,0.13)' : color || T.primary;
  const fg = disabled ? 'rgba(37,56,131,0.35)' : textColor || '#fff';

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

/* ─────────────────────────────────────
   Welcome screen
─────────────────────────────────────── */

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);

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
  }, [ripple1, ripple2]);

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - ripple1.value),
    transform: [{ scale: 1 + ripple1.value * 1.4 }],
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - ripple2.value),
    transform: [{ scale: 1 + ripple2.value * 1.4 }],
  }));

  return (
    <Animated.View
      style={[welcomeStyles.root, { backgroundColor: T.primary }]}
      entering={FadeIn.duration(420)}
    >
      {/* decorative circles */}
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

      <View style={welcomeStyles.center}>
        <Animated.View
          entering={FadeIn.duration(550).easing(
            Easing.bezier(0.34, 1.56, 0.64, 1),
          )}
          style={welcomeStyles.logoWrap}
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
          entering={FadeInUp.delay(80).duration(420)}
          style={welcomeStyles.title}
        >
          Bienvenido/a a{'\n'}MCM App
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(160).duration(420)}
          style={welcomeStyles.tagline}
        >
          Movimiento Consolación para el Mundo
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(240).duration(420)}
          style={welcomeStyles.body}
        >
          Mantente al día con las novedades. Revisa el calendario, accede a la
          Plataforma Comunica, mira fotos o sigue las actividades.
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeInUp.delay(340).duration(420)}
        style={welcomeStyles.cta}
      >
        <PrimaryButton
          label="Comenzar"
          onPress={onStart}
          color="#ffffff"
          textColor={T.primary}
          shimmer
        />
      </Animated.View>
    </Animated.View>
  );
}

const welcomeStyles = StyleSheet.create({
  root: { flex: 1, position: 'relative', overflow: 'hidden' } as ViewStyle,
  deco: { position: 'absolute', borderRadius: 999 } as ViewStyle,
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
    paddingBottom: 36,
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
}: {
  profiles: { id: ProfileType; label: string; description: string }[];
  selected: ProfileType | null;
  setSelected: (id: ProfileType) => void;
  onContinue: () => void;
  onSkip: () => void;
  animDir: 'forward' | 'back';
}) {
  const Entering = animDir === 'back' ? SlideInLeft : SlideInRight;

  return (
    <Animated.View
      entering={Entering.duration(320).easing(Easing.bezier(0.22, 1, 0.36, 1))}
      style={stepStyles.root}
    >
      <View style={stepStyles.topBar}>
        <View />
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={stepStyles.skip}>Saltar</Text>
        </Pressable>
      </View>

      <View style={stepStyles.dotsWrap}>
        <ProgressDots current={0} total={2} />
      </View>

      <Animated.View entering={FadeInUp.duration(420)} style={stepStyles.hero}>
        <View style={stepStyles.heroIcon}>
          <MaterialIcons name="person-search" size={28} color={T.primary} />
        </View>
        <Text style={stepStyles.heroTitle}>¿Quién eres?</Text>
        <Text style={stepStyles.heroSub}>
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
                  sel && cardStyles.cardSelected,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View
                  style={[
                    cardStyles.iconCircle,
                    sel && cardStyles.iconCircleSelected,
                  ]}
                >
                  <MaterialIcons
                    name={PROFILE_ICONS[p.id]}
                    size={24}
                    color={sel ? '#fff' : T.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      cardStyles.cardTitle,
                      { color: sel ? T.primary : T.text },
                    ]}
                  >
                    {p.label}
                  </Text>
                  <Text style={cardStyles.cardDesc} numberOfLines={2}>
                    {p.description}
                  </Text>
                </View>
                {sel && (
                  <MaterialIcons
                    name="check-circle"
                    size={22}
                    color={T.primary}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={stepStyles.footer}>
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
}: {
  delegations: { id: string; label: string }[];
  selected: string | null;
  setSelected: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <Animated.View
      entering={SlideInRight.duration(320).easing(
        Easing.bezier(0.22, 1, 0.36, 1),
      )}
      style={stepStyles.root}
    >
      <View style={stepStyles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} style={stepStyles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={16} color={T.primary} />
          <Text style={[stepStyles.skip, { color: T.primary }]}>Atrás</Text>
        </Pressable>
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={stepStyles.skip}>Saltar</Text>
        </Pressable>
      </View>

      <View style={stepStyles.dotsWrap}>
        <ProgressDots current={1} total={2} />
      </View>

      <Animated.View entering={FadeInUp.duration(420)} style={stepStyles.hero}>
        <View style={stepStyles.heroIcon}>
          <MaterialIcons name="location-on" size={28} color={T.primary} />
        </View>
        <Text style={stepStyles.heroTitle}>¿De qué delegación?</Text>
        <Text style={stepStyles.heroSub}>
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
                  sel && delegStyles.rowSelected,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text
                  style={[
                    delegStyles.label,
                    {
                      color: sel ? T.primary : T.text,
                      fontWeight: sel ? '700' : '500',
                    },
                  ]}
                >
                  {d.label}
                </Text>
                {sel && (
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={T.primary}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={stepStyles.footer}>
        <PrimaryButton
          label="¡Empezar!"
          onPress={onFinish}
          disabled={!selected}
          color={T.accent}
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
}: {
  profile: { id: ProfileType; label: string } | null;
  delegation: { id: string; label: string } | null;
  onContinue: () => void;
}) {
  const ripple = useSharedValue(0);
  useEffect(() => {
    ripple.value = withDelay(
      300,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [ripple]);
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - ripple.value),
    transform: [{ scale: 1 + ripple.value * 1.6 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(380)} style={successStyles.root}>
      <Animated.View
        entering={FadeIn.duration(550).easing(
          Easing.bezier(0.34, 1.56, 0.64, 1),
        )}
        style={successStyles.iconWrap}
      >
        <Animated.View style={[successStyles.iconRipple, rippleStyle]} />
        <View style={successStyles.iconCircle}>
          <MaterialIcons name="check-circle" size={48} color={T.success} />
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(380)}
        style={successStyles.title}
      >
        ¡Todo listo!
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(180).duration(380)}
        style={successStyles.sub}
      >
        ¡Gracias! Tu comunidad te espera.
      </Animated.Text>

      {(profile || delegation) && (
        <Animated.View
          entering={FadeInUp.delay(260).duration(380)}
          style={successStyles.pills}
        >
          {profile && (
            <View style={successStyles.pill}>
              <MaterialIcons
                name={PROFILE_ICONS[profile.id]}
                size={20}
                color={T.primary}
              />
              <Text style={successStyles.pillText}>{profile.label}</Text>
            </View>
          )}
          {delegation && (
            <View style={successStyles.pill}>
              <MaterialIcons name="location-on" size={20} color={T.primary} />
              <Text style={successStyles.pillText}>{delegation.label}</Text>
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
});

/* ─────────────────────────────────────
   Coordinator
─────────────────────────────────────── */

export default function OnboardingScreen() {
  const { rawConfig } = useProfileConfigContext();
  const { setProfile } = useUserProfile();

  const [step, setStep] = useState<Step>('welcome');
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [delegationId, setDelegationId] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const profileEntries = useMemo<
    { id: ProfileType; label: string; description: string }[]
  >(
    () =>
      (Object.keys(rawConfig.profiles) as ProfileType[]).map((key) => ({
        id: key,
        label: rawConfig.profiles[key].label,
        description: rawConfig.profiles[key].description,
      })),
    [rawConfig],
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
    persistAndExit({
      profileType: profileType ?? DEFAULT_PROFILE_TYPE,
      delegationId: delegationId ?? DEFAULT_DELEGATION_ID,
      onboardingCompleted: false,
    });
  };

  const handleFinishToSuccess = () => {
    go('success');
  };

  const profile = useMemo(
    () =>
      profileType
        ? { id: profileType, label: rawConfig.profiles[profileType].label }
        : null,
    [profileType, rawConfig],
  );

  const delegation = useMemo(
    () =>
      delegationId
        ? (rawConfig.delegationList.find((d) => d.id === delegationId) ?? null)
        : null,
    [delegationId, rawConfig],
  );

  return (
    <SafeAreaView style={shellStyles.safe} edges={['top', 'bottom']}>
      <View
        style={[
          shellStyles.frame,
          { width: SCREEN_W <= 460 ? '100%' : DEVICE_W },
        ]}
      >
        {step === 'welcome' && <WelcomeScreen onStart={() => go('profile')} />}
        {step === 'profile' && (
          <ProfileScreen
            profiles={profileEntries}
            selected={profileType}
            setSelected={setProfileType}
            animDir={animDir}
            onContinue={() => go('delegation')}
            onSkip={handleSkip}
          />
        )}
        {step === 'delegation' && (
          <DelegationScreen
            delegations={rawConfig.delegationList}
            selected={delegationId}
            setSelected={setDelegationId}
            onFinish={handleFinishToSuccess}
            onBack={() => go('profile', 'back')}
            onSkip={handleSkip}
          />
        )}
        {step === 'success' && (
          <SuccessScreen
            profile={profile}
            delegation={delegation}
            onContinue={() =>
              persistAndExit({
                profileType: profileType ?? DEFAULT_PROFILE_TYPE,
                delegationId: delegationId ?? DEFAULT_DELEGATION_ID,
                onboardingCompleted: true,
              })
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const shellStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
  } as ViewStyle,
  frame: { flex: 1, alignSelf: 'center' } as ViewStyle,
});
