import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PROFILE_REPOSITORY } from '../../domain/repositories/profile.repository';
import { HttpProfileRepository } from './http-profile.repository';

const API = `${environment.apiUrl}/users/profile`;

describe('HttpProfileRepository (capa de datos)', () => {
  let repository: HttpProfileRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repository = TestBed.inject(HttpProfileRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la implementación que entrega el token PROFILE_REPOSITORY', () => {
    expect(TestBed.inject(PROFILE_REPOSITORY)).toBe(repository);
  });

  it('consulta el perfil con GET', async () => {
    const result = firstValueFrom(repository.profile());
    const req = http.expectOne(API);
    expect(req.request.method).toBe('GET');
    req.flush({ id_usuario: 5 });
    expect(await result).toEqual({ id_usuario: 5 });
  });

  it('actualiza solo los datos recibidos con PUT', () => {
    repository.update({ telefono: '7711234567' }).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ telefono: '7711234567' });
    req.flush({ message: 'ok' });
  });

  it('cambia la contraseña con el contrato del backend', () => {
    repository.changePassword({ contrasenaActual: 'Actual1@', nuevaContrasena: 'Nueva12@' }).subscribe();
    const req = http.expectOne(`${API}/change-password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ contrasenaActual: 'Actual1@', nuevaContrasena: 'Nueva12@' });
    req.flush({ message: 'ok' });
  });

  it('elimina la cuenta con DELETE', () => {
    repository.deleteAccount().subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'ok' });
  });
});
