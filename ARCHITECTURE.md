# Tasklyzen Architecture

## Modulos base

### `tasklyzen-config.js`
- Proposito: llaves de almacenamiento, limites y catalogos estaticos.
- Entradas: ninguna.
- Salidas: `window.TasklyzenConfig`.

### `tasklyzen-storage.js`
- Proposito: lectura, escritura y sincronizacion externa de `localStorage`.
- Entradas: claves y valores serializables.
- Salidas: `window.TasklyzenStorage`.

### `tasklyzen-utils.js`
- Proposito: fechas, timestamps y formateo numerico reutilizable.
- Entradas: valores primitivos, fechas y timestamps.
- Salidas: `window.TasklyzenUtils`.

### `tasklyzen-tasks.js`
- Proposito: fabrica de tareas y predicados operativos.
- Entradas: datos de tarea, `TasklyzenConfig`, `TasklyzenUtils`.
- Salidas: `window.TasklyzenTasks`.

### `tasklyzen-composite-tasks.js`
- Proposito: normalizar subtareas y derivar progreso, finalizacion y reapertura de tareas compuestas.
- Entradas: tarea principal y lista de subtareas obligatorias u opcionales.
- Salidas: `window.TasklyzenCompositeTasks`.
- Regla: `completed` es solo una cache compatible; para `type: "composite"` siempre se sincroniza desde `getCompositeTaskStatus`.

### `components/tasklyzen-ui-components.js`
- Proposito: componentes DOM vanilla reutilizables para tareas, toasts, estados vacios, analitica, rachas y logros.
- Entradas: `documentRef`, datos simples y opciones visuales.
- Salidas: `window.TasklyzenUiComponents`.
- Regla: no leer estado global de la app; recibir datos y devolver DOM o actualizar un nodo concreto.

### `components/tasklyzen-task-creation-ui.js`
- Proposito: sincronizar la variante compacta de fecha de la barra de creacion.
- Entradas: nodo `select`, preset de fecha y etiqueta opcional.
- Salidas: `window.TasklyzenTaskCreationUi`.
- Regla: no persiste datos ni modifica tareas; `main.js` conserva la orquestacion de fechas.

### `tasklyzen-settings.js`
- Proposito: defaults, normalizacion, persistencia, aplicacion visual y sincronizacion de ajustes.
- Entradas: storage, referencias DOM de ajustes, callbacks del runtime y ajustes parciales.
- Salidas: `window.TasklyzenSettings` con `createSettingsController`.

### `tasklyzen-notifications.js`
- Proposito: avisos internos, permisos del navegador, pruebas y recordatorios inteligentes.
- Entradas: referencias DOM de notificaciones, ajustes actuales y callbacks de tareas.
- Salidas: `window.TasklyzenNotifications` con `createNotificationController`.

### `tasklyzen-task-ui.js`
- Proposito: renderizado de tareas, filtros visuales, contadores, foco principal y eventos de lista.
- Entradas: referencias DOM de tareas, predicados de tarea y callbacks del runtime.
- Salidas: `window.TasklyzenTaskUi` con `createTaskUiController`.

### `tasklyzen-overdue-review.js`
- Proposito: detectar tareas vencidas, aplicar la retencion de 30 dias y coordinar la revision persistente cada 7 dias.
- Entradas: tareas, fecha actual, storage, DOM y callbacks de eliminacion del runtime.
- Salidas: calculos puros y `window.TasklyzenOverdueReview` con `createOverdueReviewController`.
- Regla: una revision pendiente conserva IDs y siempre revalida las tareas antes de eliminarlas.

### `tasklyzen-analytics-progress.js`
- Proposito: calculos de rendimiento, comparacion de periodos, graficos simples y renderizado de analitica/progreso.
- Entradas: referencias DOM de progreso, estado de tareas, estadisticas diarias, motor de analitica y callbacks del runtime.
- Salidas: `window.TasklyzenAnalyticsProgress` con `createAnalyticsProgressController`.
- UI: una sola vista `Rendimiento` con porcentaje principal, tendencia, balance, recomendacion y detalles progresivos; no existe un resumen ejecutivo separado.

### `tasklyzen-achievements.js`
- Proposito: construir el catalogo de logros desde callbacks de progreso.
- Entradas: callbacks calculados por el runtime.
- Salidas: `window.TasklyzenAchievements`.

