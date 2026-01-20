
export enum UserRole {
  ADMIN = 'ADMIN',
  DOCENTE = 'DOCENTE',
  TUTOR = 'TUTOR'
}

export enum RiskLevel {
  LOW = 'LOW', // Verde
  MEDIUM = 'MEDIUM', // Amarillo
  HIGH = 'HIGH' // Rojo
}

export enum Career {
  IQ = 'Ingeniería Química',
  IBQ = 'Ingeniería Bioquímica',
  QFB = 'Química Farmacéutico Biólogo',
  BG = 'Biotecnología Genómica'
}

export enum Turno {
  MATUTINO = 'Matutino',
  VESPERTINO = 'Vespertino'
}

export enum ActivityType {
  TAREA = 'Tarea',
  EJERCICIO = 'Ejercicio',
  EXAMEN = 'Examen'
}

export interface CicloEscolar {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  es_activo: boolean;
  created_at?: string;
}

export interface Subject {
  id: string;
  codigo: string;
  nombre: string;
  carrera: Career;
  semestre: number;
  creditos: number;
  created_at?: string;
}

export interface Student {
  id: string;
  name: string;
  career: Career;
  semester: number;
  group: string;
  shift: Turno;
  average: number;
  attendance: number;
  risk: RiskLevel;
  lastInteraction?: string;
  personalFactors: string[];
  academicFactors: string[];
  institutionalFactors: string[];
  ciclo_id?: string;
  avgExams?: number;
  avgTasks?: number;
  avgExercises?: number;
}

export interface Activity {
  id: string;
  grupo_id: string;
  docente_id: string;
  titulo: string;
  descripcion: string;
  tipo: ActivityType;
  unidad: number;
  fecha_entrega: string;
  puntos_max: number;
  created_at?: string;
  grupo_nombre?: string;
}

export interface Grade {
  id: string;
  actividad_id: string;
  estudiante_id: string;
  calificacion: number;
  comentarios: string;
  entregado: boolean;
  fecha_evaluacion?: string;
}

export interface Group {
  id: string;
  name: string;
  career: Career;
  semester: number;
  studentCount: number;
  ciclo_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Intervention {
  id: string;
  studentId: string;
  type: string;
  date: string;
  description: string;
  status: 'PENDING' | 'COMPLETED';
  ciclo_id?: string;
}
