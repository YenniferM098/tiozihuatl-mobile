// Monitoreo de la API de producción (#128, #129, #130).
// Mide 3 métricas de la Unidad 3 (disponibilidad, tiempo de respuesta P95 y tasa de éxito HTTP),
// las compara con su SLO, calcula el presupuesto de errores restante y genera el reporte.
//
// Uso: API_URL=<url> node scripts/monitoreo/medir-api.mjs
// Variables opcionales: RONDAS (4), PAUSA_SEGUNDOS (15), SALIDA (reporte-monitoreo).
// En un equipo local, API_URL también se toma del archivo .env de la raíz.
// Solo consulta endpoints públicos y de lectura, con pocas peticiones por ejecución
// (la API limita a 100 peticiones por minuto por IP).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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

const apiUrl = (process.env.API_URL || leerEnv().API_URL || '').trim().replace(/\/+$/, '');
if (!/^https?:\/\/\S+$/.test(apiUrl)) {
  console.error('Falta API_URL (variable de entorno o archivo .env).');
  process.exit(2);
}

const rondas = Number(process.env.RONDAS ?? 4);
const pausaMs = Number(process.env.PAUSA_SEGUNDOS ?? 15) * 1000;
const salida = join(raiz, process.env.SALIDA ?? 'reporte-monitoreo');
const TIEMPO_LIMITE_MS = 10000;

/** Endpoints públicos que usa la app al abrir cada módulo. */
const ENDPOINTS = [
  { nombre: 'Estado de la API', ruta: '/health' },
  { nombre: 'Catálogo de Biblioteca', ruta: '/catalog' },
  { nombre: 'Catálogo de Revistas', ruta: '/magazines' },
  { nombre: 'Semestres de Materiales', ruta: '/material/semestres' },
  { nombre: 'Materiales del semestre', ruta: '/material/materiales/todos?semestre=1&page=1&limit=9' },
];

/** SLO de #128. */
const SLO = { disponibilidad: 99, p95Ms: 2000, exito: 99 };

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function consultar(endpoint) {
  const inicio = performance.now();
  try {
    const respuesta = await fetch(apiUrl + endpoint.ruta, { signal: AbortSignal.timeout(TIEMPO_LIMITE_MS) });
    await respuesta.arrayBuffer();
    return { ...endpoint, estado: respuesta.status, ms: Math.round(performance.now() - inicio) };
  } catch (error) {
    return { ...endpoint, estado: 0, ms: Math.round(performance.now() - inicio), error: error.name };
  }
}

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)] ?? 0;
}

/** Porcentaje del presupuesto de errores que todavía no se usa. */
function presupuestoRestante(total, permitidoPct, fallas) {
  const permitidas = total * (permitidoPct / 100);
  if (permitidas === 0) return fallas === 0 ? 100 : 0;
  return Math.max(0, Math.round(((permitidas - fallas) / permitidas) * 100));
}

const redondear = (valor) => Math.round(valor * 100) / 100;

// Render (plan gratuito) suspende el servicio sin uso: la primera consulta lo despierta
// y se informa aparte, sin contarla en las métricas.
console.log(`Monitoreo de ${apiUrl}: despertando la API`);
const calentamiento = await consultar(ENDPOINTS[0]);
console.log(`Calentamiento: HTTP ${calentamiento.estado} en ${calentamiento.ms} ms`);

const consultas = [];
for (let ronda = 1; ronda <= rondas; ronda++) {
  for (const endpoint of ENDPOINTS) {
    const resultado = { ronda, ...(await consultar(endpoint)) };
    consultas.push(resultado);
    console.log(`Ronda ${ronda} | ${endpoint.nombre}: HTTP ${resultado.estado || resultado.error} en ${resultado.ms} ms`);
  }
  if (ronda < rondas) await esperar(pausaMs);
}

const total = consultas.length;
const respondidas = consultas.filter((c) => c.estado > 0 && c.estado < 500);
const exitosas = consultas.filter((c) => c.estado >= 200 && c.estado < 300);
const tiempos = respondidas.map((c) => c.ms);
const lentas = consultas.filter((c) => c.estado === 0 || c.ms >= SLO.p95Ms);

const disponibilidad = redondear((respondidas.length / total) * 100);
const p95 = percentil(tiempos, 95);
const exito = redondear((exitosas.length / total) * 100);

