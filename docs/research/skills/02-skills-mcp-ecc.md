# 02 · Skills, MCP, ECC y loops — lectura de 13, 15, 16, 17 y dos repos

Fecha: 2026-09-16. Fuentes leídas: `docs/research/skills/13.md`, `15.md`, `16.md`,
`17.md` con todas sus imágenes, y los repos clonados
`docs/research/skills/repos/ECC/` y `docs/research/skills/repos/Agentic-Design-Patterns/`.

Contraste contra el montaje real: `CLAUDE.md`, `.claude/settings.json`,
`.claude/settings.local.json`, `.claude/hooks/format.mjs`, `.claude/rules/*.md`,
`.claude/skills/backend/`, `.claude/skills/frontend/` y `docs/context/`.

---

## 1. Nota a nota, repo a repo

### 13.md — "MCP vs Skills" (imagen `image-36.png`)

Infografía de Level Up Coding con la única distinción que importa: **MCP es la capa de
conexión** (host → cliente MCP → servidor MCP → sistemas externos: Slack, Gmail, Jira,
bases de datos) y **las skills son playbooks reutilizables** (`SKILL.md` más scripts y
referencias opcionales) que corren dentro del entorno que el agente ya tiene. "MCP da
alcance, las skills dan oficio". El resto del post es publicidad de un plugin de
Atlassian para imputar coste de IA a tickets de Jira; se ignora.

1. Criterio de decisión limpio: si el agente **no puede llegar** a algo (sistema
   externo, API con auth), es MCP; si **puede llegar pero no sabe cómo lo hacemos
   aquí**, es una skill. Todo nuestro trabajo cae en el segundo caso.
2. El modelo elige la skill comparando la petición contra la **metadata** (`name` +
   `description`), no contra el cuerpo. La `description` del frontmatter es lo único
   que se lee siempre: debe enumerar disparadores concretos, no describir la doctrina.
3. Una skill puede llamar herramientas y ejecutar scripts, no es sólo prosa. Nosotros
   no tenemos ni un script dentro de las skills: todo son `.md`.
4. El registro de skills es plano; la única jerarquía es interna
   (`SKILL.md` → `references/`). Es lo que ya hacemos.

### 15.md — dos posts: la carpeta del "turno de noche" y el anuncio de ECC

**Post A (`image-37.png`, "ANATOMY OF A LOOP")**: la carpeta con la que alguien dejó de
abrir Claude a medianoche. Cuatro bloques: *el contrato* (`CONTRACT.md` versionado +
`contract.local.md` gitignorado con overrides personales); *el arnés* (`.claude/loops/`
con `settings.json` de topes de gasto y timeouts, `schedule.yml` de cuándo dispara cada
turno, `rubrics/` con `code.md`, `writing.md` y `safety.md` como correctores, y una
carpeta por loop tipo `pr-hunter/` con `plan.md` + `act.sh`); *el estado* (`receipts/`
con una carpeta por turno —5.382 guardados—, `trace.log` y `checkpoint.json` para
reanudar); y *los bordes* (`kill.sh` como botón de pánico y `.mcp.json` como lista de
herramientas permitidas). Pie de la imagen: 6 loops, 3 rúbricas, 8 meses, 0 incidentes,
`kill.sh` nunca usado.

**Post B**: anuncio de ECC (ganador de un hackathon de Anthropic, MIT): 68 subagentes,
286 skills, 94 comandos. La frase que sí vale: *"empieza por un solo plan y un solo pack
de reglas; encender las 286 skills a la vez es la forma más rápida de empeorarlo"*.

1. **Separar contrato versionado de overrides locales.** Nosotros ya lo tenemos donde
   importa (`settings.json` / `settings.local.json`), pero no en prosa.
2. **Rúbricas como fichero aparte de la doctrina**, con criterios de aceptación.
   Nuestra "Validation checklist" vive al final de cada `SKILL.md` y sólo la ve quien ya
   cargó la skill entera.
3. **Recibos con fecha**: una carpeta por sesión con lo hecho y su veredicto. Nuestro
   equivalente parcial, `docs/context/04-decisions-and-pending.md`, es mejor (razona el
   porqué) pero sólo cubre reglas de juego, no cambios de código.
4. **`checkpoint.json` para reanudar**: sólo tiene sentido con trabajo desatendido.
5. **`.mcp.json` como lista blanca explícita por loop**, no global.
6. **`kill.sh` nunca usado** es el dato honesto del post: el arnés se paga en montaje,
   no en uso.

### 16.md — el libro de Kimi, "$100K/mes sin nómina" (imágenes 39–44)

