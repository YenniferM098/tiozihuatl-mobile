# Pruebas

Cada historia de usuario pasa por **7 pruebas**. Cada una tiene un issue en el tablero con su etiqueta `QA-*`, y sus evidencias se guardan en Google Drive. Las pruebas automáticas corren en GitHub Actions; las manuales las ejecuta el equipo con la APK en un celular.

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
| `integracion` | Ejecuta `tests/postman/tiozihuatl-mobile.postman_collection.json` con un archivo de datos por historia (`tests/postman/datos/hu01-registro.json`, `hu02-login.json`, `hu04-biblioteca.json`, `hu05-lector-libros.json`). Guarda `reporte-integracion` |
| `compilacion` | `ng build` y guarda la carpeta `www` |
| `apk-aceptacion` | Solo en `develop`: genera la APK de prueba y la envía a los testers por Firebase App Distribution |
| `rendimiento-lighthouse` | Mide `/register` y `/login` con Lighthouse CI (`lighthouserc.json`): rendimiento mínimo 0.7–0.8, accesibilidad 0.8, primer contenido en menos de 3 s e interactiva en menos de 5 s. Guarda `reporte-rendimiento` |

### Pipeline de seguridad (`.github/workflows/seguridad.yml`)

Corre en cada push, en los Pull Request hacia `develop` y `main`, y cada lunes.

| Job | Qué hace |
|---|---|
| `sast-codeql` | Análisis estático de seguridad con CodeQL |
| `sast-semgrep` | Análisis estático de seguridad con Semgrep. Guarda `reporte-semgrep` |
| `dependencias` | `npm audit`; falla si hay vulnerabilidades críticas en dependencias de producción. Guarda `reporte-dependencias` |
| `analisis-apk-mobsf` | En `develop` y en Pull Requests: compila la APK release con R8 y la analiza con MobSF. Guarda `reporte-mobsf` y `apk-release-prueba` |

El detalle de los controles está en [Seguridad](seguridad.md).

### Publicación (`.github/workflows/publicacion.yml`)

Corre al crear un tag `vX.Y.Z`.

| Job | Qué hace |
|---|---|
| `pruebas-api-produccion` | Pruebas de la API de producción con Newman (`scripts/liberacion/probar-api.sh`) |
| `generar-aab` | Revisa que la versión de `package.json` coincida con el tag, compila y firma el AAB, y guarda `mapping.txt` |
| `verificar-aab` | Verifica con bundletool la firma, el paquete, la versión y los permisos (`scripts/liberacion/verificar-aab.sh`) |
| `desplegar-play` | Sube el AAB a la prueba cerrada de Google Play |

## Caja blanca y caja negra

- **Caja blanca:** las pruebas unitarias revisan el código por dentro: repositorios, ViewModels, servicios, guards e interceptor, con dobles de prueba para la API. La explicación está en [Arquitectura](arquitectura.md#pruebas-de-caja-blanca).
- **Caja negra:** las pruebas de aceptación revisan la app desde fuera, como la usa una persona: se instala la APK, se siguen los casos de cada historia y se compara el resultado con el esperado, sin ver el código.

## Evidencias en Google Drive

Todas las evidencias están en la carpeta **[PRUEBAS](https://drive.google.com/drive/folders/138QQ9or_R3aLrKSQNWKsSBv8r74ihYxt)**:

- Una carpeta por historia de usuario.
- Dentro de cada historia, una carpeta por cada una de las 7 pruebas.
- La carpeta de aceptación tiene las capturas de cada caso ejecutado en el celular.

## Estado por historia

| Historia | Módulo | Iteración | Estado de las pruebas |
|---|---|---|---|
| HU-01 Registro de visitante | Autenticación | 3 | 7 de 7 cerradas |
| HU-02 Inicio de sesión | Autenticación | 3 | 6 de 7; falta esfuerzo (#78) |
| HU-04 Consulta de Biblioteca Digital | Biblioteca Digital | 5 | Falta aceptación (#90) |
| HU-05 Lectura de libros digitales | Biblioteca Digital | 6 | Falta aceptación (#97) |
| HU-06 Materiales Complementarios | Materiales Complementarios | 7 | Pendiente (#100–#106) |
| HU-03 Gestión del perfil | Perfil | 8 | Pendiente (#79–#85) |
| HU-07 Consulta de Revistas Digitales | Revistas Digitales | 8 | Pendiente (#107–#113) |
| HU-08 Lectura de Revistas Digitales | Revistas Digitales | 8 | Pendiente (#114–#120) |

Pruebas del sistema completo, en las iteraciones 9 y 10: TEST-F09 pruebas funcionales integrales (#59) y TEST-S06 pruebas generales de seguridad (#60).
