import { UserRole } from '../../../core/models/auth.models';
import { pasosGuia } from './pasos';

describe('pasosGuia (MEJ-01 guía de primer uso)', () => {
  it.each<UserRole>(['Estudiante', 'Docente'])('el rol %s recorre las 5 opciones de la barra inferior', (rol) => {
    expect(pasosGuia(rol).map((p) => p.tab)).toEqual(['home', 'biblioteca', 'revistas', 'materiales', 'perfil']);
  });

  it('el Visitante solo recorre Inicio, Revistas y Perfil', () => {
    expect(pasosGuia('Visitante').map((p) => p.tab)).toEqual(['home', 'revistas', 'perfil']);
  });

  it('el Inicio del Visitante no menciona módulos que no tiene', () => {
    const [inicio] = pasosGuia('Visitante');
    expect(inicio.texto).not.toMatch(/Biblioteca|Materiales/);
  });

  it('sin rol se usan los pasos públicos', () => {
    expect(pasosGuia(null).map((p) => p.tab)).toEqual(['home', 'revistas', 'perfil']);
  });

  it('cada paso tiene título y un mensaje breve', () => {
    for (const paso of pasosGuia('Estudiante')) {
      expect(paso.titulo).not.toHaveLength(0);
      expect(paso.texto.length).toBeGreaterThan(0);
      expect(paso.texto.length).toBeLessThanOrEqual(130);
    }
  });
});
