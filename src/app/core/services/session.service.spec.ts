import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../models/auth.models';
import { SessionService } from './session.service';

const STORAGE_KEY = 'tiozihuatl.session';

/** Token JWT de prueba: solo importa el campo `exp` (segundos). */
function token(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '');
  return `cabecera.${payload}.firma`;
}

function sesion(expSeconds = Math.floor(Date.now() / 1000) + 3600): AuthSession {
  return {
    accessToken: token(expSeconds),
    refreshToken: 'refresh-123',
    user: { id: 1, id_usuario: 1, nombre: 'Ana', rol: 'Estudiante', correo: 'ana@correo.com', id_semestre: 3 },
  };
}

describe('SessionService (HU-02 Inicio de sesión)', () => {
  beforeEach(() => localStorage.clear());

  const crear = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(SessionService);
  };

  it('inicia sin sesión cuando no hay nada guardado', () => {
    const service = crear();

    expect(service.current).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('guarda la sesión en memoria y en el almacenamiento local, sin contraseña', () => {
    const service = crear();
    service.save(sesion());

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.rol).toBe('Estudiante');
    const guardada = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(JSON.parse(guardada).refreshToken).toBe('refresh-123');
    expect(guardada).not.toContain('contrasena');
  });

  it('recupera la sesión guardada al abrir la app de nuevo', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion()));

    const service = crear();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.correo).toBe('ana@correo.com');
  });

  it('descarta una sesión guardada incompleta o dañada', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'x' }));
    expect(crear().current).toBeNull();

    localStorage.setItem(STORAGE_KEY, '{no es json');
    expect(crear().current).toBeNull();
  });

  it('cierra la sesión borrando los datos guardados', () => {
    const service = crear();
    service.save(sesion());

    service.clear();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  describe('vigencia del token', () => {
    it('considera vigente un token que vence en una hora', () => {
      const service = crear();
      service.save(sesion());

      expect(service.isAccessTokenExpired()).toBe(false);
    });

    it('considera vencido un token que ya expiró o expira en menos de 30 s', () => {
      const service = crear();
      service.save(sesion(Math.floor(Date.now() / 1000) - 10));
      expect(service.isAccessTokenExpired()).toBe(true);

      service.save(sesion(Math.floor(Date.now() / 1000) + 10));
      expect(service.isAccessTokenExpired()).toBe(true);
    });

    it('considera vencido un token sin sesión, ilegible o sin fecha de expiración', () => {
      const service = crear();
      expect(service.isAccessTokenExpired()).toBe(true);

      service.save({ ...sesion(), accessToken: 'token-invalido' });
      expect(service.isAccessTokenExpired()).toBe(true);

      service.save({ ...sesion(), accessToken: `a.${btoa(JSON.stringify({ sub: 1 }))}.b` });
      expect(service.isAccessTokenExpired()).toBe(true);
    });
  });

  it('sigue funcionando en memoria si el almacenamiento no está disponible', () => {
    const service = crear();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });

    service.save(sesion());
    expect(service.isAuthenticated()).toBe(true);

    service.clear();
    expect(service.isAuthenticated()).toBe(false);

    setItem.mockRestore();
    removeItem.mockRestore();
  });
});
