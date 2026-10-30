// «Coordinación» / «Acompañamiento»: solo lo excepcional, uno como mucho y sin
// frase explicativa (`design.md` del plugin §6.4).

import React from 'react';
import StatusChip from './StatusChip';

const LABEL = {
  coordination: 'Coordinación',
  accompaniment: 'Acompañamiento',
} as const;

export default function RoleChip({ role }: { role: keyof typeof LABEL }) {
  return <StatusChip label={LABEL[role]} tone="accent" />;
}
