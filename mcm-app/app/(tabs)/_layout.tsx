// app/(tabs)/_layout.tsx - Native Tabs Implementation
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { StatusBar } from 'expo-status-bar';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const featureFlags = useFeatureFlags();

  return (
    <>
      <NativeTabs>
        {featureFlags.tabs.index && (
          <NativeTabs.Trigger name="index">
            <Label>Inicio</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'house', selected: 'house.fill' }} />,
              default: <MaterialIcons name="home" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}

        {featureFlags.tabs.cancionero && (
          <NativeTabs.Trigger name="cancionero">
            <Label>Cantoral</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'music.note', selected: 'music.note' }} />,
              default: <MaterialIcons name="music-note" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}

        {featureFlags.tabs.calendario && (
          <NativeTabs.Trigger name="calendario">
            <Label>Calendario</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'calendar', selected: 'calendar' }} />,
              default: <MaterialIcons name="calendar-today" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}

        {featureFlags.tabs.fotos && (
          <NativeTabs.Trigger name="fotos">
            <Label>Fotos</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'photo', selected: 'photo.fill' }} />,
              default: <MaterialIcons name="photo-library" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}

        {featureFlags.tabs.comunica && (
          <NativeTabs.Trigger name="comunica">
            <Label>Comunica</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'globe', selected: 'globe' }} />,
              default: <MaterialIcons name="public" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}

        {featureFlags.tabs.mas && (
          <NativeTabs.Trigger name="mas">
            <Label>Más</Label>
            {Platform.select({
              ios: <Icon sf={{ default: 'ellipsis', selected: 'ellipsis' }} />,
              default: <MaterialIcons name="more-horiz" size={24} />,
            })}
          </NativeTabs.Trigger>
        )}
      </NativeTabs>

      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
