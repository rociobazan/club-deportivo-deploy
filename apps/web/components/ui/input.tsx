import type { ComponentProps } from "react";

// En React 19 `ref` es una prop más, así que no hace falta forwardRef.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`min-h-12 w-full rounded-xl border border-border-strong bg-surface-input px-3.5 text-[15px] text-text placeholder:text-text-subtle focus:border-accent focus:outline-none ${className}`.trim()}
      {...props}
    />
  );
}
