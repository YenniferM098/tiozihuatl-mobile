# Pruebas

Cada historia de usuario pasa por **7 pruebas**. Cada una tiene un issue en el tablero con su etiqueta `QA-*`, y sus evidencias se guardan en Google Drive. Las pruebas automáticas corren en GitHub Actions; las manuales las ejecuta el equipo con la APK en un celular.

Además, el sistema completo tiene dos **pruebas de sistema** (funcional y de seguridad) y la API de producción se vigila con el **monitoreo** ([Monitoreo](monitoreo.md)).

## Las 7 pruebas

| # | Prueba | Etiqueta | Herramienta | Quién la ejecuta | Cuándo |
|---|---|---|---|---|---|
| 1 | Unitarias | `QA-UNITARIA` | Vitest con cobertura mínima de 70 % | Pipeline, job `unitarias` | Cada push |
| 2 | Análisis de código estático | `QA-ESTATICO` | ESLint (reglas de Angular y TypeScript) | Pipeline, job `analisis-estatico` | Cada push |
| 3 | Integración | `QA-INTEGRACION` | Postman para diseñar y Newman para ejecutar contra la API | Pipeline, job `integracion` | Cada push |
| 4 | Regresión | `QA-REGRESION` | Vitest, ESLint y Newman con las pruebas de todas las historias anteriores | Pipeline, los tres jobs anteriores en paralelo | Cada push |
| 5 | Aceptación | `QA-ACEPTACION` | APK en celular Android, Firebase App Distribution y checklist de casos | Un integrante distinto al que desarrolló la historia | Release Day |
| 6 | Rendimiento | `QA-RENDIMIENTO` | Lighthouse CI, Postman Performance (10 usuarios virtuales, 5 min) y Chrome DevTools | Pipeline (Lighthouse) y el desarrollador | Release Day |
| 7 | Esfuerzo | `QA-ESFUERZO` | Postman Performance (carga creciente de 10 a 50 usuarios y picos) y Chrome DevTools (red lenta y sin conexión) | El desarrollador, con el backend local | Release Day |

## Pipelines

### Pipeline de pruebas (`.github/workflows/pruebas.yml`)

Corre en cada push a cualquier rama.

| Job | Qué hace |
|---|---|
| `analisis-estatico` | `ng lint` |
| `unitarias` | `ng test` con cobertura; falla si baja de 70 % en sentencias, ramas, funciones o líneas. Guarda `reporte-cobertura` |
| `integracion` | Ejecuta `tests/postman/tiozihuatl-mobile.postman_collection.json` con un archivo de datos por historia, de `hu01-registro.json` a `hu08-lector-revistas.json` en `tests/postman/datos/`. Guarda `reporte-integracion` |
| `compilacion` | `ng build` y guarda la carpeta `www` |
| `apk-aceptacion` | Solo en `develop`: genera la APK de prueba y la guarda como artifact `apk-aceptacion`; la envía a los testers por Firebase App Distribution cuando existen sus secretos |
| `rendimiento-lighthouse` | Solo en `develop`: mide `/register` y `/login` con Lighthouse CI (`lighthouserc.json`): rendimiento mínimo 0.7–0.8, accesibilidad 0.8, primer contenido en menos de 3 s e interactiva en menos de 5 s. Guarda `reporte-rendimiento` |

### Pipeline de seguridad (`.github/workflows/seguridad.yml`)

Corre en cada push, en los Pull Request hacia `develop` y `main`, y cada lunes.

| Job | Qué hace |
|---|---|
| `sast-codeql` | Análisis estático de seguridad con CodeQL |
| `sast-semgrep` | Análisis estático de seguridad con Semgrep. Guarda `reporte-semgrep` |
| `dependencias` | `npm audit`; falla si hay vulnerabilidades críticas en dependencias de producción. Guarda `reporte-dependencias` |
| `analisis-apk-mobsf` | En `develop` y en Pull Requests: compila la APK release con R8 y la analiza con MobSF. Guarda `reporte-mobsf` y `apk-release-prueba` |

El detalle de los controles está en [Seguridad](seguridad.md).

### Pruebas de sistema (`.github/workflows/sistema.yml`)

Corre de forma manual, al crear un tag `vX.Y.Z` y en los PR que modifican estas pruebas. Ejecuta los dos jobs uno después del otro para no rebasar el límite de peticiones de la API.

