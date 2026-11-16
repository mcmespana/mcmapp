import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';

import BottomSheet from '@/components/BottomSheet';
import { PanueloItemArt } from '@/components/panuelo/PanueloItemArt';
import { PanueloTradeCode } from '@/components/panuelo/PanueloTradeCode';
import QrScannerModal, {
  isQrScanSupported,
} from '@/components/playlist/QrScannerModal';
import SocialLoginSection from '@/components/SocialLoginSection';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import AppTextField from '@/components/ui/AppTextField';
import EmptyState from '@/components/ui/EmptyState';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { PanueloTradeValue } from '@/hooks/usePanueloTrade';
import type {
  PanueloCatalog,
  PanueloItemDef,
  PanueloUserState,
} from '@/types/panuelo';
import { h } from '@/utils/haptics';
import {
  answerChoices,
  tradeableOwned,
  TRADE_CODE_LENGTH,
  type PanueloTrade,
} from '@/utils/panueloTrade';

const TOUCH = 48;
/** Lado de una pieza en la rejilla de elegir. */
const CHOICE_ART = 56;
/** Lado de las piezas grandes (la ofrecida, las dos del trato). */
const BIG_ART = 88;
/** Lo más que ocupa la hoja: con letra grande, el resto hace scroll. */
const SHEET_MAX_SHARE = 0.8;
const MINUTE = 60_000;

type Props = {
  visible: boolean;
  isDark: boolean;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  trade: PanueloTradeValue;
};

const TITLES: Record<PanueloTradeValue['phase'], string> = {
  idle: 'Intercambiar',
  signin: 'Intercambiar',
  choosing: '¿Qué ofreces?',
  offering: 'Intercambiar',
  reviewing: 'Te proponen un cambio',
  joining: 'Tengo un código',
  answering: '¿Qué das a cambio?',
  waiting: 'Propuesta enviada',
  done: 'Hecho',
  error: 'Intercambiar',
};

/** La otra persona, por su nombre o sin él. */
const who = (name: string | undefined, capital: boolean) =>
  name ?? (capital ? 'La otra persona' : 'la otra persona');

/**
 * La hoja de los intercambios: la de quien ofrece (elige, enseña el código,
 * acepta) y la de quien contesta (escribe o escanea el código, elige qué da,
 * espera). Pinta lo que dice `usePanueloTrade`; no decide nada.
 */
