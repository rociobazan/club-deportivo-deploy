import type { ComponentProps } from "react";

const campo =
  "w-full rounded-xl border border-border-strong bg-surface-input px-3.5 text-[15px] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

// En React 19 `ref` es una prop más, así que no hace falta forwardRef.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${campo} min-h-12 ${className}`.trim()} {...props} />;
}

/** Mismo aspecto que `Input`, para los mensajes de varias líneas. */
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${campo} py-3 ${className}`.trim()} {...props} />;
}

/** Mismo aspecto que `Input`, para elegir de una lista. */
export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${campo} min-h-12 ${className}`.trim()} {...props} />;
}
