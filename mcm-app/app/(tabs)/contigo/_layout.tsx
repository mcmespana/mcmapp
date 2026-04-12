import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { FloatingMusicPlayer } from '@/components/contigo/music/FloatingMusicPlayer';

export default function ContigoLayout() {
  return (
    <View style={styles.container}>
      <Stack initialRouteName="index">
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            title: 'Contigo',
          }}
        />
        <Stack.Screen
          name="bookmarks"
          options={{
            headerShown: false,
            title: 'Favoritos',
          }}
        />
        <Stack.Screen
          name="evangelio"
          options={{
            headerShown: false,
            title: 'Evangelio',
          }}
        />
      </Stack>
      <FloatingMusicPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
