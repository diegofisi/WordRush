# 04 · Infraestructura, latencia y diseño de sistemas

Análisis de las notas `7.md`, `9.md`, `10.md`, `12.md`, `14.md` de `docs/research/skills/`,
sus imágenes, y el repo clonado `repos/system-design-notes/`.
Fecha del análisis: 2026-09-16.

Contexto contra el que se evalúa todo: WordRush es NestJS 11 + Socket.IO con las salas en
memoria (sin base de datos), un ticker de sala de 250 ms, cliente React + Vite, y dos
servicios en Railway. Salas de 2 a 8 jugadores más 2 observadores. En `master` existe
además el modo "fly boss" (cerebro simulado, ~7 s de un core por decisión) con pools
elásticos de worker threads; `v1.1` no lo incluye.

---

## 1. `7.md` — Caché: TTL, evicción, staleness (KodeKloud)

Un hilo divulgativo con una infografía (`image-11.png`). Explica la caché como un
key→value en memoria delante de la base de datos: se busca la clave, si falla se va a la
base, se guarda el resultado, y toda lectura posterior es un acierto a velocidad de
memoria. Lo interesante no es el diagrama sino el párrafo donde el autor admite dónde se
acaba: cache-aside es solo uno de varios patrones, LRU real casi nunca es LRU exacto, y el
fallo que nadie dibuja es la estampida.

Ideas concretas:

1. **TTL**: cada entrada expira por cuenta atrás, de modo que las copias rancias se
   limpian solas. La pregunta que deja el hilo es honesta: ¿elegiste tu TTL por defecto o
   lo eligió el framework por ti?
2. **Evicción LRU**: la memoria es finita; al llenarse sale la clave menos usada
   recientemente. Redis no implementa LRU exacto, **muestrea candidatos**; aproximar es lo
   normal en producción.
3. **Staleness**: la caché dice $100 y la base $120. Copiar el dato implica adoptar la
   deriva. Arreglos: TTL corto, o actualizar la caché en la escritura.
4. **Familia de patrones**: cache-aside (el del dibujo), read-through, write-through,
   refresh-ahead. Son decisiones distintas sobre quién escribe la caché y cuándo.
5. **Cache stampede**: una clave caliente expira, mil peticiones fallan a la vez y caen
   todas juntas sobre la base. Se arregla con **single-flight locking** (una sola petición
   rellena, las demás esperan ese resultado) y **TTL con jitter** para que las claves no
   caduquen sincronizadas.
6. La regla operativa: "hit instantáneo, miss = ir una vez y cachear". La métrica que
   importa no es solo el hit ratio sino el **coste del miss**, porque un hit ratio alto con
   misses caros sigue dando una cola p99 mala.

## 2. `9.md` — Enlace a Agentic Design Patterns + adelanto de los patrones de latencia

Nota de dos líneas: el enlace a `github.com/evoiz/Agentic-Design-Patterns`, una infografía
de "How Twitter Works" (`image-13.png`) y el adelanto del artículo que se desarrolla en
`10.md`, con su árbol de patrones (`image-14.png`). El texto propio es una sola idea: *el
modelo es solo un tramo del camino crítico; el resto del sistema sigue teniendo distancia,
trabajo repetido, esperas en serie y arranque en frío*.

Ideas concretas:

1. Medir el camino completo, no el componente que se sospecha. Un componente rápido no
   demuestra una aplicación rápida.
2. El árbol de 4 categorías (locality / work reduction / concurrency / anticipation) como
   índice mental; el detalle está en `10.md`.
3. De la infografía de Twitter, lo único transferible a un juego: **fan-out en escritura vs
   fan-out en lectura** (empujar a los seguidores al publicar, o recolectar al leer) y el
   hecho de que Twitter usa un híbrido según el volumen de la cuenta.
4. También de esa infografía: las notificaciones en tiempo real salen por WebSocket sobre
   una cola de eventos; la conexión persistente es el transporte, la cola es el
   desacoplador. En WordRush no hay cola y no hace falta: emisor y receptor viven en el
   mismo proceso.
