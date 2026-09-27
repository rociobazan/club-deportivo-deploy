/**
 * Contenido de Inicio, El club y Contacto. Es estático a propósito: RF-09 pide
 * que esas páginas se sostengan con la API caída, así que nada de esto se
 * consulta (design.md, decisión 6). Los textos salen del prototipo
 * `docs/claude-design/Deploy Club.dc.html`.
 *
 * Lo único que sí viene de la API es el precio "desde" de cada disciplina en
 * Inicio, y degrada en silencio si no llega.
 *
 * Cuatro fotos se llamaban `padel`, `buffet`, `vestuarios` y `entrada` y tenían
 * el contenido cruzado de a pares. Al corregirlo se les cambió **el nombre** y no
 * solo el contenido: el optimizador de imágenes de Next cachea por URL y le dio
 * el mismo ETag a dos archivos distintos, así que reusar el nombre servía la
 * foto vieja aunque el archivo en disco fuera el correcto. Con nombres nuevos no
 * hay caché —ni de Next, ni del navegador, ni de otra máquina— que pueda mentir.
 *
 * Las fotos son las del prototipo, convertidas a WebP y reducidas al ancho que
 * cada una ocupa en la página: los PNG originales pesaban 13 MB entre las cinco.
 * Viven en `public/fotos/` y se sirven con `next/image`.
 */

export type Foto = {
  /** Ruta dentro de `public/`. */
  src: string;
  /**
   * Qué se ve, no cómo se llama la sección: el prototipo usaba el nombre de la
   * disciplina como alternativo, que no le dice nada a quien no ve la imagen.
   */
  alt: string;
};

export const HERO = {
  titulo: "Salí a jugar.",
  bajada:
    "Deploy es un club de barrio con seis canchas de tenis, pádel y fútbol 5 en Rivadeo 1480. Abierto de lunes a sábado.",
  /** La tarjeta flotante del hero, que lleva a la disponibilidad por disciplina. */
  atajo: {
    titulo: "Reservá directo",
    bajada: "Elegí el deporte y mirá qué hay libre hoy.",
    accion: "Ver todos los horarios libres",
    nota: "Reservá en treinta segundos. Cancelás hasta dos horas antes.",
  },
} as const;

export type CanchaInstitucional = {
  nombre: string;
  /** Superficie o si está techada: lo que no cambia de un turno a otro. */
  detalle: string;
};

export type DisciplinaInstitucional = {
  /** Opcional: una disciplina puede no tener foto todavía. */
  foto?: Foto;
  /**
   * El mismo nombre que la disciplina en la base. Es la clave con la que Inicio
   * le pega el precio que devuelve la API; si no coincide, la tarjeta se muestra
   * sin precio en lugar de con uno equivocado.
   */
  nombre: string;
  duracionTurnoMin: number;
  /** Cuál de los iconos de `components/ui/iconos.tsx` le toca en Inicio. */
  icono: "tenis" | "padel" | "futbol";
  /**
   * Cómo se resume la disciplina en Inicio ("3 canchas · 2 techadas"). Va escrito
   * y no contado desde `canchas` porque el texto no es un número: dice qué la
   * distingue, no cuántas filas tiene la lista.
   */
  resumen: string;
  descripcion: string;
  canchas: CanchaInstitucional[];
};

export const DISCIPLINAS: DisciplinaInstitucional[] = [
  {
    nombre: "Tenis",
    icono: "tenis",
    resumen: "2 canchas",
    duracionTurnoMin: 60,
    descripcion:
      "Dos canchas iluminadas, una de polvo y una de cemento. Turnos de una hora, del alba al cierre.",
    foto: {
      src: "/fotos/tenis.webp",
      alt: "Cancha de tenis de polvo de ladrillo al atardecer, con las luces encendidas",
    },
    canchas: [
      { nombre: "Cancha 1", detalle: "Polvo de ladrillo" },
      { nombre: "Cancha 2", detalle: "Cemento" },
    ],
  },
  {
    nombre: "Pádel",
    icono: "padel",
    resumen: "3 canchas · 2 techadas",
    duracionTurnoMin: 90,
    descripcion:
      "Tres canchas panorámicas, dos techadas para cuando Córdoba decide llover. Hora y media de juego.",
    foto: {
      src: "/fotos/cancha-padel.webp",
      alt: "Cancha de pádel panorámica y techada, con las paredes de vidrio iluminadas",
    },
    canchas: [
      { nombre: "Pádel 1", detalle: "Techada" },
      { nombre: "Pádel 2", detalle: "Techada" },
      { nombre: "Pádel 3", detalle: "Descubierta" },
    ],
  },
  {
    nombre: "Fútbol 5",
    icono: "futbol",
    resumen: "1 cancha · césped sintético",
    duracionTurnoMin: 60,
    descripcion:
      "Césped sintético nuevo, arcos reglamentarios y la cancha más peleada del club. Una hora de partido.",
    foto: {
      src: "/fotos/futbol5.webp",
      alt: "Cancha de fútbol 5 de césped sintético, con los arcos y las luces encendidas",
    },
    canchas: [{ nombre: "Cancha Sur", detalle: "Césped sintético" }],
  },
];

