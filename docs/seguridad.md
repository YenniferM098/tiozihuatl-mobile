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

La app solo declara `INTERNET` y, por el plugin de respuesta táctil, `VIBRATE`. Ambos son permisos normales: Android los concede al instalar y no muestra diálogo. La app no usa cámara, ubicación, micrófono, contactos ni archivos, así que no necesita pedir permisos en tiempo de ejecución.
