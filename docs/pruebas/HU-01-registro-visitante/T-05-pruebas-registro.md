# T-05 Pruebas del registro — HU-01 Registro de visitante

**Issue:** #37 · **Historia:** #25
**Fecha:** 2026-10-04 · **Responsable:** moy2005
**Versión probada:** rama `feature/registro-visitante`
**Ambiente:** APK instalada en Android, conectada a la API institucional desplegada

## Pruebas realizadas

| # | Prueba | Plataforma | Resultado | Evidencia |
|---|---|---|---|---|
| 1 | Captura de datos personales y avance a la verificación del correo | Android (APK) | Aprobada | [CP-01](evidencias/CP-01.png) |
| 2 | Validación de formato de correo y teléfono | Android (APK) | Aprobada | [CP-02](evidencias/CP-02.png) |
| 3 | Bloqueo del avance con campos obligatorios vacíos | Android (APK) | Aprobada | [CP-03](evidencias/CP-03.png) |
| 4 | Registro completo con datos válidos | Android (APK) | Aprobada | [CP-04](evidencias/CP-04.png) |
| 5 | Mensaje de confirmación al terminar el registro | Android (APK) | Aprobada | [CP-06](evidencias/CP-06.png) |
| 6 | Aviso de correo ya registrado | Android (APK) | Aprobada | [CP-07](evidencias/CP-07.png) |
| 7 | Aviso de contraseñas que no coinciden | Android (APK) | Aprobada | [CP-08](evidencias/CP-08.png) |

## Incidencias encontradas

| # | Descripción | Estado |
|---|---|---|
| — | Ninguna | — |

## Conclusión

El flujo de registro de visitante funciona correctamente en la APK de Android: valida los datos capturados, impide continuar con información incompleta o inválida, crea la cuenta en la API institucional y muestra la confirmación de registro exitoso.
