# Publicación en Google Play

Cómo se libera y despliega Tiozihuatl Mobile en Google Play con GitFlow y GitHub Actions.

## Archivos

| Archivo | Función |
|---|---|
| `.github/workflows/publicacion.yml` | Pipeline de liberación y despliegue (se dispara con un tag `vX.Y.Z`) |
| `scripts/liberacion/preparar-entorno.sh` | Genera el entorno de liberación: reconstruye y valida la llave de firma |
| `scripts/liberacion/probar-api.sh` | Pruebas en el entorno de liberación contra la API de producción (Render) |
| `scripts/liberacion/verificar-aab.sh` | Pruebas del AAB: firma, llave no debug, paquete, versión y permisos |
| `android/app/build.gradle` | Firma release y versión (`versionName` de `package.json`, `versionCode` del pipeline) |
| `android/keystore.properties.example` | Plantilla para firmar en un equipo local |
| `scripts/configurar-api.mjs` | Genera `src/environments/api.config.ts` con la URL de la API (desde `.env` o `API_URL`) |

`pruebas.yml` solo cambia para recibir la URL de la API desde la variable `API_URL`.

## URL de la API

La URL no se guarda en el repositorio. `src/environments/api.config.ts` se genera y está en
`.gitignore`.

- **En tu equipo:** copia `.env.example` como `.env`, escribe la URL y ejecuta
  `npm run configurar:api` (también corre solo antes de `npm start`, `npm run build` y
  `npm test`). Si usas `ionic serve`, ejecútalo una vez antes.
- **En GitHub Actions:** variable del repositorio `API_URL` en *Settings → Secrets and
  variables → Actions → Variables*. La usan `pruebas.yml` (lint, unitarias, compilación y
  Newman) y `publicacion.yml`.

La URL sigue viajando dentro de la app instalada; no es un secreto. Los secretos reales
(llave de firma y cuenta de servicio de Play) están en el environment `produccion`.

## Flujo

```
feature/* ──PR──> develop ──> release/X.Y.Z ──PR──> main ──tag vX.Y.Z──> publicacion.yml
                     ^                                                       │
                     └──────────────PR (release/X.Y.Z)──────────────────────┘
publicacion.yml: pruebas API producción ┐
                 generar AAB ─> verificar AAB ┴─> Play (prueba cerrada) ─> producción (aprobación manual)
```

Estrategia de despliegue: **Canary**. Cada versión llega primero a la prueba cerrada
(grupo de testers) y se promueve a producción manualmente en Play Console, con
lanzamiento escalonado por porcentaje.

## Configuración única

1. **Llave de subida** (fuera del repositorio, respaldarla junto con sus contraseñas):

   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
     -keystore "$env:USERPROFILE\keys\tiozihuatl-upload.jks" -alias upload `
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Environment `produccion`** en GitHub (*Settings → Environments*, requiere permiso de
   administrador del repositorio) con estos secretos:

   | Secreto | Valor |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\keys\tiozihuatl-upload.jks")) \| Set-Clipboard` |
   | `ANDROID_KEYSTORE_PASSWORD` | Contraseña del keystore |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | Contraseña de la llave |
   | `PLAY_SERVICE_ACCOUNT_JSON` | JSON de la cuenta de servicio de Play (se agrega después de la primera subida manual) |

   Mientras `PLAY_SERVICE_ACCOUNT_JSON` no exista, el pipeline genera y verifica el AAB y
   deja la subida como pendiente manual.

3. **Play Console**: crear la app `com.tiozihuatl.app`, activar *Play App Signing*, completar
   ficha, política de privacidad, seguridad de los datos, acceso a la app (credenciales de
   prueba) y la lista de testers de la prueba cerrada.

## Liberar una versión

```bash
git checkout develop && git pull origin develop
git checkout -b release/0.1.0
npm version 0.1.0 --no-git-tag-version
git commit -am "chore(release): 0.1.0"
git push -u origin release/0.1.0
# PR release/0.1.0 -> main y merge
git checkout main && git pull origin main
git tag -a v0.1.0 -m "Versión 0.1.0"
git push origin v0.1.0
# PR release/0.1.0 -> develop y merge
```

El tag debe coincidir con `package.json`; si no, el pipeline se detiene. La primera versión
se descarga del artefacto `aab-0.1.0` y se sube a mano en *Play Console → Pruebas → Prueba
cerrada*. Las siguientes se suben solas cuando ya existe `PLAY_SERVICE_ACCOUNT_JSON`.

## Firmar en un equipo local (opcional)

Copiar `android/keystore.properties.example` a `android/keystore.properties`, llenar los datos y:

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```
