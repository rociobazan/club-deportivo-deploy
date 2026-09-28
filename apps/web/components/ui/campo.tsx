import type { ReactNode } from "react";

/** Etiqueta, control y error de un campo, con la relación ARIA armada. */
export function Campo({
  id,
  label,
  error,
  ocultarEtiqueta = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  /**
   * Deja la etiqueta solo para lectores de pantalla, cuando el diseño la
   * reemplaza por un placeholder. El `<label>` sigue asociado al control: sin
   * él, quien usa lector de pantalla no sabe qué campo está completando.
   */
  ocultarEtiqueta?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={
          ocultarEtiqueta ? "sr-only" : "text-sm font-semibold text-text"
        }
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
