import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const colors = [
  { name: "bg", value: "#060807", className: "bg-bg" },
  { name: "surface", value: "#0B0F0E", className: "bg-surface" },
  { name: "surface-raised", value: "#0E1211", className: "bg-surface-raised" },
  { name: "surface-input", value: "#131817", className: "bg-surface-input" },
  { name: "surface-hover", value: "#161C1A", className: "bg-surface-hover" },
  { name: "text", value: "#F2F5F4", className: "bg-text" },
  { name: "text-muted", value: "#9AA5A1", className: "bg-text-muted" },
  { name: "text-subtle", value: "#7F8A85", className: "bg-text-subtle" },
  { name: "accent", value: "#00E58F", className: "bg-accent" },
  { name: "accent-hover", value: "#7BFFCB", className: "bg-accent-hover" },
  { name: "danger", value: "#FF9B9B", className: "bg-danger" },
  { name: "gold", value: "#C9A86B", className: "bg-gold" },
];

export default function Estilos() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16 flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-semibold">Base visual</h1>
        <p className="text-text-muted">
          Tokens y componentes tomados del prototipo de Claude Design. Sirve
          para revisar la identidad; no es una pantalla del producto.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">Colores</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colors.map((color) => (
            <li
              key={color.name}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <span
                className={`size-9 shrink-0 rounded-lg border border-border-strong ${color.className}`}
              />
              <span className="flex flex-col text-sm">
                <span>{color.name}</span>
                <span className="text-text-subtle">{color.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">Tipografías</h2>
        <Card className="flex flex-col gap-3">
          <p className="font-display text-2xl font-semibold">
            Outfit, para los títulos
          </p>
          <p className="text-text-muted">
            DM Sans, para el texto corrido. Tres deportes, un solo turno por
            reservar.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">Componentes</h2>
        <Card className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Reservar turno</Button>
            <Button variant="secondary">Ver disponibilidad</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button disabled>Sin cupo</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">Confirmada</Badge>
            <Badge tone="neutral">Completada</Badge>
            <Badge tone="danger">Cancelada</Badge>
            <Badge tone="gold">Techada</Badge>
          </div>
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <label className="text-sm text-text-muted" htmlFor="ejemplo">
              Mail
            </label>
            <Input id="ejemplo" type="email" placeholder="socio@club.test" />
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="flex flex-col gap-2">
            <CardTitle>Cancha 1 — Tenis</CardTitle>
            <p className="text-text-muted">Turnos de 60 minutos · $9000</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <CardTitle>Pádel 1 — techada</CardTitle>
            <p className="text-text-muted">Turnos de 90 minutos · $14000</p>
          </Card>
        </div>
      </section>
    </main>
  );
}
