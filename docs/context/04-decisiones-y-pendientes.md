# 04 · Decisiones y pendientes

## Decisiones tomadas (2026-09-11)

| Decisión | Razón |
|---|---|
| Los puntos salen del % de tiempo sobrante, no de los intentos | Promover velocidad y caos. Los intentos solo desempatan (−3 cada uno). |
| Porcentaje del tiempo inicial en lugar de segundos | Que el balance no dependa del reloj que configuró la sala. |
| Bonos de posición +25 / +15 / +10 | Toque de carrera multijugador, independiente del reloj. |
| Pista conservada da +10 | Que usarla sea una decisión, no un reflejo. |
| Una pista por jugador **por ronda**, no por partida (corregido el 2026-09-11) | El +10 por conservarla ya es el costo de usarla; no hace falta acumularla entre rondas. |
| Piso de 20 puntos al acertar | Acertar nunca vale menos que no acertar. |
| 5 puntos por verde sin acertar, máximo 20 | Que quien se quedó cerca siga en la partida. |
| Ataque automático "−5 s al resto" cuando alguien acierta | Simple, todos lo entienden, produce bola de nieve. |
| El reloj se reinicia cada ronda | Una mala ronda no te saca del resto de la partida. |
| Cada letra cobra tiempo una sola vez por posición | Evita farmear tiempo repitiendo letras. |
| Amarillo y luego verde suma 10 en total, igual que verde directo | Coherencia; no hay ruta más rentable que otra. |
| Misma palabra para todos en cada ronda | Sin eso la comparación no es justa. |
| Sin chat de texto, solo emoticones | Menos toxicidad, más rápido, estilo Clash Royale. |
| Stack confirmado (2026-09-11): backend NestJS 11 + Socket.IO con salas en memoria; frontend React 19 + Vite + Tailwind + Zustand. Dos servicios independientes en Railway. | El usuario delegó la elección; se tomó la más simple que cumple tiempo real y despliegue separado. |
| Banco de palabras en JSON dentro del backend, no en base de datos | Listas fijas y pequeñas, solo lectura; una base de datos sería un servicio más sin beneficio. |
| Acentos ignorados (limón = limon), Ñ es letra propia | Teclado con Ñ en salas en español; escribir tildes en un teclado en pantalla es incómodo. |
| La pista revela solo la letra, no la posición (2026-09-11) | Con la posición era casi un verde regalado; solo la letra mantiene el reto. |
| Respuestas = solo formas base, español neutro, ~900 por idioma (870 ES / 898 EN, 2026-09-11) | Adivinar "asume" frente a "asumo" es suerte, no habilidad; las formas de vosotros y los españolismos no son neutros. Las conjugaciones siguen valiendo como intento. |
| Lista de intentos válidos en español = solo diccionario; sin corpus de subtítulos (2026-09-11) | El corpus aceptaba palabras inglesas (CLOUD) en salas en español. |
| Sesión en localStorage y reingreso automático mientras la partida siga (2026-09-11) | Cerrar la pestaña o perder internet no debe sacarte de la partida. |
| Vida de la sala: 10 min vacía en espera, 5 min tras terminar; sin nueva ronda si nadie está conectado (2026-09-11) | Higiene de memoria; el costo real es despreciable. |
| Selector de idioma de interfaz (ES/EN) y de tema (claro/oscuro) visibles en la barra superior de todas las pantallas | Faltaban en el diseño; el usuario los pidió el 2026-09-11. El idioma de la interfaz es independiente del idioma de las palabras de la sala. |

## Ideas descartadas

| Idea | Por qué se descartó |
|---|---|
| Puntos por intento con mucho peso (220 − 20 × intento) | Premiaba la cautela. Se quiere velocidad. |
| Barra de ataques cargable con verdes (robo de tiempo, teclado revuelto, letras selladas, niebla, congelar) | Sustituida por el −5 s automático. Más simple para una primera versión. Se puede recuperar después. |
| "Letra falsa" (marcar en amarillo una letra que no está) | Rompe la confianza en el tablero; la gente deja de razonar. Si vuelve, como opción de sala apagada por defecto. |
| Cero seco al no acertar | Se prefirió el consuelo de 5 por verde para mantener a la gente en partida. |

## Pendientes por decidir
- **Nombre del juego.** "WordRush" es placeholder.
- **Modo claro u oscuro como principal.** El canvas trae ambos para elegir.
- **Mockups estáticos vs. prototipo clicable.** La primera entrega del diseño es estática.
- **Qué pasa si un jugador se desconecta a mitad de ronda** (¿cuenta 0? ¿se pausa?).
- **Opciones de rondas.** El selector ofrece 1, 3, 5 y 10. Decidir si se añade 2 (o un campo libre entre 1 y 10).
- **Nombre del idioma de las palabras.** La ficha de la sala muestra siempre el endónimo (Español / English) aunque la interfaz esté en el otro idioma. Es deliberado; confirmar.
