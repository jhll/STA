
import React, { useState, useEffect } from 'react';
import { CAREERS, RISK_COLORS, RISK_LABELS, calculateRisk } from '../constants';
import { Student, RiskLevel, UserRole, ActivityType } from '../types';
import { supabase } from '../services/supabaseClient';
import StudentProfile from './StudentProfile';

const StudentListView: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [tutorGroup, setTutorGroup] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    career: 'ALL', 
    semester: 'ALL', 
    group: 'ALL', 
    search: ''
  });

  // 1. Sincronizar Metadatos de Filtros (Carrera -> Semestre -> Grupo)
  const syncFilters = async () => {
    setMetaLoading(true);
    try {
      // Obtener semestres únicos basados en carrera
      let semQuery = supabase.from('estudiantes').select('semestre');
      if (filters.career !== 'ALL') semQuery = semQuery.eq('carrera', filters.career);
      
      const { data: semData } = await semQuery;
      
      // Fix: Add type assertion to number for uniqueSemesters calculation to prevent 'unknown' arithmetic errors
      const uniqueSemesters = Array.from(new Set((semData?.map(s => s.semestre) || []) as number[])).sort((a, b) => a - b);
      setAvailableSemesters(uniqueSemesters.length > 0 ? uniqueSemesters : [1,2,3,4,5,6,7,8,9,10]);

      // Obtener grupos únicos basados en carrera y semestre
      let groupQuery = supabase.from('estudiantes').select('grupo');
      if (role === UserRole.TUTOR) {
        const { data: tutoria } = await supabase.from('tutorias').select('nombre_grupo').eq('tutor_id', userId).maybeSingle();
        if (tutoria) {
          setAvailableGroups([tutoria.nombre_grupo]);
          setTutorGroup(tutoria.nombre_grupo);
          setFilters(prev => ({ ...prev, group: tutoria.nombre_grupo }));
        }
      } else {
        if (filters.career !== 'ALL') groupQuery = groupQuery.eq('carrera', filters.career);
        if (filters.semester !== 'ALL') groupQuery = groupQuery.eq('semestre', parseInt(filters.semester));
        
        const { data: groupData } = await groupQuery;
        
        // Fix: Add type assertion to string for uniqueGroups calculation to prevent 'unknown' assignment errors
        const uniqueGroups = Array.from(new Set((groupData?.map(g => g.grupo) || []) as string[])).sort();
        setAvailableGroups(uniqueGroups);
      }
    } catch (err) {
      console.error("Error al sincronizar filtros:", err);
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchFilteredStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });
      
      // Seguridad por rol
      if (role === UserRole.TUTOR) {
        if (tutorGroup) query = query.eq('grupo', tutorGroup);
        else return; // Esperar a que el tutorGroup cargue
      } else if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = Array.from(new Set((groups || []).map(g => g.nombre_grupo)));
        if (names.length > 0) query = query.in('grupo', names);
        else { setStudents([]); setLoading(false); return; }
      }

      // Aplicar filtros de UI
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      if (filters.group !== 'ALL' && role !== UserRole.TUTOR) query = query.eq('grupo', filters.group);
      
      if (filters.search.trim()) {
        query = query.ilike('nombre', `%${filters.search.trim()}%`);
      }

      const { data, error, count } = await query.order('nombre', { ascending: true }).limit(100);
      if (error) throw error;

      setTotalCount(count || 0);
      
      if (!data) { setStudents([]); return; }

      // Mapeo dinámico de riesgo y promedios
      const studentIds = data.map(s => s.id);
      const { data: gradesData } = await supabase
        .from('calificaciones')
        .select('estudiante_id, calificacion, actividades(tipo)')
        .in('estudiante_id', studentIds);

      const finalStudents = data.map(s => {
        const studentGrades = gradesData?.filter(g => g.estudiante_id === s.id) || [];
        const calcAvg = (type: string) => {
          const filtered = studentGrades.filter(g => (g.actividades as any)?.tipo === type);
          return filtered.length === 0 ? 0 : filtered.reduce((acc, curr) => acc + Number(curr.calificacion), 0) / filtered.length;
        };

        const currentAvg = Number(s.promedio_acumulado);
        return {
          id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre, group: s.grupo, shift: s.turno as any,
          average: currentAvg, attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as RiskLevel,
          personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [], institutionalFactors: s.factores_institucionales || [],
          avgExams: calcAvg(ActivityType.EXAMEN), avgTasks: calcAvg(ActivityType.TAREA), avgExercises: calcAvg(ActivityType.EJERCICIO),
          ciclo_id: s.ciclo_id
        };
      });
      setStudents(finalStudents);
    } catch (err) { 
      console.error("Error al cargar matrícula:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const resetFilters = () => {
    setFilters({ career: 'ALL', semester: 'ALL', group: 'ALL', search: '' });
  };

  // Sincronizar filtros cuando cambia la carrera o el semestre
  useEffect(() => { 
    syncFilters(); 
  }, [userId, role, filters.career, filters.semester]);

  // Cargar estudiantes cuando cambia cualquier filtro
  useEffect(() => { 
    fetchFilteredStudents(); 
  }, [filters, tutorGroup]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 sm:p-12 bg-gray-50/50 border-b border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h2 className="text-4xl font-black text-[#003B5C] tracking-tighter mb-2">Listado de Matrícula</h2>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                {role === UserRole.TUTOR ? `Visualizando Tutorados: Grupo ${tutorGroup}` : 'FCQB • Control de Trayectoria Escolar'}
              </p>
            </div>
            <button 
              onClick={resetFilters}
              className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all shadow-sm"
            >
              🔄 Limpiar Filtros
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Licenciatura</label>
              <select 
                value={filters.career} 
                onChange={e => setFilters({...filters, career: e.target.value, semester: 'ALL', group: 'ALL'})} 
                className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer"
              >
                  <option value="ALL">TODAS LAS CARRERAS</option>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
              <select 
                value={filters.semester} 
                onChange={e => setFilters({...filters, semester: e.target.value, group: 'ALL'})} 
                className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer"
              >
                  <option value="ALL">TODOS</option>
                  {availableSemesters.map(n => <option key={n} value={n}>{n}° Semestre</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo</label>
              <select 
                value={filters.group} 
                onChange={e => setFilters({...filters, group: e.target.value})} 
                disabled={role === UserRole.TUTOR || metaLoading}
                className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-blue-500/5 transition-all disabled:opacity-50 appearance-none cursor-pointer"
              >
                  {role !== UserRole.TUTOR && <option value="ALL">TODOS LOS GRUPOS</option>}
                  {availableGroups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Búsqueda Inteligente</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Matrícula o nombre..." 
                  value={filters.search} 
                  onChange={e => setFilters({...filters, search: e.target.value})} 
                  className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all pr-12" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">🔍</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-[#003B5C]/5 text-[11px] font-black uppercase text-[#003B5C] border-b tracking-widest">
              <tr>
                <th className="px-10 py-6">Estudiante / Matrícula</th>
                <th className="px-10 py-6">Programa Académico</th>
                <th className="px-8 py-6 text-center">Asistencia</th>
                <th className="px-8 py-6 text-center">Promedio</th>
                <th className="px-10 py-6 text-center">Semáforo</th>
                <th className="px-10 py-6 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="text-gray-300 font-black uppercase text-[10px] tracking-widest">Consultando registros...</span>
                  </div>
                </td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={6} className="py-32 text-center">
                  <span className="text-gray-300 font-black uppercase text-lg tracking-widest opacity-50">No se encontraron estudiantes con estos criterios</span>
                </td></tr>
              ) : students.map((student) => (
                <tr key={student.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">{student.name}</span>
                      <span className="text-[10px] font-mono text-gray-400 font-black uppercase tracking-widest">{student.id}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-[#003B5C] uppercase tracking-tighter">{student.career}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{student.semester}° Semestre • Grupo {student.group}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[12px] font-black ${student.attendance < 80 ? 'text-red-600' : 'text-gray-700'}`}>
                        {student.attendance}%
                      </span>
                      <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full ${student.attendance < 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${student.attendance}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center font-black text-gray-900">{student.average.toFixed(1)}</td>
                  <td className="px-10 py-6 text-center">
                    <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase border shadow-sm transition-all ${RISK_COLORS[student.risk]}`}>
                      {RISK_LABELS[student.risk]}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => setSelectedStudent(student)} 
                      className="bg-gray-100 text-gray-500 px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#003B5C] hover:text-white transition-all shadow-sm"
                    >
                      Ver Ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mostrando {students.length} de {totalCount} registros</p>
           <div className="flex gap-2">
              <button disabled className="p-3 rounded-xl bg-white border border-gray-200 text-gray-300 opacity-50">←</button>
              <button disabled className="p-3 rounded-xl bg-white border border-gray-200 text-gray-300 opacity-50">→</button>
           </div>
        </div>
      </div>
      {selectedStudent && <StudentProfile student={selectedStudent} role={role} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default StudentListView;
