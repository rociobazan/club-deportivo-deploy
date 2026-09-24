"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cliente porque necesita la ruta actual para marcar el link activo.
export function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: string;
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

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
