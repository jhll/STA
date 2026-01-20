
export const SQL_SCHEMA = `-- STA-FCQB: REINICIO MAESTRO DE BASE DE DATOS V7.3

-- 1. Limpieza de Tablas Existentes
DROP TABLE IF EXISTS asistencias CASCADE;
DROP TABLE IF EXISTS calificaciones CASCADE;
DROP TABLE IF EXISTS intervenciones CASCADE;
DROP TABLE IF EXISTS actividades CASCADE;
DROP TABLE IF EXISTS tutorias CASCADE;
DROP TABLE IF EXISTS estudiantes CASCADE;
DROP TABLE IF EXISTS grupos CASCADE;
DROP TABLE IF EXISTS materias CASCADE;
DROP TABLE IF EXISTS ciclos_escolares CASCADE;
DROP TABLE IF EXISTS docentes CASCADE;

-- 2. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Tabla de Docentes
CREATE TABLE docentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_empleado TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT[] NOT NULL DEFAULT '{DOCENTE}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tablas de Apoyo
CREATE TABLE ciclos_escolares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    es_activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE materias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL,
    carrera TEXT NOT NULL,
    semestre INTEGER NOT NULL,
    creditos INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_grupo TEXT NOT NULL,
    turno TEXT NOT NULL,
    materia_id UUID REFERENCES materias(id) ON DELETE CASCADE,
    docente_id UUID REFERENCES docentes(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Tutorías
CREATE TABLE tutorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_grupo TEXT NOT NULL,
    tutor_id UUID REFERENCES docentes(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_tutoria_grupo_ciclo UNIQUE(nombre_grupo, ciclo_id)
);

CREATE TABLE estudiantes (
    id TEXT PRIMARY KEY,
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
    ciclo_id UUID REFERENCES ciclos_escolares(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    docente_id UUID REFERENCES docentes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo TEXT NOT NULL,
    unidad INTEGER NOT NULL,
    fecha_entrega TIMESTAMP WITH TIME ZONE NOT NULL,
    puntos_max INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE calificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actividad_id UUID REFERENCES actividades(id) ON DELETE CASCADE,
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    calificacion DECIMAL(4,2) NOT NULL,
    entregado BOOLEAN DEFAULT true,
    fecha_evaluacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(actividad_id, estudiante_id)
);

CREATE TABLE asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    presente BOOLEAN NOT NULL,
    UNIQUE(estudiante_id, grupo_id, fecha)
);

CREATE TABLE intervenciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    tipo_intervencion TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    notas_adicionales TEXT,
    ciclo_id UUID REFERENCES ciclos_escolares(id),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estatus TEXT DEFAULT 'COMPLETED'
);

-- 6. Seguridad (Desactivar RLS para desarrollo ágil)
ALTER TABLE docentes DISABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE grupos DISABLE ROW LEVEL SECURITY;
ALTER TABLE materias DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciclos_escolares DISABLE ROW LEVEL SECURITY;
ALTER TABLE actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE intervenciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE tutorias DISABLE ROW LEVEL SECURITY;

-- 7. Recargar Esquema
NOTIFY pgrst, 'reload schema';
`;
