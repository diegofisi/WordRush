# Resumen de la investigación sobre skills (2026-09-16)

Diecisiete notas, 46 imágenes y cinco repos clonados, leídos por cuatro agentes con
nuestro `.claude/` delante. Los informes por tema:

- `01-contexto-limites-loops.md` — notas 1, 2, 3, 4, 8; repos de loop engineering.
- `02-skills-mcp-ecc.md` — notas 13, 15, 16, 17; repos ECC y Agentic-Design-Patterns.
- `../otros/03-marketing-rag-agentes.md` — notas 5, 6, 11 (movido: no trata de skills ni de código).
- `04-infra-latencia-sistemas.md` — notas 7, 9, 10, 12, 14; repo system-design-notes.

## De qué va todo esto, en tres frases

Casi todo el material es de un mismo género: gente que hace que un agente trabaje
solo durante horas (loops, enjambres, turnos de noche) y descubre que lo único que
sostiene eso es escribir las reglas en archivos versionados que el agente lee antes de
actuar, y que alguien distinto del que escribió el código lo verifique. El resto
(grafos de conocimiento, 300 agentes, MCP para todo, marketing con 188 modelos, RAG,
contenedores desde cero) es andamiaje alrededor de esa idea o directamente otro tema.

## Lo que se repite en varias fuentes

| Idea | Dónde se explica mejor | Nosotros |
|---|---|---|
| Las correcciones viven en un archivo, no en el chat | 3.md, 4.md, Orange Book | A medias: `04-decisions` cubre las reglas del juego, no los errores de trabajo |
| Un índice de contexto que apunta a los archivos correctos | 1.md (`references.md`) | Ya: `CLAUDE.md` + `references/project.md` |
| Quien escribe el código no lo verifica | Orange Book §05, ECC `agents/code-reviewer.md` | No: la checklist es prosa que corre el mismo agente |
| El gate de calidad fuera del control del agente | 15.md, ECC hook `Stop` | No: sin CI, sin comando único de verificación |
| Divulgación progresiva (poco en contexto, mucho bajo demanda) | 13.md, ECC (mal), nosotros (bien) | Ya, y mejor que ECC |
| MCP solo para lo que el agente no alcanza | 13.md | Correcto no tener ninguno hoy |

## Qué sirve ya (ordenado por valor por minuto)

1. **`settings.json`: `includeCoAuthoredBy: false`** en el proyecto, y quitar de
   `settings.local.json` el permiso de desplegar sin preguntar. Diez minutos.
2. **Reescribir `skills/backend/references/pitfalls.md`** con los errores de este
   repo (la palabra nunca antes de `round:end`, rivales solo colores, el reloj solo en
   use cases, emotes por jugador y no por socket, `CONTRACT_VERSION` + sync) y crear el
   equivalente en frontend. Hoy ese archivo es el libro de errores de otro proyecto y la
   skill obliga a leerlo antes de terminar cualquier cambio.
3. **Un `.claude/corrections.md`** con una línea fechada por cada corrección que el
   usuario haya tenido que repetir (coautoría, heredocs con backslashes, prettier que
   mueve anclas, `&&` en vez de `;` para no committear con tests rotos…), cargado por
   `CLAUDE.md`. Es la memoria que sobrevive a la sesión.
4. **Arreglar la `description` de la skill de frontend**: habla de MUI y React Query,
   que no existen aquí; es lo único que decide si la skill se carga.
5. **`pnpm verify` en la raíz** (los nueve comandos de los dos lados más el
   `check-contract`) y un workflow mínimo de GitHub Actions que lo ejecute. Luego un
   hook `Stop` que corra `tsc` por lotes al final de cada respuesta, en modo informe.
6. **`.claude/agents/verifier.md`**: un revisor sin `Write` ni `Edit`, con postura de
   rechazo por defecto y la lista de falsos positivos a ignorar (copiar el bloque
   anti-ruido de ECC). Hoy `/code-review` cubre casi lo mismo; el valor es tenerlo
   documentado para las tareas largas.

## Qué sirve después

- **Drenado del servidor** antes de un despliegue y reprogramar los timers al arrancar:
  es la pieza que faltaba al ítem diferido "sobrevivir un deploy" de `06-v1.1.md`.
- **Test que fije el tamaño serializado de los payloads del socket**: crecen solos con
  cada campo nuevo multiplicado por jugadores y rivales.
- **Rechazo explícito en la mosca** cuando todos los decisores están ocupados, en vez de
  degradar el ritmo de todas las salas (`master`).
- **`@railway/mcp-server`** para leer logs, solo cuando haya jugadores reales.
- Higiene de tareas largas: el implementador no valida su propio trabajo y hay tope
  de tres intentos antes de escalar.

## Qué es ruido para este proyecto

- Turnos de noche, `kill.sh`, `receipts/`, enjambres de 300 agentes, grafos de
  conocimiento con `aliases.csv`, presupuestos de tokens (notas 2, 3, 4, 8, 15, 16, 17
  en su parte operativa).
- Picsart con 188 modelos, niveles de RAG, la guía de "monetiza hoy" (vende servicios
  de agentes a empresas; nada sobre monetizar un juego) (notas 5, 6, 11).
- Caché con TTL (no hay base de datos), filesystem de contenedores, sharding de Redis
  (notas 7, 12; repo system-design). El repo sirve de vocabulario para defender la
  decisión de tener el estado en memoria, no como plan.
- Copiar la granularidad de ECC (292 skills planas): nuestra estructura carga menos
  contexto y es más precisa.

## Lo que ya hacemos bien, según las cuatro lecturas

Doctrina portable con un `project.md` que gana sobre ella; reglas por ruta en vez de
un `AGENTS.md` único; el hook de Prettier determinista que nunca bloquea; el contrato
tipado con `check-contract`; `docs/context/04` como registro de decisiones con fecha y
motivo; el ticker que no difunde estado y deja que el cliente interpole el reloj.
