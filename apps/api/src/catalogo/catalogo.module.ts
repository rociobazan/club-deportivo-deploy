import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

/** PrismaModule es global (AppModule): no hace falta importarlo acá. */
@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
