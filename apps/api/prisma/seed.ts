import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Datos del prototipo de Claude Design (design.md, decisión 11), más el
// equipamiento que el club sumó después: fútbol 5 tenía una sola cosa para
// alquilar y tenis y pádel no tenían nada para quien recién empieza.
// Cada equipamiento pertenece a una disciplina (`disciplinaId` no admite
// nulo), así que lo que sirve para varias va repetido: es lo que pide RN-08.
async function main() {
  if ((await prisma.disciplina.count()) > 0) {
    console.log(
      'La base ya tiene datos; no se cargó nada. Para recargarla: prisma migrate reset.',
    );
    return;
  }

  const hash = await bcrypt.hash('clave1234', 10);

  // Todo en una transacción: un seed a medias dejaría la guardia activada.
  await prisma.$transaction(async (tx) => {
    const tenis = await tx.disciplina.create({
      data: { nombre: 'Tenis', duracionTurnoMin: 60 },
    });
    const padel = await tx.disciplina.create({
      data: { nombre: 'Pádel', duracionTurnoMin: 90 },
    });
    const futbol = await tx.disciplina.create({
      data: { nombre: 'Fútbol 5', duracionTurnoMin: 60 },
    });

    await tx.cancha.createMany({
      data: [
        { disciplinaId: tenis.id, nombre: 'Cancha 1', superficie: 'polvo de ladrillo', techada: false, precioPorTurno: 9000 },
        { disciplinaId: tenis.id, nombre: 'Cancha 2', superficie: 'cemento', techada: false, precioPorTurno: 8000 },
        { disciplinaId: padel.id, nombre: 'Pádel 1', superficie: 'sintético', techada: true, precioPorTurno: 14000 },
        { disciplinaId: padel.id, nombre: 'Pádel 2', superficie: 'sintético', techada: true, precioPorTurno: 14000 },
        { disciplinaId: padel.id, nombre: 'Pádel 3', superficie: 'sintético', techada: false, precioPorTurno: 12000 },
        { disciplinaId: futbol.id, nombre: 'Cancha Sur', superficie: 'césped sintético', techada: false, precioPorTurno: 20000 },
      ],
    });

    await tx.equipamiento.createMany({
      data: [
        { disciplinaId: tenis.id, nombre: 'Raqueta de tenis', stockTotal: 4, precioPorTurno: 2500 },
        { disciplinaId: tenis.id, nombre: 'Raqueta junior', stockTotal: 3, precioPorTurno: 2000 },
        { disciplinaId: tenis.id, nombre: 'Tubo de pelotas de tenis', stockTotal: 5, precioPorTurno: 3500 },
        { disciplinaId: padel.id, nombre: 'Paleta de pádel', stockTotal: 6, precioPorTurno: 2500 },
        { disciplinaId: padel.id, nombre: 'Paleta junior', stockTotal: 3, precioPorTurno: 2000 },
        { disciplinaId: padel.id, nombre: 'Tubo de pelotas de pádel', stockTotal: 5, precioPorTurno: 3500 },
        { disciplinaId: futbol.id, nombre: 'Juego de pecheras', stockTotal: 3, precioPorTurno: 3000 },
        { disciplinaId: futbol.id, nombre: 'Pelota de fútbol 5', stockTotal: 4, precioPorTurno: 2000 },
        { disciplinaId: futbol.id, nombre: 'Guantes de arquero', stockTotal: 2, precioPorTurno: 2500 },
        { disciplinaId: futbol.id, nombre: 'Juego de conos', stockTotal: 2, precioPorTurno: 1500 },
      ],
    });

    await tx.usuario.createMany({
      data: [
        { nombre: 'Ana', apellido: 'Admin', email: 'admin@club.test', passwordHash: hash, rol: 'ADMIN' },
        { nombre: 'Bruno', apellido: 'Socio', email: 'socio@club.test', passwordHash: hash, rol: 'SOCIO' },
      ],
    });
  });

  console.log('Datos de prueba cargados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