5. El resto de la infografía (sharding por user ID, Elasticsearch, CDN de media, multi-AZ)
   es escala de red social. Sirve como vocabulario, no como plan.

## 3. `10.md` — 19 patrones de latencia (Generative Programmer, 2026-08-29)

El artículo completo, con seis diagramas (`image-15` a `image-20`). Adapta ideas de
*Latency* de Pekka Enberg a cuatro categorías y las explica primero con una aplicación
tradicional y luego con una de IA. El método que propone importa más que la lista:
**no empieces eligiendo un patrón**; traza la petición completa, mide la distribución (no
la media), localiza qué domina el percentil que te interesa, y solo entonces elige la
intervención más pequeña que cambie ese tramo. Y vuelve a medir, incluyendo el trabajo
desperdiciado.

**Locality (la petición y su dato están lejos)**

1. **Colocation** — acercar o eliminar la frontera: CDN, misma región, mismo proceso.
   Cuesta flexibilidad de colocación y failover.
2. **Replication** — copias legibles cerca del lector. Solo para lecturas que toleren un
   nivel de rancio definido explícitamente.
3. **Partitioning** — dividir por una clave estable para que la petición y su dato caigan
   en la misma partición. Una mala clave crea particiones calientes.
4. **Caching** — atajo para lecturas o cómputos repetidos. Un hit ratio alto con misses
   caros sigue dando mala cola.

**Work reduction (sobra cómputo)**

5. **Algorithmic work reduction** — índice en vez de escaneo, hash en vez de búsqueda
   lineal, filtrar antes del join caro. Reduce el trabajo, no lo acelera.
6. **Selective data processing** — llevar solo lo que el siguiente paso necesita. El
   diagrama (`image-17`) es explícito: grafo de objetos → copia DTO → bytes JSON → copia
   al socket; cada capa copia la representación completa. Recortar demasiado, en cambio,
   provoca una segunda petición.
7. **Setup reuse** — reusar conexiones establecidas, esquemas ya parseados, estado
   validado. Exige ciclo de vida, frescura y aislamiento explícitos.
8. **Request coalescing** — combinar varias lecturas conocidas en una llamada. Cuidado: una
   operación lenta retiene a todas las demás.
9. **Runtime tuning** — asignación, GC, page faults, cambios de contexto. Solo tras un
   profile que ate los picos de p99 a ese coste. "Son sospechosos medibles, no la
   explicación por defecto de todo servicio lento".

**Concurrent execution (trabajo independiente esperando en fila)**

10. **Synchronization avoidance** — un lock disputado convierte el retraso del dueño en el
    retraso de todos. Estado inmutable, particionado, o con un único dueño explícito.
11. **Independent concurrency** — latencia ≈ max(ramas) + overhead en vez de la suma. No
    ayuda si una tarea necesita el resultado de otra, y empeora si el fan-out agota una
    dependencia compartida.
12. **Progressive response** — emitir el primer resultado útil (streaming) en vez de
    esperar al total. Mejora el tiempo hasta el primer resultado útil, **no** el tiempo de
    completado, y obliga al cliente a manejar estado provisional.
13. **Concurrency budget** — "una cola almacena la espera, no la elimina". Si las llegadas
    superan la capacidad, la cola crece y la cola de latencia la sigue. Techo de
    concurrencia, deadlines y cancelación propagados, backpressure, y descartar trabajo que
    ya no se necesita.
14. **Hedged requests** — mandar copias equivalentes y quedarse con la primera respuesta
    válida. Solo para operaciones idempotentes, con capacidad de sobra y bajo presupuesto
    estricto; si no, agrava la sobrecarga.

**Anticipation (trabajo predecible todavía en primer plano)**

15. **Predictive prefetching** — traer la lectura probable antes de que se pida. Una
    predicción errada gasta recursos sin acortar nada.