### `tasklyzen-gamification.js`
- Proposito: resolver estado de logros, rachas, escudos, rarezas y recompensas.
- Entradas: catalogo de logros, estado persistido, historial y callbacks del runtime.
- Salidas: `window.TasklyzenGamification` con `createGamificationController`.

### `tasklyzen-gamification-ui.js`
- Proposito: renderizar emblema y estado cotidiano de racha, ruta de prestigio, escudos, vitrina, showcase y cuadricula de progreso.
- Entradas: DOM, estado calculado de gamificacion y utilidades de fecha.
- Salidas: `window.TasklyzenGamificationUi` con `createGamificationUiController`.
- UI de racha: una tarjeta protagonista muestra nivel actual, estado de hoy y siguiente hito; la ruta completa permanece bajo revelado progresivo.

### `tasklyzen-features.js`
- Proposito: registrar funcionalidades locales futuras sin inflar `main.js`.
- Entradas: storage local, definiciones explicitas y contexto inyectado por el runtime.
- Salidas: `window.TasklyzenFeatures` con `plannedLocalFeatures` y `createFeatureRegistry`.
- Regla: las features deben estar apagadas por defecto y no conectar servicios externos.

### `tasklyzen-developer.js`
- Proposito: panel visual, comandos `todoDev` y utilidades de prueba para modo desarrollador.
- Entradas: API interna del runtime, storage, DOM y callbacks de tareas/gamificacion.
- Salidas: `window.TasklyzenDeveloper` con `createDeveloperModeController`.
- Regla: las simulaciones de eliminacion segura crean casos dev controlados y no deben borrar tareas reales por accidente.

### `tasklyzen-dom.js`
- Proposito: referencias DOM compartidas agrupadas por dominio y alias planos compatibles.
- Entradas: `document` cargado al final del `body`.
- Salidas: `window.TasklyzenDom` con grupos `settings`, `notifications`, `tasks`, `feedback`, `overdueReview`, `progress`, `analytics`, `gamification`, `achievements` y `dev`.

## Modulos POO

### `tasks/TaskState.js`
- Proposito: calcular estados inteligentes de tarea.
- Entradas: objeto tarea y API `TasklyzenTasks`.
- Salidas: estados, plazos y predicados de vencimiento.
- Dependencias: `tasklyzen-tasks.js`.

### `tasks/TaskManager.js`
- Proposito: crear, completar, reactivar, eliminar y limpiar tareas.
- Entradas: listas de tareas, cambios de usuario, `TasklyzenTasks`, `TasklyzenUtils`.
- Salidas: tareas mutadas o nuevas listas con resultado de operacion.
- Dependencias: `TaskState`, `tasklyzen-tasks.js`, `tasklyzen-utils.js`.

### `analytics/AnalyticsEngine.js`
- Proposito: calcular metricas y series de progreso sin depender del DOM.
- Entradas: registros diarios, eventos y resumenes de ciclo de tarea.
- Salidas: porcentajes, promedios, mejores dias y series listas para UI.
- Dependencias: `tasklyzen-utils.js` opcional.

### `ui/UIController.js`
- Proposito: operaciones DOM pequenas y consistentes para componentes.
- Entradas: elementos HTML, texto, clases y estados visuales.
- Salidas: DOM actualizado.
- Dependencias: `document` opcional.

### `tasklyzen-oop.js`
- Proposito: puente clasico para ejecutar la app al abrir `index.html` directamente.
- Entradas: APIs globales `TasklyzenTasks`, `TasklyzenUtils` y `TasklyzenDom`.
- Salidas: `window.TasklyzenOOP`.
- Dependencias: `tasklyzen-tasks.js`, `tasklyzen-utils.js`, `tasklyzen-dom.js`.

### `main.js`
- Proposito: orquestar inicializacion, estado global, renderizado y eventos.
- Entradas: modulos globales `Tasklyzen*`, `TasklyzenOOP`, preferencias normalizadas y estado persistido.
- Salidas: UI renderizada, persistencia local y API interna para controladores.

### Configuracion de experiencia
- Proposito: aplicar tema, alertas, sonido, animaciones, analitica simple, respaldo y borrado seguro.
- Entradas: `TasklyzenSettings`, controles del panel fijo y archivos JSON de respaldo.
- Salidas: `tasklyzen-settings`, clases en `body`, controles sincronizados y operaciones de exportacion/importacion.

## Carga

