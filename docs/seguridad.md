# Seguridad de Tiozihuatl Mobile

Cómo cumple la app los controles de seguridad de la Actividad 6 y dónde está cada uno en el código.

## 1. API REST con JWT Bearer

- `src/app/core/interceptors/auth.interceptor.ts` agrega `Authorization: Bearer <accessToken>` a cada petición hacia la API institucional y a ningún otro dominio (por ejemplo, Cloudinary no recibe el token).
- `src/app/core/services/auth.service.ts` renueva el token con `POST /auth/refresh` antes de que expire (`ensureValidSession`).

## 2. Interceptor de refresco por 401

Si la API responde **401 Unauthorized** a una petición autenticada, el interceptor:

1. Pide un token nuevo con el refresh token (`AuthService.refresh()`). Varias peticiones con 401 al mismo tiempo comparten una sola renovación.
2. Repite la petición original **una sola vez** con el token nuevo.
3. Si la renovación falla, borra la sesión y lleva al usuario al inicio de sesión.

`/auth/login`, `/auth/refresh` y `/auth/logout` nunca se reintentan. Las pruebas están en `auth.interceptor.spec.ts`.

## 3. Almacenamiento local cifrado

La sesión (access token, refresh token y datos básicos del usuario) se guarda con el plugin `@aparajita/capacitor-secure-storage`:

| Plataforma | Mecanismo |
|---|---|
| Android | AES-256-GCM con una llave del **Android Keystore**, guardado en SharedPreferences. Es el mismo esquema que usa EncryptedSharedPreferences. |
| iOS | **Keychain** |
| Navegador y pruebas | `localStorage` (sin datos reales de producción) |

- `src/app/data/storage/session.storage.ts`: contrato `SessionStore` y fábrica `SESSION_STORE`, que elige el almacén según la plataforma.
- `src/app/data/storage/secure-session.storage.ts`: almacén cifrado. La primera vez migra la sesión que la versión 0.1.0 dejó en `localStorage` y la borra de ahí.
- `src/main.ts`: `provideAppInitializer` lee la sesión cifrada antes de la primera navegación.

Las marcas de la pantalla de Bienvenida y de la guía de primer uso (si ya se mostraron) sí se guardan en `localStorage`, porque no contienen datos del usuario.

Nunca se guarda la contraseña. Además, `android:allowBackup="false"` y `data_extraction_rules.xml` impiden que la sesión se copie por `adb backup`, a la nube o a otro dispositivo.

## 4. Cifrado en tránsito y Certificate Pinning

- `android/app/src/main/res/xml/network_security_config.xml` prohíbe cualquier conexión sin HTTPS (`cleartextTrafficPermitted="false"`).
- Para el dominio de la API se fijan los hashes **SHA-256 de la llave pública** (SPKI) de los certificados de la cadena, con fecha de expiración. Si alguien intercepta la conexión con otro certificado (ataque MitM), Android rechaza la conexión.
- El pinning aplica porque la app usa `CapacitorHttp`: las peticiones a la API salen por el cliente HTTP nativo de Android y no por el WebView.
- Los hashes se obtienen con `node scripts/seguridad/obtener-pines.mjs`. Se deben revisar antes de la fecha de `expiration` o si Render cambia de autoridad certificadora.

## 5. Ofuscación con R8

- `android/app/build.gradle` → `release`: `minifyEnabled true` y `shrinkResources true` con `proguard-android-optimize.txt`.
- `android/app/proguard-rules.pro`: conserva solo lo que Capacitor llama por reflexión (plugins y métodos `@JavascriptInterface`).
- `publicacion.yml` guarda `mapping.txt` como artefacto para subirlo a Play Console y poder leer los errores.
- `seguridad.yml` compila el APK release con R8 y lo analiza con MobSF, que usa JADX para descompilarlo. El reporte queda en el artefacto `reporte-mobsf` y el APK en `apk-release-prueba`.

## 6. Permisos

