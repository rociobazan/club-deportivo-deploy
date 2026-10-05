import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';

import { cargarCatalogo } from './catalogo';

/**
 * Carga inicial de producción (ADR 0003): el catálogo y un administrador con
 * las credenciales de `ADMIN_EMAIL` y `ADMIN_PASSWORD`. No crea socios de
 * prueba, a diferencia de `seed.ts`, que está bloqueado en producción.
 *
 * Se corre a mano, una vez, después del primer deploy. Volver a correrla deja
 * el catálogo al día y no toca la contraseña del administrador: si la pisara,
 * sería un reseteo de credenciales en silencio.
 */

/** El mismo mínimo que el registro (`RegistroDto`) y el cambio de contraseña. */
const LARGO_MINIMO_PASSWORD = 8;
/** El mismo costo que `auth.service.ts`. */
const COSTO_BCRYPT = 10;

export interface AdminInicial {
  email: string;
  password: string;
}

export function leerAdmin(entorno: NodeJS.ProcessEnv): AdminInicial {
  // Misma normalización que `auth.service.ts`, para que el login lo encuentre.
  const email = entorno.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  if (!isEmail(email)) {
    throw new Error('ADMIN_EMAIL falta o no es una dirección de mail válida.');
  }

  const password = entorno.ADMIN_PASSWORD ?? '';
  if (password.length < LARGO_MINIMO_PASSWORD) {
    throw new Error(`ADMIN_PASSWORD falta o tiene menos de ${LARGO_MINIMO_PASSWORD} caracteres.`);
  }

  return { email, password };
}

export async function cargarProduccion(
  tx: Prisma.TransactionClient,
  admin: AdminInicial,
): Promise<'creado' | 'existente'> {
  await cargarCatalogo(tx);

  const existente = await tx.usuario.findUnique({ where: { email: admin.email } });
  if (existente) {
    // Si alguien se registró con ese mail antes de la carga, ascenderlo le
    // daría el panel a una cuenta cuya contraseña no eligió el equipo.
    if (existente.rol !== 'ADMIN') {
      throw new Error(
        `La cuenta ${admin.email} ya existe y no es ADMIN. Usá otro ADMIN_EMAIL o revisá quién la creó.`,
      );
    }
    return 'existente';
  }

  await tx.usuario.create({
    data: {
      nombre: 'Administración',
      apellido: 'Deploy',
      email: admin.email,
      passwordHash: await bcrypt.hash(admin.password, COSTO_BCRYPT),
      rol: 'ADMIN',
    },
  });
  return 'creado';
}

async function main() {
  const admin = leerAdmin(process.env);
  const prisma = new PrismaClient();
  try {
    const resultado = await prisma.$transaction((tx) => cargarProduccion(tx, admin));
    console.log(
      resultado === 'creado'
        ? `Catálogo cargado y administrador ${admin.email} creado.`
        : `Catálogo al día. El administrador ${admin.email} ya existía: no se tocó su contraseña.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
