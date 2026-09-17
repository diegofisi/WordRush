# Análisis de notas: 5.md, 6.md, 11.md (+ carpetas 1/ y 2/)

Fecha: 2026-09-16 · Lote 3 de la investigación en `docs/research/skills/`.
Criterio de veredicto: utilidad para **WordRush** (NestJS + React, juego multijugador de
palabras; reglas y puntuación en `docs/context/`; skills y hooks en `.claude/`).

---

## 5.md — "188 AI Models Behind One Prompt Bar" (una campaña entera dentro de Picsart)

**Qué dice.** Es una reseña-guía (con tono de contenido patrocinado: incluye link de
plantilla y remate a Telegram/X) sobre montar una campaña creativa completa dentro de
Picsart, usando sus dos capas: *AI Playground* como capa de modelos (188 modelos de 34
proveedores para imagen, vídeo y audio detrás de una sola barra de prompt, pago por
generación con un único saldo de créditos) y *Flow* como capa de flujo de trabajo (lienzo
infinito no-code donde modelos y assets se conectan como nodos). El argumento central no
es el catálogo sino el **enrutado**: cuando todos los modelos viven detrás de una misma
interfaz, elegir modelo deja de ser una decisión de compra y pasa a ser una decisión
creativa. El autor arma un grafo tipo departamento creativo de una persona
(BRIEF → ROUTER → IMAGE → VIDEO → AUDIO → EDIT → REVIEW → EXPORT) y defiende que una
tubería por etapas gana a un único prompt largo porque el fallo se vuelve local en vez de
total. Cierra reconociendo lo que la orquestación no resuelve (el juicio: qué dirección es
buena, qué está listo para publicar, cuándo parar de iterar) y dónde no usarla (un solo
asset, trabajo de plantilla fija).

**Imágenes referenciadas.** `image-8.png`: lienzo oscuro con los artboards del propio
artículo y animaciones del diagrama de flujo. `image-9.png`: el selector de modelos de
Playground (pestañas Video/Image/Audio, filtros por tipo de entrada, tarjetas de
Seedance 2.5, MiniMax H3, FLUX… con el coste en créditos por segundo visible en cada
tarjeta). `image-10.png`: el diagrama de dos capas, Flow (brief → route → generate →
review → export) llamando hacia abajo a Playground (modelos de imagen, vídeo y audio),
con el pie "one graph, one credit balance, one place the assets live".

**Ideas concretas.**
1. Separar capa de modelos y capa de flujo: el flujo no cambia aunque cambien los controles de cada modelo.
2. Enrutar por tarea en vez de casarse con un modelo; el catálogo amplio solo vale si sabés enrutar.
3. Nunca dejar que una sola generación decida el resultado: etapas con assets intermedios visibles.
4. Punto de revisión humano antes de que la siguiente etapa consuma la salida (fallo local, no total).
5. Coste visible antes de ejecutar (el botón de generar muestra los créditos que va a gastar).
6. Auto Mode con posibilidad de desactivarlo: el enrutado automático que no se puede sobreescribir es un techo, no una comodidad.
7. CLI con soporte MCP: la capa de generación se llama desde el resto del tooling en vez de ser un destino al que entrás y del que exportás.

**Veredicto: ruido.** WordRush no genera contenido creativo por IA en ninguna parte del
producto ni del pipeline: el servidor solo administra palabra, reloj y puntuación, y los
assets visuales salen del canvas de Claude Design (`docs/design/`). Lo único rescatable
más adelante sería usar Playground/Flow para producir material promocional del juego
(trailer, posts de lanzamiento) si alguna vez hay campaña de marketing, pero eso no toca
el código ni las skills.

---

## 6.md — "Levels of RAG" (Lección 4/100, con la 3/100 pegada al final)

