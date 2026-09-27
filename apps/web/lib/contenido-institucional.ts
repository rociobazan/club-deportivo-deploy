/**
 * Contenido de Inicio, El club y Contacto. Es estático a propósito: RF-09 pide
 * que esas páginas se sostengan con la API caída, así que nada de esto se
 * consulta (design.md, decisión 6). Los textos salen del prototipo
 * `docs/claude-design/Deploy Club.dc.html`.
 *
 * Lo único que sí viene de la API es el precio "desde" de cada disciplina en
 * Inicio, y degrada en silencio si no llega.
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
  eyebrow: "Club deportivo · Córdoba",
  /** Dos líneas: el salto es parte del diseño del hero. */
  titulo: ["Salí a jugar.", "Del resto nos ocupamos nosotros."],
  bajada:
    "Seis canchas de tenis, pádel y fútbol 5 en el corazón de barrio General Paz. Turnos de 8 a 23, todos los días, y la cancha lista cuando llegás.",
  numeros: [
    { valor: "6", etiqueta: "canchas" },
    { valor: "15 h", etiqueta: "de 8 a 23" },
    { valor: "3", etiqueta: "disciplinas" },
  ],
  foto: {
    src: "/fotos/entrada.webp",
    alt: "Entrada del club Deploy, con las canchas de fondo",
  },
} as const;

export type CanchaInstitucional = {
  nombre: string;
  /** Superficie o si está techada: lo que no cambia de un turno a otro. */
  detalle: string;
};

export type DisciplinaInstitucional = {
  /** No todas tienen: el prototipo muestra Pádel y Fútbol 5, y Tenis sin foto. */
  foto?: Foto;
  /**
   * El mismo nombre que la disciplina en la base. Es la clave con la que Inicio
   * le pega el precio que devuelve la API; si no coincide, la tarjeta se muestra
   * sin precio en lugar de con uno equivocado.
   */
  nombre: string;
  duracionTurnoMin: number;
  descripcion: string;
  canchas: CanchaInstitucional[];
};

export const DISCIPLINAS: DisciplinaInstitucional[] = [
  {
    nombre: "Tenis",
    duracionTurnoMin: 60,
    descripcion:
      "Dos canchas iluminadas, una de polvo y una de cemento. Turnos de una hora, del alba al cierre.",
    canchas: [
      { nombre: "Cancha 1", detalle: "Polvo de ladrillo" },
      { nombre: "Cancha 2", detalle: "Cemento" },
    ],
  },
  {
    nombre: "Pádel",
    duracionTurnoMin: 90,
    descripcion:
      "Tres canchas panorámicas, dos techadas para cuando Córdoba decide llover. Hora y media de juego.",
    foto: {
      src: "/fotos/padel.webp",
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
  eyebrow: "Las instalaciones",
  titulo: "Un club chico que funciona como uno grande",
  bajada:
    "Vestuarios con agua caliente todo el día, buffet abierto hasta el último turno, luces LED en las seis canchas y estacionamiento propio sobre la calle lateral.",
  fotos: [
    { src: "/fotos/vestuarios.webp", alt: "Vestuarios y duchas del club" },
    { src: "/fotos/buffet.webp", alt: "Buffet, kiosco y asadores del club" },
  ],
} as const;

/** La misma lista que el prototipo usa en Inicio y en El club. */
export const SERVICIOS = [
  {
    titulo: "Vestuarios con agua caliente",
    descripcion: "Abiertos de 8 a 23, con lockers y secadores.",
  },
  {
    titulo: "Buffet y parrilla",
    descripcion: "Sánguches, bebidas y el asado de los sábados.",
  },
  {
    titulo: "Luces LED en las seis canchas",
    descripcion: "Se juega igual de bien a las diez de la noche.",
  },
  {
    titulo: "Estacionamiento propio",
    descripcion: "Veinte lugares sobre la calle lateral, sin cargo.",
  },
] as const;

/**
 * Los tres pasos que enumera el requisito "Sitio institucional público". El
 * prototipo los cuenta en prosa en "Reservá en treinta segundos"; acá se
 * separan para que se lean de un saque, con la misma voz.
 */
export const COMO_RESERVAR = [
  {
    titulo: "Elegí el día",
    descripcion: "Abrís la disponibilidad y ves la grilla completa de las seis canchas.",
  },
  {
    titulo: "Tocá un horario libre",
    descripcion: "Confirmás el turno en una pantalla, con el precio a la vista.",
  },
  {
    titulo: "Te llega el mail con el código",
    descripcion: "Lo mostrás al llegar, y podés cancelar hasta dos horas antes.",
  },
] as const;

export const CIERRE = {
  titulo: "Reservá en treinta segundos",
  bajada:
    "Elegís el día, tocás un horario libre y listo. Te llega el mail con el código y podés cancelar hasta dos horas antes.",
} as const;

export const EL_CLUB = {
  eyebrow: "El club",
  titulo: "Disciplinas e instalaciones",
  historia:
    "Deploy abrió en 2009 con dos canchas de tenis y una parrilla. Hoy somos seis canchas, cuatrocientos socios y el mismo asado de los sábados.",
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
