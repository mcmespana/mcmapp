# 12 — Mis datos

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 01, 03, 11 ·
> **Tamaño:** L · **Índice:** [README.md](README.md)
>
> 🔒 La foto depende en parte de la tarjeta `fotos-documentos` (plan 09): mientras no esté, va con lo
> que ya hay (§Foto).

## Para qué y para quién

Los datos de la persona que se ve, en nativo: **«Mis datos»** (uno mismo) y, para una familia,
**«Datos de Lucía»** de cada hijo. Identidad (solo lectura, salvo tres campos), contacto, dirección,
foto, el bloque MCM (solo miembros), información sanitaria y autorizaciones legales. Una sola pantalla
para las tres audiencias del plan 11 (`member`, `child`, `guardian`), como en el plugin
(`single_stic_comunica_perfil.php` l. 10-24). Los datos de monitor van aparte (plan 09).

## Especificación de origen

En `/home/user/comunicaAreaPrivada/`; manda el código.

| Qué | Dónde |
|---|---|
| Campos, orden, etiquetas, ayudas, notas, secciones por audiencia | `pages/single_stic_comunica_perfil.php` (entera) |
| Guardado: id de la sesión, lista blanca firmada, año, foto, certificados | `inc/stic-action.php` l. 1726-1883 (`upload_file_to_record`, `sticpa_apply_year_only_fields`, `prefix_comunica_save_contact`) |
| Listas blanca y negra | `inc/stic-security.php` l. 120-295 |
| Motor: tipos, opción vacía, `yearOnly`, `help`/`hint`/`note`, condicionales | `inc/stic-formController.php` l. 1-40 y 213-470; `js/stic-ui.js` l. 559-610 |
| Recortador | `js/stic-cropper.js` (entero) |
| Bloqueado y explicado (✱) | `css/custom-style.css` §27 (l. 2715-2765); `design.md` del plugin §6.5 |
| Validación del documento | `js/stic-utils.js` l. 279-308 (`validateId`) |
| Valores de los desplegables | `docs/comunica/CAMPOS.md` §1 (MCM, RGPD, Autorizaciones, Información sanitaria), §2 (identidad), §4 (región) |
| Las otras páginas de datos | `pages/single_stic_profile.php`, `single_stic_tutor_profile.php`, `single_stic_comunica_laico.php`; el rebote del pago, `single_stic_payment_form.php` l. 60-80 |

## Pantallas y rutas

| Ruta (en `app/(tabs)/comunica/`) | Qué |
|---|---|
| `datos/[pid].tsx` | «Mis datos» (`pid` = uno mismo) o «Datos de Lucía». Pantalla **personal** para el selector del plan 11 (cambiar de hijo aquí lleva a la portada). Parámetro `completar=pago` (§Comportamiento, 9) |
| `datos/foto.tsx` | Encuadrar la foto (modal a pantalla completa). Parámetros `pid` y el archivo elegido |

Código: `components/comunica/datos/` (`PhotoBlock`, `CropView`, `ConsentRow`); `hooks/comunica/`
(`usePersonDetails`, `useHealth`, `useSaveDetails`, `usePhotoUpload`); `utils/comunica/`
(`personDetailsSpec.ts`, `personDetails.ts`, `documentId.ts`, `crop.ts`).

**El motor de formularios (decisión): sí, pequeño y encima de lo del plan 09.** El 09 ya define las
piezas en `components/comunica/comun/form/` (`FormSection`, `FormField`, `SelectField`,
`CheckListField`, `SwitchField`, `OptionCards`, `FileField`, `LockedRow`, `HelpSheet`); no se abre
otra carpeta. Este plan añade la capa declarativa, porque aquí son siete secciones, tres audiencias y
condicionales, y declararlas es lo que deja comprobar con un test que el orden y los textos son los del
plugin:

