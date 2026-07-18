# Contrato De Eventos

## Proposito

F2.3 concentra la forma de escribir eventos sin cambiar las formulas de
producto. Un evento describe una mutacion ya aplicada; no es la fuente de
verdad del estado de una tarea.

## Envelope

Cada evento nuevo incluye:

```js
{
  id: 'event-uuid',
  mutationId: 'uuid-del-intento',
  type: 'task_completed',
  source: 'tasks', // tasks | race | retention | developer
  outcome: 'applied',
  timestamp: 'ISO-8601',
  dateKey: 'YYYY-MM-DD',
  todoId: '...',
  subtaskId: null
}
```

`tasklyzen-domain-events.js` rechaza un segundo evento con el mismo
`mutationId`, tipo, tarea y subtarea. Una misma mutacion puede producir dos
eventos distintos solo si tienen objetivos distintos, por ejemplo el paso y el
hito que se sincroniza.

## Tipos Activos

| Dominio | Eventos |
| --- | --- |
| Tarea | `task_created`, `task_edited`, `task_completed`, `task_reactivated`, `task_deleted`, `task_expired`, `task_auto_deleted` |
| Subtarea | `subtask_completed`, `subtask_reactivated`, `subtask_deleted`, `subtask_promoted` |

Los eventos de subtarea incluyen `subtaskTitle`, `subtaskOptional` y
`subtaskRequired` para conservar su contexto aun cuando el hito se edite.

## Fuentes De Metricas

- `todos` y los eventos de ciclo de vida reconstruyen tareas creadas,
  completadas y eliminadas en `dailyStats` y `completionHistory`.
- Los eventos de subtarea sirven para auditoria y actividad; no incrementan por
  si solos el conteo de tareas completadas.
- `tasklyzen-sustainable-progress` conserva creditos diarios por tarea y por
  paso obligatorio. Es la fuente de progreso sostenible, no la UI.

F2.4 migrara el flujo completo de hitos para decidir atomica y explicitamente
como se representa el ultimo paso obligatorio frente al cierre automatico del
hito. F2.3 no altera esa regla de producto: solo evita escritura duplicada y
deja trazabilidad verificable.
