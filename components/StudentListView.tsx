
import React, { useState, useEffect, useMemo } from 'react';
import { CAREERS, RISK_COLORS, RISK_LABELS, calculateRisk } from '../constants';
import { Student, RiskLevel, UserRole, ActivityType } from '../types';
import { supabase } from '../services/supabaseClient';
import StudentProfile from './StudentProfile';

const StudentListView: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Estados para opciones de filtros dinámicos
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    career: 'ALL', 
    semester: 'ALL', 
    group: 'ALL', 
    search: ''
  });

  // 1. Obtener Semestres y Grupos disponibles según los filtros superiores
  const fetchFilterMetadata = async () => {
    try {
      let query = supabase.from('estudiantes').select('semestre, grupo');
      
      // Si es docente, solo ver sus grupos asignados
      if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = (groups || []).map(g => g.nombre_grupo);
        if (names.length > 0) query = query.in('grupo', names);
        else { 
          setAvailableSemesters([]); 
          setAvailableGroups([]); 
          return; 
        }
      }

      // Aplicar filtro de carrera para ver qué semestres y grupos hay
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      
      const { data } = await query;
      if (data) {
        // Semestres únicos disponibles para la carrera
        const uniqueSemesters = Array.from(new Set(data.map(i => Number(i.semestre)).filter(s => !isNaN(s)))).sort((a: number, b: number) => a - b);
        setAvailableSemesters(uniqueSemesters);

        // Grupos únicos disponibles (si ya se eligió semestre, filtrar grupos por ese semestre también)
        let filteredGroups = data;
        if (filters.semester !== 'ALL') {
          filteredGroups = data.filter(i => i.semestre === parseInt(filters.semester));
        }
        const uniqueGroups = Array.from(new Set(filteredGroups.map(i => i.grupo))).filter(g => !!g).sort();
        setAvailableGroups(uniqueGroups);
      }
    } catch (err) {
      console.error("Error al cargar metadatos de filtros:", err);
    }
  };

  // 2. Obtener la lista de alumnos final con promedios específicos
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
      if (filters.search.trim()) query = query.ilike('nombre', `%${filters.search.trim()}%`);

      const { data: studentsData, error } = await query.order('nombre', { ascending: true });
      if (error) throw error;

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const studentIds = studentsData.map(s => s.id);

      // Obtener calificaciones de estos alumnos vinculadas al tipo de actividad
      const { data: gradesData, error: gradesError } = await supabase
        .from('calificaciones')
        .select(`
          estudiante_id,
          calificacion,
          actividades (tipo)
        `)
        .in('estudiante_id', studentIds);

      if (gradesError) throw gradesError;

      const finalStudents = studentsData.map(s => {
        const studentGrades = gradesData?.filter(g => g.estudiante_id === s.id) || [];
        
        const calcAvg = (type: string) => {
          const filtered = studentGrades.filter(g => (g.actividades as any)?.tipo === type);
          if (filtered.length === 0) return 0;
          return filtered.reduce((acc, curr) => acc + Number(curr.calificacion), 0) / filtered.length;
        };

        return {
          id: s.id, 
          name: s.nombre, 
          career: s.carrera as any, 
          semester: s.semestre,
          group: s.grupo, 
          shift: s.turno as any, 
          average: Number(s.promedio_acumulado),
          attendance: s.porcentaje_asistencia, 
          risk: s.nivel_riesgo as RiskLevel,
          personalFactors: s.factores_personales || [], 
          academicFactors: s.factores_academicos || [],
          institutionalFactors: s.factores_institucionales || [],
          avgExams: calcAvg(ActivityType.EXAMEN),
          avgTasks: calcAvg(ActivityType.TAREA),
          avgExercises: calcAvg(ActivityType.EJERCICIO)
        };
      });

      setStudents(finalStudents);
    } catch (err) { 
      console.error("Error al cargar alumnos:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  // Efecto para manejar la cascada de filtros y limpieza de valores huerfanos
  useEffect(() => {
    fetchFilterMetadata();
  }, [filters.career, filters.semester, userId, role]);

  // Efecto para cargar los datos cuando cambie cualquier filtro
  useEffect(() => {
    fetchFilteredStudents();
  }, [filters.career, filters.semester, filters.group, filters.search, userId, role]);

  // Limpieza de filtros cuando cambia el padre
  useEffect(() => {
    if (filters.semester !== 'ALL' && !availableSemesters.includes(parseInt(filters.semester))) {
      setFilters(prev => ({ ...prev, semester: 'ALL' }));
    }
  }, [availableSemesters]);

  useEffect(() => {
    if (filters.group !== 'ALL' && !availableGroups.includes(filters.group)) {
      setFilters(prev => ({ ...prev, group: 'ALL' }));
    }
  }, [availableGroups]);

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
    } catch (err) { 
      console.error(err); 
    } finally { 
      setSyncing(false); 
    }
  };

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
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Programa Educativo</label>
              <select 
                value={filters.career} 
                onChange={(e) => setFilters({...filters, career: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C] focus:ring-2 focus:ring-[#003B5C]/5"
              >
                <option value="ALL">TODAS LAS CARRERAS</option>
                {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Grado (Semestre)</label>
              <select 
                value={filters.semester} 
                onChange={(e) => setFilters({...filters, semester: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C] focus:ring-2 focus:ring-[#003B5C]/5"
              >
                <option value="ALL">TODOS LOS SEMESTRES</option>
                {availableSemesters.map(n => <option key={n} value={n}>{n}° Semestre</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">ID Grupo</label>
              <select 
                value={filters.group} 
                onChange={(e) => setFilters({...filters, group: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C] focus:ring-2 focus:ring-[#003B5C]/5"
                disabled={filters.semester === 'ALL' && filters.career === 'ALL'}
              >
                <option value="ALL">TODOS LOS GRUPOS</option>
                {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Buscador Nominal</label>
              <input 
                type="text" 
                placeholder="Nombre del alumno..." 
                value={filters.search} 
                onChange={(e) => setFilters({...filters, search: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-lg text-[10px] font-black outline-none focus:border-[#003B5C] focus:ring-2 focus:ring-[#003B5C]/5" 
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b border-gray-200 tracking-widest">
              <tr>
                <th className="px-8 py-5">Nombre Completo</th>
                <th className="px-8 py-5">Grupo / Sem.</th>
                <th className="px-8 py-5">Asistencia</th>
                <th className="px-6 py-5 text-center">Exámenes</th>
                <th className="px-6 py-5 text-center">Tareas</th>
                <th className="px-6 py-5 text-center">Ejercicios</th>
                <th className="px-8 py-5 text-center">Riesgo (Real)</th>
                <th className="px-8 py-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-20 text-center animate-pulse text-[10px] font-black uppercase text-gray-300 tracking-widest">Consultando base de datos FCQB...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={8} className="py-20 text-center text-gray-400 italic text-sm">No se encontraron alumnos con los criterios seleccionados.</td></tr>
              ) : (
                students.map((student) => {
                  const realRisk = calculateRisk(student.average, student.attendance);
                  const isOutdated = realRisk !== student.risk;

                  const getAvgColor = (val?: number) => {
                    if (!val || val === 0) return 'text-gray-300';
                    return val < 7.0 ? 'text-red-600' : 'text-gray-700';
                  };

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
                          <span className="text-[10px] font-bold text-gray-500">{student.semester}°</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-black ${student.attendance < 80 ? 'text-red-600' : 'text-gray-700'}`}>
                          {student.attendance}%
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`text-xs font-black ${getAvgColor(student.avgExams)}`}>
                          {student.avgExams ? student.avgExams.toFixed(1) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`text-xs font-black ${getAvgColor(student.avgTasks)}`}>
                          {student.avgTasks ? student.avgTasks.toFixed(1) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`text-xs font-black ${getAvgColor(student.avgExercises)}`}>
                          {student.avgExercises ? student.avgExercises.toFixed(1) : '-'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${RISK_COLORS[realRisk]}`}>
                            {RISK_LABELS[realRisk]}
                          </span>
                          {isOutdated && (
                            <span className="text-[8px] font-black text-orange-600 uppercase animate-pulse">Update Req.</span>
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
      {selectedStudent && <StudentProfile student={selectedStudent} role={role} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default StudentListView;
