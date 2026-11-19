// Reporte de las pruebas de sistema (#59 funcional y #60 seguridad).
// Lee el resultado JSON de Newman, agrupa las validaciones por caso (SF-xx / SS-xx)
// y separa las fallas de los hallazgos:
//   - "[Hallazgo conocido #n]": problema ya registrado; se reporta y no hace fallar.
//   - "[Posible hallazgo]": comportamiento a registrar como Bug; se reporta y no hace fallar.
//   - Cualquier otra validación fallida es una falla y deja la ejecución en rojo.
//
// Uso: node scripts/sistema/reporte-sistema.mjs <resultado-newman.json> "<título>" <salida.md>
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const [archivo, titulo = 'Pruebas de sistema', salida] = process.argv.slice(2);

if (!archivo || !existsSync(archivo)) {
  const aviso = `## ${titulo}\n\n❌ Newman no generó resultados (${archivo ?? 'sin archivo'}). Revisar el registro de la ejecución.\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, aviso);
  console.error(aviso);
  process.exit(1);
}

/** Nombre de cada caso de #59 y #60; cada caso puede tener varias peticiones en la colección. */
const NOMBRES = {
  'SF-01': 'Registro con datos inválidos',
  'SF-02': 'Inicio de sesión como Estudiante',
  'SF-03': 'Sesión activa',
  'SF-04': 'Consultar el perfil',
  'SF-05': 'Catálogo de Biblioteca',
  'SF-06': 'Buscar y filtrar en Biblioteca',
  'SF-07': 'Abrir un libro en el lector',
  'SF-08': 'Materiales del semestre',
  'SF-09': 'Filtrar y descargar un material',
  'SF-10': 'Catálogo y detalle de Revistas',
  'SF-11': 'Revistas adquiridas',
  'SF-12': 'Renovar la sesión',
  'SF-13': 'Cerrar la sesión',
  'SF-14': 'Inicio de sesión como Visitante',
  'SF-15': 'Visitante: Revistas y perfil',
  'SF-16': 'Visitante cierra sesión',
  'SF-17': 'Búsquedas sin resultados',
  'SS-01': 'Contraseña incorrecta',
  'SS-02': 'Rol que no corresponde',
  'SS-03': 'Endpoints protegidos sin sesión',
  'SS-04': 'Token alterado',
  'SS-05': 'Sesión cerrada',
  'SS-06': 'Renovar la sesión de otra cuenta',
  'SS-07': 'Modificar el perfil sin autorización',
  'SS-08': 'Visitante en Biblioteca y Materiales',
  'SS-09': 'Revista protegida sin sesión',
  'SS-10': 'PDF de revista sin comprarla',
  'SS-11': 'Respuestas sin información sensible',
  'SS-12': 'Identificadores inválidos',
};

const { run } = JSON.parse(readFileSync(archivo, 'utf8'));
const casos = new Map();

function caso(id, nombre) {
  if (!casos.has(id)) casos.set(id, { id, nombre: NOMBRES[id] ?? nombre, fallas: [], hallazgos: [], validaciones: 0 });
  return casos.get(id);
}

for (const ejecucion of run.executions) {
  const [, id, nombre] = ejecucion.item.name.match(/^(S[FS]-\d+)\s+(.*)$/) ?? [null, 'OTROS', ejecucion.item.name];
  const propio = caso(id, nombre);
  if (ejecucion.requestError) {
    propio.fallas.push(`${nombre}: sin respuesta (${ejecucion.requestError.code ?? ejecucion.requestError.message})`);
  }
  for (const { assertion, error } of ejecucion.assertions ?? []) {
    // Una validación marcada con otro caso (por ejemplo, [SS-11]) se cuenta en ese caso.
    const [, otroId] = assertion.match(/^\[(S[FS]-\d+)\]/) ?? [];
    const destino = otroId ? caso(otroId, otroId) : propio;
    destino.validaciones++;
    if (!error) continue;
    const texto = `${nombre}: ${assertion.replace(/^\[S[FS]-\d+\]\s*/, '')}`;
    if (/^\[(Hallazgo conocido|Posible hallazgo)/.test(assertion)) destino.hallazgos.push(texto);
    else destino.fallas.push(`${texto} (${error.message})`);
  }
}

const lista = [...casos.values()].sort((a, b) => a.id.localeCompare(b.id, 'es', { numeric: true }));
const estado = (c) => (c.fallas.length ? '❌ Falla' : c.hallazgos.length ? '⚠️ Hallazgo' : '✅ Pasa');
const fallas = lista.filter((c) => c.fallas.length);
const hallazgos = lista.filter((c) => !c.fallas.length && c.hallazgos.length);
const pasan = lista.length - fallas.length - hallazgos.length;
const { stats, timings } = run;

const filas = lista.map((c) => `| ${c.id} | ${c.nombre} | ${estado(c)} | ${c.validaciones} |`).join('\n');
const detalle = [...fallas, ...hallazgos]
  .flatMap((c) => [...c.fallas.map((t) => `- ❌ **${c.id}** ${t}`), ...c.hallazgos.map((t) => `- ⚠️ **${c.id}** ${t}`)])
  .join('\n');

const reporte = `## ${titulo}

**Fecha:** ${new Date().toISOString()}
**Resultado:** ${fallas.length ? `❌ ${fallas.length} caso(s) con falla` : '✅ Sin fallas'} · ${pasan} pasan · ${hallazgos.length} con hallazgo · ${lista.length} casos
**Peticiones:** ${stats.requests.total} (${stats.requests.failed} sin respuesta) · **Validaciones:** ${stats.assertions.total} · **Duración:** ${Math.round((timings.completed - timings.started) / 1000)} s

| ID | Caso | Resultado | Validaciones |
|---|---|---|---|
${filas}
${detalle ? `\n### Fallas y hallazgos\n${detalle}\n` : ''}
Los hallazgos (⚠️) se reportan sin dejar la ejecución en rojo: los conocidos ya tienen su issue y los posibles se registran como Bug para su corrección.
`;

if (salida) writeFileSync(salida, reporte);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, reporte);
console.log(reporte);
process.exit(fallas.length ? 1 : 0);
