# TODO — Seccion "Contigo" · Diseno completo

> **Estado:** En diseno · **Prioridad:** Media-alta
>
> Nueva seccion principal de la app con presencia como **tab en el menu inferior**.
> Nombre: **"Contigo"**. Subtitulo: **"Propuestas para la oracion de cada dia"**.

---

## 1. Vision general

"Contigo" es un espacio de acompanamiento espiritual diario. Agrupa herramientas de oracion y seguimiento de habitos en una unica seccion con su propio tab.

### Estructura de la seccion

```
Tab "Contigo"
├── Cabecera: titulo "Contigo" + subtitulo "Propuestas para la oracion de cada dia"
├── 3 herramientas (cards de acceso):
│   ├── 1. Evangelio del Dia        ← lecturas + comentario + tracker lectura
│   ├── 2. Mi Rato de Oracion       ← tracker de oracion (duracion + emocion)
│   └── 3. Examen del Dia           ← futuro habito (placeholder por ahora)
└── Habit Tracker semanal/mensual   ← resumen visual de los 3 habitos
```

### Las 3 herramientas

| # | Herramienta | Que es | Estado |
|---|-------------|--------|--------|
| 1 | **Evangelio del Dia** | Lecturas liturgicas + comentario al evangelio + tracker de lectura integrado | A desarrollar |
| 2 | **Mi Rato de Oracion** | Registro del momento de oracion: duracion + emocion predominante | A desarrollar |
| 3 | **Examen del Dia** | Examen de conciencia diario (habito adicional) | Futuro — solo placeholder |

---

## 2. Tab "Contigo" en el menu inferior

### Nuevo tab en TABS_CONFIG

```typescript
// app/(tabs)/_layout.tsx — anadir a TABS_CONFIG
{
  name: 'contigo',
  label: 'Contigo',
  iosIcon: { default: 'heart', selected: 'heart.fill' },
  androidIcon: 'favorite',
  headerShown: false,   // usa cabecera custom dentro de la pantalla
}
```

### Orden de tabs resultante

```
Inicio → Cantoral → Contigo → Calendario → Fotos → Mas
```

> Se inserta entre Cantoral y Calendario. Si son demasiados tabs para iOS (6), evaluar si quitar "Mas" e integrar sus opciones en otro sitio, o si iOS liquid glass soporta 6.

### Feature flag

```typescript
// constants/featureFlags.ts
tabs: {
  // ...existentes
  contigo: true,     // ← NUEVO
}
```

---

## 3. Pantalla principal de "Contigo"

### 3.1 Cabecera

- **Titulo:** "Contigo" (texto grande, bold)
- **Subtitulo:** "Propuestas para la oracion de cada dia" (texto secundario, mas pequeno)
- Fondo sutil con gradiente o color suave (puede usar el color liturgico del dia como accent)

### 3.2 Cards de herramientas (3 tarjetas)

Tres cards grandes, una debajo de otra, con acceso a cada herramienta:

```
┌─────────────────────────────────────────┐
│  📖  Evangelio del Dia                   │
│  Mt 5, 1-12 · Tiempo Ordinario  🟢      │  ← cita de hoy + badge liturgico
│  ☑ Leido hoy                            │  ← estado del tracker
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🙏  Mi Rato de Oracion                 │
│  ☐ Pendiente hoy                        │  ← o "5-10 min · 😊 Alegria"
│  🔥 7 dias seguidos                      │  ← racha actual
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  🔍  Examen del Dia                      │
│  Proximamente                            │  ← placeholder, deshabilitado/gris
└─────────────────────────────────────────┘
```

Al tocar cada card → navega a la pantalla correspondiente.

### 3.3 Habit Tracker navegable (parte inferior)

Debajo de las 3 cards, un **resumen visual del tracker** que muestra los 3 habitos en conjunto:

#### Vista "Mi Semana"

Vista semanal por defecto (lunes a domingo actual):

```
Mi Semana                    🔥 Racha: 5 dias
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Lun │ Mar │ Mie │ Jue │ Vie │ Sab │ Dom │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│ ● ● │ ● ● │ ● ○ │ ● ● │ ●   │     │     │  ← hoy es viernes
│ ●   │ ●   │ ●   │ ○   │     │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
  Fila 1: ● Evangelio (leido)  ○ (no leido)
  Fila 2: ● Oracion (hecho, tamano=duracion, color=emocion)
  Fila 3: ● Examen (futuro)
```

