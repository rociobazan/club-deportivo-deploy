import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CORREO } from '../common/correo/correo';
import type { Correo } from '../common/correo/correo';
import { ErrorDeApi } from '../common/error-de-api';
import { Reloj } from '../common/reloj';
import { CONFIGURACION } from '../configuracion';
import type { Configuracion } from '../configuracion';
import { PrismaService } from '../prisma/prisma.service';
import { COSTO_BCRYPT, normalizarEmail } from './auth.service';

const UNA_HORA_MS = 60 * 60 * 1000;
const UN_MINUTO_MS = 60 * 1000;

/** 32 bytes aleatorios en base64url: 256 bits, 43 caracteres sin relleno. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 y no bcrypt (design.md, decisión 1): el token no se puede adivinar,
 * y un hash sin sal es lo que permite buscarlo por índice.
 */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * El nombre del error y, si es de Prisma, su código (`P2028`), nunca su
 * mensaje: el de Prisma puede repetir los argumentos de la consulta (el mail)
 * y el de Resend trae direcciones.
 */
function nombreDelError(causa: unknown): string {
  if (causa instanceof Prisma.PrismaClientKnownRequestError) return `${causa.name} ${causa.code}`;
  return causa instanceof Error ? causa.name : typeof causa;
}

/** Inexistente, vencido, usado o de una cuenta inactiva: la misma respuesta. */
const enlaceInvalido = () =>
  new ErrorDeApi(
    400,
    'ENLACE_INVALIDO',
    'El enlace no es válido o ya venció',
    'Pedí uno nuevo desde "¿Olvidaste tu contraseña?".',
  );

/**
 * Recuperación de contraseña por mail (RF-16). Vive aparte de `AuthService`
 * porque tiene su propio ciclo (token, mail, vencimiento) y no comparte estado
 * con el login: solo el hasheo y la normalización del mail.
 */
