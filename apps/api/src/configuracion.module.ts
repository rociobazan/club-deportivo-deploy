import { Global, Module } from '@nestjs/common';
import { Reloj } from './common/reloj';
import { CONFIGURACION, proveedorDeConfiguracion } from './configuracion';

/**
 * Global para que JwtModule y cualquier servicio inyecten CONFIGURACION sin
 * importarlo. El Reloj vive acá porque deriva de la configuración (zona
 * horaria) y lo usan varios módulos.
 */
@Global()
@Module({
  providers: [proveedorDeConfiguracion, Reloj],
  exports: [CONFIGURACION, Reloj],
})
export class ConfiguracionModule {}
