# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Marcad como completadas las tareas que terminéis.

---

## Completado recientemente

- [x] ~~Activar pestaña Cantoral~~ → `cancionero: true` en `constants/featureFlags.ts`
- [x] ~~Limpiar ReportBugsModal\* muertos~~ → eliminados New, Fixed, Simple, .bak, .broken, .complex (el principal sigue en uso por SongControls.tsx)
- [x] ~~Eliminar scripts de debug y configs de test~~ → eliminados test-\*.js, jest.config.js
- [x] ~~Mover eslint-config-expo a devDependencies~~ → hecho en package.json
- [x] ~~Eliminar dotenv~~ → solo se usaba en test-firebase.js (eliminado). Expo carga .env nativamente
- [x] ~~Añadir ErrorBoundary global~~ → `components/ErrorBoundary.tsx` envolviendo RootLayout
- [x] ~~Mejorar splash screen~~ → reducido de 1.5s a 0.9s (3 repeticiones en vez de 4)
- [x] ~~Consolidar documentación NOTIS\_\*.md~~ → unificado en `NOTIFICACIONES.md` en la raíz
- [x] ~~Eliminar agents.md duplicado~~ → mantenemos solo `AGENTS.md`
- [x] ~~Verificar bug de IDs de notificaciones~~ → ya estaba corregido (usa `data?.id || identifier`)
- [x] ~~Notificaciones — mejoras del cliente~~ → NotificationsContext, suscripción real-time, modal detalle, marcar todas como leídas, iOS action buttons
- [x] ~~Pre-commit hooks~~ → husky + lint-staged en raíz del monorepo (Prettier)
- [x] ~~Actualizar dependencias~~ → todas al máximo dentro de Expo SDK 54 (`npm update`)
- [x] ~~Accesibilidad~~ → `accessibilityLabel` y `accessibilityRole` en Home y Notificaciones
- [x] ~~Dark mode~~ → corregidos ErrorBoundary, SongFullscreen, Comida, Monitores, Wordle, Reflexiones
- [x] ~~Performance Home~~ → `React.memo()` en ContextualDecoration, `useRef` para animaciones

---

## Prioridad alta (hacer pronto)

