import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Publico } from './common/decoradores';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Publico()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
