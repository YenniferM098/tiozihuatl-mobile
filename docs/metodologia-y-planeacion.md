# Metodología y planeación

El proyecto se desarrolla con **Mobile-D**, una metodología ágil para aplicaciones móviles con iteraciones cortas, y se da seguimiento en un **tablero Kanban** de **GitHub Projects**.

Tablero: [Sistema Integral Tiozihuatl Mobile](https://github.com/users/YenniferM098/projects/1/views/1), con las vistas Backlog, Kanban y Mobile-D.

## Mobile-D

| Fase | Propósito | En el proyecto |
|---|---|---|
| Explore | Definir alcance, usuarios y requerimientos | Alcance, roles, módulos, requerimientos funcionales, elección de Ionic + Angular y de Mobile-D + Kanban (#1–#7) |
| Initialize | Preparar el equipo, el entorno y la planeación | Repositorio, colaboradores, GitHub Project, Planning Poker, iteraciones, GitFlow y pipeline DevOps (#8–#22); configuración de Google Play (#123–#126) |
| Productionize | Construir las historias de usuario en iteraciones | HU-01 a HU-08, sus tareas T-xx y sus pruebas |
| Stabilize | Integrar los módulos y estabilizar | Versión integrada 0.9.0 y monitoreo con Android vitals |
| System Test & Fix | Probar el sistema completo y corregir | Pruebas funcionales integrales (TEST-F09), pruebas generales de seguridad (TEST-S06) y versión 1.0.0 |

Cada iteración de Productionize sigue los días de Mobile-D:

- **Planning Day:** se eligen las historias, se estiman con Planning Poker y se definen los casos de aceptación.
- **Working Days:** desarrollo en una rama `feature/*`, con pruebas unitarias, análisis estático e integración en cada push.
- **Release Day:** pruebas de aceptación, rendimiento y esfuerzo, integración a `develop` y, cuando corresponde, liberación de una versión.

## Tablero Kanban

| Columna | Significado |
|---|---|
| Backlog | Actividad identificada pero todavía no preparada para comenzar |
| Ready | Actividad definida y lista para ser tomada por un desarrollador |
| In progress | Actividad actualmente en desarrollo |
| Review/Testing | Desarrollo terminado, pendiente de revisión o pruebas |
| Done | Actividad terminada y validada |

Campos de cada elemento del tablero:

- **Mobile-D Phase:** Explore, Initialize, Productionize, Stabilize o System Test & Fix.
- **Iteration:** semana de trabajo (ver la tabla de iteraciones).
- **Type:** User Story, Task, Bug, Test o Documentation.
- **Module:** General, Autenticación, Perfil, Biblioteca Digital, Materiales Complementarios o Revistas Digitales.
- **Story Points:** 1, 2, 3, 5, 8 o 13, estimados con Planning Poker.

Tipos de issue:

- **HU-xx:** historia de usuario con sus criterios de aceptación y requerimientos funcionales (RF-Mxx).
- **T-xx:** tarea técnica de una historia.
- **TEST-Fxx / TEST-Sxx:** pruebas funcionales y de seguridad por módulo.
- **QA:** las 7 pruebas de cada historia, con las etiquetas `QA-UNITARIA`, `QA-ESTATICO`, `QA-INTEGRACION`, `QA-REGRESION`, `QA-ACEPTACION`, `QA-RENDIMIENTO` y `QA-ESFUERZO` (ver [Pruebas](pruebas.md)).
- **REL-xx:** liberación de una versión en Google Play.

## Iteraciones

Iteraciones de una semana, del 15 de septiembre al 1 de diciembre de 2026.

| Iteración | Fechas | Fase | Contenido | Estado |
|---|---|---|---|---|
| 1 | 15–21 sep | Explore / Initialize | Alcance, usuarios, módulos, requerimientos, tecnología, metodología y repositorio | Terminada |
| 2 | 22–28 sep | Initialize | GitHub Project, Planning Poker, iteraciones, GitFlow y pipeline DevOps | Terminada |
| 3 | 29 sep–5 oct | Productionize | HU-01 Registro de visitante (5 pts) y HU-02 Inicio de sesión (8 pts) | Terminada |
| 4 | 6–13 oct | Productionize | Regularización de las pruebas de HU-01 y HU-02; definición de pruebas de perfil (TEST-F03, TEST-S02) | Terminada |
| 5 | 14–20 oct | Initialize / Productionize | HU-04 Biblioteca Digital (5 pts); ficha, prueba cerrada y despliegue en Google Play; liberación 0.1.0 | Terminada |
| 6 | 21–27 oct | Productionize | HU-05 Lectura de libros digitales (8 pts); liberación 0.2.0 y 0.3.0; métricas y monitoreo | En curso |
| 7 | 28 oct–3 nov | Productionize | HU-06 Materiales Complementarios (8 pts); liberación 0.4.0 | Pendiente |
| 8 | 4–10 nov | Productionize | HU-03 Gestión del perfil (5 pts), HU-07 Catálogo de revistas (5 pts) y HU-08 Lectura de revistas (8 pts); liberación 0.5.0 y 0.6.0 | Pendiente |
| 9 | 11–17 nov | Stabilize | Versión integrada 0.9.0 y monitoreo con Android vitals | Pendiente |
| 10 | 18–24 nov | System Test & Fix | TEST-F09 pruebas funcionales integrales y TEST-S06 pruebas generales de seguridad | Pendiente |
| 11 | 25 nov–1 dic | System Test & Fix | Versión 1.0.0 en producción | Pendiente |

## Versiones

Cada versión se publica en la prueba cerrada de Google Play cuando las pruebas de sus historias están cerradas.

| Versión | Issue | Contenido | Iteración | Estado |
|---|---|---|---|---|
| 0.1.0 | REL-01 | Registro e inicio de sesión | 5 | Liberada |
| 0.2.0 | REL-02 | Biblioteca Digital | 6 | En preparación |
| 0.3.0 | REL-03 | Lectura de libros digitales | 6 | Pendiente |
| 0.4.0 | REL-04 | Materiales Complementarios | 7 | Pendiente |
| 0.5.0 | REL-05 | Gestión del perfil (ARCO) | 8 | Pendiente |
| 0.6.0 | REL-06 | Revistas Digitales | 8 | Pendiente |
| 0.9.0 | REL-07 | Versión integrada | 9 | Pendiente |
| 1.0.0 | REL-08 | Producción | 11 | Pendiente |

El proceso de cada liberación está en [Publicación en Google Play](publicacion-play.md).

## Flujo de trabajo

1. La historia pasa de Backlog a Ready en el Planning Day.
2. Se crea `feature/<nombre>` desde `develop` y la historia pasa a In progress.
3. Cada push ejecuta los pipelines de pruebas y de seguridad.
4. Se abre un Pull Request hacia `develop`; la historia pasa a Review/Testing.
5. Con los pipelines en verde se integra a `develop`, se genera la APK de aceptación y se envía a los testers.
6. Con la aceptación aprobada y las 7 pruebas cerradas, la historia pasa a Done.
7. Para liberar se crea `release/X.Y.Z`, se integra a `main` con el tag `vX.Y.Z` y vuelve a `develop`. El tag dispara la publicación en Google Play.

## Pendientes

- **Materiales Complementarios (HU-06):** consulta, búsqueda y filtros por materia, semestre o tipo, detalle, visualización y descarga. Iteración 7.
- **Revistas Digitales (HU-07 y HU-08):** catálogo con búsqueda, filtros y orden, detalle con portada, título, descripción y precio, y lectura de revistas adquiridas. La compra no se hace desde la app. Iteración 8.
- **Gestión del perfil (HU-03):** desarrollada, se integra en la iteración 8 ([detalle](perfil-arco.md)).
- **Monitoreo:** subida automática a Google Play (#127), niveles de servicio y métricas (#128), monitoreo de la API (#129) y Android vitals (#130).
- **Pruebas del sistema:** prueba de esfuerzo de HU-02 (#78), TEST-F09 (#59) y TEST-S06 (#60).
