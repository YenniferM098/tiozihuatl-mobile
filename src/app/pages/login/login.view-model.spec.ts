import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoginViewModel, credentialValidator } from './login.view-model';

describe('LoginViewModel (MVVM)', () => {
  let vm: LoginViewModel;
  let response: Subject<unknown>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    response = new Subject();
    auth = { login: vi.fn(() => response) };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    vm = TestBed.runInInjectionContext(() => new LoginViewModel());
  });

  it('expone el estado inicial sin depender de la vista', () => {
    expect(vm.loading()).toBe(false);
    expect(vm.errorMessage()).toBeNull();
    expect(vm.showPassword()).toBe(false);
    expect(vm.form.controls.rol.value).toBe('Estudiante');
  });

  it('mantiene la carga activa hasta que responde el servidor', () => {
    vm.form.setValue({ rol: 'Estudiante', credential: '20230033', contrasena: 'Segura1!' });

    vm.submit();
    expect(vm.loading()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    response.next({});
    expect(vm.loading()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('valida la credencial como correo o matrícula', () => {
    expect(credentialValidator(new FormControl('', { nonNullable: true }))).toBeNull();
    expect(credentialValidator(new FormControl('ana@correo.com', { nonNullable: true }))).toBeNull();
    expect(credentialValidator(new FormControl('ana@correo', { nonNullable: true }))).toEqual({ email: true });
    expect(credentialValidator(new FormControl('TIO-2023', { nonNullable: true }))).toBeNull();
    expect(credentialValidator(new FormControl('ab', { nonNullable: true }))).toEqual({ matricula: true });
  });
});
