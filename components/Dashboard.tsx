
import React, { useState, useEffect } from 'react';
import { RISK_COLORS, RISK_LABELS, calculateRisk, UAS_COLORS, RISK_CHART_COLORS } from '../constants';
import { Student, RiskLevel, UserRole } from '../types';
import StudentProfile from './StudentProfile';
import TeacherCertificateModal from './TeacherCertificateModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../services/supabaseClient';

import uasEscudo from './images/uas_escudo.png';
import fcqbLogo from './images/fcqb_logo.png';

const Dashboard: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showTeacherCertificateModal, setShowTeacherCertificateModal] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalEnrollment, setTotalEnrollment] = useState<number>(0);
  const [totalHighRisk, setTotalHighRisk] = useState<number>(0);
  const [totalMediumRisk, setTotalMediumRisk] = useState<number>(0);
  const [totalLowRisk, setTotalLowRisk] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tutorGroupName, setTutorGroupName] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });
      let filterGroups: string[] = [];

      // Variables to hold filter conditions for Docentes (shared with risk queries)
      let teacherNormalGroups: string[] = [];
      let teacherExtraStudentIds: string[] = [];
      let isDocenteWithSubgroups = false;
      let activeCycle: any = null;

      // Variables for Tutors
      let tutorNormalGroups: string[] = [];
      let tutorExtraStudentIds: string[] = [];

      // LÓGICA ESPECÍFICA PARA TUTOR
      if (role === UserRole.TUTOR) {
        const { data: tutoriaData, error: tutoriaError } = await supabase
          .from('tutorias')
          .select('nombre_grupo, estudiante_id')
          .eq('tutor_id', userId);

        if (tutoriaError) throw tutoriaError;

        tutorNormalGroups = Array.from(new Set((tutoriaData?.map(t => t.nombre_grupo).filter(Boolean) || []) as string[]));
        tutorExtraStudentIds = Array.from(new Set((tutoriaData?.map(t => t.estudiante_id).filter(Boolean) || []) as string[]));

        if (tutorNormalGroups.length > 0 || tutorExtraStudentIds.length > 0) {
          const namesDisplay = [
            ...tutorNormalGroups,
            tutorExtraStudentIds.length > 0 ? `${tutorExtraStudentIds.length} Estudiantes Individuales` : ''
          ].filter(Boolean).join(', ');

          setTutorGroupName(namesDisplay);

          const orConditions: string[] = [];
          if (tutorNormalGroups.length > 0) orConditions.push(`grupo.in.(${tutorNormalGroups.map(g => `"${g}"`).join(',')})`);
          if (tutorExtraStudentIds.length > 0) orConditions.push(`id.in.(${tutorExtraStudentIds.map(id => `"${id}"`).join(',')})`);

          if (orConditions.length > 1) {
            query = query.or(orConditions.join(','));
          } else if (orConditions.length === 1) {
            if (tutorNormalGroups.length > 0) query = query.in('grupo', tutorNormalGroups);
            if (tutorExtraStudentIds.length > 0) query = query.in('id', tutorExtraStudentIds);
          }
        } else {
          setStudents([]);
          setTotalEnrollment(0);
          setTotalHighRisk(0);
          setLoading(false);
          return;
        }
      }

      // LÓGICA PARA DOCENTE (únicamente alumnos y grupos asignados del periodo activo)
      else if (role === UserRole.DOCENTE) {
        const { data: cycleData } = await supabase
          .from('ciclos_escolares')
          .select('id')
          .eq('es_activo', true)
          .maybeSingle();
        activeCycle = cycleData;

        if (!activeCycle) {
          setStudents([]);
          setTotalEnrollment(0);
          setTotalHighRisk(0);
          setTotalMediumRisk(0);
          setTotalLowRisk(0);
          setLoading(false);
          return;
        }

        let groupsQuery = supabase
          .from('grupos')
          .select('nombre_grupo, ciclo_id')
          .eq('docente_id', userId)
          .eq('ciclo_id', activeCycle.id);

        const { data: groups } = await groupsQuery;
        const groupNames: string[] = Array.from(new Set((groups || []).map((g: any) => g.nombre_grupo))).filter((g): g is string => typeof g === 'string');

        // Check for Accentuations Subgroups (convention: "SUB - <Nombre>")
        const subGroups = groupNames.filter(g => g.startsWith('SUB - '));
        if (subGroups.length > 0) {
          const accNames = subGroups.map(g => g.replace('SUB - ', '').trim());

          // Find Accentuation IDs
          const { data: accData } = await supabase.from('acentuaciones').select('id').in('nombre', accNames);
          const accIds = accData?.map(a => a.id) || [];

          if (accIds.length > 0) {
            const { data: stAccData } = await supabase.from('estudiantes_acentuacion').select('estudiante_id').in('acentuacion_id', accIds);
            if (stAccData) {
              teacherExtraStudentIds = stAccData.map(d => d.estudiante_id);
            }
          }
        }

        teacherNormalGroups = groupNames.filter(g => !g.startsWith('SUB - '));
        isDocenteWithSubgroups = true;

        if (teacherNormalGroups.length === 0 && teacherExtraStudentIds.length === 0) {
          setStudents([]);
          setTotalEnrollment(0);
          setTotalHighRisk(0);
          setTotalMediumRisk(0);
          setTotalLowRisk(0);
          setLoading(false);
          return;
        }

        // Filtrar estrictamente por los alumnos asignados del periodo activo
        query = query.eq('ciclo_id', activeCycle.id);

        const conditions: string[] = [];
        if (teacherNormalGroups.length > 0) conditions.push(`grupo.in.(${teacherNormalGroups.map(g => `"${g}"`).join(',')})`);
        if (teacherExtraStudentIds.length > 0) conditions.push(`id.in.(${teacherExtraStudentIds.map(id => `"${id}"`).join(',')})`);

        if (conditions.length > 1) {
          query = query.or(conditions.join(','));
        } else if (conditions.length === 1) {
          // Optimize: If only one condition, apply it directly without OR syntax which might be flaky with single args
          if (teacherNormalGroups.length > 0) query = query.in('grupo', teacherNormalGroups);
          if (teacherExtraStudentIds.length > 0) query = query.in('id', teacherExtraStudentIds);
        }

        filterGroups = groupNames;
      }

      // Helper for Risk Queries
      const applyRiskFilter = (q: any) => {
        if (role === UserRole.TUTOR) {
          const conditions: string[] = [];
          if (tutorNormalGroups.length > 0) conditions.push(`grupo.in.(${tutorNormalGroups.map(g => `"${g}"`).join(',')})`);
          if (tutorExtraStudentIds.length > 0) conditions.push(`id.in.(${tutorExtraStudentIds.map(id => `"${id}"`).join(',')})`);

          if (conditions.length > 1) return q.or(conditions.join(','));
          if (conditions.length === 1) {
            if (tutorNormalGroups.length > 0) return q.in('grupo', tutorNormalGroups);
            if (tutorExtraStudentIds.length > 0) return q.in('id', tutorExtraStudentIds);
          }
          return q;
        }

        if (role === UserRole.DOCENTE && isDocenteWithSubgroups) {
          const conditions: string[] = [];
          if (teacherNormalGroups.length > 0) conditions.push(`grupo.in.(${teacherNormalGroups.map(g => `"${g}"`).join(',')})`);
          if (teacherExtraStudentIds.length > 0) conditions.push(`id.in.(${teacherExtraStudentIds.map(id => `"${id}"`).join(',')})`);

          if (activeCycle) {
            q = q.eq('ciclo_id', activeCycle.id);
          }

          if (conditions.length > 1) return q.or(conditions.join(','));
          if (conditions.length === 1) {
            if (teacherNormalGroups.length > 0) return q.in('grupo', teacherNormalGroups);
            if (teacherExtraStudentIds.length > 0) return q.in('id', teacherExtraStudentIds);
          }
          return q;
        }
        if (filterGroups.length > 0) {
          if (activeCycle) q = q.eq('ciclo_id', activeCycle.id);
          return q.in('grupo', filterGroups);
        }
        if (activeCycle) q = q.eq('ciclo_id', activeCycle.id);
        return q;
      };

      // Obtener el conteo REAL de riesgo alto directamente de la DB (sin límites)
      let highRiskQuery = supabase.from('estudiantes').select('*', { count: 'exact', head: true }).eq('nivel_riesgo', 'HIGH');
      highRiskQuery = applyRiskFilter(highRiskQuery);
      const { count: hrCount } = await highRiskQuery;
      setTotalHighRisk(hrCount || 0);

      let mediumRiskQuery = supabase.from('estudiantes').select('*', { count: 'exact', head: true }).eq('nivel_riesgo', 'MEDIUM');
      mediumRiskQuery = applyRiskFilter(mediumRiskQuery);
      const { count: mrCount } = await mediumRiskQuery;
      setTotalMediumRisk(mrCount || 0);

      let lowRiskQuery = supabase.from('estudiantes').select('*', { count: 'exact', head: true }).eq('nivel_riesgo', 'LOW');
      lowRiskQuery = applyRiskFilter(lowRiskQuery);
      const { count: lrCount } = await lowRiskQuery;
      setTotalLowRisk(lrCount || 0);

      // Ejecutar consulta principal con ordenamiento (HIGH primero alfabéticamente)
      const { data, error, count } = await query
        .order('nivel_riesgo', { ascending: true })
        .limit(200);

      if (error) throw error;

      setTotalEnrollment(count || 0);
      setStudents((data || []).map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as RiskLevel,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || []
      })));
    } catch (err) {
      console.error("Error al obtener estudiantes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [userId, role]);

  const statsData = [
    { name: 'Bajo', value: totalLowRisk, color: RISK_CHART_COLORS.LOW },
    { name: 'Medio', value: totalMediumRisk, color: RISK_CHART_COLORS.MEDIUM },
    { name: 'Alto', value: totalHighRisk, color: RISK_CHART_COLORS.HIGH },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
      <div className="bg-[#003B5C] p-8 sm:p-12 rounded-xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-[0.1] pointer-events-none select-none">
          <img src={uasEscudo} alt="" className="w-full h-full object-contain" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="text-center lg:text-left">
            <div className="flex flex-col lg:flex-row items-center gap-4 mb-6">
              <div className="w-24 h-24 bg-white rounded-xl p-2 shadow-lg flex items-center justify-center border border-gray-100">
                <img src={fcqbLogo} alt="FCQB" className="max-w-full max-h-full object-contain" />
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">
                  {role === UserRole.ADMIN ? 'Gestión Centralizada' : role === UserRole.TUTOR ? 'Panel de Tutoría' : 'Control Docente'}
                </h2>
                <p className="text-[#FFD100] text-xs font-black uppercase tracking-[0.3em]">Facultad de Ciencias Químico Biológicas</p>
              </div>
            </div>

            <p className="text-blue-100 text-sm sm:text-lg font-medium max-w-2xl opacity-80 leading-relaxed">
              {role === UserRole.TUTOR
                ? `Estás visualizando exclusivamente el seguimiento académico de tus grupos asignados: ${tutorGroupName || '...'}.`
                : totalHighRisk > 0
                  ? `Atención prioritaria: Se detectaron ${totalHighRisk} estudiantes en situación de riesgo alto institucional.`
                  : "La trayectoria académica de la matrícula asignada se mantiene estable."}
            </p>

            {role === UserRole.DOCENTE && (
              <div className="mt-6 flex justify-center lg:justify-start">
                <button
                  onClick={() => setShowTeacherCertificateModal(true)}
                  className="inline-flex items-center gap-3 bg-[#FFD100] text-[#003B5C] px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white hover:shadow-2xl transition-all active:scale-95 border-2 border-transparent hover:border-[#FFD100] group shadow-lg"
                >
                  <span className="text-xl group-hover:rotate-12 transition-transform">📄</span>
                  <span>Descargar Constancia PDF (2025-2026-2)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: role === UserRole.TUTOR ? 'Mis Tutorados' : 'Matrícula Cargo', value: totalEnrollment, icon: '🎓', color: UAS_COLORS.NAVY },
          { label: 'Riesgo Alto', value: totalHighRisk, icon: '⚠️', color: '#ef4444' },
          { label: 'Asistencia Gral', value: `${students.length ? Math.round(students.reduce((a, b) => a + b.attendance, 0) / students.length) : 0}%`, icon: '📊', color: '#10b981' },
          { label: 'Promedio Gral', value: students.length ? (students.reduce((a, b) => a + b.average, 0) / students.length).toFixed(1) : '0.0', icon: '📈', color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 group hover:shadow-md transition-all">
            <div className="flex justify-between items-center mb-4">
              <span className="text-2xl">{stat.icon}</span>
              <div className="h-1 w-8 bg-[#FFD100] rounded-full"></div>
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-1">{stat.value}</h3>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-black text-[#003B5C] tracking-tight">Estudiantes Bajo Observación</h3>
              <button onClick={fetchStudents} className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">Refrescar Listado</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white text-[9px] font-black uppercase text-gray-400 border-b">
                  <tr>
                    <th className="px-8 py-4">Alumno</th>
                    <th className="px-8 py-4">Grupo</th>
                    <th className="px-8 py-4">Riesgo</th>
                    <th className="px-8 py-4 text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.slice(0, 10).map((student) => (
                    <tr key={student.id} className="hover:bg-blue-50/20 transition-all">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-[#003B5C] flex items-center justify-center text-white font-black text-[10px]`}>
                            {student.name.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900 text-xs">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-[10px] font-bold text-gray-500">{student.group}</td>
                      <td className="px-8 py-4">
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${RISK_COLORS[student.risk]}`}>
                          {RISK_LABELS[student.risk]}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => setSelectedStudent(student)} className="text-[#003B5C] text-[10px] font-black uppercase hover:underline font-bold">Abrir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-black text-[#003B5C] mb-6 tracking-tight">Distribución de Riesgo</h3>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statsData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {statsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-gray-900">{totalEnrollment}</span>
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Alumnos</span>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            {statsData.map((s, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest p-2 rounded-lg bg-gray-50">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                  {s.name}
                </span>
                <span>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedStudent && <StudentProfile student={selectedStudent} role={role} userId={userId} onClose={() => setSelectedStudent(null)} />}
      
      {showTeacherCertificateModal && (
        <TeacherCertificateModal userId={userId} onClose={() => setShowTeacherCertificateModal(false)} />
      )}
    </div>
  );
};

export default Dashboard;
