import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CANCHAS, DISCIPLINAS, EQUIPAMIENTO } from '../prisma/catalogo';
import { cargarProduccion } from '../prisma/carga-produccion';

/**
 * Carga de producción contra la base real (ADR 0003). Cada caso corre dentro
 * de una transacción que se revierte al final, para no dejarles el catálogo
 * cargado a los demás e2e.
 */
describe('Carga de producción (e2e)', () => {
  const prisma = new PrismaClient();
  const admin = { email: 'admin-carga@clubdeploy.test', password: 'clave-de-produccion' };

  class Revertir extends Error {}

  async function enTransaccionRevertida(prueba: (tx: Prisma.TransactionClient) => Promise<void>) {
    await expect(
      prisma.$transaction(async (tx) => {
        await prueba(tx);
        throw new Revertir();
      }),
    ).rejects.toBeInstanceOf(Revertir);
  }

  /**
   * La base de los e2e puede tener catálogo (en local, el del seed). TRUNCATE es
   * transaccional en Postgres, así que se revierte con el resto del caso.
   */
  const vaciarCatalogo = (tx: Prisma.TransactionClient) => tx.$executeRawUnsafe('TRUNCATE disciplina CASCADE');

  afterAll(() => prisma.$disconnect());

  it('con la base vacía carga el catálogo completo', async () => {
    await enTransaccionRevertida(async (tx) => {
      await vaciarCatalogo(tx);

      await expect(cargarProduccion(tx, admin)).resolves.toMatchObject({ catalogo: 'cargado' });

      await expect(tx.disciplina.count()).resolves.toBe(DISCIPLINAS.length);
      await expect(tx.cancha.count()).resolves.toBe(CANCHAS.length);
      await expect(tx.equipamiento.count()).resolves.toBe(EQUIPAMIENTO.length);
    });
  });

  it('crea el administrador con la contraseña del entorno', async () => {
    await enTransaccionRevertida(async (tx) => {
      await expect(cargarProduccion(tx, admin)).resolves.toMatchObject({ admin: 'creado' });

      const usuario = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });
      expect(usuario.rol).toBe('ADMIN');
      await expect(bcrypt.compare(admin.password, usuario.passwordHash)).resolves.toBe(true);
    });
  });

  it('no crea socios de prueba', async () => {
    await enTransaccionRevertida(async (tx) => {
      const antes = await tx.usuario.count();

      await cargarProduccion(tx, admin);

      await expect(tx.usuario.count()).resolves.toBe(antes + 1);
    });
  });

  it('con catálogo cargado no pisa lo que el admin cambió desde el panel', async () => {
    await enTransaccionRevertida(async (tx) => {
      await vaciarCatalogo(tx);
      await cargarProduccion(tx, admin);
      const cancha = await tx.cancha.findFirstOrThrow({ where: { nombre: CANCHAS[0].nombre } });
      await tx.cancha.update({ where: { id: cancha.id }, data: { precioPorTurno: 1, nombre: 'Renombrada' } });
      const canchas = await tx.cancha.count();

      await expect(cargarProduccion(tx, admin)).resolves.toMatchObject({ catalogo: 'existente' });

      const despues = await tx.cancha.findUniqueOrThrow({ where: { id: cancha.id } });
      expect(despues.nombre).toBe('Renombrada');
      expect(Number(despues.precioPorTurno)).toBe(1);
      await expect(tx.cancha.count()).resolves.toBe(canchas);
    });
  });

  it('correrla de nuevo no cambia la contraseña del administrador', async () => {
    await enTransaccionRevertida(async (tx) => {
      await cargarProduccion(tx, admin);
      const { passwordHash } = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });

      await expect(cargarProduccion(tx, { ...admin, password: 'otra-clave-distinta' })).resolves.toMatchObject({
        admin: 'existente',
      });

      const despues = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });
      expect(despues.passwordHash).toBe(passwordHash);
    });
  });

  it('se niega a ascender a ADMIN una cuenta que ya existe como SOCIO', async () => {
    await enTransaccionRevertida(async (tx) => {
      await tx.usuario.create({
        data: { nombre: 'Alguien', apellido: 'Registrado', email: admin.email, passwordHash: 'x', rol: 'SOCIO' },
      });

      await expect(cargarProduccion(tx, admin)).rejects.toThrow(/ya existe y no es ADMIN/);

      const usuario = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });
      expect(usuario.rol).toBe('SOCIO');
    });
  });
});
