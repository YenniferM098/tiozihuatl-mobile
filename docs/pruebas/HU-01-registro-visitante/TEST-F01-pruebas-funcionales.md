# TEST-F01 Pruebas funcionales — HU-01 Registro de visitante

**Issue:** #45 · **Historia:** #25 · **Requerimiento:** RF-M01
**Fecha:** 2026-10-04 · **Ejecutó:** moy2005
**Ambiente:** APK Android + API institucional desplegada

Cada caso corresponde a un criterio de aceptación de la HU-01.

| ID | Criterio de aceptación | Pasos | Datos de entrada | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| CP-01 | El visitante puede ingresar los datos requeridos para registrarse | Abrir Registro y capturar nombre, apellidos, correo y teléfono | Juan / Pérez / López / juan@correo.com / 7711234567 | El formulario acepta los datos y avanza a la verificación del correo | El formulario aceptó los datos y avanzó a la verificación del correo | Aprobado | [CP-01](evidencias/CP-01.png) |
| CP-02 | El sistema valida que la información sea correcta | Capturar un correo sin @ y un teléfono de 5 dígitos | juan.correo.com / 77112 | Se muestran "El correo electrónico no es válido." y "El teléfono debe tener 10 dígitos." | Se mostraron ambos mensajes de validación y no se permitió avanzar | Aprobado | [CP-02](evidencias/CP-02.png) |
| CP-03 | No se permite registrar información obligatoria incompleta | Dejar el nombre vacío y presionar Continuar | (vacío) | No avanza y se muestra "Revisa los campos marcados." | No avanzó y se mostró "Revisa los campos marcados." | Aprobado | [CP-03](evidencias/CP-03.png) |
| CP-04 | La cuenta se crea correctamente | Verificar el correo y completar contraseña, palabra secreta y aceptaciones | Contraseña de 8 caracteres con mayúscula, minúscula, número y símbolo | La API crea la cuenta | La cuenta se creó correctamente en la API | Aprobado | [CP-04](evidencias/CP-04.png) |
| CP-05 | La nueva cuenta queda asociada al rol de Visitante | Consultar el usuario creado en la plataforma web o base de datos | martinezmoy919@gmail.com | Rol = Visitante | La cuenta quedó registrada con rol Visitante | Aprobado | [CP-05](evidencias/CP-05.png) |
| CP-06 | El usuario recibe una confirmación de registro exitoso | Terminar el registro | — | Aviso "… Ya puedes iniciar sesión como Visitante." | Se mostró el aviso de registro exitoso | Aprobado | [CP-06](evidencias/CP-06.png) |
| CP-07 | El sistema valida que la información sea correcta | Registrar un correo que ya tiene cuenta | Correo existente | Aviso "Este correo ya tiene una cuenta. Inicia sesión." | Se mostró el aviso "Este correo ya tiene una cuenta. Inicia sesión." | Aprobado | [CP-07](evidencias/CP-07.png) |
| CP-08 | El sistema valida que la información sea correcta | Capturar contraseñas que no coinciden | Segura1! / Otra123! | Aviso "Las contraseñas no coinciden." | Se mostró el aviso "Las contraseñas no coinciden." | Aprobado | [CP-08](evidencias/CP-08.png) |

## Resumen

| Casos ejecutados | Pasaron | Fallaron |
|---|---|---|
| 8 | 8 | 0 |
