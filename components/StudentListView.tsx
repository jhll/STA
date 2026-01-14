
import React, { useState, useEffect, useMemo } from 'react';
import { CAREERS, RISK_COLORS, RISK_LABELS, calculateRisk } from '../constants';
import { Student, RiskLevel, UserRole, ActivityType } from '../types';
import { supabase } from '../services/supabaseClient';
import StudentProfile from './StudentProfile';

const StudentListView: React.FC<{ role: UserRole; userId: string }> = ({ role, userId }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    career: 'ALL', 
    semester: 'ALL', 
    group: 'ALL', 
    search: ''
  });

  // Obtener semestres y grupos de forma sincronizada
  const fetchFilterMetadata = async () => {
    try {
      // 1. Obtener Semestres para la Carrera Seleccionada
      // Consultamos la tabla de materias para saber qué semestres existen realmente en ese programa
      let semQuery = supabase.from('materias').select('semestre');
      if (filters.career !== 'ALL') {
        semQuery = semQuery.eq('carrera', filters.career);
      }
      
      const { data: semData } = await semQuery;
      let uniqueSemesters: number[] = [];
      if (semData && semData.length > 0) {
        // Fix: Explicitly type the mapping and sorting to avoid 'unknown' errors
        uniqueSemesters = Array.from(new Set(semData.map((i: any) => Number(i.semestre)))).sort((a: number, b: number) => a - b);
      } else {
        // Fallback si no hay materias cargadas aún
        uniqueSemesters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      }
      setAvailableSemesters(uniqueSemesters);

      // 2. Obtener Grupos disponibles según Carrera y Semestre
      // Buscamos en la tabla de estudiantes para ver qué grupos tienen alumnos inscritos
      let groupQuery = supabase.from('estudiantes').select('grupo');
      
      // Si es docente, solo puede ver grupos asignados a él
      if (role === UserRole.DOCENTE) {
        const { data: teacherGroups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = (teacherGroups || []).map(g => g.nombre_grupo);
        if (names.length > 0) {
          groupQuery = groupQuery.in('grupo', names);
        } else {
          setAvailableGroups([]);
          return;
        }
      }

      if (filters.career !== 'ALL') groupQuery = groupQuery.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') groupQuery = groupQuery.eq('semestre', parseInt(filters.semester));
      
      // Obtenemos los grupos únicos. Usamos un límite alto para cubrir toda la matrícula
      const { data: groupData } = await groupQuery.limit(5000);
      
      if (groupData) {
        // Fix: Explicitly type mapping and ensure g is string for localeCompare
        const uniqueGroups = Array.from(new Set(groupData.map((i: any) => i.grupo as string)))
          .filter((g): g is string => !!g)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        setAvailableGroups(uniqueGroups);
      }
    } catch (err) { 
      console.error("Error en sincronización de filtros:", err); 
    }
  };

  const fetchFilteredStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });
      
      if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const names = (groups || []).map(g => g.nombre_grupo);
        if (names.length > 0) {
          query = query.in('grupo', names);
        } else {
          setStudents([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      if (filters.group !== 'ALL') query = query.eq('grupo', filters.group);
      
      if (filters.search.trim()) {
        query = query.ilike('nombre', `%${filters.search.trim()}%`);
      }

      const { data, error, count } = await query.order('nombre', { ascending: true }).limit(200);
      if (error) throw error;

      setTotalCount(count || 0);
      
      if (!data || data.length === 0) {
        setStudents([]);
        return;
      }

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
        return {
          id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre, group: s.grupo, shift: s.turno as any,
          average: Number(s.promedio_acumulado), attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as RiskLevel,
          personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [], institutionalFactors: s.factores_institucionales || [],
          avgExams: calcAvg(ActivityType.EXAMEN), avgTasks: calcAvg(ActivityType.TAREA), avgExercises: calcAvg(ActivityType.EJERCICIO)
        };
      });
      setStudents(finalStudents);
    } catch (err) { 
      console.error("Error al filtrar estudiantes:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  // Re-sincronizar metadatos de filtros cuando cambian las selecciones padre
  useEffect(() => { 
    fetchFilterMetadata(); 
  }, [filters.career, filters.semester, userId, role]);

  // Ejecutar búsqueda cuando cambie cualquier parámetro de filtrado
  useEffect(() => { 
    fetchFilteredStudents(); 
  }, [filters.career, filters.semester, filters.group, filters.search, userId, role]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-black text-[#003B5C] tracking-tighter mb-1">Listado de Matrícula</h2>
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">FCQB • Matrícula Base: {totalCount} Alumnos</p>
            </div>
            <div className="bg-[#FFD100] text-[#003B5C] px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
              Vista Actual: {students.length} alumnos
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro 1: Carrera */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Licenciatura</label>
              <select 
                value={filters.career} 
                onChange={e => setFilters({...filters, career: e.target.value, semester: 'ALL', group: 'ALL'})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              >
                  <option value="ALL">TODAS LAS CARRERAS</option>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Filtro 2: Semestre (Sincronizado con Carrera) */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Ciclo/Semestre</label>
              <select 
                value={filters.semester} 
                onChange={e => setFilters({...filters, semester: e.target.value, group: 'ALL'})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              >
                  <option value="ALL">TODOS LOS SEMESTRES</option>
                  {availableSemesters.map(n => <option key={n} value={n}>{n}° Semestre</option>)}
              </select>
            </div>

            {/* Filtro 3: Grupo (Sincronizado con Carrera y Semestre) */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo Específico</label>
              <select 
                value={filters.group} 
                onChange={e => setFilters({...filters, group: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              >
                  <option value="ALL">TODOS LOS GRUPOS</option>
                  {availableGroups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
              </select>
            </div>

            {/* Filtro 4: Búsqueda Nominal */}
            <div className="space-y-1">
              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Búsqueda Rápida</label>
              <input 
                type="text" 
                placeholder="Nombre del alumno..." 
                value={filters.search} 
                onChange={e => setFilters({...filters, search: e.target.value})} 
                className="w-full bg-white border border-gray-200 p-3 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-blue-500/10 transition-all" 
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b tracking-widest">
              <tr>
                <th className="px-8 py-5">Nombre y Matrícula</th>
                <th className="px-8 py-5">Ubicación Académica</th>
                <th className="px-8 py-5">Asistencia</th>
                <th className="px-6 py-5 text-center">Exámenes</th>
                <th className="px-6 py-5 text-center">Tareas</th>
                <th className="px-8 py-5 text-center">Riesgo</th>
                <th className="px-8 py-5 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-20 text-center animate-pulse text-[10px] font-black text-gray-300 uppercase tracking-widest">Consultando base de datos FCQB...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">No se encontraron registros coincidentes</td></tr>
              ) : students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50/80 transition-all">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                       <span className="font-bold text-gray-900 text-sm">{student.name}</span>
                       <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{student.id}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-[#003B5C]">{student.group}</span>
                       <span className="text-[8px] font-black text-gray-400 uppercase">{student.career}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                       <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${student.attendance < 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${student.attendance}%` }}></div>
                       </div>
                       <span className="text-xs font-black">{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center text-xs font-black text-blue-600">{student.avgExams ? student.avgExams.toFixed(1) : '-'}</td>
                  <td className="px-6 py-5 text-center text-xs font-black text-indigo-600">{student.avgTasks ? student.avgTasks.toFixed(1) : '-'}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${RISK_COLORS[calculateRisk(student.average, student.attendance)]}`}>
                      {RISK_LABELS[calculateRisk(student.average, student.attendance)]}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => setSelectedStudent(student)} className="bg-[#FFD100] text-[#003B5C] px-5 py-2 rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-[#003B5C] hover:text-white transition-all">Ver Expediente</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedStudent && <StudentProfile student={selectedStudent} role={role} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default StudentListView;
