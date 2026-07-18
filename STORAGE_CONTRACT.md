# Contrato De Almacenamiento

## Estado

Inventario F1.1 de las claves locales de Tasklyzen. Describe el comportamiento
actual y la frontera objetivo para F1.2; no cambia todavia los datos guardados.

## Reglas Base

- Una clave nueva debe declarar propietario, duracion, respaldo y destino cloud.
- La nube solo recibe datos canonicos del usuario, nunca estado de interfaz,
  herramientas de desarrollo ni relojes activos del dispositivo.
- Las estructuras derivadas pueden reconstruirse desde tareas y eventos. No son
  fuente de verdad para resolver conflictos.
- Importar y borrar deben conocer todas las claves que pertenezcan al usuario.
- Una migracion debe ser idempotente: ejecutarla dos veces deja el mismo estado.

## Inventario

| Clave | Propietario y contenido | Estado actual | Destino F1 |
| --- | --- | --- | --- |
| `todos` | Tareas, hitos y subtareas. | Nube y respaldo. Define el dialogo de conflicto actual. | Canonica sincronizable. |
| `tasklyzen-analytics-events` | Eventos historicos de tareas y sesiones. | Nube y respaldo. | Canonica sincronizable; F2 definira su contrato final. |
| `tasklyzen-sustainable-progress` | Ledger diario de progreso sostenible y sesiones validadas. | Nube y respaldo. | Canonica sincronizable. |
| `todo-daily-goal` | Meta diaria historica de tareas. | Nube y respaldo. | Canonica sincronizable mientras exista esta clave. |
| `todo-gamification` | Racha, escudos y dias protegidos. | Nube y respaldo. | Canonica sincronizable. |
| `tasklyzen-experience-state` | Estado y version del recorrido inicial. | Nube y respaldo, con conciliacion especial por version/estado/fecha. | Preferencia sincronizable. |
| `todo-completion-history` | Conteos historicos que sirven de compatibilidad para rachas. | Nube y respaldo. | Derivada transitoria; F2 decidira si se reconstruye o migra. |
| `tasklyzen-daily-stats` | Resumen diario heredado para analitica. | Nube y respaldo. | Cache derivada transitoria; no debe resolver conflictos. |
| `todo-progress-view` | Pestana de Progreso abierta por ultima vez. | Nube y respaldo. | Preferencia local del dispositivo. |
| `tasklyzen-analytics-flow-period` | Rango visual seleccionado en analitica. | Nube y respaldo. | Preferencia local del dispositivo. |
| `todo-developer-snapshot` | Snapshot y datos de pruebas del panel desarrollador. | Nube y respaldo. | Solo local; excluir de nube y de respaldos de usuario. |
| `tasklyzen-local-features` | Estado de funcionalidades locales, incluida Carrera activa, reloj y borrador de sesion. | Nube y respaldo. | Mixta. Separar sesion activa local de historial durable antes de sincronizarla. |
| `tasklyzen-settings` | Tema, avisos, sonido, animaciones, modo de progreso y metas de enfoque. | Nube y respaldo. | Mixta. Separar preferencias de dispositivo de metas que afectan progreso. |
| `tasklyzen-overdue-review` | Dialogo pendiente, decisiones y fecha de revision de vencidas. | Nube y respaldo. | Estado operativo local; la retencion durable vive en tareas y eventos. |
| `tasklyzen-login-strategy` | Eleccion local: acceso Google o uso sin conexion. | Local solamente; no esta en `storageKeys`. | Local solamente, pero debe incluirse en el borrado total. |

## Claves Retiradas

`TasklyzenDataMigration` retira las claves y campos de logros heredados. La
operacion actual es permanente y se ejecuta al leer datos locales o cloud:

- claves `achievements`, `todo-achievements`, `todo-achievement-state`,
  `tasklyzen-achievements`, `tasklyzen-achievement-state` y
  `tasklyzen-achievement-collection`;
- campos y eventos relacionados con `achievement` o `logro` dentro de datos
  heredados.

F1.3 debe probar una segunda ejecucion sobre el mismo backup y confirmar que no
se alteran tareas, eventos no retirados, rachas ni progreso.

## Brechas Confirmadas

1. `cloudStorageKeys` se deriva hoy de todas las claves configuradas. Por ello
   sincroniza preferencias locales, snapshot de desarrollo y Carrera activa.
2. El dialogo de conflicto se activa solo por `todos`; las demas claves no
   tienen una politica generica de conciliacion.
3. El borrado total y el respaldo recorren `storageKeys`, pero no incluyen
   `tasklyzen-login-strategy`. Tras borrar datos, la eleccion de acceso puede
   permanecer en este dispositivo.
4. Importar un respaldo ausente elimina claves conocidas. Antes de separar
   esquemas, F1.3 debe cubrir importaciones antiguas y parciales.
5. No existen reglas de Firestore versionadas en el repositorio. F1.4 debe
   definirlas y verificarlas fuera del cliente.

## Decisiones Para F1.2

1. Completado: `cloudStorageKeys` es una lista explicita de datos duraderos y
   caches compatibles. Ya no sube interfaz, desarrollo, ajustes ni Carrera
   activa.
2. Completado: `cloudDeletionKeys` conserva las claves sincronizadas por
   versiones anteriores para que el borrado total las retire de Firestore.
3. Mantener compatibilidad de lectura para las claves mixtas hasta que exista
   una migracion que las divida sin perder preferencias ni sesiones.
4. Definir conjuntos separados para nube, respaldo completo, respaldo de
   diagnostico y borrado total.
5. No usar `todo-completion-history` ni `tasklyzen-daily-stats` como fuente de
   verdad nueva: F2 consolidara eventos y ledger antes de retirar caches.

## Responsabilidad Por Modulo

- `tasklyzen-config.js`: nombres de claves y conjuntos de politica.
- `tasklyzen-storage.js`: lectura/escritura local, whitelist cloud y conflicto.
- `tasklyzen-data-migration.js`: saneamiento idempotente de datos heredados.
- `tasklyzen-settings.js`: respaldo, importacion y borrado, usando conjuntos
  de politica inyectados en vez de una lista implicita.
- `tasklyzen-auth.js`: estrategia de entrada local, incluida en el borrado
  total pero excluida de nube.

## Verificacion Requerida

- [x] Una clave local no aparece en `uploadLocalToCloud` ni en `pushToCloud`.
- [x] Repetir la migracion de datos retirados no cambia tareas ni campos ya
  saneados.
- [x] Importar reemplaza solo las claves declaradas en el respaldo y conserva
  `tasklyzen-login-strategy` como preferencia del dispositivo.
- [x] Cuando tareas local y cloud difieren, los dos botones del dialogo
  conservan exactamente la copia elegida.
- [ ] Separar respaldo normal, diagnostico y borrado total; el respaldo actual
  todavia recorre todas las claves configuradas.
- [ ] Borrar todos los datos debe eliminar tambien `tasklyzen-login-strategy`
  y permitir iniciar de nuevo el recorrido de entrada.
- [ ] Repetir sincronizacion completa no debe duplicar eventos; F2 definira la
  fuente de verdad de eventos y caches derivadas.

## Reglas Remotas

F1.4 agrega `firestore.rules` y `firebase.json`. Las reglas permiten solamente
que el UID autenticado lea o modifique `/users/{uid}`, restringen creacion y
actualizacion a `cloudStorageKeys` y rechazan valores no serializados. La
prueba local valida que la lista de reglas y la configuracion no se desalineen.