#### Navegacion del tracker

- **Swipe horizontal** o **flechas ← →** para navegar entre semanas
- **Boton "Ver mes completo"** → expande a vista mensual (calendario con dots)
- **Al tocar un dia** → muestra detalle de ese dia (que habitos hizo, duracion, emocion)
- **Al tocar un habito** (dot de Evangelio, dot de Oracion) → navega a la pantalla de esa herramienta con ese dia seleccionado

---

## 4. Herramienta 1: Evangelio del Dia

Pantalla dedicada accesible desde la card en "Contigo" y desde el acceso directo en Home.

### 4.1 Cabecera con navegador de dias

- **Fecha actual** centrada con formato legible ("Miercoles 11 de marzo")
- **Flechas ← →** para navegar ±30 dias desde hoy
- **Badge del tiempo liturgico** debajo de la fecha:
  - Texto: "Tiempo Ordinario", "Cuaresma", "Adviento", "Pascua", "Navidad"
  - Color de fondo del badge = color liturgico del dia:
    - Verde `#3A7D44` → Tiempo Ordinario
    - Morado `#6B3FA0` → Adviento, Cuaresma
    - Blanco `#F5F5F5` (con borde sutil) → Pascua, Navidad, fiestas del Senor
    - Rojo `#C41E3A` → Pentecostes, martires, apostoles
    - Rosa `#D4A0A7` → Gaudete (3er domingo Adviento), Laetare (4o domingo Cuaresma)
  - Si hay celebracion especial (solemnidad, fiesta, memoria), mostrar su nombre bajo el badge

### 4.2 Seccion del Evangelio (destacada)

- **Card principal** con fondo sutil diferenciado (ligeramente elevada)
- Titulo: "Evangelio" + cita biblica (ej. "Mt 5, 1-12")
- Texto completo del evangelio
- **Comentario** debajo, visualmente separado (tipografia en cursiva o bloque citado)
- **Fuente del comentario** claramente indicada: "Comentario de [fuente] — [autor si aplica]"
- Enlace/link a la fuente original

### 4.3 Otras lecturas (debajo, secundarias)

Mostradas en cards mas compactas, colapsables o en acordeon:

1. **Primera Lectura** — titulo + cita + texto completo
2. **Salmo Responsorial** — antifona destacada + versos
3. **Segunda Lectura** (solo domingos y solemnidades) — titulo + cita + texto

> Sin comentario en estas lecturas. Solo el evangelio lleva comentario.

### 4.4 Tracker de lectura (integrado en esta pantalla)

Al final de la pantalla del Evangelio, un toggle sencillo:

- **"He leido el Evangelio de hoy"** — toggle/checkbox
- Al marcar, se registra en el tracker con la fecha del dia seleccionado
- Feedback visual inmediato (checkmark, animacion sutil)
- Si ya esta marcado para ese dia, mostrar checkmark verde

> Este tracker es el habito 1 y alimenta el calendario de la seccion Contigo.

---

## 5. Herramienta 2: Mi Rato de Oracion

Pantalla dedicada para registrar el momento de oracion diario.

### 5.1 Cabecera

- Titulo: "Mi Rato de Oracion"
- Fecha de hoy (con navegador ±30 dias, igual que el Evangelio)

### 5.2 Registro del habito

**Si no ha registrado oracion hoy:**

Pantalla con dos pasos:

**Paso 1 — Duracion:**
Pregunta: "¿Cuanto tiempo has dedicado hoy a la oracion?"

Opciones como botones/chips seleccionables:
- < 1 min
- 2–4 min
- 5–10 min
- 10–15 min
- \> 15 min

**Paso 2 — Emocion predominante:**
Pregunta: "¿Como te has sentido en la oracion?"

5 emociones basicas como botones con icono + color:
- Alegria → `#FCD200` (amarillo)
- Tristeza → `#31AADF` (azul)
- Enfado → `#E15C62` (rojo)
- Miedo → `#6B3FA0` (morado)
- Asco/Rechazo → `#3A7D44` (verde)

**Boton final:** "Guardar" → registra y muestra confirmacion

