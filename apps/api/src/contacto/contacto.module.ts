import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { ContactoController } from './contacto.controller';
import { ContactoService } from './contacto.service';
import { MAXIMO_POR_VENTANA, VENTANA_MS } from './guard-de-limite';

@Module({
  // Acotado a este módulo: es el único endpoint que hoy necesita el límite, así
  // que el guard no se registra como APP_GUARD (design.md, decisión 3).
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: VENTANA_MS, limit: MAXIMO_POR_VENTANA }],
    }),
  ],
  controllers: [ContactoController],
  providers: [ContactoService],
})
export class ContactoModule {}
