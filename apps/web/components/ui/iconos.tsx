import type { ReactNode } from "react";

/**
 * Los diez iconos que usa Inicio, con los trazos del prototipo
 * `docs/claude-design/Inicio Deploy v2.dc.html`. Van inline en lugar de por una
 * librería: son pocos, no crecen con el bundle y el diseño los define trazo por
 * trazo. Todos comparten el lienzo de 24 y heredan el color con `currentColor`.
 */
export type NombreDeIcono =
  | "tenis"
  | "padel"
  | "futbol"
  | "ducha"
  | "parrilla"
  | "luz"
  | "auto"
  | "calendario"
  | "tocar"
  | "mail"
  | "pin"
  | "telefono"
  | "reloj";

const FORMAS: Record<NombreDeIcono, ReactNode> = {
  tenis: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.9 5.2c4 2.2 4 11.4 0 13.6" />
      <path d="M19.1 5.2c-4 2.2-4 11.4 0 13.6" />
    </>
  ),
  padel: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 9h6" />
      <path d="M12 6v6" />
    </>
  ),
  futbol: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7l4.5 3.3-1.7 5.4H9.2L7.5 10.3z" />
      <path d="M12 7V2" />
      <path d="M16.5 10.3l4.7-1.5" />
      <path d="M14.8 15.7l2.9 4" />
      <path d="M9.2 15.7l-2.9 4" />
      <path d="M7.5 10.3L2.8 8.8" />
    </>
  ),
  ducha: (
    <>
      <path d="M4 4l2.5 2.5" />
      <path d="M13.5 6.5a4.95 4.95 0 0 0-7 7" />
      <path d="M15 5 5 15" />
      <path d="M14 17v.01" />
      <path d="M10 16v.01" />
      <path d="M13 13v.01" />
      <path d="M16 10v.01" />
      <path d="M11 20v.01" />
      <path d="M17 14v.01" />
      <path d="M20 11v.01" />
    </>
  ),
  parrilla: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </>
  ),
  luz: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </>
  ),
  auto: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  calendario: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  tocar: (
    <>
      <path d="M14 4.1 12 6" />
      <path d="m5.1 8-2.9-.8" />
      <path d="m6 12-1.9 2" />
      <path d="M7.2 2.2 8 5.1" />
      <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  // Los tres de Contacto no vienen del prototipo, que no los usaba: son formas
  // simples dibujadas para este set, con el mismo trazo de 1,75.
  pin: (
    <>
      <path d="M12 21c4-4.5 6-7.9 6-10.5a6 6 0 1 0-12 0C6 13.1 8 16.5 12 21Z" />
      <circle cx="12" cy="10.5" r="2.25" />
    </>
  ),
  telefono: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3.5 2" />
    </>
  ),
};

/**
 * Decorativo por defecto: cada icono del diseño acompaña a un texto que ya dice
 * lo mismo, así que se oculta del árbol de accesibilidad para no leerlo dos
 * veces.
 */
export function Icono({
  nombre,
  size = 22,
  className = "",
}: {
  nombre: NombreDeIcono;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block ${className}`.trim()}
    >
      {FORMAS[nombre]}
    </svg>
  );
}
