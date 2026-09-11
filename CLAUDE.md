# WordRush · Wordle multijugador

Juego de adivinar palabras de 5 letras, multijugador (hasta 8), en español e inglés,
donde el reloj manda: se gana tiempo por letras nuevas y se pierde cuando otro acierta.
"WordRush" es nombre de trabajo.

## Fuente de verdad
Toda la idea, las reglas y las decisiones viven en `docs/context/`. Léela antes de tocar
cualquier cosa del juego o del diseño:

- `docs/context/README.md` — índice y cómo mantener la carpeta.
- `docs/context/01-concepto.md` — qué es el juego y para quién.
- `docs/context/02-reglas-de-juego.md` — sala, rondas, intentos, pista, ataque, emoticones.
- `docs/context/03-sistema-de-puntuacion.md` — fórmula final con simulación paso a paso.
- `docs/context/04-decisiones-y-pendientes.md` — qué se decidió, qué se descartó, qué falta.
- `docs/context/05-diseno.md` — dirección visual, pantallas y enlace al canvas de Claude Design.

## Estructura del repositorio
```
CLAUDE.md
.claude/
  settings.json          hooks del proyecto
  hooks/format.mjs       formatea con Prettier el archivo editado (backend/ y frontend/)
  rules/                 reglas por ruta (se cargan solas al tocar esas rutas)
  skills/backend/        doctrina NestJS + Clean Architecture (leer references/project.md primero)
  skills/frontend/       doctrina React + vertical slices + adapter (leer references/project.md primero)
docs/
  context/               reglas, puntuación, decisiones (fuente de verdad)
  design/                artboards del canvas de Claude Design y el canvas armado
backend/                 API + WebSockets (NestJS). Aún no creado.
frontend/                cliente web (React + Vite). Aún no creado.
```

## Cómo trabajar aquí
- Trabajo de servidor: usar el skill `backend`. Trabajo de interfaz: usar el skill `frontend`.
  Cada uno tiene un `references/project.md` que ata la doctrina a este proyecto; ese archivo
  se actualiza cuando cambia el stack o el mapa de módulos.
- Cualquier cambio de reglas o puntuación se registra primero en `docs/context/` y después
  en el código o el diseño.
- El servidor es la única fuente de verdad de la palabra, del reloj y del puntaje. El cliente
  nunca conoce la palabra antes de terminar la ronda.

## Convenciones
- Documentación e interfaz por defecto en español. La interfaz también existe en inglés.
- Fechas completas en los documentos (2026-09-11), nunca relativas.
- Sin commits ni push salvo que se pida.
