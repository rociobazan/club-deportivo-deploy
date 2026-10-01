"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { precioLegible } from "@/lib/club";
import { crearReserva, type EstadoReserva } from "./acciones";

export type ItemParaAlquilar = {
  id: number;
  nombre: string;
  precioPorTurno: number;
  /** Unidades libres en **este** turno, calculadas por la API. Es el tope. */
  disponible: number;
};

type Props = {
  turno: { canchaId: number; fecha: string; horaInicio: string };
  precioCancha: number;
  equipamiento: ItemParaAlquilar[];
};

export function FormularioReserva({ turno, precioCancha, equipamiento }: Props) {
  const [estado, accion, enviando] = useActionState<EstadoReserva, FormData>(crearReserva, {});

  /*
   * Los campos son controlados y no `defaultValue`, por dos razones que se
   * descubrieron probando: React 19 resetea un form no controlado después de que
   * la action termina, y `defaultValue` solo se aplica al montar, así que no
   * alcanza para repoblar. Sin esto, un 409 de la API borraba el equipamiento
   * elegido, que es justo lo que el escenario pide conservar.
   *
   * Y de paso el total a la vista sigue siendo correcto después del error. Ese
   * total es **cosmético**: el monto que vale es el que confirma la API (RN-06),
   * y la pantalla lo aclara abajo del número.
   */
  const cantidadesDe = (valores: EstadoReserva["valores"]) =>
    Object.fromEntries(
      equipamiento.map((item) => [item.id, valores?.equipamiento?.[item.id] ?? 0]),
    ) as Record<number, number>;

  const [cantidades, setCantidades] = useState<Record<number, number>>(() =>
    cantidadesDe(estado.valores),
  );
  const [jugadores, setJugadores] = useState(estado.valores?.cantidadJugadores ?? "");

  /*
   * Repoblar cuando vuelve un estado nuevo de la action, con el patrón de React
   * de ajustar estado en el render en vez de un efecto: así no hay un parpadeo
   * con los valores viejos.
   *
   * `intento` va como `key` del form, y eso no es cosmético: React 19 resetea el
   * form cuando la action termina, y lo hace sobre el DOM, por fuera de lo que el
   * reconciliador cree que hay. Para un `<select>` controlado eso deja el nodo en
   * la primera opción y React no lo corrige, porque para él el valor no cambió.
   * Cambiar la `key` remonta el form y los valores del estado se vuelven a
   * aplicar. Se vio probando: el total seguía diciendo 19.000 mientras el
   * selector mostraba 0.
   */
  const [ultimosValores, setUltimosValores] = useState(estado.valores);
  const [intento, setIntento] = useState(0);
  if (estado.valores !== ultimosValores) {
    setUltimosValores(estado.valores);
    setCantidades(cantidadesDe(estado.valores));
    setJugadores(estado.valores?.cantidadJugadores ?? "");
    setIntento((anterior) => anterior + 1);
  }

  const totalEquipamiento = equipamiento.reduce(
    (total, item) => total + item.precioPorTurno * (cantidades[item.id] ?? 0),
    0,
  );
  const total = precioCancha + totalEquipamiento;

  if (estado.reserva) {
    return <Confirmacion reserva={estado.reserva} />;
  }

  return (
    <form key={intento} action={accion} noValidate className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="canchaId" value={turno.canchaId} />
      <input type="hidden" name="fecha" value={turno.fecha} />
      <input type="hidden" name="horaInicio" value={turno.horaInicio} />

      <Card>
        <CardTitle>Cuántos van a jugar</CardTitle>
        <p className="mt-1 text-sm text-text-muted">
          Opcional, y no cambia el precio: el turno cuesta lo mismo con 2 que con 4. Nos sirve
          para saber cuánta gente esperar.
        </p>
        <div className="mt-4 max-w-[200px]">
          <Campo id="cantidadJugadores" label="Cantidad de jugadores">
            <Input
              id="cantidadJugadores"
              name="cantidadJugadores"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Sin informar"
              value={jugadores}
              onChange={(evento) => setJugadores(evento.target.value)}
            />
          </Campo>
        </div>
      </Card>

      {equipamiento.length > 0 ? (
        <Card>
          <CardTitle>Equipamiento para alquilar</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            Solo lo que queda libre en este turno.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {equipamiento.map((item) => {
              const idCampo = `equipamiento-${item.id}`;
              const agotado = item.disponible === 0;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3"
                >
                  <div>
                    <label htmlFor={idCampo} className="font-semibold text-text">
                      {item.nombre}
                    </label>
                    <p className="text-sm text-text-muted">
                      {precioLegible(item.precioPorTurno)} por turno ·{" "}
                      {agotado ? "sin unidades libres" : `${item.disponible} disponibles`}
                    </p>
                  </div>

                  <select
                    id={idCampo}
                    name={idCampo}
                    disabled={agotado}
                    value={String(cantidades[item.id] ?? 0)}
                    onChange={(evento) =>
                      setCantidades((anterior) => ({
                        ...anterior,
                        [item.id]: Number(evento.target.value),
                      }))
                    }
                    className="h-11 rounded-xl border border-border-strong bg-surface-2 px-3 text-text disabled:opacity-50"
                  >
                    {/* El tope es el stock del turno: no se puede pedir de más. */}
                    {Array.from({ length: item.disponible + 1 }, (_, cantidad) => (
                      <option key={cantidad} value={cantidad}>
                        {cantidad}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-text-muted">Total a pagar en el club</p>
            <p
              data-testid="total-a-la-vista"
              className="mt-0.5 font-display text-[32px] font-semibold leading-none"
            >
              {precioLegible(total)}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Cancha {precioLegible(precioCancha)}
              {totalEquipamiento > 0 ? ` + equipamiento ${precioLegible(totalEquipamiento)}` : ""}.
              El monto definitivo es el que confirma el club al crear la reserva.
            </p>
          </div>

          <Button type="submit" disabled={enviando}>
            {enviando ? "Confirmando…" : "Confirmar reserva"}
          </Button>
        </div>

        {estado.error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {estado.error}
          </p>
        ) : null}
      </Card>
    </form>
  );
}

/**
 * La confirmación se muestra acá y no redirige: `/mis-reservas` es del ítem 1.4
 * y hoy daría 404. Cuando exista, este acceso pasa a apuntar ahí.
 */
function Confirmacion({ reserva }: { reserva: NonNullable<EstadoReserva["reserva"]> }) {
  return (
    <Card role="status" className="mt-8">
      <CardTitle>Turno confirmado</CardTitle>
      <p className="mt-2 text-sm text-text-muted">
        Guardá el código: con eso te identificás en el club.
      </p>

      <p
        data-testid="codigo-de-reserva"
        className="mt-4 font-display text-[32px] font-semibold tracking-[0.04em] text-accent"
      >
        {reserva.codigo}
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-text-muted">Cancha</dt>
          <dd className="mt-0.5 font-semibold">{reserva.cancha ?? `#${reserva.canchaId}`}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Turno</dt>
          <dd className="mt-0.5 font-semibold">
            {reserva.fecha} · {reserva.horaInicio} a {reserva.horaFin}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Total a pagar en el club</dt>
          <dd className="mt-0.5 font-semibold">{precioLegible(reserva.montoTotal)}</dd>
        </div>
        <div>
          <dt className="text-sm text-text-muted">Estado</dt>
          <dd className="mt-0.5 font-semibold">{reserva.estado}</dd>
        </div>
      </dl>

      <Link href="/disponibilidad" className={buttonClasses("secondary", "mt-6")}>
        Reservar otro turno
      </Link>
    </Card>
  );
}
