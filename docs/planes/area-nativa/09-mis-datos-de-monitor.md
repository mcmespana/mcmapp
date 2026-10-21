# 09 — Mis datos de monitor

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 01 y 03 · **Tamaño:** M ·
> **Índice:** [README.md](README.md)

## Para qué y para quién

La pantalla del plugin «Mis datos de monitor», en nativo. El monitor rellena su **trayectoria**, su
**formación** y su **voluntariado**, elige cómo presenta el **certificado de delitos sexuales**
(automático o manual) y **sube sus títulos y certificados** desde el móvil. Y el **aviso** de la
portada cuando eligió «manual» y no lo ha subido: es obligatorio para estar con menores.

Solo para quien tiene el papel `monitor` (`menu.php` l. 56-62; `inc/stic-equipo.php` l. 176-182):
coordinación o acompañamiento sin ser monitor no la ve. Los datos generales (contacto, dirección,
salud, RGPD: «Mis datos», `single_stic_comunica_perfil.php`) **no** entran: siguen en la WebView y la
pantalla enlaza a ellos.

## Especificación de origen

| Qué | Dónde |
|---|---|
| Campos, orden, etiquetas, ayudas ⓘ, notas y textos | `pages/single_stic_comunica_monitor.php` (entera) |
| Cómo pinta el motor cada tipo: desplegable con opción vacía, múltiple, casilla, `yearOnly`, `help`/`hint`/`note` | `inc/stic-formController.php` l. 1-40 y 215-470; `docs/design-system.md` §5 y §7 |
| Guardar y subir: un Documento por archivo, vinculado a la persona, con su categoría, y el indicador «archivo subido» | `inc/stic-action.php` l. 1824-1930 (`prefix_comunica_save_contact`, `comunica_upload_certificate`) |
| PDF, JPG o PNG, hasta 6 MB | `inc/stic-security.php` l. 485-495 |
| El aviso del certificado: regla, textos y caché en sesión (`scp_ds_pending`) | `inc/stic-comunica-roles.php` l. 243-314; `pages/single_stic_home.php` l. 147-151; `sinergiacrm-private-area.php` l. 1265 |
| Campos bloqueados y explicados; el patrón ✱ | `design.md` del plugin §6.5; `single_stic_comunica_perfil.php` l. 94-129 |
| Campos del CRM y valores de cada desplegable | `docs/comunica/CAMPOS.md` § Monitores (Formación, Varios, Legal) |
| Lista viva de campos del monitor | `sticpa_pl_monitor_fields()`, `inc/stic-pasar-lista-crm.php` l. 5410-5451 |

Todos los campos de la página están en `CAMPOS.md`. En `sticpa_pl_monitor_fields()` (la ficha que ve
coordinación) están todos menos `ajmcm_vol_descripcion_c` y `ajmcm_vol_programas_c`.

## Pantallas y rutas

| Ruta | Qué |
|---|---|
| `app/(tabs)/comunica/yo/index.tsx` | «Mis datos de monitor»: secciones, «Guardar» y archivos. Se llega desde el menú de cuenta del área (plan 02) y desde el aviso |
| `CertificatePendingAlert` (`components/comunica/yo/`) | El aviso: arriba en esta pantalla (sin botón) y en la portada «Hoy» del plan 04 (con «Subir certificado»), debajo de la tarjeta de hoy y de las listas que faltan |

«Revisarlo en Documentos →» y «Tus datos personales» abren `web.tsx` (plan 01) con
`list_stic_documents` y `single_stic_comunica_perfil`. Código: `utils/comunica/monitorProfile.ts`
(puro); `hooks/comunica/useMonitorProfile.ts`, `useMonitorProfileForm.ts` y `useDocumentUpload.ts`;
y las piezas de formulario en `components/comunica/comun/form/` (las reutilizarán las familias en la
fase 2): `FormSection`, `FormField` (etiqueta, ⓘ, hint, error), `SelectField`, `CheckListField`,
`SwitchField`, `OptionCards`, `FileField`, `LockedRow` y `HelpSheet`.

