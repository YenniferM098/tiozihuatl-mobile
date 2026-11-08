# Gestión del perfil y derechos ARCO

**Estado:** integrada en la **iteración 8 (4–10 de noviembre)** con la rama `feature/gestion-perfil` y liberada en la **versión 0.5.0** (REL-05).

## Historia de usuario

**HU-03 Gestión del perfil** (5 puntos, módulo Perfil):

> Como usuario autenticado, quiero consultar y actualizar los datos personales permitidos de mi perfil, para mantener actualizada la información de mi cuenta.

| Requerimiento | Descripción |
|---|---|
| RF-M09 | Consultar la información personal registrada en la cuenta |
| RF-M10 | Actualizar los datos personales permitidos, como correo electrónico y teléfono |
| RF-M11 | Cambiar la contraseña desde el perfil |
| RF-M12 | Visualizar el rol asignado |
| RF-M13 | Mostrar la matrícula o identificador institucional sin permitir modificarlo |
| RF-M14 | Consultar el estado de la cuenta |

## Derechos ARCO

La Ley Federal de Protección de Datos Personales en Posesión de los Particulares reconoce al titular los derechos de Acceso, Rectificación, Cancelación y Oposición sobre sus datos. En la app se cubren así:

| Derecho | Qué permite | Cómo se cubre |
|---|---|---|
| Acceso | Conocer qué datos personales tiene el sistema | Pantalla de perfil: datos personales, rol, matrícula y estado de la cuenta (RF-M09, RF-M12, RF-M13, RF-M14) |
| Rectificación | Corregir datos inexactos o desactualizados | Edición de correo y teléfono, y cambio de contraseña (RF-M10, RF-M11) |
| Cancelación | Pedir que se eliminen sus datos | **Visitante:** elimina su cuenta desde el perfil (escribe ELIMINAR para confirmar). **Estudiante y Docente:** la solicitan en el Instituto (Servicios Escolares); el perfil enlaza la página «Eliminación de cuenta» con el procedimiento |
| Oposición | Oponerse a un uso específico de sus datos | Se solicita en el Instituto (Servicios Escolares); el perfil explica cómo y enlaza el mismo procedimiento |

### Privacidad y tus datos en la app

La tarjeta **Privacidad y tus datos** del perfil se muestra a todos los roles:

- Explica que en la app se consultan y corrigen los datos personales, y que la eliminación de la cuenta o la oposición al uso de los datos la atiende el Instituto.
- El botón **Cómo eliminar mi cuenta** abre en el navegador la página institucional [Eliminación de cuenta](https://sites.google.com/view/iest-tiozihuatl-app/eliminaci%C3%B3n-de-cuenta). La dirección está en `environment.accountDeletionUrl`.
- Solo el Visitante ve además **Eliminar mi cuenta** (`DELETE /users/profile`). El backend rechaza la eliminación para Estudiante y Docente, cuyos datos administra el Instituto.

## Integración

La pantalla sigue la arquitectura MVVM, igual que el inicio de sesión, la Biblioteca y Materiales:

| Capa | Archivo |
|---|---|
| Contrato del repositorio | `src/app/domain/repositories/profile.repository.ts` (`PROFILE_REPOSITORY`) |
| Repositorio HTTP | `src/app/data/repositories/http-profile.repository.ts` |
| Casos de uso | `src/app/core/services/profile.service.ts` |
| ViewModel | `src/app/pages/profile/profile.view-model.ts` |
| Vista | `src/app/pages/profile/profile.page.*` |

| Tarea | Issue |
|---|---|
| T-28 Diseñar interfaz del perfil | #180 |
| T-29 Integrar la consulta del perfil con la API | #181 |
| T-30 Implementar la edición de los datos permitidos | #182 |
| T-31 Implementar el cambio de contraseña y la palabra secreta | #183 |
| T-32 Implementar el cierre de sesión y la eliminación de cuenta del Visitante | #184 |
| T-33 Informar los derechos ARCO y la eliminación de cuenta | #185 |

Las pruebas de HU-03 son las 7 del tablero (#79–#85) y las definidas en TEST-F03 y TEST-S02. Las de integración están en `tests/postman/datos/hu03-perfil.json`.
