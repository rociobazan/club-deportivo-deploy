# Identidad y dirección de diseño

Complemento de `requisitos.md` (RF-09, RF-10). Define quiénes somos, cómo hablamos y cómo se ve el sistema.

---

## 1. Qué es este club

Antes de elegir colores hay que responder tres preguntas, porque de ahí sale todo lo demás.

**Qué somos:** un club de barrio con canchas de tenis, pádel y fútbol 5, que alquila por turno. No es un country ni un gimnasio con canchas de yapa. La cancha es el producto.

**Para quién:** adultos de 25 a 50 que juegan con los mismos tres o cuatro amigos, casi siempre entre semana y casi siempre de noche. No son deportistas federados. Reservan desde el celular, apurados, mientras coordinan por WhatsApp quién puede.

**Qué tiene que lograr la landing:** que alguien que nunca escuchó nombrar el club entienda en diez segundos qué es, qué canchas hay y cómo reservar. Nada más.

Eso último importa: la landing **no** tiene que convencer a nadie de nada. El deporte ya lo eligieron. Solo tiene que sacarse del medio y llevarlos a la pantalla de disponibilidad.

---

## 2. Nombre

Tres opciones, con el criterio detrás de cada una:

| Nombre | Por qué |
|---|---|
| **Club Cumbre** | Corto, se pronuncia fácil por teléfono, y la referencia a las sierras ancla el club en Córdoba sin ponerlo en el nombre. Un dominio de dos sílabas es más fácil de recordar que uno de cinco. |
| **Club Deportivo La Cañada** | El más creíble como club real y de barrio. Suena a institución con años encima, que es exactamente la percepción que conviene. El costo es que es largo y hay clubes con nombres parecidos. |
| **Punto Alto** | Juega con el vocabulario del tenis y con la geografía serrana al mismo tiempo. El más distintivo de los tres y el más riesgoso: puede leerse como marca de ropa antes que como club. |

**Recomendación: Club Cumbre.** Es el que mejor funciona en los tres lugares donde el nombre va a aparecer en serio: el header, el asunto del mail de confirmación y el código de reserva. Decidan entre los cuatro y bloqueen el nombre antes de escribir una línea de front, porque después cambiarlo toca copy, mails, favicon y dominio.

---

## 3. Voz

**Como un encargado de club que te conoce.** Directo, sin vender nada, sin entusiasmo de folleto.

| En vez de | Escribimos |
|---|---|
| "Viví la experiencia deportiva que merecés" | "Reservá tu cancha en treinta segundos" |
| "Nuestras instalaciones de primer nivel" | "Seis canchas, cuatro techadas, abiertas hasta las 23" |
| "Enviar" | "Reservar el turno" |
| "Ocurrió un error inesperado" | "Ese horario se ocupó recién. Elegí otro" |

Reglas: infinitivo o voseo, nunca "usted". El botón dice lo que pasa cuando lo apretás. El error explica qué salió mal y qué hacer, no pide disculpas.

**Titular del hero (propuesta):**

> Canchas libres esta noche.
> Reservá desde el celular en treinta segundos.

Dice el producto y el diferencial en dos líneas, sin adjetivos.

---

## 4. Sistema visual

### El concepto: bajo las luces

Casi todas las reservas caen entre las 19 y las 23. La imagen mental que un socio tiene del club no es una cancha soleada al mediodía: es la cancha iluminada de noche, el verde profundo, las líneas blancas marcadas por los reflectores y el naranja del polvo de ladrillo. De ahí sale la paleta entera. No es una decisión estética abstracta, es el club a la hora en que la gente lo usa.

### Color

```css
--noche:   #0A1512;  /* fondo. Verde tan oscuro que lee como negro */
--cancha:  #0F3D2E;  /* superficies elevadas, cards, header */
--linea:   #F2F4F0;  /* texto principal. Blanco de la demarcación, apenas frío */
--vidrio:  #7FA8A0;  /* texto secundario. Del vidrio de las canchas de pádel */
--polvo:   #B4471F;  /* acento único. Polvo de ladrillo */
```

Cinco valores, no más. `--polvo` aparece en un solo lugar por pantalla: el CTA principal o el estado activo. Si aparece en tres lugares deja de significar "esto es lo importante".

Modo claro para las pantallas del producto: se invierte el par `--noche` / `--linea` y el resto se ajusta en luminosidad. La landing es siempre oscura.

### Tipografía

**Display: Archivo Expanded.** **Texto: Asap.**

Las dos son de Omnibus-Type, una fundición argentina. Es una elección con motivo, no un adorno: da coherencia entre las dos familias y le suma al club una historia que contar en la sección de identidad. Archivo en su ancho expandido tiene la proporción de la tipografía de un marcador deportivo, que es de dónde viene el gesto. Asap tiene las terminales apenas redondeadas, lo que la hace legible en cuerpos chicos y le saca dureza al contraste con el display.

Escala, tres pasos y nada más:

