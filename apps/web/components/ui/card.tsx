import type { ComponentProps } from "react";

export function Card({
  className = "",
  ...props
}: ComponentProps<"div"> & { className?: string }) {
  return (
    <div
      className={`rounded-[20px] border border-border bg-surface-raised p-6 ${className}`.trim()}
      {...props}
    />
  );
}

export function CardTitle({ className = "", ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={`font-display text-lg font-semibold text-text ${className}`.trim()}
      {...props}
    />
  );
}