```html
<script src="tasklyzen-config.js"></script>
<script src="tasklyzen-storage.js"></script>
<script src="tasklyzen-utils.js"></script>
<script src="tasklyzen-composite-tasks.js"></script>
<script src="tasklyzen-tasks.js"></script>
<script src="components/tasklyzen-ui-components.js"></script>
<script src="tasklyzen-overdue-review.js"></script>
<script src="components/tasklyzen-task-creation-ui.js"></script>
<script src="tasklyzen-settings.js"></script>
<script src="tasklyzen-notifications.js"></script>
<script src="tasklyzen-task-ui.js"></script>
<script src="tasklyzen-quick-create.js"></script>
<script src="tasklyzen-analytics-progress.js"></script>
<script src="tasklyzen-achievements.js"></script>
<script src="tasklyzen-gamification.js"></script>
<script src="tasklyzen-gamification-ui.js"></script>
<script src="tasklyzen-features.js"></script>
<script src="tasklyzen-developer.js"></script>
<script src="tasklyzen-dom.js"></script>
<script src="tasklyzen-oop.js"></script>
<script src="main.js"></script>
```

Reglas de carga:

- La app usa JavaScript clasico sin bundler para que `index.html` y `achievements.html` puedan abrirse directo.
- Cada modulo expone una API global `window.Tasklyzen*`; `main.js` solo debe orquestar esas APIs.
- No convertir un archivo a ES Modules en navegador sin cambiar explicitamente toda la cadena de carga.
- Cualquier script nuevo debe cargarse antes de `main.js` y despues de sus dependencias reales.
- Los modulos deben tolerar nodos DOM ausentes: `index.html` y `achievements.html` no tienen la misma superficie.

## Almacenamiento local

Claves actuales en `tasklyzen-config.js`:

- `todos`: tareas.
- `history`: historial diario de completadas.
- `dailyGoal`: meta diaria.
- `gamification`: rachas, escudos, logros y vitrina.
- `developerSnapshot`: snapshot del modo desarrollador.
- `progressView`: vista activa de progreso.
- `analyticsEvents`: eventos de analitica.
- `dailyStats`: snapshot diario calculado.
- `analyticsFlowPeriod`: periodo activo del grafico de ritmo.
- `features`: flags y estado de features locales.
- `settings`: preferencias de usuario.
- `overdueReview`: IDs, fecha de creacion y ultima decision de la revision de tareas vencidas.

Reglas para no romper datos existentes:

- Agregar nuevas claves solo en `tasklyzen-config.js`; no escribir strings sueltos de storage en modulos nuevos.
- Leer/escribir mediante `tasklyzen-storage.js` o APIs existentes del runtime.
- No renombrar IDs de logros, rarezas, categorias, tareas o eventos historicos sin migracion explicita.
- Al cambiar una estructura persistida, normalizar datos antiguos con defaults en el modulo propietario.
- Exportar/importar y eliminar datos usan `storageKeys`; una clave nueva debe quedar incluida ahi para respaldo y borrado seguro.
- Las features futuras deben iniciar apagadas por defecto para no alterar sesiones existentes.

## Estilos

`styles.css` es el manifiesto CSS unico que cargan `index.html` y `achievements.html`.
Importa las capas en este orden:

1. `styles/00-base-tokens.css`: reset base y tokens globales.
2. `styles/01-themes.css`: tema base, modo oscuro inicial, analitica simple y clase de animaciones reducidas.
3. `styles/02-settings-notifications.css`: ajustes, notificaciones y dialogo de borrado.
4. `styles/03-layout-brand.css`: contenedores, cabeceras, marca y enlaces principales.
5. `styles/04-task-entry-progress.css`: formulario de tareas, progreso, tabs, racha superior y meta diaria.
6. `styles/05-analytics.css`: rendimiento, graficas, balance y detalles progresivos.
7. `styles/06-gamification.css`: mision diaria, rachas, logros y cuadricula de progreso.
8. `styles/07-tasks.css`: lista de tareas, estados, etiquetas, botones, vencidas y dialogo de revision.
9. `styles/08-feedback-animations.css`: toast, celebraciones, showcase y keyframes asociados.
10. `styles/09-theme-overrides.css`: correcciones tardias de modo claro/oscuro.
11. `styles/10-gamification-overrides.css`: progresion visual de rachas y rarezas.
12. `styles/11-developer.css`: panel de modo desarrollador.
13. `styles/12-responsive.css`: reglas responsive.
14. `styles/13-motion.css`: `prefers-reduced-motion`.
15. `styles/14-beta-features.css`: superficies internas para betas apagadas por defecto.
16. `styles/15-signature-controls.css`: identidad ludica, superficies por dominio, controles tactiles y variantes claro/oscuro.