## Datos

```
GET   /v1/me/monitor     → MonitorProfile
PATCH /v1/me/monitor     { clientId, changes: Partial<MonitorProfileEditable> } → WriteResult
POST  /v1/me/documents   multipart: clientId, kind: DocumentKind, file → WriteResult

Option            { value, label }            // las da el servidor: cursos y congresos crecen cada año
PreMonitorStatus  'no' | 'in_progress' | 'finished'
CourseStatus      'no' | 'in_progress' | 'internship' | 'pending_certificate' | 'certified'
DocumentKind      'sex_offence_certificate' | 'mat' | 'dat' | 'other_training'
MonitorProfile { generatedAt,
  monitorSince: number | null, monitorOf: Stage | 'other' | null,
  preMonitors1, preMonitors2: PreMonitorStatus | null, preMonitorsYear: string | null,
  mat: CourseStatus | null, matCourse: string | null, dat, fa: CourseStatus | null,
  datYearAndSchool, faYearAndSchool: string | null, foodHandling: boolean | null,
  congresses: string[], academicBackground: string | null,
  volunteeringDescription, volunteeringPrograms: string | null,
  sexOffenceCertificateMode: 'automatic' | 'manual' | null,
  files: { sexOffenceCertificate, mat, dat, otherTraining: boolean },   // solo lectura
  options: { matCourses: Option[], congresses: Option[] } }
```

`MonitorProfileEditable` es `MonitorProfile` sin `generatedAt`, `files` ni `options`, y el esquema
del `PATCH` es estricto: una clave de más es `validation`. Para el plan del servidor (la app no ve
estos nombres; todos de `Contacts`):

| Contrato | CRM | Ojo |
|---|---|---|
| `monitorSince` | `ajmcm_monitor_desde_c` (`date`) | Solo el año: se escribe `AAAA-01-01` y se lee el año (`yearOnly`) |
| `monitorOf` | `ajmcm_monitor_de_c` | `MIC`, `COM`, `LC`, `apoyo`, `otros` |
| `preMonitors1/2`, `preMonitorsYear` | `ajmcm_premonitores1_c`, `…2_c`, `ajmcm_premonitores_year_c` | `no`, `en_curso`, `finalizado`; el año es texto |
| `mat`, `dat`, `fa` | `ajmcm_mat_c`, `ajmcm_dat_c`, `ajmcm_fa_c` | `no`, `en_curso`, `practicas`, `pendiente_titulo`, `titulado` |
| `matCourse` | `ajmcm_mat_year_c` | Desplegable de curso y escuela (`2013` … `otra_escuela`) → `options.matCourses` |
| `datYearAndSchool`, `faYearAndSchool`, `academicBackground`, `volunteering*` | `ajmcm_dat_year_c`, `ajmcm_fa_year_c`, `ajmcm_formacion_academica_c`, `ajmcm_vol_descripcion_c`, `ajmcm_vol_programas_c` | Texto |
| `foodHandling` | `ajmcm_alimentos_c` | Casilla |
| `congresses` | `ajmcm_congreso_monis_c` (múltiple) | Claves de `CAMPOS.md` → `options.congresses` |
| `sexOffenceCertificateMode` | `ajmcm_aut_del_sex_c` | `1` automático, `0` manual, vacío = sin elegir |
| `files.*` | `ajmcm_cert_del_sex_c`, `ajmcm_mat_file_c`, `ajmcm_dat_file_c`, `ajmcm_cert_files_c` | Los pone el servidor al subir; el `PATCH` nunca |

Subir es lo de `comunica_upload_certificate()`: un Documento con su categoría (`legal_cert_delitos`,
`formacion_titulo_mat`, `formacion_titulo_fa` para el DAT —ver preguntas— y `formacion_titulo_otros`),
la relación con la persona, la revisión con el archivo y el indicador a `1`, asignado a la delegación.

