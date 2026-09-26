# Spec Delta

## ADDED Requirements

### Requirement: Página Canchas y precios
El sitio MUST ofrecer en `/canchas` una página pública que muestre, agrupadas por disciplina activa, las canchas activas con su superficie, si es techada, su `precioPorTurno` y la duración del turno de la disciplina, y el equipamiento activo de cada disciplina con su `stockTotal` y su precio por turno. La página MUST explicar que el precio es por turno y no por jugador, y que el stock mostrado es el total del club y la disponibilidad real se calcula por turno. Desde cada disciplina MUST poder ir a la consulta de disponibilidad ya filtrada. Si la API no responde, la página MUST mostrar un aviso con la opción de reintentar.

#### Scenario: Catálogo completo
- **WHEN** un visitante entra a `/canchas` con los datos de prueba cargados
- **THEN** ve Tenis, Pádel y Fútbol 5, cada una con sus canchas, precios y turnos de 60, 90 y 60 minutos, y su equipamiento con stock total

#### Scenario: Cancha o equipamiento dados de baja
- **WHEN** una cancha o un ítem de equipamiento están inactivos
- **THEN** no aparecen en la página

#### Scenario: Acceso a la disponibilidad
- **WHEN** el visitante elige "Ver disponibilidad" en la sección de Pádel
- **THEN** llega a `/disponibilidad?disciplinaId=<id de Pádel>`

#### Scenario: API sin respuesta
- **WHEN** la API no responde en 2 segundos
- **THEN** la página muestra un aviso con un botón para reintentar, y el header y el pie siguen visibles
