# MCM App

[![Deploy Web](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml/badge.svg?branch=main)](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml)

App de MCM España. Expo / React Native para iOS, Android y Web.

## Configurar el entorno

```bash
# Requisitos: Node.js LTS
npm install -g eas-cli   # (el viejo expo-cli global está deprecado; usa `npx expo`)

# Clonar e instalar
git clone https://github.com/mcmespana/mcmapp.git
cd mcmapp/mcm-app
npm install
```

### Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) con Realtime Database
2. Copia `.env.example` → `.env.local` y rellena las credenciales
3. Nodos principales: `songs`, `albums`, `profileConfig`, `jubileo` y `activities/<evento>` (eventos), `surveys`. Estructura completa en `mcm-app/CLAUDE.md` §Firebase; JSONs de ejemplo importables en `mcm-app/firebase-seed/`

## Chuleta de comandos

### Desarrollo
```
npm start                          Servidor de desarrollo (QR)
npm run web                        Abrir en navegador
npm run android                    Abrir en Android
npm run ios                        Abrir en iOS (Mac)
npm run lint                       ESLint
npm run format                     Prettier
```

### Builds

> ⚠️ Usa SIEMPRE los scripts `npm run eas:build*` (limpian los symlinks
> `.agent/.agents` de skills antes de comprimir; `eas build` directo falla
> en Windows con `EPERM ... symlink`). Detalle en `mcm-app/CLAUDE.md`.

```
npm run eas:build:android -- --profile preview       APK de prueba
npm run eas:build:android -- --profile production    AAB para Play Store
npm run eas:build:ios -- --profile production        Build para App Store

eas submit -p android                                Subir a Play Store
eas submit -p ios --latest                           Subir a TestFlight
```

### Publicar web
```
npx expo export --platform web     Generar build estático
npx eas deploy --prod              Desplegar en Expo Hosting
```

### OTA Updates (sin pasar por stores)
```
eas update --branch preview --message "Descripción"
eas update --branch production --message "Descripción"
```

> En la práctica no se ejecutan a mano: GitHub Actions los dispara solos al pushear a las ramas `preview` y `production`. Ver sección "Sacar una versión nueva" más abajo.

## Sacar una versión nueva

Hay **dos tipos de release** y conviene saber cuál toca cada vez:

### 1) Release por OTA (segundos · sin tiendas)

Sirve para **cualquier cambio sólo de JS / assets / estilos**: nuevas pantallas y componentes en React, ajustes de lógica, textos, imágenes, BBCode, etc. No vale para cambios nativos (ver más abajo).

Flujo:

```
main              ← PRs se mergean aquí (rama de desarrollo)
  └─ merge →  preview         ← GH Action ota-preview.yml dispara `eas update --branch preview`
                └─ tras 1-2 días testeando →  production
                                                ← GH Action ota-production.yml dispara `eas update --branch production`
```

Pasos concretos:

1. Tu PR se mergea a `main`.
2. Cuando esté listo para probadores: `git checkout preview && git merge main && git push`. El workflow publica el OTA al canal `preview` en ~2 min. Los dispositivos suscritos (ver toggle escondido "Laboratorio Alpha") lo reciben en el siguiente check.
3. Cuando esté validado: `git checkout production && git merge main && git push`. El workflow publica al canal `production`. Todos los usuarios lo reciben en el siguiente arranque o cada 15 min con la app abierta.
4. Rollback rápido si algo va mal: `eas update:republish --branch production --group <id-anterior>` (lo puedes ejecutar con `workflow_dispatch` desde la pestaña Actions).

### 2) Release de binario (sube a App Store / Play Store)

Hace falta cuando el OTA **no es suficiente**:

- Cambias o añades una **librería con código nativo** (cualquier `expo-*` que requiera prebuild, módulos de React Native con `.podspec`, etc.).
- Subes la **versión de Expo SDK** (major).
- Cambias **permisos** (`Info.plist`, `AndroidManifest`), icono, splash, Bundle ID o entitlements.
- Bumpeas la **`runtimeVersion`** en `app.json` — eso rompe la compatibilidad OTA a propósito.
- Quieres marcar un hito visible en stores ("v1.1.0" con notas de release).

Pasos:

