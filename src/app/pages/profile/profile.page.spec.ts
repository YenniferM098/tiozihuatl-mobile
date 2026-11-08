import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Profile, ProfileError } from '../../core/models/profile.models';
import { ProfileService } from '../../core/services/profile.service';
import { ProfilePage } from './profile.page';

const STUDENT: Profile = {
  id: 5,
  nombre: 'Astrid Cireth',
  aPaterno: 'Zamora',
  aMaterno: 'Guzmán',
  fullName: 'Astrid Cireth Zamora Guzmán',
  correo: 'astrid@correo.com',
  telefono: '7711234567',
  matricula: 'IEST0514',
  grupo: 'A',
  carrera: 'Licenciatura en Enfermería',
  semestre: 'Segundo semestre',
  rol: 'Estudiante',
  estado: 'Activo',
  fechaRegistro: '2026-01-15T10:00:00.000Z',
  ultimaConexion: null,
  tienePalabraSecreta: false,
};

const VISITOR: Profile = {
  ...STUDENT,
  rol: 'Visitante',
  matricula: null,
  grupo: null,
  carrera: null,
  semestre: null,
  tienePalabraSecreta: true,
};

function setup(service: Partial<Record<keyof ProfileService, unknown>>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ProfileService, useValue: service }],
  });
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();
  return fixture;
}

describe('ProfilePage - Perfil de usuario', () => {
  it('Estudiante: muestra rol, matrícula, datos académicos y estado de la cuenta', () => {
    const fixture = setup({ profile: () => of(STUDENT) });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Astrid Cireth Zamora Guzmán');
    expect(text).toContain('Matrícula: IEST0514');
    expect(text).toContain('Licenciatura en Enfermería');
    expect(text).toContain('Estado de la cuenta');
    expect(text).toContain('Activo');
    expect(text).toContain('los administra el Instituto');
  });

  it('Visitante: oculta la matrícula y los datos académicos', () => {
    const fixture = setup({ profile: () => of(VISITOR) });
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Visitante');
    expect(text).not.toContain('Matrícula');
    expect(text).not.toContain('Licenciatura en Enfermería');
    expect(text).not.toContain('los administra el Instituto');
  });

  it('muestra las fechas en español y un guion cuando no hay dato', () => {
    const page = setup({ profile: () => of(STUDENT) }).componentInstance;

    expect(page.formatDate('2026-01-15T10:00:00.000Z')).toContain('enero de 2026');
    expect(page.formatDate(null)).toBe('—');
    expect(page.formatDate('no es fecha')).toBe('—');
  });

  it('Estudiante solo puede editar correo y teléfono; envía únicamente lo que cambió', () => {
    const update = vi.fn(() => of('Perfil actualizado correctamente.'));
    const fixture = setup({ profile: () => of(STUDENT), update });
    const page = fixture.componentInstance;

    page.openEdit();
    expect(page.editForm.controls.nombre.disabled).toBe(true);
    page.editForm.controls.telefono.setValue('7719998877');
    page.saveProfile();

    expect(update).toHaveBeenCalledWith({ telefono: '7719998877' });
  });

  it('Visitante puede editar su nombre', () => {
    const update = vi.fn(() => of('ok'));
    const fixture = setup({ profile: () => of(VISITOR), update });
    const page = fixture.componentInstance;

    page.openEdit();
    expect(page.editForm.controls.nombre.enabled).toBe(true);
    page.editForm.controls.nombre.setValue('Astrid');
    page.saveProfile();

    expect(update).toHaveBeenCalledWith({ nombre: 'Astrid' });
  });

  it('no envía un correo con formato inválido', () => {
    const update = vi.fn(() => of('ok'));
    const fixture = setup({ profile: () => of(STUDENT), update });
    const page = fixture.componentInstance;

    page.openEdit();
    page.editForm.controls.correo.setValue('usuario@');
    page.saveProfile();

    expect(update).not.toHaveBeenCalled();
    expect(page.fieldError(page.editForm.controls.correo, 'email')).toBe('Ingresa un correo electrónico válido.');
  });

  it('muestra dentro de la hoja el error que devuelve el servidor', () => {
    const update = vi.fn(() => throwError(() => new ProfileError('conflict', 'El correo electrónico ya está registrado en otra cuenta.')));
    const fixture = setup({ profile: () => of(STUDENT), update });
    const page = fixture.componentInstance;

    page.openEdit();
    page.editForm.controls.correo.setValue('otro@correo.com');
    page.saveProfile();

    expect(page.sheet()).toBe('edit');
    expect(page.sheetError()).toBe('El correo electrónico ya está registrado en otra cuenta.');
    expect(page.saving()).toBe(false);
  });

  it('valida la nueva contraseña antes de enviarla', () => {
    const changePassword = vi.fn(() => of('ok'));
    const fixture = setup({ profile: () => of(STUDENT), changePassword });
    const page = fixture.componentInstance;

    page.openPassword();
    page.passwordForm.setValue({ actual: 'Actual1@', contrasena: 'debil', confirmar: 'debil' });
    page.savePassword();
    expect(changePassword).not.toHaveBeenCalled();

    page.passwordForm.setValue({ actual: 'Actual1@', contrasena: 'Nueva12@', confirmar: 'Nueva12@' });
    page.savePassword();
    expect(changePassword).toHaveBeenCalledWith('Actual1@', 'Nueva12@');
  });

  it('la palabra secreta respeta el límite de 4 a 10 caracteres del backend', () => {
    const update = vi.fn(() => of('ok'));
    const fixture = setup({ profile: () => of(STUDENT), update });
    const page = fixture.componentInstance;

    page.openSecret();
    page.secretForm.setValue({ palabra: 'abc' });
    page.saveSecret();
    expect(update).not.toHaveBeenCalled();

    page.secretForm.setValue({ palabra: 'gatito' });
    page.saveSecret();
    expect(update).toHaveBeenCalledWith({ palabra_secreta: 'gatito' });
  });

  it('la nueva contraseña debe coincidir y ser distinta de la actual', () => {
    const changePassword = vi.fn(() => of('ok'));
    const page = setup({ profile: () => of(STUDENT), changePassword }).componentInstance;

    page.openPassword();
    page.passwordForm.setValue({ actual: 'Nueva12@', contrasena: 'Nueva12@', confirmar: 'Nueva12@' });
    page.passwordForm.markAllAsTouched();
    expect(page.confirmError).toBe('La nueva contraseña debe ser distinta de la actual.');

    page.passwordForm.setValue({ actual: 'Actual1@', contrasena: 'Nueva12@', confirmar: 'Nueva13@' });
    expect(page.confirmError).toBe('Las contraseñas no coinciden.');
    page.savePassword();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('Seguridad indica si falta configurar la palabra secreta', () => {
    expect(setup({ profile: () => of(STUDENT) }).nativeElement.textContent).toContain('Sin configurar');
    TestBed.resetTestingModule();
    expect(setup({ profile: () => of(VISITOR) }).nativeElement.textContent).toContain('Configurada');
  });

  it('muestra el error de conexión con opción de reintentar', () => {
    const error = new ProfileError('connection', 'No fue posible conectar con el servidor.');
    const fixture = setup({ profile: () => throwError(() => error) });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('No fue posible conectar con el servidor.');
    expect(text).toContain('Reintentar');
  });

  it('con la sesión vencida ofrece volver a iniciar sesión', () => {
    const error = new ProfileError('session', 'Tu sesión expiró. Inicia sesión nuevamente.');
    const fixture = setup({ profile: () => throwError(() => error) });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
  });
});