- **Quién puede:** solo la propia persona y solo con papel `monitor`; el id sale del token, nunca de
  la petición. Sin el papel, `forbidden`.
- **En el móvil:** `MonitorProfile` se persiste (son sus datos y no hay salud) y se borra al salir.
- **Por la cola, el `PATCH`** con `key: 'me.monitor'`. Como gana la última, cada entrada lleva
  **todos** los campos que difieren de lo último que confirmó el servidor, no solo los del último
  «Guardar»: si no, guardar dos veces sin cobertura perdería lo primero.
- **Por la cola, cada archivo** con `key: 'me.documents.<kind>'` (elegir otro antes de que suba lo
  sustituye), salvo `other_training`, que lleva además su `clientId` porque se pueden subir varios. El
  archivo se copia a `documentDirectory/comunica/uploads/` y la copia se borra al subir y al salir: es
  un certificado y no se deja por ahí. El multipart lo arma el cliente de `services/comunica/`.
- **Servidor falso:** un monitor en «manual» sin certificado (para ver el aviso), otro en «automático»
  con títulos, una persona de coordinación sin papel de monitor (403), cursos y congresos inventados,
  subidas en memoria (nombre, tamaño, tipo) que ponen el indicador, y «CRM caído» lo deja en la cola.

## Comportamiento y reglas que no se pueden perder

1. **Mismos campos, orden y textos** que la página (l. 34-207): Trayectoria (Monitor/a desde…,
   Monitor/a de…), Formación (Premonitores I y II, su año, MAT y su curso, DAT y FA con «Año y
   escuela», manipulación de alimentos, congresos M+C, formación académica), Voluntariado, Certificado
   de Delitos Sexuales y Archivos. Las ayudas ⓘ, palabra por palabra.
2. **Nada es obligatorio** (`'required' => false` en todos). El certificado tampoco obliga: sin
   elegir, bajo las tarjetas sale «Debes elegir Automático o Manual.», pero se guarda.
3. **«Monitor/a desde…» es un año:** cuatro cifras, teclado numérico, «AAAA»; el 1 de enero no se
   enseña nunca. «Año premonitores» se ve igual, pero en el CRM es texto libre.
4. **Un desplegable vacío es «Sin indicar», no «No»:** el motor del plugin pinta la opción vacía y se
   puede volver a ella. `SelectField` la ofrece y manda `null`.
5. **Solo se manda lo que cambia.** El plugin manda el formulario entero y una casilla sin marcar se
   guarda como `0` (análisis §6); aquí `foodHandling` en `null` sigue en `null` hasta que se toque.
6. **Certificado.** Tarjeta «Automático» («Autorizaré al MCM en la app 'Mi Carpeta Ciudadana'.») →
   «Ver tutorial para autorizarnos en 'Mi Carpeta Ciudadana'» (`/monitoresDS`). Tarjeta «Manual»
   («Envío aquí el certificado y lo renovaré cada septiembre.») → el archivo y «Ir al trámite del
   Ministerio de Justicia». La nota de la sección, entera y con sus dos enlaces (AEPD y la guía).
7. **El aviso** sale si el modo es `manual` y no hay certificado (`isCertificatePending()`, la regla de
   `stic-comunica-roles.php` l. 284-286). Título: «Te falta subir tu Certificado de Delitos
   Sexuales». Texto: «Elegiste presentarlo de forma manual y todavía no lo tenemos. Es obligatorio para
   las actividades con menores: súbelo cuando puedas (se renueva cada septiembre).» Un certificado
   **en la cola** cuenta como en camino: el aviso se esconde y vuelve si la subida acaba en `failed` o
   `stuck`. En la portada cuesta una lectura más, guardada en el móvil, y solo para monitores.
