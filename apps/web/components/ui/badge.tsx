import type { ComponentProps } from "react";

type Tone = "neutral" | "accent" | "danger" | "gold";

const tones: Record<Tone, string> = {
  neutral: "border-border-strong text-text-muted",
  accent: "border-accent/40 text-accent",
  danger: "border-danger/40 text-danger",
  gold: "border-gold/40 text-gold",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] ${tones[tone]} ${className}`.trim()}
      {...props}
    />
  );
}
