-- Add estudiante_id column to tutorias table to allow individual student assignment
-- Using TEXT type to match estudiantes.id (matricula)
ALTER TABLE tutorias 
ADD COLUMN IF NOT EXISTS estudiante_id TEXT REFERENCES estudiantes(id);

-- Make nombre_grupo optional since assignments will now be per student
ALTER TABLE tutorias 
ALTER COLUMN nombre_grupo DROP NOT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_tutorias_estudiante_id ON tutorias(estudiante_id);
