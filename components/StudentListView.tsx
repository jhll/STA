
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
  const [tutorGroups, setTutorGroups] = useState<string[]>([]);
  const [tutorStudentIds, setTutorStudentIds] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    career: 'ALL',
    semester: 'ALL',
    group: 'ALL',
    search: ''
  });

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const syncFilters = async () => {
    setMetaLoading(true);
    try {
      let semQuery = supabase.from('estudiantes').select('semestre');
      if (filters.career !== 'ALL') semQuery = semQuery.eq('carrera', filters.career);
      const { data: semData } = await semQuery;
      const uniqueSemesters = Array.from(new Set((semData?.map(s => s.semestre) || []) as number[])).sort((a, b) => a - b);
      setAvailableSemesters(uniqueSemesters.length > 0 ? uniqueSemesters : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      if (role === UserRole.TUTOR) {
        // Obtener todos los grupos donde es tutor Y los estudiantes asignados individualmente
        const { data: tutorias } = await supabase
          .from('tutorias')
          .select('nombre_grupo, estudiante_id')
          .eq('tutor_id', userId);

        const groupNames = Array.from(new Set((tutorias?.map(t => t.nombre_grupo).filter(Boolean) || []) as string[])).sort();
        const studentIds = Array.from(new Set((tutorias?.map(t => t.estudiante_id).filter(Boolean) || []) as string[]));

        setTutorGroups(groupNames);
        setTutorStudentIds(studentIds);

        // Si hay estudiantes individuales, obtener sus grupos para agregarlos al filtro
        let extraGroups: string[] = [];
        if (studentIds.length > 0) {
          const { data: stGroups } = await supabase.from('estudiantes').select('grupo').in('id', studentIds);
          extraGroups = (stGroups || []).map(s => s.grupo);
        }

        const allGroups = Array.from(new Set([...groupNames, ...extraGroups])).sort();
        setAvailableGroups(allGroups);

      } else if (role === UserRole.DOCENTE) {
        const { data: teacherGroups } = await supabase.from('grupos').select('nombre_grupo').eq('docente_id', userId);
        const teacherGroupNames = Array.from(new Set((teacherGroups?.map(g => g.nombre_grupo) || []) as string[])).sort();
        setAvailableGroups(teacherGroupNames);
      } else {
        let groupQuery = supabase.from('estudiantes').select('grupo');
        if (filters.career !== 'ALL') groupQuery = groupQuery.eq('carrera', filters.career);
        if (filters.semester !== 'ALL') groupQuery = groupQuery.eq('semestre', parseInt(filters.semester));
        const { data: groupData } = await groupQuery;
        const uniqueGroups = Array.from(new Set((groupData?.map(g => g.grupo) || []) as string[])).sort();
        setAvailableGroups(uniqueGroups);
      }
    } catch (err) { console.error(err); } finally { setMetaLoading(false); }
  };

  const fetchFilteredStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });

      let teacherGroupIds: string[] = [];

      if (role === UserRole.TUTOR) {
        // Construir query OR para grupos asignados o estudiantes individuales
        const orConditions: string[] = [];

        // 1. Grupos asignados
        if (tutorGroups.length > 0) {
          // Usamos filter format para .or()
          // grupo.in.("G1","G2")
          const groupsStr = tutorGroups.map(g => `"${g}"`).join(',');
          orConditions.push(`grupo.in.(${groupsStr})`);
        }

        // 2. Estudiantes asignados individualmente
        if (tutorStudentIds.length > 0) {
          const idsStr = tutorStudentIds.map(id => `"${id}"`).join(',');
          orConditions.push(`id.in.(${idsStr})`);
        }

        if (orConditions.length === 0) {
          setStudents([]); setLoading(false); return;
        }

        // Aplicamos el OR
        query = query.or(orConditions.join(','));

      } else if (role === UserRole.DOCENTE) {
        const { data: groups } = await supabase.from('grupos').select('id, nombre_grupo').eq('docente_id', userId);
        const names = Array.from(new Set((groups || []).map(g => g.nombre_grupo)));
        teacherGroupIds = (groups || []).map(g => g.id);

        if (names.length > 0) {
          query = query.in('grupo', names);
        } else {
          setStudents([]); setLoading(false); return;
        }
      }
      // ADMIN doesn't have base restrictions, proceeds to filters directly

      // Filtros de UI
      if (filters.group !== 'ALL') query = query.eq('grupo', filters.group);
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      if (filters.search) {
        // Buscador simple
        const term = filters.search.toUpperCase();
        query = query.or(`nombre.ilike.%${term}%,id.ilike.%${term}%`);
      }

      // Pagination Loop to fetch all records
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await query
          .order('nombre', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        // Only set total count once or update it
        if (count !== null) setTotalCount(count);

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) { setStudents([]); return; }

      const studentIds = allData.map(s => s.id);

      // Fetch grades and attendance for ALL fetched students
      // Warning: If studentIds is very large, this might hit URL length limits or query params limits.
      // But 1500 IDs is roughly 15KB, might be okay for POST/body but GET might fail.
      // Supabase .in() handles this? Usually yes.
      // Optimally we should chunk this too if > 1000 IDs? 
      // Let's assume 2000 is safe-ish for now or implement chunks for relations too.
      // For safety, let's chunk the relation fetches.

      const fetchRelationsInChunks = async (ids: string[], table: string, select: string, foreignKey: string) => {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 1000) {
          chunks.push(ids.slice(i, i + 1000));
        }
        const results = await Promise.all(chunks.map(chunk =>
          supabase.from(table).select(select).in(foreignKey, chunk)
        ));
        return results.flatMap(r => r.data || []);
      };

      const [gradesData, attendanceData] = await Promise.all([
        fetchRelationsInChunks(studentIds, 'calificaciones', 'estudiante_id, calificacion, actividades(tipo, puntos_max, grupo_id)', 'estudiante_id'),
        fetchRelationsInChunks(studentIds, 'asistencias', 'estudiante_id, presente, grupo_id', 'estudiante_id')
      ]);

      const finalStudents = allData.map(s => {
        const studentGrades = gradesData.filter((g: any) => {
          if (role !== UserRole.DOCENTE) return g.estudiante_id === s.id;
          const act = getRelation(g.actividades);
          return g.estudiante_id === s.id && teacherGroupIds.includes(act?.grupo_id);
        });

        const studentAttendance = attendanceData.filter((a: any) => {
          if (role !== UserRole.DOCENTE) return a.estudiante_id === s.id;
          return a.estudiante_id === s.id && teacherGroupIds.includes(a.grupo_id);
        });

        const calcAvgByType = (type: string) => {
          const filtered = studentGrades.filter((g: any) => getRelation(g.actividades)?.tipo === type);
          if (filtered.length === 0) return 0;
          const total = filtered.reduce((acc: number, curr: any) => {
            const max = getRelation(curr.actividades)?.puntos_max || 10;
            return acc + (Number(curr.calificacion) / max) * 10;
          }, 0);
          return total / filtered.length;
        };

        const localAvg = studentGrades.length > 0
          ? studentGrades.reduce((acc: number, curr: any) => {
            const max = getRelation(curr.actividades)?.puntos_max || 10;
            return acc + (Number(curr.calificacion) / max) * 10;
          }, 0) / studentGrades.length
          : Number(s.promedio_acumulado);

        const localAttPerc = studentAttendance.length > 0
          ? (studentAttendance.filter((a: any) => a.presente).length / studentAttendance.length) * 100
          : s.porcentaje_asistencia;

        return {
          id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre, group: s.grupo, shift: s.turno as any,
          average: Number(localAvg.toFixed(2)),
          attendance: Math.round(localAttPerc),
          risk: calculateRisk(localAvg, localAttPerc),
          personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [], institutionalFactors: s.factores_institucionales || [],
          avgExams: calcAvgByType(ActivityType.EXAMEN), avgTasks: calcAvgByType(ActivityType.TAREA), avgExercises: calcAvgByType(ActivityType.EJERCICIO),
          ciclo_id: s.ciclo_id
        };
      });
      setStudents(finalStudents);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const resetFilters = () => setFilters({ career: 'ALL', semester: 'ALL', group: 'ALL', search: '' });

  useEffect(() => { syncFilters(); }, [userId, role, filters.career, filters.semester]);
  useEffect(() => { fetchFilteredStudents(); }, [filters, tutorGroups]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 sm:p-12 bg-gray-50/50 border-b border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div>
              <h2 className="text-4xl font-black text-[#003B5C] tracking-tighter mb-2">Listado de Matrícula</h2>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                {role === UserRole.TUTOR ? 'Control de Grupos Tutorados' : role === UserRole.DOCENTE ? 'Métricas basadas en tus asignaturas' : 'FCQB • Trayectoria Académica'}
              </p>
            </div>
            <button onClick={resetFilters} className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-all shadow-sm">🔄 Restablecer</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Licenciatura</label>
              <select value={filters.career} onChange={e => setFilters({ ...filters, career: e.target.value, semester: 'ALL', group: 'ALL' })} className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none appearance-none cursor-pointer">
                <option value="ALL">TODAS LAS CARRERAS</option>
                {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
              <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value, group: 'ALL' })} className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none appearance-none cursor-pointer">
                <option value="ALL">TODOS</option>
                {availableSemesters.map(n => <option key={n} value={n}>{n}° Semestre</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupos Asignados</label>
              <select
                value={filters.group}
                onChange={e => setFilters({ ...filters, group: e.target.value })}
                disabled={metaLoading}
                className="w-full bg-white border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none disabled:opacity-50 appearance-none cursor-pointer"
              >
                <option value="ALL">{role === UserRole.TUTOR ? 'TODOS MIS GRUPOS' : 'TODOS LOS GRUPOS'}</option>
                {availableGroups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-[#003B5C]/5 text-[11px] font-black uppercase text-[#003B5C] border-b tracking-widest">
              <tr>
                <th className="px-10 py-6">Estudiante</th>
                <th className="px-10 py-6">Programa</th>
                <th className="px-6 py-6 text-center">Asistencia Local</th>
                <th className="px-6 py-6 text-center">Exámenes</th>
                <th className="px-6 py-6 text-center">Tareas</th>
                <th className="px-6 py-6 text-center">Ejercicios</th>
                <th className="px-8 py-6 text-center">Riesgo Materia</th>
                <th className="px-10 py-6 text-right">Perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="text-gray-300 font-black uppercase text-[10px] tracking-widest">Cargando métricas...</span>
                  </div>
                </td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={8} className="py-32 text-center text-gray-300 font-black uppercase text-lg opacity-50">Sin registros encontrados</td></tr>
              ) : students.map((student) => (
                <tr key={student.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-10 py-6">
                    <div className="flex flex-col cursor-pointer hover:translate-x-1 transition-transform" onClick={() => setSelectedStudent(student)}>
                      <span className="font-bold text-gray-900 text-sm group-hover:text-blue-700 flex items-center gap-2">
                        {student.name}
                        <span className="opacity-0 group-hover:opacity-100 text-[10px]">👁️</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 font-black uppercase">{student.id}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-[#003B5C] uppercase">{student.career}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{student.semester}° • Grupo {student.group}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[12px] font-black ${student.attendance < 80 ? 'text-red-600' : 'text-gray-700'}`}>{student.attendance}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center font-bold text-gray-900 text-sm">{student.avgExams?.toFixed(1) || '0.0'}</td>
                  <td className="px-6 py-6 text-center font-bold text-gray-900 text-sm">{student.avgTasks?.toFixed(1) || '0.0'}</td>
                  <td className="px-6 py-6 text-center font-bold text-gray-900 text-sm">{student.avgExercises?.toFixed(1) || '0.0'}</td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border shadow-sm ${RISK_COLORS[student.risk]}`}>
                      {RISK_LABELS[student.risk]}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button onClick={() => setSelectedStudent(student)} className="bg-gray-100 text-gray-500 px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#003B5C] hover:text-white transition-all shadow-sm">Abrir Ficha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedStudent && <StudentProfile student={selectedStudent} role={role} userId={userId} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default StudentListView;
