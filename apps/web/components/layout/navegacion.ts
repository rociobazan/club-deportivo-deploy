/**
 * Quién ve qué en el header. La sesión todavía no existe: el cambio de
 * autenticación (RF-00) es el que va a leer la cookie y pasar el usuario.
 */
export type UsuarioDelHeader = {
  nombre: string;
  rol: "ADMIN" | "SOCIO";
};

export type ItemDeNavegacion = { href: string; label: string };

/** Sin sesión, según la spec de `institucional`. */
const PUBLICA: ItemDeNavegacion[] = [
  { href: "/el-club", label: "El club" },
  { href: "/canchas", label: "Canchas y precios" },
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/contacto", label: "Contacto" },
];

/** Socio: lo público más sus reservas. */
const SOCIO: ItemDeNavegacion[] = [
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/mis-reservas", label: "Mis reservas" },
  { href: "/el-club", label: "El club" },
  { href: "/contacto", label: "Contacto" },
];

/** Administrador: las pantallas de RF-11 a RF-13. */
const ADMIN: ItemDeNavegacion[] = [
  { href: "/admin", label: "Panel" },
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
