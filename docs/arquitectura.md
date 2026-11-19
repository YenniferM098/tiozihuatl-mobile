# Arquitectura de Tiozihuatl Mobile

La app está construida con **Ionic + Angular + Capacitor** y sigue el patrón **MVVM** organizado en capas al estilo **Clean Architecture**: cada capa depende solo de la capa interior y se comunica con ella por contratos (interfaces), no por implementaciones.

## Capas

```mermaid
flowchart TD
  subgraph Presentación
    V["Vista<br/>*.page.html + *.page.ts"]
    VM["ViewModel<br/>*.view-model.ts"]
  end
  subgraph Aplicación
    S["Servicios / casos de uso<br/>core/services"]
    G["Guards e interceptor<br/>core/guards, core/interceptors"]
  end
  subgraph Dominio
    M["Modelos<br/>core/models"]
    R["Contratos de repositorio<br/>domain/repositories"]
  end
  subgraph Datos
    H["Repositorios HTTP<br/>data/repositories"]
  end
  API[("API REST<br/>JWT Bearer")]

  V -->|enlaza estado y acciones| VM
  VM -->|invoca| S
  S -->|depende de la interfaz| R
  H -.->|implementa| R
  H -->|HttpClient| API
  G --> S
  S --> M
  R --> M
```

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Presentación: Vista | `src/app/pages/**/*.page.html`, `*.page.ts` | Plantilla y enlace con el ViewModel. No contiene reglas de negocio ni llamadas HTTP. |
| Presentación: ViewModel | `src/app/pages/**/*.view-model.ts` | Estado de la pantalla en *signals*, validaciones del formulario y acciones (enviar, paginar, reintentar). |
| Aplicación | `src/app/core/services`, `core/guards`, `core/interceptors` | Casos de uso: iniciar sesión, renovar el token, registrar visitante, recuperar contraseña, consultar los catálogos con control de rol, gestionar el perfil, descargar archivos y recordar la guía de primer uso. Traduce errores técnicos a mensajes para el usuario. |
| Dominio | `src/app/core/models`, `src/app/domain/repositories` | Modelos de datos y contratos `AuthRepository`, `LibraryRepository`, `MaterialsRepository`, `MagazinesRepository` y `ProfileRepository`. No conoce Angular HTTP. |
| Datos | `src/app/data/repositories`, `src/app/data/storage` | `HttpAuthRepository`, `HttpLibraryRepository`, `HttpMaterialsRepository`, `HttpMagazinesRepository` y `HttpProfileRepository` implementan los contratos sobre la API REST; `data/storage` guarda la sesión cifrada. |

### Cómo se aplica MVVM

- **Model:** modelos de `core/models` y los servicios que obtienen los datos a través de los repositorios.
- **View:** la plantilla HTML y la clase de la página, que solo reexpone lo que tiene el ViewModel.
- **ViewModel:** los archivos `*.view-model.ts` de Login, Biblioteca, Materiales, Perfil, Revistas y el detalle de una revista concentran el estado y la lógica de la pantalla. Se pueden probar sin montar la vista.

Las demás pantallas siguen la misma separación dentro de su clase: la plantilla solo enlaza *signals* y métodos, y la lógica de datos vive en los servicios.

### Guía de primer uso

La guía (MEJ-01) es un componente de presentación compartido, `pages/tabs/guia/guia.component.ts`, que resalta un elemento de la pantalla y muestra un globo con su mensaje. Los pasos de cada pantalla están en `pages/tabs/guia/pasos.ts` y señalan los elementos por su atributo `data-guia`, así que los módulos no conocen la guía. `OnboardingService` recuerda en el dispositivo qué guías ya se mostraron.

## Patrones de diseño

| Patrón | Dónde | Para qué |
|---|---|---|
| **MVVM** | `*.page.ts` + `*.view-model.ts` | Separar la vista del estado y la lógica de presentación. |
| **Repository** | `domain/repositories/*.repository.ts` (contrato) y `data/repositories/http-*.repository.ts` (implementación) | Los servicios no dependen de `HttpClient`; el origen de los datos se puede cambiar o simular en pruebas. |
| **Factory** | Un `InjectionToken` con `factory` por repositorio (`AUTH_REPOSITORY`, `LIBRARY_REPOSITORY`, `MATERIALS_REPOSITORY`, `MAGAZINES_REPOSITORY`, `PROFILE_REPOSITORY`), además de `SESSION_STORE` y `PDF_READER_SOURCE` | Decide qué implementación se entrega a quien la pide; por ejemplo, el almacén cifrado en Android y `localStorage` en el navegador, o el PDF de un libro, un material o una revista para el mismo lector. |
| **Singleton** | Servicios y repositorios con `providedIn: 'root'` | Una sola instancia compartida: sesión, autenticación y caché del catálogo. |
| **Observer** | RxJS (`Observable`, `shareReplay`) y *signals* de Angular | La vista se actualiza sola cuando cambia el estado; varias peticiones de renovación comparten una sola respuesta. |
| **Interceptor (Chain of Responsibility)** | `core/interceptors/auth.interceptor.ts` | Agrega el token `Bearer` a cada petición a la API. |
| **Guard** | `core/guards/auth.guard.ts` | Protege rutas por sesión y por rol. |

## Pruebas de caja blanca

Las pruebas unitarias y de integración están en archivos `*.spec.ts` **junto al archivo que prueban**. Es la convención oficial de Angular: cada prueba importa su archivo con una ruta corta, y si el archivo se mueve, la prueba se mueve con él. Por eso no hay una carpeta `/test` para estas pruebas.

| Tipo | Dónde | Herramienta |
|---|---|---|
| Unitarias (servicios, repositorios, ViewModels, guards, interceptor, validadores) | `src/app/**/*.spec.ts` | Vitest |
| Integración de componentes (página + servicio + router, con la API simulada por `HttpTestingController`) | `src/app/pages/**/*.page.spec.ts`, `src/app/app.routes.spec.ts` | Vitest + TestBed |
| Integración con la API real | `tests/postman/` | Newman |

La cobertura se mide sobre las rutas de `angular.json` → `test.options.coverageInclude`, con un mínimo del 70 % en sentencias, ramas, funciones y líneas. Si baja de ese mínimo, el job **Pruebas unitarias (Vitest)** del pipeline falla. El reporte HTML queda como artefacto `reporte-cobertura` en cada ejecución de `pruebas.yml`.

Para correrlas localmente:

```
npx ng test --configuration ci
```
