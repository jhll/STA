
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
