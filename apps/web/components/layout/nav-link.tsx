"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cliente porque necesita la ruta actual para marcar el link activo.
export function NavLink({
  href,
  exacto = false,
  children,
  className = "",
}: {
  href: string;
  /** Activo solo en `href`, no en sus subrutas. */
  exacto?: boolean;
  children: string;
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (!exacto && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap text-sm transition-colors hover:text-text ${
        active ? "text-accent" : "text-text-muted"
      } ${className}`.trim()}
    >
      {children}
    </Link>
  );
}