```
display   clamp(2.75rem, 7vw, 5.5rem)   Archivo Expanded 700, tracking -0.02em
título    1.5rem                        Archivo Expanded 600
cuerpo    1.0625rem / 1.6               Asap 400, máximo 68 caracteres por línea
```

### El elemento de firma: las líneas de cancha

Una cancha se define por sus líneas. Ese es el sistema estructural del sitio: en vez de bordes redondeados y sombras grises, las secciones se separan con reglas de 2px en `--linea` a 40% de opacidad, y la sección activa del nav se marca con la misma línea a opacidad completa, como la línea de fondo de una cancha.

Radio de borde: 2px en todo. Un club no es una app de fintech.

Sombras: ninguna. La jerarquía la dan el color de fondo y las líneas.

### Movimiento

Un solo momento orquestado: al cargar la landing, las líneas del hero se dibujan de izquierda a derecha en 600ms, como si se estuvieran pintando en la cancha. Eso es todo. Nada de fade-and-slide en cada sección al scrollear, nada de hover que levanta cards. Se respeta `prefers-reduced-motion`.

---

## 5. Estructura de la landing

```
┌──────────────────────────────────────────────────┐
│ CLUB CUMBRE          disciplinas  el club  entrar│  ← header, línea inferior
├──────────────────────────────────────────────────┤
│                                                  │
│  Canchas libres                                  │  ← display, alineado izq.
│  esta noche.                                     │
│                                                  │
│  Reservá desde el celular en treinta segundos.   │
│                                                  │
│  [ Ver disponibilidad ]                          │  ← único --polvo de la vista
│                                                  │
│  ══════════════════════════════════════          │  ← línea que se dibuja
│  Tenis · Pádel · Fútbol 5 · hasta las 23         │
└──────────────────────────────────────────────────┘
│ EL CLUB                                          │
│ Dos párrafos. Cuándo abrió, quién lo lleva,      │
│ por qué se juega acá y no en la otra cuadra.     │
├──────────────────────────────────────────────────┤
│ DISCIPLINAS   ┌────────┬────────┬────────┐       │
│               │ Tenis  │ Pádel  │ Fútbol │       │
│               └────────┴────────┴────────┘       │
├──────────────────────────────────────────────────┤
│ CÓMO RESERVAR   1 elegís · 2 reservás · 3 mail   │  ← acá sí van números
├──────────────────────────────────────────────────┤
│ CONTACTO      formulario · dirección · mapa      │
└──────────────────────────────────────────────────┘
```

Todo alineado a la izquierda. El texto centrado en bloques largos se lee peor y es el default de cualquier plantilla.

Los números en "cómo reservar" están justificados porque el contenido **es** una secuencia. En las otras secciones no van.

### Nota sobre el hero y la API

RF-09 dice que la landing no consume la API, y esa regla se sostiene con una precisión: la página tiene que **renderizar completa** aunque el backend esté caído. Si quieren que el hero muestre los horarios realmente libres de esta noche, se puede, pero como mejora que falla en silencio: si la llamada no responde en 2 segundos, se muestra el titular estático y nadie se entera. Lo que no puede pasar es que el sitio institucional se caiga porque se cayó la API.

---

## 6. Lo que no vamos a hacer

Vale la pena escribirlo, porque son las decisiones que se toman solas si nadie las bloquea:

- Fondo crema con serif grande y acento terracota. Es el aspecto por defecto de cualquier página generada en 2026.
- Etiquetas en mayúsculas y espaciadas arriba de cada título.
- Todo el contenido picado en cards idénticas con el mismo radio y la misma sombra gris.
- Flechitas `→` pegadas al texto de los botones.
- Fotos de stock de gente sonriendo con una raqueta. Si no hay fotos reales del club, es preferible resolverlo con color y tipografía que con un banco de imágenes.
- Contadores animados y "más de 500 socios felices".

---

## 7. Del sitio al producto

Los mismos tokens gobiernan la app, no solo la landing. Se definen una vez en `apps/web/app/globals.css` como variables CSS y se mapean a Tailwind, para que el color de un botón no dependa de qué archivo lo estaba escribiendo.

Tres aplicaciones directas:

**La grilla de disponibilidad** es el corazón del producto y el lugar donde el concepto se paga solo. Slot libre: fondo `--cancha` con la línea completa. Slot ocupado: fondo `--noche` sin línea. Slot seleccionado: `--polvo`. Se lee de un vistazo, sin leyenda.

**El mail de confirmación** usa `--cancha` de fondo y Asap para el cuerpo. Es el único momento en que la marca sale del sitio y llega a la casilla de alguien, así que no puede ser el template gris por defecto de Resend.

**El código de reserva** (`CUM-A7F3K2`) toma el prefijo del nombre del club. Aparece en el mail, en la pantalla de confirmación y es lo que el socio dice en la recepción.

---

## 8. Qué falta decidir

1. El nombre. Sin eso, no arranca nada del front.
2. Si hay fotos reales del club o se resuelve todo con color y tipografía.
3. Quién escribe los dos párrafos de "el club". Es la única parte que no se puede delegar en un sistema de diseño.
