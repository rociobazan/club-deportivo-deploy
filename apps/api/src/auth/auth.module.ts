import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** JwtModule y PrismaModule son globales (AppModule): no hace falta importarlos acá. */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