- `utils/comunica/forms.ts` (puro): `FieldSpec { key, kind, label, help?, hint?, visibleWhen?,
  optionsKey?, autoComplete?, maxLength?, onlyIfPresent? }` con `kind` ∈ `text | email | phone |
  postalCode | year | textarea | select | consent | locked | note`; `SectionSpec { id, title, note?,
  fields }`; `visibleFields(spec, values)`, `formChanges(spec, confirmed, draft)` (solo lo que cambia)
  y `validateForm(spec, values)`.
- `comun/form/DeclarativeForm.tsx`: pinta un `SectionSpec[]` con las piezas del 09.
- Etiquetas, ayudas y notas viven en el spec de la app, palabra por palabra; el servidor da valores y
  opciones. Los planes 14 y 16 no lo usan (pocos campos fijos, lo dicen ellos); queda para el 09 si
  quiere pasarse y para el próximo formulario largo. Si el 09 no está hecho, este plan construye sus
  piezas con esos nombres.

## Datos: su trozo del contrato

```
GET   /v1/profiles/:pid/details  → PersonDetails
PATCH /v1/profiles/:pid/details  { clientId, changes: Partial<PersonDetailsEditable> }
                                  → WriteResult & { details: PersonDetails }      // releído
GET   /v1/profiles/:pid/health   → { generatedAt, health: HealthInfo }
PUT   /v1/profiles/:pid/health   { clientId, health: Partial<HealthInfo> } → WriteResult
POST  /v1/profiles/:pid/photo    multipart: clientId, file, crop?: { x, y, size }   // fracciones 0-1
                                  → WriteResult & { photoUrl }
GET   /v1/profiles/:pid/photo?v= → la miniatura (como /people/:id/photo del plan 05)

PersonDetails { generatedAt,
  sections: ('identity'|'contact'|'address'|'photo'|'mcm'|'health'|'consents')[],
  identity: { firstName, lastName, documentType, documentNumber: string | null,
              birthDate: 'YYYY-MM-DD' | null },                                   // solo lectura
  gender, documentSupportNumber: string | null, documentIssueDate: 'YYYY-MM-DD' | null,
  emailNote: 'mcm_email_warning' | 'mcm_email_soft' | null,
  contact: { email, mobile, emergencyPhone: string | null },
  address: { street, city, province, postalCode, region: string | null },
  photoUrl: string | null,
  mcm: { stage, comLevel, shirtSize, groupName, localMcm: string | null, scarf: Scarf | null,
         lcIncorporationYear, memberSince: number | null } | null,
  consents: { dataProtection, healthData, photos: boolean | null },
  options: Record<'gender'|'documentType'|'stage'|'comLevel'|'shirtSize'|'localMcm'|'region', Option[]> }
HealthInfo   { foodIntolerances, allergies, illnesses, treatments, other: string | null }
```

`Option` es la del plan 09 y `Scarf` la del 05. `PersonDetailsEditable` es lo editable de
`PersonDetails` (sin `identity`, `sections`, `emailNote`, `photoUrl` ni `options`), más
`identityFill?: { firstName?, lastName?, documentType?, documentNumber? }` (solo regla 9). El
esquema del `PATCH` es **estricto**: una clave fuera de las secciones de esa audiencia, o de identidad
fuera de la regla 9, es `validation`. Para el plan del servidor (todo de `Contacts`, de `CAMPOS.md`):

