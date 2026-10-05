/**
 * Quién ve qué en el header. La sesión todavía no existe: el cambio de
 * autenticación (RF-00) es el que va a leer la cookie y pasar el usuario.
 */
export type UsuarioDelHeader = {
  nombre: string;
  rol: "ADMIN" | "SOCIO";
};

/**
 * `exacto`: el link se marca activo solo en su propia ruta y no en las de
 * abajo. Lo usa "Panel" (`/admin`), que si no quedaría marcado junto con
 * Reservas, Canchas y Equipamiento, que cuelgan de la misma ruta.
 */
export type ItemDeNavegacion = { href: string; label: string; exacto?: boolean };

/** Sin sesión, según la spec de `institucional`. */
const PUBLICA: ItemDeNavegacion[] = [
  { href: "/", label: "Inicio" },
  { href: "/el-club", label: "El club" },
  { href: "/canchas", label: "Canchas y precios" },
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/contacto", label: "Contacto" },
];

/**
 * Socio: lo que le sirve a quien ya entró, no el recorrido de quien está
 * conociendo el club. Inicio y El club salen del menú pero **no del sitio**:
 * las dos páginas siguen respondiendo, e Inicio queda a un clic del logo del
 * header, que enlaza a `/`.
 */
const SOCIO: ItemDeNavegacion[] = [
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/mis-reservas", label: "Mis reservas" },
  { href: "/contacto", label: "Contacto" },
  { href: "/perfil", label: "Mi perfil" },
];

/** Administrador: las pantallas de RF-11 a RF-13. */
const ADMIN: ItemDeNavegacion[] = [
  { href: "/admin", label: "Panel", exacto: true },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/canchas", label: "Canchas" },
  { href: "/admin/equipamiento", label: "Equipamiento" },
];

export function navegacionPara(usuario?: UsuarioDelHeader): ItemDeNavegacion[] {
  if (!usuario) return PUBLICA;
  return usuario.rol === "ADMIN" ? ADMIN : SOCIO;
}

/** Iniciales para el avatar: "Jeremías Fernández" → "JF". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}