**Si ya ha registrado oracion hoy:**

Muestra resumen:
```
Hoy has orado 5-10 min
Te has sentido: 😊 Alegria
[Editar]
```

### 5.3 Historial visual

Debajo del registro de hoy, un mini-calendario del mes actual:
- Cada dia con dot cuyo **tamano** refleja la duracion y **color** la emocion
- Estadisticas del mes:
  - Dias con oracion: 18/28
  - Tiempo total estimado: ~2h 30min
  - Emocion mas frecuente: Alegria
  - Racha actual: 5 dias

---

## 6. Herramienta 3: Examen del Dia (futuro)

> **Estado:** Placeholder — no implementar aun, solo reservar el espacio.

Concepto: registrar si se ha hecho el examen de conciencia diario. Similar al tracker de oracion pero mas simple (quiza solo toggle hecho/no hecho + nota breve opcional).

En la card de "Contigo", mostrar:
- Icono de buscar/lupa
- Texto "Examen del Dia"
- Subtexto "Proximamente" en gris
- Card con opacidad reducida o badge "Pronto"
- No navegable (onPress deshabilitado)

---

## 7. Integracion en la Home Screen

### 7.1 Acceso directo al Evangelio del Dia

Anadir boton al grid de `quickItems` en la Home:

```typescript
{
  key: 'evangelio',
  label: 'Evangelio',
  icon: 'menu-book',          // MaterialIcons
  iconBg: '#FFF8E1',          // amarillo suave
  iconColor: '#F59E0B',       // ambar
  href: '/screens/EvangelioScreen',
}
```

### 7.2 Card resumen "Mi Semana" en Home

Card compacta que muestra el estado del tracker semanal:

```
┌─────────────────────────────────────┐
│  📖 Evangelio de hoy                │
│  "Bienaventurados los pobres..."    │ ← primeras palabras
│  Mt 5, 1-12 · Tiempo Ordinario 🟢  │
│                                     │
│  Mi Semana         🔥 5 dias        │
│  L● M● X● J● V○ S  D              │ ← dots de habitos
│  ☑ Lectura  ·  ☐ Oracion           │ ← estado de hoy
└─────────────────────────────────────┘
```

Al tocar la parte del evangelio → navega a EvangelioScreen.
Al tocar la parte del tracker → navega al tab Contigo.

---

## 8. Navegacion completa

```
RootLayout (Stack)
├── (tabs)
│   ├── index (Home)
│   │   ├── Card resumen evangelio + tracker  → EvangelioScreen / tab Contigo
│   │   └── Boton grid "Evangelio"            → EvangelioScreen
│   ├── cancionero
│   ├── contigo                               ← NUEVO TAB
│   │   ├── Cabecera "Contigo"
│   │   ├── Card → Evangelio del Dia          → EvangelioScreen
│   │   ├── Card → Mi Rato de Oracion         → OracionScreen
│   │   ├── Card → Examen del Dia (futuro)    → (deshabilitado)
│   │   └── Habit Tracker semanal/mensual
│   ├── calendario
│   ├── fotos
│   └── mas
├── screens/
│   ├── EvangelioScreen.tsx                   ← NUEVA: lecturas + tracker lectura
│   └── OracionScreen.tsx                     ← NUEVA: registro oracion
├── wordle
└── notifications
```

---

## 9. Modelo de datos (almacenamiento local)

Almacenamiento en **AsyncStorage** (local por dispositivo, sin backend por ahora):

```typescript
// Clave: '@contigo_habits'
// Valor: Record<string, DayRecord>

interface DayRecord {
  date: string;                    // '2026-03-11'

  // Habito 1: Lectura del Evangelio
  readingDone: boolean;

  // Habito 2: Rato de Oracion
  prayerDone: boolean;
  prayerDuration?: PrayerDuration;
  prayerEmotion?: Emotion;

  // Habito 3: Examen del Dia (futuro)
  examenDone?: boolean;

  timestamp: number;               // Cuando se registro/actualizo
}

type PrayerDuration =
  | 'less_than_1'    // < 1 min
  | '2_to_4'         // 2-4 min
  | '5_to_10'        // 5-10 min
  | '10_to_15'       // 10-15 min
  | 'more_than_15';  // > 15 min

type Emotion =
  | 'joy'       // Alegria  → #FCD200
  | 'sadness'   // Tristeza → #31AADF
  | 'anger'     // Enfado   → #E15C62
  | 'fear'      // Miedo    → #6B3FA0
  | 'disgust';  // Asco     → #3A7D44
```

