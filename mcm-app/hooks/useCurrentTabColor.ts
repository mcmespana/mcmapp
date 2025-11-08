import { usePathname } from 'expo-router';
import { TabHeaderColors } from '@/constants/colors';

export function useCurrentTabColor(): string | undefined {
  const pathname = usePathname();

  // Extract the tab name from the pathname
  // Pathname format is usually like "/(tabs)/calendario" or "/calendario"
  const tabName = pathname.split('/').pop();

  if (!tabName) return undefined;

  // Return the color if it exists in TabHeaderColors
  return TabHeaderColors[tabName as keyof typeof TabHeaderColors];
}
