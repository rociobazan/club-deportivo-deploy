import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';

/** PrismaModule es global (AppModule): no hace falta importarlo acá. */
@Module({
  imports: [NotificacionesModule],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
