import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';

/** PrismaModule, CONFIGURACION y Reloj son globales: no hace falta importarlos. */
@Module({
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}
