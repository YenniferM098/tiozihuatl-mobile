import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { Profile, ProfileError } from '../../core/models/profile.models';
import { ProfileService } from '../../core/services/profile.service';
import { ProfileViewModel } from './profile.view-model';

const PROFILE = {
  id: 5,
  rol: 'Estudiante',
  nombre: 'Astrid',
  aPaterno: 'Zamora',
  aMaterno: 'Guzmán',
  correo: 'astrid@correo.com',
  telefono: '7711234567',
} as Profile;
const VALUES = { nombre: 'Astrid', a_paterno: 'Zamora', a_materno: 'Guzmán', correo: 'astrid@correo.com', telefono: '7711234567' };

describe('ProfileViewModel (MVVM)', () => {
  let service: { profile: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; changePassword: ReturnType<typeof vi.fn>; deleteAccount: ReturnType<typeof vi.fn> };
  let vm: ProfileViewModel;

  beforeEach(() => {
    service = { profile: vi.fn(() => of(PROFILE)), update: vi.fn(() => of('ok')), changePassword: vi.fn(() => of('ok')), deleteAccount: vi.fn(() => of('ok')) };
    TestBed.configureTestingModule({ providers: [{ provide: ProfileService, useValue: service }] });
    vm = TestBed.runInInjectionContext(() => new ProfileViewModel());
  });

  it('carga el perfil y avisa al terminar', () => {
    const done = vi.fn();
    vm.load(done);

    expect(vm.profile()).toBe(PROFILE);
    expect(vm.error()).toBeNull();
    expect(vm.isStudent()).toBe(true);
    expect(vm.isVisitor()).toBe(false);
    expect(done).toHaveBeenCalled();
  });

  it('sin datos en pantalla muestra el error como estado de la vista', () => {
    service.profile.mockReturnValue(throwError(() => new ProfileError('connection', 'Sin conexión')));
    vm.load();

    expect(vm.profile()).toBeNull();
    expect(vm.error()?.kind).toBe('connection');
  });

  it('al refrescar con datos conserva el perfil y entrega el error como aviso', () => {
    vm.load();
    service.profile.mockReturnValue(throwError(() => new Error('falla')));
    const onRefreshError = vi.fn();
    vm.load(undefined, onRefreshError);

    expect(vm.profile()).toBe(PROFILE);
    expect(vm.error()).toBeNull();
    expect(onRefreshError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'server' }));
  });

  it('reconoce la cuenta de Visitante', () => {
    service.profile.mockReturnValue(of({ ...PROFILE, rol: 'Visitante' }));
    vm.load();

    expect(vm.isVisitor()).toBe(true);
    expect(vm.isStudent()).toBe(false);
  });

  it('Estudiante y Docente solo envían correo y teléfono, limpios y sin repetir lo que no cambió', () => {
    vm.load();
    const changes = vm.changes({ ...VALUES, nombre: 'Otro', correo: '  NUEVO@Correo.com ', telefono: '7711234567' });

    expect(changes).toEqual({ correo: 'nuevo@correo.com' });
  });

  it('Visitante también puede cambiar su nombre y apellidos', () => {
    service.profile.mockReturnValue(of({ ...PROFILE, rol: 'Visitante' }));
    vm.load();

    expect(vm.changes({ ...VALUES, nombre: 'Astrid   Cireth' })).toEqual({ nombre: 'Astrid Cireth' });
  });

  it('sin perfil cargado no hay cambios que enviar', () => {
    expect(vm.changes(VALUES)).toEqual({});
  });

  it('marca la operación en curso mientras se guarda', () => {
    const pending = new Subject<string>();
    service.update.mockReturnValue(pending);
    vm.load();
    vm.update({ telefono: '7719998877' }).subscribe();

    expect(service.update).toHaveBeenCalledWith({ telefono: '7719998877' });
    expect(vm.saving()).toBe(true);
    pending.next('ok');
    pending.complete();
    expect(vm.saving()).toBe(false);
  });

  it('guarda la palabra secreta sin espacios en los extremos', () => {
    vm.saveSecret('  gatito ').subscribe();
    expect(service.update).toHaveBeenCalledWith({ palabra_secreta: 'gatito' });
  });

  it('cambia la contraseña con la actual y la nueva', () => {
    vm.changePassword('Actual1@', 'Nueva12@').subscribe();
    expect(service.changePassword).toHaveBeenCalledWith('Actual1@', 'Nueva12@');
    expect(vm.saving()).toBe(false);
  });

  it('elimina la cuenta con el caso de uso del servicio', () => {
    vm.deleteAccount().subscribe();
    expect(service.deleteAccount).toHaveBeenCalled();
    expect(vm.saving()).toBe(false);
  });
});
