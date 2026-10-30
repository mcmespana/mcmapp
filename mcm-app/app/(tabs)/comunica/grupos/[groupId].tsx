// La gente de un grupo (plan 05).

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import GroupScreen from '@/components/comunica/grupos/GroupScreen';

export default function Grupo() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <GroupScreen groupId={String(groupId)} />;
}
