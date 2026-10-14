import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthError, AuthService } from '../../core/services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage (HU-02 Inicio de sesión)', () => {
  let page: LoginPage;
  let auth: { login: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  const llenar = (credential: string, contrasena = 'Segura1!', rol: 'Estudiante' | 'Docente' | 'Visitante' = 'Estudiante') =>
    page.form.setValue({ rol, credential, contrasena });

  beforeEach(() => {
    auth = { login: vi.fn().mockReturnValue(of({})) };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    page = TestBed.createComponent(LoginPage).componentInstance;
  });

  it('se crea con Estudiante seleccionado y los tres tipos de usuario', () => {
    expect(page.form.controls.rol.value).toBe('Estudiante');
    expect(page.roles.map((r) => r.value)).toEqual(['Estudiante', 'Docente', 'Visitante']);
  });

  describe('credencial: correo o matrícula', () => {
    it.each(['ana@correo.com', '20230033', 'TIO-2023-01'])('acepta "%s"', (valor) => {
      page.form.controls.credential.setValue(valor);
      expect(page.form.controls.credential.valid).toBe(true);
      expect(page.credentialError).toBe('');
    });

    it('pide la credencial cuando está vacía', () => {
      expect(page.credentialError).toBe('Ingresa tu matrícula o correo electrónico.');
    });

    it('rechaza un correo mal escrito', () => {
      page.form.controls.credential.setValue('ana@correo');
      expect(page.credentialError).toBe('El correo electrónico no es válido.');
    });

    it('rechaza una matrícula con espacios o símbolos', () => {
      page.form.controls.credential.setValue('2023 00#');
      expect(page.credentialError).toBe('La matrícula solo puede contener letras, números y guiones.');
    });
  });

  it('no envía la petición con campos obligatorios vacíos', () => {
    page.submit();

    expect(page.errorMessage()).toBe('Completa los campos obligatorios.');
    expect(page.form.controls.contrasena.touched).toBe(true);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('inicia sesión con la credencial sin espacios y el rol elegido, y abre Inicio', () => {
    llenar('  ana@correo.com  ', 'Segura1!', 'Docente');

    page.submit();

    expect(auth.login).toHaveBeenCalledWith({
      credential: 'ana@correo.com',
      contrasena: 'Segura1!',
      rolSeleccionado: 'Docente',
    });
    expect(page.loading()).toBe(false);
    expect(page.form.controls.contrasena.value).toBe('');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('muestra el mensaje cuando las credenciales son incorrectas', () => {
    auth.login.mockReturnValue(
      throwError(() => new AuthError('Las credenciales ingresadas no son correctas. Verifica también el tipo de usuario seleccionado.')),
    );
    llenar('20230033', 'Mala123!');

    page.submit();

    expect(page.loading()).toBe(false);
    expect(page.errorMessage()).toContain('Las credenciales ingresadas no son correctas');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('muestra un mensaje genérico ante un error inesperado', () => {
    auth.login.mockReturnValue(throwError(() => new Error('boom')));
    llenar('20230033');

    page.submit();

    expect(page.errorMessage()).toBe('No fue posible iniciar sesión. Intenta nuevamente.');
  });

  it('ignora un segundo envío mientras espera la respuesta', () => {
    page.loading.set(true);
    llenar('20230033');

    page.submit();
    page.goToRegister();
    page.goToForgotPassword();

    expect(auth.login).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('cambia el tipo de usuario y limpia el error anterior', () => {
    page.errorMessage.set('Error previo');

    page.onRoleChange('Visitante');
    expect(page.form.controls.rol.value).toBe('Visitante');
    expect(page.errorMessage()).toBeNull();

    page.onRoleChange(undefined);
    expect(page.form.controls.rol.value).toBe('Visitante');
  });

  it('lleva al registro y a recuperar contraseña', () => {
    page.goToRegister();
    page.goToForgotPassword();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/register');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/forgot-password');
  });
});
