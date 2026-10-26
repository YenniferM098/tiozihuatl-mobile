# Gestión del perfil y derechos ARCO

**Estado:** la funcionalidad ya está desarrollada, pero todavía no se integra a la app. Para respetar la planeación del tablero, se integra en la **iteración 8 (4–10 de noviembre)** y se libera en la **versión 0.5.0** (REL-05).

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
| Cancelación | Pedir que se eliminen sus datos | Solicitud desde el perfil, atendida por el sistema institucional |
| Oposición | Oponerse a un uso específico de sus datos | Solicitud desde el perfil, atendida por el sistema institucional |

## Plan de integración

1. Crear `feature/gestion-perfil` desde `develop` al inicio de la iteración 8.
2. Integrar la pantalla de perfil siguiendo la arquitectura MVVM (`ProfileViewModel`, contrato de repositorio y repositorio HTTP), igual que el inicio de sesión y la biblioteca.
3. Ejecutar sus 7 pruebas (#79–#85) y las pruebas definidas en TEST-F03 y TEST-S02.
4. Integrar a `develop` por Pull Request y liberar la versión 0.5.0.