export function PanueloTradeSheet({
  visible,
  isDark,
  catalog,
  state,
  trade,
}: Props) {
  const { height } = useWindowDimensions();
  // El escáner es otro `Modal`: iOS no presenta uno en el mismo ciclo en que
  // se cierra otro, así que la hoja se esconde, se espera a que se haya ido
  // (`onCloseComplete`) y solo entonces se abre la cámara; al revés igual.
  const [scan, setScan] = useState<'idle' | 'pending' | 'scanning' | 'closing'>(
    'idle',
  );
  const { message, phase } = trade;

  // Lo que cambia se anuncia (en Android ya lo hace `accessibilityLiveRegion`).
  useEffect(() => {
    if (message && Platform.OS !== 'android') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);

  return (
    <>
      <BottomSheet
        visible={visible && scan === 'idle'}
        onClose={trade.close}
        title={TITLES[phase]}
        onCloseComplete={() =>
          setScan((s) => (s === 'pending' ? 'scanning' : s))
        }
      >
        <ScrollView
          style={{ maxHeight: height * SHEET_MAX_SHARE }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Steps
            isDark={isDark}
            catalog={catalog}
            state={state}
            trade={trade}
            onScan={() => {
              h.tap();
              setScan('pending');
            }}
          />
        </ScrollView>
      </BottomSheet>
      {isQrScanSupported() ? (
        <QrScannerModal
          visible={scan === 'scanning'}
          expected="panuelo"
          onClose={() => setScan('closing')}
          onCode={(code) => {
            setScan('closing');
            void trade.join(code);
          }}
          onDismissed={() => setScan('idle')}
        />
      ) : null}
    </>
  );
}

function Steps({
  isDark,
  catalog,
  state,
  trade,
  onScan,
}: Omit<Props, 'visible'> & { onScan: () => void }) {
  const t = themeColors(isDark);
  const { phase, message, busy, offline } = trade;
  const live = trade.trade;
  const blocked = busy || offline;

  const note = (text: string | null, tone: 'text' | 'muted' = 'text') =>
    text ? (
      <Text
        style={[
          styles.text,
          { color: tone === 'text' ? t.text : t.textSecondary },
        ]}
        accessibilityLiveRegion="polite"
      >
        {text}
      </Text>
    ) : null;
  const offlineNote = offline
    ? note('Sin conexión. Intercambiar necesita internet en los dos móviles.')
    : null;
  const secondary = (label: string, onPress: () => void) => (
    <PressableFeedback
      onPress={() => {
        h.tap();
        onPress();
      }}
      isDisabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.secondary}
    >
      <Text style={[styles.secondaryLabel, { color: t.link }]}>{label}</Text>
    </PressableFeedback>
  );

  switch (phase) {
    case 'idle':
      return null;

    case 'signin':
      return (
        <>
          {note(message)}
          <SocialLoginSection />
        </>
      );

    case 'choosing':
      return (
        <ChooseOffer
          isDark={isDark}
          items={tradeableOwned(catalog, state)}
          message={message}
          blocked={blocked}
          busy={busy}
          offlineNote={offlineNote}
          onOffer={(id) => void trade.offer(id)}
          onJoin={() => trade.start({ mode: 'join' })}
        />
      );

    case 'offering':
      return live ? (
        <>
          <Piece item={catalog[live.offer.itemId]} isDark={isDark} />
          <PanueloTradeCode code={live.code} isDark={isDark} />
          {note(expiresIn(live, trade.now), 'muted')}
          {note('Esperando a que lo escriba.')}
          {offlineNote}
          {note(message)}
          {secondary('Cancelar el intercambio', () => void trade.cancel())}
        </>
      ) : null;

    case 'reviewing': {
      if (!live?.answer) return null;
      const name = live.answer.name;
      const theirs = live.answer.itemId
        ? catalog[live.answer.itemId]
        : undefined;
      return (
        <>
          <Text style={[styles.lead, { color: t.text }]}>
            {theirs
              ? `${who(name, true)} te da «${theirs.name}» por tu «${catalog[live.offer.itemId]?.name ?? 'pieza'}».`
              : `${who(name, true)} no te da nada: es un regalo.`}
          </Text>
          <Swap
            isDark={isDark}
            give={catalog[live.offer.itemId]}
            take={theirs}
          />
          {note(expiresIn(live, trade.now), 'muted')}
          {offlineNote}
          {note(message)}
          <AppPrimaryButton
            label="Aceptar el cambio"
            icon="check"
            color={t.link}
            onPress={() => void trade.accept()}
            disabled={blocked}
            loading={busy}
          />
          {secondary('No, gracias', () => void trade.cancel())}
        </>
      );
    }

    case 'joining':
      return (
        <JoinForm
          isDark={isDark}
          prefill={trade.prefill}
          message={message}
          blocked={blocked}
          busy={busy}
          offlineNote={offlineNote}
          onJoin={(code) => void trade.join(code)}
          onScan={onScan}
        />
      );

    case 'answering':
      return live ? (
        <ChooseAnswer
          isDark={isDark}
          catalog={catalog}
          state={state}
          live={live}
          message={message}
          blocked={blocked}
          busy={busy}
          offlineNote={offlineNote}
          onAnswer={(id) => void trade.answer(id)}
          onBack={() => void trade.cancel()}
          now={trade.now}
        />
      ) : null;

    case 'waiting': {
      if (!live) return null;
      const mine = live.answer?.itemId
        ? catalog[live.answer.itemId]
        : undefined;
      return (
        <>
          <Text style={[styles.lead, { color: t.text }]}>
            {`Esperando a que ${who(live.offer.name, false)} acepte.`}
          </Text>
          <Swap isDark={isDark} give={mine} take={catalog[live.offer.itemId]} />
          {note(expiresIn(live, trade.now), 'muted')}
          {offlineNote}
          {note(message)}
          {secondary('Echarme atrás', () => void trade.cancel())}
        </>
      );
    }

    case 'done': {
      const got = trade.received ? catalog[trade.received] : undefined;
      return (
        <>
          {got ? <Piece item={got} isDark={isDark} /> : null}
          {note(
            got
              ? `Ya tienes «${got.name}». Está cosida donde llevabas la otra.`
              : 'Hecho: has regalado tu pieza.',
          )}
          <AppPrimaryButton
            label="Ver mi pañuelo"
            icon="check"
            color={t.link}
            onPress={trade.close}
          />
        </>
      );
    }

    case 'error':
      return (
        <>
          {note(message)}
          <AppPrimaryButton
            label={
              trade.role === 'answer' ? 'Escribir otro código' : 'Abrir otro'
            }
            icon="swap-horiz"
            color={t.link}
            onPress={trade.restart}
          />
          {secondary('Cerrar', trade.close)}
        </>
      );
  }
}

/** «Caduca en 9 min» (minutos, no segundos: no es un cronómetro). */
function expiresIn(trade: PanueloTrade, now: number): string | null {
  if (!now) return null;
  const minutes = Math.max(1, Math.ceil((trade.expiresAt - now) / MINUTE));
  return `Caduca en ${minutes} min`;
}

function Piece({
  item,
  isDark,
}: {
  item: PanueloItemDef | undefined;
  isDark: boolean;
}) {
  const t = themeColors(isDark);
  if (!item) return null;
  return (
    <View style={styles.piece} accessible accessibilityLabel={item.name}>
      <PanueloItemArt look={item.look} size={BIG_ART} />
      <Text style={[styles.pieceName, { color: t.text }]}>{item.name}</Text>
    </View>
  );
}

/** Las dos piezas del trato, lado a lado: la que sale → la que entra. */
function Swap({
  give,
  take,
  isDark,
}: {
  give: PanueloItemDef | undefined;
  take: PanueloItemDef | undefined;
  isDark: boolean;
}) {
  const t = themeColors(isDark);
  return (
    <View
      style={styles.swap}
      accessible
      accessibilityLabel={`Das ${give?.name ?? 'nada'}. Recibes ${take?.name ?? 'nada'}.`}
    >
      <Side label="Das" item={give} isDark={isDark} />
      <MaterialIcons name="swap-horiz" size={28} color={t.icon} />
      <Side label="Recibes" item={take} isDark={isDark} />
    </View>
  );
}

function Side({
  label,
  item,
  isDark,
}: {
  label: string;
  item: PanueloItemDef | undefined;
  isDark: boolean;
}) {
  const t = themeColors(isDark);
  return (
    <View style={styles.side}>
      <Text style={[styles.sideLabel, { color: t.textSecondary }]}>
        {label}
      </Text>
      {item ? (
        <PanueloItemArt look={item.look} size={BIG_ART} />
      ) : (
        <View style={[styles.giftArt, { backgroundColor: t.backgroundSunken }]}>
          <MaterialIcons name="card-giftcard" size={36} color={t.icon} />
        </View>
      )}
      <Text style={[styles.pieceName, { color: t.text }]} numberOfLines={2}>
        {item?.name ?? 'Nada'}
      </Text>
    </View>
  );
}

/** Una pieza de la rejilla, como opción de un grupo de radio. */
function Choice({
  isDark,
  label,
  item,
  selected,
  disabledNote,
  onPress,
}: {
  isDark: boolean;
  label: string;
  item?: PanueloItemDef;
  selected: boolean;
  disabledNote?: string;
  onPress: () => void;
}) {
  const t = themeColors(isDark);
  const disabled = disabledNote !== undefined;
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      isDisabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={disabled ? `${label}. ${disabledNote}` : label}
      style={[
        styles.choice,
        {
          backgroundColor: t.backgroundSunken,
          borderColor: selected ? t.link : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <PressableFeedback.Highlight />
      {item ? (
        <PanueloItemArt look={item.look} size={CHOICE_ART} />
      ) : (
        <MaterialIcons
          name="card-giftcard"
          size={CHOICE_ART / 2}
          color={t.icon}
        />
      )}
      <Text style={[styles.choiceLabel, { color: t.text }]} numberOfLines={2}>
        {label}
      </Text>
      {disabledNote ? (
        <Text style={[styles.choiceNote, { color: t.textSecondary }]}>
          {disabledNote}
        </Text>
      ) : null}
      {selected ? (
        <MaterialIcons
          name="check-circle"
          size={20}
          color={t.link}
          style={styles.choiceCheck}
        />
      ) : null}
    </PressableFeedback>
  );
}

function ChooseOffer({
  isDark,
  items,
  message,
  blocked,
  busy,
  offlineNote,
  onOffer,
  onJoin,
}: {
  isDark: boolean;
  items: PanueloItemDef[];
  message: string | null;
  blocked: boolean;
  busy: boolean;
  offlineNote: React.ReactNode;
  onOffer: (id: string) => void;
  onJoin: () => void;
}) {
  const t = themeColors(isDark);
  const [picked, setPicked] = useState<string | null>(
    items.length === 1 ? items[0].id : null,
  );
  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          icon="swap-horiz"
          title="No tienes piezas para intercambiar"
          subtitle="Se cambian las pulseras y las chapas comunes. Si te han enseñado un código, escríbelo."
          accentColor={t.link}
          compact
        />
      ) : (
        <View style={styles.grid} accessibilityRole="radiogroup">
          {items.map((item) => (
            <Choice
              key={item.id}
              isDark={isDark}
              label={item.name}
              item={item}
              selected={picked === item.id}
              onPress={() => setPicked(item.id)}
            />
          ))}
        </View>
      )}
      {offlineNote}
      {message ? (
        <Text
          style={[styles.text, { color: t.text }]}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
      {items.length > 0 ? (
        <AppPrimaryButton
          label="Enseñar el código"
          icon="qr-code-2"
          color={t.link}
          onPress={() => picked && onOffer(picked)}
          disabled={blocked || !picked}
          loading={busy}
        />
      ) : null}
      <PressableFeedback
        onPress={() => {
          h.tap();
          onJoin();
        }}
        accessibilityRole="button"
        accessibilityLabel="Tengo un código"
        style={styles.secondary}
      >
        <Text style={[styles.secondaryLabel, { color: t.link }]}>
          Tengo un código
        </Text>
      </PressableFeedback>
    </>
  );
}

function JoinForm({
  isDark,
  prefill,
  message,
  blocked,
  busy,
  offlineNote,
  onJoin,
  onScan,
}: {
  isDark: boolean;
  prefill: string;
  message: string | null;
  blocked: boolean;
  busy: boolean;
  offlineNote: React.ReactNode;
  onJoin: (code: string) => void;
  onScan: () => void;
}) {
  const t = themeColors(isDark);
  const [code, setCode] = useState(prefill);
  const submit = () => onJoin(code);
  return (
    <>
      <View style={styles.codeRow}>
        <View style={styles.codeField}>
          <AppTextField
            value={code}
            onChangeText={setCode}
            placeholder="Código de 6"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={prefill === ''}
            // Con espacio o guion en medio también vale.
            maxLength={TRADE_CODE_LENGTH + 1}
            returnKeyType="go"
            onSubmitEditing={submit}
            error={message !== null}
            accentColor={t.link}
            accessibilityLabel="Código del intercambio"
          />
        </View>
        {isQrScanSupported() ? (
          <PressableFeedback
            onPress={onScan}
            accessibilityRole="button"
            accessibilityLabel="Escanear el QR con la cámara"
            style={[styles.scan, { backgroundColor: t.backgroundSunken }]}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="qr-code-scanner" size={22} color={t.link} />
          </PressableFeedback>
        ) : null}
      </View>
      {offlineNote}
      {message ? (
        <Text
          style={[styles.text, { color: t.text }]}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
      <AppPrimaryButton
        label="Ver qué me ofrece"
        icon="search"
        color={t.link}
        onPress={submit}
        disabled={blocked || code.trim() === ''}
        loading={busy}
      />
    </>
  );
}

function ChooseAnswer({
  isDark,
  catalog,
  state,
  live,
  message,
  blocked,
  busy,
  offlineNote,
  onAnswer,
  onBack,
  now,
}: {
  isDark: boolean;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  live: PanueloTrade;
  message: string | null;
  blocked: boolean;
  busy: boolean;
  offlineNote: React.ReactNode;
  onAnswer: (id: string | null) => void;
  onBack: () => void;
  now: number;
}) {
  const t = themeColors(isDark);
  const choices = answerChoices(catalog, state, live);
  /** `null` = regalo; `undefined` = sin elegir. */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const offered = catalog[live.offer.itemId];
  return (
    <>
      <Text style={[styles.lead, { color: t.text }]}>
        {`${who(live.offer.name, true)} te ofrece «${offered?.name ?? 'una pieza'}».`}
      </Text>
      <Piece item={offered} isDark={isDark} />
      {plainNote(expiresIn(live, now), t.textSecondary)}
      <View style={styles.grid} accessibilityRole="radiogroup">
        {choices.map(({ item, disabled }) => (
          <Choice
            key={item.id}
            isDark={isDark}
            label={item.name}
            item={item}
            selected={picked === item.id}
            disabledNote={disabled ? 'Ya la tiene' : undefined}
            onPress={() => setPicked(item.id)}
          />
        ))}
        <Choice
          isDark={isDark}
          label="Nada: que sea un regalo"
          selected={picked === null}
          onPress={() => setPicked(null)}
        />
      </View>
      {offlineNote}
      {message ? (
        <Text
          style={[styles.text, { color: t.text }]}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
      <AppPrimaryButton
        label="Proponer el cambio"
        icon="send"
        color={t.link}
        onPress={() => picked !== undefined && onAnswer(picked)}
        disabled={blocked || picked === undefined}
        loading={busy}
      />
      <PressableFeedback
        onPress={() => {
          h.tap();
          onBack();
        }}
        accessibilityRole="button"
        accessibilityLabel="Echarme atrás"
        style={styles.secondary}
      >
        <Text style={[styles.secondaryLabel, { color: t.link }]}>
          Echarme atrás
        </Text>
      </PressableFeedback>
    </>
  );
}

/** Texto de apoyo con su color (fuera de `Steps`, que tiene el suyo). */
function plainNote(text: string | null, color: string) {
  return text ? <Text style={[styles.text, { color }]}>{text}</Text> : null;
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  text: {
    ...typography.subhead,
  },
  lead: {
    ...typography.body,
    fontWeight: '600',
  },
  piece: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pieceName: {
    ...typography.subhead,
    fontWeight: '600',
    textAlign: 'center',
  },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: spacing.sm,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  sideLabel: {
    ...typography.caption,
  },
  giftArt: {
    width: BIG_ART,
    height: BIG_ART,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    width: CHOICE_ART + spacing.lg * 2,
    minHeight: TOUCH,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  choiceLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  choiceNote: {
    ...typography.footnote,
    textAlign: 'center',
  },
  choiceCheck: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeField: {
    flex: 1,
  },
  scan: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH,
  },
  secondaryLabel: {
    ...typography.button,
    textAlign: 'center',
  },
});
