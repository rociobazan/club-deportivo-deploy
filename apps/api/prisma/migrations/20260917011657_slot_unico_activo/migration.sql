-- RN-01: una cancha no puede tener dos reservas no canceladas en el mismo turno.
-- Índice único parcial escrito a mano: Prisma no lo expresa en el schema.
-- La cláusula WHERE hace que una reserva cancelada libere el turno.
CREATE UNIQUE INDEX "ux_reserva_slot_activo"
  ON "reserva" ("cancha_id", "fecha", "hora_inicio")
  WHERE "estado" <> 'CANCELADA';
