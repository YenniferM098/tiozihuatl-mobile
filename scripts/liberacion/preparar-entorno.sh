#!/usr/bin/env bash
# Genera el entorno de liberación en el runner de GitHub Actions:
#   1. Comprueba que existan los secretos de firma del environment `produccion`.
#   2. Reconstruye la llave de subida (upload key) desde su copia en base64.
#   3. Verifica que la contraseña y el alias abran la llave.
#   4. Expone ANDROID_KEYSTORE_PATH para que android/app/build.gradle firme el AAB.
set -euo pipefail

for variable in ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [ -z "${!variable:-}" ]; then
    echo "::error::Falta el secreto $variable en el environment produccion."
    exit 1
  fi
done

destino="${RUNNER_TEMP:-/tmp}/tiozihuatl-upload.jks"
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$destino"

if ! keytool -list -keystore "$destino" -storepass "$ANDROID_KEYSTORE_PASSWORD" \
    -alias "$ANDROID_KEY_ALIAS" > /dev/null 2>&1; then
  echo "::error::La llave no abre con ANDROID_KEYSTORE_PASSWORD y ANDROID_KEY_ALIAS."
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "ANDROID_KEYSTORE_PATH=$destino" >> "$GITHUB_ENV"
fi
echo "Llave de subida lista en $destino"
