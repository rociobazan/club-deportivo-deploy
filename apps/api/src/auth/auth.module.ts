import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CONFIGURACION, Configuracion } from '../configuracion';
import { VENTANA_MS } from './guard-de-limite';
import { RecuperacionService } from './recuperacion.service';

/** JwtModule y PrismaModule son globales (AppModule): no hace falta importarlos acá. */
@Module({
  // Acotado a este módulo, como en `ContactoModule`: el guard no es APP_GUARD.
  // Un throttler con nombre por máximo distinto; cada ruta salta los que no
  // son suyos con `@SkipThrottle` (decisión 37). `recuperacion` lo usan las
  // dos rutas de RF-16, y cada una lleva su propio contador.
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [CONFIGURACION],
      useFactory: (configuracion: Configuracion) => ({
        throttlers: [
          { name: 'login', ttl: VENTANA_MS, limit: configuracion.limiteLoginPorMinuto },
          { name: 'registro', ttl: VENTANA_MS, limit: configuracion.limiteRegistroPorMinuto },
          {
            name: 'recuperacion',
            ttl: VENTANA_MS,
            limit: configuracion.limiteRecuperacionPorMinuto,
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RecuperacionService],
})
export class AuthModule {}
