# 03 · Sistema de puntuación

Decidido el 2026-09-11. Principio: **el tiempo y los puntos son cosas distintas**.
El tiempo es tu vida en la ronda (ver `02-reglas-de-juego.md`). Los puntos son tu resultado,
y salen casi todos del reloj.

## Puntos por ronda

| Concepto | Puntos |
|---|---|
| Aciertas la palabra | 1 punto por cada 1 % del **tiempo inicial** que te sobre al acertar |
| Cada intento después del primero | −3 |
| Primero, segundo y tercero en resolver | +25, +15, +10 |
| Terminas la ronda conservando tu pista | +10 |
| **Piso por acertar** | **mínimo 20 puntos**, pase lo que pase |
| No aciertas, tienes verdes al terminar | **5 por cada verde**, máximo 20 (4 verdes) |
| No aciertas, sin verdes | 0 |

### Por qué porcentaje y no segundos
Si una sala usa 60 s y otra 300 s, un bono fijo de 25 puntos valdría muchísimo en la primera
y nada en la segunda. Con porcentaje, el equilibrio es el mismo sin importar el reloj de la sala.
En pantalla se muestra como "te sobró 72 %".

Con los bonos por letras se puede superar el 100 %. Eso es deliberado: quien resuelve rápido
y además cazó muchas letras nuevas queda por encima de todos.

### Por qué los intentos pesan tan poco
La penalización de −3 solo existe para que dos jugadores con el mismo tiempo sobrante
no empaten por haber tirado una palabra más. Se quiere promover velocidad y caos, no cautela.

### Por qué hay piso de 20
Alguien que acierta en el intento 8 con 2 segundos tendría 2 − 21 = −19. Acertar nunca
puede valer menos que no acertar. Con el piso, el peor de los que resolvieron (20) iguala
al mejor de los que no resolvieron (4 verdes = 20), y nunca queda por debajo.

### Por qué los verdes sin acertar dan 5
Para que quien se quedó a una letra no se vaya con cero y pueda seguir en la partida
con opciones. 4 verdes = 20 = piso de acierto. Es un consuelo, no una estrategia:
nadie planea una ronda alrededor de 20 puntos cuando acertar rápido da más de 100.

## Tabla final
Suma de puntos de todas las rondas. Desempates: menos intentos totales, luego menos pistas usadas.

## Simulación completa
Sala de 90 s iniciales, palabra SOLID, 8 jugadores. Seguimos a Ana, que no usa su pista.

| Segundo | Qué pasa | Letras que cobran | Reloj |
|---|---|---|---|
| 0 | Empieza la ronda | | 90 |
| 12 | Intento 1: SANDY | S verde +10, D amarilla +5 | 78 + 15 = 93 |
| 25 | Intento 2: SLIDE | L amarilla +5, I amarilla +5, D amarilla otra vez 0, S verde otra vez 0 | 80 + 10 = 90 |
| 30 | "Bruno respondió correctamente" | −5 al resto | 85 − 5 = 80 |
| 41 | Intento 3: SOLID | O verde +10, L, I y D verdes tras amarilla +5 cada una, S ya cobrada 0 | 69 + 25 = 94 |

Ana resuelve en el intento 3, segunda de la sala, con 94 s. Su reloj se congela ahí.

| Concepto | Puntos |
|---|---|
| Tiempo sobrante: 94 de 90 iniciales = 104 % | 104 |
| Dos intentos después del primero | −6 |
| Segunda en resolver | +15 |
| Pista conservada | +10 |
| **Total de la ronda** | **123** |

Si Ana hubiera usado la pista en el segundo 0 (marca la O en amarillo), la O verde del
intento 3 daría 5 y no 10, y pierde el +10 de pista. Terminaría con 89 s → 99 puntos por
tiempo → total 108. Usar la pista le costó 15 puntos, pero le pudo ahorrar un intento.

Carla acierta en el intento 5, en el segundo 70, cuarta de la sala, con tres penalizaciones
de −5 y 35 s cobrados por letras. Reloj final 40 → 44 %. Total: 44 − 12 + 0 + 10 = **42**.

Fito no acierta pero termina con 4 verdes: **20**. Gaby, con 2 verdes: **10**. Hugo, sin verdes: **0**.

## Resumen de una ronda de ejemplo (para diseño y pruebas)

| Pos | Jugador | Resolvió | Intento | Tiempo sobrante | Intentos | Posición | Pista | Verdes | Ronda |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Bruno | sí, 1.º | 2 | 111 % | −3 | +25 | +10 | | 143 |
| 2 | Ana | sí, 2.º | 3 | 104 % | −6 | +15 | +10 | | 123 |
| 3 | Diego | sí, 3.º | 4 | 78 % | −9 | +10 | usada | | 79 |
| 4 | Carla | sí, 4.º | 5 | 44 % | −12 | | +10 | | 42 |
| 5 | Elena | sí, 5.º | 6 | 13 % | −15 | | +10 | | 20 (piso) |
| 6 | Fito | no | | | | | | 4 | 20 |
| 7 | Gaby | no | | | | | | 2 | 10 |
| 8 | Hugo | no | | | | | | 0 | 0 |
