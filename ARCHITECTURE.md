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
   `tasklyzen-composite-tasks.js`, `tasklyzen-tasks.js` y
   `tasklyzen-task-lifecycle.js`, `tasklyzen-domain-events.js`,
   `tasklyzen-task-effects.js` y
   `tasklyzen-task-transactions.js`.
6. UI y controladores: componentes, revision de vencidas, creacion, ajustes,
   experiencia inicial, audio, notificaciones y lista de tareas.
7. Progreso sostenible, analítica, rachas, features locales, modo
   desarrollador, referencias DOM y capa POO.
8. `main.js` al final.

Todo script nuevo debe cargarse antes de `main.js` y despues de sus
dependencias reales. No convertir un modulo aislado a ES Modules sin cambiar
toda la cadena de carga.

## Modulos principales

- `tasklyzen-config.js`: claves de almacenamiento, lista blanca de sincronizacion,
  limites y niveles de racha.
- `tasklyzen-data-migration.js`: sanea estructuras persistidas retiradas antes
  de que la app las use.
- `tasklyzen-storage.js`: Local-First y sincronizacion con Firestore.
- `tasklyzen-utils.js`: fechas, timestamps y formato compartido.
- `tasklyzen-tasks.js`: fabrica y reglas de tarea.
- `tasklyzen-composite-tasks.js`: subtareas, hitos y estado derivado.
- `tasklyzen-task-lifecycle.js`: regla pura para decidir si una eliminacion
  conserva su huella analitica.
- `tasklyzen-domain-events.js`: envelope, identidad y deduplicacion de eventos
  de dominio antes de persistirlos.
- `tasklyzen-task-effects.js`: coordinador inyectable de eventos analiticos y
  creditos sostenibles derivados de completar, reactivar o eliminar.
- `tasklyzen-task-transactions.js`: transacciones inyectables para completar,
  reactivar y eliminar tareas; tambien sincroniza, reordena y actualiza hitos
  y subtareas sin mezclar reglas en el runtime.
- `tasklyzen-overdue-review.js`: revision y retencion de tareas vencidas.
- `tasklyzen-settings.js`: preferencias, temas, sonido, estrategia de progreso,
  meta de enfoque, respaldo y borrado.
- `tasklyzen-experience.js`: recorrido versionado y personalizacion inicial;
  recibe ajustes y meta por inyeccion, sin leer estado interno del runtime.
- `tasklyzen-audio.js`: sintetiza senales breves y respeta sonido/volumen.
- `tasklyzen-notifications.js`: toast interno y recordatorios del navegador.
- `tasklyzen-task-ui.js`: lista, filtros, contadores y acciones de tarea.
- `tasklyzen-sustainable-progress.js`: ledger diario de avance significativo,
  tiempo confirmado, sesiones intencionales, pausas y ritmo sostenible.
- `tasklyzen-analytics-progress.js`: calculo y render del rendimiento activo
  por tareas y tiempo. La superficie retirada de tarjetas, donut y recap
  mensual ya no forma parte del runtime; el panel conserva Semana y 12 meses.
- `tasklyzen-gamification.js`: rachas, escudos y niveles de prestigio.
- `tasklyzen-gamification-ui.js`: tarjeta, ruta y cuadricula de racha.
- `tasklyzen-developer.js`: controles y simulaciones para desarrollo.
- `tasklyzen-dom.js`: referencias DOM agrupadas por dominio.
- `tasklyzen-oop.js`: `TaskState`, `TaskManager`, `AnalyticsEngine` y
  `UIController` para compatibilidad con el runtime clasico.
- `components/tasklyzen-ui-components.js`: componentes vanilla que reciben
  datos calculados y devuelven DOM sin consultar estado global. El gráfico
  reutilizable activo es `createPerformanceBarChart`.

## Persistencia y nube

El inventario detallado, las fronteras de sincronizacion y las brechas de la
fase F1 estan en `STORAGE_CONTRACT.md`. Antes de agregar una clave o cambiar
una politica de nube, actualizar ese contrato.

Las claves se concentran en `TasklyzenConfig.storageKeys`:

- `todos`, `history`, `dailyGoal`.
- `gamification`: solo rachas, escudos y protecciones de racha.
- `dailyStats`, `analyticsEvents`, `analyticsFlowPeriod`, `progressView`.
- `settings`, `features`, `overdueReview`, `developerSnapshot`.
- `experience`: version, estado y ultimo paso del recorrido de bienvenida.
- `sustainableProgress`: avance diario y clasificación de sesiones de Carrera.

`tasklyzen-data-migration.js` se ejecuta al cargar almacenamiento y antes de
sincronizar una sesion autenticada. Elimina claves independientes retiradas y
campos heredados dentro de gamificacion, eventos, estadisticas diarias,
snapshots de desarrollo y vista de progreso. Conserva tareas, historial,
metas, rachas, escudos, ajustes y analitica no relacionada.

