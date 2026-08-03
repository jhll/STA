-- Tabla para Definir Catálogo de Acentuaciones (Subgrupos)
CREATE TABLE IF NOT EXISTS acentuaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  carrera TEXT NOT NULL, -- IQ, IBQ, QFB, BG
  tipo_optativa TEXT NOT NULL, -- OL II, OE III, OP I, etc.
  semestre INT DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla Relacional: Estudiantes inscritos en una acentuación
CREATE TABLE IF NOT EXISTS estudiantes_acentuacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id TEXT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  acentuacion_id UUID NOT NULL REFERENCES acentuaciones(id) ON DELETE CASCADE,
  ciclo_id UUID REFERENCES ciclos_escolares(id), -- Para historial
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(estudiante_id, acentuacion_id) -- Evitar duplicados en la misma acentuación
);

-- SEED DATA: Insertar las acentuaciones iniciales solicitadas

-- Ingeniería Química (IQ)
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa) VALUES
('HIGIENE Y SEGURIDAD INDUSTRIAL', 'Ingeniería Química', 'OL II'),
('ESTUDIO DEL MÉTODO DEL TRABAJO Y ERGONOMÍA', 'Ingeniería Química', 'OE II'),
('CATALISIS', 'Ingeniería Química', 'OE II'),
('DISEÑO Y MEJORA DE PROCESOS Y PRODUCTOS', 'Ingeniería Química', 'OE III'),
('POLIMEROS', 'Ingeniería Química', 'OE III');

-- Ingeniería Bioquímica (IBQ)
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa) VALUES
('FUNDAMENTOS DE PROCESAMIENTO DE ALIMENTOS', 'Ingeniería Bioquímica', 'OE II'),
('PROCESOS BIOTECNOLOGICOS', 'Ingeniería Bioquímica', 'OE II'),
('ANALISIS AVANZADO DE ALIMENTOS', 'Ingeniería Bioquímica', 'OE III'),
('NUTRIGENOMICA', 'Ingeniería Bioquímica', 'OL II'),
('INOCUIDAD ALIMENTARIA', 'Ingeniería Bioquímica', 'OL II'),
('BIOREACTORES Y BIOREACCIONES', 'Ingeniería Bioquímica', 'OE III');

-- Químico Farmacéutico Biólogo (QFB)
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa) VALUES
('BANCO DE SANGRE', 'Químico Farmacéutico Biólogo', 'OE II'),
('INMUNOLOGIA CLINICA', 'Químico Farmacéutico Biólogo', 'OE III'),
('QUÍMICA LEGAL Y FORENSE', 'Químico Farmacéutico Biólogo', 'OL II'),
('QUIMICA FARMACEUTICA', 'Químico Farmacéutico Biólogo', 'OE II'),
('TECNOLOGIA FARMACEUTICA II', 'Químico Farmacéutico Biólogo', 'OE III'),
('DISEÑO Y ESTABILIDAD DE MEDICAMENTOS', 'Químico Farmacéutico Biólogo', 'OL II'),
('BIOMEDICINA MOLECULAR', 'Químico Farmacéutico Biólogo', 'OE II');

-- Biotecnología Genómica (BG)
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa) VALUES
('BIOTECNOLOGIA VEGETAL', 'Biotecnología Genómica', 'OP I'),
('NUTRIGENOMICA/PATOLOGIA ANIMAL', 'Biotecnología Genómica', 'OP II'),
('TOXICOLOGIA AMBIENTAL/BIOREMEDIACION', 'Biotecnología Genómica', 'OP III');

-- Habilitar Row Level Security (RLS) opcionalmente, o dejar abierto según reglas actuales
ALTER TABLE acentuaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes_acentuacion ENABLE ROW LEVEL SECURITY;

-- Políticas simples (Abiertas para demo, restringir en prod)
CREATE POLICY "Permitir lectura a todos" ON acentuaciones FOR SELECT USING (true);
CREATE POLICY "Permitir escritura a admins" ON acentuaciones FOR ALL USING (true); -- Ajustar rol si se tiene autenticación
CREATE POLICY "Permitir todo estudiantes_acentuacion" ON estudiantes_acentuacion FOR ALL USING (true);
