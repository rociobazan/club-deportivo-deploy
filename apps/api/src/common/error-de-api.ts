import { HttpException } from '@nestjs/common';

/**
 * Error de negocio con el formato `Error` del contrato (`tipo`, `titulo`,
 * `estado`, `detalle`). El filtro global lo serializa tal cual y le agrega
 * `instancia` con la ruta pedida (design.md, decisión 4).
 *
 * Ejemplo: `throw new ErrorDeApi(409, 'EMAIL_YA_REGISTRADO', 'Ese mail ya está registrado')`.
 */
export class ErrorDeApi extends HttpException {
  constructor(
    readonly estado: number,
    readonly tipo: string,
    readonly titulo: string,
    readonly detalle?: string,
  ) {
    super({ tipo, titulo, estado, ...(detalle ? { detalle } : {}) }, estado);
  }
}
