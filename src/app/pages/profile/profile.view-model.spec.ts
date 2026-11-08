import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Profile, ProfileError } from '../../core/models/profile.models';
import { ProfileService } from '../../core/services/profile.service';
import { ProfileViewModel } from './profile.view-model';

const PROFILE = { id: 5, rol: 'Estudiante', nombre: 'Astrid' } as Profile;

describe('ProfileViewModel (MVVM)', () => {
  let service: { profile: ReturnType<typeof vi.fn> };
  let vm: ProfileViewModel;

  beforeEach(() => {
    service = { profile: vi.fn(() => of(PROFILE)) };
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
});
