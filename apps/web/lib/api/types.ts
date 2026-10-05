// Punto de consumo de los tipos que genera `npm run generate:api-types` desde
// contratos/openapi.yaml. Las pantallas importan de acá, no de schema.d.ts.
import type { components, operations, paths } from "./schema";

export type { components, operations, paths };

export type Schemas = components["schemas"];

export type Usuario = Schemas["Usuario"];
export type RolUsuario = Schemas["RolUsuario"];
export type RegistroRequest = Schemas["RegistroRequest"];
export type LoginRequest = Schemas["LoginRequest"];
export type LoginResponse = Schemas["LoginResponse"];
export type Disciplina = Schemas["Disciplina"];
export type Cancha = Schemas["Cancha"];
export type Equipamiento = Schemas["Equipamiento"];
export type DisponibilidadResponse = Schemas["DisponibilidadResponse"];
export type SlotDisponible = Schemas["SlotDisponible"];
export type Reserva = Schemas["Reserva"];
export type CrearReservaRequest = Schemas["CrearReservaRequest"];
export type ItemEquipamientoRequest = Schemas["ItemEquipamientoRequest"];
export type ItemEquipamientoReserva = Schemas["ItemEquipamientoReserva"];
export type EstadoReserva = Schemas["EstadoReserva"];
export type CancelarReservaRequest = Schemas["CancelarReservaRequest"];
export type ReenvioMailResponse = Schemas["ReenvioMailResponse"];
export type TipoNotificacion = Schemas["TipoNotificacion"];
export type PanelAdmin = Schemas["PanelAdmin"];
export type OcupacionCancha = Schemas["OcupacionCancha"];
export type ProximoTurno = Schemas["ProximoTurno"];
export type CrearCanchaRequest = Schemas["CrearCanchaRequest"];
export type ActualizarCanchaRequest = Schemas["ActualizarCanchaRequest"];
export type CrearEquipamientoRequest = Schemas["CrearEquipamientoRequest"];
export type ActualizarEquipamientoRequest = Schemas["ActualizarEquipamientoRequest"];
export type ContactoRequest = Schemas["ContactoRequest"];
export type ContactoResponse = Schemas["ContactoResponse"];
export type ApiError = Schemas["Error"];