| Contrato | CRM | Ojo |
|---|---|---|
| `identity.*` | `first_name`, `last_name`, `stic_identification_type_c`, `_number_c`, `birthdate` | No se escriben (salvo regla 9) |
| `gender`, `documentSupportNumber`, `documentIssueDate` | `stic_gender_c`, `stic_identification_supp_c`, `_exp_c` | Los dos últimos, la app solo los enseña si llegan con valor |
| `contact.*`, `address.*` | `email1`, `phone_mobile`, `phone_other`; `primary_address_street`, `_city`, `_state`, `_postalcode`, `stic_primary_address_region_c` | Pregunta 3 |
| `mcm.stage`, `comLevel`, `scarf`, `shirtSize`, `groupName`, `localMcm` | `ajmcm_etapa_c`, `ajmcm_nivel_com_c`, `ajmcm_panuelo_c`, `ajmcm_tallas_c`, `ajmcm_grupotemp_c`, `ajmcm_procendencia_c` (sic) | `stage`: `com` ⇐ `COM`, `lc_incorporated` ⇐ `lcincorporado`, el resto opaco (pregunta 2) |
| `mcm.lcIncorporationYear`, `memberSince` | `ajmcm_ano_incorporacion_lc_c` (`int`), `ajmcm_mcm_desde_c` (`date`) | La fecha se escribe `AAAA-01-01` y se lee el año |
| `consents.*` | `ajmcm_acepta_lopd_c`, `ajmcm_datossalud_c`, `ajmcm_cesionimagenes_interne_c` | `1` / `0` / vacío = `true` / `false` / `null` |
| `health.*` | `ajmcm_descripcion_intoler_c`, `_allergies__c` (**dos** guiones bajos, de verdad), `_enfermed_c`, `_tratam_c`, `_otros_c` | Solo por `/health` |
| foto | `photo`, con `set_image` | Recorte y 800×800 en el servidor |

- **Quién puede**: `pid` permitido (plan 11). Las **secciones las decide el servidor** con la audiencia
  (l. 34-38): `member`, las siete; `child` y `guardian`, sin `mcm`. `emailNote` (l. 139-152): la
  persona que se ve es monitor y su correo no es `@movimientoconsolacion.com` → `mcm_email_warning`;
  `member` sin ser monitor → `mcm_email_soft`; si no, `null`.
- **Consentimientos**: el `PATCH` solo admite `true` o `false`; si no llega, no se toca. El servidor
  nunca escribe uno que no le han mandado (regla 8).
- **Foto**: JPG, PNG, HEIC y GIF; **nunca SVG** (`upload_file_to_record` acepta `image/svg`, l. 1746:
  el servidor no). Hasta **15 MB** el original: el tope de 6 MB del plugin se medía tras recortar a
  800×800 en el móvil, y aquí recorta el servidor. Con `crop`, corta ese cuadrado; sin él (`Usar sin
  recortar`), el cuadrado centrado; siempre deja un JPEG de 800×800 al 0,85 (los números del
  recortador), lo escribe, invalida la miniatura y devuelve `photoUrl` con versión nueva.
- **En el móvil, nada en disco** (añadido de familias, regla 8: documento, dirección, correo; y la
  salud, siempre): `persist: false` en `['comunica','datos',pid]` (`gcTime` 5 min) y
  `['comunica','salud',pid]` (`gcTime` 1 min). La foto, en la caché de `expo-image`, vaciada al salir.
- **Sin cola**: se escribe directo, con conexión, con `clientId` (el mismo en los reintentos de un
  mismo «Guardar»). La cola del plan 01 guarda el cuerpo en disco y aquí son datos personales y de
  salud; además, lo de familias funciona con conexión. Es la excepción a «Datos» del README, y es
  deliberada.
- **Servidor falso**: miembro y monitor con correo de Gmail (aviso), miembro sin ser monitor (nota
  suave), familia con dos hijos (uno con las tres autorizaciones a `null`, otro con soporte y
  expedición del DNI), familiar a secas, un pagador sin DNI; etapa COM para el condicional; correo mal
  formado → `validation`; `pid` ajeno → 403; «CRM caído»; la foto recibida (tamaño, tipo y `crop`)
  cambia `photoUrl`; un contador de escrituras por campo para los tests de «solo lo que cambia».

## Comportamiento y reglas que no se pueden perder

1. **Título**: «Mis datos»; viendo a un hijo, «Datos de Lucía» (nombre de pila del 11; sin nombre,
   «Datos del participante»). Secciones en este orden: Datos personales, Datos de contacto,
   Dirección, Foto, MCM, Información sanitaria, Autorizaciones legales.
