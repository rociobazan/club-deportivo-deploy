import { CorreoDoble } from './correo-doble';

describe('CorreoDoble', () => {
  it('guarda los envíos en lugar de mandarlos, y limpiar los descarta', async () => {
    const correo = new CorreoDoble(false);

    await correo.enviar({ para: 'club@test', asunto: 'Uno', texto: 'primero' });
    await correo.enviar({
      para: 'club@test',
      asunto: 'Dos',
      texto: 'segundo',
      responderA: 'ana@test',
    });

    expect(correo.enviados).toEqual([
      { para: 'club@test', asunto: 'Uno', texto: 'primero' },
      {
        para: 'club@test',
        asunto: 'Dos',
        texto: 'segundo',
        responderA: 'ana@test',
      },
    ]);

    correo.limpiar();
    expect(correo.enviados).toHaveLength(0);
  });
});
