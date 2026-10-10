-- ==============================================================================
-- STA-FCQB: Actualización de Esquema para Acentuaciones de Especialidad y Optativas Libres
-- Semestres 7°, 8° y 9° para todos los programas (QFB, IBQ, IQ, BG)
-- ==============================================================================

-- 1. Asegurar tabla 'acentuaciones' con soporte para semestres 7, 8 y 9
CREATE TABLE IF NOT EXISTS acentuaciones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  carrera TEXT NOT NULL, -- Químico Farmacéutico Biólogo, Ingeniería Bioquímica, Ingeniería Química, Biotecnología Genómica
  tipo_optativa TEXT NOT NULL, -- OL I, OL II, OL III, OE I, OE II, OE III, OP I, OP II, etc.
  semestre INT DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar columna semestre si la tabla ya existía
ALTER TABLE acentuaciones 
ADD COLUMN IF NOT EXISTS semestre INT DEFAULT 8;

-- Índice para búsquedas rápidas por carrera y semestre
CREATE INDEX IF NOT EXISTS idx_acentuaciones_carrera_semestre ON acentuaciones(carrera, semestre);

-- 2. Asegurar campos en la tabla 'materias' para identificar Acentuaciones / Optativas Libres
ALTER TABLE materias
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Obligatoria';

ALTER TABLE materias
ADD COLUMN IF NOT EXISTS es_optativa BOOLEAN DEFAULT FALSE;

-- 3. Asegurar tabla relacional 'estudiantes_acentuacion' (Subgrupos de Optativa Libre)
CREATE TABLE IF NOT EXISTS estudiantes_acentuacion (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  estudiante_id TEXT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
  acentuacion_id UUID NOT NULL REFERENCES acentuaciones(id) ON DELETE CASCADE,
  ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(estudiante_id, acentuacion_id)
);

-- Asegurar columna ciclo_id si ya existía la tabla
ALTER TABLE estudiantes_acentuacion
ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES ciclos_escolares(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estudiantes_acentuacion_est ON estudiantes_acentuacion(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_acentuacion_acc ON estudiantes_acentuacion(acentuacion_id);
CREATE INDEX IF NOT EXISTS idx_estudiantes_acentuacion_ciclo ON estudiantes_acentuacion(ciclo_id);

-- 4. Políticas de Seguridad RLS
ALTER TABLE acentuaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes_acentuacion ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura a todos acentuaciones') THEN
    CREATE POLICY "Permitir lectura a todos acentuaciones" ON acentuaciones FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir escritura acentuaciones') THEN
    CREATE POLICY "Permitir escritura acentuaciones" ON acentuaciones FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura a todos estudiantes_acentuacion') THEN
    CREATE POLICY "Permitir lectura a todos estudiantes_acentuacion" ON estudiantes_acentuacion FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir escritura estudiantes_acentuacion') THEN
    CREATE POLICY "Permitir escritura estudiantes_acentuacion" ON estudiantes_acentuacion FOR ALL USING (true);
  END IF;
END $$;

-- 5. SEED DATA: Catálogo oficial de Acentuaciones de Especialidad y Optativas Libres (7°, 8° y 9° Semestre)

-- QUÍMICO FARMACÉUTICO BIÓLOGO (QFB)
-- 7mo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'TOXICOLOGÍA ESPECIALIZADA', 'Químico Farmacéutico Biólogo', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'TOXICOLOGÍA ESPECIALIZADA' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'ANÁLISIS INSTRUMENTAL AVANZADO', 'Químico Farmacéutico Biólogo', 'OL I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'ANÁLISIS INSTRUMENTAL AVANZADO' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOQUÍMICA CLÍNICA ESPECIALIZADA', 'Químico Farmacéutico Biólogo', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOQUÍMICA CLÍNICA ESPECIALIZADA' AND carrera = 'Químico Farmacéutico Biólogo');

-- 8vo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BANCO DE SANGRE', 'Químico Farmacéutico Biólogo', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BANCO DE SANGRE' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'INMUNOLOGIA CLINICA', 'Químico Farmacéutico Biólogo', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'INMUNOLOGIA CLINICA' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'QUÍMICA LEGAL Y FORENSE', 'Químico Farmacéutico Biólogo', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'QUÍMICA LEGAL Y FORENSE' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'QUIMICA FARMACEUTICA', 'Químico Farmacéutico Biólogo', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'QUIMICA FARMACEUTICA' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'TECNOLOGIA FARMACEUTICA II', 'Químico Farmacéutico Biólogo', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'TECNOLOGIA FARMACEUTICA II' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'DISEÑO Y ESTABILIDAD DE MEDICAMENTOS', 'Químico Farmacéutico Biólogo', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'DISEÑO Y ESTABILIDAD DE MEDICAMENTOS' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOMEDICINA MOLECULAR', 'Químico Farmacéutico Biólogo', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOMEDICINA MOLECULAR' AND carrera = 'Químico Farmacéutico Biólogo');

-- 9no Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'HEMATOLOGÍA DIAGNÓSTICA AVANZADA', 'Químico Farmacéutico Biólogo', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'HEMATOLOGÍA DIAGNÓSTICA AVANZADA' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'GESTIÓN Y CALIDAD EN EL LABORATORIO', 'Químico Farmacéutico Biólogo', 'OL III', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'GESTIÓN Y CALIDAD EN EL LABORATORIO' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'FARMACOGENÓMICA Y TERAPIA PERSONALIZADA', 'Químico Farmacéutico Biólogo', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'FARMACOGENÓMICA Y TERAPIA PERSONALIZADA' AND carrera = 'Químico Farmacéutico Biólogo');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOTECNOLOGÍA FARMACÉUTICA', 'Químico Farmacéutico Biólogo', 'OL III', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOTECNOLOGÍA FARMACÉUTICA' AND carrera = 'Químico Farmacéutico Biólogo');


