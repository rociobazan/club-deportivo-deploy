# Proposal

## Why

RF-00 es el camino crítico del hito 1: 1.3 (crear reserva) y 1.4 (mis reservas y mails) no pueden protegerse hasta que existan los guards, y hoy `apps/api/src` no tiene ningún módulo de negocio. La capacidad `autenticacion` ya está especificada de punta a punta (siete requisitos con sus escenarios), así que este cambio **implementa contra esa spec, no la reescribe**; lo único que falta especificar es lo que pasa del lado del sitio, que ninguna capacidad cubre: cómo se entra, cómo se crea la cuenta, qué pasa al pedir una ruta privada sin sesión y cómo se sale.

## What Changes

- **API (`apps/api`)**: módulo `auth` con `POST /auth/registro`, `POST /auth/login` y `GET /auth/perfil` según `contratos/openapi.yaml`; guard de JWT y guard de roles reutilizables por el resto de las features (con un marcador para endpoints públicos); validación global de entrada que rechaza campos no declarados con 400 `SOLICITUD_INVALIDA`; filtro global que emite **todo** error con el schema `Error` del contrato (incluidos 401 `NO_AUTENTICADO` y 403 `SIN_PERMISOS`, en lugar del formato por defecto del framework); acceso a datos por Prisma como módulo inyectable; prefijo `/api/v1` y CORS restringido a `FRONTEND_URL`.
- **Front (`apps/web`)**: pantallas `/ingresar` y `/registro` con la identidad del prototipo; la sesión se guarda en una cookie `httpOnly` que el navegador no puede leer; cierre de sesión; las rutas privadas redirigen a `/ingresar` cuando no hay sesión; el header pasa a recibir al usuario, con lo que se cumple el escenario "Usuario con sesión" de `institucional`, que hoy no se puede cumplir.
- **Configuración**: `JWT_SECRET` y `JWT_EXPIRES_IN` pasan a ser obligatorios para arrancar la API (ya figuran en `.env.example`) y se agregan al job `api` del CI.
- **Dependencias nuevas**: `@nestjs/jwt`, `class-validator` y `class-transformer`. `bcrypt` ya estaba.
- No hay cambios de esquema de base de datos ni de contrato. No es un cambio **BREAKING**: hoy no existe ningún consumidor.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `autenticacion`: se **agregan** requisitos sobre el comportamiento del sitio, que hoy no está especificado en ninguna capacidad: ingreso y registro desde el sitio, sesión en cookie inaccesible desde JavaScript, redirección de rutas privadas sin sesión y cierre de sesión. Los siete requisitos existentes (registro, contraseñas protegidas, JWT, perfil, endpoints protegidos, autorización por rol y formato de errores) **no cambian**: este cambio los implementa tal cual están.

## Impact

- `apps/api/src`: `main.ts` (prefijo, CORS, pipe y filtro globales), `app.module.ts`, y los módulos nuevos `prisma/`, `auth/` y `common/` (filtro, decoradores, guards). `apps/api/test`: e2e por escenario de la spec contra la base del CI.
- `apps/web`: `app/ingresar/`, `app/registro/`, `app/layout.tsx` (pasa el usuario al header), `proxy.ts` nuevo, `lib/sesion.ts` nuevo. `components/layout/site-header.tsx` ya tiene el prop `usuario` esperando.
- `.github/workflows/ci.yml`: variables `JWT_SECRET` y `JWT_EXPIRES_IN` en el job `api`.
- `apps/api/package.json`: tres dependencias nuevas.
- `docs/memoria-proyecto.md` y `docs/estado-del-proyecto.md`: decisión y avance, en el mismo PR.
- **Fuera de alcance**: login con Google (ADR `docs/adr/0001-login-con-google.md`, entra después), edición de perfil, recuperación de contraseña, y los endpoints de las otras capacidades: solo se dejan los guards listos para que 1.3 y 1.4 los usen.
