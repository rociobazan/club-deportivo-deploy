import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PREFIJO_API } from '../configuracion';
import { ErrorDeApi } from './error-de-api';

/** Cuerpo de error del contrato (`components.schemas.Error`). */
type CuerpoDeError = {
  tipo: string;
  titulo: string;
  estado: number;
  detalle?: string;
  instancia: string;
};

/**
 * Único filtro de excepciones: todo error sale con el formato `Error` del
 * contrato, nunca con el `{ statusCode, message, error }` por defecto de Nest
 * (design.md, decisión 4). Los errores que no son HTTP se responden como 500
 * genérico y el detalle real va solo al log.
 */
@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  private readonly logger = new Logger(FiltroDeErrores.name);

  catch(excepcion: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const solicitud = http.getRequest<Request>();
    const respuesta = http.getResponse<Response>();

    const instancia = sinPrefijo(solicitud.path);
    const cuerpo: CuerpoDeError = { ...traducir(excepcion), instancia };

    if (cuerpo.estado >= 500) {
      this.logger.error(
        `${solicitud.method} ${instancia} → ${cuerpo.estado}`,
        excepcion instanceof Error ? excepcion.stack : String(excepcion),
      );
    }

    respuesta.status(cuerpo.estado).json(cuerpo);
  }
}

function sinPrefijo(ruta: string): string {
  const prefijo = `/${PREFIJO_API}`;
  return ruta.startsWith(prefijo) ? ruta.slice(prefijo.length) || '/' : ruta;
}

function traducir(excepcion: unknown): Omit<CuerpoDeError, 'instancia'> {
  if (excepcion instanceof ErrorDeApi) {
    return excepcion.getResponse() as Omit<CuerpoDeError, 'instancia'>;
  }

  if (excepcion instanceof HttpException) {
    const estado = excepcion.getStatus();
    const detalle = detalleDe(excepcion.getResponse());

    switch (estado) {
      case 400:
        return {
          tipo: 'SOLICITUD_INVALIDA',
          titulo: 'La solicitud tiene datos inválidos',
          estado,
          detalle,
        };
      case 401:
        return {
          tipo: 'NO_AUTENTICADO',
          titulo: 'Se requiere autenticación',
          estado,
          detalle,
        };
      case 403:
        return {
          tipo: 'SIN_PERMISOS',
          titulo: 'No tenés permisos para esta operación',
          estado,
          detalle,
        };
      case 404:
        return {
          tipo: 'NO_ENCONTRADO',
          titulo: 'No encontramos lo que pediste',
          estado,
          detalle,
        };
      default:
        return {
          tipo: 'ERROR_HTTP',
          titulo: detalle ?? excepcion.message,
          estado,
        };
    }
  }

  return {
    tipo: 'ERROR_INTERNO',
    titulo: 'Algo salió mal de nuestro lado',
    estado: 500,
  };
}

/**
 * Nest guarda el mensaje de sus excepciones en `response.message`, que para el
 * ValidationPipe es un array con un mensaje por regla incumplida.
 */
function detalleDe(respuesta: string | object): string | undefined {
  if (typeof respuesta === 'string') return respuesta;
  const mensaje = (respuesta as { message?: string | string[] }).message;
  if (Array.isArray(mensaje)) return mensaje[0];
  return mensaje;
}
