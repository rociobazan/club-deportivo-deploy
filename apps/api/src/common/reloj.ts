import { Inject, Injectable } from '@nestjs/common';
import { CONFIGURACION } from '../configuracion';
// `import type`: con emitDecoratorMetadata, un tipo en una firma decorada no puede ser import de valor.
import type { Configuracion } from '../configuracion';

/** Fecha y hora locales del club, en el mismo formato que `reserva.fecha` y `hora_inicio`. */
export type Momento = { fecha: string; hora: string };

/**
 * Único reloj de la API: "hoy" y "ahora" en ZONA_HORARIA_CLUB (design archivado,
 * decisión 5). Todo lo que compara contra el presente pasa por acá, así los
 * runners en UTC no cambian de día a las 21:00 de Argentina y los tests pueden
 * fijar la hora reemplazando este provider.
 */
@Injectable()
export class Reloj {
  private readonly formato: Intl.DateTimeFormat;

  constructor(@Inject(CONFIGURACION) configuracion: Configuracion) {
    // en-CA da año-mes-día; formatToParts evita depender del separador del locale.
    this.formato = new Intl.DateTimeFormat('en-CA', {
      timeZone: configuracion.zonaHoraria,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  ahora(instante: Date = new Date()): Momento {
    const partes: Record<string, string> = {};
    for (const parte of this.formato.formatToParts(instante)) {
      if (parte.type !== 'literal') partes[parte.type] = parte.value;
    }
    return {
      fecha: `${partes.year}-${partes.month}-${partes.day}`,
      hora: `${partes.hour}:${partes.minute}`,
    };
  }
}
