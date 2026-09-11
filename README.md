# WordRush · Wordle multijugador

Adivina la palabra de 5 letras antes que los demás. Cada letra nueva te suma segundos,
cada acierto ajeno te los quita, y gana quien termina con más reloj. Salas de 2 a 8
jugadores, palabras en español o inglés, hasta 8 intentos, una pista por ronda,
emoticones y tabla acumulada por rondas.

Las reglas y la puntuación están en [docs/context/](docs/context/). El diseño aprobado
está en [docs/design/](docs/design/).

## Estructura

```
backend/    NestJS 11 + Socket.IO. Salas en memoria, palabra, reloj y puntos viven aquí.
frontend/   React 19 + Vite + Tailwind. Cliente web, móvil y escritorio, claro/oscuro, ES/EN.
docs/       contexto (reglas, decisiones) y diseño (canvas de Claude Design).
scripts/    sync-contract.mjs (copia el contrato de eventos al frontend), build-words.mjs.
```

Los dos servicios son paquetes independientes, cada uno con su `package.json` y su
lockfile. Comparten un solo archivo: el contrato de eventos de Socket.IO,
`backend/src/shared/contract/index.ts`. El backend es el dueño; después de cambiarlo,
ejecuta `pnpm sync-contract` desde la raíz para actualizar la copia del frontend.

## Correr en local

Requisitos: Node 22 o superior y pnpm.

```bash
# terminal 1 · servidor en http://localhost:3000
cd backend
pnpm install
pnpm start:dev

# terminal 2 · cliente en http://localhost:5173
cd frontend
pnpm install
pnpm dev
```

El cliente apunta por defecto a `http://localhost:3000`. Para otro servidor, crea
`frontend/.env` con `VITE_SOCKET_URL=http://host:puerto`.

Pruebas del servidor: `cd backend && pnpm test`.

## Desplegar en Railway

Un proyecto de Railway con **dos servicios** creados desde este mismo repositorio.

### 1. Servicio `backend`
- Settings → Source → **Root Directory**: `backend`.
- Railway detecta `railway.json`: build con Nixpacks, arranque `node dist/main.js`,
  health check en `/health`.
- Settings → Networking → **Generate Domain**. Anota la URL, por ejemplo
  `https://wordrush-backend.up.railway.app`.
- Variables:
  - `FRONTEND_URL` = la URL pública del frontend (paso 2). Admite varias separadas por coma.
  - `PORT` la pone Railway; no la definas.

### 2. Servicio `frontend`
- Settings → Source → **Root Directory**: `frontend`.
- `railway.json` compila con Vite y sirve `dist/` con `serve` (SPA con fallback).
- Settings → Networking → **Generate Domain**.
- Variables (se leen **en tiempo de build**, así que redepliega si las cambias):
  - `VITE_SOCKET_URL` = la URL pública del backend del paso 1.

### 3. Cerrar el círculo
Vuelve al backend y pon en `FRONTEND_URL` el dominio que Railway generó para el
frontend. Redepliega ambos. Abre el frontend, crea una sala y entra desde otro
navegador con el código.

Si algo no conecta, revisa en el navegador la consola: un error de CORS significa que
`FRONTEND_URL` no coincide exactamente con el origen del frontend (incluye `https://`,
sin barra final).

## Banco de palabras

Vive en el repositorio como JSON, no en una base de datos:
`backend/src/modules/words/data/es.json` y `en.json`, cada uno con `answers` (palabras
que el juego elige) y `allowed` (palabras válidas como intento, superconjunto de las
anteriores). Se cargan en memoria al arrancar. Razón: son listas fijas, pequeñas
(menos de 200 KB) y sin escrituras; una base de datos añadiría un servicio más sin
aportar nada.

Se generan con `scripts/build-words.mjs` a partir de listas públicas. Las palabras válidas
como intento salen solo de diccionarios del idioma (nada de corpus de subtítulos, que mezclan
idiomas); las respuestas son las más frecuentes de esas, sin nombres propios ni palabras
ofensivas. Una sala en español solo acepta español y una en inglés solo inglés. El script
documenta las fuentes. Los acentos se ignoran (`limón` y `limon` son la misma palabra) y
la `ñ` cuenta como letra propia.

| Idioma | Palabras que el juego elige | Palabras válidas como intento |
|---|---|---|
| Español | 870 | 10818 |
| Inglés | 898 | 10197 |

Las respuestas son **solo formas base** (infinitivos, sustantivos en singular, adjetivos en
masculino singular; en inglés sin plurales ni pasados), en español neutro, las más usadas del
idioma y ordenadas de más a menos frecuente. El juego prefiere las de arriba de la lista. Se cortaron a propósito muy por debajo de las ~2300 de Wordle:
solo formas base, sin regionalismos, sin groserías ni nombres propios, y sin la cola de
palabras raras que aparece pasadas las ~800 más usadas; para ampliarlas basta cambiar `EN_ANSWERS` / `ES_ANSWERS` en el
script y regenerar.

## Cambiar reglas

Primero en `docs/context/` (con fecha y razón en `04-decisiones-y-pendientes.md`),
después en el código. Los números de la puntuación están en un solo lugar: la constante
`SCORING` del contrato.
