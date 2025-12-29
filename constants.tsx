
import React from 'react';
import { RiskLevel } from './types';

// Colores Oficiales UAS/FCQB
export const UAS_COLORS = {
  NAVY: '#003B5C',
  GOLD: '#FFD100',
  BLUE_LIGHT: '#005689',
  GRAY_BG: '#F4F7F9'
};

export const CAREERS = [
  'Ingeniería Química',
  'Ingeniería Bioquímica',
  'Química Farmacéutico Biólogo',
  'Biotecnología Genómica'
];

export const RISK_COLORS = {
  LOW: 'bg-green-600 text-white border-green-700',
  MEDIUM: 'bg-yellow-500 text-white border-yellow-600',
  HIGH: 'bg-red-600 text-white border-red-700'
};

export const RISK_LABELS = {
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto'
};

/**
 * Lógica oficial FCQB para determinar el semáforo de riesgo
 * @param avg Promedio (Actividades)
 * @param attendance Asistencia (%)
 */
export const calculateRisk = (avg: number, attendance: number): RiskLevel => {
  // Criterios de la facultad para riesgo alto: menos de 7 de promedio O menos de 80% asistencia
  if (avg < 7.0 || attendance < 80) return RiskLevel.HIGH;
  // Riesgo medio: promedio entre 7 y 8 O asistencia entre 80% y 90%
  if (avg < 8.0 || attendance < 90) return RiskLevel.MEDIUM;
  // Riesgo bajo: cumplimiento total
  return RiskLevel.LOW;
};
