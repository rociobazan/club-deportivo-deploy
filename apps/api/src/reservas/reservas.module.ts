import { Module } from '@nestjs/common';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

/** PrismaModule, CONFIGURACION y Reloj son globales: no hace falta importarlos acá. */
@Module({
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