En Firestore, `tasklyzen-storage.js` solo lee y escribe las claves declaradas
en `TasklyzenConfig.cloudStorageKeys`. Los campos ajenos del documento no se
rehidratan, sobrescriben ni eliminan. Los campos actualizados se escriben con
`merge`; las claves retiradas se eliminan mediante `FieldValue.delete()` cuando
esta disponible. La lista cloud es explicita: incluye datos canonicos y caches
transitorias compatibles, pero excluye interfaz, desarrollo, ajustes y una
sesion activa de Carrera. `cloudDeletionKeys` conserva el alcance historico
para que el borrado total tambien limpie campos antiguos de Firestore.

Reglas de seguridad:

1. Agregar claves nuevas solo en `tasklyzen-config.js`.
2. Leer y escribir mediante `TasklyzenStorage` o el modulo propietario.
3. Normalizar datos antiguos antes de interpretarlos.
4. Mantener respaldo/importacion y borrado total alineados con las claves.
5. No renombrar IDs de tareas o campos persistidos sin una migracion explicita.
6. Esperar `TasklyzenStorage.whenReady()` antes de decidir experiencias de
   entrada; el estado local y el sincronizado no deben competir.
7. El borrado total usa `removeMany` para retirar todas las claves locales y
   remotas juntas. Al desaparecer `experience`, la guia vuelve a comenzar.
8. `firestore.rules` es la frontera de autorizacion remota: limita el documento
   `/users/{uid}` al UID autenticado y a la whitelist cloud. `FIREBASE_SECURITY.md`
   documenta su despliegue y verificacion.

## Contrato de ciclo de vida

El contrato de mutaciones, eventos, caches y efectos de la Fase 2 esta en
`DOMAIN_TRANSACTIONS.md`. Consultarlo antes de agregar una metrica o un efecto
desde un handler de interfaz.

`EVENT_CONTRACT.md` define la forma persistida de eventos, los tipos de
subtarea y la frontera entre evento, cache analitica y ledger sostenible.

Las decisiones siguientes fijan el comportamiento de datos antes de ampliar
analitica o interfaz:

1. Una tarea eliminada antes de vencer se considera descartada: se eliminan sus
   eventos y creditos sostenibles del dia para que no infle progreso ni metas.
2. Una tarea vencida conserva una huella de ciclo de vida al eliminarse. La
   retencion aplica si ya estaba vencida o si sale por los flujos
   `task_expired` y `task_auto_deleted`.
3. Las reglas de retencion viven en `TasklyzenTaskLifecycle`; `TasklyzenTaskEffects`
   aplica los creditos y eventos derivados. El runtime conserva persistencia y UI,
   sin duplicar esas reglas.
4. Un hito normal se completa al cerrar todos sus pasos obligatorios. En Modo
   Carrera los cambios de subtareas se mantienen como borrador hasta confirmar
   el cierre de la sesion o avanzar a la siguiente tarea.
5. La entrada nueva usa `dueDate`; `timeLimitDays` se mantiene solo para leer
   datos heredados hasta una migracion especifica.
6. Los avisos externos se consideran disponibles mientras la aplicacion esta
   cargada, incluso en segundo plano. Avisos con la pagina cerrada requieren
   una futura decision e infraestructura de service worker.
7. La sincronizacion cloud usa exclusivamente la whitelist explicita
   `TasklyzenConfig.cloudStorageKeys`. Una clave nueva requiere decidir
   explicitamente si debe viajar a la nube o solo puede borrarse de ella por
   compatibilidad historica.

## Estilos

`styles.css` es el unico punto de entrada de estilos de `index.html`. Mantiene
la cascada por capas: tokens, temas, ajustes/notificaciones, layout, creacion y
progreso, analitica, rachas, tareas, feedback, overrides, desarrollo,
responsive, movimiento, features, controles de identidad y experiencia.

Usar tokens semanticos para superficies, texto, bordes, estados y rachas. Las
reglas de modo oscuro, `body.reduced-animations` y
`prefers-reduced-motion` deben mantenerse en sus capas actuales.

## Cambios por dominio

- Datos y reglas de tareas: `tasklyzen-tasks.js`, `TaskState` y `TaskManager`.
- Render de tareas: `tasklyzen-task-ui.js` y componentes vanilla.
- Analitica: `AnalyticsEngine` para calculo; `tasklyzen-analytics-progress.js`
  para coordinacion y DOM.
- Rachas: calculo en `tasklyzen-gamification.js`; visuales en
  `tasklyzen-gamification-ui.js`. El motor consulta primero el ledger
  sostenible y usa el historial anterior solo cuando un día aún no tiene un
  registro nuevo, preservando compatibilidad.
- Ajustes y notificaciones: sus modulos propios; evitar duplicar defaults en
  `main.js`.
- Acceso inicial: `tasklyzen-auth.js` espera el primer estado real de Firebase
  y emite `tasklyzen:entry-ready`. La estrategia `google` vuelve a pedir acceso
  si se pierde la sesión; `local` mantiene la entrada sin conexión elegida.
