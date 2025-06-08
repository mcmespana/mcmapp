import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import spacing from '@/constants/spacing'; // Import spacing

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function Collapsible({
  children,
  title,
  isOpen: controlledOpen,
  onToggle,
}: PropsWithChildren & { title: string; isOpen?: boolean; onToggle?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const theme = useColorScheme() ?? 'light';

  const toggle = () => {
    const newValue = !isOpen;
    if (controlledOpen === undefined) {
      setInternalOpen(newValue);
    }
    onToggle?.(newValue);
  };

  return (
    <ThemedView>
      <TouchableOpacity
        style={styles.heading}
        onPress={toggle}
        activeOpacity={0.8}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />

        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && (
        <ThemedView style={[
          styles.content,
          { borderColor: theme === 'light' ? Colors.light.border : Colors.dark.shadow }
        ]}>
          {children}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  content: {
    marginTop: spacing.sm,
    marginLeft: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
  },
});
