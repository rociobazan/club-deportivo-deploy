import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, proveedorDeConfiguracion } from './configuracion';

/** Global para que JwtModule y cualquier servicio inyecten CONFIGURACION sin importarlo. */
@Global()
@Module({
  providers: [proveedorDeConfiguracion],
  exports: [CONFIGURACION],
})
export class ConfiguracionModule {}
