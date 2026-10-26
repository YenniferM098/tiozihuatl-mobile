# Sistema Integral Tiozihuatl Mobile

Aplicación móvil del Instituto de Estudios Superiores Tiozihuatl para que estudiantes, docentes y visitantes accedan desde su celular a los servicios académicos digitales: autenticación, perfil, Biblioteca Digital, Materiales Complementarios y Revistas Digitales.

- **Paquete:** `com.tiozihuatl.app` (Android 7.0 o superior, API 24–36)
- **Distribución:** Google Play, pista de prueba cerrada
- **Planeación:** [GitHub Projects · Sistema Integral Tiozihuatl Mobile](https://github.com/users/YenniferM098/projects/1/views/1)
- **Evidencias de pruebas:** [carpeta PRUEBAS en Google Drive](https://drive.google.com/drive/folders/138QQ9or_R3aLrKSQNWKsSBv8r74ihYxt)

## Estado de los módulos

| Módulo | Historia | Estado |
|---|---|---|
| Registro de visitante | HU-01 | Liberado en 0.1.0 |
| Inicio de sesión | HU-02 | Liberado en 0.1.0 |
| Biblioteca Digital | HU-04 | Desarrollado, se libera en 0.2.0 |
| Lectura de libros digitales | HU-05 | Desarrollado, se libera en 0.3.0 |
| Materiales Complementarios | HU-06 | Pendiente (iteración 7) |
| Gestión del perfil y derechos ARCO | HU-03 | Desarrollado, se integra en la iteración 8 ([detalle](docs/perfil-arco.md)) |
| Revistas Digitales | HU-07 y HU-08 | Pendiente (iteración 8) |

## Usuarios

| Rol | Acceso |
|---|---|
| Estudiante | Biblioteca, lector, materiales y revistas |
| Docente | Biblioteca, lector, materiales y revistas |
| Visitante | Se registra desde la app; consulta el catálogo de revistas |

## Tecnologías

- Ionic 9, Angular 22 y TypeScript
- Capacitor 8 para Android
- API REST institucional con autenticación JWT
- Vitest, ESLint, Newman (Postman) y Lighthouse CI para las pruebas
- GitHub Actions para integración y despliegue continuos

## Documentación

| Documento | Contenido |
|---|---|
| [Metodología y planeación](docs/metodologia-y-planeacion.md) | Mobile-D, tablero Kanban, iteraciones, versiones y flujo de trabajo con GitFlow |
| [Arquitectura](docs/arquitectura.md) | Capas MVVM + Clean Architecture, patrones de diseño y pruebas de caja blanca |
| [Pruebas](docs/pruebas.md) | Las 7 pruebas por historia, pipelines, caja blanca y caja negra, y evidencias de aceptación |
| [Seguridad](docs/seguridad.md) | JWT, refresco por 401, almacenamiento cifrado, certificate pinning, R8 y permisos |
| [Perfil y derechos ARCO](docs/perfil-arco.md) | Gestión del perfil, desarrollada y programada para la iteración 8 |
| [Publicación en Google Play](docs/publicacion-play.md) | Firma, AAB, prueba cerrada y paso a producción |

## Ejecutar el proyecto

Requisitos: Node.js 24, npm y, para Android, JDK 21 y Android Studio.

```bash
npm ci
# La URL de la API se lee de la variable API_URL
API_URL=https://<servidor>/api npm start      # servidor de desarrollo en el navegador
API_URL=https://<servidor>/api npm test       # pruebas unitarias con cobertura
npm run lint                                  # análisis estático
API_URL=https://<servidor>/api npm run build  # compilación web
npx cap sync android                          # copia la compilación al proyecto Android
npx cap open android                          # abre Android Studio para ejecutar en un celular
```

## Estrategia de ramas

- `main`: código liberado. Cada versión lleva un tag `vX.Y.Z`.
- `develop`: integración de funcionalidades.
- `feature/*`: una historia o un cambio específico; se integra a `develop` por Pull Request con los pipelines en verde.
- `release/*`: preparación de una versión; se integra a `main` y de vuelta a `develop`.

Los mensajes de commit siguen Conventional Commits (`feat`, `fix`, `docs`, `ci`, `test`, `refactor`, `chore`).