@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    @Inject(CORREO) private readonly correo: Correo,
    @Inject(CONFIGURACION) private readonly configuracion: Configuracion,
  ) {}

  /**
   * Dispara la solicitud y vuelve enseguida, sin esperarla (design.md,
   * decisión 3): si la respuesta esperara al mail, una cuenta registrada
   * tardaría más que una inexistente y eso la delataría.
   */
  solicitar(email: string): void {
    this.procesarSolicitud(email).catch((causa: unknown) => {
      this.logger.error(`Falló una solicitud de recuperación de contraseña (${nombreDelError(causa)}).`);
    });
  }

  /** El trabajo de `solicitar`, expuesto para poder esperarlo en los tests. */
  async procesarSolicitud(email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: normalizarEmail(email) },
      select: { id: true, nombre: true, email: true, activo: true },
    });
    if (!usuario?.activo) return;

    const ahora = this.reloj.instante();
    const token = generarToken();
    const nuevo = await this.emitirSiHayCupo(usuario.id, token, ahora);
    if (!nuevo) {
      this.logger.warn(
        `El usuario ${usuario.id} llegó al máximo de mails de recuperación por hora; no se envía otro.`,
      );
      return;
    }

    try {
      await this.correo.enviar({
        para: usuario.email,
        asunto: 'Restablecé tu contraseña de Deploy',
        texto: this.cuerpoDelMail(usuario.nombre, token),
      });
    } catch (causa) {
      // El token nunca llegó a nadie: se descarta, no cuenta para el máximo por
      // hora y los enlaces anteriores siguen sirviendo (design.md, decisión 3).
      this.logger.error(
        `No se pudo enviar el mail de recuperación al usuario ${usuario.id} (${nombreDelError(causa)}).`,
      );
      await this.prisma.tokenRecuperacion.delete({ where: { id: nuevo.id } });
      return;
    }

    // Recién con el mail enviado dejan de servir los anteriores. Los de id
    // menor y no "todos menos este": dos solicitudes que terminan juntas no se
    // invalidan una a la otra, y sobrevive la más nueva.
    await this.prisma.tokenRecuperacion.updateMany({
      where: { usuarioId: usuario.id, usadoEn: null, id: { lt: nuevo.id } },
      data: { usadoEn: ahora },
    });
    this.logger.log(`Mail de recuperación enviado al usuario ${usuario.id}.`);
  }

  /**
   * Cuenta y crea con la fila del usuario bloqueada (design.md, decisión 5):
   * sin el bloqueo, solicitudes simultáneas leen el mismo conteo y pasan todas.
   * Devuelve `null` si la cuenta ya llegó al máximo por hora.
   */
  private emitirSiHayCupo(
    usuarioId: number,
    token: string,
    ahora: Date,
  ): Promise<{ id: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuario WHERE id = ${usuarioId} FOR UPDATE`;

      const recientes = await tx.tokenRecuperacion.count({
        where: { usuarioId, creadoEn: { gt: new Date(ahora.getTime() - UNA_HORA_MS) } },
      });
      if (recientes >= this.configuracion.maxRecuperacionesPorHora) return null;

      return tx.tokenRecuperacion.create({
        data: {
          usuarioId,
          tokenHash: hashDeToken(token),
          // `creadoEn` explícito y no el default de la base: el conteo por hora
          // compara contra el Reloj, y los tests lo reemplazan.
          creadoEn: ahora,
          expiraEn: new Date(
            ahora.getTime() + this.configuracion.recuperacionVigenciaMinutos * UN_MINUTO_MS,
          ),
        },
        select: { id: true },
      });
    });
  }

  /**
   * Cambia la contraseña con un token vigente y sin usar (design.md,
   * decisión 4). No inicia sesión ni revoca las ya emitidas.
   */
  async restablecer(token: string, passwordNueva: string): Promise<void> {
    const ahora = this.reloj.instante();
    const encontrado = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: hashDeToken(token) },
      select: {
        id: true,
        usuarioId: true,
        expiraEn: true,
        usadoEn: true,
        usuario: { select: { activo: true } },
      },
    });
    if (
      !encontrado ||
      encontrado.usadoEn !== null ||
      encontrado.expiraEn <= ahora ||
      !encontrado.usuario.activo
    ) {
      throw enlaceInvalido();
    }

    // Fuera de la transacción: bcrypt tarda y no hace falta tener nada bloqueado mientras.
    const passwordHash = await bcrypt.hash(passwordNueva, COSTO_BCRYPT);

    await this.prisma.$transaction(async (tx) => {
      // Condicionado a `usadoEn: null`: de dos solicitudes simultáneas con el
      // mismo token, solo una marca la fila y solo esa cambia la contraseña.
      const marcado = await tx.tokenRecuperacion.updateMany({
        where: { id: encontrado.id, usadoEn: null },
        data: { usadoEn: ahora },
      });
      if (marcado.count !== 1) throw enlaceInvalido();

      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId: encontrado.usuarioId, usadoEn: null },
        data: { usadoEn: ahora },
      });
      // `passwordCambiadaEn` cierra las sesiones abiertas de la cuenta (decisión 10).
      await tx.usuario.update({
        where: { id: encontrado.usuarioId },
        data: { passwordHash, passwordCambiadaEn: ahora },
      });
    });
  }

  private enlace(token: string): string {
    const url = new URL('/restablecer', this.configuracion.frontendUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private cuerpoDelMail(nombre: string, token: string): string {
    const minutos = this.configuracion.recuperacionVigenciaMinutos;
    return [
      `Hola, ${nombre}:`,
      '',
      'Recibimos un pedido para restablecer la contraseña de tu cuenta en Deploy. Para elegir una nueva, entrá a este enlace:',
      '',
      this.enlace(token),
      '',
      `El enlace dura ${minutos} minutos y sirve una sola vez.`,
      '',
      'Si no lo pediste, ignorá este mail: tu contraseña no cambia.',
    ].join('\n');
  }
}
