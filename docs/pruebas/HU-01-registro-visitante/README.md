# Pruebas — HU-01 Registro de visitante

Evidencias de las tareas de prueba de la historia de usuario **HU-01 Registro de visitante** (#25).

| Tarea | Issue | Evidencia |
|---|---|---|
| T-05 Realizar pruebas del registro | #37 | [T-05-pruebas-registro.md](T-05-pruebas-registro.md) |
| TEST-F01 Pruebas funcionales del registro de visitante | #45 | [TEST-F01-pruebas-funcionales.md](TEST-F01-pruebas-funcionales.md) |
| Ejecutar pruebas unitarias de HU-01 | #62 | [pruebas-unitarias.txt](pruebas-unitarias.txt) |
| Realizar análisis de código estático de HU-01 | #64 | [analisis-estatico.txt](analisis-estatico.txt) |

Las capturas de pantalla se guardan en [`evidencias/`](evidencias/).

## Cómo volver a ejecutarlas

```bash
npm ci
npx ng test --watch=false     # pruebas unitarias (Vitest)
npx ng lint                   # análisis estático (ESLint + reglas de Angular)
```
