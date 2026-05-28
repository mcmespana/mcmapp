import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Avatar } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import { writeUserOnLogin } from '@/utils/authHelpers';
import { useToast } from '@/contexts/AppToastContext';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Props {
  /** When true, renders a compact version suitable for the onboarding dark bg */
  onDarkBackground?: boolean;
}

export default function SocialLoginSection({ onDarkBackground = false }: Props) {
  const { user, loading, signInWithGoogle, signInWithApple, signOut } =
    useAuth();
  const { profile, setProfile } = useUserProfile();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const { toast } = useToast();
  const [signingIn, setSigningIn] = useState<'google' | 'apple' | null>(null);

  // Auto-fill name from auth if local profile name is empty
  useEffect(() => {
    if (user && !profile.name && user.displayName) {
      setProfile({ name: user.displayName });
    }
  }, [user, profile.name, setProfile]);

  const handleGoogleSignIn = async () => {
    setSigningIn('google');
    try {
      const authUser = await signInWithGoogle();
      if (authUser) {
        await writeUserOnLogin(
          authUser.uid,
          authUser.displayName,
          authUser.email,
          authUser.photoURL,
          'google',
          {
            profileType: profile.profileType,
            delegationId: profile.delegationId,
            onboardingCompleted: profile.onboardingCompleted,
          },
        );
        toast.show({ variant: 'success', label: 'Sesión iniciada con Google' });
      }
    } catch {
      toast.show({ variant: 'danger', label: 'No se pudo iniciar sesión' });
    } finally {
      setSigningIn(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSigningIn('apple');
    try {
      const authUser = await signInWithApple();
      if (authUser) {
        await writeUserOnLogin(
          authUser.uid,
          authUser.displayName,
          authUser.email,
          authUser.photoURL,
          'apple',
          {
            profileType: profile.profileType,
            delegationId: profile.delegationId,
            onboardingCompleted: profile.onboardingCompleted,
          },
        );
        toast.show({ variant: 'success', label: 'Sesión iniciada con Apple' });
      }
    } catch {
      toast.show({ variant: 'danger', label: 'No se pudo iniciar sesión' });
    } finally {
      setSigningIn(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.show({ label: 'Sesión cerrada' });
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={theme.icon} />
      </View>
    );
  }

  const isDark = scheme === 'dark' || onDarkBackground;

  if (user) {
    // ── Estado: autenticado ──────────────────────────────────────────
    const providerLabel = user.provider === 'apple' ? 'Apple' : 'Google';
    const initials = getInitials(user.displayName ?? user.email);
    return (
      <View style={styles.authenticatedCard}>
        <Avatar size="md">
          {user.photoURL ? (
            <Avatar.Image source={{ uri: user.photoURL }} />
          ) : null}
          <Avatar.Fallback>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </Avatar.Fallback>
        </Avatar>
        <View style={{ flex: 1 }}>
          {user.displayName ? (
            <Text
              style={[styles.authName, { color: onDarkBackground ? '#fff' : theme.text }]}
              numberOfLines={1}
            >
              {user.displayName}
            </Text>
          ) : null}
          {user.email ? (
            <Text
              style={[
                styles.authEmail,
                { color: onDarkBackground ? 'rgba(255,255,255,0.65)' : theme.icon },
              ]}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          ) : null}
          <Text
            style={[
              styles.authProvider,
              { color: onDarkBackground ? 'rgba(255,255,255,0.45)' : theme.icon },
            ]}
          >
            · via {providerLabel} ·
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSignOut}
          style={[
            styles.signOutBtn,
            {
              borderColor: onDarkBackground
                ? 'rgba(255,255,255,0.25)'
                : hexAlpha('#E15C62', '50'),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text
            style={[
              styles.signOutLabel,
              { color: onDarkBackground ? 'rgba(255,255,255,0.8)' : '#E15C62' },
            ]}
          >
            Salir
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Estado: no autenticado ─────────────────────────────────────────
  const googleBg = onDarkBackground ? 'rgba(255,255,255,0.12)' : theme.card;
  const googleBorder = onDarkBackground
    ? 'rgba(255,255,255,0.22)'
    : 'rgba(0,0,0,0.10)';
  const googleText = onDarkBackground ? '#fff' : '#3C4043';

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.hint,
          {
            color: onDarkBackground
              ? 'rgba(255,255,255,0.60)'
              : theme.icon,
          },
        ]}
      >
        Usa tu correo @movimientoconsolacion.com si lo tienes
      </Text>

      {/* Google */}
      <TouchableOpacity
        style={[
          styles.socialBtn,
          { backgroundColor: googleBg, borderColor: googleBorder },
          ...(signingIn && signingIn !== 'google' ? [styles.btnDisabled] : []),
        ]}
        onPress={handleGoogleSignIn}
        disabled={!!signingIn}
        accessibilityRole="button"
        accessibilityLabel="Continuar con Google"
      >
        {signingIn === 'google' ? (
          <ActivityIndicator size="small" color={googleText} />
        ) : (
          <GoogleIcon size={20} />
        )}
        <Text style={[styles.socialBtnLabel, { color: googleText }]}>
          Continuar con Google
        </Text>
      </TouchableOpacity>

      {/* Apple — iOS y web */}
      {Platform.OS !== 'android' && (
        <TouchableOpacity
          style={[
            styles.socialBtn,
            styles.appleBtn,
            ...(signingIn && signingIn !== 'apple' ? [styles.btnDisabled] : []),
          ]}
          onPress={handleAppleSignIn}
          disabled={!!signingIn}
          accessibilityRole="button"
          accessibilityLabel="Continuar con Apple"
        >
          {signingIn === 'apple' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="apple" size={20} color="#fff" />
          )}
          <Text style={[styles.socialBtnLabel, { color: '#fff' }]}>
            Continuar con Apple
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Icono "G" de Google (SVG en colores oficiales, sin assets externos). */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.9,
          fontWeight: '700',
          color: '#4285F4',
          lineHeight: size,
          includeFontPadding: false,
        }}
      >
        G
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  } as ViewStyle,
  loadingRow: {
    paddingVertical: 12,
    alignItems: 'center',
  } as ViewStyle,
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
    marginLeft: 2,
  } as TextStyle,
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  appleBtn: {
    backgroundColor: '#000',
    borderColor: '#000',
  } as ViewStyle,
  btnDisabled: {
    opacity: 0.45,
  } as ViewStyle,
  socialBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  } as TextStyle,
  // Authenticated state
  authenticatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as ViewStyle,
  authName: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  } as TextStyle,
  authEmail: {
    fontSize: 12,
    marginTop: 1,
  } as TextStyle,
  authProvider: {
    fontSize: 11,
    marginTop: 2,
  } as TextStyle,
  signOutBtn: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  } as ViewStyle,
  signOutLabel: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
});
