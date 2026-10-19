import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CONFIGURACION, Configuracion } from '../configuracion';
import { VENTANA_MS } from './guard-de-limite';

/** JwtModule y PrismaModule son globales (AppModule): no hace falta importarlos acá. */
@Module({
  // Acotado a este módulo, como en `ContactoModule`: el guard no es APP_GUARD.
  // Dos throttlers con nombre, uno por endpoint, porque tienen máximos
  // distintos; cada ruta salta el del otro con `@SkipThrottle` (decisión 37).
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [CONFIGURACION],
      useFactory: (configuracion: Configuracion) => ({
        throttlers: [
          { name: 'login', ttl: VENTANA_MS, limit: configuracion.limiteLoginPorMinuto },
          { name: 'registro', ttl: VENTANA_MS, limit: configuracion.limiteRegistroPorMinuto },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