8. **Archivos.** «Elegir archivo» con `expo-document-picker` (ya instalado): PDF, JPG o PNG hasta 6
   MB, comprobado antes de encolar («Ese archivo pesa más de 6 MB» / «Tiene que ser PDF, JPG o PNG»:
   una foto HEIC del iPhone no vale). En iOS, bajo el botón: «¿Lo tienes en papel? Escanéalo con Notas
   o Archivos y elígelo aquí.» Los hints del plugin: sin archivo, «Formatos: pdf, jpg, png · Tamaño
   máximo: 6MB · Puedes subirlo ahora o más adelante.»; con archivo, «Ya tienes un archivo guardado.
   Sube uno nuevo para sustituirlo.» Las notas de «Archivos» y de «Otros certificados», tal cual.
9. **Sin recortar.** El plugin engancha su recortador cuadrado (800×800) a todo campo de archivo que
   acepte imágenes (`js/stic-cropper.js` l. 255-269), así que la foto de un título sale recortada. La
   app sube el archivo como está.
10. **Subir no espera a «Guardar».** En el plugin el archivo viaja con el formulario; aquí sube en
    cuanto se elige, con su `UploadStatus`, para que no se pierda si el monitor sale sin guardar. El
    resto de campos sí espera a «Guardar».
11. **El acuerdo de voluntariado** sigue siendo la nota fija del plugin, para todos (l. 101-104):
    «Acuerdo de voluntariado: en tramitación, te lo enviaremos y lo firmarás en breve.»
12. Los enlaces externos se abren con `expo-web-browser`.

## Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Esqueleto de las cinco secciones (`AreaState`) |
| Error / 403 | `AreaState` con «Reintentar»; con 403, «Esta sección es para monitores» y volver |
| Sin conexión | Lo guardado + `SyncBadge`; se edita y se guarda igual (a la cola) y los archivos esperan en la cola |
| Pendiente de subir | `UploadStatus` junto a «Guardar» y en cada archivo: pendiente, subiendo, no se ha podido (Reintentar), atascada |
| Guardado | Si sigue en la pantalla cuando el servidor lo aplica: toast «Los datos se han guardado correctamente.»; si falla, «Error al guardar los datos.» (los del plugin, l. 20-21) |
| Salir con cambios | Diálogo «¿Salir sin guardar?» (nuevo: en la web se pierde sin avisar) |

## Traducción del diseño

- **Se queda igual:** una tarjeta por sección con su cabecera y un solo nivel de superficie, las
  ayudas ⓘ, el hint bajo el campo, las notas de sección, las dos tarjetas de opción del certificado,
  «Ya subido» con su marca y el botón de guardar siempre a la vista.
- **Cambia por ser app:**
  - Cabecera nativa «Mis datos de monitor». Las secciones no se pliegan: se recorren con scroll y
    `SectionHeader`.
  - ⓘ = botón de 44 pt que abre `HelpSheet`, una hoja corta con el texto (no hay hover).
  - Desplegable = fila que abre una hoja con las opciones y «Sin indicar»; congresos = lista de
    casillas; casilla = `Switch` de heroui; texto = `AppTextField` (teclado numérico en los años,
    `multiline` en los textos largos).
  - Las tarjetas Automático/Manual (`OptionCards`, papel `radio`) se apilan a 375 px y van en dos
    columnas con `isWide`.
  - **Fuera los emoji que marcan** (💨 📥 📙 ⏳): `IconSymbol` o nada (plugin `design.md` §6.3, app
    `design.md` §8). El 💡 de «Si no puedes completar esta parte…» es de tono y se queda.
  - «Guardar» en `BottomActionBar`, por encima del teclado y de la barra flotante; apagado sin cambios.
- **Bloqueado y explicado.** Esta página del plugin no bloquea ningún campo (el ✱ vive en «Mis
  datos»). Lo que aquí no se edita es el estado de cada archivo: `LockedRow` lo pinta como un dato
  («Ya subido»), no como un control apagado, con «Revisarlo en Documentos →» al lado. Nunca un campo
  deshabilitado que parezca que guarda (plugin `design.md` §6.5).