### Hook dedicado: `useContigoHabits.ts`

```typescript
interface UseContigoHabits {
  // Lectura por dia
  getRecord(date: string): DayRecord | null;
  setReadingDone(date: string, done: boolean): void;
  setPrayerDone(date: string, duration: PrayerDuration, emotion: Emotion): void;
  setExamenDone(date: string, done: boolean): void;  // futuro

  // Estadisticas
  getStreak(habit: 'reading' | 'prayer' | 'examen'): number;
  getWeekSummary(weekStartDate: string): DayRecord[];
  getMonthStats(year: number, month: number): MonthStats;

  // Estado de hoy
  todayRecord: DayRecord | null;
}

interface MonthStats {
  readingDays: number;
  prayerDays: number;
  examenDays: number;         // futuro
  totalPrayerMinutes: number; // estimado desde PrayerDuration
  mostFrequentEmotion: Emotion | null;
  currentStreak: number;      // racha mas larga de cualquier habito
}
```

---

## 10. Modelo de datos (lecturas — consumidas desde Firebase)

```typescript
interface DailyReadings {
  date: string;                    // '2026-03-11'
  liturgicalSeason: string;        // 'Tiempo Ordinario', 'Cuaresma', etc.
  liturgicalColor: string;         // '#3A7D44' (verde), '#6B3FA0' (morado), etc.
  celebration?: string;            // 'San Jose', 'Domingo de Ramos', etc.
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
    antiphon: string;              // Antifona/respuesta
    text: string;
  };
  secondReading?: {                // Solo domingos y solemnidades
    reference: string;
    text: string;
  };
}
```

---

## 11. Archivos a crear/modificar

### Nuevos archivos

| Archivo | Descripcion |
|---------|-------------|
| `app/(tabs)/contigo.tsx` | Tab principal "Contigo" (cards + tracker semanal) |
| `app/screens/EvangelioScreen.tsx` | Pantalla de lecturas + tracker lectura |
| `app/screens/OracionScreen.tsx` | Pantalla de registro de oracion |
| `hooks/useContigoHabits.ts` | Hook de habitos (AsyncStorage, rachas, stats) |
| `hooks/useDailyReadings.ts` | Hook para consumir lecturas desde Firebase |
| `components/contigo/LiturgicalBadge.tsx` | Badge de tiempo liturgico con color |
| `components/contigo/HabitWeekView.tsx` | Vista semanal del tracker (dots) |
| `components/contigo/HabitCalendar.tsx` | Calendario mensual del tracker |
| `components/contigo/HabitDayDots.tsx` | Dots de habitos por dia (tamano + color) |
| `components/contigo/ReadingCard.tsx` | Card reutilizable para cada lectura |
| `components/contigo/PrayerLogger.tsx` | Selector de duracion + emocion |
| `components/contigo/ContigoToolCard.tsx` | Card de herramienta en la pantalla principal |
| `components/contigo/GospelHomeCard.tsx` | Card resumen para la Home |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/(tabs)/_layout.tsx` | Anadir `contigo` a `TABS_CONFIG` |
| `app/(tabs)/index.tsx` | Anadir card resumen + boton "Evangelio" al grid |
| `app/_layout.tsx` | Registrar nuevas pantallas en el Stack (EvangelioScreen, OracionScreen) |
| `constants/featureFlags.ts` | Anadir flag `contigo: boolean` en tabs |
| `constants/colors.ts` | Anadir color para TabHeaderColors.contigo si aplica |

---

## 12. Librerias recomendadas (nuevas dependencias)

| Libreria | Para que | Ya instalada |
|----------|----------|-------------|
| `react-native-calendars` | Base del calendario mensual del habit tracker | No |
| `react-native-svg` | Dots personalizados, graficos de emociones | Verificar |
| `react-native-reanimated` | Animaciones suaves del tracker | Si (Expo) |

> Minimizar dependencias nuevas. El calendario y la vista semanal del tracker podrian hacerse custom con Views si se prefiere evitar `react-native-calendars`.

---

## 13. Fases de implementacion

### Fase 1 — Estructura + Evangelio MVP (sin scraper)

- Tab `contigo` con las 3 cards (Examen deshabilitada)
- Pantalla `EvangelioScreen` con navegador de dias
- Datos mock/estaticos para probar el diseno
- Badge liturgico con colores
- Cards de lecturas (evangelio destacado + otras colapsables)
- Toggle "He leido el Evangelio" con persistencia en AsyncStorage
- Hook `useContigoHabits` basico (solo lectura)

### Fase 2 — Mi Rato de Oracion + Tracker

- Pantalla `OracionScreen` con selector duracion + emocion
- Hook `useContigoHabits` completo (lectura + oracion + rachas)
- Vista semanal "Mi Semana" en la pantalla Contigo
- Card resumen en Home
- Boton Evangelio en el grid de Home

### Fase 3 — Scraper + datos reales

- Script de scraping con cheerio (ver seccion Backend)
- GitHub Actions cron job
- Estructura en Firebase RTDB
- Hook `useDailyReadings` conectado a Firebase
- Cache offline con `useFirebaseData`

### Fase 4 — Examen del Dia

- Pantalla `ExamenScreen` (diseno por definir)
- Integrar habito 3 en el tracker y las estadisticas
- Habilitar card en Contigo

### Fase 5 — Polish

- Animaciones de entrada y transiciones
- Estadisticas ampliadas (graficos semanales, emociones)
- Vista calendario mensual completa con dots
- Heatmap tipo GitHub (opcional)
- Dark mode completo en todas las pantallas nuevas
- Accesibilidad (labels, roles)

---

---

# BACKEND — Scraping + API de lecturas

> Esta seccion documenta la infraestructura de backend necesaria para alimentar las lecturas liturgicas. Es independiente del frontend y puede implementarse en paralelo.

---

## B1. Arquitectura recomendada

```
GitHub Actions (cron 00:02 hora Espana)
  → Script Node.js (cheerio + firebase-admin)
  → Scraping de fuente principal + LitCal API
  → Escribe en Firebase Realtime Database
  → La app consume con useFirebaseData (patron existente)
