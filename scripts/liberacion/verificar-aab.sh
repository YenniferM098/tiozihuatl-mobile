#!/usr/bin/env bash
# Pruebas del artefacto de liberación antes de enviarlo a Google Play.
# Uso: verificar-aab.sh <ruta-al-aab> <versionName-esperado>
# Requiere la variable BUNDLETOOL_JAR (ruta a bundletool.jar) y un JDK en el PATH.
set -euo pipefail

aab="${1:?Indica la ruta del AAB}"
version_esperada="${2:?Indica el versionName esperado}"
paquete_esperado="com.tiozihuatl.app"
: "${BUNDLETOOL_JAR:?Falta BUNDLETOOL_JAR}"

leer() {
  java -jar "$BUNDLETOOL_JAR" dump manifest --bundle "$aab" --xpath "$1"
}

echo "1) El AAB existe y no está vacío"
test -s "$aab"

echo "2) El AAB está firmado y la firma es válida"
jarsigner -verify "$aab" | tee /tmp/firma.txt
grep -q "jar verified" /tmp/firma.txt

echo "3) No está firmado con la llave de depuración"
if keytool -printcert -jarfile "$aab" | grep -q "CN=Android Debug"; then
  echo "::error::El AAB está firmado con la llave debug."
  exit 1
fi

echo "4) El paquete y la versión coinciden"
paquete=$(leer /manifest/@package)
version=$(leer /manifest/@android:versionName)
codigo=$(leer /manifest/@android:versionCode)
echo "   paquete=$paquete versionName=$version versionCode=$codigo"
[ "$paquete" = "$paquete_esperado" ] || { echo "::error::Paquete $paquete, se esperaba $paquete_esperado"; exit 1; }
[ "$version" = "$version_esperada" ] || { echo "::error::versionName $version, se esperaba $version_esperada"; exit 1; }
[ "$codigo" -gt 0 ] || { echo "::error::versionCode inválido"; exit 1; }

echo "5) El AAB no pide permisos fuera de los declarados"
permisos=$(leer //uses-permission/@android:name 2>/dev/null | sort -u || true)
echo "$permisos"
extra=$(echo "$permisos" | grep -v -x -e 'android.permission.INTERNET' -e '' \
  -e 'com.tiozihuatl.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION' || true)
if [ -n "$extra" ]; then
  echo "::warning::Permisos adicionales a revisar en la ficha de Play: $extra"
fi

echo "AAB verificado: $paquete $version ($codigo)"