- [ ] **Upgrade a Expo SDK 55**: actualizar expo y todos los paquetes expo-\* a la versión 55. Requiere `npx expo install --fix` y testing completo. React Native 0.81→0.84, React 19.1→19.2. Ver `npm outdated` para la lista completa.
- [ ] **Firebase 11 → 12**: major version upgrade. Revisar [guía de migración](https://firebase.google.com/support/release-notes/js) antes de actualizar. Puede haber breaking changes en la API.
- [ ] **Seguridad — contraseña hardcodeada**: en `components/SecretPanelModal.tsx` la contraseña "coco" está en el código. Mover a variable de entorno o Firebase Remote Config.
- [ ] **Verificar orden de tabs con cantoral activo**: ahora que `cancionero: true`, probar en dispositivo que TABS_CONFIG muestra los tabs en el orden correcto (Inicio → Cantoral → Calendario → Fotos → Más).

## Prioridad media (mejoras importantes)

- [ ] **Evangelio del Día + Habit Tracker espiritual** — nueva funcionalidad completa. **Ver diseño detallado más abajo en la sección dedicada.**

- [ ] **Pantalla de inicio (Home)**: rediseñar la home screen (ver sección Ideas más abajo).
- [ ] **Notificaciones — backend (panel admin)**: en desarrollo en `mcmespana/mcmpanel`. La app (cliente) ya está lista para recibir notificaciones. Ver `NOTIFICACIONES.md` para la especificación del backend y formato de mensajes Expo Push.
- [ ] **Sistema de perfiles de usuario**: onboarding con selección de perfil (Familia / Monitor/a / Miembro MCM) + delegación local. Config remota en Firebase RTDB que controla tabs, home, calendarios, álbumes y notificaciones por perfil/delegación. Absorbe y reemplaza el sistema de feature flags actual. **Ver `TODO_SISTEMA_PERFILES.md` para el diseño técnico completo.**
- [ ] **Firebase Remote Config para feature flags**: ~~actualmente los flags están hardcodeados en `constants/featureFlags.ts`~~. **NOTA**: este punto queda absorbido por el sistema de perfiles (ver arriba). La config remota se haría via Firebase RTDB con el patrón `useFirebaseData` existente, no con Remote Config SDK.
- [ ] **Configurar tests**: cuando se retome testing, instalar jest-expo, @testing-library/react-native, crear jest.config.js. Priorizar tests para utils/ y hooks/.

## Prioridad baja (nice to have)

- [ ] **Limpiar carpeta `(tabsdesactivados)/`**: decidir si eliminar o mantener `comunica.tsx` como referencia.
- [ ] **Accesibilidad — ampliar cobertura**: las pantallas principales (Home, Notificaciones) ya tienen labels. Falta cubrir el resto de pantallas (Cantoral, Calendario, Fotos, Reflexiones, etc.).
- [ ] **Borrar rama `origin/notificaciones`**: es un artefacto histórico, todo está superado por main.
- [ ] **Notificaciones — mejoras extra (Fase 3)**: agrupación por fecha, filtros/búsqueda, notificaciones programadas, segmentación por plataforma. Ver `NOTIFICACIONES.md`.

---

## Ideas para la Home Screen

La home actual es un grid de botones de colores con animaciones de entrada. Funciona, pero es muy estática y no aporta información útil al usuario.

### Opción A: Home con contenido dinámico (recomendada)

- **Próximo evento** del calendario (tarjeta destacada arriba)
- **Accesos rápidos** a las secciones (grid más compacto)
- **Canción del día / canción destacada** (si el cantoral está activo)
- **Wordle pendiente** con indicador visual más claro
- **Último contenido actualizado** (materiales, reflexiones)

### Opción B: Home tipo dashboard

- Saludo personalizado ("Hola, [nombre]" si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido
- Acciones frecuentes como FAB (botón flotante)

### Opción C: Home minimalista

- Logo MCM grande arriba
- Lista simple de secciones con subtítulo informativo
- Barra de búsqueda global
- Sin animaciones pesadas

**Recomendación:** La **Opción A** es la más equilibrada. El próximo evento del calendario y la canción destacada son los ganchos más fuertes para que el usuario abra la app.

---

## Evangelio del Día + Habit Tracker Espiritual — Diseño completo

> **Estado:** En diseño · **Prioridad:** Media-alta
>
> Funcionalidad que combina las lecturas litúrgicas diarias con un sistema de seguimiento de hábitos espirituales (lectura de la Palabra y oración).

---

### 1. Visión general

Dos componentes principales que conviven en una misma experiencia:

| Componente | Qué es | Dónde vive |
|------------|--------|------------|
| **Evangelio del Día** | Pantalla con las lecturas litúrgicas + comentario al evangelio | Pantalla dedicada (nueva) |
| **Habit Tracker** | Seguimiento de 2 hábitos: lectura y oración | Integrado en la misma pantalla + resumen en Home |

---

### 2. Pantalla principal: Evangelio del Día

#### 2.1 Cabecera con navegador de días

- **Fecha actual** centrada con formato legible ("Miércoles 11 de marzo")
- **Flechas ← →** para navegar ±30 días desde hoy
- **Badge del tiempo litúrgico** debajo de la fecha:
  - Texto: "Tiempo Ordinario", "Cuaresma", "Adviento", "Pascua", "Navidad"
  - Color de fondo del badge = color litúrgico del día:
    - 🟢 Verde `#3A7D44` → Tiempo Ordinario
    - 🟣 Morado `#6B3FA0` → Adviento, Cuaresma
    - ⚪ Blanco `#F5F5F5` (con borde sutil) → Pascua, Navidad, fiestas del Señor
    - 🔴 Rojo `#C41E3A` → Pentecostés, mártires, apóstoles
    - 🩷 Rosa `#D4A0A7` → Gaudete (3er domingo Adviento), Laetare (4º domingo Cuaresma)
  - Si hay celebración especial (solemnidad, fiesta, memoria), mostrar su nombre bajo el badge

#### 2.2 Sección del Evangelio (destacada)

- **Card principal** con fondo sutil diferenciado (ligeramente elevada)
- Título: "Evangelio" + cita bíblica (ej. "Mt 5, 1-12")
- Texto completo del evangelio
- **Comentario** debajo, visualmente separado (tipografía en cursiva o bloque citado)
- **Fuente del comentario** claramente indicada: "Comentario de [fuente] — [autor si aplica]"
- Enlace/link a la fuente original

#### 2.3 Otras lecturas (debajo, secundarias)

Mostradas en cards más compactas, colapsables o en acordeón:

1. **Primera Lectura** — título + cita + texto completo
2. **Salmo Responsorial** — antífona destacada + versos
3. **Segunda Lectura** (solo domingos y solemnidades) — título + cita + texto

> Sin comentario en estas lecturas. Solo el evangelio lleva comentario.

#### 2.4 Sección de Hábitos del día (parte inferior)

Dos cards/botones de acción al final de la pantalla:

**Hábito 1 — Lectura de la Palabra:**
- Toggle simple: ✅ Leído / ⬜ No leído
- Al marcar, se registra la fecha
- Visual: checkbox bonito o toggle switch

**Hábito 2 — Momento de Oración:**
- Toggle: Hecho / No hecho
- Si hecho, selector de **duración**:
  - < 1 min
  - 2–4 min
  - 5–10 min
  - 10–15 min
  - \> 15 min
- Selector de **emoción predominante** (las 5 básicas):
  - 😊 Alegría → `#FCD200` (amarillo)
  - 😢 Tristeza → `#31AADF` (azul)
  - 😡 Enfado → `#E15C62` (rojo)
  - 😨 Miedo → `#6B3FA0` (morado)
  - 🤢 Asco/Rechazo → `#3A7D44` (verde)

---

### 3. Habit Tracker — Visualización calendario

#### 3.1 Vista principal del tracker

Debajo de los botones de hábitos del día (o accesible via scroll/tab), un **calendario visual tipo heatmap** que muestra el historial:

**Diseño recomendado: Calendario mensual con dots apilados**

- Vista de mes (grid 7×5 estándar)
- Cada celda de día muestra **dos indicadores verticales** (uno por hábito):
  - **Dot superior** = Lectura de la Palabra (lleno si leído, vacío si no)
  - **Dot inferior** = Momento de Oración:
    - **Tamaño del dot** proporcional a la duración:
      - Pequeño (4px): < 1 min
      - Mediano (7px): 2–10 min
      - Grande (10px): 10–15 min
      - Extra grande (13px): > 15 min
    - **Color del dot** = emoción predominante registrada
  - Días sin registro: dots con borde punteado o vacíos
  - Día actual: anillo/borde destacado

**Navegación del calendario:**
- Swipe horizontal para cambiar de mes
- Indicador de racha (streak) actual: "🔥 7 días seguidos"

#### 3.2 Estadísticas rápidas (cards encima del calendario)

- **Racha actual** de lectura (días consecutivos)
- **Racha actual** de oración
- **Días este mes** con lectura / con oración
- **Tiempo total de oración** este mes
- **Emoción más frecuente** del mes (con su color)

#### 3.3 Vista alternativa: Heatmap tipo GitHub (opcional, fase 2)

- Grid horizontal de 7 filas × 13 columnas (3 meses)
- Intensidad del color = duración de oración
- Toggle entre vista mensual y vista heatmap

---

### 4. Integración en la Home Screen

#### 4.1 Resumen compacto en Home

Añadir una **card resumen** en la Home (encima del grid de botones o como sección nueva):

```
┌─────────────────────────────────────┐
│  📖 Evangelio de hoy                │
│  "Bienaventurados los pobres..."    │ ← primeras palabras
│  Mt 5, 1-12 · Tiempo Ordinario 🟢  │
│                                     │
│  📊 Hábitos    🔥 7 días            │
│  ☑ Lectura  ·  ☐ Oración           │ ← estado de hoy
└─────────────────────────────────────┘
```

Al tocar → navega a la pantalla completa del Evangelio.

#### 4.2 Nuevo botón en el grid de accesos rápidos

Añadir un 5º botón al grid de `quickItems` en la Home:

```typescript
{
  key: 'evangelio',
  label: 'Evangelio',
  icon: 'menu-book',          // MaterialIcons
  iconBg: '#FFF8E1',          // amarillo suave
  iconColor: '#F59E0B',       // ámbar
  href: '/screens/EvangelioScreen',
}
```

> **Decisión de diseño:** No crear un tab nuevo. Mejor como pantalla accesible desde Home (botón en grid + card resumen). Mantener los 5 tabs actuales (Inicio, Cantoral, Calendario, Fotos, Más). Si más adelante crece mucho, podría promoverse a tab.

---

### 5. Navegación propuesta

```
RootLayout (Stack)
├── (tabs)
│   └── index (Home)
│       ├── Card resumen Evangelio  → navega a EvangelioScreen
│       └── Botón grid "Evangelio"  → navega a EvangelioScreen
├── screens/
│   └── EvangelioScreen.tsx         ← NUEVA pantalla principal
│       ├── Navegador de días (±30)
│       ├── Lecturas del día
│       ├── Hábitos del día
│       └── Calendario habit tracker
```

---

### 6. Modelo de datos (almacenamiento local)

Almacenamiento en **AsyncStorage** (local por dispositivo, sin backend por ahora):

```typescript
// Clave: '@gospel_habits'
// Valor: Record<string, DayRecord>

interface DayRecord {
  date: string;                    // '2026-03-11'
  readingDone: boolean;            // Hábito 1: ¿leyó?
  prayerDone: boolean;             // Hábito 2: ¿oró?
  prayerDuration?: PrayerDuration; // Duración si oró
  prayerEmotion?: Emotion;         // Emoción si oró
  timestamp: number;               // Cuándo se registró
}

type PrayerDuration =
  | 'less_than_1'    // < 1 min
  | '2_to_4'         // 2-4 min
  | '5_to_10'        // 5-10 min
  | '10_to_15'       // 10-15 min
  | 'more_than_15';  // > 15 min

type Emotion =
  | 'joy'       // 😊 Alegría  → #FCD200
  | 'sadness'   // 😢 Tristeza → #31AADF
  | 'anger'     // 😡 Enfado   → #E15C62
  | 'fear'      // 😨 Miedo    → #6B3FA0
  | 'disgust';  // 🤢 Asco     → #3A7D44
```

**Hook dedicado:** `useGospelHabits.ts`
- `getRecord(date)` / `setRecord(date, data)`
- `getStreak(habit)` → racha actual
- `getMonthStats(year, month)` → resumen mensual
- Persiste en AsyncStorage con clave `@gospel_habits`

---

### 7. Modelo de datos (lecturas — consumidas desde API)

```typescript
interface DailyReadings {
  date: string;                    // '2026-03-11'
  liturgicalSeason: string;        // 'Tiempo Ordinario', 'Cuaresma', etc.
  liturgicalColor: string;         // '#3A7D44' (verde), '#6B3FA0' (morado), etc.
  celebration?: string;            // 'San José', 'Domingo de Ramos', etc.
  gospel: {
    reference: string;             // 'Mt 5, 1-12'
    text: string;                  // Texto completo
    commentary: string;            // Comentario al evangelio
    commentarySource: string;      // 'Ciudad Redonda', 'Dominicos.org', etc.
    commentaryAuthor?: string;     // Autor del comentario si aplica
    commentaryUrl: string;         // URL de la fuente original
  };
  firstReading: {
    reference: string;
    text: string;
  };
  psalm: {
    reference: string;
    antiphon: string;              // Antífona/respuesta
    text: string;
  };
  secondReading?: {                // Solo domingos y solemnidades
    reference: string;
    text: string;
  };
}
```

---

### 8. Backend: Scraping + API de lecturas

#### 8.1 Arquitectura recomendada

```
GitHub Actions (cron 00:02 hora España)
  → Script Node.js (cheerio + firebase-admin)
  → Scraping de fuente principal + LitCal API
  → Escribe en Firebase Realtime Database
  → La app consume con useFirebaseData (patrón existente)
```

**¿Por qué este stack?**
- La app ya usa Firebase RTDB → cero infraestructura nueva
- GitHub Actions es gratis para repos del org
- `useFirebaseData` ya maneja caché offline → las lecturas funcionan sin conexión
- Sin necesidad de API REST separada: la app lee directamente de Firebase

#### 8.2 Fuentes de datos

| Dato | Fuente | Método |
|------|--------|--------|
| Lecturas + comentario evangelio | **Ciudad Redonda** (`ciudadredonda.org/evangelio-lecturas-hoy/`) | Scraping con `cheerio` (HTML server-rendered, estructura limpia) |
| Fuente alternativa de lecturas | **Dominicos.org** (`dominicos.org/predicacion/evangelio-del-dia/hoy/`) | Scraping con `cheerio` (fallback si Ciudad Redonda falla) |
| Tiempo litúrgico, color, celebración | **LitCal API** (`litcal.johnromanodorazio.com/api/v4/calendar`) | API REST (JSON, soporta español, gratuita) |
| Comentario alternativo | **Evangeli.net** (`evangeli.net/evangelio/api`) | API pública (tiene endpoint y widget embeddable) |

#### 8.3 Estructura en Firebase RTDB

```
Firebase Realtime Database
└── lecturas_diarias/
    ├── updatedAt: timestamp
    └── data/
        ├── '2026-03-11': { ...DailyReadings }
        ├── '2026-03-12': { ...DailyReadings }
        └── ...  (rolling window de ~60 días: 30 pasados + 30 futuros)
```

> Se usa el patrón existente `useFirebaseData('lecturas_diarias', 'lecturas-cache')` para caché offline automática.

#### 8.4 Cron Job — GitHub Actions

```yaml
# .github/workflows/scrape-lecturas.yml
name: Scrape Lecturas Diarias
on:
  schedule:
    - cron: '2 23 * * *'    # 23:02 UTC = 00:02 hora España (CET)
  workflow_dispatch:          # Trigger manual para testing/backfill

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: scripts/scraper
      - run: node scrape-lecturas.js
        working-directory: scripts/scraper
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

**Script `scrape-lecturas.js`** (pseudocódigo):
1. Fetch HTML de Ciudad Redonda (hoy + mañana)
2. Parsear con `cheerio`: extraer 1ª lectura, salmo, 2ª lectura, evangelio, comentario
3. Fetch LitCal API: obtener tiempo litúrgico, color, celebración
4. Componer objeto `DailyReadings`
5. Escribir en Firebase RTDB con `firebase-admin`
6. Limpiar lecturas con más de 45 días de antigüedad

**Dependencias del scraper:** `cheerio`, `firebase-admin`, `node-fetch` (o fetch nativo en Node 20+)

#### 8.5 Atribución y copyright

- Las lecturas se publican libremente para uso pastoral en las fuentes seleccionadas
- **Siempre mostrar** la fuente del comentario con enlace al original
- Considerar añadir nota: "Lecturas del leccionario oficial. Comentario cortesía de [fuente]"

---

### 9. Archivos a crear/modificar (estimación)

#### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `app/screens/EvangelioScreen.tsx` | Pantalla principal (lecturas + hábitos + calendario) |
| `hooks/useGospelHabits.ts` | Hook de hábitos (AsyncStorage, rachas, stats) |
| `hooks/useDailyReadings.ts` | Hook para consumir lecturas desde Firebase |
| `components/LiturgicalBadge.tsx` | Badge de tiempo litúrgico con color |
| `components/HabitCalendar.tsx` | Calendario visual del habit tracker |
| `components/HabitDayDots.tsx` | Dots de hábitos por día (tamaño + color) |
| `components/ReadingCard.tsx` | Card reutilizable para cada lectura |
| `components/PrayerLogger.tsx` | Selector de duración + emoción |
| `components/GospelHomeCard.tsx` | Card resumen para la Home |
| `scripts/scraper/scrape-lecturas.js` | Script de scraping (GitHub Actions) |
| `scripts/scraper/package.json` | Dependencias del scraper |
| `.github/workflows/scrape-lecturas.yml` | Workflow de GitHub Actions |

#### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/(tabs)/index.tsx` | Añadir card resumen + botón "Evangelio" al grid |
| `app/_layout.tsx` | Registrar nueva pantalla en el Stack |
| `constants/featureFlags.ts` | Añadir flag `evangelio: boolean` |

---

### 10. Librerías recomendadas (nuevas dependencias)

| Librería | Para qué | Ya instalada |
|----------|----------|-------------|
| `react-native-calendars` | Base del calendario mensual del habit tracker | No |
| `react-native-svg` | Dots personalizados, iconos de emoción | Verificar |
| `react-native-reanimated` | Animaciones suaves del tracker | Sí (Expo) |

> Minimizar dependencias nuevas. El calendario del tracker podría hacerse custom con Views si se prefiere evitar `react-native-calendars`.

---

### 11. Fases de implementación sugeridas

**Fase 1 — MVP lecturas (sin scraper):**
- Pantalla `EvangelioScreen` con navegador de días
- Datos mock/estáticos para probar el diseño
- Badge litúrgico con colores
- Cards de lecturas (evangelio destacado + otras)
- Botón en Home

**Fase 2 — Habit tracker:**
- Hook `useGospelHabits` con AsyncStorage
- Toggle de lectura + logger de oración (duración + emoción)
- Calendario visual con dots
- Card resumen en Home con rachas

**Fase 3 — Scraper + datos reales:**
- Script de scraping con cheerio
- GitHub Actions cron job
- Estructura en Firebase RTDB
- Hook `useDailyReadings` conectado a Firebase
- Caché offline con `useFirebaseData`

**Fase 4 — Polish:**
- Animaciones de entrada y transiciones
- Estadísticas ampliadas (gráficos semanales, emociones)
- Vista heatmap tipo GitHub (opcional)
- Dark mode completo
- Accesibilidad

---

## Conexión Firebase para agentes IA

### Opción 1: Firebase Admin SDK (recomendada)

1. Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Guardar como `firebase-admin-key.json` en la raíz (NUNCA commitear)
3. Añadir a `.gitignore`: `firebase-admin-key.json`
4. Crear script `scripts/firebase-admin.ts` que use el Admin SDK
5. Los agentes usan ese script para leer/escribir datos

### Opción 2: REST API de Firebase

```bash
# Lectura (si rules permiten .read: true)
curl https://[PROJECT_ID].firebaseio.com/songs.json
```

### Opción 3: .env.local con credenciales web

- Crear `.env.local` siguiendo `.env.example`
- Limitación: solo permite lo que las Security Rules permitan
