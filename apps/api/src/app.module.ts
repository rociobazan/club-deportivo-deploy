import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { FiltroDeErrores } from './common/filtro-de-errores';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { CONFIGURACION, Configuracion } from './configuracion';
import { ConfiguracionModule } from './configuracion.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfiguracionModule,
    AuthModule,
    CatalogoModule,
    PrismaModule,
    // Global para que el guard de JWT, que también es global, pueda inyectar JwtService.
    JwtModule.registerAsync({
      global: true,
      inject: [CONFIGURACION],
      useFactory: (configuracion: Configuracion) => ({
        secret: configuracion.jwtSecret,
        signOptions: { expiresIn: configuracion.jwtExpiresIn },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Registrados por DI y no en main.ts para que los e2e prueben la app real.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: FiltroDeErrores },
    // El orden importa: primero se identifica al usuario, después se mira su rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
