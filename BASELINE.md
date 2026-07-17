# Tasklyzen Baseline

## Registro

- Fecha: 2026-07-16 21:20:44 -06:00.
- Alcance: estado local sin commit, previo a cambios estructurales del roadmap.
- Navegador: Codex In-app Browser en `http://127.0.0.1:8043/index.html`.
- Node: v20.11.1.

## Comprobaciones reproducibles

| Comprobacion | Resultado |
| --- | --- |
| `npm test` | Correcto: 3 pruebas, 0 fallos. |
| `node --check <archivo>` para los 30 archivos JavaScript | Correcto. |
| `git diff --check` | Correcto: sin errores de espacios. Solo avisos CRLF/LF de Git. |
| Carga inicial en navegador | Correcta: sin errores de consola. |

## Humo minimo en navegador

- [x] La pagina inicia, muestra el creador y el estado vacio de tareas.
- [x] El panel Progreso abre Rendimiento y vuelve a cerrarse con su boton.
- [x] Ajustes abre y cierra con su boton visible, sin errores de consola.
- [x] La lista de tareas, filtros, Modo Carrera y creacion de tarea son visibles.
- [ ] Crear, editar, completar, reactivar y eliminar una tarea real.
- [ ] Crear y completar un hito con pasos obligatorios y opcionales.
- [ ] Vencimiento, retencion, racha, Carrera, respaldo e inicio de sesion.

Los casos sin marcar no se ejecutaron para no alterar datos locales durante la
linea base. Se cubriran de forma aislada en la Fase 3 con datos de prueba.

## Hallazgo conocido

Con foco en el boton `Cerrar configuracion`, la tecla `Esc` no cierra el panel.
El cierre por boton funciona y no aparecen errores de consola. Registrar este
caso como defecto de accesibilidad para F3.4; no corregirlo dentro de F0.

## Limites de esta linea base

- No se probo Firestore ni reglas de seguridad: no hay reglas en el repositorio.
- La suite actual usa Node y DOM simulado; no reemplaza pruebas de navegador.
- No se midio rendimiento en dispositivos modestos ni se revisaron lectores de
  pantalla.

## Uso

Antes de una entrega estructural, repetir las comprobaciones de esta pagina y
ampliar el bloque de humo solo cuando exista una semilla de datos controlada.
