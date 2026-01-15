import React, { useState, useEffect } from 'react';
import { RISK_COLORS, RISK_LABELS, calculateRisk, UAS_COLORS } from '../constants';
import { Student, RiskLevel, UserRole } from '../types';
import StudentProfile from './StudentProfile';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '../services/supabaseClient';

// Definición de rutas de activos como constantes de cadena
const uasEscudo = './images/uas_escudo.png';
const fcqbLogo = './images/fcqb_logo.png';

const Dashboard: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalEnrollment, setTotalEnrollment] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });
      
      if (role === UserRole.DOCENTE) {
        const { data: assignedGroups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const groupNames = (assignedGroups || []).map(g => g.nombre_grupo);
        if (groupNames.length > 0) {
          query = query.in('grupo', groupNames);
        } else {
          setStudents([]);
          setTotalEnrollment(0);
          setLoading(false);
          return;
        }
      }
      
      const { data, error, count } = await query.order('nivel_riesgo', { ascending: false }).limit(100);
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

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      let updatedCount = 0;
      for (const student of students) {
        const newRisk = calculateRisk(student.average, student.attendance);
        if (newRisk !== student.risk) {
          await supabase.from('estudiantes').update({ nivel_riesgo: newRisk }).eq('id', student.id);
          updatedCount++;
        }
      }
      if (updatedCount > 0) await fetchStudents();
      alert(`✅ Sincronización exitosa. Se actualizaron ${updatedCount} niveles de riesgo.`);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { 
    fetchStudents(); 
  }, [userId, role]);

  const statsData = [
    { name: 'Bajo', value: students.filter(s => s.risk === 'LOW').length, color: '#10b981' },
    { name: 'Medio', value: students.filter(s => s.risk === 'MEDIUM').length, color: '#f59e0b' },
    { name: 'Alto', value: students.filter(s => s.risk === 'HIGH').length, color: '#ef4444' },
  ];

  const highRiskCount = students.filter(s => s.risk === 'HIGH').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-500">
      {/* Banner Principal Docente */}
      {role === UserRole.DOCENTE && (
        <div className="bg-[#003B5C] p-8 sm:p-12 rounded-xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-[0.15] pointer-events-none select-none">
               <img src={uasEscudo} alt="" className="w-full h-full object-contain" />
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
              <div className="text-center lg:text-left">
                <div className="flex flex-col lg:flex-row items-center gap-4 mb-6">
                   <div className="w-24 h-24 bg-white rounded-xl p-2 shadow-lg flex items-center justify-center border border-gray-100">
                      <img src={fcqbLogo} alt="FCQB" className="max-w-full max-h-full object-contain" />
                   </div>
                   <div>
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tighter">Bienvenido, Docente FCQB</h2>
                      <p className="text-[#FFD100] text-xs font-black uppercase tracking-[0.3em]">Seguimiento de Trayectoria Académica</p>
                   </div>
                </div>
                
                <p className="text-blue-100 text-sm sm:text-lg font-medium max-w-2xl opacity-80 leading-relaxed">
                  {highRiskCount > 0 
                    ? `Atención: Se han detectado ${highRiskCount} estudiantes con métricas de riesgo alto en sus grupos asignados.` 
                    : "Los grupos bajo su tutoría muestran una trayectoria académica estable."}
                </p>
                
                <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-4">
                  <button 
                    onClick={handleQuickSync} 
                    disabled={syncing}
                    className="bg-[#FFD100] text-[#003B5C] px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    {syncing ? 'Procesando...' : 'Sincronizar Semáforos'}
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Grid de Métricas con Matrícula Real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Matrícula Total', value: totalEnrollment, icon: '🎓', color: UAS_COLORS.NAVY },
          { label: 'Riesgo Crítico', value: highRiskCount, icon: '⚠️', color: '#ef4444' },
          { label: 'Asistencia Gral.', value: `${students.length ? Math.round(students.reduce((a, b) => a + b.attendance, 0) / students.length) : 0}%`, icon: '📊', color: '#10b981' },
          { label: 'Promedio Gral.', value: students.length ? (students.reduce((a, b) => a + b.average, 0) / students.length).toFixed(1) : '0.0', icon: '📈', color: '#3b82f6' },
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
               <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-[#003B5C] tracking-tight">Estudiantes Prioritarios</h3>
               </div>
               <button onClick={fetchStudents} className="text-[10px] font-black uppercase text-blue-600 tracking-widest hover:underline">Refrescar</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white text-[9px] font-black uppercase text-gray-400 border-b">
                  <tr>
                    <th className="px-8 py-4">Estudiante</th>
                    <th className="px-8 py-4">Grupo</th>
                    <th className="px-8 py-4">Riesgo</th>
                    <th className="px-8 py-4 text-right">Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.slice(0, 8).map((student) => {
                    const realRisk = calculateRisk(student.average, student.attendance);
                    return (
                      <tr key={student.id} className="hover:bg-blue-50/20 transition-all">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#003B5C] flex items-center justify-center text-white font-black text-[10px]">
                              {student.name.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-900 text-xs">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-[10px] font-bold text-gray-500">{student.group}</td>
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${RISK_COLORS[realRisk]}`}>
                            {RISK_LABELS[realRisk]}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => setSelectedStudent(student)} className="text-[#003B5C] text-[10px] font-black uppercase hover:underline">Abrir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-lg font-black text-[#003B5C] mb-6 tracking-tight">Estatus de Matrícula</h3>
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
        </div>
      </div>

      {selectedStudent && <StudentProfile student={selectedStudent} role={role} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default Dashboard;