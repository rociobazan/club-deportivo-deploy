/**
 * Largos máximos de las credenciales, compartidos por los DTOs que reciben un
 * mail o una contraseña (decisión 36). El contrato no los declara, así que
 * viven acá y no en cada DTO.
 */

/** Más largo que cualquier mail real; corta un cuerpo gigante antes del `findUnique`. */
export const LARGO_MAXIMO_EMAIL = 120;

/** bcrypt usa solo los primeros 72 bytes: más allá, la contraseña no se compara. */
export const LARGO_MAXIMO_PASSWORD = 72;