16. **Optimistic update** — mostrar el estado esperado como *pendiente* mientras persiste
    por detrás, con rollback visible al fallar. Mejora la latencia percibida, no la real.
    El estado provisional nunca debe presentarse como completado.
17. **Speculative execution** — ejecutar la rama probable antes de conocer la elección.
    Debe ser aislada y cancelable.
18. **Precomputation** — mantener el agregado al llegar cada evento, en vez de calcularlo
    en cada petición. Mueve el trabajo al momento del cambio de la fuente.
19. **Prewarming** — pool de workers, de conexiones o entorno de ejecución inicializado
    antes de que llegue el tráfico. Capacidad caliente = capacidad ociosa pagada.

La matriz final (`image-20`) cruza las cuatro categorías con las etapas del camino, y añade
dos filas que se olvidan siempre: **tail amplifier** (encolado, skew, sobrecarga, fan-out
obligatorio, tormentas de reintentos) y **pay the price** (calidad, privacidad, coste,
contexto rancio, corrección).

## 4. `12.md` — Cómo funciona el filesystem de un contenedor (Ivan Velichko / iximiuz)

Tutorial largo que construye un contenedor tipo Docker con `unshare`, `mount` y
`pivot_root`, sin runtime. La tesis: el **mount namespace** es la base de la aislación, y
los demás namespaces (PID, cgroup, UTS, network) aparecen porque el rootfs no queda
completo sin ellos. Es material de fondo, no accionable para WordRush, pero explica por
qué un despliegue en Railway se comporta como se comporta.

Ideas concretas:

1. Un mount namespace aísla la **tabla de montajes**, no los ficheros: un fichero creado en
   el host sigue viéndose desde el namespace nuevo. Solo divergen al crear un montaje.
2. **Mount propagation**: `unshare()` a secas hereda una copia de la tabla que sigue
   propagando eventos. El CLI `unshare` hace además `mount --make-rprivate /`, que es lo
   que aísla de verdad. Esto explica `rshared`/`rprivate` en `docker run -v` y los modos
   `HostToContainer`/`Bidirectional` de Kubernetes.
3. `pivot_root` es el `chroot` seguro que usan los runtimes: mueve la raíz actual a
   `put_old` y hace del nuevo directorio la raíz. Exige que el nuevo root sea un punto de
   montaje y que la propagación no sea `shared`.
4. **No todo el rootfs viene de la imagen**: `/proc`, `/dev` y `/sys` se montan aparte, y
   `/etc/hosts`, `/etc/hostname` y `/etc/resolv.conf` se **bind-montan encima** de los de la
   imagen porque la imagen solo puede traer valores genéricos.
5. El endurecimiento por defecto de Docker es medible: `ReadonlyPaths` (`/proc/bus`,
   `/proc/fs`, `/proc/irq`, `/proc/sys`, `/proc/sysrq-trigger`) y `MaskedPaths`
   (`/proc/kcore`, `/proc/acpi`, `/sys/firmware`, …) — se enmascara un directorio montando
   un tmpfs ro encima y un fichero bind-monteando `/dev/null`.
6. **Volúmenes y bind mounts son la misma cosa**: un volumen es un bind mount a una carpeta
   bajo `/var/lib/docker/volumes/<id>/_data`, más nombre, ciclo de vida y drivers. La
   diferencia es semántica, no técnica.
7. **overlayfs no es obligatorio**: se puede correr un contenedor desde una carpeta plana.
   Las capas de unión son una optimización de espacio en disco al desempaquetar imágenes.
8. Caveat de seguridad real: en un rootfs no confiable, `$ROOTFS/<path>` puede ser un
   symlink fuera del rootfs; los runtimes usan `openat2()` con `RESOLVE_NO_SYMLINKS` y
   luego montan sobre el descriptor, para evitar TOCTTOU.

## 5. `14.md` + `repos/system-design-notes/` (liquidslr)

