/*
 * `POST /reservas` puede chocar contra dos restricciones únicas distintas, y la
 * respuesta es opuesta en cada caso: el turno ocupado es un 409 para la persona
 * (RN-01), y el código repetido es un problema interno que se resuelve
 * reintentando. Confundirlos sería devolver "turno ocupado" cuando el turno
 * está libre. El que las distingue es `esViolacionDe()` de `common/`, por el
 * conjunto de columnas que informa Prisma.
 */

/** Columnas de `ux_reserva_slot_activo`, el índice único parcial de RN-01. */
export const COLUMNAS_SLOT_ACTIVO = ['cancha_id', 'fecha', 'hora_inicio'] as const;

/** Columna del único de `reserva.codigo`. */
export const COLUMNAS_CODIGO = ['codigo'] as const;