2. **Datos personales.** Nota: viendo a un hijo, «Estos son los datos que tenemos de **Lucía**.»; si
   no, «Hola **Marta** 👋, estos son los datos que tenemos.». **Bloqueados**: Nombre, Apellidos, Tipo y
   Número de identificación y Fecha de nacimiento. **Editables** (el código, aunque `design-system.md`
   §7 diga «identidad (solo lectura)»): «Género»; y «Número de soporte del DNI» y «Fecha de expedición
   del DNI» **solo si ya tienen valor** (l. 101-114), con «Ya lo tenemos. Puedes corregirlo si
   cambia.». Al final: «Los campos marcados con ✱ no se pueden editar desde el área privada. Si
   necesitas modificarlos, escribe a tu referente en comunica@movimientoconsolacion.com.» (enlace de
   correo; en la app, «con candado» en vez de «marcados con ✱»).
3. **Contacto.** Con `mcm_email_warning`: «Mejor utiliza tu correo **@movimientoconsolacion.com**: es
   el que usamos para todas las comunicaciones de monitores.»; con `mcm_email_soft`: «Si tienes, usa
   el correo **@movimientoconsolacion.com**.». «Correo electrónico» (el patrón del plugin, l. 157),
   «Móvil», «Contacto de emergencia» (ⓘ «Guardaremos el teléfono de un familiar con el que contactar en
   el (poco probable) caso de que pase algo grave.»).
4. **Dirección**: «Calle y número», «Población», «Provincia», «Código postal» (cinco cifras),
   «Comunidad Autónoma» (desplegable).
5. **MCM** (solo `member`): «Etapa», «Pañuelo», «Nivel COM» (solo con etapa COM), «Año incorporación
   LC» (solo con LC Incorporado; cuatro cifras, «AAAA», con su ⓘ), «Talla de camiseta», «Grupo MCM»
   (ⓘ entera, con «**NO es el nombre del grupo del que eres monitor/a, es el de tu grupo de
   referencia.**»), «MCM Local» y «Pertenezco al MCM desde…» (año, con su ⓘ y sus 😄 😉). Un campo que
   se esconde por la etapa **conserva su valor** y no se manda (el plugin solo lo oculta).
6. **Ningún campo obligatorio**; sí formatos: correo con el patrón del plugin, código postal de cinco
   cifras, años de cuatro, documento con la letra (regla 9). Un desplegable vacío es «Sin indicar» y se
   puede volver a él (`null`).
7. **Información sanitaria** (también para un hijo y para el familiar): nota «Te solicitamos algunos
   datos de salud que nos pueden ser útiles en las actividades presenciales. Trataremos estos datos con
   especial cuidado.» y cinco textos con su ⓘ, tal cual (l. 270-298): «Intolerancias alimentarias»,
   «Alergias», «Enfermedades», «Tratamientos habituales», «Otros datos de salud». **Se puede escribir;
   nunca se guarda en el móvil**: ni en la caché, ni en una cola, ni en un borrador, ni en un log o en
   Sentry. Vive en el estado de la pantalla y se va con ella. Sin conexión no se guarda.
8. **Autorizaciones legales**: «Acepto las condiciones sobre protección de datos» (`/legal-rgpd`),
   «… sobre el uso de mis datos de salud» (`/legal-salud`) y «… sobre la cesión de imágenes»
   (`/legal-imagenes`), con interruptor y «Ver condiciones» (navegador del sistema). ⚠️ **El plugin
   manda `0` por cada casilla sin marcar** (un oculto delante del checkbox, l. 301-343), así que
   guardar cualquier cosa convierte un «sin contestar» en «no»; para un menor, «no puede salir en
   fotos» sin que nadie lo haya dicho. **No se copia**: `null` se pinta apagado y con «Sin contestar»
   debajo, y solo viaja la que se toca (encender = `true`; encender y apagar = `false`, a propósito).
9. **Completar para pagar** (`?completar=pago`, el rebote del plan 15 en la ficha de **quien paga**):
   arriba, «Te faltan datos para poder pagar» · «Necesitamos tu nombre, apellidos, correo y documento de
   identidad. Complétalos en tus datos y vuelve al pago.», y los de identidad **que estén vacíos** se
   pueden escribir (`identityFill`; el servidor lo rechaza si en el CRM ya tienen valor). El plugin
   manda ese rebote a `single_stic_profile` o `single_stic_tutor_profile` (l. 72-79), donde tipo y
   número de documento sí se editan; en «Mis datos» están bloqueados (pregunta 1). Documento con la
   regla de `validateId`: NIF y NIE con su letra, CIF con su control, pasaporte libre («El número de
   documento no es válido»). Guardado, «Volver al pago».