`14.md` es solo el enlace al repo. El repo son notas del *System Design Interview* (vol. 1
y 2) de Alex Xu: 28 capítulos, cada uno con su `README.md` y su carpeta de imágenes (451
ficheros, casi todos PNG de los diagramas del libro). Es material de entrevista, no de
operación: útil como vocabulario y como lista de trade-offs, con muy poco directamente
aplicable a un juego de una sala. Muestreé los capítulos relevantes: **01 Scaling**, **12
Chat System**, **17 Nearby Friends**, **25 Real-time Gaming Leaderboard** y **04 Rate
Limiter**.

Ideas concretas:

1. **Cap. 01 — el tier web sin estado es el eje de todo**. Toda la escalada del capítulo
   (load balancer, réplicas, sharding, multi-DC) depende de sacar la sesión del proceso.
   WordRush es exactamente lo contrario: **el estado del juego vive en el proceso a
   propósito**. Es una decisión consciente, y tiene el precio documentado en
   `docs/context/06-v1.1.md` (los juegos no sobreviven a un deploy).
2. **Cap. 01 — consideraciones de caché**: cachear lo que se lee mucho y se modifica poco;
   política de expiración explícita (sin TTL el dato vive para siempre); la consistencia se
   rompe porque escribir en la base y en la caché no es una transacción; un solo servidor
   de caché es un SPOF. Coincide con `7.md` y lo ordena mejor.
3. **Cap. 12 — polling vs long polling vs WebSocket**, con el razonamiento: polling gasta
   peticiones redundantes, long polling deja colgadas las conexiones de usuarios inactivos,
   WebSocket da bidireccionalidad persistente. WordRush ya eligió bien.
4. **Cap. 12 — separar servicios sin estado de servidores con estado**. Login, perfil y
   descubrimiento son sin estado y escalan solos; los servidores de chat mantienen las
   conexiones y son los difíciles. Y el **heartbeat con umbral** (p. ej. 30 s sin latido =
   offline) que es justo la forma del `room-lifecycle.ts` de WordRush.
5. **Cap. 12 — IDs de secuencia locales**: para ordenar mensajes dentro de un canal no hace
   falta un generador global tipo Snowflake; basta un contador local único dentro del grupo.
   Regla barata y directamente aplicable al chat de sala.
6. **Cap. 17 — drenar antes de apagar**: al retirar un servidor WebSocket hay que marcarlo
   como *draining* en el balanceador y dejar de enviarle conexiones nuevas antes de
   tumbarlo. Es exactamente la mitad que le falta al ítem diferido del deploy.
7. **Cap. 17 — TTL como límite de memoria**: la caché de ubicaciones acota su tamaño máximo
   por TTL, no por política de evicción. El equivalente en WordRush es el janitor de salas
   + `MAX_ROOMS`.
8. **Cap. 25 — el sorted set de Redis** (`ZINCRBY`, `ZREVRANGE`, `ZREVRANK`) como
   estructura para ranking en tiempo real, O(log N) por operación, frente al escaneo de
   tabla de SQL. Y el número honesto del capítulo: **con 5M DAU una sola instancia de Redis
   basta**; el sharding solo aparece a 500M DAU. Sirve como calibración de escala.
9. **Cap. 25 — no dejar que el cliente escriba su propia puntuación**: la API de puntuación
   solo la puede llamar el servidor de juego, nunca el cliente, por man-in-the-middle.
   WordRush ya cumple esto (el servidor es la única fuente de la palabra, el reloj y los
   puntos), y conviene que siga siendo un invariante escrito.
10. **Cap. 04 — algoritmos de rate limiting**: token bucket (tolera ráfagas, dos
    parámetros), leaking bucket (salida estable, retrasa ráfagas), fixed window (simple,
    pero el pico en el borde de la ventana deja pasar el doble de la cuota), sliding window
    log (exacto, caro en memoria), sliding window counter (aproximado y barato). El
    `SocketRateLimiter` de WordRush es un sliding window log por socket y evento — la
    elección correcta dado que las ventanas son cortas y los eventos pocos.

