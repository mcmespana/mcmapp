# AGENTS.md — MCM App

> Guía para agentes IA trabajando en `mcm-app/` (Expo/React Native).
> Lee también `CLAUDE.md` para la arquitectura completa.

## Reglas críticas para agentes

1. **UI library: heroui-native** — La app usa `heroui-native` v1.0.0, NO react-native-paper (eliminado en marzo 2026). Siempre consulta el índice de docs abajo antes de implementar componentes UI.
2. **Compound components** — HeroUI Native usa patrón compound: `<Card><Card.Body>…</Card.Body></Card>`, `<Button><Button.Label>…</Button.Label></Button>`, etc.
3. **Toast imperativo** — Usa `const { toast } = useToast()` (dentro de `HeroUINativeProvider`). Nunca uses estado para toasts.
4. **No react-native-paper** — Si ves imports de `react-native-paper` en el código, hay que migrarlos. La migración de referencia está en el CHANGELOG.
5. **Skill heroui-native disponible** — Usa el skill `heroui-native` (disponible en `.agents/skills/heroui-native/`) para consultar docs de componentes con scripts Node.

## Skill: consultar documentación de componentes

```bash
# Desde mcm-app/
node .agents/skills/heroui-native/scripts/list_components.mjs
node .agents/skills/heroui-native/scripts/get_component_docs.mjs Button
node .agents/skills/heroui-native/scripts/get_component_docs.mjs Card TextField Toast
node .agents/skills/heroui-native/scripts/get_theme.mjs
node .agents/skills/heroui-native/scripts/get_docs.mjs /docs/native/getting-started/theming
```

## Patrones establecidos en esta app

### Provider hierarchy (app/_layout.tsx)
```tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <HeroUINativeProvider>        // ← Toast incluido aquí
      <FeatureFlagsProvider>
        <Stack />
      </FeatureFlagsProvider>
    </HeroUINativeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Toast (patrón aprobado)
```tsx
import { useToast } from 'heroui-native';
const { toast } = useToast();
toast.show({ variant: 'success', label: 'Guardado' });
toast.show({ variant: 'danger', label: 'Error', actionLabel: 'Cerrar', onActionPress: ({ hide }) => hide() });
```

### Card (reemplaza Paper Card)
```tsx
import { Card } from 'heroui-native';
<Card style={styles.card}>
  <Card.Body>{/* contenido */}</Card.Body>
</Card>
// ⚠️ Card.Body (no Card.Content como en Paper)
```

### Button
```tsx
import { Button } from 'heroui-native';
<Button variant="primary" onPress={fn}>
  <Button.Label>Guardar</Button.Label>
</Button>
```

### Iconos
Siempre `MaterialIcons` de `@expo/vector-icons/MaterialIcons`. Nunca iconos de Paper.
```tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
<MaterialIcons name="arrow-back" size={24} color="#888" />
```

### FAB personalizado (Android)
```tsx
// iOS: <GlassFAB> de @/components/ui/GlassFAB.ios
// Android: TouchableOpacity absoluto
<TouchableOpacity style={styles.fab} onPress={fn} activeOpacity={0.8}>
  <MaterialIcons name="add" size={24} color="#fff" />
</TouchableOpacity>
// styles.fab: position absolute, right 16, bottom 16, borderRadius 28, width/height 56
```

### Modal (reemplaza Paper Portal+Modal)
```tsx
import { Modal } from 'react-native';
<Modal visible={open} transparent animationType="fade" onRequestClose={close}>
  <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={close}>
    <View style={styles.modal}>{/* contenido */}</View>
  </TouchableOpacity>
</Modal>
```

## Documentación HeroUI Native (índice local)

Los archivos MDX de documentación están en `.heroui-docs/native/`.
Actualizar con: `npx heroui-cli@latest agents-md --native --output AGENTS.md`

<!-- HEROUI-NATIVE-AGENTS-MD-START -->
[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|components/(buttons):{button.mdx,close-button.mdx,link-button.mdx}|components/(collections):{menu.mdx,tag-group.mdx}|components/(controls):{slider.mdx,switch.mdx}|components/(data-display):{chip.mdx}|components/(feedback):{alert.mdx,skeleton-group.mdx,skeleton.mdx,spinner.mdx}|components/(forms):{checkbox.mdx,control-field.mdx,description.mdx,field-error.mdx,input-group.mdx,input-otp.mdx,input.mdx,label.mdx,radio-group.mdx,search-field.mdx,select.mdx,text-area.mdx,text-field.mdx}|components/(layout):{card.mdx,separator.mdx,surface.mdx}|components/(media):{avatar.mdx}|components/(navigation):{accordion.mdx,list-group.mdx,tabs.mdx}|components/(overlays):{bottom-sheet.mdx,dialog.mdx,popover.mdx,toast.mdx}|components/(utilities):{pressable-feedback.mdx,scroll-shadow.mdx}|getting-started/(handbook):{animation.mdx,colors.mdx,composition.mdx,portal.mdx,provider.mdx,styling.mdx,theming.mdx}|getting-started/(overview):{design-principles.mdx,quick-start.mdx}|getting-started/(ui-for-agents):{agent-skills.mdx,agents-md.mdx,llms-txt.mdx,mcp-server.mdx}|releases:{beta-10.mdx,beta-11.mdx,beta-12.mdx,beta-13.mdx,rc-1.mdx,rc-2.mdx,rc-3.mdx,rc-4.mdx,v1-0-0.mdx}
<!-- HEROUI-NATIVE-AGENTS-MD-END -->
