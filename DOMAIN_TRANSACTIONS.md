# Contrato De Mutaciones Y Eventos

## Proposito

Fase 2 fija y centraliza las reglas actuales de mutacion. Una accion
de usuario debe tener una mutacion de dominio, una persistencia coherente y una
secuencia determinista de efectos.

## Propietarios Actuales

| Capa | Responsabilidad actual |
| --- | --- |
| `TaskManager` | Crea, completa, reactiva, elimina y limpia tareas simples. |
| `TasklyzenCompositeTasks` | Normaliza subtareas y decide si un hito queda completo o reactivado. |
| `TasklyzenTaskEffects` | Registra eventos, creditos sostenibles y revocaciones. |
| `TasklyzenTaskTransactions` | Aplica las mutaciones de tareas simples, hitos y subtareas antes de persistir. |
| `main.js` | Coordina estado en memoria, render, audio y animaciones. |
| `TasklyzenSustainableProgress` | Ledger diario idempotente por `todoId`, `todoId:subtaskId` y `sessionId`. |

## Fuentes De Datos

| Fuente | Rol actual | Regla F2 |
| --- | --- | --- |
| `todos` | Estado canonico de tareas, hitos y subtareas activas. | Fuente de verdad de estado actual. |
| `tasklyzen-analytics-events` | Eventos de ciclo de vida, limitado a 1500 registros. | Historial de eventos; necesita identidad de mutacion para reintentos. |
| `todo-completion-history` | Conteos reconstruidos desde tareas y eventos. | Cache de compatibilidad para racha; no agregar reglas nuevas aqui. |
| `tasklyzen-daily-stats` | Resumen derivado de tareas y eventos. | Cache derivada; nunca resolver conflictos con ella. |
| `tasklyzen-sustainable-progress` | Ledger de acciones significativas y sesiones de Carrera. | Fuente de verdad de progreso sostenible y tiempo confirmado. |
| `todo-gamification` | Escudos y protecciones; la racha se calcula desde historial/ledger. | No acreditar directamente desde UI. |

## Matriz Del Comportamiento Actual

| Accion | Cambio de estado | Persistencia y analitica | Progreso y racha | UI, audio o feedback |
| --- | --- | --- | --- | --- |
| Crear tarea | Agrega una tarea nueva mediante `TaskManager.create`. | Guarda `todos`; registra `task_created`; reconstruye estadisticas. | No otorga credito ni racha. | Render completo y retencion de vencidas. |
| Editar tarea | Cambia titulo, prioridad, fecha y `updatedAt`. | Guarda `todos`; registra `task_edited`; reconstruye historial y estadisticas. | No cambia creditos. | Sale de edicion y renderiza. |
| Completar tarea simple | `completed`, fechas de cierre y `updatedAt`; un habito crea su siguiente ocurrencia. | Guarda `todos`; registra `task_completed`; reconstruye historial. | Registra `todoId` en ledger; puede activar racha y meta. | Sonido regular o animacion de meta; render conservando scroll. |
| Reactivar tarea simple | Borra cierre, reinicia fecha limite y elimina siguiente ocurrencia de habito. | Guarda `todos`; registra `task_reactivated`; reconstruye historial. | Revoca el credito si se completo hoy. | Render conservando scroll. |
| Cambiar subtarea obligatoria | Alterna subtarea y sincroniza estado del hito dentro de una transaccion. | Guarda `todos`; registra `subtask_completed` o `subtask_reactivated` y el evento del hito si cambia. | Registra o revoca `todoId:subtaskId` cuando no es el cierre final. | Parchea subtarea o renderiza preservando scroll. |
| Ultima subtarea obligatoria | `synchronizeCompositeTask` cierra el hito y fija sus fechas. | Guarda `todos`; registra el paso y `task_completed` con `composite: true`. | Acredita solo el hito; el evento del paso declara `progressCredit: false`. | Animacion y posible celebracion de racha. |
| Reactivar un hito | Al desmarcar un paso obligatorio, el hito vuelve a pendiente. | Guarda `todos`; registra `task_reactivated` con `composite: true`. | Revoca el credito de hito y el del paso si corresponde hoy. | Actualiza lista sin reiniciar scroll. |
| Eliminar tarea no vencida | Quita tarea y siguiente ocurrencia de habito. | Quita `todos`, eventos y creditos relacionados. | Revoca creditos asociados. | Render completo. |
| Eliminar tarea vencida o por retencion | Quita tarea. | Conserva un evento `task_deleted`, `task_expired` o `task_auto_deleted`. | No revive creditos descartados. | Puede mostrar aviso critico de retencion. |
| Eliminar o promover subtarea | Quita paso o lo hace obligatorio; puede reconfigurar hito. | Guarda `todos`; registra `subtask_deleted` y, si aplica, `subtask_promoted`. | Revoca o registra credito del paso segun su estado. | Actualiza el hito. |
| Cerrar Carrera | No muta una tarea por si sola. | Guarda resumen en el ledger sostenible. | Aporta tiempo confirmado y sesiones sostenibles. | Muestra resumen de sesion. |

