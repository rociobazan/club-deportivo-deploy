"use client";

import { useEffect } from "react";

/**
 * Enciende los `[data-reveal]` de la página cuando entran en pantalla, poniendo
 * `data-reveal="on"`. El estado oculto y la transición los define `globals.css`.
 *
 * Es un único observador para todos los bloques en lugar de un componente
 * cliente por bloque: así el contenido de Inicio se queda entero en el Server
 * Component y al navegador no le baja nada más que este efecto.
 *
 * Si el JS no corre, el `<noscript>` de la página anula el estado oculto y no se
 * pierde contenido. Con `prefers-reduced-motion` tampoco se oculta nada.
 */
export function RevealAlScroll() {
  useEffect(() => {
    const objetivos = document.querySelectorAll<HTMLElement>('[data-reveal=""]');

    // Sin IntersectionObserver no hay con qué saber qué entró en pantalla: se
    // muestra todo de una, que es mejor que dejarlo invisible.
    if (!("IntersectionObserver" in window)) {
      for (const elemento of objetivos) elemento.setAttribute("data-reveal", "on");
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          entrada.target.setAttribute("data-reveal", "on");
          // Una sola vez: el bloque ya no vuelve a esconderse al salir.
          observador.unobserve(entrada.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    for (const elemento of objetivos) observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return null;
}
