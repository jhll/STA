
export const SQL_SCHEMA = `-- STA-FCQB: ESQUEMA INTEGRAL V5.4 - NORMALIZACIÓN DE RELACIONES

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Ciclos Escolares
CREATE TABLE IF NOT EXISTS ciclos_escolares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    es_activo BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Materias (Base de la Malla Curricular)
CREATE TABLE IF NOT EXISTS materias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL,
    carrera TEXT NOT NULL, -- Ej: Ingeniería Química
    semestre INTEGER NOT NULL,
    creditos INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Docentes
CREATE TABLE IF NOT EXISTS docentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_empleado TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'DOCENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Grupos (Vínculo Docente-Materia-Ciclo)
-- El programa educativo se obtiene vía materia_id -> materias.carrera
CREATE TABLE IF NOT EXISTS grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_grupo TEXT NOT NULL, -- Ej: 101, 302
    turno TEXT NOT NULL,
    materia_id UUID REFERENCES materias(id) ON DELETE CASCADE,
    docente_id UUID REFERENCES docentes(id) ON DELETE CASCADE,
    ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabla de Estudiantes
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
    ciclo_id UUID REFERENCES ciclos_escolares(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabla de Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id TEXT REFERENCES estudiantes(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    fecha DATE DEFAULT CURRENT_DATE,
    presente BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(estudiante_id, grupo_id, fecha)
);

-- 8. Tabla de Actividades y Calificaciones
CREATE TABLE IF NOT EXISTS actividades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
    docente_id UUID REFERENCES docentes(id) ON DELETE CASCADE,
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

-- Permisos Globales (Desarrollo)
ALTER TABLE ciclos_escolares DISABLE ROW LEVEL SECURITY;
ALTER TABLE materias DISABLE ROW LEVEL SECURITY;
ALTER TABLE docentes DISABLE ROW LEVEL SECURITY;
ALTER TABLE grupos DISABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes DISABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;