10. **Guardar**: un botón para todo. Manda `PATCH` si cambió algo de los datos y `PUT /health` si
    cambió la salud, solo lo que cambia (`formChanges`). Bien: toast «Los datos se han guardado
    correctamente.», `h.formSuccess` y se pinta lo releído. Mal: «Error al guardar los datos.» y, con
    `validation`, el error en su campo; 403, «No tienes acceso a esto». Salir con cambios: «¿Salir sin
    guardar?» (nuevo: en la web se pierde sin avisar).

**Foto.**

- Bloque: la foto (o la inicial) y «Cambiar foto de perfil» o, sin foto, «Sube una foto para
  conocernos mejor ✨»; debajo, «Formatos: jpg, png o heic · Tamaño máximo: 15 MB».
- **Elegir** (🔒 `fotos-documentos`): con `expo-image-picker` en la 2.2, «Elegir de la galería» y
  «Hacer una foto» (la cámara pide cambiar el texto del permiso de `app.json`, pregunta 1 del 09).
  **Mientras tanto**, «Elegir foto» con `expo-document-picker` (`type: 'image/*'`), que ya está: en
  Android abre la galería; en iPhone, Archivos, y bajo el botón: «¿Tu foto está en Fotos? Compártela a
  Archivos y elígela aquí.».
- **Encuadrar** (`datos/foto.tsx`, la del plugin): «Encuadra tu foto», «Arrastra para mover · pellizca
  o usa el zoom», marco cuadrado, «Usar sin recortar» (secundario) y «Usar recorte» (principal). En
  JS puro (gestos de `react-native-gesture-handler` y Reanimated sobre `expo-image`), con botones − y +
  de zoom para quien no puede pellizcar. No toca la imagen: manda el cuadrado y recorta el servidor. Así
  no hace falta ningún paquete nativo, y con `expo-image-picker` la misma pantalla sirve.
- **Subir** en cuanto se acepta, sin esperar a «Guardar» (como los archivos del plan 09), con
  `UploadStatus` en el bloque y la vista previa del recorte mientras tanto. La copia del archivo va a
  `cacheDirectory/comunica/uploads/` y se borra al subir, al salir de la pantalla y al cerrar sesión.
  Errores, los del plugin: «El formato del archivo no es válido.», «El archivo es demasiado grande.»,
  «Error al subir la imagen.». En el plugin no salen nunca en «Mis datos»: el handler no mira lo que
  devuelve `upload_file_to_record` (l. 1849-1851) y dice «guardado» aunque la foto no subiera.

## Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Esqueleto de las secciones (`AreaState`); la salud, su propio esqueleto |
| Error / 403 | «No se ha podido cargar» + «Reintentar»; 403, «No tienes acceso a esto» y volver |
| Sin conexión, sin datos (lo normal: no se guardan) | `EmptyState` «Necesitas conexión para ver tus datos» + «Reintentar» |
| Sin conexión, con datos de esta sesión | Los datos + `OfflineBanner`; se edita, y «Guardar» apagado con «Sin conexión: tus cambios siguen aquí. Guárdalos al volver la cobertura»; «Cambiar foto», apagado |
| Guardando | El botón, «Guardando…»; la pantalla sigue usable |
| Pendiente de subir | No hay cola; solo la foto, con `UploadStatus` mientras sube |

## Traducción del diseño

- **Igual**: el orden y los textos, una tarjeta por sección con su cabecera y un solo nivel de
  superficie, las ⓘ, los hints, las notas, las autorizaciones con su enlace, lo bloqueado explicado y
  un solo «Guardar» siempre a la vista.
