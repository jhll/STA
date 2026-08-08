# Instrucciones para Actualización de Base de Datos (Trayectoria por Periodo)

Para activar el soporte completo de trayectoria por periodo del ciclo escolar (asignación de docentes:grupos:materias, estudiantes:grupos y tutores:estudiantes por periodo sin borrar datos), ejecuta el siguiente script SQL en tu proyecto Supabase.

## Pasos para ejecutar en Supabase:
1. Ve al Panel de Control de Supabase -> **SQL Editor**.
2. Crea una nueva consulta (**New Query**).
3. Copia y pega el contenido del archivo `schema_updates_periodos.sql`.
4. Haz clic en **Run** para ejecutar la consulta.

## Contenido de `schema_updates_periodos.sql`:

```sql
-- STA-FCQB: Script de actualización para Trayectoria Escolar por Periodo del Ciclo Escolar
-- IMPORTANTE: Este script NO elimina ni destruye datos existentes. Usa sentencias seguras.

-- 1. Asegurar la columna ciclo_id en la tabla 'grupos' (Docentes:Grupos:Materias por periodo)
ALTER TABLE grupos 
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

-- 2. Asegurar columnas ciclo_id y estudiante_id en la tabla 'tutorias' (Tutores:Estudiantes por periodo)
ALTER TABLE tutorias 
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

ALTER TABLE tutorias 
ADD COLUMN IF NOT EXISTS estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE SET NULL;

ALTER TABLE tutorias 
ALTER COLUMN nombre_grupo DROP NOT NULL;

-- 3. Asegurar columna ciclo_id en la tabla 'estudiantes'
ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

-- 4. Crear la tabla 'historial_estudiantes_ciclo' para almacenar la trayectoria del alumno periodo a periodo
CREATE TABLE IF NOT EXISTS historial_estudiantes_ciclo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE CASCADE,
    grupo TEXT NOT NULL,
    carrera TEXT NOT NULL,
    semestre INTEGER NOT NULL,
    turno TEXT,
    promedio_acumulado DECIMAL(5,2) DEFAULT 0.0,
    porcentaje_asistencia INTEGER DEFAULT 100,
    nivel_riesgo TEXT DEFAULT 'LOW',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_estudiante_ciclo UNIQUE (estudiante_id, ciclo_id)
);

-- 5. Asegurar columna ciclo_id en actividades e intervenciones
ALTER TABLE actividades 
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

ALTER TABLE intervenciones 
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

-- 6. Índices para consultas rápidas por ciclo escolar y trayectoria
CREATE INDEX IF NOT EXISTS idx_grupos_ciclo_id ON grupos(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_tutorias_ciclo_tutor ON tutorias(ciclo_id, tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutorias_estudiante ON tutorias(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_historial_est_ciclo ON historial_estudiantes_ciclo(ciclo_id, estudiante_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_ciclo ON estudiantes(ciclo_id);

-- 7. Notificar recarga de esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
```
