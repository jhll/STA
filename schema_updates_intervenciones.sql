-- ==============================================================================
-- ACTUALIZACIÓN DE ESQUEMA: TABLA INTERVENCIONES (STA - FCQB)
-- Agrega columnas para registrar automáticamente el nombre y el ID del docente
-- o tutor que genera cada intervención en la bitácora del estudiante.
-- ==============================================================================

-- 1. Agregar columna nombre_docente para registrar el nombre completo del autor
ALTER TABLE intervenciones 
ADD COLUMN IF NOT EXISTS nombre_docente TEXT;

-- 2. Agregar columna docente_id como clave foránea opcional referenciando a docentes
ALTER TABLE intervenciones 
ADD COLUMN IF NOT EXISTS docente_id UUID REFERENCES docentes(id) ON DELETE SET NULL;

-- 3. Crear índices para optimizar búsquedas por docente y estudiante
CREATE INDEX IF NOT EXISTS idx_intervenciones_docente_id ON intervenciones(docente_id);
CREATE INDEX IF NOT EXISTS idx_intervenciones_estudiante_id ON intervenciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_intervenciones_ciclo_id ON intervenciones(ciclo_id);

-- 4. Comentarios descriptivos
COMMENT ON COLUMN intervenciones.nombre_docente IS 'Nombre del docente o tutor que registró la intervención';
COMMENT ON COLUMN intervenciones.docente_id IS 'ID del docente o tutor responsable en la tabla docentes';