297 páginas, 8 partes, 40 capítulos (índice en `image-39.png`) sobre montar un negocio
operado por agentes: Kimi K3 como cerebro, Kimi Code como manos, Skills como memoria
institucional, MCP como llaves de los sistemas, AgentSwarm como plantilla paralela y una
capa de aprobaciones como valla. Es material de fundador, no de ingeniería, y el 90 % no
aplica a un juego de dos personas; tres piezas sí están bien pensadas.

1. **El bucle de mejora de una skill**: "el agente falla → lo pillas → añades una regla →
   la skill mejora → todos los trabajos siguientes usan el proceso mejorado". Es la
   intención declarada de nuestro `pitfalls.md`, hoy sin usar (ver §2).
2. **La tabla de autonomía** (`image-41.png`): leer / investigar / analizar / redactar →
   automático; actualizaciones de bajo riesgo → condicional; enviar contratos, compras,
   **borrar registros, desplegar a producción**, comunicación externa → requieren
   aprobación. Traducible directo a nuestros permisos.
3. **"No gastes una llamada de modelo en lo que resuelve un parser"**
   (`input → ¿comando conocido? → sí → local; no → al modelo`). Aplicado: toda
   verificación determinista (typecheck, lint, `check-contract`, Prettier) debería ser
   hook o script, no una instrucción en prosa que el modelo *recuerde* ejecutar.
4. **"El moat no es el modelo"** (`image-43.png`): `Producto = Modelo + Experiencia +
   Workflow + Herramientas + Memoria + Gobernanza`. Es el argumento para seguir
   invirtiendo en `.claude/` y `docs/context/` en vez de en prompts.
5. AgentSwarm y el "Company OS" (cockpit, heartbeat, aprobaciones) son ruido aquí: no
   hay volumen que paralelizar.

### 17.md — recursos de loop engineering (imagen `image-45.png`)

Tres lecturas en orden (el post "Getting started with loops" de Claude, un hilo de
polydao y el *Loop Engineering orange book*) más una infografía que define el concepto
mejor que el texto: **prompt engineering = lazo abierto** (`y = f(x)`, sin estado, nadie
mira la salida) frente a **loop engineering = lazo cerrado** (GOAL → PLAN → ACT → VERIFY;
si no cumple spec, REFLECT → ITERATE; si cumple, DONE). "Un prompt es una muestra; un
loop es un controlador".

El repo `repos/loop-engineering/` (asignado a otra parte del análisis) tiene dos
documentos que valen aquí aunque no montemos loops: `docs/loop-design-checklist.md` y
`docs/anti-patterns.md`.

