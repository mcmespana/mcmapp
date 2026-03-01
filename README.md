# MCM App

[![Deploy Web](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml/badge.svg?branch=main)](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml)

App de MCM España. Expo / React Native para iOS, Android y Web.

## Configurar el entorno

```bash
# Requisitos: Node.js LTS
npm install -g expo-cli eas-cli

# Clonar e instalar
git clone https://github.com/mcmespana/mcmapp.git
cd mcmapp/mcm-app
npm install
```

### Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) con Realtime Database
2. Copia `.env.example` → `.env.local` y rellena las credenciales
3. Nodos necesarios: `songs`, `albums`, `jubileo` (con `horario`, `materiales`, `visitas`, `profundiza`, `grupos`, `contactos`)

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
```
eas build -p android --profile preview              APK de prueba
eas build -p android --profile production            AAB para Play Store
eas build -p android --profile development --local   Build local dev

eas build -p ios --profile production                Build para App Store
eas build -p ios --profile production --auto-submit  Build + subir a TestFlight

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

## Estructura del proyecto

```
mcmapp/
├── mcm-app/                  ← Código de la app (Expo)
│   ├── app/                  Pantallas y navegación (Expo Router)
│   ├── components/           Componentes reutilizables
│   ├── hooks/                Custom hooks (Firebase, canciones, calendario...)
│   ├── contexts/             Estado global (React Context)
│   ├── constants/            Colores, feature flags, Firebase config
│   ├── utils/                Utilidades (acordes, filtros, BBCode)
│   ├── assets/               Imágenes, fuentes, canciones (.cho)
│   ├── notifications/        Sistema de notificaciones push
│   └── services/             Servicio de push notifications
├── portadas-albumes/         Imágenes de portadas
├── AGENTS.md                 Definición de agentes IA
├── CLAUDE.md                 Guía para agentes IA (raíz)
└── NOTIS_*.md                Documentación de notificaciones
```

## Feature flags

En `mcm-app/constants/featureFlags.ts` se controlan las pestañas y funcionalidades visibles. Se pueden cambiar y desplegar via OTA update sin nuevo build (ver `mcm-app/FEATURE_FLAGS_OTA.md`).

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
- Documenta cambios importantes en `mcm-app/CHANGELOG.md`
- Consulta tareas pendientes en `mcm-app/TODO.md`