---

## Qué aplica a WordRush

| Idea | Veredicto | Dónde caería en el código |
|---|---|---|
| Cachear con TTL delante de una base de datos (`7.md`, cap. 01) | **ruido** | No hay base de datos. Las listas de palabras son ficheros JSON de <200 KB cargados en memoria al arrancar (`backend/src/modules/words/data/`). Eso ya es la caché y no tiene deriva posible: el fichero es inmutable durante el proceso. |
| TTL como techo de memoria (cap. 17) / evicción | **ya está hecho, mantener** | `room-janitor.service.ts` + `room-lifecycle.ts` (60 s de gracia en lobby, 10 min sin nadie conectado, 5 min tras `game:end`) y el tope `MAX_ROOMS=500`. Es la misma idea: el ciclo de vida acota la memoria, no una política de evicción. |
| Cache stampede, single-flight, jitter en el TTL | **ruido** | No hay clave caliente ni origen caro detrás. Nada que proteger. |
| Precomputation (mantener el agregado al llegar el evento) | **ya está hecho** | El marcador acumulado y `time-ledger.ts` se actualizan en cada suceso, no se recalculan al pedir el estado. Merece quedar así escrito cuando se toque `scoring.ts`. |
| Selective data processing / tamaño del payload de socket | **útil ahora** | `rooms/domain/services/state-presenter.ts`. Es el sitio exacto: `toFullState` va en cada join/rejoin, mientras que `player:progress` y `teammate:progress` salen por cada jugada de cada jugador. Con 8 jugadores más 2 observadores, una ronda emite del orden de cientos de payloads. `toPlayerProgress` ya manda solo colores (nunca letras) y `phrase` es `null` fuera del juego de frases — está bien; lo que conviene es **no dejar que crezca**: cada campo nuevo se multiplica por jugadores × rivales × intentos. Un test que fije el tamaño serializado de `PlayerProgress` sería más barato que descubrirlo en producción. |
| Progressive response / primer resultado útil | **ya está hecho, por diseño** | El servidor no emite estado en cada tick: emite eventos (`player:progress`, `player:solved`, `time:penalty`, `round:end`) y cada payload de reloj lleva `secondsLeft` + `at`, con lo que el cliente interpola la cuenta atrás localmente. Eso es lo que permite que el ticker de 250 ms sea barato: 4 pasadas/s sobre un `Map` en memoria y **cero tráfico** salvo cuando algo cambia. Conviene que quede escrito como decisión, porque la tentación obvia al añadir cualquier reloj nuevo es difundirlo cada tick. |
| Optimistic update (mostrar pendiente, revertir al fallar) | **útil más adelante** | Frontend, `frontend/src/features/game/`. El envío de una palabra ya tiene latencia de ida y vuelta; pintar la fila como pendiente antes del ack mejora la sensación. Riesgo real: el servidor es la única fuente de verdad del reloj y de los colores, así que un optimismo mal hecho **miente sobre el estado del juego**. Solo si se ve lento de verdad, y con el estado provisional visiblemente distinto del confirmado. |
| Concurrency budget / backpressure / rate limiting | **ya está hecho, calibrar** | `gateway/presentation/socket-rate-limiter.ts` (sliding window log por socket y evento) más los límites de reglas (cooldown de emotes) en sus casos de uso. El cap. 04 solo aporta vocabulario para justificar por qué el sliding window log, caro en general, aquí está bien: ventanas cortas y pocos eventos. |
| Synchronization avoidance / locks | **ruido** | Node de un solo hilo, las salas son objetos con un único dueño. No hay locks que evitar. El patrón ya se cumple por construcción del runtime. |
| Independent concurrency / hedged requests / fan-out paralelo | **ruido en `v1.1`** | No hay dependencias externas que paralelizar ni stragglers que cubrir: todo el camino crítico es CPU local sobre un `Map`. Hedging aquí solo gastaría capacidad. |
| Prewarming / pool de workers caliente | **ya está hecho, pero solo en `master`** | `backend/src/modules/boss/infrastructure/brain-worker.service.ts`: un decisor siempre caliente para que el primer turno no espere a cargar el conectoma (~90 MB), más pools que crecen bajo demanda hasta `BOSS_DECIDERS`/`BOSS_STREAMS` y reaper a los 60 s de inactividad. Es el único sitio del proyecto donde los patrones de anticipación y presupuesto de concurrencia se ganan el sitio, porque una decisión cuesta ~7 s de un core. El comentario del fichero ya dice lo correcto ("más hilos que cores no compra nada"), que es el patrón 13 bien entendido. |
| Concurrency budget aplicado al fly | **útil ahora, en `master`** | Mismo fichero. Lo que falta no es más pool sino la parte de *shedding*: hoy una sala que pide decisión cuando todos los decisores están llenos arranca otro hilo o espera; un rechazo explícito ("el jefe está ocupado") con presupuesto duro es más honesto que degradar el ritmo de todas las salas. |
| Tier sin estado, load balancer, réplicas, sharding (cap. 01) | **ruido** | Un solo proceso Node sirve esto de sobra: 8 jugadores por sala, un `Map` de salas, sin base de datos. Escalar horizontalmente exigiría sacar las salas del proceso, que es justo lo que se decidió no hacer. |
| Colocation (mismo proceso / misma región) | **útil ahora, gratis** | Ya se cumple: la lógica, el estado y el reloj están en el mismo proceso, que es el extremo "embedded" del diagrama de locality. Lo único que queda por revisar es que los dos servicios de Railway (`wordrush-api`, `wordrush`) estén en la **misma región**, y que esa región sea la de los jugadores. Es una casilla de configuración, no código. |
| Drenar conexiones antes de apagar (cap. 17) + dump/restore de salas | **útil más adelante — es el ítem ya diferido** | `docs/context/06-v1.1.md` → "Deferred: updating the server without breaking rounds", decidido el 2026-09-15. El repo aporta la mitad que al ítem le falta: no basta con volcar las salas a disco/Redis en `onModuleDestroy` y restaurar al arrancar; hay que **marcar el servidor como draining** y darle a los clientes una ventana de reconexión. El proyecto ya está preparado por dos lados: la sesión se reconstruye con `rejoin-room.use-case.ts` y el token del jugador, y las entidades de sala son datos planos. El único obstáculo real son los `NodeJS.Timeout` de `round-scheduler.service.ts`, que no son serializables: habría que guardar la marca de tiempo del deadline y reprogramar al arrancar. |
| Fan-out write-time vs read-time (Twitter, cap. 12) | **ruido** | El fan-out máximo de WordRush es 10 sockets en la misma sala, resuelto por `server.to(roomChannel)` de Socket.IO. No hay inbox que materializar. |
| IDs de secuencia locales por canal (cap. 12) | **útil, barato** | `modules/chat/`. Si alguna vez hace falta ordenar o deduplicar mensajes de chat, un contador por sala basta; no hace falta nada global. |
| Heartbeat con umbral para presencia (cap. 12) | **ya está hecho** | `room-lifecycle.ts` sobre los eventos de conexión/desconexión de Socket.IO. |
| Sorted set de Redis para ranking (cap. 25) | **ruido** | El marcador es de 8 jugadores dentro de una sala; ordenar un array es más rápido que una llamada de red. Solo tendría sentido con un ranking global persistente entre salas, que hoy no existe. |
| El cliente nunca escribe su propia puntuación (cap. 25) | **ya está hecho — mantener como invariante** | Ya es la regla del proyecto ("el servidor es la única fuente de verdad de la palabra, el reloj y la puntuación"). El capítulo aporta el motivo técnico (proxy man-in-the-middle) por si alguna vez se discute mover cálculo al cliente por latencia. |
| Runtime tuning (GC, asignaciones) | **ruido hasta que haya un profile** | El propio artículo lo dice: sospechosos medibles, no la explicación por defecto. No hay síntoma. |
| Namespaces, `pivot_root`, propagación de montajes (`12.md`) | **ruido operativo, útil como contexto** | Railway construye con Nixpacks (`backend/railway.json`); no se escribe un Dockerfile ni se montan volúmenes. Lo único que podría llegar a importar: si el ítem diferido se resuelve **volcando las salas a disco** en vez de a Redis, hay que saber que el filesystem del contenedor es efímero y que persistir exige un volumen montado. Ahí es donde `12.md` deja de ser curiosidad. |
| Endurecimiento del rootfs (ReadonlyPaths, MaskedPaths) | **ruido** | Lo aplica el runtime por defecto. No hay nada que configurar desde el proyecto. |