**Qué dice.** Post de LinkedIn/X que ordena la evolución de RAG en cinco niveles.
**Nivel 1 Naive RAG**: documentos → chunking → embeddings → vector DB → retrieve → LLM;
fácil de montar, la calidad de recuperación es el cuello de botella. **Nivel 2 Advanced
RAG**: mejor chunking, filtrado por metadata, búsqueda híbrida, reescritura de consulta,
reranking, compresión de contexto. **Nivel 3 Modular RAG**: la tubería deja de ser fija y
se arma con módulos intercambiables (Query Router → Retriever → Reranker → Context Builder
→ Generator), con estrategias distintas según la consulta. **Nivel 4 Agentic RAG**: el
sistema razona sobre la propia recuperación (qué necesito, qué fuente, ¿busco otra vez?,
¿alcanza lo recuperado?) con el ciclo Question → Plan → Tool/Source → Retrieve → Evaluate
→ Replan. **Nivel 5 Adaptive / Self-Reflective RAG**: evalúa si el contexto es relevante y
si la respuesta está sustentada, y decide reformular o volver a recuperar. La moraleja es
que el reto de ingeniería no es elegir base vectorial sino recuperar lo correcto y dar el
contexto correcto. Pegada abajo va la Lección 3/100: los 9 bloques de las aplicaciones IA
modernas (vector DB, modelo de embeddings, RAG, prompt engineering, caché semántica, MCP,
agente, function calling, retrievers). No referencia imágenes.

**Ideas concretas.**
1. Escalera de madurez de RAG como modelo mental: no saltar a Agentic RAG sin tener resuelto el retrieval básico.
2. Palancas de calidad antes de tocar el modelo: chunking, metadata, híbrido, reranking, compresión.
3. Query router: estrategia de recuperación distinta según el tipo de consulta.
4. Paso de evaluación explícito ("¿esto responde?") antes de generar, y replan si no.
5. Caché semántica para reusar respuestas de consultas parecidas y bajar latencia y coste.
6. Ver los 9 bloques como piezas componibles, no como tecnologías aisladas.

**Veredicto: ruido.** WordRush no tiene ni LLM ni base vectorial en runtime: las palabras y
frases son diccionarios cerrados que valida el servidor, y `docs/context/` fija que el
servidor es la única fuente de verdad de palabra, reloj y puntuación. El único escenario
donde dejaría de ser ruido es que "Adivina la frase" pasara a generar frases con un
modelo, y aun ahí haría falta generación con validación, no recuperación: RAG sobre un
corpus propio sería sobreingeniería.

---

## 11.md — "AGENTES IA: la guía completa (monetiza hoy)"

