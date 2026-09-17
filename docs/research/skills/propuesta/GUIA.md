# Guía sencilla del paquete de skills (2026-09-17)

Este documento explica, con palabras simples, qué es cada cosa de esta carpeta, dónde se
pone y cuándo entra en juego. Está escrito para leerlo de corrido antes de decidir si se
adopta.

## La idea en una frase

Separar lo que es verdad en cualquier proyecto (la **doctrina**) de lo que es verdad solo
en este proyecto (la **vinculación**), y hacer que el segundo archivo se genere con un
asistente en vez de escribirlo a mano.

Hoy en WordRush las dos cosas están mezcladas en la misma skill, y por eso la doctrina
habla de migraciones y colas que aquí no existen.

## Vocabulario

- **Skill**: una carpeta con un archivo `SKILL.md` que Claude lee cuando el trabajo que
  le pides encaja con su descripción. Es un manual de "cómo se trabaja aquí".
- **Doctrina**: las reglas de arquitectura que valen para cualquier proyecto con ese
  stack (NestJS, React). Viven dentro de la skill, en `references/`.
- **Vinculación** (`project.md`): el archivo que dice qué partes de la doctrina aplican
  a este repo y cuáles no, más los comandos y las convenciones de la casa.
- **Plantilla** (`.template`): un molde que se copia dentro del repo y ahí se rellena.
  El molde nunca se edita; el archivo copiado sí.
- **Regla por ruta** (`rules/`): un archivo corto que Claude carga solo cuando toca
  archivos de cierta carpeta.
- **Hook**: un pequeño programa que Claude Code ejecuta solo en un momento fijo, por
  ejemplo después de editar un archivo o al terminar una respuesta.
- **Agente**: un Claude aparte, con sus propias herramientas y su propia postura, al que
  se le encarga una tarea concreta (aquí, revisar).

## Las piezas, una por una

### 1. `skills/backend/` y `skills/frontend/` — la doctrina

Qué son: el manual universal de cómo se estructura un servidor NestJS y una interfaz
React. Cada sección empieza con una condición: "solo si el proyecto tiene base de
datos", "solo si usa React Query". Si la condición no se cumple, la sección se salta.

Dónde van: en tu carpeta global, `~/.claude/skills/backend` y `~/.claude/skills/frontend`.
Una sola copia sirve para todos tus proyectos.

Cuándo actúan: cada vez que pides trabajo de servidor o de interfaz. Claude lee la
descripción de la skill, carga las ~140 líneas del `SKILL.md`, y abre solo las
referencias que la vinculación marca como aplicables. Lo demás no gasta memoria.

Dentro de cada una:

| Archivo | Qué es |
|---|---|
| `SKILL.md` | El índice y los pasos de trabajo. Lo primero que se lee. |
| `references/architecture.md`, `domain.md`, … | La doctrina por tema. Se abren bajo demanda. |
| `references/pitfalls.md` | Errores que se cometen en cualquier proyecto. Universal. |
| `references/project.md.template` | Molde de la vinculación. |
| `references/project-pitfalls.md.template` | Molde del libro de errores del repo. Se genera vacío. |
| `references/examples/wordrush-*.md` | Cómo quedarían la vinculación y el libro de errores en WordRush. Son ejemplos, no se usan. |

### 2. `skills/bind-project/` — el asistente que vincula

Qué es: la skill que ata la doctrina a un repo concreto. Hace tres cosas: mira el repo
(`package.json`, carpetas, scripts, CI, despliegue), pregunta como mucho cuatro cosas que
no puede deducir, y escribe la vinculación y todo lo que la acompaña.

Dónde va: global, `~/.claude/skills/bind-project`.

Cuándo actúa: una vez por proyecto nuevo, cuando dices "vincula las skills a este
proyecto", y otra vez si el stack cambia. Antes de escribir nada te muestra el
`project.md` generado y espera tu aprobación.

Qué genera dentro del repo:

- `.claude/skills/backend/references/project.md` y el de frontend, con la tabla
  "aplica / no aplica".
- `.claude/skills/*/references/project-pitfalls.md`, vacíos.
- La descripción de cada skill con las palabras reales del proyecto.
- `.claude/rules/*.md` desde las plantillas.
- `.claude/corrections.md` desde su plantilla.
- `.claude/settings.json` desde su plantilla.
- Los dos hooks en `.claude/hooks/`.
- Un comando `verify` en el `package.json` de la raíz.
- Opcional: un workflow mínimo de GitHub Actions que corre `verify` en cada push.
- Tres líneas en `CLAUDE.md` que apuntan a todo lo anterior.

### 3. `project.md` — la vinculación (generado)

Qué es: el archivo que manda sobre la doctrina. Dice el stack real, el mapa de módulos,
qué temas de la doctrina aplican y cuáles no, los comandos oficiales de verificación,
las convenciones de la casa y las trampas conocidas.

Cuándo se lee: siempre, antes que la doctrina. Si la doctrina y `project.md` se
contradicen, gana `project.md`. Si el código y `project.md` se contradicen, gana el
código y hay que arreglar `project.md`.

### 4. `project-pitfalls.md` — el libro de errores del repo (generado, vacío)

Qué es: una línea con fecha por cada error que el proyecto ya pagó: qué pasó, por qué, y
dónde aplicar la lección. Ejemplo de WordRush: "2026-09-15 — la palabra nunca viaja en
un evento antes de `round:end`".