### Nota de honestidad sobre la escala

Conviene decirlo de una vez porque afecta a casi toda la tabla: con 8 jugadores por sala y
un tope de 500 salas, el trabajo por tick es recorrer un `Map` de a lo sumo 500 entradas
cuatro veces por segundo, y el camino crítico de una jugada es validar una palabra contra
un `Set` en memoria y emitir a 10 sockets. Eso son microsegundos. **Ningún patrón de
locality, ninguna forma de concurrencia y ningún caché de los que describe `10.md` va a
mover una cifra medible en `v1.1`.**

Los tres sitios del proyecto donde estos patrones sí se ganan el sitio son, por este orden:

1. **Los pools del fly en `master`** — ~7 s de un core por decisión es la única operación
   del proyecto lo bastante cara como para que prewarming, presupuesto de concurrencia y
   shedding sean decisiones reales y no adorno.
2. **El tamaño de los payloads de socket** — no porque hoy sean grandes, sino porque crecen
   solos: cada campo nuevo en `PlayerProgress` se multiplica por jugadores × rivales ×
   intentos, y nadie lo nota hasta que se nota.
3. **El ítem diferido del deploy** — donde el repo de system design aporta algo concreto
   (draining) y donde los timers no serializables son el obstáculo real.

Todo lo demás de estas cinco notas es vocabulario útil para argumentar decisiones, no
trabajo pendiente.

