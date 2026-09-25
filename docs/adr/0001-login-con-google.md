# ADR 0001 — Login con Google sin mover la sesión al front

**Fecha:** 2026-09-24
**Estado:** aceptada, pendiente de revisión del equipo
**Decide:** Jeremías (dueño del ítem 1.1)

## Contexto

Queremos ofrecer "Ingresar con Google" además del registro con email y contraseña.

La opción natural en Next es **Auth.js**, pero `arquitectura.md` §2 la rechaza de forma
explícita, y el motivo sigue siendo válido: si el login vive en el front, los endpoints de Nest
quedan sin descripción de seguridad en el `openapi.yaml` y **la API deja de defenderse sola**.
Un `curl` directo contra el backend saltearía la autenticación. Como el entregable que se evalúa
es el contrato, eso es caro.

Al mismo tiempo, RF-00 no pide Google: pide registro, login, JWT y guards de rol.

## Decisión

**El front obtiene el `id_token` de Google y se lo manda a la API; Nest lo verifica y emite su
propio JWT.** Nest sigue siendo el único emisor de tokens.

```
Navegador ──(Google OAuth)──► Google
    │  id_token
    ▼
Next ──► POST /auth/google { idToken } ──► Nest
                                            │ verifica la firma contra las claves de Google
                                            │ busca o crea el usuario por email
                                            ▼
Next ◄── { accessToken, usuario } ◄────── Nest   (el mismo JWT que /auth/login)
```

Se puede usar Auth.js **solo como cliente de OAuth**, para no escribir el baile con Google a
mano. Lo que no hace es emitir ni validar la sesión de la aplicación.

**Entra después de RF-00**, como cambio aparte. El ítem 1.1 es camino crítico —1.3 y 1.4
esperan por sus guards— así que no se le suma alcance.

## Alternativas consideradas

| Opción | Por qué no |
|---|---|
| **Auth.js dueño de la sesión** | Revierte §2. El contrato dejaría de describir cómo se protege la API, que es lo que se evalúa. |
| **OAuth entero en Nest** (redirect y callback en el back) | Igual de sólida, y no se descartó por mala: mueve más trabajo al back y obliga a manejar el `state` de OAuth y las URLs de retorno a mano. La híbrida deja esa parte en una librería del front. |
| **No hacer Google** | Es lo que pide la consigna, pero el equipo quiere la opción de ingresar más rápido. |

## Consecuencias

Cuando se implemente:

- **Migración**: `usuario.password_hash` pasa a ser nullable, porque una cuenta de Google no
  tiene contraseña, y se agrega de dónde viene la cuenta. Hay que revisar que ningún flujo
  asuma que siempre hay hash.
- **Contrato**: se suma `POST /auth/google` a `openapi.yaml` y se regeneran los tipos del front
  con `npm run generate:api-types`.
- **Spec**: RF-00 cambia, así que va por `/opsx:propose` y lo revisan los cuatro.
- **Entorno**: `GOOGLE_CLIENT_ID` y su secret entran en `.env.example` y en el job `api` del CI,
  en el mismo PR que los introduce.
- **Seguridad**: hay que verificar la firma del `id_token` contra las claves públicas de Google
  y chequear el `aud`. Nunca confiar en el email que manda el cliente sin validar el token.
- Una cuenta creada con contraseña y una de Google con el mismo email **son la misma persona**:
  se vinculan por email, no se duplican.

## Referencias

- `docs/arquitectura.md` §2, que esta decisión respeta y extiende.
- `docs/requisitos.md` RF-00.