El orden preserva la cascada original de `styles.css`; no debe cambiarse sin revisar modo claro, modo oscuro y mobile.

### Tokens de diseno

`styles/00-base-tokens.css` separa tres niveles:

1. Primitivos `--color-*`: valores crudos de paleta. Usarlos solo para definir otros tokens.
2. Alias legacy `--ink`, `--paper`, `--teal`, `--blue`, etc.: mantienen compatibilidad con reglas existentes.
3. Semanticos por funcion visual: usar estos en componentes nuevos.

Guia para nuevos componentes:

- Superficies: `--surface-page`, `--surface-panel`, `--surface-panel-muted`, `--surface-info`.
- Texto: `--text-primary`, `--text-secondary`, `--text-strong`, `--text-soft`, `--text-inverse`, `--text-on-accent`.
- Bordes y sombras: `--border-soft`, `--border-strong`, `--border-danger`, `--shadow-raised`, `--shadow-soft`.
- Controles con firma: `--signature-paper`, `--signature-ink`, `--signature-line`, `--signature-primary`, `--signature-info`, `--signature-coral`, `--signature-amber` y sus variantes `-edge`.
- Estados: `--state-success`, `--state-info`, `--state-warning`, `--state-review`, `--state-danger`.
- Progreso y analitica: `--progress-*`, `--chart-created`, `--chart-completed`, `--chart-pending`, `--chart-habit`.
- Tareas: `--task-normal`, `--task-important`, `--task-urgent`, `--task-on-time`, `--task-due-soon`, `--task-expired`.
- Gamificacion: `--streak-*` y `--achievement-*`.
- Movimiento: `--motion-fast`, `--motion-normal`, `--motion-slow`; las clases `body.reduced-animations` y `prefers-reduced-motion` siguen siendo la fuente de apagado.

Los temas visuales se aplican desde `tasklyzen-settings.js` usando clases en `body`. Migrar reglas antiguas por etapas, sin reemplazos masivos de color en una sola tarea.

### Componentes UI vanilla

Los componentes viven en `components/tasklyzen-ui-components.js` y siguen este contrato:

- Reciben `documentRef` y datos ya calculados por el controlador.
- Devuelven nodos DOM o actualizan un nodo especifico, como `renderToast`.
- No consultan `localStorage`, tareas globales, analitica ni gamificacion.
- Mantienen clases CSS existentes para no cambiar la experiencia visual.
- Cubren piezas repetibles por dominio: item de tarea, toast, metrica, donut mensual, grafico simple, tarjeta de logro, logro destacado, paso de prestigio y celda de progreso.

Para crear un componente nuevo:

1. Agregar una funcion pequena en `TasklyzenUiComponents`.
2. Pasar datos desde el controlador que ya conoce el dominio.
3. Evitar listeners internos salvo que el componente sea claramente interactivo.
4. Cubrirlo con un caso minimo en `tests/tasklyzen-modules.test.js`.

## Donde agregar cambios

- Tareas/datos: reglas de creacion, limpieza, vencimiento o disponibilidad van en `tasklyzen-tasks.js`, `tasks/TaskState.js` o `tasks/TaskManager.js`.
- UI de tareas: render, filtros, contadores, estados vacios y acciones de lista van en `tasklyzen-task-ui.js`; piezas DOM repetibles van en `components/tasklyzen-ui-components.js`.
- Analitica/progreso: calculos puros van en `analytics/AnalyticsEngine.js` o helpers de `tasklyzen-analytics-progress.js`; render de paneles/graficos queda en `tasklyzen-analytics-progress.js`.
- Rachas/logros: catalogo en `tasklyzen-achievements.js`, reglas/estado en `tasklyzen-gamification.js`, visuales en `tasklyzen-gamification-ui.js`.
- Ajustes: tema, sonido, volumen, animaciones, respaldo/importacion y borrado seguro van en `tasklyzen-settings.js`.
- Notificaciones: toasts internos, permisos del navegador y recordatorios van en `tasklyzen-notifications.js`.
- Modo desarrollador: controles, comandos `todoDev` y datos de prueba van en `tasklyzen-developer.js`.
- Referencias DOM compartidas: agregar selectores en `tasklyzen-dom.js` agrupados por dominio; los selectores exclusivos de una vista pueden ser locales si son defensivos.
- CSS: usar la capa correspondiente en `styles/`; tokens nuevos en `styles/00-base-tokens.css`, temas en `styles/01-themes.css`, overrides tardios solo si preservan compatibilidad.
- Features futuras: registrar prototipos locales en `tasklyzen-features.js`; no crear UI publica hasta que la feature sea aprobada.
- `main.js`: solo conectar modulos, estado global, carga diferida y eventos de alto nivel.

