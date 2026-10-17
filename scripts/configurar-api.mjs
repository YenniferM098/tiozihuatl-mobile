// Genera src/environments/api.config.ts con la URL de la API.
// La URL no se guarda en el repositorio: se toma de la variable de entorno API_URL
// (GitHub Actions la recibe de la variable del repositorio `vars.API_URL`) o, en un
// equipo local, del archivo .env de la raíz del proyecto (ver .env.example).
// Se ejecuta solo antes de `npm start`, `npm run build` y `npm test`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'src', 'environments', 'api.config.ts');

function leerEnv() {
  const archivo = join(raiz, '.env');
  if (!existsSync(archivo)) return {};
  const valores = {};
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (coincidencia) valores[coincidencia[1]] = coincidencia[2].replace(/^['"]|['"]$/g, '');
  }
  return valores;
}

const apiUrl = (process.env.API_URL || leerEnv().API_URL || '').trim();

if (!/^https?:\/\/\S+$/.test(apiUrl)) {
  console.error(
    'Falta API_URL. Crea el archivo .env (copia .env.example) con la URL de la API,\n' +
      'o define la variable de entorno API_URL. En GitHub Actions se toma de vars.API_URL.',
  );
  process.exit(1);
}

const contenido = `/**
 * ARCHIVO GENERADO por scripts/configurar-api.mjs (no editar ni subir al repositorio).
 * URL base de la API institucional; los environments la reexportan como \`apiUrl\`.
 */
export const API_URL = '${apiUrl.replace(/\/+$/, '')}';
`;

writeFileSync(destino, contenido);
console.log('api.config.ts generado');
