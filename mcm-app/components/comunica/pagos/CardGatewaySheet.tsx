// La hoja de la pasarela del banco (plan 15, regla 8): una `Modal` a pantalla completa con la WebView del banco, SIN barra de pestañas.
//
//   · Cabecera nativa: «Cerrar», «Pago con tarjeta» y el dominio que se ve con su candado.
//   · SIN JavaScript inyectado ni `onMessage` (la app no lee la página del banco; así puede ir su Apple Pay), `incognito`, sin cookies compartidas, sin ventanas
//     nuevas.
//   · `onShouldStartLoadWithRequest` (marco principal): una URL que empieza por `returnUrlPrefix` se corta y se lee `ok`/`ko`; un esquema que no es `http(s)`
//     (la app del banco, Bizum, `intent:`) se abre fuera con `Linking`; lo demás se carga. `onNavigationStateChange`, de reserva (redirecciones en Android).
//   · Cerrar a medias (botón, atrás de Android) pide confirmación: «¿Dejar el pago?…».
//   · Si no carga en 20 s o falla: «No se ha podido abrir la pasarela del banco» con «Reintentar» (intento nuevo) y «Abrir en el navegador».
//   · Con el servidor falso (`simulated`), la pasarela de mentira. Un `simulated` con un servidor que NO es el falso es un error y no se pinta nada.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { getFakeServer } from '@/services/comunica';
import type { CardAttemptResult } from '@/services/comunica/contract';
import {
  hostOf,
  isExternalScheme,
  LEAVE_PAYMENT,
  parseReturnUrl,
  type GatewayResult,
} from '@/utils/comunica/cardAttempt';
import { confirmAction } from '../comun/confirm';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import SimulatedGateway from './SimulatedGateway';

const LOAD_TIMEOUT_MS = 20_000;

export default function CardGatewaySheet({
  attempt,
  amountLabel,
  onResult,
  onRetry,
  onBrowser,
}: {
  attempt: CardAttemptResult;
  amountLabel: string;
  onResult: (r: GatewayResult) => void;
  onRetry: () => void;
  onBrowser: () => void;
}) {
  const t = useComunicaTheme();
  const done = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const simulated = 'simulated' in attempt;
  const real = 'launchUrl' in attempt ? attempt : null;
  // Una pasarela de mentira solo existe con el servidor falso.
  const invalid = simulated && !getFakeServer();

  const finish = useCallback(
    (r: GatewayResult) => {
      if (done.current) return;
      done.current = true;
      onResult(r);
    },
    [onResult],
  );

  // Si no carga en 20 s, se dice.
  useEffect(() => {
    if (!real || !loading) return;
    const id = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [real, loading]);

  const askLeave = useCallback(async () => {
    const leave = await confirmAction(
      LEAVE_PAYMENT.title,
      LEAVE_PAYMENT.body,
      LEAVE_PAYMENT.leave,
      false,
      LEAVE_PAYMENT.keep,
    );
    if (leave) finish('closed');
  }, [finish]);

  const check = (url: string): boolean => {
    if (!real) return true;
    const r = parseReturnUrl(url, real.returnUrlPrefix);
    if (r) {
      finish(r);
      return false;
    }
    return true;
  };

  return (
    <Modal
      visible
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={() => void askLeave()}
    >
      <View style={[styles.root, { backgroundColor: t.background }]}>
        <View style={[styles.header, { borderBottomColor: t.separator }]}>
          <PressableFeedback
            onPress={() => void askLeave()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={styles.close}
          >
            <Text style={[styles.closeLabel, { color: t.accentText }]}>
              Cerrar
            </Text>
          </PressableFeedback>
          <View style={styles.titleBox}>
            <Text style={[styles.title, { color: t.text }]}>
              Pago con tarjeta
            </Text>
            {real ? (
              <View style={styles.host}>
                <IconSymbol name="lock" size={12} color={t.textSecondary} />
                <Text style={[styles.hostText, { color: t.textSecondary }]}>
                  {hostOf(real.launchUrl)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.close} />
        </View>

        {invalid ? (
          <EmptyState
            icon="error-outline"
            title="No se ha podido abrir la pasarela del banco"
            actionLabel="Reintentar"
            onAction={onRetry}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : simulated ? (
          <SimulatedGateway
            amountLabel={amountLabel}
            onResult={(r) => finish(r)}
          />
        ) : failed ? (
          <View style={styles.failed}>
            <EmptyState
              icon="error-outline"
              title="No se ha podido abrir la pasarela del banco"
              actionLabel="Reintentar"
              onAction={onRetry}
              accentColor={t.accentText}
              titleColor={t.text}
              subtitleColor={t.textSecondary}
            />
            <PressableFeedback
              onPress={onBrowser}
              accessibilityRole="button"
              accessibilityLabel="Abrir en el navegador"
              style={styles.browser}
            >
              <Text style={[styles.closeLabel, { color: t.accentText }]}>
                Abrir en el navegador
              </Text>
            </PressableFeedback>
          </View>
        ) : real ? (
          <WebView
            source={{ uri: real.launchUrl }}
            incognito
            sharedCookiesEnabled={false}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(
              req: WebViewNavigation & { isTopFrame?: boolean },
            ) => {
              // Solo el marco principal: lo de dentro de la página del banco (iframes) no se toca.
              if (req.isTopFrame === false) return true;
              if (!check(req.url)) return false;
              if (isExternalScheme(req.url)) {
                void Linking.openURL(req.url).catch(() => undefined);
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(nav) => {
              check(nav.url);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  closeLabel: { ...typography.button },
  titleBox: { flex: 1, alignItems: 'center', gap: 2 },
  title: { ...typography.title },
  host: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostText: { ...typography.caption },
  failed: { flex: 1, justifyContent: 'center' },
  browser: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