const metricas = [
  {
    nombre: 'Disponibilidad',
    grupo: 'Disponibilidad',
    slo: `≥ ${SLO.disponibilidad} %`,
    sli: `${disponibilidad} %`,
    detalle: `${respondidas.length} de ${total} verificaciones respondieron`,
    cumple: disponibilidad >= SLO.disponibilidad,
    presupuesto: presupuestoRestante(total, 100 - SLO.disponibilidad, total - respondidas.length),
    interpretacion: (ok) => ok
      ? 'La API estuvo operativa y accesible en todas o casi todas las verificaciones.'
      : 'La API no respondió o devolvió errores del servidor en varias verificaciones.',
    mejora: (ok) => ok
      ? 'Mantener el monitoreo programado y revisar la tendencia entre ejecuciones.'
      : 'Revisar el estado del servicio en Render y sus registros; evaluar un plan sin suspensión por inactividad.',
  },
  {
    nombre: 'Tiempo de respuesta (P95)',
    grupo: 'Desempeño',
    slo: `< ${SLO.p95Ms / 1000} s`,
    sli: tiempos.length ? `${p95} ms` : 'sin respuestas',
    detalle: tiempos.length
      ? `mínimo ${Math.min(...tiempos)} ms, promedio ${Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)} ms, máximo ${Math.max(...tiempos)} ms`
      : 'ninguna consulta respondió',
    cumple: tiempos.length > 0 && p95 < SLO.p95Ms,
    presupuesto: presupuestoRestante(total, 5, lentas.length),
    interpretacion: (ok) => ok
      ? 'El 95 % de las consultas respondió dentro del objetivo.'
      : 'Más del 5 % de las consultas tardó 2 s o más o no respondió.',
    mejora: (ok) => ok
      ? 'Vigilar el endpoint más lento y repetir la medición después de cada liberación.'
      : 'Revisar las consultas a la base de datos y los pools de conexiones del backend, y el arranque del servidor en Render.',
  },
  {
    nombre: 'Tasa de éxito HTTP',
    grupo: 'Confiabilidad',
    slo: `≥ ${SLO.exito} %`,
    sli: `${exito} %`,
    detalle: `${exitosas.length} de ${total} solicitudes con respuesta 2xx`,
    cumple: exito >= SLO.exito,
    presupuesto: presupuestoRestante(total, 100 - SLO.exito, total - exitosas.length),
    interpretacion: (ok) => ok
      ? 'Las solicitudes terminaron correctamente.'
      : 'Algunas solicitudes terminaron con error (4xx, 5xx o sin respuesta).',
    mejora: (ok) => ok
      ? 'Sin acciones: mantener las pruebas de integración en cada cambio de la API.'
      : 'Identificar en el detalle qué endpoint falló y registrar un Bug con su código de respuesta.',
  },
];

const fecha = new Date().toISOString();
const cumpleTodo = metricas.every((m) => m.cumple);

const filas = metricas
  .map((m) => `| ${m.nombre} | ${m.grupo} | ${m.slo} | **${m.sli}** | ${m.presupuesto} % | ${m.cumple ? '✅ Cumple' : '❌ No cumple'} |`)
  .join('\n');
const analisis = metricas
  .map((m) => `- **${m.nombre}:** ${m.interpretacion(m.cumple)} Datos: ${m.detalle}.\n  - Plan de mejora: ${m.mejora(m.cumple)}`)
  .join('\n');
const detalle = ENDPOINTS.map((e) => {
  const propias = consultas.filter((c) => c.ruta === e.ruta);
  const estados = [...new Set(propias.map((c) => c.estado || c.error))].join(', ');
  const ms = propias.map((c) => c.ms);
  return `| ${e.nombre} | \`${e.ruta}\` | ${estados} | ${Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)} ms | ${Math.max(...ms)} ms |`;
}).join('\n');

const reporte = `## Reporte de monitoreo de la API

**Fecha:** ${fecha}
**Resultado:** ${cumpleTodo ? '✅ Se cumplen los 3 SLO' : '❌ Al menos una métrica no cumple su SLO'}
**Muestras:** ${total} consultas (${rondas} rondas a ${ENDPOINTS.length} endpoints públicos). Calentamiento previo, no contado: HTTP ${calentamiento.estado || calentamiento.error} en ${calentamiento.ms} ms.

| Métrica | Grupo | SLO | SLI medido | Presupuesto de errores restante | Estado |
|---|---|---|---|---|---|
${filas}

### Interpretación y plan de mejora
${analisis}

### Detalle por endpoint
| Endpoint | Ruta | HTTP | Promedio | Máximo |
|---|---|---|---|---|
${detalle}

La disponibilidad se mide por muestreo: verificaciones en que la API respondió (sin error de servidor ni falta de respuesta) entre el total de verificaciones.
`;

mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'reporte.md'), reporte);
writeFileSync(join(salida, 'resultado.json'), JSON.stringify({
  fecha, apiUrl, rondas, slo: SLO, calentamiento, cumpleTodo,
  metricas: metricas.map(({ interpretacion, mejora, ...m }) => ({ ...m, interpretacion: interpretacion(m.cumple), mejora: mejora(m.cumple) })),
  consultas,
}, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, reporte);

console.log('\n' + reporte);
process.exit(cumpleTodo ? 0 : 1);