- **Cambia por ser app**: cabecera nativa con el título; `ActiveProfileBar` del 11 arriba si hay
  hijos; secciones sin plegar (como el 09), con `SectionHeader`; lo bloqueado con `LockedRow`: el dato
  como texto con candado (`IconSymbol`), nunca un campo apagado que parezca que guarda; la fecha de
  nacimiento en lenguaje humano («5 de mayo de 2014»); ⓘ → `HelpSheet` (los `<br>` y `<strong>`, en
  párrafos y negrita); desplegable → fila con hoja y «Sin indicar»; teclados y autorrelleno
  (`email-address`/`email`, `phone-pad`/`tel`, `number-pad`/`postal-code`, `street-address`,
  `address-level2`, años con `number-pad` y cuatro cifras); salud con textos de varias líneas que
  crecen; dos columnas en `isWide` para los campos cortos (el plugin, desde 768 px); «Guardar» en
  `BottomActionBar`, apagado sin cambios, sobre el teclado y la barra flotante.
- **Emoji**: 📣 y ✓ marcan, así que pasan a `IconSymbol` (plugin `design.md` §6.3); 👋, ✨, 😄 y 😉
  son tono y se quedan.
- Skills: `building-native-ui`, `heroui-native`, `animate-expo` (el encuadre),
  `make-interfaces-feel-better`; para revisar, `fixing-accessibility`, `baseline-ui`,
  `fixing-motion-performance` e `improve-ui`.

## Qué no se hace (desactivado en el plugin)

| Qué | Prueba |
|---|---|
| Autorizaciones de menor (irse solo, WhatsApp, actividades fuera, participar) | `single_stic_comunica_perfil.php` l. 19-20 y 36: «TODO futuro», en ninguna audiencia |
| Preguntas y foto de la Asamblea de mayo de 2026 | l. 25 y `docs/design-system.md` §7: «no se replica» |
| «Datos de Laico/a» | `single_stic_comunica_laico.php`: retirada en 2026-07, solo un aviso que manda a «Mis datos»; fuera del menú |
| «Datos del familiar» con forma de pago | `single_stic_tutor_profile.php` l. 9-15: campos provisionales que el CRM ignora; fuera de `getSticMenuElements`; FAM-02 bloqueado (`plans/README.md` del plugin, plan 015) |
| «Profile» genérico | `single_stic_profile.php`: fuera del menú; solo lo enlazan el rebote del pago y un caso raro de la barra (`menu.php` l. 497-505). Lo que tiene, lo cubre esta pantalla con la regla 9 |

## Qué va a la web y por qué

Nada: con la regla 9, «Mis datos» cubre también lo que hacían `single_stic_profile` y
`single_stic_tutor_profile` (menos la forma de pago provisional, que no se hace).

## Enlaces que llegan aquí

| `internalpage` | Pantalla |
|---|---|
| `single_stic_comunica_perfil` | `datos/[pid del perfil activo]` |
| `single_stic_comunica_laico` | `datos/[uno mismo]` (la retirada solo mandaba allí) |
| `single_stic_profile` (`action=detail` o `edit`) | `datos/[pid del perfil activo]` |
| `single_stic_tutor_profile` | `datos/[uno mismo]` (el familiar) |