| Job | Qué hace |
|---|---|
| Prueba funcional del sistema | Carpeta `funcional` de `tests/postman/sistema/sistema.postman_collection.json` (#59). Guarda `reporte-sistema-funcional` |
| Prueba de seguridad del sistema | Carpeta `seguridad` de la misma colección (#60). Guarda `reporte-sistema-seguridad` |

El detalle está en [Pruebas de sistema](#pruebas-de-sistema).

### Monitoreo (`.github/workflows/monitoreo.yml`)

Corre cada 6 horas, de forma manual y en los PR que modifican el monitoreo. Mide la disponibilidad, el tiempo de respuesta y la tasa de éxito de la API de producción y publica el reporte `reporte-monitoreo`. El detalle está en [Monitoreo](monitoreo.md).

### Publicación (`.github/workflows/publicacion.yml`)

Corre al crear un tag `vX.Y.Z`.

| Job | Qué hace |
|---|---|
| `pruebas-api-produccion` | Pruebas de la API de producción con Newman (`scripts/liberacion/probar-api.sh`) |
| `generar-aab` | Revisa que la versión de `package.json` coincida con el tag, compila y firma el AAB, y guarda `mapping.txt` |
| `verificar-aab` | Verifica con bundletool la firma, el paquete, la versión y los permisos (`scripts/liberacion/verificar-aab.sh`) |
| `desplegar-play` | Sube el AAB a la prueba cerrada de Google Play |

## Pruebas de sistema

Recorren la API de producción como lo hace la app, con una cuenta de **Estudiante** y una de **Visitante**. Solo leen datos: no crean cuentas ni compras y no modifican perfiles.

### Funcional (#59 TEST-F09): 17 casos

| Casos | Qué se revisa |
|---|---|
| SF-01 | Registro con datos inválidos (sin crear la cuenta) |
| SF-02, SF-03, SF-12, SF-13, SF-14, SF-16 | Inicio de sesión, sesión activa, renovación y cierre, con Estudiante y Visitante |
| SF-04, SF-15 | Perfil según el rol |
| SF-05, SF-06, SF-07 | Catálogo de Biblioteca, filtro de contenido digital y PDF del lector |
| SF-08, SF-09 | Materiales del semestre, filtro por materia y descarga |
| SF-10, SF-11, SF-15 | Catálogo y detalle de Revistas, y revistas adquiridas |
| SF-17 | Búsquedas sin resultados en los tres catálogos |

### Seguridad (#60 TEST-S06): 12 casos

| Casos | Qué se revisa |
|---|---|
| SS-01, SS-02 | Contraseña incorrecta y rol que no corresponde |
| SS-03, SS-04 | Endpoints protegidos sin sesión y con token alterado |
| SS-05 | Tokens después de cerrar sesión |
| SS-06 | Renovar la sesión de otra cuenta |
| SS-07 | Modificar el perfil sin autorización |
| SS-08 | Visitante en Biblioteca y Materiales |
| SS-09, SS-10 | Revistas protegidas sin sesión y PDF de una revista sin comprarla |
| SS-11 | Ninguna respuesta expone contraseñas, hashes, trazas ni SQL |
| SS-12 | Identificadores inválidos responden 400 o 404, nunca 500 |

### Fallas y hallazgos

`scripts/sistema/reporte-sistema.mjs` arma la tabla de casos con ✅ Pasa, ❌ Falla o ⚠️ Hallazgo:

- Una validación marcada como `[Hallazgo conocido #n]` corresponde a un Bug ya registrado: se reporta, pero no deja la ejecución en rojo.
- Cualquier otra validación fallida es una **falla** y deja la ejecución en rojo.

Cuando el backend corrija un hallazgo, su caso pasa solo a ✅ Pasa, sin cambiar la prueba.

### Cuentas de prueba

Las credenciales están en los secrets del repositorio `SISTEMA_ESTUDIANTE_CREDENCIAL`, `SISTEMA_ESTUDIANTE_CONTRASENA`, `SISTEMA_VISITANTE_CREDENCIAL` y `SISTEMA_VISITANTE_CONTRASENA`. El pipeline solo publica el reporte de casos: el reporte HTML y el JSON de Newman no se publican porque incluyen los cuerpos de las peticiones con las contraseñas.

### Resultados

[Ejecución 44472324123](https://github.com/YenniferM098/tiozihuatl-mobile/actions/runs/44472324123):

| Prueba | Pasan | Hallazgos | Fallas |
|---|---|---|---|
| Funcional | 17 de 17 | 0 | 0 |
| Seguridad | 9 de 12 | 3 (#197, #216 y #217) | 0 |

Los hallazgos están descritos en [Seguridad](seguridad.md#7-pruebas-de-seguridad-del-sistema).

## Caja blanca y caja negra

- **Caja blanca:** las pruebas unitarias revisan el código por dentro: repositorios, ViewModels, servicios, guards e interceptor, con dobles de prueba para la API. La explicación está en [Arquitectura](arquitectura.md#pruebas-de-caja-blanca).
- **Caja negra:** las pruebas de aceptación revisan la app desde fuera, como la usa una persona: se instala la APK, se siguen los casos de cada historia y se compara el resultado con el esperado, sin ver el código.

## Evidencias en Google Drive

Todas las evidencias están en la carpeta **[PRUEBAS](https://drive.google.com/drive/folders/138QQ9or_R3aLrKSQNWKsSBv8r74ihYxt)**:

- Una carpeta por historia de usuario.
- Dentro de cada historia, una carpeta por cada una de las 7 pruebas.
- La carpeta de aceptación tiene las capturas de cada caso ejecutado en el celular.

## Estado por historia

| Historia | Módulo | Versión | Estado de las pruebas |
|---|---|---|---|
| HU-01 Registro de visitante | Autenticación | 0.1.0 | 7 de 7 cerradas |
| HU-02 Inicio de sesión | Autenticación | 0.1.0 | 7 de 7 cerradas |
| HU-04 Consulta de Biblioteca Digital | Biblioteca Digital | 0.2.0 | 7 de 7 cerradas |
| HU-05 Lectura de libros digitales | Biblioteca Digital | 0.3.0 | 7 de 7 cerradas |
| HU-06 Materiales Complementarios | Materiales Complementarios | 0.4.0 | 7 de 7 cerradas |
| HU-03 Gestión del perfil | Perfil | 0.5.0 | 7 de 7 cerradas |
| HU-07 Consulta de Revistas Digitales | Revistas Digitales | 0.6.0 | 7 de 7 cerradas |
| HU-08 Lectura de Revistas Digitales | Revistas Digitales | 0.6.0 | 7 de 7 cerradas |

Pruebas del sistema completo: TEST-F09 pruebas funcionales integrales (#59) y TEST-S06 pruebas generales de seguridad (#60), cerradas en la versión 0.9.0. Los Bugs que siguen abiertos (#197, #216 y #217) se corrigen en el backend y están programados para la versión 1.0.0.

La etiqueta `QA-SISTEMA` agrupa los issues que vienen de las pruebas de sistema.
