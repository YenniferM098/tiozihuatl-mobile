# Sistema Integral Tiozihuatl Mobile

## Objetivo
Proporcionar acceso desde dispositivos móviles a los principales servicios académicos digitales del Instituto de Estudios Superiores Tiozihuatl:

## Módulos principales
- Autenticación y control de acceso
- Perfil de usuario
- Biblioteca Digital
- Materiales Complementarios
- Revistas Digitales

## Usuarios
- Estudiante
- Docente
- Visitante

## Tecnologías
- Ionic
- Angular
- TypeScript
- Capacitor
- Node.js y npm
- API REST

## Metodología y organización
El desarrollo utiliza:
- Mobile-D como metodología de desarrollo móvil.
- Kanban para el seguimiento de actividades.
- GitHub Projects para la planeación.
- GitFlow para la gestión de ramas.

## Estrategia de ramas

- `main`: código estable.
- `develop`: integración de funcionalidades.
- `feature/*`: desarrollo de funcionalidades o cambios específicos.

Los cambios se integrarán mediante Pull Requests, evitando trabajar directamente sobre `main`.

```bash
npm ci