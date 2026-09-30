import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

/**
 * PrismaModule, CONFIGURACION y Reloj son globales: no hace falta importarlos.
 * `NotificacionesModule` sí, porque el servicio lo inyecta para los mails de
 * cancelación y de reenvío (RF-08).
 */
@Module({
  imports: [NotificacionesModule],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