export const INSTALACIONES = {
  kicker: "El club",
  titulo: "Un club chico que funciona como uno grande",
  bajada:
    "Abrimos en 2009 con dos canchas de tenis y una parrilla. Hoy son seis canchas, cuatrocientos socios y la misma parrilla.",
  /**
   * La versión corta de `SERVICIOS`, que es la que entra en Inicio: El club los
   * cuenta completos, acá cada uno tiene que leerse en un renglón.
   */
  items: [
    { icono: "ducha", titulo: "Vestuarios", detalle: "Agua caliente y lockers." },
    {
      icono: "parrilla",
      titulo: "Buffet y parrilla",
      detalle: "Para el tercer tiempo o para quedarse después.",
    },
    {
      icono: "luz",
      titulo: "Luces LED en las seis canchas",
      detalle: "A las 22 se juega igual que a las 10.",
    },
    {
      icono: "auto",
      titulo: "Estacionamiento propio",
      detalle: "Sin cargo, adentro del club.",
    },
  ],
} as const;

/** La misma lista que el prototipo usa en Inicio y en El club. */
export const SERVICIOS = [
  {
    icono: "ducha",
    titulo: "Vestuarios con agua caliente",
    descripcion: "Abiertos todo el día, con lockers y secadores.",
  },
  {
    icono: "parrilla",
    titulo: "Buffet y parrilla",
    descripcion: "Sánguches, bebidas y el asado de los sábados.",
  },
  {
    icono: "luz",
    titulo: "Luces LED en las seis canchas",
    descripcion: "Se juega igual de bien a las diez de la noche.",
  },
  {
    icono: "auto",
    titulo: "Estacionamiento propio",
    descripcion: "Veinte lugares sobre la calle lateral, sin cargo.",
  },
] as const;

/**
 * Los tres pasos que enumera el requisito "Sitio institucional público". El
 * prototipo los cuenta en prosa en "Reservá en treinta segundos"; acá se
 * separan para que se lean de un saque, con la misma voz.
 */
export const COMO_RESERVAR = {
  kicker: "Reservas",
  titulo: "Reservá en treinta segundos",
  bajada:
    "Sin llamar ni mandar mensaje. Elegís, tocás, y el turno queda a tu nombre.",
  pasos: [
    {
      icono: "calendario",
      titulo: "Elegí el día",
      detalle: "De lunes a sábado. Los domingos el club no abre.",
    },
    {
      icono: "tocar",
      titulo: "Tocá un horario libre",
      detalle: "Ves las canchas disponibles y elegís la que quieras.",
    },
    {
      icono: "mail",
      titulo: "Recibís el mail con el código",
      detalle: "Lo mostrás en la entrada y listo.",
    },
  ],
  nota: "Podés cancelar hasta dos horas antes del turno.",
} as const;

export const CIERRE = {
  titulo: "¿Jugamos esta semana?",
  socio: "Crear cuenta de socio",
  /** El renglón de contacto: los datos salen de `CLUB`, acá solo el envoltorio. */
  pregunta: "¿Preguntas?",
  enlace: "Escribile al club",
} as const;

export type FotoDeGaleria = Foto & {
  /** La píldora que se ve sobre la foto: `alt` describe, esto rotula. */
  etiqueta: string;
};

/** Las cinco fotos del carrusel de Inicio, en el orden del diseño. */
export const GALERIA: readonly FotoDeGaleria[] = [
  {
    src: "/fotos/cancha-padel.webp",
    alt: "Cancha de pádel panorámica y techada, con las paredes de vidrio iluminadas",
    etiqueta: "Cancha de pádel techada",
  },
  {
    src: "/fotos/tenis.webp",
    alt: "Cancha de tenis de polvo de ladrillo al atardecer, con las luces encendidas",
    etiqueta: "Cancha de tenis",
  },
  {
    src: "/fotos/futbol5.webp",
    alt: "Cancha de fútbol 5 de césped sintético, con los arcos y las luces encendidas",
    etiqueta: "Fútbol 5, césped sintético",
  },
  {
    src: "/fotos/vestuarios-duchas.webp",
    alt: "Vestuarios del club, con duchas, bachas y lockers",
    etiqueta: "Vestuarios y duchas",
  },
  {
    src: "/fotos/buffet-parrilla.webp",
    alt: "Buffet del club, con los asadores y el kiosco",
    etiqueta: "Buffet, kiosco y asadores",
  },
];

export const EL_CLUB = {
  eyebrow: "El club",
  titulo: "Disciplinas e instalaciones",
  historia:
    "Deploy abrió en 2009 con dos canchas de tenis y una parrilla. Hoy somos seis canchas, cuatrocientos socios y el mismo asado de los sábados.",
  /**
   * Los dos números que no salen de los datos. La cantidad de canchas y de
   * disciplinas se cuenta de `DISCIPLINAS`, para que no se desincronice al
   * sumar una.
   */
  desde: "2009",
  socios: "400",
} as const;

export const CONTACTO = {
  eyebrow: "Contacto",
  titulo: "Escribinos o pasá a conocer el club",
  /** Las aclaraciones del prototipo al lado de cada dato. */
  notas: {
    telefono: "También por WhatsApp",
    email: "Respondemos el mismo día",
  },
} as const;
