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
