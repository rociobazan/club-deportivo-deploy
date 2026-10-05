/**
 * El resultado de un formulario de administración: el error, con el título
 * que mandó la API, o la confirmación. Regiones vivas, para que un lector de
 * pantalla lo anuncie sin mover el foco.
 */
export function MensajeDeFormulario({ error, guardado }: { error?: string; guardado?: string }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  }
  if (guardado) {
    return (
      <p role="status" className="text-sm text-accent">
        {guardado}
      </p>
    );
  }
  return null;
}
