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

  afterAll(() => prisma.$disconnect());

  it('carga el catálogo completo y crea el administrador', async () => {
    await enTransaccionRevertida(async (tx) => {
      await expect(cargarProduccion(tx, admin)).resolves.toBe('creado');

      for (const { nombre } of DISCIPLINAS) {
        await expect(tx.disciplina.findUnique({ where: { nombre } })).resolves.not.toBeNull();
      }
      for (const { nombre } of CANCHAS) {
        await expect(tx.cancha.findFirst({ where: { nombre } })).resolves.not.toBeNull();
      }
      for (const { nombre } of EQUIPAMIENTO) {
        await expect(tx.equipamiento.findFirst({ where: { nombre } })).resolves.not.toBeNull();
      }

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

  it('correrla de nuevo no cambia la contraseña del administrador ni duplica el catálogo', async () => {
    await enTransaccionRevertida(async (tx) => {
      await cargarProduccion(tx, admin);
      const { passwordHash } = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });
      const canchas = await tx.cancha.count();

      await expect(cargarProduccion(tx, { ...admin, password: 'otra-clave-distinta' })).resolves.toBe('existente');

      const despues = await tx.usuario.findUniqueOrThrow({ where: { email: admin.email } });
      expect(despues.passwordHash).toBe(passwordHash);
      await expect(tx.cancha.count()).resolves.toBe(canchas);
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