-- INGENIERÍA BIOQUÍMICA (IBQ)
-- 7mo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOQUÍMICA DE ALIMENTOS AVANZADA', 'Ingeniería Bioquímica', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOQUÍMICA DE ALIMENTOS AVANZADA' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'INGENIERÍA ENZIMÁTICA', 'Ingeniería Bioquímica', 'OL I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'INGENIERÍA ENZIMÁTICA' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'MICROBIOLOGÍA INDUSTRIAL APLICADA', 'Ingeniería Bioquímica', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'MICROBIOLOGÍA INDUSTRIAL APLICADA' AND carrera = 'Ingeniería Bioquímica');

-- 8vo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'FUNDAMENTOS DE PROCESAMIENTO DE ALIMENTOS', 'Ingeniería Bioquímica', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'FUNDAMENTOS DE PROCESAMIENTO DE ALIMENTOS' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'PROCESOS BIOTECNOLOGICOS', 'Ingeniería Bioquímica', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'PROCESOS BIOTECNOLOGICOS' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'ANALISIS AVANZADO DE ALIMENTOS', 'Ingeniería Bioquímica', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'ANALISIS AVANZADO DE ALIMENTOS' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'NUTRIGENOMICA', 'Ingeniería Bioquímica', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'NUTRIGENOMICA' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'INOCUIDAD ALIMENTARIA', 'Ingeniería Bioquímica', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'INOCUIDAD ALIMENTARIA' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOREACTORES Y BIOREACCIONES', 'Ingeniería Bioquímica', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOREACTORES Y BIOREACCIONES' AND carrera = 'Ingeniería Bioquímica');

-- 9no Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'DISEÑO DE PLANTAS BIOTECNOLÓGICAS', 'Ingeniería Bioquímica', 'OL III', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'DISEÑO DE PLANTAS BIOTECNOLÓGICAS' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOPROCESOS AMBIENTALES Y BIORREMEDIACIÓN', 'Ingeniería Bioquímica', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOPROCESOS AMBIENTALES Y BIORREMEDIACIÓN' AND carrera = 'Ingeniería Bioquímica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'TECNOLOGÍA DE FERMENTACIONES AVANZADAS', 'Ingeniería Bioquímica', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'TECNOLOGÍA DE FERMENTACIONES AVANZADAS' AND carrera = 'Ingeniería Bioquímica');


