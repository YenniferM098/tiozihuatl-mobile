# Monitoreo

Cómo se vigila que la API que usa la app esté disponible, responda rápido y sin errores. El monitoreo tiene su propio pipeline, `monitoreo.yml`, separado de los de pruebas, seguridad y publicación: no compila ni despliega, solo mide.

Issues: #128 (niveles de servicio y métricas), #129 (pipeline de monitoreo) y #130 (reporte de resultados).

## Conceptos (Unidad 3)

| Concepto | Qué es | En el proyecto |
|---|---|---|
| **SLA** | Acuerdo de nivel de servicio: lo que se promete al usuario | La API de la app está disponible y responde en un tiempo razonable |
| **SLI** | Indicador: el valor que se mide | Porcentaje de disponibilidad, tiempo de respuesta P95 y porcentaje de éxito |
| **SLO** | Objetivo: el valor que debe alcanzar el SLI | Por ejemplo, disponibilidad de al menos 99 % |
| **Presupuesto de errores** | Margen de fallas que permite el SLO | Con un SLO de 99 %, puede fallar hasta el 1 % de las verificaciones |

Se miden las tres señales de la Unidad 3: **disponibilidad**, **desempeño** (tiempo de respuesta) y **confiabilidad** (tasa de éxito).

## Métricas

| Métrica | Grupo | SLI (cómo se calcula) | SLO | Presupuesto de errores |
|---|---|---|---|---|
| Disponibilidad | Disponibilidad | Verificaciones en que la API respondió ÷ verificaciones totales × 100 | ≥ 99 % | 1 % de las verificaciones |
| Tiempo de respuesta (P95) | Desempeño | Tiempo en el que responde el 95 % de las consultas | < 2 s | 5 % de las consultas pueden tardar 2 s o más |
| Tasa de éxito HTTP | Confiabilidad | Solicitudes con respuesta 2xx ÷ solicitudes totales × 100 | ≥ 99 % | 1 % de solicitudes fallidas |

- Una verificación cuenta como **disponible** si la API respondió sin error de servidor (código menor a 500). La disponibilidad se mide por muestreo.
- El **presupuesto de errores restante** es la parte del margen que todavía no se usa: 100 % si no hubo fallas y 0 % si se agotó.

## Pipeline `monitoreo.yml`

| Disparador | Cuándo |
|---|---|
| `schedule` | Cada 6 horas (`0 */6 * * *`) |
| `workflow_dispatch` | Manual, desde *Actions → Monitoreo → Run workflow* |
| `pull_request` | En los PR que modifican `monitoreo.yml` o `scripts/monitoreo/` |

GitHub solo programa un workflow y muestra su botón manual cuando el archivo está en la rama principal (`main`). Hasta la liberación 0.9.0, el monitoreo corre en los PR.

Pasos del job **Monitoreo de la API**:

1. Ejecuta `node scripts/monitoreo/medir-api.mjs` con la variable `API_URL` del repositorio.
2. Publica el reporte en el resumen de la ejecución.
3. Guarda el artifact `reporte-monitoreo` con `reporte.md` y `resultado.json`, que sirve como historial.

Si alguna métrica no cumple su SLO, la ejecución queda en **rojo** como alerta.

## Qué mide el script

`scripts/monitoreo/medir-api.mjs`:

1. **Calentamiento:** hace una primera consulta a `/health` para despertar el servidor, porque Render suspende el plan gratuito cuando no tiene uso. Esa consulta se informa aparte y no cuenta en las métricas.
2. **Rondas:** 4 rondas, separadas por 15 s, a 5 endpoints públicos de solo lectura que la app usa al abrir cada módulo. En total son 20 consultas:

   | Endpoint | Módulo |
   |---|---|
   | `/health` | Estado de la API |
   | `/catalog` | Biblioteca |
   | `/magazines` | Revistas |
   | `/material/semestres` | Materiales (semestres) |
   | `/material/materiales/todos?semestre=1&page=1&limit=9` | Materiales del semestre |

3. Cada consulta tiene un límite de 10 s. Se registra su código HTTP y su tiempo.
4. Calcula las 3 métricas, las compara con su SLO y calcula el presupuesto de errores restante.

Variables opcionales: `RONDAS` (4), `PAUSA_SEGUNDOS` (15) y `SALIDA` (`reporte-monitoreo`).

Se usan pocas peticiones y espaciadas porque la API limita a **100 peticiones por minuto por IP**. Por la misma razón, nunca se hacen pruebas de carga contra producción.

## El reporte

Cada ejecución genera un reporte con:

- **Tabla de métricas:** métrica, grupo, SLO, SLI medido, presupuesto de errores restante y estado (✅ Cumple o ❌ No cumple).
- **Interpretación y plan de mejora** de cada métrica según su resultado.
- **Detalle por endpoint:** códigos HTTP, tiempo promedio y tiempo máximo.

### Qué hacer si una métrica no cumple

| Métrica | Revisar |
|---|---|
| Disponibilidad | Estado del servicio en Render y sus registros; evaluar un plan sin suspensión por inactividad |
| Tiempo de respuesta | Las consultas a la base de datos, los pools de conexiones del backend y el arranque del servidor en Render; el detalle por endpoint indica cuál es el más lento |
| Tasa de éxito | Qué endpoint falló en el detalle; registrar un Bug con su código de respuesta |

## Ejecutarlo en un equipo local

```bash
# API_URL se toma de la variable de entorno o del archivo .env
node scripts/monitoreo/medir-api.mjs
```

El reporte queda en `reporte-monitoreo/`, que está en `.gitignore`. Para simular una falla se puede usar una URL que no responde, por ejemplo `API_URL=https://127.0.0.1:9/api`: las 3 métricas salen como "No cumple" y el script termina con error.

## Resultados

| Ejecución | Disponibilidad | P95 | Tasa de éxito | Resultado |
|---|---|---|---|---|
| Local, antes del PR #214 | 100 % | 1 048 ms | 100 % | Se cumplen los 3 SLO |
| [GitHub Actions, PR #214](https://github.com/YenniferM098/tiozihuatl-mobile/actions/runs/44450619327) | 100 % | 331 ms | 100 % | Se cumplen los 3 SLO |

El P95 en GitHub Actions es menor porque sus servidores tienen mejor conexión con Render. El endpoint más lento fue `/health`.

## Límites

- **Muestreo:** la disponibilidad se calcula con las verificaciones de cada ejecución, no de forma continua. Una caída entre dos ejecuciones no se detecta.
- **Cold start:** si Render suspendió el servicio, el calentamiento tarda más; por eso no se cuenta en las métricas.
- **Alcance:** mide la API, no el rendimiento de la app en el celular. El rendimiento de la interfaz se mide con Lighthouse CI en `pruebas.yml` (ver [Pruebas](pruebas.md)).