```

**Por que este stack:**
- La app ya usa Firebase RTDB → cero infraestructura nueva
- GitHub Actions es gratis para repos del org
- `useFirebaseData` ya maneja cache offline → las lecturas funcionan sin conexion
- Sin necesidad de API REST separada: la app lee directamente de Firebase

## B2. Fuentes de datos

| Dato | Fuente | Metodo |
|------|--------|--------|
| Lecturas + comentario evangelio | **Ciudad Redonda** (`ciudadredonda.org/evangelio-lecturas-hoy/`) | Scraping con `cheerio` (HTML server-rendered, estructura limpia) |
| Fuente alternativa de lecturas | **Dominicos.org** (`dominicos.org/predicacion/evangelio-del-dia/hoy/`) | Scraping con `cheerio` (fallback si Ciudad Redonda falla) |
| Tiempo liturgico, color, celebracion | **LitCal API** (`litcal.johnromanodorazio.com/api/v4/calendar`) | API REST (JSON, soporta espanol, gratuita) |
| Comentario alternativo | **Evangeli.net** (`evangeli.net/evangelio/api`) | API publica (tiene endpoint y widget embeddable) |

### Otras fuentes investigadas (referencia)

| Sitio | URL | Notas |
|-------|-----|-------|
| USCCB en Espanol | `bible.usccb.org/es` | URL predecible (`/bible/readings/MMDDYY.cfm`), copyright restricto |
| Vatican News | `vaticannews.va/es/evangelio-de-hoy.html` | Evangelio + reflexion papal |
| ACI Prensa | `aciprensa.com/calendario` | Calendario liturgico con RSS |
| EWTN en Espanol | `ewtn.com/es/catolicismo/lecturas` | Lecturas + misa en directo |
| Pildoras de Fe | `pildorasdefe.net/evangelio-de-hoy` | Evangelio + audio reflexion |
| Evangelio del Dia | `evangeliodeldia.org/ES/` | Tiene RSS pero es SPA (requiere Puppeteer) |

### APIs liturgicas investigadas

| API | URL | Espanol | Datos |
|-----|-----|---------|-------|
| **LitCal API** (recomendada) | `litcal.johnromanodorazio.com/api/v4/calendar` | Si (36 idiomas) | Calendario completo, colores, celebraciones, JSON/YAML/XML |
| Church Calendar API | `calapi.inadiutorium.cz` | No (cs, en, fr, it, la) | Celebraciones, ciclo lectoral |
| Catholic Readings API | `github.com/cpbjr/catholic-readings-api` | No (ingles, espanol planeado) | Lecturas en JSON via GitHub Pages |
| Evangeli.net API | `evangeli.net/evangelio/api` | Si | Evangelio + comentario |

## B3. Estructura en Firebase RTDB

```
Firebase Realtime Database
└── lecturas_diarias/
    ├── updatedAt: timestamp
    └── data/
        ├── '2026-03-11': { ...DailyReadings }
        ├── '2026-03-12': { ...DailyReadings }
        └── ...  (rolling window de ~60 dias: 30 pasados + 30 futuros)
