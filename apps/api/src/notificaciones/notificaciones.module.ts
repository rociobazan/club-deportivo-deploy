import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

/** CorreoModule y PrismaModule son globales (AppModule): no hace falta importarlos acá. */
@Module({
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
