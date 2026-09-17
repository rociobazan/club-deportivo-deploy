-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'SOCIO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CANCELADA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CONFIRMACION', 'CANCELACION');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('ENVIADA', 'FALLIDA');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "apellido" VARCHAR(60) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(30),
    "rol" "Rol" NOT NULL DEFAULT 'SOCIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplina" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "duracion_turno_min" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancha" (
    "id" SERIAL NOT NULL,
    "disciplina_id" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "superficie" VARCHAR(30),
    "techada" BOOLEAN NOT NULL DEFAULT false,
    "precio_por_turno" DECIMAL(10,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cancha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipamiento" (
    "id" SERIAL NOT NULL,
    "disciplina_id" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "stock_total" INTEGER NOT NULL,
    "precio_por_turno" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "equipamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "cancha_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5) NOT NULL,
    "cantidad_jugadores" INTEGER,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "monto_cancha" DECIMAL(10,2) NOT NULL,
    "monto_equipamiento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monto_total" DECIMAL(10,2) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelada_en" TIMESTAMP(3),
    "cancelada_por" INTEGER,
    "motivo_cancelacion" VARCHAR(200),

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva_equipamiento" (
    "id" SERIAL NOT NULL,
    "reserva_id" INTEGER NOT NULL,
    "equipamiento_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "reserva_equipamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" SERIAL NOT NULL,
    "reserva_id" INTEGER NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "destinatario" VARCHAR(120) NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL,
    "proveedor_id" VARCHAR(80),
    "error" TEXT,
    "reenvio" BOOLEAN NOT NULL DEFAULT false,
    "enviada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_nombre_key" ON "disciplina"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_codigo_key" ON "reserva"("codigo");

-- CreateIndex
CREATE INDEX "ix_reserva_usuario_estado" ON "reserva"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "ix_reserva_fecha" ON "reserva"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "reserva_equipamiento_reserva_id_equipamiento_id_key" ON "reserva_equipamiento"("reserva_id", "equipamiento_id");

-- AddForeignKey
ALTER TABLE "cancha" ADD CONSTRAINT "cancha_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipamiento" ADD CONSTRAINT "equipamiento_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_cancelada_por_fkey" FOREIGN KEY ("cancelada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_cancha_id_fkey" FOREIGN KEY ("cancha_id") REFERENCES "cancha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_equipamiento" ADD CONSTRAINT "reserva_equipamiento_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva_equipamiento" ADD CONSTRAINT "reserva_equipamiento_equipamiento_id_fkey" FOREIGN KEY ("equipamiento_id") REFERENCES "equipamiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
