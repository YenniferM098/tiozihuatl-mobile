import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { AuthError, AuthService } from '../../core/services/auth.service';
import { RegisterPage } from './register.page';

describe('RegisterPage (HU-01 Registro de visitante)', () => {
  let page: RegisterPage;
  let auth: {
    checkContactAvailability: ReturnType<typeof vi.fn>;
    preRegister: ReturnType<typeof vi.fn>;
    finishRegister: ReturnType<typeof vi.fn>;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let toast: { present: ReturnType<typeof vi.fn> };
  let toastCtrl: { create: ReturnType<typeof vi.fn> };

  const llenarDatos = () =>
    page.datosForm.setValue({
      nombre: 'Juan',
      apaterno: 'Pérez',
      amaterno: 'López',
      correo: 'juan@correo.com',
      telefono: '7711234567',
    });

  const llenarSeguridad = () =>
    page.seguridadForm.setValue({
      contrasena: 'Segura1!',
      confirmar: 'Segura1!',
      palabraSecreta: 'tiozi',
      terminos: true,
      privacidad: true,
      seguridad: true,
    });

  beforeEach(() => {
    auth = {
      checkContactAvailability: vi.fn().mockReturnValue(of({ emailTaken: false, phoneTaken: false })),
      preRegister: vi
        .fn()
        .mockReturnValue(of({ kind: 'sent', message: 'Te enviamos un correo.', retryAfterSeconds: 300 })),
      finishRegister: vi.fn().mockReturnValue(of('Cuenta creada exitosamente.')),
    };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    toast = { present: vi.fn().mockResolvedValue(undefined) };
    toastCtrl = { create: vi.fn().mockResolvedValue(toast) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastCtrl },
      ],
    });
    page = TestBed.createComponent(RegisterPage).componentInstance;
  });

  afterEach(() => page.ngOnDestroy());

  it('se crea en el paso de datos personales', () => {
    expect(page).toBeTruthy();
    expect(page.step()).toBe('datos');
  });

  describe('paso 1: datos personales', () => {
    it('no avanza con información obligatoria incompleta', () => {
      page.submitDatos();

      expect(page.datosForm.invalid).toBe(true);
      expect(page.errorMessage()).toBe('Revisa los campos marcados.');
      expect(auth.checkContactAvailability).not.toHaveBeenCalled();
    });

    it('valida el formato de nombre, correo y teléfono', () => {
      page.datosForm.setValue({
        nombre: 'J',
        apaterno: 'Pérez1',
        amaterno: 'López',
        correo: 'juan.correo.com',
        telefono: '77112',
      });

      expect(page.nameError('nombre')).toBe('Solo letras y espacios (mínimo 2).');
      expect(page.nameError('apaterno')).toBe('Solo letras y espacios (mínimo 2).');
      expect(page.emailError).toBe('El correo electrónico no es válido.');
      expect(page.phoneError).toBe('El teléfono debe tener 10 dígitos.');
    });

    it('solo deja escribir 10 dígitos en el teléfono', () => {
      page.datosForm.controls.telefono.setValue('77-11 23 45 67 99');
      page.onPhoneInput();

      expect(page.datosForm.controls.telefono.value).toBe('7711234567');
    });

    it('marca el correo cuando ya tiene una cuenta y no envía el pre-registro', () => {
      auth.checkContactAvailability.mockReturnValue(of({ emailTaken: true, phoneTaken: false }));
      llenarDatos();

      page.submitDatos();

      expect(page.datosForm.controls.correo.hasError('taken')).toBe(true);
      expect(page.errorMessage()).toBe('Este correo ya tiene una cuenta. Inicia sesión.');
      expect(auth.preRegister).not.toHaveBeenCalled();
    });

    it('con datos válidos envía el pre-registro y pasa a la verificación del correo', () => {
      llenarDatos();

      page.submitDatos();

      expect(auth.preRegister).toHaveBeenCalledWith({
        nombre: 'Juan',
        apaterno: 'Pérez',
        amaterno: 'López',
        correo: 'juan@correo.com',
        telefono: '7711234567',
      });
      expect(page.step()).toBe('verificacion');
      expect(page.infoMessage()).toBe('Te enviamos un correo.');
      expect(page.loading()).toBe(false);
    });

    it('muestra el error del servidor sin avanzar', () => {
      auth.checkContactAvailability.mockReturnValue(throwError(() => new AuthError('Sin conexión.')));
      llenarDatos();

      page.submitDatos();

      expect(page.errorMessage()).toBe('Sin conexión.');
      expect(page.step()).toBe('datos');
      expect(page.loading()).toBe(false);
    });
  });

  describe('paso 3: seguridad de la cuenta', () => {
    beforeEach(() => {
      llenarDatos();
      page.submitDatos();
      page.continueToSecurity();
    });

    it('exige aceptar términos, privacidad y políticas de seguridad', () => {
      page.seguridadForm.patchValue({
        contrasena: 'Segura1!',
        confirmar: 'Segura1!',
        palabraSecreta: 'tiozi',
      });

      page.submitSeguridad();

      expect(page.errorMessage()).toBe('Debes aceptar los términos, la privacidad y las políticas de seguridad.');
      expect(auth.finishRegister).not.toHaveBeenCalled();
    });

    it('detecta cuando las contraseñas no coinciden', () => {
      llenarSeguridad();
      page.seguridadForm.controls.confirmar.setValue('Otra123!');

      expect(page.confirmError).toBe('Las contraseñas no coinciden.');
      page.submitSeguridad();
      expect(auth.finishRegister).not.toHaveBeenCalled();
    });

    it('crea la cuenta, confirma el registro y lleva a iniciar sesión', async () => {
      llenarSeguridad();

      page.submitSeguridad();
      await vi.waitFor(() => expect(toast.present).toHaveBeenCalled());

      expect(auth.finishRegister).toHaveBeenCalledWith({
        correo: 'juan@correo.com',
        contrasena: 'Segura1!',
        palabra_secreta: 'tiozi',
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
      expect(toastCtrl.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión como Visitante.',
          color: 'success',
        }),
      );
    });

    it('muestra el error cuando la cuenta no se pudo crear', () => {
      auth.finishRegister.mockReturnValue(throwError(() => new AuthError('Este correo ya está registrado.')));
      llenarSeguridad();

      page.submitSeguridad();

      expect(page.errorMessage()).toBe('Este correo ya está registrado.');
      expect(page.loading()).toBe(false);
    });
  });
});
