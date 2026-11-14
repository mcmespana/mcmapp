// «Entra en Comunica» (plan 02, rehecho el 14/11/2026 para el lanzamiento).
//
//   · Con cuenta de la app (Google o Apple): su correo y UN botón, «Entrar en
//     Comunica». La comprobación con el servidor sale sola al abrir; el botón
//     solo espera si aún no ha vuelto. Al pulsar, la entrada animada.
//   · Si ese correo no está en Comunica: fuera la tarjeta, el aviso y el
//     formulario para escribir otro (o el DNI).
//   · Sin cuenta de la app, o si la cuenta no sirve: el formulario del código.
//   · El DNI, siempre a mano.
//   · Si el servidor cerró una sesión que estaba abierta (`revoked`) y la
//     persona no había salido a propósito, se vuelve a entrar sola con la
//     cuenta de la app: «la sesión no se puede perder».

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import PageContainer from '@/components/ui/PageContainer';
import { useAuth } from '@/contexts/AuthContext';
import {
  appAccountOptedOut,
  checkAppAccount,
  isTransient,
  type AppAccountCheck,
} from '@/services/comunica/appAccount';
import { signIn } from '@/services/comunica/session';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { h } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AccountEntry from './AccountEntry';
import CodeRequestForm, { type FormNotice } from './CodeRequestForm';
import { accessErrorText } from './copy';
import {
  clearAccessHandoffs,
  onSwitchToDni,
  putChooseHandoff,
} from './handoff';
import WelcomeOverlay, { WELCOME_MS } from './WelcomeOverlay';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export default function AccessScreen({
  revoked = false,
}: {
  revoked?: boolean;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { user } = useAuth();
  const bottom = useTabBarClearance();
  const accountEmail = user?.email ? user.email.toLowerCase() : null;

  // `null` = lo que toque (con cuenta, la tarjeta); la persona lo cambia.
  const [view, setView] = useState<'account' | 'form' | null>(null);
  const [via, setVia] = useState<'email' | 'dni'>('email');
  const [notice, setNotice] = useState<FormNotice | null>(
    revoked ? { kind: 'revoked' } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const check = useRef<Promise<AppAccountCheck> | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const shown = view ?? (accountEmail ? 'account' : 'form');

  const finish = useCallback(
    async (r: Extract<AppAccountCheck, { kind: 'ready' }>) => {
      h.formSuccess();
      setWelcome(firstName(r.me.name));
      await new Promise((res) => setTimeout(res, WELCOME_MS));
      try {
        await signIn(r.tokens, r.me);
        clearAccessHandoffs();
      } catch (e) {
        logger.warn('[comunica] no se ha podido guardar la sesión', e);
        if (mounted.current) {
          setWelcome(null);
          setError(accessErrorText(e));
        }
      }
    },
    [],
  );

  /** Lo que no es «entrar»: a elegir ficha, al formulario o el aviso. */
  const route = useCallback(
    (r: AppAccountCheck, tapped: boolean) => {
      if (r.kind === 'ready') return void finish(r);
      if (r.kind === 'choose') {
        if (!tapped) return;
        router.push({
          pathname: '/comunica/acceso-elegir',
          params: {
            k: putChooseHandoff({
              body: { idToken: r.idToken },
              choices: r.choices,
            }),
          },
        });
        return;
      }
      if (r.kind === 'no_match' && accountEmail) {
        setNotice({ kind: 'account_miss', email: accountEmail });
        setView('form');
        return;
      }
      if (r.kind === 'no_account') {
        setView('form');
        return;
      }
      // Sin red o el servidor un momento: la tarjeta se queda y el botón lo
      // vuelve a intentar. Si es el pase, al código.
      if (isTransient(r)) {
        if (tapped)
          setError(accessErrorText(r.kind === 'failed' ? r.error : null));
        return;
      }
      setNotice({ kind: 'account_failed' });
      setView('form');
    },
    [accountEmail, finish, router],
  );

  // Al abrir con cuenta de la app: se comprueba ya, sin esperar al botón.
  useEffect(() => {
    if (!accountEmail) return;
    let cancelled = false;
    const p = checkAppAccount();
    check.current = p;
    void (async () => {
      const r = await p;
      if (cancelled || !mounted.current) return;
      // La sesión la cerró el servidor y no había salido a propósito: dentro
      // otra vez, sin pulsar nada.
      if (r.kind === 'ready' && revoked && !(await appAccountOptedOut())) {
        if (!cancelled) void finish(r);
        return;
      }
      // Lo que se sabe ya sin pulsar (no está, no hay cuenta, el pase no
      // vale) se enseña ya; «entrar» y «elegir» esperan al botón.
      if (r.kind !== 'ready' && r.kind !== 'choose') route(r, false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar la cuenta
  }, [accountEmail]);

  // «¿No te llega? Entra con el DNI», desde la pantalla del código.
  useEffect(
    () =>
      onSwitchToDni(() => {
        setVia('dni');
        setView('form');
      }),
    [],
  );

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let r = await (check.current ?? checkAppAccount());
      // La comprobación de fondo falló por red: otra vez, ahora que se pide.
      if (isTransient(r)) {
        check.current = checkAppAccount();
        r = await check.current;
      }
      // Una sesión preparada se usa una vez: la siguiente pulsación pide otra.
      check.current = null;
      if (r.kind !== 'ready') h.error();
      route(r, true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: bottom + 24 }]}
      >
        <PageContainer maxWidth={480}>
          <View style={styles.content}>
            {shown === 'account' && accountEmail ? (
              <AccountEntry
                email={accountEmail}
                provider={user?.provider ?? 'google'}
                busy={busy || welcome !== null}
                error={error}
                onEnter={() => void enter()}
                onOtherEmail={() => {
                  setVia('email');
                  setNotice(null);
                  setView('form');
                }}
                onDni={() => {
                  setVia('dni');
                  setNotice(null);
                  setView('form');
                }}
              />
            ) : (
              <CodeRequestForm
                // Un aviso nuevo (la comprobación de fondo vuelve tarde) pinta el formulario de nuevo.
                key={notice?.kind ?? 'none'}
                via={via}
                onViaChange={setVia}
                initialEmail={
                  notice?.kind === 'account_miss' ? '' : (accountEmail ?? '')
                }
                notice={notice}
                accountEmail={accountEmail}
                onBackToAccount={() => {
                  setNotice(null);
                  setError(null);
                  setView('account');
                }}
              />
            )}
          </View>
        </PageContainer>
      </ScrollView>
      {welcome !== null ? <WelcomeOverlay name={welcome} /> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { padding: 24, paddingTop: 32 },
});
