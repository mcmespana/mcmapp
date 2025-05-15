// app/_layout.tsx
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Slot />             // Aquí se renderizan todas las pantallas/rutas
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
// Este archivo es el layout raíz de la aplicación. Aquí se configura el tema y se renderizan las rutas.
// El componente <Slot /> es donde se renderizan todas las pantallas/rutas de la aplicación.
// El tema se establece utilizando el hook useColorScheme, que determina si el esquema de color actual es oscuro o claro.


// El componente ThemeProvider de @react-navigation/native se utiliza para proporcionar el tema a toda la aplicación.
// El componente StatusBar se utiliza para controlar la apariencia de la barra de estado en la parte superior de la pantalla.
// El tema se establece utilizando el hook useColorScheme, que determina si el esquema de color actual es oscuro o claro.
// El componente ThemeProvider de @react-navigation/native se utiliza para proporcionar el tema a toda la aplicación.
// El componente StatusBar se utiliza para controlar la apariencia de la barra de estado en la parte superior de la pantalla.                                   