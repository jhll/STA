# Instrucciones para Actualización de Base de Datos

Para activar la funcionalidad de asignación de tutores por estudiante, es necesario ejecutar el siguiente script SQL en tu proyecto Supabase.

1. Ve al Panel de Control de Supabase -> SQL Editor.
2. Crea una nueva query.
3. Copia y pega el contenido del archivo `schema_updates.sql`.
4. Ejecuta la query.

## Contenido de `schema_updates.sql`:

```sql
-- Agrega la columna estudiante_id a la tabla tutorias
ALTER TABLE tutorias 
ADD COLUMN IF NOT EXISTS estudiante_id TEXT REFERENCES estudiantes(id);

-- Hace opcional el nombre_grupo (para compatibilidad con asignaciones anteriores)
ALTER TABLE tutorias 
ALTER COLUMN nombre_grupo DROP NOT NULL;

-- Optimización de consultas
CREATE INDEX IF NOT EXISTS idx_tutorias_estudiante_id ON tutorias(estudiante_id);
```

Una vez ejecutado, la aplicación permitirá asignar tutores a estudiantes individuales utilizando los nuevos filtros.