- El aviso, con la alerta accionable que traduzca el plan 03 (`.stic-alert--warning`); si no la hay,
  tarjeta con los colores de estado de `constants/colors.ts`, sin hex nuevo.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato (`MonitorProfile`, `PATCH` estricto, `DocumentKind`) y servidor falso con sus fixtures | Tests de esquemas; el falso da 403 sin papel, guarda y se vuelve a leer |
| 2 | `monitorProfile.ts`: cambios frente a lo confirmado, año, `isCertificatePending`, validación de archivo, claves de la cola | Tests puros |
| 3 | Piezas de formulario en `comun/form/` | Test de cada una (etiqueta, papel, 44 pt); capturas a 375 px en claro y oscuro con `fontScale` 1,3 |
| 4 | `yo/index.tsx` con Trayectoria, Formación y Voluntariado; guardar por la cola; diálogo al salir | Test de pantalla con el falso: editar, guardar sin conexión, reconectar, aplicado |
| 5 | Sección del certificado: tarjetas, el bloque de cada opción y sus enlaces | Test: elegir «Manual» enseña el archivo y el aviso |
| 6 | `FileField` y `useDocumentUpload`: elegir, validar, copiar, encolar, subir y borrar la copia | Test con el selector simulado: grande o HEIC, rechazado; la subida llega; la copia se borra |
| 7 | `CertificatePendingAlert` aquí y en la portada del plan 04 | Test: sale, se esconde con el certificado en la cola y vuelve si falla |
| 8 | Enlaces a `web.tsx` (Documentos y Mis datos) y la entrada en el menú de cuenta | Toque a toque en web con el falso |
| 9 | `CHANGELOG.md` y el plan marcado en el README | Revisión |

## Tests

- **Puros** (`__tests__/comunica/`): cambios frente a lo confirmado (dos guardados sin cobertura lo
  llevan todo); `monitorSince` acepta `2019` y rechaza `19`, `20199` y letras; `isCertificatePending`
  con las seis combinaciones (sin elegir, automático o manual, con o sin archivo); archivo por tipo,
  extensión, 0 bytes, 6 MB justos y 6 MB + 1.
- **De pantalla, con el falso:** el monitor en «manual» ve el aviso, sube y el aviso se va; la persona
  de coordinación sin papel recibe el 403; con el CRM caído todo espera en la cola y luego se aplica.
- **Guardarraíles:** el esquema del `PATCH` no admite `files` ni claves desconocidas; ningún fichero de
  `yo/` ni de `comun/form/` sube nada por su cuenta (todo por `services/comunica/`); al salir no queda
  nada en `comunica/uploads/`.

## Preguntas abiertas

1. **Fotos y cámara.** Con `expo-document-picker` el iPhone ve la app Archivos, no la galería: un
   título en papel hay que escanearlo antes. «Hacer una foto» o «Elegir de la galería» pedirían
   **`expo-image-picker`** (paquete nativo nuevo) y, con ese o con `expo-camera`, **cambiar el texto
   del permiso de cámara** de `app.json` («…para escanear los códigos QR de playlists y sesiones de
   coro»), que va en el binario: Apple rechaza un uso que el texto no explica. ¿Entra en la siguiente
   build, o la primera versión va solo con archivos?
2. **El certificado de cada septiembre.** El indicador «archivo subido» no se apaga nunca y no hay
   fecha (lo dice F4 de las propuestas): quien lo subió el curso pasado ya no ve el aviso aunque le
   toque renovarlo. ¿Se queda como en el plugin?
3. **El título DAT se guarda con la categoría `formacion_titulo_fa`** (`stic-action.php` l. 1855), y
   las categorías de Documentos no están en `CAMPOS.md`. ¿Errata o a propósito? El servidor copiará lo
   que digas.
4. **¿«Mi Carpeta Ciudadana» o «Te Autorizo»?** La página dice lo primero; `CAMPOS.md`, en
   `ajmcm_aut_del_sex_c`, lo segundo. La app copia la página.
5. **El recortador del plugin** deja en cuadrado las fotos de los certificados (regla 9). No es de
   este plan, pero conviene arreglarlo en el plugin.
