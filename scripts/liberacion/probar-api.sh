#!/usr/bin/env bash
# Pruebas en el entorno de liberación: la API de producción (Render) responde y
# la colección de Postman pasa contra ella antes de publicar la versión.
# Uso: API_URL=<url> probar-api.sh   (requiere newman instalado)
set -euo pipefail

coleccion="tests/postman/tiozihuatl-mobile.postman_collection.json"
ambiente="tests/postman/ci.postman_environment.json"
base_url="${API_URL:?Falta la variable API_URL}"

# Render (plan gratuito) suspende el servicio sin uso; se espera a que despierte.
echo "Esperando a que responda $base_url"
for intento in $(seq 1 12); do
  estado=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$base_url" || echo 000)
  if [ "$estado" != "000" ] && [ "$estado" -lt 500 ]; then
    echo "API disponible (HTTP $estado)"
    break
  fi
  if [ "$intento" -eq 12 ]; then
    echo "::error::La API no respondió (último HTTP $estado)."
    exit 1
  fi
  echo "Intento $intento: HTTP $estado, reintentando en 15 s"
  sleep 15
done

mkdir -p reportes
resultado=0
for datos in tests/postman/datos/*.json; do
  hu=$(basename "$datos" .json)
  echo "::group::$hu"
  newman run "$coleccion" -e "$ambiente" --env-var "baseUrl=$base_url" --folder "$hu" -d "$datos" \
    --delay-request 700 --timeout-request 60000 \
    -r cli,htmlextra --reporter-htmlextra-export "reportes/liberacion-$hu.html" || resultado=1
  echo "::endgroup::"
done
exit $resultado
