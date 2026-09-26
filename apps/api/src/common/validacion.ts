import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * La única configuración del ValidationPipe: la registra AppModule como
 * APP_PIPE y la usan los tests de DTOs, así prueban exactamente lo que corre.
 * Un campo que el contrato no declara responde 400 (design.md, decisión 3).
 */
export const opcionesDeValidacion: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

export const crearPipeDeValidacion = () => new ValidationPipe(opcionesDeValidacion);