-- INGENIERÍA QUÍMICA (IQ)
-- 7mo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'SIMULACIÓN Y MODELADO DE PROCESOS', 'Ingeniería Química', 'OL I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'SIMULACIÓN Y MODELADO DE PROCESOS' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'FISICOQUÍMICA APLICADA A PROCESOS', 'Ingeniería Química', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'FISICOQUÍMICA APLICADA A PROCESOS' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'CIENCIA Y METALURGIA DE MATERIALES', 'Ingeniería Química', 'OE I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'CIENCIA Y METALURGIA DE MATERIALES' AND carrera = 'Ingeniería Química');

-- 8vo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'HIGIENE Y SEGURIDAD INDUSTRIAL', 'Ingeniería Química', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'HIGIENE Y SEGURIDAD INDUSTRIAL' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'ESTUDIO DEL MÉTODO DEL TRABAJO Y ERGONOMÍA', 'Ingeniería Química', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'ESTUDIO DEL MÉTODO DEL TRABAJO Y ERGONOMÍA' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'CATALISIS', 'Ingeniería Química', 'OE II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'CATALISIS' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'DISEÑO Y MEJORA DE PROCESOS Y PRODUCTOS', 'Ingeniería Química', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'DISEÑO Y MEJORA DE PROCESOS Y PRODUCTOS' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'POLIMEROS', 'Ingeniería Química', 'OE III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'POLIMEROS' AND carrera = 'Ingeniería Química');

-- 9no Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'TRATAMIENTO DE EFLUENTES INDUSTRIALES', 'Ingeniería Química', 'OL III', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'TRATAMIENTO DE EFLUENTES INDUSTRIALES' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'OPTIMIZACIÓN DE PROCESOS QUÍMICOS', 'Ingeniería Química', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'OPTIMIZACIÓN DE PROCESOS QUÍMICOS' AND carrera = 'Ingeniería Química');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'PETROQUÍMICA Y REFINACIÓN', 'Ingeniería Química', 'OE IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'PETROQUÍMICA Y REFINACIÓN' AND carrera = 'Ingeniería Química');


-- BIOTECNOLOGÍA GENÓMICA (BG)
-- 7mo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOINFORMÁTICA Y GENÓMICA ESTRUCTURAL', 'Biotecnología Genómica', 'OL I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOINFORMÁTICA Y GENÓMICA ESTRUCTURAL' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'GENÓMICA FUNCIONAL Y COMPARATIVA', 'Biotecnología Genómica', 'OP I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'GENÓMICA FUNCIONAL Y COMPARATIVA' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOÉTICA Y MARCO REGULATORIO EN BIOTECNOLOGÍA', 'Biotecnología Genómica', 'OP I', 7
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOÉTICA Y MARCO REGULATORIO EN BIOTECNOLOGÍA' AND carrera = 'Biotecnología Genómica');

-- 8vo Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOTECNOLOGIA VEGETAL', 'Biotecnología Genómica', 'OP I', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOTECNOLOGIA VEGETAL' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'NUTRIGENOMICA/PATOLOGIA ANIMAL', 'Biotecnología Genómica', 'OP II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'NUTRIGENOMICA/PATOLOGIA ANIMAL' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'TOXICOLOGIA AMBIENTAL/BIOREMEDIACION', 'Biotecnología Genómica', 'OP III', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'TOXICOLOGIA AMBIENTAL/BIOREMEDIACION' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'CULTIVO DE CÉLULAS Y TEJIDOS VEGETALES', 'Biotecnología Genómica', 'OL II', 8
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'CULTIVO DE CÉLULAS Y TEJIDOS VEGETALES' AND carrera = 'Biotecnología Genómica');

-- 9no Semestre
INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'EDICIÓN GENÓMICA Y CRISPR', 'Biotecnología Genómica', 'OP IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'EDICIÓN GENÓMICA Y CRISPR' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'BIOLOGÍA SINTÉTICA Y METABÓLICA', 'Biotecnología Genómica', 'OL III', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'BIOLOGÍA SINTÉTICA Y METABÓLICA' AND carrera = 'Biotecnología Genómica');

INSERT INTO acentuaciones (nombre, carrera, tipo_optativa, semestre)
SELECT 'DIAGNÓSTICO MOLECULAR AVANZADO', 'Biotecnología Genómica', 'OP IV', 9
WHERE NOT EXISTS (SELECT 1 FROM acentuaciones WHERE nombre = 'DIAGNÓSTICO MOLECULAR AVANZADO' AND carrera = 'Biotecnología Genómica');

-- 6. Notificar recarga de esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