---

## Imágenes verificadas al cierre

Repaso de las imágenes de `10.md` y `12.md` que el informe no citaba por nombre. Sólo se
anota lo que añade algo.

- **`image-18.png` (`10.md`, patrones de ejecución concurrente).** Su panel de *progressive
  response* plantea el patrón de otra forma que el texto: no es sólo emitir el primer
  resultado útil, es **liberar el worker durante la E/S externa** (un hilo bloqueado por
  espera frente a multiplexado asíncrono) sin fingir que la E/S se ha acelerado. Es
  exactamente lo que el event loop de Node ya nos da gratis, y el argumento para no
  introducir nunca una espera bloqueante en el camino de una jugada.
- **`image-23.png` (`12.md`, el diagrama de apertura; `image-35.png` es el mismo al
  cierre).** Añade la pieza que falta para el ítem diferido del deploy: sobre las capas de
  imagen de sólo lectura hay una **capa copy-on-write creada al arrancar el contenedor por
  primera vez, que sólo conserva los cambios hasta que el contenedor se elimina**. Es decir,
  escribir el volcado de salas en el rootfs no es "efímero al reiniciar el proceso", es
  efímero al reemplazar el contenedor, que es justo lo que hace un deploy.
- **`image-28.png` (`12.md`, propagación `slave`).** Completa los tres tipos de propagación
  que el informe sólo nombraba de pasada: `private` (sin propagación), `shared` (en ambos
  sentidos) y `slave` (los eventos de montaje viajan del namespace llamante al nuevo, nunca
  al revés) — este último es el mecanismo que hay debajo del `HostToContainer` de Kubernetes.