Cuándo se lee: antes de dar por terminado un cambio. Cuándo se escribe: cada vez que se
arregla un bug que valdría la pena no repetir. Se genera vacío a propósito: un libro de
errores copiado de otro proyecto es peor que uno vacío, que es justo el problema que tiene
hoy el `pitfalls.md` del backend de WordRush.

### 5. `corrections.md` — la memoria entre sesiones (generado)

Qué es: la lista de correcciones que has tenido que repetirme. Una línea fechada por
corrección: qué, por qué, cómo aplicarlo. La plantilla viene sembrada con las de este
proyecto: nada de coautoría en los commits, encadenar comandos con `&&` y no con `;`, el
formateador mueve los textos que uso como ancla, los heredocs rompen las barras
invertidas.

Cuándo se lee: siempre, porque `CLAUDE.md` lo carga al empezar. Es la única memoria que
sobrevive de una sesión a otra. Cuando pasa de unas 40 líneas, las que ya son estables se
promueven a una regla por ruta.

### 6. `rules/templates/` — reglas por ruta

Qué son: cuatro moldes de reglas cortas con una cabecera `paths:` que dice a qué carpetas
se aplican:

- `presentation-layer.md`: los controladores y gateways son finos; validar, llamar a un
  caso de uso, devolver.
- `api-adapters.md`: los adaptadores encapsulan el transporte; los eventos empujados van
  a stores, nunca a hooks.
- `verification.md`: qué tiene que estar en verde antes de reportar una tarea terminada.
- `git.md`: sin coautoría, sin push si no se pide, rama antes de committear en `main`.

Cuándo actúan: Claude Code las carga solas cuando toco un archivo que coincide con sus
rutas. No están en memoria el resto del tiempo.

### 7. `settings/settings.json.template` — los ajustes

Qué es: el archivo de configuración de Claude Code para el repo. Lo importante:

- `includeCoAuthoredBy: false` y `attribution` vacío: la no-atribución deja de ser una
  frase en un documento y pasa a ser configuración. No depende de que nadie se acuerde.
- Los dos hooks registrados (ver siguiente punto).
- Permisos: lectura sin preguntar, `push`, `publish` y `docker` preguntan, y `.env`,
  `push --force` y `commit --no-verify` denegados. Los comandos de despliegue a
  producción no van en la lista de permitidos, nunca.

El JSON no admite comentarios, así que las notas van en una clave `_notes` que el
asistente borra al copiarlo.

Cuándo actúa: Claude Code lo lee al arrancar en ese repo.

### 8. `hooks/` — dos programas automáticos

- `format.mjs`: después de cada edición, pasa Prettier por ese archivo si el paquete
  tiene configuración. Nunca bloquea.
- `stop-typecheck.mjs`: al terminar cada respuesta, corre `tsc --noEmit` sobre los
  archivos que cambié, agrupados por su `tsconfig`, con un tope de 150 segundos. Informa
  y nunca bloquea. Sirve para que el error de tipos aparezca en el momento y no al final
  de la tarea.

### 9. `agents/verifier.md` — el revisor

Qué es: un Claude aparte cuyo único trabajo es buscar fallos en lo que otro escribió. No
tiene herramientas de escritura, así que no puede "arreglar de paso" nada: solo reporta.
Parte de la postura de rechazar, trae una lista de falsos positivos que debe ignorar, y
tiene permiso explícito para devolver cero hallazgos.

Dónde va: global, `~/.claude/agents/verifier.md`.

Cuándo actúa: cuando quieras una revisión con la cabeza fresca, sobre todo en tareas
largas. La regla de fondo: quien escribe el código no lo verifica.

### 10. `pnpm verify` — la verificación en un comando

Qué es: un script en el `package.json` de la raíz que encadena con `&&` los comandos
oficiales del repo (typecheck, lint, tests, build de cada lado, y lo específico como
`check-contract`).

Cuándo actúa: antes de reportar cualquier tarea como terminada, y en la CI en cada push.
Con esto la verificación deja de depender de que Claude recuerde una lista.

## El flujo completo en un proyecto nuevo

1. Instalas el paquete en global una vez (README).
2. Abres el repo nuevo y pides "vincula las skills a este proyecto".
3. El asistente inspecciona el repo y te hace como mucho cuatro preguntas.
4. Te enseña el `project.md` generado; lo apruebas o lo corriges.
5. Escribe el resto (reglas, correcciones, ajustes, hooks, `verify`, `CLAUDE.md`) y
   corre `verify` una vez para comprobar que el comando existe. Si el repo está en rojo,
   lo dice; arreglarlo no es parte de la vinculación.

Desde ahí, la doctrina no se toca. Lo que crece con el proyecto son tres archivos:
`project.md` cuando cambia el stack, `project-pitfalls.md` con cada bug pagado, y
`corrections.md` con cada corrección repetida.

## Qué cambiaría en WordRush si se adopta

- Las dos skills dejan de mencionar MUI, React Query, TypeORM y BullMQ como si existieran.
- El `pitfalls.md` del backend deja de ser el libro de errores de otro proyecto.
- Aparecen `corrections.md`, `project-pitfalls.md`, el `verify` y la CI.
- La no-atribución pasa a `settings.json`.
- Nada de esto cambia el juego ni su código.

Los ejemplos ya escritos de la vinculación de WordRush están en
`skills/backend/references/examples/` y `skills/frontend/references/examples/`.