**Qué dice.** Guía larga en español rioplatense que enseña a vender servicios de agentes
IA, ordenada en seis niveles de complejidad arquitectónica antes de facturar. Define
agente como **LLM + tool calling + loop de ejecución + memoria/estado** ("sin esas cuatro
piezas es un chatbot con prompt largo"). Nivel 0: entender el loop percepción →
razonamiento → acción → observación, function calling con schema, MCP como estándar para
exponer herramientas, memoria de corto vs largo plazo, y RAG como el 80% de lo que hace
útil a un agente vertical. Nivel 1 (lo cobrable esta semana): flujo determinístico en
n8n/Make con **un solo punto de decisión por LLM** — bot de primer nivel con clasificación
de intención, agente de research con RAG y cita de fuente, calificación de leads con
structured output, seguimiento disparado por estado leído del CRM. Nivel 2: empaquetar lo
repetido (templates parametrizados, kits de prompts y schemas por vertical, bases de
conocimiento pre-estructuradas, mini-formación). Nivel 3: sistemas que corren solos
(monitoreo 24/7 con verificación LLM antes de alertar, pipelines de research, benchmarks
con afiliación). Nivel 4, el ticket alto: integración con sistemas legacy (ERP/CRM sin
API), arquitectura multiagente con orquestador más especialistas, auditoría de madurez y
**observabilidad como servicio** (tracing, evals de regresión, alertas de degradación).
Nivel 5: convertirlo en sistema propio (versionar prompts y flujos en git, framework
interno de templates, subir precios, medir coste real por cliente en tokens e incidentes).
Cierra con seis errores técnicos típicos y un stack por categoría (Claude/GPT/Gemini,
LangGraph/CrewAI/Claude Agent SDK, n8n/Make, MCP, Pinecone/Weaviate/pgvector, memoria
separada del RAG de conocimiento, LangSmith o equivalente, git).

**Imágenes referenciadas.** `image-21.png`: diagrama limpio de los seis niveles (Nivel 0
arquitectura mínima → Nivel 1 automatización + un tool call → Nivel 2 producto empaquetado
→ Nivel 3 canales que corren solos → Nivel 4 integración profunda → Nivel 5 sistema
propio); sirve como resumen de una mirada. `image-22.png`: **no pertenece a la nota** — es
una miniatura de YouTube de "Database Design & Scaling Explained | Scale an App from 1K to
10M Users" (Sangam Mukherjee, 1:03:34). Parece una captura traspapelada; si interesa el
tema de escalado, va con las notas de sistemas, no con esta.

**Ideas concretas.**
1. Definición operativa de agente (loop + tools + estado) que descarta el "prompt largo" disfrazado.
2. Empezar determinístico y meter IA solo en el punto de decisión: menos superficie de error.
3. Versionar prompts, schemas y flujos como código en git desde el primer día.
4. Límites duros de pasos y de coste por ejecución, para que un loop no queme presupuesto sin que nadie lo note hasta la factura.
5. Observabilidad (logs, tracing, evals de regresión antes de cada cambio de prompt) como diferencia entre producto y demo.
6. MCP para exponer herramientas propias una vez y reusarlas entre modelos.
7. Vender métricas (SLA, tiempo de respuesta, horas liberadas), no "le integré IA".

**Sobre monetizar WordRush: no sirve.** Se había preguntado por publicidad y pase premium
para el juego; esta guía **no dice nada de eso**. Su "monetiza hoy" es vender servicios de
consultoría y automatización con agentes a terceros (mensualidades con SLA, templates,
integración con ERP), un negocio distinto del de un juego con usuarios finales. No hay ni
una línea sobre ads, compras dentro de la app, pase de temporada, precios de cosméticos ni
retención. Para ese tema hace falta material de monetización de juegos, no de agentes.

**Veredicto: útil más adelante (parcialmente).** Lo aprovechable no es la parte comercial
sino la disciplina de los Niveles 0 y 5 aplicada a `.claude/`: tratar skills, rules y hooks
como código versionado, poner límites y logging a lo que corre solo, y no montar
arquitectura multiagente donde alcanza un flujo determinístico — el mismo criterio con el
que conviene revisar `.claude/skills/backend` y `.claude/skills/frontend`. Nada de esto
entra hoy en el backend ni en el frontend del juego.

---

## Carpetas `1/` y `2/`

- **`1/`** — cuatro diagramas de @shannholmberg sobre *marketing engineering*, que
  **pertenecen a `1.md`** (esa nota los referencia como `./1/image1.png` … `image4.png`).
  `image1.png`: "Context management / marketing engineering" — el ciclo CONNECT
  (`references.md` apuntando a brain/knowledge base, data warehouse y moodboard/brand book)
  → WORK TOGETHER (vos y el agente acuerdan el brief) → CREATE + REVIEW (subagentes de
  landing y de posts, con tu sign-off) → SAVE BACK (decisiones y resultados vuelven a las
  fuentes). `image2.png`: "Second brain for marketing" — estructura de carpetas
  (`marketing/shared/`, `content/` con `voice-dna.md`, `hooks.md`, `playbook.md`,
  `checks.md`, `tools.md`, `references.md`, y un `AGENTS.md` que dice dónde leer, dónde
  guardar y cuándo pedir aprobación) más el flujo de uso de punta a punta.
  `image3.png`: captura de terminal con el workflow de campaña en 7 pasos (objetivo →
  research → plan y aprobación → ejecutar workflows en paralelo por canal → check y review
  → lanzamiento → resultados), con el bucle interno crear → verificar contra el brief →
  revisar y condiciones de parada (listo, falta input, límite de reintentos o de
  presupuesto). `image4.png`: "How to become a marketing engineer" — 7 pasos (construí el
  sistema y no el output; company brain primero; perfiles de agente; mirá qué tareas
  repetís; diseñá el loop antes de correrlo; orquestá un agente por vertical; cerrá el eval
  loop) y el diagrama del sistema resultante (company brain → orquestador → SEO/PR/Paid/CRO
  con skills y subagentes → eval loop que realimenta el brain).
  Aunque el dominio sea marketing, la estructura (un `references.md` que enlaza las fuentes,
  un `AGENTS.md` con reglas de lectura/escritura/aprobación, checks antes del sign-off y un
  eval loop) es el mismo patrón que ya usan `docs/context/` como fuente de verdad y los
  `references/project.md` de las skills: sirve como comparación al revisar `.claude/`.
- **`2/`** — **vacía**. Le correspondería a `2.md` (hilo de @polydao), pero no hay ninguna
  imagen guardada; no falta nada que analizar.