## Decisiones Fijadas Por Pruebas

1. Al cerrar un hito por su ultima subtarea obligatoria, el ledger acredita el
   hito. El paso final conserva su evento, pero no un segundo credito.
2. Los eventos se deduplican por `mutationId`, tipo y objetivo mediante
   `tasklyzen-domain-events.js`. Una accion de subtarea conserva el mismo
   `mutationId` cuando tambien sincroniza un hito.
3. `completionHistory` y `dailyStats` se recalculan varias veces dentro de una
   accion. Son caches validas, pero no deben producir efectos propios.
4. El borrado tiene reglas correctas de retencion, pero sus revocaciones y su
   evento deben formar parte de la misma transaccion observable.

## Contrato Objetivo De Transaccion

El controlador de transacciones mantiene `main.js` como orquestador. Cada
operacion publica devuelve un resultado con esta forma:

```js
{
  mutationId: 'uuid-estable-por-intento',
  action: 'task_completed',
  source: 'tasks' /* tasks | race | retention | developer */,
  occurredAt: 'ISO-8601',
  dateKey: 'YYYY-MM-DD',
  target: { todoId: '...', subtaskId: null },
  changed: true,
  before: { completed: false },
  after: { completed: true },
  events: [],
  credits: [],
  feedback: { sound: 'regular', animation: null }
}
```

El orden obligatorio sera:

1. Validar entrada y localizar objetivo.
2. Aplicar una sola mutacion de dominio con `TaskManager` o
   `TasklyzenCompositeTasks`.
3. Construir efectos derivados una sola vez usando `TasklyzenTaskEffects`.
4. Persistir tareas, eventos y ledger como una unidad local.
5. Recalcular caches (`completionHistory`, `dailyStats`) sin generar eventos.
6. Recalcular racha despues del estado persistido.
7. Renderizar y reproducir feedback solo cuando `changed` sea verdadero.

## Contrato Objetivo De Evento

Los tipos actuales se mantienen durante la migracion: `task_created`,
`task_edited`, `task_completed`, `task_reactivated`, `task_deleted`,
`task_expired` y `task_auto_deleted`. F2.3 agrega `subtask_completed`,
`subtask_reactivated`, `subtask_deleted` y `subtask_promoted` sin cambiar
retrospectivamente los datos existentes.

Todo evento nuevo debe incluir:

```js
{
  id: 'event-uuid',
  mutationId: 'uuid-de-la-transaccion',
  type: 'task_completed',
  source: 'tasks',
  timestamp: 'ISO-8601',
  dateKey: 'YYYY-MM-DD',
  todoId: '...',
  subtaskId: null,
  outcome: 'applied'
}
```

`mutationId` permite rechazar un segundo efecto de la misma accion. Un evento
solo se conserva cuando la transaccion cambia el estado o cuando la regla de
retencion exige registrar el retiro de una tarea vencida.

## Invariantes De Fase 2

- Completar una tarea ya completada no genera evento ni credito nuevo.
- Reactivar revoca solo el credito asociado a la fecha de la finalizacion.
- Una tarea eliminada antes de vencer pierde eventos y creditos; una vencida
  conserva su huella de retencion.
- Un hito solo se cierra por sus pasos obligatorios.
- Carrera llama las mismas transacciones que la lista y solo agrega
  `source: 'race'` y `sessionId`.
- Caches y UI no son fuente de verdad ni pueden modificar metricas por si solas.

## Alcance Implementado De Fase 2

Crear `tasklyzen-task-transactions.js` como adaptador de `TaskManager`,
`TasklyzenCompositeTasks`, `TasklyzenTaskEffects` y persistencia inyectada.
La migracion cubre completar, reactivar y eliminar tareas simples; sincronizar,
completar, reactivar, reordenar, eliminar, promover y convertir hitos y
subtareas. `tasklyzen-domain-events.js` normaliza y deduplica eventos; el
ultimo paso obligatorio conserva un solo credito asociado al cierre del hito.
