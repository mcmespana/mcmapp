# AGENTS.md — MCM App

> Guía para agentes IA trabajando en `mcm-app/` (Expo/React Native).
> Lee también `CLAUDE.md` para la arquitectura completa.

## Reglas críticas para agentes

0. **Antes de escribir UI, lee [`../design.md`](../design.md)** — reglas de
   diseño, territorios visuales, antipatrones y la lista de componentes que ya
   existen (reinventar uno es error de revisión). Regla corta de motor de
   estilo: **`StyleSheet` es el motor de esta app; `className` solo dentro de
   componentes heroui o en web.** Y cero hex nuevos: los colores salen de
   `constants/colors.ts`.
1. **UI library: heroui-native** — La app usa `heroui-native` v1.0.x (ver `package.json`), NO react-native-paper (eliminado en marzo 2026). Antes de implementar un componente de HeroUI, consulta su API en el servidor MCP `heroui-native` (ver abajo): lo que recuerdas de HeroUI Native puede estar desfasado.
2. **Compound components** — HeroUI Native usa patrón compound: `<Card><Card.Body>…</Card.Body></Card>`, `<Button><Button.Label>…</Button.Label></Button>`, etc.
3. **Toast imperativo** — Usa `const { toast } = useToast()` (dentro de `HeroUINativeProvider`). Nunca uses estado para toasts.
4. **No react-native-paper** — Si ves imports de `react-native-paper` en el código, hay que migrarlos. La migración de referencia está en el CHANGELOG.
5. **Docs de HeroUI Native por MCP** — `.mcp.json` arranca `@heroui/native-mcp`. No hay skill `heroui-native` instalado ni docs locales en el repo.

## Consultar la documentación de componentes

El servidor MCP `heroui-native` (`mcm-app/.mcp.json`, lanzado con
`npx -y @heroui/native-mcp@latest`) lista los componentes y devuelve la
documentación de cada uno. Para activarlo en Claude Code:
`claude mcp add heroui-native -- npx -y @heroui/native-mcp@latest`.

## Patrones establecidos en esta app

### Provider hierarchy (app/\_layout.tsx)

```tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <HeroUINativeProvider>
      {/* Toast incluido aquí */}
      <ProfileConfigProvider>
        <Stack />
      </ProfileConfigProvider>
    </HeroUINativeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Toast (patrón aprobado)

```tsx
import { useToast } from 'heroui-native';
const { toast } = useToast();
toast.show({ variant: 'success', label: 'Guardado' });
toast.show({
  variant: 'danger',
  label: 'Error',
  actionLabel: 'Cerrar',
  onActionPress: ({ hide }) => hide(),
});
```

### Card (reemplaza Paper Card)

```tsx
import { Card } from 'heroui-native';
<Card style={styles.card}>
  <Card.Body>{/* contenido */}</Card.Body>
</Card>;
// ⚠️ Card.Body (no Card.Content como en Paper)
```

### Button

```tsx
import { Button } from 'heroui-native';
<Button variant="primary" onPress={fn}>
  <Button.Label>Guardar</Button.Label>
</Button>;
```

### Iconos

Siempre `MaterialIcons` de `@expo/vector-icons/MaterialIcons`. Nunca iconos de Paper.

```tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
<MaterialIcons name="arrow-back" size={24} color="#888" />;
```

### FAB

No hay componente de FAB (el `GlassFAB` se borró por no usarse). Se escribe en
la pantalla con `PressableFeedback` (o `PressableScale`) y `shadows.overlay`;
tamaños, radios y colores salen de los tokens (`constants/spacing.ts`,
`constants/uiStyles.ts`, `constants/colors.ts`), no de números sueltos. Reglas
y componentes aprobados: [`../design.md`](../design.md) §7-8.

```tsx
import { PressableFeedback } from 'heroui-native';
<PressableFeedback style={styles.fab} onPress={fn}>
  <MaterialIcons name="add" size={24} color={colors.white} />
</PressableFeedback>;
```

### Modal (reemplaza Paper Portal+Modal)

`Modal` de React Native con un `PressableFeedback` de fondo para cerrar al
tocar fuera. Dentro de un `Modal` **no uses animaciones de Reanimated** (se
pintan invisibles): ahí va el core `Animated`, como en `OTAUpdatePrompt`.

```tsx
import { Modal } from 'react-native';
import { PressableFeedback } from 'heroui-native';
<Modal visible={open} transparent animationType="fade" onRequestClose={close}>
  <PressableFeedback style={styles.overlay} onPress={close}>
    <View style={styles.modal}>{/* contenido */}</View>
  </PressableFeedback>
</Modal>;
```
