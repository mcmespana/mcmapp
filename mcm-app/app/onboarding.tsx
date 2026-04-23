import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'heroui-native';

import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useProfileConfigContext } from '@/contexts/ProfileConfigContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  DEFAULT_DELEGATION_ID,
  DEFAULT_PROFILE_TYPE,
} from '@/constants/defaultProfileConfig';
import type { ProfileType } from '@/types/profileConfig';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

type Step = 'profile' | 'delegation';

const PROFILE_ICONS: Record<ProfileType, string> = {
  familia: 'family-restroom',
  monitor: 'groups',
  miembro: 'person',
};

export default function OnboardingScreen() {
  const { rawConfig } = useProfileConfigContext();
  const { setProfile } = useUserProfile();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const [step, setStep] = useState<Step>('profile');
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [delegationId, setDelegationId] = useState<string | null>(null);

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

  const finishAndGoHome = (values: {
    profileType: ProfileType;
    delegationId: string;
    onboardingCompleted: boolean;
  }) => {
    setProfile(values);
    router.replace('/');
  };

  const handleSkip = () => {
    finishAndGoHome({
      profileType: DEFAULT_PROFILE_TYPE,
      delegationId: DEFAULT_DELEGATION_ID,
      onboardingCompleted: false,
    });
  };

  const handleContinueProfile = () => {
    if (!profileType) return;
    setStep('delegation');
  };

  const handleFinish = () => {
    finishAndGoHome({
      profileType: profileType ?? DEFAULT_PROFILE_TYPE,
      delegationId: delegationId ?? DEFAULT_DELEGATION_ID,
      onboardingCompleted: true,
    });
  };

  const surfaceBg =
    scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const accentColor = scheme === 'dark' ? colors.info : colors.primary;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} accessibilityRole="button">
          <Text style={[styles.skip, { color: theme.icon }]}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View
            style={[styles.logoCircle, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="device-hub" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {step === 'profile'
              ? 'Personaliza tu experiencia'
              : '¿De qué delegación eres?'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.icon }]}>
            {step === 'profile'
              ? 'Dinos quién eres y te mostraremos lo que más te interesa.'
              : 'Recibirás las notificaciones y calendarios de tu delegación.'}
          </Text>
        </View>

        {step === 'profile' && (
          <View style={styles.optionList}>
            {profileEntries.map((opt) => {
              const selected = profileType === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.optionCard,
                    { backgroundColor: surfaceBg },
                    selected && {
                      borderColor: accentColor,
                      backgroundColor: hexAlpha(accentColor, '15'),
                    },
                  ]}
                  onPress={() => setProfileType(opt.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      {
                        backgroundColor: selected
                          ? accentColor
                          : hexAlpha(theme.icon, '18'),
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={PROFILE_ICONS[opt.id] as any}
                      size={22}
                      color={selected ? '#fff' : theme.icon}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>
                      {opt.label}
                    </Text>
                    <Text
                      style={[styles.optionDesc, { color: theme.icon }]}
                      numberOfLines={2}
                    >
                      {opt.description}
                    </Text>
                  </View>
                  {selected && (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={accentColor}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 'delegation' && (
          <View style={styles.optionList}>
            {rawConfig.delegationList.map((item) => {
              const selected = delegationId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionCardCompact,
                    { backgroundColor: surfaceBg },
                    selected && {
                      borderColor: accentColor,
                      backgroundColor: hexAlpha(accentColor, '15'),
                    },
                  ]}
                  onPress={() => setDelegationId(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[styles.optionLabel, { color: theme.text, flex: 1 }]}
                  >
                    {item.label}
                  </Text>
                  {selected && (
                    <MaterialIcons
                      name="check-circle"
                      size={20}
                      color={accentColor}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View
        style={[styles.footer, { borderTopColor: hexAlpha(theme.icon, '20') }]}
      >
        {step === 'profile' ? (
          <Button
            variant="primary"
            onPress={handleContinueProfile}
            isDisabled={!profileType}
          >
            <Button.Label>Continuar</Button.Label>
          </Button>
        ) : (
          <View style={styles.footerRow}>
            <Button
              variant="ghost"
              onPress={() => setStep('profile')}
              style={styles.footerSecondary}
            >
              <Button.Label>Atrás</Button.Label>
            </Button>
            <Button
              variant="primary"
              onPress={handleFinish}
              isDisabled={!delegationId}
              style={styles.footerPrimary}
            >
              <Button.Label>Empezar</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 } as ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  skip: { fontSize: 14, fontWeight: '600', opacity: 0.7 } as TextStyle,
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  } as ViewStyle,
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  } as ViewStyle,
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.md,
  } as ViewStyle,
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  } as TextStyle,
  optionList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  } as ViewStyle,
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  optionCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  optionText: { flex: 1, gap: 3 } as ViewStyle,
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  optionDesc: {
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  } as ViewStyle,
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  } as ViewStyle,
  footerSecondary: { flex: 1 } as ViewStyle,
  footerPrimary: { flex: 2 } as ViewStyle,
});
