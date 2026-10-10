
import React from 'react';
import { RiskLevel, Career } from './types';

// Colores Oficiales UAS/FCQB
export const UAS_COLORS = {
  NAVY: '#003B5C',
  GOLD: '#FFD100',
  BLUE_LIGHT: '#005689',
  GRAY_BG: '#F4F7F9'
};

export const CAREERS = [
  Career.IQ,
  Career.IBQ,
  Career.QFB,
  Career.BG
];

// Semestres de Acentuación de Especialidad
export const SPECIALTY_SEMESTERS = [7, 8, 9] as const;

export const isSpecialtySemester = (semester: number | string): boolean => {
  const s = typeof semester === 'string' ? parseInt(semester, 10) : semester;
  return SPECIALTY_SEMESTERS.includes(s as any);
};

export interface DefaultSpecialtyItem {
  nombre: string;
  carrera: Career;
  semestre: number;
  tipo_optativa: string;
  codigo: string;
  creditos: number;
}

export const DEFAULT_SPECIALTY_CATALOG: DefaultSpecialtyItem[] = [
  // QUÍMICO FARMACÉUTICO BIÓLOGO (QFB)
  { nombre: 'TOXICOLOGÍA ESPECIALIZADA', carrera: Career.QFB, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-QFB-701', creditos: 8 },
  { nombre: 'ANÁLISIS INSTRUMENTAL AVANZADO', carrera: Career.QFB, semestre: 7, tipo_optativa: 'OL I', codigo: 'OPT-QFB-702', creditos: 8 },
  { nombre: 'BIOQUÍMICA CLÍNICA ESPECIALIZADA', carrera: Career.QFB, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-QFB-703', creditos: 8 },
  { nombre: 'BANCO DE SANGRE', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-QFB-801', creditos: 10 },
  { nombre: 'INMUNOLOGIA CLINICA', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-QFB-802', creditos: 10 },
  { nombre: 'QUÍMICA LEGAL Y FORENSE', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-QFB-803', creditos: 10 },
  { nombre: 'QUIMICA FARMACEUTICA', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-QFB-804', creditos: 10 },
  { nombre: 'TECNOLOGIA FARMACEUTICA II', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-QFB-805', creditos: 10 },
  { nombre: 'DISEÑO Y ESTABILIDAD DE MEDICAMENTOS', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-QFB-806', creditos: 10 },
  { nombre: 'BIOMEDICINA MOLECULAR', carrera: Career.QFB, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-QFB-807', creditos: 10 },
  { nombre: 'HEMATOLOGÍA DIAGNÓSTICA AVANZADA', carrera: Career.QFB, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-QFB-901', creditos: 10 },
  { nombre: 'GESTIÓN Y CALIDAD EN EL LABORATORIO', carrera: Career.QFB, semestre: 9, tipo_optativa: 'OL III', codigo: 'OPT-QFB-902', creditos: 10 },
  { nombre: 'FARMACOGENÓMICA Y TERAPIA PERSONALIZADA', carrera: Career.QFB, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-QFB-903', creditos: 10 },
  { nombre: 'BIOTECNOLOGÍA FARMACÉUTICA', carrera: Career.QFB, semestre: 9, tipo_optativa: 'OL III', codigo: 'OPT-QFB-904', creditos: 10 },

  // INGENIERÍA BIOQUÍMICA (IBQ)
  { nombre: 'BIOQUÍMICA DE ALIMENTOS AVANZADA', carrera: Career.IBQ, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-IBQ-701', creditos: 8 },
  { nombre: 'INGENIERÍA ENZIMÁTICA', carrera: Career.IBQ, semestre: 7, tipo_optativa: 'OL I', codigo: 'OPT-IBQ-702', creditos: 8 },
  { nombre: 'MICROBIOLOGÍA INDUSTRIAL APLICADA', carrera: Career.IBQ, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-IBQ-703', creditos: 8 },
  { nombre: 'FUNDAMENTOS DE PROCESAMIENTO DE ALIMENTOS', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-IBQ-801', creditos: 10 },
  { nombre: 'PROCESOS BIOTECNOLOGICOS', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-IBQ-802', creditos: 10 },
  { nombre: 'ANALISIS AVANZADO DE ALIMENTOS', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-IBQ-803', creditos: 10 },
  { nombre: 'NUTRIGENOMICA', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-IBQ-804', creditos: 10 },
  { nombre: 'INOCUIDAD ALIMENTARIA', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-IBQ-805', creditos: 10 },
  { nombre: 'BIOREACTORES Y BIOREACCIONES', carrera: Career.IBQ, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-IBQ-806', creditos: 10 },
  { nombre: 'DISEÑO DE PLANTAS BIOTECNOLÓGICAS', carrera: Career.IBQ, semestre: 9, tipo_optativa: 'OL III', codigo: 'OPT-IBQ-901', creditos: 10 },
  { nombre: 'BIOPROCESOS AMBIENTALES Y BIORREMEDIACIÓN', carrera: Career.IBQ, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-IBQ-902', creditos: 10 },
  { nombre: 'TECNOLOGÍA DE FERMENTACIONES AVANZADAS', carrera: Career.IBQ, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-IBQ-903', creditos: 10 },

  // INGENIERÍA QUÍMICA (IQ)
  { nombre: 'SIMULACIÓN Y MODELADO DE PROCESOS', carrera: Career.IQ, semestre: 7, tipo_optativa: 'OL I', codigo: 'OPT-IQ-701', creditos: 8 },
  { nombre: 'FISICOQUÍMICA APLICADA A PROCESOS', carrera: Career.IQ, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-IQ-702', creditos: 8 },
  { nombre: 'CIENCIA Y METALURGIA DE MATERIALES', carrera: Career.IQ, semestre: 7, tipo_optativa: 'OE I', codigo: 'OPT-IQ-703', creditos: 8 },
  { nombre: 'HIGIENE Y SEGURIDAD INDUSTRIAL', carrera: Career.IQ, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-IQ-801', creditos: 10 },
  { nombre: 'ESTUDIO DEL MÉTODO DEL TRABAJO Y ERGONOMÍA', carrera: Career.IQ, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-IQ-802', creditos: 10 },
  { nombre: 'CATALISIS', carrera: Career.IQ, semestre: 8, tipo_optativa: 'OE II', codigo: 'OPT-IQ-803', creditos: 10 },
  { nombre: 'DISEÑO Y MEJORA DE PROCESOS Y PRODUCTOS', carrera: Career.IQ, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-IQ-804', creditos: 10 },
  { nombre: 'POLIMEROS', carrera: Career.IQ, semestre: 8, tipo_optativa: 'OE III', codigo: 'OPT-IQ-805', creditos: 10 },
  { nombre: 'TRATAMIENTO DE EFLUENTES INDUSTRIALES', carrera: Career.IQ, semestre: 9, tipo_optativa: 'OL III', codigo: 'OPT-IQ-901', creditos: 10 },
  { nombre: 'OPTIMIZACIÓN DE PROCESOS QUÍMICOS', carrera: Career.IQ, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-IQ-902', creditos: 10 },
  { nombre: 'PETROQUÍMICA Y REFINACIÓN', carrera: Career.IQ, semestre: 9, tipo_optativa: 'OE IV', codigo: 'OPT-IQ-903', creditos: 10 },

  // BIOTECNOLOGÍA GENÓMICA (BG)
  { nombre: 'BIOINFORMÁTICA Y GENÓMICA ESTRUCTURAL', carrera: Career.BG, semestre: 7, tipo_optativa: 'OL I', codigo: 'OPT-BG-701', creditos: 8 },
  { nombre: 'GENÓMICA FUNCIONAL Y COMPARATIVA', carrera: Career.BG, semestre: 7, tipo_optativa: 'OP I', codigo: 'OPT-BG-702', creditos: 8 },
  { nombre: 'BIOÉTICA Y MARCO REGULATORIO EN BIOTECNOLOGÍA', carrera: Career.BG, semestre: 7, tipo_optativa: 'OP I', codigo: 'OPT-BG-703', creditos: 8 },
  { nombre: 'BIOTECNOLOGIA VEGETAL', carrera: Career.BG, semestre: 8, tipo_optativa: 'OP I', codigo: 'OPT-BG-801', creditos: 10 },
  { nombre: 'NUTRIGENOMICA/PATOLOGIA ANIMAL', carrera: Career.BG, semestre: 8, tipo_optativa: 'OP II', codigo: 'OPT-BG-802', creditos: 10 },
  { nombre: 'TOXICOLOGIA AMBIENTAL/BIOREMEDIACION', carrera: Career.BG, semestre: 8, tipo_optativa: 'OP III', codigo: 'OPT-BG-803', creditos: 10 },
  { nombre: 'CULTIVO DE CÉLULAS Y TEJIDOS VEGETALES', carrera: Career.BG, semestre: 8, tipo_optativa: 'OL II', codigo: 'OPT-BG-804', creditos: 10 },
  { nombre: 'EDICIÓN GENÓMICA Y CRISPR', carrera: Career.BG, semestre: 9, tipo_optativa: 'OP IV', codigo: 'OPT-BG-901', creditos: 10 },
  { nombre: 'BIOLOGÍA SINTÉTICA Y METABÓLICA', carrera: Career.BG, semestre: 9, tipo_optativa: 'OL III', codigo: 'OPT-BG-902', creditos: 10 },
  { nombre: 'DIAGNÓSTICO MOLECULAR AVANZADO', carrera: Career.BG, semestre: 9, tipo_optativa: 'OP IV', codigo: 'OPT-BG-903', creditos: 10 },
];

export const RISK_COLORS = {
  LOW: 'bg-green-600 text-white border-green-700',
  MEDIUM: 'bg-yellow-500 text-white border-yellow-600',
  HIGH: 'bg-red-600 text-white border-red-700'
};

export const RISK_CHART_COLORS = {
  LOW: '#10b981',    // Emerald 500
  MEDIUM: '#f59e0b', // Amber 500
  HIGH: '#ef4444'    // Red 500
};

export const RISK_LABELS = {
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto'
};

/**
 * Lógica oficial FCQB para determinar el semáforo de riesgo
 * 
 * 🔴 Riesgo Alto (HIGH): Promedio < 7.0 O Asistencia < 80%
 * 🟡 Riesgo Medio (MEDIUM): Promedio [7.0 - 8.0) O Asistencia [80% - 90%)
 * 🟢 Riesgo Bajo (LOW): Promedio >= 8.0 Y Asistencia >= 90%
 * 
 * @param avg Promedio de Actividades (Normalizado a base 10)
 * @param attendance Porcentaje de Asistencia (0-100)
 */
export const calculateRisk = (avg: number, attendance: number): RiskLevel => {
  // 1. Prioridad: Rojo (Cualquier fallo crítico)
  if (avg < 7.0 || attendance < 80) {
    return RiskLevel.HIGH;
  }

  // 2. Amarillo (Rendimiento regular en cualquiera de las dos)
  // Si no es rojo, pero alguna está por debajo del estándar de excelencia
  if (avg < 8.0 || attendance < 90) {
    return RiskLevel.MEDIUM;
  }

  // 3. Verde (Excelencia en ambas)
  return RiskLevel.LOW;
};