1. **Bumpear versiones en `mcm-app/app.json`**:
   - `expo.version` ← versión visible al usuario (ej. `1.0.1` → `1.0.2` para parches, `1.1.0` para nuevas funcionalidades, `2.0.0` para cambios mayores).
   - `expo.runtimeVersion` ← **sólo si** hay cambios nativos / cambio de SDK. Si no, déjala igual para no romper la cadena de OTAs antiguos. (`eas.json` ya tiene `appVersionSource: remote` y `autoIncrement: true`, así que el build number se gestiona solo.)
2. **Construir** desde `mcm-app/`:
   ```
   npm run eas:build:ios -- --profile production
   npm run eas:build:android -- --profile production
   ```
   Usar siempre estos scripts npm, **nunca `npx eas-cli build` directamente** — limpian los symlinks de Claude Code antes de comprimir y evitan el `EPERM` en Windows.
3. **Subir a stores**:
   ```
   eas submit -p ios --latest         # TestFlight → App Store Review
   eas submit -p android --latest     # Play Console → Producción / track interno
   ```
4. **Revisión**: Apple suele tardar 24-48h; Google a veces minutos, a veces horas. Mientras tanto, en TestFlight / Play Internal puedes probar la versión candidata.
5. Una vez publicada en stores, **commit del bump de versión a `main`** (`git add app.json && git commit -m "chore: bump to v1.0.2"`) y mergea por la cadena habitual.

### Reglas rápidas

- **¿Es sólo JS?** → OTA. Merge a `preview`, tests, merge a `production`. Fin.
- **¿Toca código nativo o sube SDK?** → Binario nuevo + bump de `version` y probablemente `runtimeVersion`.
- **¿Cambio de feature flags / textos / datos remotos?** → Ni siquiera OTA: edita `/profileConfig/data/*` en Firebase RTDB desde `mcmpanel` y los clientes lo cogen al abrir.

## Estructura del proyecto

```
mcmapp/
├── mcm-app/                  ← Código de la app (Expo)
│   ├── app/                  Pantallas y navegación (Expo Router)
│   ├── components/           Componentes reutilizables
│   ├── hooks/                Custom hooks (Firebase, canciones, calendario...)
│   ├── contexts/             Estado global (React Context)
│   ├── constants/            Colores, catálogo de perfiles, Firebase config
│   ├── utils/                Utilidades (acordes, filtros, BBCode)
│   ├── assets/               Imágenes, fuentes, JSONs locales (álbumes, wordle)
│   ├── notifications/        Sistema de notificaciones push
│   ├── services/             Servicio de push notifications
│   └── firebase-seed/        JSONs de seed/plantilla para Firebase (perfiles, encuestas, eventos)
├── docs/                     Documentación (funcionalidades, contratos, planes) — ver docs/README.md
├── scraper-lecturas/         Scraper de lecturas litúrgicas (GitHub Action)
├── portadas-albumes/         Imágenes de portadas
└── CLAUDE.md                 Guía para agentes IA (raíz)
```

## Visibilidad por perfiles

La visibilidad de tabs y secciones se controla desde Firebase RTDB (`/profileConfig`) mediante el **Sistema de Perfiles** — sin necesidad de deploy ni OTA. Ver `docs/contratos/PANEL_PERFILES.md` y la sección correspondiente de `mcm-app/CLAUDE.md`.

## Formato BBCode (contenido Materiales / Profundiza)

```
[b]negrita[/b]  [i]cursiva[/i]  [u]subrayado[/u]  [h1]Título[/h1]
[url=https://...]Enlace[/url]
[btn-primary=https://...]Botón[/btn-primary]
[color=primary]texto[/color]  (primary, accent, info, success)
[quote]cita[/quote]  [gquote]cita larga[/gquote]
[list][*]punto 1[*]punto 2[/list]  [br]
```

## Instalar como app (PWA)

Desde Safari o Chrome en el móvil, pulsa compartir → "Añadir a pantalla de inicio".

## Para agentes IA

- Lee `CLAUDE.md` en la raíz para orientación del monorepo
- Lee `mcm-app/CLAUDE.md` para la referencia técnica completa
- Índice de toda la documentación: `docs/README.md`
- Documenta cambios importantes en `mcm-app/CHANGELOG.md`
- Consulta tareas pendientes en `mcm-app/TODO.md`