- Experiencia inicial: `tasklyzen-experience.js` se ofrece despues del acceso y
  de la resolucion local/nube. Una Carrera reanudable tiene prioridad. El estado
  `completed` evita repeticiones; `deferred` omite la version actual; Ajustes
  permite abrirla manualmente. La version 2 explica tareas e hitos, Modo Carrera,
  progreso y racha antes de recoger preferencias y metas. Para presentar un
  recorrido renovado, aumentar `WALKTHROUGH_VERSION` sin cambiar las claves
  persistidas.
- Modo Carrera y futuras funciones locales: `tasklyzen-features.js`. La carrera
  conserva un reloj continuo de sesión y acumulados independientes por tarea,
  además de la tarea activa y el conjunto de tareas elegido para la sesión.
  Si una carrera antigua no tiene ese conjunto, se conservan todas las pendientes
  como comportamiento compatible.
  También conserva el borrador de subtareas y la fase Pomodoro. `suspended` permite volver a la
  lista y reanudar sin registrar ni reiniciar la sesión. Pomodoro ofrece solo
  25/5 (hasta 8 ciclos) y 50/10 (hasta 4 ciclos). El motor inserta una pausa
  larga de 20 minutos a mitad de las sesiones extendidas; el aro principal
  representa el bloque activo de la sesión. En contrarreloj se
  configura por ciclos y calcula su duración total. El cierre guarda tiempo,
  ciclos, enfoque, descanso, pausa, tiempo en segundo plano, tiempo por tarea y
  una instantánea de las tareas visitadas para el resumen final, incluso cuando
  el usuario termina antes. Con la preferencia predeterminada, cambiar de
  pestaña no pausa el reloj: los acumulados usan timestamps y el intervalo queda
  marcado como segundo plano. El usuario puede desactivar esa conducta; salir
  explícitamente a Tareas siempre suspende la sesión. `prepareForEntry` transforma una
  carrera interrumpida en una sesión reanudable antes del primer render.
- Crédito sostenible: el tiempo se conserva para analítica, pero una sesión
  solo cuenta como avance gamificado si cierra una tarea o paso clave, o si el
  usuario confirma avance tras al menos 15 minutos. Un bloqueo se conserva para
  análisis, pero no genera recompensa; una sesión no confirmada o marcada como
  no trabajada no suma enfoque. Las estrategias `tasks`, `focus` y `balanced`
  determinan la meta diaria y se fijan por fecha para no reescribir el pasado. Las
  sesiones de 50 minutos o más requieren al menos 5 minutos de pausa para
  clasificarse como sostenibles. Tiempo fuera de la app, solapamientos y
  relojes incoherentes no generan recompensas. La velocidad por sí sola nunca
  aumenta rachas ni misiones. El historial anterior sigue como respaldo hasta
  que una acción actual marca el día como autoritativo.
- Metas y misiones: `Impulso de hoy` edita tareas en `tasks`, minutos en
  `focus` y ambos valores en `balanced`. Las sugerencias usan el historial del
  mismo tipo de progreso. Cada misión expone su unidad (`avances`, `min` o las
  dos) y nunca mezcla requisitos de otro modo.
- Demos de Carrera: `tasklyzen-developer.js` invoca las APIs públicas
  `previewForDeveloper` y `TasklyzenAudio.playRaceCue`; no replica el render ni
  accede al estado interno del motor de audio.
- `main.js`: coordina estado en memoria, persistencia de alto nivel y eventos
  cruzados. La extraccion gradual de reglas puras y efectos de tareas sigue
  siendo trabajo pendiente; no duplicar reglas nuevas dentro del runtime.

## Verificacion

```bash
npm test
node --check main.js
```

`npm test` ejecuta la suite unitaria de modulos y
`tests/tasklyzen-integration.test.js`. Esta ultima cubre el contrato entre
tareas, ciclo de vida, efectos analiticos y progreso sostenible para
completar, reactivar, eliminar y actualizar pasos obligatorios de un hito.

Checklist manual despues de cambios de arquitectura:

- Crear, editar, completar, reactivar y eliminar una tarea.
- Crear un hito, actualizar subtareas y finalizarlo.
- Cambiar tema y abrir/cerrar Ajustes y Progreso.
- Cambiar entre progreso por avances, enfoque y equilibrado; modificar la meta
  de minutos y comprobar el resumen compacto.
- Consultar Analitica y Racha; confirmar que la racha conserva escudos e
  historial.
- Probar Modo Carrera libre y contra reloj, Pomodoro, salida suspendida y las
  opciones de continuar, dejar para después, empezar una carrera nueva y
  terminar anticipadamente con resumen. Cambiar de pestaña debe conservar el
  reloj si segundo plano está activo y pausarlo si la preferencia está apagada.
- Cerrar una Carrera sin tareas y confirmar `Avancé`, `Quedé bloqueado` y
  `No trabajé`; revisar el resultado en Analítica.
- Iniciar sesion y confirmar que tareas, racha y preferencias sincronizan.
- Probar importacion/exportacion y el modo desarrollador.
