# Tasklyzen Architecture

## Runtime

Tasklyzen usa JavaScript clasico sin bundler. Cada modulo expone una API bajo
`window.Tasklyzen*`; `main.js` coordina estado, eventos de alto nivel y carga
diferida. Los modulos de dominio no deben leer variables internas de `main.js`.

## Orden de carga

`index.html` carga los scripts en este orden:

1. Firebase compat (`app`, `auth`, `firestore`).
2. `tasklyzen-config.js`.
3. `tasklyzen-data-migration.js`.
4. `firebase-env.js`, `tasklyzen-auth.js`, `tasklyzen-storage.js`.
5. Utilidades y dominio de tareas: `tasklyzen-utils.js`,
   `tasklyzen-composite-tasks.js`, `tasklyzen-tasks.js`.
6. UI y controladores: componentes, revision de vencidas, creacion, ajustes,
   audio, notificaciones y lista de tareas.
7. Analitica, rachas, features locales, modo desarrollador, referencias DOM y
   capa POO.
8. `main.js` al final.

Todo script nuevo debe cargarse antes de `main.js` y despues de sus
dependencias reales. No convertir un modulo aislado a ES Modules sin cambiar
toda la cadena de carga.

## Modulos principales

- `tasklyzen-config.js`: claves de almacenamiento, limites y niveles de racha.
- `tasklyzen-data-migration.js`: sanea estructuras persistidas retiradas antes
  de que la app las use.
- `tasklyzen-storage.js`: Local-First y sincronizacion con Firestore.
- `tasklyzen-utils.js`: fechas, timestamps y formato compartido.
- `tasklyzen-tasks.js`: fabrica y reglas de tarea.
- `tasklyzen-composite-tasks.js`: subtareas, hitos y estado derivado.
- `tasklyzen-overdue-review.js`: revision y retencion de tareas vencidas.
- `tasklyzen-settings.js`: preferencias, temas, sonido, respaldo y borrado.
- `tasklyzen-audio.js`: sintetiza senales breves y respeta sonido/volumen.
- `tasklyzen-notifications.js`: toast interno y recordatorios del navegador.
- `tasklyzen-task-ui.js`: lista, filtros, contadores y acciones de tarea.
- `tasklyzen-analytics-progress.js`: calculo y render de analitica/progreso.
- `tasklyzen-gamification.js`: rachas, escudos y niveles de prestigio.
- `tasklyzen-gamification-ui.js`: tarjeta, ruta y cuadricula de racha.
- `tasklyzen-developer.js`: controles y simulaciones para desarrollo.
- `tasklyzen-dom.js`: referencias DOM agrupadas por dominio.
- `tasklyzen-oop.js`: `TaskState`, `TaskManager`, `AnalyticsEngine` y
  `UIController` para compatibilidad con el runtime clasico.
- `components/tasklyzen-ui-components.js`: componentes vanilla que reciben
  datos calculados y devuelven DOM sin consultar estado global.

## Persistencia y nube

Las claves se concentran en `TasklyzenConfig.storageKeys`:

- `todos`, `history`, `dailyGoal`.
- `gamification`: solo rachas, escudos y protecciones de racha.
- `dailyStats`, `analyticsEvents`, `analyticsFlowPeriod`, `progressView`.
- `settings`, `features`, `overdueReview`, `developerSnapshot`.

`tasklyzen-data-migration.js` se ejecuta al cargar almacenamiento y antes de
sincronizar una sesion autenticada. Elimina claves independientes retiradas y
campos heredados dentro de gamificacion, eventos, estadisticas diarias,
snapshots de desarrollo y vista de progreso. Conserva tareas, historial,
metas, rachas, escudos, ajustes y analitica no relacionada.

En Firestore, `tasklyzen-storage.js` aplica el mismo saneamiento al documento
`users/{uid}`. Los campos actualizados se escriben con `merge`; las claves
retiradas se eliminan mediante `FieldValue.delete()` cuando esta disponible.
Asi la nube deja de rehidratar datos ya retirados sin reemplazar datos validos
del usuario.

