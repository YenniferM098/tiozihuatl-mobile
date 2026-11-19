import { UserRole } from '../../../core/models/auth.models';
import { GuideModulo, moduloDeRuta, pasosGuia, pasosLogin, pasosModulo } from './pasos';

const pestaña = (objetivo: string) => objetivo.match(/tab="([^"]+)"/)?.[1];

describe('pasosGuia (MEJ-01 guía de la barra inferior)', () => {
  it.each<UserRole>(['Estudiante', 'Docente', 'Visitante'])('el rol %s ve un solo paso que señala Inicio', (rol) => {
    const pasos = pasosGuia(rol);
    expect(pasos.map((p) => pestaña(p.objetivo))).toEqual(['home']);
    expect(pasos[0].texto).toMatch(/^¡Bienvenido a Tiozihuatl!/);
  });

  it('el Inicio del Visitante no menciona módulos que no tiene', () => {
    expect(pasosGuia('Visitante')[0].texto).not.toMatch(/Biblioteca|Materiales/);
    expect(pasosGuia(null)[0].texto).not.toMatch(/Biblioteca|Materiales/);
  });

  it('cada paso de las guías tiene título y un mensaje breve', () => {
    const modulos: GuideModulo[] = ['biblioteca', 'revistas', 'materiales', 'perfil'];
    for (const paso of [...pasosGuia('Estudiante'), ...pasosLogin(), ...modulos.flatMap((m) => pasosModulo(m))]) {
      expect(paso.titulo).not.toHaveLength(0);
      expect(paso.texto.length).toBeGreaterThan(0);
      expect(paso.texto.length).toBeLessThanOrEqual(130);
    }
  });
});

describe('Guías por módulo (MEJ-01)', () => {
  it('cada módulo resalta sus propios elementos', () => {
    expect(pasosModulo('biblioteca').map((p) => p.objetivo)).toEqual([
      '[data-guia="biblioteca-buscador"]',
      '[data-guia="biblioteca-filtros"]',
      '[data-guia="biblioteca-libro"]',
    ]);
    expect(pasosModulo('revistas')).toHaveLength(4);
    expect(pasosModulo('materiales')).toHaveLength(3);
    expect(pasosModulo('perfil').map((p) => p.titulo)).toEqual(['Tus datos', 'Cambiar contraseña', 'Cerrar sesión']);
  });

  it.each([
    ['/biblioteca', 'Estudiante', 'biblioteca'],
    ['/materiales?semestre=1', 'Docente', 'materiales'],
    ['/revistas', 'Visitante', 'revistas'],
    ['/perfil/', 'Visitante', 'perfil'],
  ] as const)('la ruta %s con rol %s abre la guía de %s', (url, rol, modulo) => {
    expect(moduloDeRuta(url, rol)).toBe(modulo);
  });

  it.each([
    ['/home', 'Estudiante'],
    ['/biblioteca/12', 'Estudiante'],
    ['/revistas/3/lector', 'Docente'],
    ['/biblioteca', 'Visitante'],
    ['/materiales', 'Visitante'],
  ] as const)('la ruta %s con rol %s no tiene guía de módulo', (url, rol) => {
    expect(moduloDeRuta(url, rol)).toBeNull();
  });
});

describe('Guía del inicio de sesión (MEJ-01)', () => {
  it('resalta el tipo de usuario y la recuperación de contraseña', () => {
    expect(pasosLogin().map((p) => p.objetivo)).toEqual(['[data-guia="login-rol"]', '[data-guia="login-recuperar"]']);
    expect(pasosLogin()[0].texto).toMatch(/Estudiante, Docente o Visitante/);
  });
});
