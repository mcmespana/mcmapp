// «Actualizado hace 5 min», con la hora del servidor (`generatedAt`). En gris,
// sin alarmar. Se refresca solo cada minuto.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import typography from '@/constants/typography';
import { ago } from '@/utils/comunica/dates';
import { useComunicaTheme } from './useComunicaTheme';

const TICK_MS = 60_000;

export default function SyncBadge({
  generatedAt,
}: {
  generatedAt?: string | null;
}) {
  const t = useComunicaTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  if (!generatedAt) return null;
  return (
    <Text style={[styles.text, { color: t.textMuted }]}>
      Actualizado {ago(generatedAt, now)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { ...typography.footnote },
});