```

> Se usa el patron existente `useFirebaseData('lecturas_diarias', 'lecturas-cache')` para cache offline automatica.

## B4. Cron Job — GitHub Actions

```yaml
# .github/workflows/scrape-lecturas.yml
name: Scrape Lecturas Diarias
on:
  schedule:
    - cron: '2 23 * * *'    # 23:02 UTC = 00:02 hora Espana (CET)
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

**Script `scrape-lecturas.js`** (pseudocodigo):
1. Fetch HTML de Ciudad Redonda (hoy + manana)
2. Parsear con `cheerio`: extraer 1a lectura, salmo, 2a lectura, evangelio, comentario
3. Fetch LitCal API: obtener tiempo liturgico, color, celebracion
4. Componer objeto `DailyReadings`
5. Escribir en Firebase RTDB con `firebase-admin`
6. Limpiar lecturas con mas de 45 dias de antiguedad

**Dependencias del scraper:** `cheerio`, `firebase-admin`, `node-fetch` (o fetch nativo en Node 20+)

**Archivos del scraper:**

| Archivo | Descripcion |
|---------|-------------|
| `scripts/scraper/scrape-lecturas.js` | Script principal de scraping |
| `scripts/scraper/package.json` | Dependencias del scraper |
| `.github/workflows/scrape-lecturas.yml` | Workflow de GitHub Actions |

## B5. Colores liturgicos (referencia)

| Color | Espanol | Hex | Cuando se usa |
|-------|---------|-----|---------------|
| Verde | Verde | `#3A7D44` | Tiempo Ordinario |
| Morado | Morado | `#6B3FA0` | Adviento, Cuaresma, difuntos |
| Blanco | Blanco | `#F5F5F5` | Pascua, Navidad, fiestas del Senor, Virgen Maria |
| Rojo | Rojo | `#C41E3A` | Pentecostes, martires, apostoles |
| Rosa | Rosa | `#D4A0A7` | Gaudete (3er dom. Adviento), Laetare (4o dom. Cuaresma) |
| Azul | Azul | `#2B4C7E` | Inmaculada Concepcion (privilegio hispanico) |
| Dorado | Dorado | `#D4AF37` | Sustituye blanco en solemnidades especiales |

## B6. Tiempos liturgicos (orden anual)

1. **Adviento** (4 semanas antes de Navidad) — morado (rosa 3er domingo)
2. **Navidad** (Navidad al Bautismo del Senor) — blanco
3. **Tiempo Ordinario I** (Bautismo al Miercoles de Ceniza) — verde
4. **Cuaresma** (Miercoles de Ceniza al Jueves Santo) — morado (rosa 4o domingo)
5. **Triduo Pascual** (Jueves Santo noche al Domingo de Resurreccion) — blanco, rojo, blanco
6. **Tiempo Pascual** (Pascua a Pentecostes, 50 dias) — blanco (rojo en Pentecostes)
7. **Tiempo Ordinario II** (despues de Pentecostes hasta Adviento) — verde

## B7. Atribucion y copyright

- Las lecturas se publican libremente para uso pastoral en las fuentes seleccionadas
- **Siempre mostrar** la fuente del comentario con enlace al original
- Considerar anadir nota: "Lecturas del leccionario oficial. Comentario cortesia de [fuente]"
