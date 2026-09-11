# 02 · Reglas de juego

## Sala
- Quien crea la sala elige: idioma (ES / EN), tiempo inicial por ronda, número de rondas,
  y cupo (2 a 8 jugadores).
- Tiempo inicial mínimo recomendado: 60 segundos. Por debajo, con 8 jugadores, el
  último casi siempre queda fuera por las penalizaciones de −5 s. Ver `03-sistema-de-puntuacion.md`.
- Se entra con un código de sala. Hay sala de espera con lista de jugadores y botón "Listo".
- El enlace de invitación (`/?code=XXXX`) abre una vista reducida que solo pide el nombre; no muestra el formulario de crear sala.
- El anfitrión puede empezar con menos jugadores que el cupo, siempre que haya al menos 2 conectados. No hace falta que todos estén "listos".

## Ronda
- Todos los jugadores reciben la misma palabra de 5 letras.
- Hasta 8 intentos por jugador.
- El reloj de cada jugador se reinicia al tiempo inicial en cada ronda. Una mala ronda
  no te elimina del resto de la partida.
- La ronda termina para un jugador cuando acierta, agota los 8 intentos o su reloj llega a 0.
- La ronda de la sala termina cuando todos han terminado, o cuando el último reloj llega a 0.
- Al acertar, el reloj del jugador se congela. Ese valor es el que puntúa.

## Colores
Los mismos del Wordle clásico: verde (letra en su lugar), amarillo (letra en la palabra
pero en otro lugar), gris (no está).

## Tiempo por letras
Cada letra cobra **una sola vez por posición**. Eso evita "farmear" tiempo repitiendo
letras ya descubiertas.

| Evento | Segundos |
|---|---|
| Letra nueva en amarillo | +5 |
| Letra nueva en verde directo | +10 |
| Letra que ya fue amarilla y ahora es verde | +5 más |
| Letra revelada por pista y luego puesta en verde | +5 (no cobra el amarillo) |
| Repetir un amarillo o verde ya cobrado | 0 |

Máximo posible por ronda: 50 segundos (5 letras × 10). Con letras repetidas en la palabra
(por ejemplo LLAMA) cada ocurrencia cuenta por su posición.

## Ataque automático: "−5 s al resto"
- Cuando un jugador acierta, todos los jugadores que **aún no han resuelto** pierden 5 segundos.
- Se anuncia en el feed de todos: "Ana respondió correctamente · −5 s al resto".
- No afecta a quienes ya acertaron (su reloj está congelado).
- Con 8 jugadores, el último puede acumular hasta 35 segundos de castigo. Es intencional.
- El HUD muestra cuántos segundos llevas perdidos por este motivo en la ronda.

## Pista
- Cada jugador recibe **una pista por ronda**. Si no la usa, se pierde al terminar la ronda; no se acumula.
- Al usarla, se revela **una letra que está en la palabra, sin decir en qué posición**. Se marca en el teclado con el estilo de pista (amarillo punteado). No se marca nada en el tablero.
- La letra de pista **no suma los 5 s del amarillo**. Si después la pones en verde, suma solo 5 s.
- Guardar la pista da puntos: ver `03-sistema-de-puntuacion.md`.

## Desconexiones y vida de la sala
- La sesión del jugador se guarda en el navegador (`localStorage`). Si cierra la pestaña o pierde internet y vuelve mientras la partida sigue, entra de nuevo a su sitio con su tablero y su reloj tal como estaban (el reloj no se detiene por desconexión).
- Si vuelve cuando la partida ya terminó o la sala ya no existe, ve un mensaje de "sesión expirada" y vuelve al inicio.
- Sala en espera sin nadie conectado: se elimina a los 10 minutos.
- Partida en curso con todos desconectados: la ronda actual termina por reloj; si al terminar no hay nadie conectado, no se inicia otra ronda, la partida se marca terminada y la sala se elimina a los 5 minutos.
- Partida terminada: la sala se elimina a los 5 minutos. Las salas viven en memoria y ocupan unos pocos KB; estos plazos son de higiene, no de costo.

## Visibilidad entre jugadores
- Nunca ves las letras que escriben los otros.
- Sí ves, en una barra lateral, el tablero de cada rival en colores (verde / amarillo / gris),
  su nombre, en qué intento va, su reloj y si ya resolvió.
- Feed de eventos compartido: aciertos, penalizaciones, pistas usadas, emoticones.

## Emoticones
- Panel de reacciones rápidas (6 a 8 iconos). Sin chat de texto.
- Se envían a toda la sala y aparecen unos segundos sobre el avatar de quien lo mandó.
- Enfriamiento de 3 segundos por jugador para evitar spam.

## Fin de partida
- Se juegan las rondas configuradas. La tabla final suma los puntos de todas las rondas.
- Si la partida es de una sola ronda, aplica exactamente lo mismo.
- Desempates, en orden: menos intentos totales, menos pistas usadas.
