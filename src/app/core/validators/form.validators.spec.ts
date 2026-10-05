import { FormControl, FormGroup } from '@angular/forms';
import {
  EMAIL_PATTERN,
  noForbiddenChars,
  passwordRules,
  passwordsMatch,
  patternTrimmed,
  strongPassword,
} from './form.validators';

describe('form.validators (HU-01 Registro de visitante)', () => {
  describe('patternTrimmed', () => {
    const emailValidator = patternTrimmed(EMAIL_PATTERN, 'email');

    it('no marca error cuando el campo está vacío (lo cubre required)', () => {
      expect(emailValidator(new FormControl(''))).toBeNull();
    });

    it('acepta un correo válido aunque tenga espacios alrededor', () => {
      expect(emailValidator(new FormControl('  visitante@correo.com  '))).toBeNull();
    });

    it('rechaza un correo sin arroba', () => {
      expect(emailValidator(new FormControl('visitante.correo.com'))).toEqual({ email: true });
    });
  });

  describe('noForbiddenChars', () => {
    it('acepta texto sin caracteres prohibidos', () => {
      expect(noForbiddenChars(new FormControl('Palabra secreta', { nonNullable: true }))).toBeNull();
    });

    it.each(['<script>', 'a"b', "a'b", 'a`b', 'a>b'])('rechaza el valor %s', (value) => {
      expect(noForbiddenChars(new FormControl(value, { nonNullable: true }))).toEqual({ forbidden: true });
    });
  });

  describe('passwordRules', () => {
    it('reporta cada regla cumplida para una contraseña válida', () => {
      expect(passwordRules('Segura1!')).toEqual({
        length: true,
        upper: true,
        lower: true,
        number: true,
        special: true,
      });
    });

    it('reporta las reglas que faltan', () => {
      expect(passwordRules('abc')).toEqual({
        length: false,
        upper: false,
        lower: true,
        number: false,
        special: false,
      });
    });
  });

  describe('strongPassword', () => {
    it('no marca error cuando el campo está vacío (lo cubre required)', () => {
      expect(strongPassword(new FormControl('', { nonNullable: true }))).toBeNull();
    });

    it('acepta una contraseña de 8 caracteres con mayúscula, minúscula, número y símbolo', () => {
      expect(strongPassword(new FormControl('Segura1!', { nonNullable: true }))).toBeNull();
    });

    it.each(['segura1!', 'SEGURA1!', 'Segurass!', 'Segura12', 'Segura1!x'])(
      'rechaza la contraseña débil %s',
      (value) => {
        expect(strongPassword(new FormControl(value, { nonNullable: true }))).toEqual({ weak: true });
      },
    );
  });

  describe('passwordsMatch', () => {
    const group = (contrasena: string, confirmar: string) =>
      new FormGroup({ contrasena: new FormControl(contrasena), confirmar: new FormControl(confirmar) });

    it('no marca error cuando las contraseñas coinciden', () => {
      expect(passwordsMatch(group('Segura1!', 'Segura1!'))).toBeNull();
    });

    it('marca error cuando las contraseñas no coinciden', () => {
      expect(passwordsMatch(group('Segura1!', 'Otra123!'))).toEqual({ mismatch: true });
    });

    it('no marca error mientras la confirmación sigue vacía', () => {
      expect(passwordsMatch(group('Segura1!', ''))).toBeNull();
    });
  });
});
