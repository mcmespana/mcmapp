# COBERTURA.md — Subir tests cuando sobran créditos

> **Para qué es esto:** cuando el usuario dice _"me sobran créditos, ponte a
> subir cobertura"_, este documento ES la tarea. No hay que preguntar nada, no
> hay que priorizar nada, no hay que leer ningún plan. Se sigue la receta de
> abajo tal cual, de arriba abajo.
>
> Es una tarea **mecánica y segura**: solo se añaden ficheros a
> `mcm-app/__tests__/`. Está pensada para Sonnet.

---

## Regla de oro

**NO se toca código de producción.** Ni para "arreglarlo de paso", ni para
hacerlo más testeable, ni para renombrar nada. Si un test no se puede escribir
sin cambiar el código, ese fichero se salta y se pasa al siguiente. Se apunta
al final en el mensaje del commit y ya.

Excepciones: ninguna. Si crees que has encontrado un bug de verdad, escríbelo
en la respuesta al usuario y sigue con el siguiente fichero.

---

## Receta (haz esto, en este orden)

### 1. Mide

```bash
cd mcm-app
npm ci            # solo si no hay node_modules
npm run test:coverage
```

Al final salen dos cosas: una tabla por fichero y un resumen. Anota el % de
**Statements** del resumen: ese es el número que hay que subir.

### 2. Elige los 2 o 3 ficheros peores

De la tabla, coge los que tengan **más líneas sin cubrir** (columna
`Uncovered Line #s` larga y `% Stmts` bajo). Con esto sale la lista ordenada:

```bash
node -e "const s=require('./coverage/coverage-summary.json');
Object.entries(s).filter(([k])=>k!=='total')
 .map(([k,v])=>({f:k.split('/mcm-app/')[1],p:v.statements.pct,m:v.statements.total-v.statements.covered}))
 .sort((a,b)=>b.m-a.m).slice(0,15)
 .forEach(r=>console.log(String(r.m).padStart(4),String(r.p).padStart(6),r.f))"
```

**Salta siempre:**

- `hooks/useWordle*` — el Wordle está desactivado y no se toca (ya está fuera
  del cálculo, no debería ni aparecer).
- Ficheros que sean casi todo animación de Reanimated (`useAutoScroller`,
  scrollers): son worklets, no se testean bien y no compensa.
- Lo que ya esté por encima del 80%.

### 3. Escribe el test

Ponlo en `mcm-app/__tests__/<nombreDelFichero>.test.ts` (o `.tsx` si hay JSX).
Copia el estilo de los que ya hay: cabecera de comentario **en español**
explicando _qué se rompe si esto falla_, y los `it(...)` también en español.

Las tres formas que ya funcionan en este repo, con ejemplo a mano:

| Qué estás testeando                | Ejemplo a copiar                            |
| ---------------------------------- | ------------------------------------------- |
| Función pura de `utils/`           | `__tests__/dateUtils.test.ts`               |
| Un hook                            | `__tests__/useCalendarConfigs.test.ts`      |
| Un contexto con provider           | `__tests__/settingsContexts.test.tsx`       |
| Un servicio que habla con Firebase | `__tests__/pushNotificationService.test.ts` |

### 4. Ejecuta solo tu fichero hasta que pase

```bash
npx jest __tests__/loQueSea.test.ts
```

### 5. Cierra

```bash
npm test                 # todo verde
npx tsc --noEmit -p tsconfig.test.json
npm run lint             # sin warnings NUEVOS (los 51 conocidos se quedan)
npm run test:coverage    # anota el % nuevo
```

Commit con el % antes → después en el cuerpo. Sin entrada en el CHANGELOG:
añadir tests no es un cambio funcional.

---

## Trampas de este repo (te vas a chocar con ellas)

Están todas resueltas en los tests que ya existen; si algo no funciona, casi
seguro es una de estas cinco:

1. **`renderHook` y `rerender` son ASÍNCRONOS.** Siempre
   `const { result } = await renderHook(...)`. Y `await act(async () => ...)`,
   nunca `act(() => ...)` a secas — si no, el estado no se actualiza y, peor,
   el test SIGUIENTE monta en falso y falla sin motivo aparente.

2. **Las variables que usa un `jest.mock(...)` tienen que llamarse `mockAlgo`.**
   Jest rechaza cualquier otro nombre ("out-of-scope variables").

3. **`process.env.X = undefined` guarda la cadena `"undefined"`.** Para apagar
   una variable de entorno hay que hacer `delete process.env.X`.

4. **Módulos con estado propio** (tokens cacheados, colas en memoria): si un
   test necesita empezar de cero, `jest.resetModules()` + `require(...)` dentro
   del propio test.

5. **Firebase y AsyncStorage ya están mockeados** en `__mocks__/` (los mapea
   `jest.config.js`). No montes tu propio mock: usa `__setMockNode` para los
   nodos, o `(get as jest.Mock).mockResolvedValue(...)` para un fetch suelto.

---

## Qué cuenta y qué no

`jest.config.js` (`collectCoverageFrom`) mide **solo la lógica**: `utils/`,
`hooks/`, `services/`, `contexts/` y `constants/`. Las pantallas (`app/`) y los
componentes (`components/`) no cuentan a propósito — testear render de UI es
caro y frágil, y el valor está en blindar reglas que se pueden romper sin
enterarse (el razonamiento largo, en `docs/planes/PLAN_CALIDAD.md` §0).

Objetivo razonable: **70% de sentencias** — ya superado. Estado el
2026-08-22: **87.9%** (partiendo del 44% en agosto, 59% el 2026-08-15, 72%
y 77% más tarde ese mismo día, 79.5% el 2026-08-20). Lo que queda sin cubrir
es en su mayoría justo lo que esta guía dice que hay que saltarse: animación
de Reanimated (`useAutoScroller`, `AppToastContext`), WebView
(`useComunicaWebView`), y utilidades de estilo/tema sin lógica real
(`colorUtils`, `fontUtils`, `heroUIRuntimeTheme`).

`hooks/useShakeDetector.ts` se quedó parcial a propósito: su lógica real vive
detrás de un `import('expo-sensors')` dinámico que, bajo Jest, no se
transforma a CommonJS (mismo problema ya documentado en
`platformAuthNative.test.ts`) y nunca resuelve al mock — solo se testean las
guardas de plataforma/`enabled`.