1. **El verificador no puede ser quien implementa** (anti-patrón nº 1: "una sesión marca
   su propio trabajo como hecho después de correr los tests una vez"). Postura por
   defecto del verificador: RECHAZAR.
2. **Tope de intentos**: nada de "sigue hasta que CI esté verde"; 3 intentos y escalada
   con contexto completo.
3. **L1 antes que L3**: primero sólo informar; actuar, después.
4. **Rutas denegadas** (auth, pagos, secretos, infra) antes de dar autonomía.
5. La checklist de diseño es un buen filtro de honestidad: si no puedes decir en una
   frase qué hace y qué **no** hace el loop, no hay loop.

### Repo `repos/ECC/` — Everything Claude Code (affaan-m, MIT, v2.2.1)

Plugin de Claude Code con **292 skills, 68 agentes, 94 comandos**, 54 scripts de hooks
enganchados a 7 eventos, 23 packs de reglas por lenguaje, `mcp-configs/` con 33
servidores, instaladores para 18 harnesses distintos y un dashboard en Python. Su tesis,
en el README: `plan → test → implement → review → verify → remember → improve`, y
*"Optimize the context window. Persist everything else."*

**Cómo escribe las skills**: 278 de las 292 son **sólo** un `SKILL.md`; 12 usan
`references/` y 14 llevan `scripts/`. Longitud mediana 191 líneas (p25 128, p75 333, max
888). Frontmatter real en las 292: `name` (292), `description` (292),
`metadata.origin: ECC` (265); `tools` sólo en 11 y `allowed-tools` en 2. El cuerpo sigue
siempre la misma plantilla (`CONTRIBUTING.md`): `## When to Activate` ("crítico para la
auto-activación") → `## Core Concepts` → `## Code Examples` → `## Anti-Patterns` →
`## Best Practices` → `## Related Skills`. El conocimiento se parte en **muchas skills
estrechas** (`postgresql-indexing`, nunca `databases`) en vez de en una skill grande con
índice: la decisión de diseño opuesta a la nuestra, y las dos son defendibles.

Artefactos que vale la pena robar (rutas dentro de `docs/research/skills/repos/ECC/`):

| Fichero | Qué es | Por qué |
|---|---|---|
| `skills/verification-loop/SKILL.md` (129 líneas) | Seis fases en bloques de shell — build, `tsc --noEmit`, lint, tests con cobertura, grep de secretos (`sk-`, `api_key`, `console.log`), `git diff --stat` — y una plantilla fija de informe `VERIFICATION REPORT` con `Overall: [READY/NOT READY]` | Lo más copiable del repo entero. Es nuestra "Validation checklist" convertida en procedimiento con salida estructurada |
| `agents/code-reviewer.md` (323) | Revisor con `tools: Read, Grep, Glob, Bash` y `model: sonnet`. Lo valioso: `## Confidence-Based Filtering`, `### Pre-Report Gate`, `### It Is Acceptable And Expected To Return Zero Findings` y `## Common False Positives - Skip These` | Es el contrato anti-ruido que un equipo de dos necesita más que el checklist |
| `agents/typescript-reviewer.md` (124) | Revisor TS: establece el alcance del diff sin hardcodear `main`, corre typecheck y lint **antes** de opinar, hallazgos por severidad (CRITICAL/HIGH/MEDIUM) y la regla "NO refactorizas, sólo reportas" | Molde directo para un `reviewer.md` nuestro |
| `agents/planner.md` (221) | Planificador con `tools: Read, Grep, Glob` — **sin Write ni Edit**: la restricción de herramientas *es* la garantía de que no toca código. `model: opus` | El truco de enforcement más barato del repo |
| `docs/SKILL-DEVELOPMENT-GUIDE.md` (919) | Cómo escribir una skill: campos de frontmatter, tabla Skill / Agent / Command / Hook / Rule, "foco bueno vs demasiado amplio", checklist de validación | El documento que a nosotros nos falta |
| `scripts/ci/validate-skills.js` | Valida que cada carpeta de `skills/` tenga `SKILL.md` no vacío con `name` y `description`, y que `description` no use escalar literal (`\|`, `\|-`), que rompe los renderizadores | ~150 líneas sin dependencias raras. (Nuestro `>` plegado está bien; el problemático es el literal) |
| `scripts/ci/validate-rules.js`, `validate-agents.js`, `validate-commands.js`, `validate-hooks.js` | Mismo patrón para el resto de componentes | |
| `rules/README.md` | Modelo de herencia en dos capas: `common/` agnóstico (sin frontmatter, siempre activo) + carpetas por lenguaje con `paths:` en frontmatter que **extienden** y referencian a su contraparte. Precedencia explícita: lo específico gana sobre lo general | Es exactamente nuestra relación doctrina ↔ `project.md`, escrita como política |
| `rules/common/testing.md` (57) | AAA (Arrange-Act-Assert), nombres de test que describen comportamiento, "arregla la implementación, no el test" | Copiable casi literal |
| `rules/common/git-workflow.md` (24) | Commits `<type>: <description>`; y el dato clave: ECC pone `"includeCoAuthoredBy": false` en `settings.json` en vez de pedirlo en prosa | Resuelve de raíz la regla global sobre `Co-Authored-By` |
| `rules/common/development-workflow.md` (44) | Paso 0 obligatorio de "Research & Reuse" antes de implementar nada | |
| `rules/common/code-review.md` (124), `rules/common/security.md` (29) | Disparadores de revisión, niveles de severidad, criterios de aprobación; checklist de 8 puntos pre-commit | |
| `rules/typescript/hooks.md` (22) | Fragmentos literales de hooks PostToolUse y Stop para `settings.json` | |
| `scripts/hooks/stop-format-typecheck.js` (251) + `post-edit-accumulator.js` | Hook `Stop`: acumula los ficheros editados durante la respuesta, los agrupa por raíz de proyecto y por `tsconfig`, y lanza **un** formateo y **un** `tsc --noEmit` por grupo, con presupuesto de tiempo. ECC movió deliberadamente el formateo/typecheck de `PostToolUse` a `Stop` | Es la versión correcta de lo que nosotros hacemos fichero a fichero |
| `scripts/hooks/config-protection.js` (176) | Bloquea modificar configs de linter/formatter: "los agentes las modifican para que los checks pasen en vez de arreglar el código" | Barato y muy real |
| `scripts/hooks/block-no-verify.js` | `PreToolUse` que bloquea (exit 2) `--no-verify` y `-c core.hooksPath=` en git | |
| `scripts/hooks/pre-bash-dev-server-block.js` (229) | Impide arrancar servidores de desarrollo que bloquean la sesión | Nos pasa con `pnpm dev:backend` / `dev:frontend` |
| `CLAUDE.md` (el propio de ECC) | Tiene una sección `## Skills` que es una **tabla glob → skill** (`*.tsx`, `components/**` → `react-patterns`, `react-testing`) y cierra con "cuando lances subagentes, pásales las convenciones de la skill correspondiente" | El mecanismo más barato del repo para atar skills a rutas, y copiable tal cual |
| `.github/PULL_REQUEST_TEMPLATE.md` | What Changed / Why / Testing Done / Type of Change / checklist de seguridad con prefijos literales de secreto (`ghp_`, `sk-`, `AKIA`, `xoxb`) | |
| `skills/database-migrations/SKILL.md` (430) | Incluye sección **TypeORM**, `## Migration Safety Checklist`, estrategia zero-downtime y `## Anti-Patterns` | Útil el día que haya base de datos |
| `skills/react-testing/SKILL.md` (424) | RTL + Vitest + MSW + axe, `## Query Priority`, `## When NOT to Use Snapshot Tests`, `## Coverage Targets` | Nuestro frontend usa Vitest y no tiene doctrina de test |
| `skills/living-docs-governance/SKILL.md` | Asigna roles a los docs existentes (constitución / mapa / estado / historia) y dice explícitamente "prefiere adoptar la estructura actual antes que crear ficheros nuevos en la raíz" | Describe lo que `docs/context/` ya es |
| `mcp-configs/mcp-servers.json` | Menú de 33 servidores, no config. Aviso propio: **"mantén menos de 10 MCP activos para preservar la ventana de contexto"**. Incluye `railway` (`@railway/mcp-server`), `context7`, `playwright`, `github` | El único con motivo claro aquí es `railway`, y sólo cuando haya jugadores reales |

Lo que **no** hay que copiar: el arranque de `hooks/hooks.json`, donde cada hook es un
`node -e "..."` de ~1 KB que busca la raíz del plugin en seis rutas de
`~/.claude/plugins/`; es deuda de distribuir como plugin, y nosotros tenemos
`$CLAUDE_PROJECT_DIR` y una línea. Tampoco los 292 directorios de skills: conviven
`blender-motion-state-inspection` y `carrier-relationship-management` con `api-design`,
hay una `continuous-learning` marcada `[DEPRECATED]` en su propia `description`, y el
repo tuvo que escribir una skill llamada `skill-stocktake` para auditar su propio
catálogo. Ése es el coste real de la estrategia de muchas skills pequeñas. Y el
`## Prompt Defense Baseline` de seis viñetas repetido al principio de los 68 agentes es
peaje de distribución pública, no de un repo privado de dos personas.

### Repo `repos/Agentic-Design-Patterns/` (Antonio Gulli)

Libro de 424 páginas (PDF completo incluido) más 97 notebooks, uno por variante de
patrón. 21 capítulos: patrones **core** (prompt chaining, routing, parallelization,
reflection, tool use, planning, multi-agent), **avanzados** (memoria, aprendizaje y
adaptación, MCP, goal setting y monitorización), **de producción** (excepciones,
human-in-the-loop, RAG) y **enterprise** (A2A, optimización de recursos, razonamiento,
guardarraíles, evaluación, priorización, exploración). El código es Python sobre Google
ADK, LangChain/LangGraph, CrewAI y Vertex: nada ejecutable aquí.

1. **Vocabulario**: pone nombre a lo que los posts venden como novedad. El "turno de
   noche" de 15.md es *Goal Setting + Reflection + Memory*; las rúbricas son *LLM as a
   Judge* (cap. 19); `kill.sh` y la tabla de aprobaciones son *Guardrails* (cap. 18) y
   *Human-in-the-Loop* (cap. 13).
2. **Cap. 4 (Reflection) y cap. 19 (Evaluation)** son la base del ciclo VERIFY → REFLECT
   de 17.md, con la misma advertencia: el crítico debe ser un paso distinto con su
   propio contexto.
3. **Cap. 12 (Exception Handling and Recovery)**: fallback y tope de reintentos.
4. **Cap. 16 (Resource-Aware Optimization)**: la misma idea de no gastar modelo en lo
   que resuelve un script.
5. Los capítulos de multi-agente y A2A confirman que la coordinación cuesta más que la
   paralelización salvo con volumen real.

Veredicto: lectura, no copia. No genera ningún cambio en `.claude/`.

---

## 2. Cómo escriben las skills los demás vs cómo las escribimos nosotros

### La forma de cada uno

| Dimensión | ECC (292 skills) | Posts (13, 15, 16) | Nosotros (2 skills) |
|---|---|---|---|
| Granularidad | Una skill por tema estrecho; la guía prohíbe `databases` o `react` | Una skill por proceso de empresa | Dos skills por **capa del repo**, con 9–10 `references/` cada una |
| Longitud | Mediana 191 líneas, todo en `SKILL.md` | ~30 líneas de ejemplo | `SKILL.md` de ~140–150 líneas + 3.480 líneas de referencias |
| Divulgación progresiva | Casi nula: 278 de 292 son un solo fichero | No se menciona | Real: índice de temas que dice **cuándo** abrir cada referencia; el workflow nombra los ficheros |
| Vínculo con el proyecto | Skills portables y ciegas al repo; el enganche se deja a `CLAUDE.md` y a `examples/*-CLAUDE.md` | "Skills = memoria institucional" | `references/project.md` leído **siempre primero** y que **gana** sobre la doctrina; y el código gana sobre `project.md` |
| Workflows | "When to Activate" + conceptos; pocos pasos numerados | Secciones + un `## Rules` | Workflows A–E numerados, con el orden de implementación y qué fichero abrir en cada paso |
| Checklist de validación | En una skill aparte (`verification-loop`) y en hooks; no dentro de cada skill | "aprobación humana para lo irreversible" | Al final de cada `SKILL.md`: comandos exactos + invariantes del repo |
| Frontmatter | `name`, `description`, `metadata.origin`; agentes añaden `tools:` y `model:` | — | Sólo `name` y `description` (escalar plegado `>`) |
| Ejecutables dentro | Sí: `scripts/`, ejemplos compilables, validadores CI | Sí (`act.sh`) | No: todo prosa |
| Anti-patrones | `## Anti-Patterns` obligatorio en la plantilla | `docs/anti-patterns.md` en loop-engineering | DO/DON'T en `frontend/references/conventions.md`; `pitfalls.md` en backend |
| Agentes / comandos | 68 + 94 | — | Ninguno |

### Huecos concretos nuestros

1. **`.claude/skills/backend/references/pitfalls.md` es de otro proyecto.** 220 líneas
   sobre borrado de buckets, cuotas, papelera, sync y SSRF de una API de disco en la
   nube. El propio fichero avisa ("Inherited ledger… Add this project's own hard-won
   rules at the end, dated") y nadie ha añadido nada. El `SKILL.md` ordena leerlo
   **antes de terminar cualquier cambio**: hoy eso es gastar contexto en reglas de un
   repo que no existe. WordRush tiene su propio ledger sin escribir (la palabra nunca
   sale antes de `round:end`, rivales sólo en colores, el reloj sólo en use cases,
   `bind()` con guarda de StrictMode, el límite de emotes por jugador y no por socket,
   `CONTRACT_VERSION` + `sync-contract` en el mismo commit).
2. **La `description` del frontmatter de frontend describe la doctrina, no los
   disparadores.** Dice que los ejemplos están en MUI + React Query "pero lo que este
   repo usa está en project.md": eso lo lee el modelo *antes* de decidir si carga la
   skill, y ni MUI ni React Query existen aquí.
3. **No hay ni un subagente ni un comando.** `.claude/agents/` y `.claude/commands/` no
   existen. La revisión con contexto fresco —lo único de ECC que no tenemos en ninguna
   forma— hoy es imposible: quien escribe el código decide que está bien.
4. **La checklist de validación es prosa que hay que recordar.** `pnpm typecheck`,
   `lint:check`, `jest`, `build` y `check-contract` están al final de dos `SKILL.md` y
   no los ejecuta nada. El único hook que existe formatea. No hay CI: `.github/` no
   existe.
5. **No está escrito cómo se escribe una skill de este repo.** Si mañana hace falta una
   tercera (contrato, diseño, despliegue), no hay plantilla ni criterio de cuándo algo
   es skill, regla o hook.
6. **La doctrina de frontend sigue hablando MUI en los sitios equivocados.** El Workflow
   D del `SKILL.md` ordena `<Typography>`, `<Stack>`, `sx` y `CircularProgress`, que no
   existen en el repo, y obliga a saltar a `project.md` en cada paso. `project.md` gana,
   pero el coste de token y de error se paga cada vez.
7. **No hay `pitfalls.md` de frontend.** Los errores ya pagados del cliente están
   dispersos entre `conventions.md` y `.claude/rules/frontend-api-hooks.md`.
8. **Nada valida el frontmatter ni las rutas.** No se comprueba que `name`/`description`
   existan, que las referencias de la tabla de índice existan, ni que los `paths:` de
   `.claude/rules/*.md` apunten a algo real — `backend-migrations.md` apunta a
   `backend/src/migrations/**`, que hoy no existe (el propio fichero lo dice).
9. **Nada impide desplegar sin preguntar.** `.claude/settings.local.json` tiene
   `Bash(railway:*)` y `Bash(node scripts/railway-deploy.mjs:*)` en `allow`: las dos
   filas que la tabla de 16.md marca como "needs approval".

### Lo que hacemos mejor

1. **Divulgación progresiva de verdad.** ECC mete todo en un `SKILL.md` plano y se
   defiende multiplicando skills; nosotros cargamos ~150 líneas y abrimos el resto bajo
   demanda, con una tabla que dice *cuándo* leer cada fichero. Con 3.480 líneas de
   referencias, ésa es la diferencia entre caber y no caber en contexto.
2. **`project.md` que gana sobre la doctrina.** ECC no tiene equivalente: sus skills son
   portables y ciegas al repo. Nuestra regla "léelo primero; si discrepa con la
   doctrina, manda `project.md`; si discrepa con el código, manda el código y arregla el
   fichero" es mejor ingeniería que 292 skills genéricas. (ECC llega a la misma idea,
   pero sólo para reglas: `rules/README.md` dice que lo específico gana sobre lo común.)
3. **Workflows numerados con orden de implementación.** "ORM entity → domain entity →
   repositorio → mapper → use case → DTO → controller" o "DTO + mapper → Model → hook →
   container → component → page" es accionable; "When to Activate" no.
4. **Reglas por ruta con `paths:`**, que el harness carga solo al tocar esa ruta. ECC
   deja `rules/common/` siempre activo y sólo usa `paths:` en los packs de lenguaje.
5. **`docs/context/` como fuente de verdad separada de la doctrina**, con README de
   mantenimiento, fechas completas y la regla de no duplicar. El log de
   `04-decisions-and-pending.md` razona el *porqué* de cada cambio de regla: más útil
   que cualquier `receipts/` de 15.md, y no lo tiene ninguno de los repos leídos.
6. **El contrato como fuente de verdad tipada**, con `pnpm check-contract` que falla si
   las dos copias divergen, y la decisión explícita de **no** reescribir la tabla de
   eventos en prosa porque "una copia en prosa de una fuente de verdad tipada deriva en
   cuanto alguien cambia el tipo". ECC no tiene ese reflejo en ningún sitio: su
   `AGENTS.md` duplica a mano la tabla de 68 agentes.
7. **El hook que no bloquea.** `format.mjs` sale con 0 ante cualquier fallo, filtra por
   extensión y por proyecto, comprueba binario y config, y maneja `.cmd` en Windows: 56
   líneas legibles frente a un `node -e` de 1 KB.

---

## 3. Qué aplica a WordRush

Proyecto de dos personas, sin CI, sin base de datos, sin producción crítica. El filtro
es: **¿esto arregla un error que ya nos ha pasado, o es un arnés para un problema que no
tenemos?**

| Idea (origen) | Veredicto | Cambio concreto en `.claude/` |
|---|---|---|
| Ledger de errores propio del repo (16.md; ECC `rules/common/`) | **Útil ya** | Reescribir `.claude/skills/backend/references/pitfalls.md`: borrar buckets, cuotas, papelera, sync y media; conservar los patrones genéricos (idempotencia, comprobación de propiedad primero, nada de `catch` vacío) y abrir `## WordRush (2026-09-16)` con lo ya pagado aquí: la palabra nunca en un payload antes de `round:end`; rivales sólo colores; el reloj se calcula en use cases y se emite como snapshot; el límite de emotes es por jugador, no por socket; cambiar un evento implica `CONTRACT_VERSION` + `sync-contract` + DTO del cliente en el mismo commit |
| El mismo ledger en el cliente (ECC) | **Útil ya** | Crear `.claude/skills/frontend/references/pitfalls.md` y añadirlo a la tabla de índice del `SKILL.md` con "Final review of any change": doble suscripción en StrictMode, ningún `setTimeout` local que termine una ronda, nada de hex ni `var(--x)` en `className`, ningún string fuera del diccionario `es`/`en`, cero imports entre features |
| La `description` como único metadato de selección (13.md; ECC `scripts/ci/validate-skills.js`) | **Útil ya** | Reescribir la `description:` de `.claude/skills/frontend/SKILL.md`: fuera MUI y React Query, dentro los disparadores reales (Tailwind v4, Zustand, socket.io, feature slice, store, tablero, teclado, emotes, i18n ES/EN). Mantener el `>` plegado |
| Verificación determinista como hook, no como prosa (16.md `image-42`; ECC `stop-format-typecheck.js`) | **Útil ya** | Nuevo `.claude/hooks/verify.mjs` + entrada `Stop` en `.claude/settings.json`: acumula qué proyectos se tocaron y corre `pnpm -C backend typecheck`, `pnpm -C frontend typecheck` y `pnpm check-contract` **una vez** al final de la respuesta, sólo para los proyectos tocados. Modo informe (nunca exit 2) la primera semana, con la misma disciplina de `format.mjs` |
| `"includeCoAuthoredBy": false` (ECC `rules/common/git-workflow.md`) | **Útil ya** | Añadirlo a `.claude/settings.json`. Hoy la prohibición vive sólo en `CLAUDE.md` y en la memoria global; con el ajuste el harness deja de añadir la línea |
| Tabla de autonomía / aprobaciones (16.md `image-41`) | **Útil ya** | Quitar de `allow` en `.claude/settings.local.json` las dos entradas de despliegue (`Bash(railway:*)`, `Bash(node scripts/railway-deploy.mjs:*)`): desplegar es exactamente la fila "needs approval" |
| Tabla glob → skill en `CLAUDE.md` (ECC, su propio `CLAUDE.md`) | **Útil ya** | Añadir a `CLAUDE.md` una tabla de cuatro filas: `backend/**` → skill `backend`; `frontend/**` → skill `frontend`; `*/shared/contract/**` → regla de contrato; `docs/context/**` → "edita el doc antes que el código". Cuesta diez líneas y quita ambigüedad sobre qué cargar |
| Cómo se escribe una skill de este repo (ECC `docs/SKILL-DEVELOPMENT-GUIDE.md`, `CONTRIBUTING.md`) | **Útil ya** | `.claude/skills/README.md` de una página: molde (`SKILL.md` ≤ ~150 líneas + `references/` + `project.md` obligatorio), qué va en `description`, cuándo algo es skill vs `rules/*.md` con `paths:` vs hook, y la regla de que una referencia sólo se crea si algún workflow la nombra. Añadir ahí las dos ideas sueltas de 17.md: el implementador no valida su propio trabajo, y tope de 3 intentos antes de escalar |
| Skill de verificación con informe estructurado (ECC `skills/verification-loop/SKILL.md`) | **Útil ya, en versión mínima** | No una skill nueva: mover las dos "Validation checklist" a un único `.claude/rules/verification.md` sin `paths:` (siempre activo, ~30 líneas) con los comandos reales de los dos proyectos y una plantilla de informe corta (typecheck / lint / tests / contract / build → LISTO o NO LISTO). Los `SKILL.md` lo referencian en vez de repetirlo |
| Revisor con contexto fresco que no puede tocar código (ECC `agents/code-reviewer.md`, `agents/typescript-reviewer.md`, `agents/planner.md`; 17.md anti-patrón nº 1) | **Útil más adelante** | Cuando haya tandas de cambios grandes: `.claude/agents/reviewer.md` con `tools: Read, Grep, Glob, Bash` (sin Write ni Edit, como `planner.md`), que corra typecheck + lint + tests antes de opinar, lea `docs/context/02`, `03` y `06`, reporte por severidad y **sólo reporte**. Copiar tal cual el bloque "es aceptable y esperado devolver cero hallazgos" + "falsos positivos a ignorar". Hoy `/code-review` del harness cubre el 80 % |
| Validador de frontmatter y rutas (ECC `scripts/ci/validate-skills.js`, `validate-rules.js`) | **Útil más adelante** | `scripts/validate-claude.mjs`: cada `SKILL.md` tiene `name` y `description`; cada referencia de la tabla de índice existe; cada glob `paths:` de `.claude/rules/*.md` casa con algo real. Barato, pero sólo paga con más de dos skills |
| Regla de contrato por ruta | **Útil más adelante** | Cuarto fichero `.claude/rules/contract.md` con `paths: ['backend/src/shared/contract/**', 'frontend/src/shared/contract/**']`: bump de `CONTRACT_VERSION`, `pnpm sync-contract`, DTO del cliente en el mismo commit. Hoy eso vive repartido en dos reglas |
| Testing como regla escrita (ECC `rules/common/testing.md`, `skills/react-testing/`) | **Útil más adelante** | Hay ~28 specs y ninguna regla sobre cómo se escriben. Añadir 5 líneas de AAA y nombres descriptivos a `.claude/skills/backend/references/testing.md`, y crear el equivalente mínimo en frontend (Vitest). **No** copiar el 80 % de cobertura obligatorio ni el TDD estricto de ECC |
| `config-protection` y `block-no-verify` (ECC `scripts/hooks/`) | **Útil más adelante** | Cuando haya hooks de git o CI. Impedir que se afloje `eslint.config.js` o `tsconfig` para que pasen los checks es real, pero hoy no ha pasado |
| Separar `CONTRACT.md` de `contract.local.md` (15.md) | **Ruido** | Ya lo tenemos donde importa (`settings.json` / `settings.local.json`). Un `CONTRACT.md` en la raíz duplicaría `CLAUDE.md` |
| `.claude/loops/`, `schedule.yml`, `receipts/`, `trace.log`, `checkpoint.json`, `kill.sh` (15.md) | **Ruido** | No hay turno de noche que cubrir: ni usuarios ni despliegue continuo ni cola de PRs. El propio post admite que `kill.sh` nunca se usó. `docs/context/04-decisions-and-pending.md` ya es el recibo que sí leemos |
| `rubrics/code.md`, `writing.md`, `safety.md` (15.md) | **Ruido tal cual, útil la idea** | No crear `rubrics/`: los criterios ya están escritos; lo que falta es que alguien o algo los ejecute. Es la fila del hook `Stop` y la de `.claude/rules/verification.md` |
| Servidores MCP (13.md, 16.md, ECC `mcp-configs/mcp-servers.json`) | **Ruido hoy** | Nada de lo que hacemos queda fuera del alcance de las herramientas nativas: repo local, sin base de datos, despliegue por script, sin Jira. El único candidato con motivo claro es `railway` (`@railway/mcp-server`) para leer logs de producción, y sólo cuando haya jugadores reales quejándose. El propio ECC avisa de no pasar de 10 MCP por contexto, y su `.mcp.json` real sólo declara uno |
| AgentSwarm / multi-agente (16.md; ADP caps. 7 y 15) | **Ruido** | 7 módulos de backend y 4 features de frontend no dan trabajo que paralelizar; la coordinación costaría más que el trabajo |
| 292 skills, 68 agentes, packs por lenguaje, dashboard (ECC) | **Ruido** | Un solo stack (TS en ambos lados) y dos personas. ECC necesitó una skill (`skill-stocktake`) para auditar sus propias skills |
| Loop engineering completo (17.md, orange book) | **Ruido hoy, lectura útil** | No montar loops. Robar sólo las dos reglas de higiene al escribir tareas largas, que van en `.claude/skills/README.md`, no en un arnés |
| `## Prompt Defense Baseline` en cada agente (ECC) | **Ruido** | Peaje de distribuir públicamente a 18 harnesses; un repo privado de dos personas no lo necesita |

### Orden sugerido

1. `.claude/settings.json`: `"includeCoAuthoredBy": false`, y sacar el despliegue del
   allowlist de `settings.local.json`. Diez minutos, cero riesgo.
2. Los dos `pitfalls.md` (reescribir el de backend, crear el de frontend). El cambio con
   más valor por línea: convierte 220 líneas de contexto ajeno en las reglas que este
   repo ya pagó.
3. La `description` del frontmatter de frontend.
4. `.claude/rules/verification.md` + la tabla glob → skill en `CLAUDE.md`.
5. `.claude/hooks/verify.mjs` con el hook `Stop`, en modo informe.
6. `.claude/skills/README.md` con el molde y la regla skill / rule / hook.
7. Lo demás, cuando haga falta y no antes.

---

## Imágenes verificadas al cierre

Repaso de las imágenes de `15.md` y `16.md` que el informe no citaba por nombre. Sólo se
anota lo que añade algo.

- **`image-38.png` (`15.md`, el árbol completo de componentes de ECC).** Muestra dos capas
  que el análisis del repo no llegó a describir: el catálogo de `commands/` (`/plan`,
  `/quality-gate`, `/checkpoint`, y sobre todo `/skill-create`, que genera una skill a
  partir del historial de git, más `/learn` → `/evolve` → `/prune`, que acumulan
  "instintos" de sesión y los agrupan en skills) y `contexts/` (`dev.md`, `review.md`,
  `research.md`: prompts de sistema inyectados según el modo de trabajo). El ciclo
  aprender → destilar → podar es la versión ejecutable del ledger de errores que aquí
  seguimos queriendo a mano.
