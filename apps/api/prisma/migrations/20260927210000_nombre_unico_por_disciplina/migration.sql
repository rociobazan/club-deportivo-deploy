-- CreateIndex
CREATE UNIQUE INDEX "cancha_disciplina_id_nombre_key" ON "cancha"("disciplina_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "equipamiento_disciplina_id_nombre_key" ON "equipamiento"("disciplina_id", "nombre");
