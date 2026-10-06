import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CANCHAS, cargarCatalogo, DISCIPLINAS, EQUIPAMIENTO } from './catalogo';

const prisma = new PrismaClient();

/**
 * Seed de desarrollo: el catálogo de `catalogo.ts` más dos usuarios de prueba.
 * Para producción está `carga-produccion.ts` (ADR 0003).
 *
 * Lo que el seed **no** toca: el `passwordHash` de un usuario que ya existe,
 * porque pisarlo seria resetear una credencial en silencio con un valor que
 * está en el repositorio. Se fija solo al crear.
 */

const USUARIOS = [
  { nombre: 'Ana', apellido: 'Admin', email: 'admin@club.test', rol: 'ADMIN' },
  { nombre: 'Bruno', apellido: 'Socio', email: 'socio@club.test', rol: 'SOCIO' },
] as const;

async function main() {
  // El guard viejo ("no cargar si hay datos") no estaba pensado como defensa,
  // pero lo era: sin el, un `db:seed` contra una base que no sea de desarrollo
  // pisaria el catalogo en silencio. Se reemplaza por uno explicito.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'El seed carga datos de prueba y no puede correrse con NODE_ENV=production.',
    );
  }

  const hash = await bcrypt.hash('clave1234', 10);

  // Todo en una transacción: un seed a medias dejaría el catálogo mezclando
  // datos viejos y nuevos.
  await prisma.$transaction(async (tx) => {
    await cargarCatalogo(tx);

    for (const usuario of USUARIOS) {
      await tx.usuario.upsert({
        where: { email: usuario.email },
        update: { nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol },
        create: { ...usuario, passwordHash: hash },
      });
    }
  });

  console.log(
    `Catálogo al día: ${DISCIPLINAS.length} disciplinas, ${CANCHAS.length} canchas, ${EQUIPAMIENTO.length} equipamientos y ${USUARIOS.length} usuarios de prueba.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
