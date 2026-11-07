// El selector de la delegación de trabajo (plan 17): «Villaclara · Puerto
// Alto». Solo sale a quien colabora con más de una delegación; arriba de «Hoy»,
// Grupos y fichas y Coordinación. Cambiar vuelve a pedir lo de la otra (cada
// delegación tiene su caché) y la pantalla se recompone.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useDelegation } from '@/hooks/comunica/useDelegation';
import FilterChips from './FilterChips';
import { useComunicaTheme } from './useComunicaTheme';

/** Con más que esto, chips en vez de segmentado. */
const MAX_SEGMENTS = 3;

export default function DelegationSwitcher() {
  const t = useComunicaTheme();
  const { team, current, choose, several } = useDelegation();
  if (!several || !current) return null;
  if (team.length <= MAX_SEGMENTS) {
    return (
      <SegmentedControl
        options={team.map((d) => ({ value: d.id, label: d.name }))}
        value={current}
        onChange={choose}
        accentColor={t.accentFill}
        accessibilityLabel="Delegación con la que trabajas"
      />
    );
  }
  return (
    <View style={styles.bleed}>
      <FilterChips
        chips={team.map((d) => ({ key: d.id, label: d.name }))}
        value={current}
        onChange={choose}
        label="Delegación con la que trabajas"
      />
    </View>
  );
}

const styles = StyleSheet.create({ bleed: { marginHorizontal: -16 } });