## Rendimiento y carga diferida

El runtime prioriza la primera interaccion con tareas:

- Inicio critico: ajustes basicos, formulario, lista de tareas, contador, siguiente accion, estados vencidos y progreso diario esencial.
- Inicio diferido: sincronizacion completa de logros, recalculo persistido de `dailyStats`, analitica avanzada, vitrina de logros, ruta de racha, cuadricula de contribuciones y recordatorios periodicos.
- Hidratacion inmediata: si el usuario abre Rendimiento, Racha o Logros, `main.js` hidrata el dashboard completo antes de responder a esa accion.
- Hidratacion por visibilidad: si el panel de progreso entra al viewport, se completa el render con `IntersectionObserver`.
- Hidratacion ociosa: si no hay interaccion, el trabajo pendiente se ejecuta con `requestIdleCallback` o su fallback.

Reglas para nuevas funciones:

1. Mantener crear/completar/reactivar/editar/eliminar tareas fuera del trabajo diferido.
2. No recalcular analitica compleja en el arranque si no se muestra.
3. No instalar observadores pesados hasta que el panel que los usa se hidrate.
4. Si una accion del usuario necesita datos diferidos, hidratar de forma explicita antes de renderizar.

## Modo Carrera y features locales

`tasklyzen-features.js` mantiene una capa local minima para estado interno, pero la app ya no muestra Ajustes > Funciones experimentales.

- `focus-mode`: Modo Carrera integrado por defecto en la seccion Tareas. Cronometra una tarea activa y permite avanzar de forma continua.

El estado se guarda en `tasklyzen-local-features`.
`main.js` crea `featureRegistry`, inicializa `betaFeatureControllers` y expone `window.TasklyzenRuntime.beta` para pruebas internas.

Reglas:

- No agregar interruptores experimentales visibles sin una tarea aprobada.
- Modo Carrera solo trabaja con tareas pendientes. Una tarea simple se completa con `toggleTodoItem`; un Hito se completa al cerrar sus subtareas obligatorias mediante `toggleTodoSubtask`.
- En Modo Carrera, las subtareas de un Hito se marcan primero en un borrador local; no se guardan ni completan el Hito hasta pulsar `Guardar` o `Terminar hito`.
- La superficie visible de Carrera se controla desde el boton `Modo Carrera` en Tareas.
- Las funciones locales nuevas deben ser discretas, apagadas internamente si no tienen UI aprobada y no deben inflar `main.js`.

La interfaz minima de una feature es:

```js
{
    id: 'feature-id',
    label: 'Nombre visible',
    defaultEnabled: true,
    defaultState: {},
    init(context, scope) {},
    render(context, scope) {},
    destroy(context, scope) {}
}
```

Contrato:

- `context` lo entrega `main.js` mediante getters seguros: tareas, ajustes, analitica, racha, DOM y `showToast`.
- `scope` permite leer o actualizar el estado local de esa feature: `getState`, `setState`, `updateState`, `isEnabled`.
- Una feature no debe leer variables globales sueltas ni escribir DOM fuera de su superficie.
- Una feature nueva se registra en `plannedLocalFeatures` o con `featureRegistry.register`.
- Si necesita UI propia adicional, esa superficie debe aprobarse en una tarea aparte; el registro solo crea el interruptor de activacion.
- Si necesita calculos pesados, debe ejecutarlos en `init` bajo demanda o en `render` cuando la superficie sea visible.

## Siguiente corte recomendado

- `achievements/AchievementEngine.js`: logros, rarezas y vitrina.
- `storage/TasklyzenRepository.js`: puente entre clases POO y persistencia.

## Pruebas

```bash
npm test
```

Checklist manual minima despues de cambios de arquitectura:

- Crear, completar, reactivar, editar, eliminar y limpiar tareas hechas.
- Cambiar tema claro/oscuro y abrir/cerrar ajustes.
- Abrir Rendimiento y cambiar periodo semanal/mensual/trimestral.
- Ver Racha, cuadrícula de progreso, Logros destacados y pagina `achievements.html`.
- Probar permiso/test de notificaciones si el navegador lo permite.
- Activar modo desarrollador y crear tareas de muestra en distintos estados.