El `msg=…` con que volvía un guardado se ignora. El «Tus datos personales» del plan 09 deja de abrir
`web.tsx` y viene aquí por el mapa.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato de «Datos»; el guardarraíl de salud del 00 admite también `/profiles/:pid/health` | Tests: un ejemplo válido de cada forma; el `PATCH` rechaza claves de identidad, de salud y de otra audiencia |
| 2 | Servidor falso: personas, secciones por audiencia, `emailNote`, autorizaciones que no se tocan, `identityFill`, foto con `crop`, contador de escrituras | Tests del falso |
| 3 | `forms.ts` y `DeclarativeForm` sobre las piezas del 09 | Unitarios del motor; capturas de cada tipo a 375 px, claro y oscuro, `fontScale` 1,3 |
| 4 | `personDetailsSpec.ts` (textos del plugin), `personDetails.ts`, `documentId.ts` | Unitarios; test de que orden y etiquetas son los del plugin (lista copiada en el test) |
| 5 | Hooks: `usePersonDetails` y `useHealth` (`persist: false`), `useSaveDetails` (directo, `clientId`) | Tests con el falso; espía del persistidor |
| 6 | `datos/[pid].tsx`: secciones, condicionales, «Guardar», salir con cambios, `completar=pago` | Test de pantalla de las tres audiencias + capturas |
| 7 | Salud y autorizaciones | Tests: la salud no llega al disco; una autorización sin tocar no viaja |
| 8 | Foto: elegir, `datos/foto.tsx`, subir, borrar la copia | Test con el selector simulado; captura del encuadre; nada en `uploads/` al acabar |
| 9 | Filas del mapa de enlaces (plan 10) y entradas desde «Tu perfil» (11) y el rebote del pago (15) | Test del mapa |
| 10 | Este bloque en `docs/contratos/COMUNICA_API.md` y `CHANGELOG.md` | Revisión |

## Tests

- **Puros** (`__tests__/comunica/`): `formChanges` (solo el correo cambiado → `{ contact: { email } }`;
  autorización `null` sin tocar → ausente; `null` → encendida → apagada = `false`; escondido por la
  etapa → no viaja); `validateForm` (correos válidos e inválidos del patrón del plugin; CP de 5 cifras;
  `2019` sí, `19`, `20199` y letras no); `visibleFields` (COM enseña «Nivel COM»; `lc_incorporated`, el
  año; soporte del DNI solo con valor); `isValidDocument` (DNI y NIE con letra buena y mala, CIF,
  pasaporte libre); `cropRect` (cuadrado dentro de la imagen, zoom mínimo y máximo); archivo de foto
  (JPG, PNG, HEIC sí; SVG no; 0 bytes; 15 MB justos y 15 MB + 1); título «Datos de María» para «María
  José».
- **De pantalla con el falso**: el miembro ve MCM y el hijo no; el familiar ve salud; guardar solo el
  móvil escribe un campo (contador); sin conexión, «Guardar» apagado y los cambios siguen; 403 con
  otro `pid`; elegir, encuadrar y subir cambia la foto; una foto rechazada enseña su error; el pagador
  sin DNI lo escribe con `completar=pago` y uno con DNI no puede.
- **Guardarraíles**: ningún texto de salud ni dato de `PersonDetails` pasa por el persistidor, la cola
  del 01 ni `logger` (espías); ninguna clave `['comunica','datos'|'salud',…]` con `persist: true`;
  ningún fichero de `datos/` hace `fetch` ni sube nada por su cuenta; al salir no queda nada en
  `comunica/uploads/`.

## Preguntas abiertas

1. **El documento de quien no lo tiene** (decidida al integrar): «Mis datos» lo bloquea («escribe a
   tu referente») pero el rebote del pago lleva a páginas donde se edita. Se queda como dice el plan:
   solo lo **vacío** y solo con `completar=pago`, que es el único sitio donde hace falta. Abrirlo a
   cualquier momento es cambiar una condición.
2. 🔒 (`campos-crm`) **La etapa en `CAMPOS.md` se contradice**: §1 da a `ajmcm_etapa_c` solo `MIC`, `COM` y `LC`; la
   cabecera y el pendiente 1 añaden `lcincorporado`, `asesora` y `apoyo`, y la página usa
   `lcincorporado` para enseñar el año de incorporación. El servidor manda las opciones que tenga el
   CRM; falta corregir `CAMPOS.md`.
3. 🔒 (`campos-crm`) **`stic_primary_address_region_c`** sale como «No» (sin usar) en `CAMPOS.md` §4, pero «Mis datos»
   lo escribe («Comunidad Autónoma»). ¿Se usa?
4. **El plugin sigue convirtiendo «sin contestar» en «no»** (regla 8) y callando los errores de la
   foto, para quien guarda desde la web. No es de este plan: se le ha avisado al propietario (22/10)
   para arreglarlo en el plugin.
