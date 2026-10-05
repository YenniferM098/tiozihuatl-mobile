import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Mismas reglas que la plataforma web y el middleware validateRegisterData del backend.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_LENGTH = 8;
const FORBIDDEN_CHARS = /[<>"'`]/;

export function patternTrimmed(pattern: RegExp, errorKey: string): ValidatorFn {
  return (control: AbstractControl<string>) => {
    const value = (control.value ?? '').trim();
    if (!value) return null;
    return pattern.test(value) ? null : { [errorKey]: true };
  };
}

export function noForbiddenChars(control: AbstractControl<string>): ValidationErrors | null {
  return FORBIDDEN_CHARS.test(control.value ?? '') ? { forbidden: true } : null;
}

/** Reglas de contraseña de la plataforma web: 8 caracteres con mayúscula, minúscula, número y símbolo. */
export function passwordRules(value: string) {
  return {
    length: value.length === PASSWORD_LENGTH,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
    special: /[@$!%*?&]/.test(value),
  };
}

export function strongPassword(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value ?? '';
  if (!value) return null;
  return Object.values(passwordRules(value)).every(Boolean) ? null : { weak: true };
}

/** Valida que los controles `contrasena` y `confirmar` del grupo coincidan. */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('contrasena')?.value;
  const confirm = group.get('confirmar')?.value;
  return confirm && pass !== confirm ? { mismatch: true } : null;
}
