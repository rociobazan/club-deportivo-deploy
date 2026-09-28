/**
 * Cliente de mail del proyecto. La interfaz es a propósito lo mínimo que hace
 * falta: el ítem 1.4 (RF-08) manda los mails de reserva con este mismo
 * `enviar`, sin volver a decidir proveedor ni remitente (design.md, decisión 1).
 */
export const CORREO = Symbol('CORREO');

export type MailEnviado = {
  para: string;
  asunto: string;
  texto: string;
  /** A dónde contesta quien lo recibe, cuando no es el remitente del sistema. */
  responderA?: string;
};

export type Correo = {
  enviar(mail: MailEnviado): Promise<void>;
};

/**
 * El proveedor rechazó el envío o no se pudo llegar hasta él. El detalle queda
 * del lado del servidor: quien llama decide qué ve la persona.
 */
export class CorreoNoEnviadoError extends Error {
  constructor(detalle: string) {
    super(detalle);
    this.name = 'CorreoNoEnviadoError';
  }
}
