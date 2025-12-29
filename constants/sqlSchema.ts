
export const SQL_SCHEMA = `-- STA-FCQB: ESQUEMA INTEGRAL V5.0 - MÉTRICAS EN TIEMPO REAL

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Asegurar Tabla de Estudiantes con Columnas de Seguimiento
CREATE TABLE IF NOT EXISTS estudiantes (
    id TEXT PRIMARY KEY, -- Matrícula
    nombre TEXT NOT NULL,
    carrera TEXT NOT NULL,
    semestre INTEGER NOT NULL,
    grupo TEXT NOT NULL,
    turno TEXT NOT NULL,
    promedio_acumulado DECIMAL(5,2) DEFAULT 0.0,
    porcentaje_asistencia INTEGER DEFAULT 100,
    nivel_riesgo TEXT DEFAULT 'LOW',
    factores_personales TEXT[] DEFAULT '{}',
    factores_academicos TEXT[] DEFAULT '{}',
    factores_institucionales TEXT[] DEFAULT '{}',
    ciclo_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    fecha DATE DEFAULT CURRENT_DATE,
    presente BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(estudiante_id, grupo_id, fecha)
);

-- 4. Tabla de Actividades y Calificaciones (Consolidación)
CREATE TABLE IF NOT EXISTS actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    docente_id UUID NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT NOT NULL,
    unidad INTEGER DEFAULT 1,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    puntos_max INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actividad_id UUID REFERENCES actividades(id) ON DELETE CASCADE,
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    calificacion DECIMAL(5,2) DEFAULT 0,
    comentarios TEXT,
    entregado BOOLEAN DEFAULT false,
    fecha_evaluacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(actividad_id, estudiante_id)
);

-- 5. Permisos Globales (Desarrollo)
ALTER TABLE estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones DISABLE ROW LEVEL SECURITY;

-- 6. Recarga de esquema
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE estudiantes IS 'Maestro de alumnos con métricas sincronizadas v5.0';
`;