Reglas de seguridad:

1. Agregar claves nuevas solo en `tasklyzen-config.js`.
2. Leer y escribir mediante `TasklyzenStorage` o el modulo propietario.
3. Normalizar datos antiguos antes de interpretarlos.
4. Mantener respaldo/importacion y borrado total alineados con las claves.
5. No renombrar IDs de tareas o campos persistidos sin una migracion explicita.

## Estilos

`styles.css` es el unico punto de entrada de estilos de `index.html`. Mantiene
la cascada por capas: tokens, temas, ajustes/notificaciones, layout, creacion y
progreso, analitica, rachas, tareas, feedback, overrides, desarrollo,
responsive, movimiento, features y controles de identidad.

Usar tokens semanticos para superficies, texto, bordes, estados y rachas. Las
reglas de modo oscuro, `body.reduced-animations` y
`prefers-reduced-motion` deben mantenerse en sus capas actuales.

## Cambios por dominio

- Datos y reglas de tareas: `tasklyzen-tasks.js`, `TaskState` y `TaskManager`.
- Render de tareas: `tasklyzen-task-ui.js` y componentes vanilla.
- Analitica: `AnalyticsEngine` para calculo; `tasklyzen-analytics-progress.js`
  para coordinacion y DOM.
- Rachas: calculo en `tasklyzen-gamification.js`; visuales en
  `tasklyzen-gamification-ui.js`.
- Ajustes y notificaciones: sus modulos propios; evitar duplicar defaults en
  `main.js`.
- Acceso inicial: `tasklyzen-auth.js` espera el primer estado real de Firebase
  y emite `tasklyzen:entry-ready`. La estrategia `google` vuelve a pedir acceso
  si se pierde la sesión; `local` mantiene la entrada sin conexión elegida.
- Modo Carrera y futuras funciones locales: `tasklyzen-features.js`. La carrera
  conserva un reloj continuo de sesión y acumulados independientes por tarea,
  además de la tarea activa y el conjunto de tareas elegido para la sesión.
  Si una carrera antigua no tiene ese conjunto, se conservan todas las pendientes
  como comportamiento compatible.
  el borrador de subtareas y la fase Pomodoro. `suspended` permite volver a la
  lista y reanudar sin registrar ni reiniciar la sesión. Pomodoro ofrece solo
  25/5 (hasta 8 ciclos) y 50/10 (hasta 4 ciclos). El motor inserta una pausa
  larga de 20 minutos a mitad de las sesiones extendidas; el aro principal
  representa el bloque activo de la sesión. En contrarreloj se
  configura por ciclos y calcula su duración total. El cierre guarda tiempo,
  ciclos, tiempo por tarea y una instantánea de las tareas visitadas para el resumen final,
  incluso cuando el usuario termina antes. `prepareForEntry` transforma una
  carrera interrumpida en una sesión reanudable antes del primer render.
- Demos de Carrera: `tasklyzen-developer.js` invoca las APIs públicas
  `previewForDeveloper` y `TasklyzenAudio.playRaceCue`; no replica el render ni
  accede al estado interno del motor de audio.
- `main.js`: solo orquestacion, persistencia de alto nivel y eventos cruzados.

## Verificacion

```bash
npm test
node --check main.js
```

Checklist manual despues de cambios de arquitectura:

- Crear, editar, completar, reactivar y eliminar una tarea.
- Crear un hito, actualizar subtareas y finalizarlo.
- Cambiar tema y abrir/cerrar Ajustes y Progreso.
- Consultar Analitica y Racha; confirmar que la racha conserva escudos e
  historial.
- Probar Modo Carrera libre y contra reloj, Pomodoro, salida suspendida y las
  opciones de continuar, dejar para después, empezar una carrera nueva y
  terminar anticipadamente con resumen.
- Iniciar sesion y confirmar que tareas, racha y preferencias sincronizan.
- Probar importacion/exportacion y el modo desarrollador.
