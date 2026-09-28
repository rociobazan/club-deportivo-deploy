import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { Publico } from '../common/decoradores';
import { ContactoService } from './contacto.service';
import type { ContactoRespuesta } from './contacto.service';
import { ContactoDto } from './dto/contacto.dto';
import { GuardDeLimiteDeContacto } from './guard-de-limite';

@Controller('contacto')
export class ContactoController {
  constructor(private readonly contacto: ContactoService) {}

  /**
   * 202 y no 201: el contrato promete "aceptado para su envío". El límite por
   * IP se aplica solo acá y no global (design.md, decisión 3).
   */
  @Publico()
  @UseGuards(GuardDeLimiteDeContacto)
  @HttpCode(202)
  @Post()
  enviar(@Body() datos: ContactoDto): Promise<ContactoRespuesta> {
    return this.contacto.enviar(datos);
  }
}
