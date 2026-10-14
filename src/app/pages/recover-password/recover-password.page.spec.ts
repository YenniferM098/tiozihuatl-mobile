import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { AuthError, AuthService } from '../../core/services/auth.service';
import { RecoverPasswordPage } from './recover-password.page';

const TOKEN = '123e4567-e89b-42d3-a456-426614174000';

describe('RecoverPasswordPage (HU-02 recuperación de contraseña)', () => {
  let page: RecoverPasswordPage;
  let auth: {
    requestPasswordRecovery: ReturnType<typeof vi.fn>;
    validateRecoveryToken: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let toast: { present: ReturnType<typeof vi.fn> };
  let toastCtrl: { create: ReturnType<typeof vi.fn> };

  async function crear(queryToken: string | null = null): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastCtrl },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryToken ? { token: queryToken } : {}) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(RecoverPasswordPage);
    page = fixture.componentInstance;
    // La pantalla lee el token del enlace al iniciarse (ngOnInit).
    await fixture.whenStable();
  }

  const llenarSolicitud = () => page.solicitudForm.setValue({ correo: ' ana@correo.com ', palabraSecreta: 'tiozi' });
  const llenarContrasena = (confirmar = 'Nueva12!') =>
    page.passwordForm.setValue({ contrasena: 'Nueva12!', confirmar });

  beforeEach(async () => {
    auth = {
      requestPasswordRecovery: vi.fn().mockReturnValue(of('Si los datos son correctos, se envió un enlace.')),
      validateRecoveryToken: vi.fn().mockReturnValue(of(true)),
      resetPassword: vi.fn().mockReturnValue(of('Contraseña restablecida.')),
    };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    toast = { present: vi.fn().mockResolvedValue(undefined) };
    toastCtrl = { create: vi.fn().mockResolvedValue(toast) };
    await crear();
  });

  it('empieza en el paso de solicitud', () => {
    expect(page.step()).toBe('solicitud');
    expect(page.stepNumber()).toBe(1);
  });

  describe('paso 1: correo y palabra secreta', () => {
    it('no envía con campos vacíos y explica cada error', () => {
      page.submitSolicitud();

      expect(page.errorMessage()).toBe('Revisa los campos marcados.');
      expect(page.emailError).toBe('Ingresa tu correo electrónico.');
      expect(page.secretError).toBe('Ingresa tu palabra secreta.');
      expect(auth.requestPasswordRecovery).not.toHaveBeenCalled();
    });

    it('valida el formato del correo y de la palabra secreta', () => {
      page.solicitudForm.setValue({ correo: 'ana@', palabraSecreta: '<tiozi>' });
      expect(page.emailError).toBe('El correo electrónico no es válido.');
      expect(page.secretError).toBe('No uses los caracteres < > " \' `.');

      page.solicitudForm.controls.palabraSecreta.setValue('x'.repeat(31));
      expect(page.secretError).toBe('Máximo 30 caracteres.');

      llenarSolicitud();
      expect(page.emailError).toBe('');
      expect(page.secretError).toBe('');
    });

    it('envía la solicitud y pasa al aviso de enlace enviado', () => {
      llenarSolicitud();

      page.submitSolicitud();

      expect(auth.requestPasswordRecovery).toHaveBeenCalledWith({ correo: 'ana@correo.com', palabra_secreta: 'tiozi' });
      expect(page.step()).toBe('enviado');
      expect(page.infoMessage()).toContain('se envió un enlace');
      expect(page.solicitudForm.controls.palabraSecreta.value).toBe('');
    });

    it('muestra el error del servidor', () => {
      auth.requestPasswordRecovery.mockReturnValue(throwError(() => new AuthError('La palabra secreta no es correcta.')));
      llenarSolicitud();

      page.submitSolicitud();

      expect(page.step()).toBe('solicitud');
      expect(page.errorMessage()).toBe('La palabra secreta no es correcta.');
    });

    it('muestra un mensaje genérico ante un error inesperado', () => {
      auth.requestPasswordRecovery.mockReturnValue(throwError(() => new Error('boom')));
      llenarSolicitud();

      page.submitSolicitud();

      expect(page.errorMessage()).toBe('No fue posible completar la solicitud. Intenta nuevamente.');
    });
  });

  describe('paso 3: enlace del correo', () => {
    beforeEach(() => page.goToLinkStep());

    it('pide el enlace cuando está vacío', () => {
      page.submitEnlace();

      expect(page.linkError).toBe('Pega el enlace que recibiste por correo.');
      expect(auth.validateRecoveryToken).not.toHaveBeenCalled();
    });

    it('rechaza un texto que no contiene un token válido', () => {
      page.enlaceForm.controls.enlace.setValue('https://sitio.com/reset-password?token=abc');

      page.submitEnlace();

      expect(page.linkError).toBe('El enlace no es válido. Cópialo completo desde el correo.');
      expect(auth.validateRecoveryToken).not.toHaveBeenCalled();
    });

    it('rechaza un enlace con codificación dañada', () => {
      page.enlaceForm.controls.enlace.setValue('https://sitio.com/reset-password?token=%E0%A4%A');

      page.submitEnlace();

      expect(page.enlaceForm.controls.enlace.hasError('format')).toBe(true);
    });

    it('acepta el enlace completo del correo o solo el token', () => {
      page.enlaceForm.controls.enlace.setValue(`https://frontiozihuatl.netlify.app/reset-password?token=${TOKEN}`);
      page.submitEnlace();
      expect(auth.validateRecoveryToken).toHaveBeenLastCalledWith(TOKEN);
      expect(page.token()).toBe(TOKEN);

      page.token.set(null);
      page.enlaceForm.controls.enlace.setValue(TOKEN);
      page.submitEnlace();
      expect(auth.validateRecoveryToken).toHaveBeenLastCalledWith(TOKEN);
    });

    it('avisa cuando el enlace venció', () => {
      auth.validateRecoveryToken.mockReturnValue(of(false));
      page.enlaceForm.controls.enlace.setValue(TOKEN);

      page.submitEnlace();

      expect(page.token()).toBeNull();
      expect(page.errorMessage()).toBe('El enlace es inválido o ha expirado. Solicita uno nuevo.');
    });

    it('muestra el error si no se pudo validar el enlace', () => {
      auth.validateRecoveryToken.mockReturnValue(throwError(() => new AuthError('No fue posible conectar con el servidor.')));
      page.enlaceForm.controls.enlace.setValue(TOKEN);

      page.submitEnlace();

      expect(page.loading()).toBe(false);
      expect(page.errorMessage()).toBe('No fue posible conectar con el servidor.');
    });
  });

  it('al abrir la app desde el enlace del correo valida el token directamente', async () => {
    await crear(TOKEN);

    expect(page.step()).toBe('restablecer');
    expect(auth.validateRecoveryToken).toHaveBeenCalledWith(TOKEN);
    expect(page.token()).toBe(TOKEN);
  });

  describe('paso 3: nueva contraseña', () => {
    beforeEach(() => crear(TOKEN));

    it('valida requisitos y coincidencia de contraseñas', () => {
      page.passwordForm.markAllAsTouched();
      expect(page.passwordError).toBe('Crea una nueva contraseña.');
      expect(page.confirmError).toBe('Confirma tu nueva contraseña.');

      page.passwordForm.setValue({ contrasena: 'debil', confirmar: 'otra' });
      expect(page.passwordError).toBe('La contraseña no cumple los requisitos.');
      expect(page.confirmError).toBe('Las contraseñas no coinciden.');
      expect(page.confirmInvalid).toBe(true);
      expect(page.rules().length).toBe(false);

      page.passwordForm.controls.contrasena.setValue('Nueva1!<');
      expect(page.passwordError).toBe('No uses los caracteres < > " \' `.');

      llenarContrasena();
      expect(page.passwordError).toBe('');
      expect(page.confirmError).toBe('');
      expect(page.confirmInvalid).toBe(false);
    });

    it('no envía si las contraseñas no coinciden', () => {
      llenarContrasena('Otra12!!');

      page.submitPassword();

      expect(page.errorMessage()).toBe('Revisa los campos marcados.');
      expect(auth.resetPassword).not.toHaveBeenCalled();
    });

    it('guarda la nueva contraseña, vuelve al login y avisa', async () => {
      llenarContrasena();

      page.submitPassword();
      await vi.waitFor(() => expect(toast.present).toHaveBeenCalled());

      expect(auth.resetPassword).toHaveBeenCalledWith({ token: TOKEN, nuevaContrasena: 'Nueva12!' });
      expect(page.token()).toBeNull();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
      expect(toastCtrl.create).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Contraseña restablecida. Ya puedes iniciar sesión.' }),
      );
    });

    it('si el enlace venció mientras escribía, pide uno nuevo', () => {
      auth.resetPassword.mockReturnValue(
        throwError(() => new AuthError('El enlace es inválido o ha expirado. Solicita uno nuevo.')),
      );
      llenarContrasena();

      page.submitPassword();

      expect(page.token()).toBeNull();
      expect(page.errorMessage()).toContain('expirado');
    });

    it('conserva el enlace ante otros errores', () => {
      auth.resetPassword.mockReturnValue(throwError(() => new AuthError('Ocurrió un problema en el servidor.')));
      llenarContrasena();

      page.submitPassword();

      expect(page.token()).toBe(TOKEN);
      expect(page.errorMessage()).toBe('Ocurrió un problema en el servidor.');
    });

    it('no envía sin token o mientras espera respuesta', () => {
      llenarContrasena();
      page.loading.set(true);
      page.submitPassword();
      page.loading.set(false);
      page.token.set(null);
      page.submitPassword();

      expect(auth.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('navegación entre pasos', () => {
    it('regresa del enlace al aviso y del aviso a la solicitud', () => {
      llenarSolicitud();
      page.submitSolicitud();
      page.goToLinkStep();

      page.goBack();
      expect(page.step()).toBe('enviado');

      page.goBack();
      expect(page.step()).toBe('solicitud');

      page.goBack();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    });

    it('si abrió el enlace sin pedirlo antes, regresa a la solicitud', async () => {
      await crear(TOKEN);
      page.goBack();
      expect(page.step()).toBe('solicitud');
      expect(page.token()).toBeNull();
    });

    it('pide un enlace nuevo limpiando todo', async () => {
      await crear(TOKEN);
      page.errorMessage.set('Error');

      page.requestNewLink();

      expect(page.step()).toBe('solicitud');
      expect(page.token()).toBeNull();
      expect(page.errorMessage()).toBeNull();
    });

    it('ignora acciones mientras espera respuesta', () => {
      page.loading.set(true);
      page.submitSolicitud();
      page.submitEnlace();
      page.requestNewLink();
      page.goBack();

      expect(auth.requestPasswordRecovery).not.toHaveBeenCalled();
      expect(auth.validateRecoveryToken).not.toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
