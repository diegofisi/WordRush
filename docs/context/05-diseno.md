# 05 · Diseño

## Brief del usuario
"Bonito diseño, moderno y minimalista pero que no se sienta vacío."

## Dirección elegida
- **Tono:** papel cálido, tipografía grande y negra, tiles de color saturado como único
  elemento vivo. Minimalista en estructura, denso en información de juego (rivales, feed, reloj).
- **Tipografías:** Bricolage Grotesque (títulos y tiles), DM Sans (interfaz), JetBrains Mono (reloj y cifras).
- **Color:** fondo blanco cálido, tinta casi negra cálida. Verde y amarillo semánticos del
  juego. Un solo acento (violeta) para acciones primarias, para no competir con verde/amarillo.
- **Iconos:** SVG de trazo, 20 px. Los emoticones del juego también son SVG propios.
- **Sin** gradientes decorativos, sin tarjetas con borde izquierdo de color, sin emoji del sistema.

## Hero de "Crear sala"
Eslogan: "Adivina primero. Cada segundo cuenta." Encima, cinco tiles que giran letra por letra
(animación CSS, estilo revelado de Wordle) y forman en bucle: AHORA → VAMOS → RELOJ → CINCO → JUEGA.
Cada palabra dura 3 s; la última sale toda en verde antes de reiniciar. Se descartó "Adivina rápido.
Róbales el tiempo." por sonar agresivo para un título.

## Pantallas en el canvas
1. **Juego** (principal, escritorio 1440×900): tablero propio, teclado con Ñ, reloj grande,
   panel de rivales en colores, feed de eventos, pista, emoticones, previsualización de puntos.
2. **Crear sala**: idioma, tiempo inicial, rondas, cupo, código.
3. **Sala de espera**: 8 huecos, ajustes resumidos, "Listo".
4. **Resultados**: fin de ronda con desglose de puntos y tabla acumulada.
5. **Juego móvil** (390×844).
6. **Juego oscuro**: la misma pantalla principal en modo oscuro, como alternativa.

## Añadido en la implementación (2026-09-11)
La barra superior de todas las pantallas lleva un selector de idioma de interfaz (ES | EN) y un
botón de tema claro/oscuro con contraste correcto en ambos modos. No estaban en el canvas.

## Archivos fuente
`docs/design/`. Cada `.dc.html` es un artboard; `canvas.json` es la disposición. El archivo `wordrush-multijugador.html` es el canvas ya armado que se publica; se regenera a partir de los otros, no se edita a mano.

## Enlace al canvas
https://claude.ai/code/artifact/2605ee44-424d-413d-86b1-13f80a56cdfe (publicado el 2026-09-11).
Para actualizarlo: editar los archivos de `docs/design/`, volver a armar el canvas y publicar sobre esa misma URL (pasando la URL explícitamente, porque la ruta del archivo cambió el 2026-09-11).
