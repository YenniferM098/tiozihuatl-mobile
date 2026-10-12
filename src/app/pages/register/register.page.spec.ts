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

  describe('mensajes de error por campo', () => {
    it('pide los campos obligatorios vacíos', () => {
      expect(page.nameError('nombre')).toBe('Este campo es obligatorio.');
      expect(page.emailError).toBe('Ingresa tu correo electrónico.');
      expect(page.phoneError).toBe('Ingresa tu teléfono.');
      expect(page.passwordError).toBe('Crea una contraseña.');
      expect(page.confirmError).toBe('Confirma tu contraseña.');
      expect(page.secretError).toBe('Ingresa una palabra secreta.');
    });

    it('no muestra mensajes cuando los datos son válidos', () => {
      llenarDatos();
      llenarSeguridad();

      expect(page.nameError('amaterno')).toBe('');
      expect(page.emailError).toBe('');
      expect(page.phoneError).toBe('');
      expect(page.passwordError).toBe('');
      expect(page.confirmError).toBe('');
      expect(page.secretError).toBe('');
      expect(page.confirmInvalid).toBe(false);
    });

    it('explica por qué la contraseña o la palabra secreta no son válidas', () => {
      page.seguridadForm.controls.contrasena.setValue('<script>');
      expect(page.passwordError).toBe('No uses los caracteres < > " \' `.');

      page.seguridadForm.controls.contrasena.setValue('debil');
      expect(page.passwordError).toBe('La contraseña no cumple los requisitos.');
      expect(page.rules().upper).toBe(false);

      page.seguridadForm.controls.palabraSecreta.setValue('abc');
      expect(page.secretError).toBe('Debe tener entre 4 y 30 caracteres.');

      page.seguridadForm.controls.palabraSecreta.setValue('<abc>');
      expect(page.secretError).toBe('No uses los caracteres < > " \' `.');
    });

    it('marca la confirmación como inválida al tocarla si no coincide', () => {
      llenarSeguridad();
      page.seguridadForm.controls.confirmar.setValue('Otra123!');
      page.seguridadForm.controls.confirmar.markAsTouched();

      expect(page.confirmInvalid).toBe(true);
    });

    it('avisa cuando el teléfono ya está registrado', () => {
      auth.checkContactAvailability.mockReturnValue(of({ emailTaken: false, phoneTaken: true }));
      llenarDatos();

      page.submitDatos();

      expect(page.phoneError).toBe('Este teléfono ya está registrado.');
      expect(page.errorMessage()).toBe('Este teléfono ya está registrado.');
    });

    it('avisa cuando el correo ya está registrado', () => {
      auth.checkContactAvailability.mockReturnValue(of({ emailTaken: true, phoneTaken: false }));
      llenarDatos();

      page.submitDatos();

      expect(page.emailError).toBe('Este correo ya está registrado.');
    });
  });

  describe('paso 2: verificación del correo', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('cuenta el tiempo para reenviar el correo y lo habilita al terminar', () => {
      auth.preRegister.mockReturnValue(of({ kind: 'sent', message: 'Enviado.', retryAfterSeconds: 2 }));
      llenarDatos();
      page.submitDatos();

      expect(page.resendLabel()).toBe('Reenviar en 0:02');
      page.resend();
      expect(auth.preRegister).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2000);
      expect(page.resendIn()).toBe(0);
      expect(page.resendLabel()).toBe('Reenviar correo');

      page.resend();
      expect(auth.preRegister).toHaveBeenCalledTimes(2);
    });

    it('pasa directo a la seguridad si el correo ya estaba verificado', () => {
      auth.preRegister.mockReturnValue(of({ kind: 'alreadyVerified', message: 'Ya verificado.' }));
      llenarDatos();

      page.submitDatos();

      expect(page.step()).toBe('seguridad');
      expect(page.infoMessage()).toBe('Ya verificado.');
    });

    it('permite regresar a editar los datos personales', () => {
      llenarDatos();
      page.submitDatos();

      page.editDatos();

      expect(page.step()).toBe('datos');
    });
  });

  describe('navegación', () => {
    it('regresa paso por paso y al final vuelve a iniciar sesión', () => {
      page.step.set('seguridad');
      page.goBack();
      expect(page.step()).toBe('verificacion');

      page.goBack();
      expect(page.step()).toBe('datos');

      page.goBack();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    });

    it('no navega mientras hay una petición en curso', () => {
      page.loading.set(true);

      page.goBack();
      page.submitDatos();
      page.submitSeguridad();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(auth.checkContactAvailability).not.toHaveBeenCalled();
      expect(auth.finishRegister).not.toHaveBeenCalled();
    });

    it('lleva a iniciar sesión', () => {
      page.goToLogin();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    });

    it('muestra un mensaje genérico ante un error inesperado', () => {
      auth.checkContactAvailability.mockReturnValue(throwError(() => new Error('boom')));
      llenarDatos();

      page.submitDatos();

      expect(page.errorMessage()).toBe('No fue posible completar el registro. Intenta nuevamente.');
    });
  });

  describe('paso 3 con datos incompletos', () => {
    it('pide revisar los campos si faltan la contraseña o la palabra secreta', () => {
      page.seguridadForm.patchValue({ terminos: true, privacidad: true, seguridad: true });

      page.submitSeguridad();

      expect(page.errorMessage()).toBe('Revisa los campos marcados.');
    });
  });
});
