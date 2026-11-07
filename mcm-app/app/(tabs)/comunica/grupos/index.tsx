// «Grupos y fichas» (plan 05). `?view=groups|courses|az`; sin ella, Grupos.

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import GruposIndexScreen, {
  type GruposView,
} from '@/components/comunica/grupos/GruposIndexScreen';

const VIEWS: readonly GruposView[] = ['groups', 'courses', 'az'];

export default function Grupos() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const v = VIEWS.includes(view as GruposView)
    ? (view as GruposView)
    : 'groups';
  return <GruposIndexScreen view={v} />;
}
