
import React, { useState, useEffect } from 'react';
import { CAREERS, RISK_COLORS, RISK_LABELS, calculateRisk, UAS_COLORS } from '../constants';
import { Student, RiskLevel, UserRole } from '../types';
import { supabase } from '../services/supabaseClient';
import StudentProfile from './StudentProfile';

const StudentListView: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [filters, setFilters] = useState({
    career: 'ALL', semester: 'ALL', group: 'ALL', search: ''
  });

  const fetchFilteredGroups = async () => {
    try {
      let query = supabase.from('estudiantes').select('grupo');
      if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = (groups || []).map(g => g.nombre_grupo);
        if (names.length > 0) query = query.in('grupo', names);
        else { setAvailableGroups([]); return; }
      }
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      const { data } = await query;
      if (data) {
        const unique = Array.from(new Set(data.map((item: any) => item.grupo as string))).filter(g => !!g).sort();
        setAvailableGroups(unique);
      }
    } catch (err) { console.error(err); }
  };

  const fetchFilteredStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*');
      if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = (groups || []).map(g => g.nombre_grupo);
        if (names.length > 0) query = query.in('grupo', names);
        else { setStudents([]); setLoading(false); return; }
      }
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      if (filters.group !== 'ALL') query = query.eq('grupo', filters.group);
      if (filters.search) query = query.ilike('nombre', `%${filters.search}%`);

      const { data, error } = await query.order('nombre', { ascending: true });
      if (error) throw error;

      setStudents((data || []).map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as RiskLevel,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || []
      })));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleGlobalSync = async () => {
    if (!confirm("Se recalculará el riesgo basándose en el promedio de actividades y porcentaje de asistencia real. ¿Continuar?")) return;
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
      alert(`✅ Sincronización completa. Se actualizaron ${updatedCount} alumnos.`);
      fetchFilteredStudents();
    } catch (err) { console.error(err); } finally { setSyncing(false); }
  };

  useEffect(() => { fetchFilteredGroups(); }, [filters.career, filters.semester, userId, role]);
  useEffect(() => { fetchFilteredStudents(); }, [filters.career, filters.semester, filters.group, userId, role]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-black text-[#003B5C] tracking-tighter mb-1">Listado de Matrícula</h2>
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest flex items-center gap-2">
                 Control de Trayectoria Escolar • FCQB
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={handleGlobalSync}
                disabled={syncing || students.length === 0}
                className="bg-[#003B5C] text-white px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#005689] transition-all disabled:opacity-50 shadow-md"
              >
                {syncing ? 'Sincronizando...' : 'Recalcular Riesgos'}
              </button>
              <div className="bg-[#FFD100] text-[#003B5C] px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {students.length} Alumnos
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <select value={filters.career} onChange={(e) => setFilters({...filters, career: e.target.value})} className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C]">
              <option value="ALL">TODAS LAS CARRERAS</option>
              {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.semester} onChange={(e) => setFilters({...filters, semester: e.target.value})} className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C]">
              <option value="ALL">TODOS LOS SEMESTRES</option>
              {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}° Semestre</option>)}
            </select>
            <select value={filters.group} onChange={(e) => setFilters({...filters, group: e.target.value})} className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C]">
              <option value="ALL">TODOS LOS GRUPOS</option>
              {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="text" placeholder="Búsqueda por nombre..." value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C]" />
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b border-gray-200 tracking-widest">
              <tr>
                <th className="px-8 py-5">Nombre Completo</th>
                <th className="px-8 py-5">Grupo / Semestre</th>
                <th className="px-8 py-5">Asistencia</th>
                <th className="px-8 py-5">Promedio Act.</th>
                <th className="px-8 py-5 text-center">Riesgo (Real)</th>
                <th className="px-8 py-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center animate-pulse text-[10px] font-black uppercase text-gray-300 tracking-widest">Consultando base de datos FCQB...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic text-sm">No se encontraron alumnos con los criterios seleccionados.</td></tr>
              ) : (
                students.map((student) => {
                  // CÁLCULO DINÁMICO DE RIESGO PARA LA VISTA
                  const realRisk = calculateRisk(student.average, student.attendance);
                  const isOutdated = realRisk !== student.risk;

                  return (
                    <tr key={student.id} className={`hover:bg-gray-50/80 transition-all ${isOutdated ? 'bg-orange-50/20' : ''}`}>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-white text-xs ${RISK_COLORS[realRisk].split(' ')[0]}`}>
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{student.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#003B5C] uppercase">{student.group}</span>
                          <span className="text-[10px] font-bold text-gray-500">{student.semester}° Semestre</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-black ${student.attendance < 80 ? 'text-red-600' : 'text-gray-700'}`}>
                          {student.attendance}%
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-black ${student.average < 7.0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {student.average.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${RISK_COLORS[realRisk]}`}>
                            {RISK_LABELS[realRisk]}
                          </span>
                          {isOutdated && (
                            <span className="text-[8px] font-black text-orange-600 uppercase animate-pulse">Desactualizado</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => setSelectedStudent(student)} 
                          className="bg-[#FFD100] text-[#003B5C] px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#003B5C] hover:text-white transition-all shadow-sm"
                        >
                          Expediente
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedStudent && <StudentProfile student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default StudentListView;
