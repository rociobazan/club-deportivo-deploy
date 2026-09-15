# CONSIGNA DE EVALUACIÓN

## TRABAJO PRÁCTICO GRUPAL

# Desarrollo de Sistema de Reservas con OpenSpec y CI/CD

**Modalidad:** Trabajo Grupal (Equipo)  
**Enfoque:** API-First & Integración Continua  

**Herramientas:** OpenSpec, Git, GitHub Actions  
**Evaluación:** Especificación, Commits, PRs & Workflows

---

## OBJETIVO

Diseñar e implementar en equipo un producto mínimo viable (MVP) para una plataforma de reservas.

El proyecto debe priorizar el diseño de arquitectura enfocado en APIs mediante OpenSpec, aplicando control de versiones colaborativo y automatización de despliegue/validación.

---

## DOMINIOS DISPONIBLES

**Seleccionar uno por equipo.**

### 1. Restaurante

- Gestión de reservas con diferenciación de zonas (VIP y Standard).
- Control de aforo y capacidad.
- Gestión de horarios y turnos de atención.

### 2. Hotel

- Reserva de habitaciones según tipología (Premium y Standard).
- Cálculo automático de noches.
- Inclusión y cotización de servicios adicionales.

### 3. Club Deportivo

- Reserva de canchas por disciplina (Tenis, Fútbol, Pádel).
- Selección de turnos y franjas horarias.
- Alquiler de equipamiento deportivo.

---

# REQUISITOS TÉCNICOS

## 1. Especificación (OpenSpec)

Definir el contrato de la API utilizando OpenSpec desde el inicio del proyecto.

Debe incluir esquemas de datos y endpoints para:

- Disponibilidad.
- Creación de reservas.
- Consulta de reservas.
- Cancelación de reservas.

---

## 2. Repositorio Colaborativo

Crear un repositorio público en GitHub o privado invitando a la docente como colaboradora.

Se evaluará:

- El historial de commits.
- La distribución equitativa del trabajo.

---

## 3. Flujo de Trabajo Git

La rama `main` estará protegida.

Para cada nueva especificación o funcionalidad se debe crear una rama independiente.

Ejemplos:

```text
feature/spec-reserva-vip
feature/cancelacion-turnos
```

Toda integración a `main` requiere un Pull Request (PR) con al menos una revisión aprobada por un compañero de equipo.

---

# INTEGRACIÓN CONTINUA (CI/CD CON GITHUB ACTIONS)

Configurar un workflow en:

```text
.github/workflows/ci.yml
```

El workflow debe ejecutarse automáticamente en:

- Cada Pull Request (PR).
- Cada commit hacia `main`.

El workflow debe realizar:

- Validación / linter de los archivos de OpenSpec.
- Ejecución de pruebas unitarias o de integración del código base.
- Bloqueo automático del merge si las pruebas o la validación del OpenSpec fallan.

---

# ENTREGABLES

## 1. URL del repositorio

El repositorio debe contener un archivo `README.md` que explique:

- La arquitectura.
- Las instrucciones de ejecución.

## 2. Especificaciones de OpenSpec

Las especificaciones deben estar completas y ser válidas.

## 3. Historial de Integración

Debe incluir:

- Historial de Pull Requests cerrados.
- Ejecuciones verdes/exitosas en GitHub Actions.

---

**Trabajo Práctico Grupal — OpenSpec & CI/CD**