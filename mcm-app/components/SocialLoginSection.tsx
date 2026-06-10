import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, type AuthUser } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import brandColors, { Colors } from '@/constants/colors';
import { hexAlpha } from '@/utils/colorUtils';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import { writeUserOnLogin } from '@/utils/authHelpers';
import { useToast } from '@/contexts/AppToastContext';

/** Pide confirmación para eliminar la cuenta. Multiplataforma: usa Alert en
 *  nativo y window.confirm en web. Devuelve true si el usuario confirma. */
function confirmDeleteAccount(): Promise<boolean> {
  const message =
    'Esta acción es permanente y no se puede deshacer. Se eliminará tu cuenta y todos los datos asociados (perfil, delegación y progreso sincronizado de CONTIGO).';
  if (Platform.OS === 'web') {
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(`¿Eliminar tu cuenta?\n\n${message}`);
    return Promise.resolve(!!ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      'Eliminar cuenta',
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Eliminar cuenta',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

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

/** Paleta de gradientes vivos pero elegantes para el avatar. Todos con
 *  suficiente contraste para texto blanco. */
const AVATAR_GRADIENTS: [string, string][] = [
  ['#667EEA', '#764BA2'], // índigo → violeta
  ['#F5576C', '#F093FB'], // coral → rosa
  ['#4FACFE', '#00C6FB'], // azul → cian
  ['#11998E', '#38EF7D'], // esmeralda → verde
  ['#FC5C7D', '#6A82FB'], // rosa → azul
  ['#30CFD0', '#5B247A'], // turquesa → púrpura
  ['#C471F5', '#FA71CD'], // lila → magenta
  ['#48C6EF', '#6F86D6'], // celeste → periwinkle
  ['#EB3349', '#F45C43'], // rojo → naranja
  ['#FF8008', '#FFC837'], // naranja → ámbar
];

/** Hash determinista de una cadena → índice de la paleta. */
function gradientFor(seed: string | null | undefined): [string, string] {
  const s = seed ?? '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

/** Avatar circular con gradiente único por usuario (o foto si existe). */
function UserAvatar({
  photoURL,
  seed,
  initials,
  size = 46,
}: {
  photoURL: string | null;
  seed: string | null;
  initials: string;
  size?: number;
}) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const [from, to] = gradientFor(seed);
  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: '700',
          color: '#fff',
          letterSpacing: 0.5,
          includeFontPadding: false,
        }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
}

interface Props {
  /** When true, renders a compact version suitable for the onboarding dark bg */
  onDarkBackground?: boolean;
}

export default function SocialLoginSection({
  onDarkBackground = false,
}: Props) {
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
  } = useAuth();
  const { profile, setProfile } = useUserProfile();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const { toast } = useToast();
  const [signingIn, setSigningIn] = useState<'google' | 'apple' | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-fill name from auth if local profile name is empty
  useEffect(() => {
    if (user && !profile.name && user.displayName) {
      setProfile({ name: user.displayName });
    }
  }, [user, profile.name, setProfile]);

  const persistLogin = (authUser: AuthUser, provider: 'google' | 'apple') => {
    if (!authUser) return;
    // writeUserOnLogin is fire-and-forget — UI is already updated via onAuthStateChanged
    writeUserOnLogin(
      authUser.uid,
      authUser.displayName,
      authUser.email,
      authUser.photoURL,
      provider,
      {
        profileType: profile.profileType,
        delegationId: profile.delegationId,
        onboardingCompleted: profile.onboardingCompleted,
      },
    );
  };

  const handleGoogleSignIn = async () => {
    setSigningIn('google');
    try {
      const authUser = await signInWithGoogle();
      if (authUser) {
        persistLogin(authUser, 'google');
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
        persistLogin(authUser, 'apple');
        toast.show({ variant: 'success', label: 'Sesión iniciada con Apple' });
      }
    } catch {
      toast.show({ variant: 'danger', label: 'No se pudo iniciar sesión' });
    } finally {
      setSigningIn(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.show({ label: 'Sesión cerrada' });
    } catch {
      toast.show({ variant: 'danger', label: 'Error al cerrar sesión' });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    const confirmed = await confirmDeleteAccount();
    if (!confirmed) return;
    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (result === 'success') {
        // Borra también el nombre guardado localmente (dato personal).
        setProfile({ name: '' });
        toast.show({
          variant: 'success',
          label: 'Tu cuenta ha sido eliminada',
        });
      } else if (result === 'error') {
        toast.show({
          variant: 'danger',
          label: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
        });
      }
      // 'cancelled' → el usuario abortó la reautenticación; sin mensaje.
    } catch {
      toast.show({
        variant: 'danger',
        label: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={theme.icon} />
      </View>
    );
  }

  if (user) {
    // ── Estado: autenticado ──────────────────────────────────────────
    const providerLabel = user.provider === 'apple' ? 'Apple' : 'Google';
    const initials = getInitials(user.displayName ?? user.email);
    return (
      <View style={styles.authenticatedWrap}>
        <View style={styles.authenticatedCard}>
          <UserAvatar
            photoURL={user.photoURL}
            seed={user.email ?? user.displayName ?? user.uid}
            initials={initials}
            size={46}
          />
          <View style={{ flex: 1 }}>
            {user.displayName ? (
              <Text
                style={[
                  styles.authName,
                  { color: onDarkBackground ? '#fff' : theme.text },
                ]}
                numberOfLines={1}
              >
                {user.displayName}
              </Text>
            ) : null}
            {user.email ? (
              <Text
                style={[
                  styles.authEmail,
                  {
                    color: onDarkBackground
                      ? 'rgba(255,255,255,0.65)'
                      : theme.icon,
                  },
                ]}
                numberOfLines={1}
              >
                {user.email}
              </Text>
            ) : null}
            <Text
              style={[
                styles.authProvider,
                {
                  color: onDarkBackground
                    ? 'rgba(255,255,255,0.45)'
                    : theme.icon,
                },
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
                {
                  color: onDarkBackground ? 'rgba(255,255,255,0.8)' : '#E15C62',
                },
              ]}
            >
              Salir
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={styles.deleteAccountBtn}
          accessibilityRole="button"
          accessibilityLabel="Eliminar cuenta"
        >
          {deleting ? (
            <ActivityIndicator
              size="small"
              color={onDarkBackground ? 'rgba(255,255,255,0.7)' : theme.icon}
            />
          ) : (
            <Text
              style={[
                styles.deleteAccountLabel,
                {
                  color: onDarkBackground
                    ? 'rgba(255,255,255,0.55)'
                    : theme.icon,
                },
              ]}
            >
              Eliminar cuenta
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Android: inicio de sesión "próximamente" ──────────────────────
  // El login con proveedores nativos está temporalmente deshabilitado en
  // Android mientras se repara. Mostramos un aviso en lugar de los botones.
  if (Platform.OS === 'android') {
    const csBg = onDarkBackground
      ? 'rgba(255,255,255,0.10)'
      : scheme === 'dark'
        ? 'rgba(255,255,255,0.06)'
        : hexAlpha(brandColors.primary, '10');
    const csIcon = onDarkBackground ? 'rgba(255,255,255,0.85)' : brandColors.primary;
    const csTitle = onDarkBackground ? '#fff' : theme.text;
    const csBody = onDarkBackground ? 'rgba(255,255,255,0.75)' : theme.icon;
    return (
      <View style={styles.container}>
        <View style={[styles.comingSoonCard, { backgroundColor: csBg }]}>
          <MaterialIcons name="schedule" size={26} color={csIcon} />
          <Text style={[styles.comingSoonTitle, { color: csTitle }]}>
            Inicio de sesión próximamente
          </Text>
          <Text style={[styles.comingSoonBody, { color: csBody }]}>
            Estamos preparando el acceso con cuenta en Android. Mientras tanto
            puedes seguir usando la app con normalidad. ¡Muy pronto!
          </Text>
        </View>
      </View>
    );
  }

  // ── Estado: no autenticado ─────────────────────────────────────────
  const googleBg = onDarkBackground ? 'rgba(255,255,255,0.12)' : theme.card;
  const googleBorder = onDarkBackground
    ? 'rgba(255,255,255,0.22)'
    : scheme === 'dark'
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(0,0,0,0.10)';
  const googleText = onDarkBackground
    ? '#fff'
    : scheme === 'dark'
      ? '#ECEDEE'
      : '#3C4043';

  const brand = brandColors.primary;
  const hintBg = onDarkBackground
    ? 'rgba(255,255,255,0.10)'
    : scheme === 'dark'
      ? 'rgba(255,255,255,0.06)'
      : hexAlpha(brand, '10');
  const hintIconColor = onDarkBackground ? 'rgba(255,255,255,0.85)' : brand;
  const hintTextColor = onDarkBackground
    ? 'rgba(255,255,255,0.75)'
    : theme.icon;
  const hintDomainColor = onDarkBackground
    ? '#fff'
    : scheme === 'dark'
      ? brandColors.secondary
      : brand;

  return (
    <View style={styles.container}>
      <View style={[styles.hintCard, { backgroundColor: hintBg }]}>
        <MaterialIcons
          name="alternate-email"
          size={16}
          color={hintIconColor}
          style={{ marginTop: 1 }}
        />
        <Text style={[styles.hintText, { color: hintTextColor }]}>
          Si tienes correo{' '}
          <Text style={[styles.hintDomain, { color: hintDomainColor }]}>
            @movimientoconsolacion.com
          </Text>
          , úsalo para iniciar sesión.
        </Text>
      </View>

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
            !onDarkBackground && scheme === 'dark'
              ? { borderColor: 'rgba(255,255,255,0.18)' }
              : null,
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
  comingSoonCard: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: radii.md,
  } as ViewStyle,
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  comingSoonBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  } as TextStyle,
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: 6,
  } as ViewStyle,
  hintText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  } as TextStyle,
  hintDomain: {
    fontWeight: '700',
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
  // Authenticated state
  authenticatedWrap: {
    gap: 10,
  } as ViewStyle,
  authenticatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as ViewStyle,
  deleteAccountBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 24,
    justifyContent: 'center',
  } as ViewStyle,
  deleteAccountLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    textDecorationLine: 'underline',
  } as TextStyle,
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