La app solo declara `INTERNET` y, por el plugin de respuesta táctil, `VIBRATE`. Ambos son permisos normales: Android los concede al instalar y no muestra diálogo. La app no usa cámara, ubicación, micrófono ni contactos, así que no necesita pedir permisos en tiempo de ejecución.

La descarga de Materiales Complementarios tampoco pide permisos de almacenamiento:

- Android 10 o superior: el plugin `MaterialFilesPlugin` guarda el archivo en `Descargas/Tiozihuatl` con `MediaStore.Downloads`, que no requiere permiso.
- Android 7 a 9: lo guarda en la carpeta de descargas propia de la app (`file_paths.xml`, `material_downloads`), que tampoco requiere permiso.
- Solo se descargan archivos HTTPS de `res.cloudinary.com`, sin el token de la API, de hasta 100 MB y cuyo contenido coincide con su tipo; una descarga fallida o cancelada no deja archivos parciales.
- Para abrir el archivo con otra aplicación se usa `ACTION_VIEW` con permiso de lectura temporal solo sobre ese archivo. Por eso `AndroidManifest.xml` declara una consulta (`<queries>`) de las aplicaciones que pueden abrirlo; no es un permiso.

## 7. Pruebas de seguridad del sistema

La prueba **TEST-S06** (#60) revisa la API de producción como lo haría alguien que intenta saltarse la app. Corre en el pipeline `sistema.yml` (ver [Pruebas](pruebas.md#pruebas-de-sistema)).

| Control | Casos | Resultado |
|---|---|---|
| Credenciales incorrectas y rol que no corresponde | SS-01, SS-02 | ✅ Niega el acceso y no entrega token |
| Endpoints protegidos sin sesión y con token alterado | SS-03, SS-04 | ✅ Responde 401 o 403 |
| Renovar la sesión de otra cuenta | SS-06 | ✅ Lo niega |
| Modificar el perfil sin autorización | SS-07 | ✅ Lo niega |
| Revistas protegidas sin sesión | SS-09 | ✅ No entrega el PDF ni su dirección |
| Respuestas sin información sensible | SS-11 | ✅ Sin contraseñas, hashes, trazas ni SQL |
| Identificadores inválidos | SS-12 | ✅ 400 o 404, nunca 500 |
| Sesión cerrada | SS-05 | ⚠️ Hallazgo #217 |
| Visitante en Biblioteca y Materiales | SS-08 | ⚠️ Hallazgo #216 |
| PDF de una revista sin comprarla | SS-10 | ⚠️ Hallazgo #197 |

### Hallazgos pendientes

Los tres se corrigen en el backend (`backend_Tiozihuatl`); la app no necesita cambios. Están en la lista de pendientes de la versión 1.0.0 (REL-08 #138).

| Bug | Qué pasa | Corrección propuesta |
|---|---|---|
| #197 | El catálogo público entrega `pdf_public_id`, con el que se puede armar la URL pública del PDF de una revista sin comprarla | Subir los PDF como privados, entregar URL firmadas y con caducidad, y quitar `pdf_public_id` de las respuestas públicas |
| #216 | La API entrega Biblioteca, la URL del PDF de los libros y Materiales sin sesión o con la sesión de un Visitante; solo la app oculta esas secciones | Pedir sesión y validar el rol (Estudiante y Docente) en esas rutas |
| #217 | Al cerrar sesión se anula el token de renovación, pero el de acceso sigue sirviendo hasta que caduca | Lista de revocación de tokens o una duración más corta del token de acceso |

La prueba vuelve a revisar los tres en cada ejecución; cuando el backend los corrija, sus casos pasarán a ✅ Pasa.

### Credenciales de las pruebas

Las cuentas de prueba están en los secrets del repositorio (`SISTEMA_*`) y GitHub las oculta en los registros. El pipeline no publica el reporte HTML ni el JSON de Newman, porque incluyen los cuerpos de las peticiones con las contraseñas; solo publica el reporte de casos.
