import React, { useState, useEffect, useMemo } from 'react';
import { CAREERS, RISK_COLORS, RISK_LABELS, calculateRisk, UAS_COLORS } from '../constants';
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
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [groupSubjectNames, setGroupSubjectNames] = useState<Record<string, string>>({});
  const [tutorGroups, setTutorGroups] = useState<string[]>([]);
  const [tutorStudentIds, setTutorStudentIds] = useState<string[]>([]);
  const [activeCycleName, setActiveCycleName] = useState<string>('');

  const [filters, setFilters] = useState({
    career: 'ALL',
    semester: 'ALL',
    group: 'ALL',
    search: ''
  });

  const [sortBy, setSortBy] = useState<
    'name_asc' | 'name_desc' | 'id_asc' | 'risk_desc' | 'average_desc' | 'average_asc' | 'attendance_desc' | 'attendance_asc'
  >('name_asc');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  const syncFilters = async () => {
    setMetaLoading(true);
    try {
      // 1. Obtener ciclo escolar activo
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id, nombre')
        .eq('es_activo', true)
        .maybeSingle();

      if (activeCycle?.nombre) {
        setActiveCycleName(activeCycle.nombre);
      }

      // 2. Obtener semestres disponibles
      let semQuery = supabase.from('estudiantes').select('semestre');
      if (filters.career !== 'ALL') semQuery = semQuery.eq('carrera', filters.career);
      const { data: semData } = await semQuery;
      const uniqueSemesters = Array.from(new Set((semData?.map(s => s.semestre) || []) as number[])).sort((a, b) => a - b);
      setAvailableSemesters(uniqueSemesters.length > 0 ? uniqueSemesters : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      if (role === UserRole.TUTOR) {
        const { data: tutorias } = await supabase
          .from('tutorias')
          .select('nombre_grupo, estudiante_id')
          .eq('tutor_id', userId);

        const groupNames = Array.from(new Set((tutorias?.map(t => t.nombre_grupo).filter(Boolean) || []) as string[])).sort();
        const studentIds = Array.from(new Set((tutorias?.map(t => t.estudiante_id).filter(Boolean) || []) as string[]));

        setTutorGroups(groupNames);
        setTutorStudentIds(studentIds);

        let extraGroups: string[] = [];
        if (studentIds.length > 0) {
          const { data: stGroups } = await supabase.from('estudiantes').select('grupo').in('id', studentIds);
          extraGroups = (stGroups || []).map(s => s.grupo);
        }

        const allGroups = Array.from(new Set([...groupNames, ...extraGroups])).sort();
        setAvailableGroups(allGroups);

        if (allGroups.length > 0) {
          let countQuery = supabase.from('estudiantes').select('grupo, id');
          const orConditions: string[] = [];
          if (groupNames.length > 0) orConditions.push(`grupo.in.(${groupNames.map(g => `"${g}"`).join(',')})`);
          if (studentIds.length > 0) orConditions.push(`id.in.(${studentIds.map(id => `"${id}"`).join(',')})`);
          if (orConditions.length > 0) countQuery = countQuery.or(orConditions.join(','));

          const { data: tutorStudents } = await countQuery;
          const counts: Record<string, number> = {};
          allGroups.forEach(g => {
            counts[g] = 0;
          });
          tutorStudents?.forEach(s => {
            if (s.grupo) counts[s.grupo] = (counts[s.grupo] || 0) + 1;
          });
          setGroupCounts(counts);
        } else {
          setGroupCounts({});
        }
      } else if (role === UserRole.DOCENTE) {
        let gQuery = supabase
          .from('grupos')
          .select('id, nombre_grupo, ciclo_id, materias (nombre, carrera, semestre)')
          .eq('docente_id', userId);

        if (activeCycle) {
          gQuery = gQuery.eq('ciclo_id', activeCycle.id);
        }

        const { data: teacherGroups } = await gQuery;
        const teacherGroupNames = Array.from(new Set((teacherGroups?.map(g => g.nombre_grupo) || []) as string[])).sort();
        setAvailableGroups(teacherGroupNames);

        const subjMap: Record<string, string> = {};
        teacherGroups?.forEach((tg: any) => {
          const mat = getRelation(tg.materias);
          if (tg.nombre_grupo && mat?.nombre && !subjMap[tg.nombre_grupo]) {
            subjMap[tg.nombre_grupo] = mat.nombre;
          }
        });
        setGroupSubjectNames(subjMap);

        if (teacherGroupNames.length > 0) {
          let countQuery = supabase.from('estudiantes').select('grupo');
          countQuery = countQuery.in('grupo', teacherGroupNames);
          if (activeCycle) {
            countQuery = countQuery.eq('ciclo_id', activeCycle.id);
          }
          const { data: groupStudentRows } = await countQuery;
          const counts: Record<string, number> = {};
          teacherGroupNames.forEach(g => {
            counts[g] = 0;
          });
          groupStudentRows?.forEach(row => {
            if (row.grupo) counts[row.grupo] = (counts[row.grupo] || 0) + 1;
          });
          setGroupCounts(counts);
        } else {
          setGroupCounts({});
        }
      } else {
        let groupQuery = supabase.from('estudiantes').select('grupo');
        if (filters.career !== 'ALL') groupQuery = groupQuery.eq('carrera', filters.career);
        if (filters.semester !== 'ALL') groupQuery = groupQuery.eq('semestre', parseInt(filters.semester));
        const { data: groupData } = await groupQuery;
        const uniqueGroups = Array.from(new Set((groupData?.map(g => g.grupo) || []) as string[])).sort();
        setAvailableGroups(uniqueGroups);

        const counts: Record<string, number> = {};
        uniqueGroups.forEach(g => {
          counts[g] = 0;
        });
        groupData?.forEach(row => {
          if (row.grupo) counts[row.grupo] = (counts[row.grupo] || 0) + 1;
        });
        setGroupCounts(counts);
      }
    } catch (err) {
      console.error('Error sincronizando filtros de matrícula:', err);
    } finally {
      setMetaLoading(false);
    }
  };

  const fetchFilteredStudents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('estudiantes').select('*', { count: 'exact' });
      let teacherGroupIds: string[] = [];

      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      if (role === UserRole.TUTOR) {
        const orConditions: string[] = [];
        if (tutorGroups.length > 0) {
          const groupsStr = tutorGroups.map(g => `"${g}"`).join(',');
          orConditions.push(`grupo.in.(${groupsStr})`);
        }
        if (tutorStudentIds.length > 0) {
          const idsStr = tutorStudentIds.map(id => `"${id}"`).join(',');
          orConditions.push(`id.in.(${idsStr})`);
        }
        if (orConditions.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }
        query = query.or(orConditions.join(','));
      } else if (role === UserRole.DOCENTE) {
        let gQuery = supabase.from('grupos').select('id, nombre_grupo, ciclo_id').eq('docente_id', userId);
        if (activeCycle) {
          gQuery = gQuery.eq('ciclo_id', activeCycle.id);
        }

        const { data: groups } = await gQuery;
        const names = Array.from(new Set((groups || []).map(g => g.nombre_grupo)));
        teacherGroupIds = (groups || []).map(g => g.id);

        if (names.length > 0) {
          query = query.in('grupo', names);
          if (activeCycle) {
            query = query.eq('ciclo_id', activeCycle.id);
          }
        } else {
          setStudents([]);
          setLoading(false);
          return;
        }
      }

      // Filtros de interfaz
      if (filters.group !== 'ALL') query = query.eq('grupo', filters.group);
      if (filters.career !== 'ALL') query = query.eq('carrera', filters.career);
      if (filters.semester !== 'ALL') query = query.eq('semestre', parseInt(filters.semester));
      if (filters.search) {
        const term = filters.search.toUpperCase();
        query = query.or(`nombre.ilike.%${term}%,id.ilike.%${term}%`);
      }

      // Paginación para obtener todos los registros que correspondan
      let allData: any[] = [];
      let page = 0;
      const pageSizeFetch = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await query
          .order('nombre', { ascending: true })
          .range(page * pageSizeFetch, (page + 1) * pageSizeFetch - 1);

        if (error) throw error;
        if (count !== null) setTotalCount(count);

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSizeFetch) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) {
        setStudents([]);
        return;
      }

      const studentIds = allData.map(s => s.id);

      // Chunks para calificaciones y asistencias
      const fetchRelationsInChunks = async (ids: string[], table: string, select: string, foreignKey: string) => {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 1000) {
          chunks.push(ids.slice(i, i + 1000));
        }
        const results = await Promise.all(
          chunks.map(chunk => supabase.from(table).select(select).in(foreignKey, chunk))
        );
        return results.flatMap(r => r.data || []);
      };

      const [gradesData, attendanceData] = await Promise.all([
        fetchRelationsInChunks(
          studentIds,
          'calificaciones',
          'estudiante_id, calificacion, actividades(tipo, puntos_max, grupo_id)',
          'estudiante_id'
        ),
        fetchRelationsInChunks(studentIds, 'asistencias', 'estudiante_id, presente, grupo_id', 'estudiante_id')
      ]);

      const finalStudents: Student[] = allData.map(s => {
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

        const localAvg =
          studentGrades.length > 0
            ? studentGrades.reduce((acc: number, curr: any) => {
                const max = getRelation(curr.actividades)?.puntos_max || 10;
                return acc + (Number(curr.calificacion) / max) * 10;
              }, 0) / studentGrades.length
            : Number(s.promedio_acumulado);

        const localAttPerc =
          studentAttendance.length > 0
            ? (studentAttendance.filter((a: any) => a.presente).length / studentAttendance.length) * 100
            : s.porcentaje_asistencia;

        return {
          id: s.id,
          name: s.nombre,
          career: s.carrera as any,
          semester: s.semestre,
          group: s.grupo,
          shift: s.turno as any,
          average: Number(localAvg.toFixed(2)),
          attendance: Math.round(localAttPerc),
          risk: calculateRisk(localAvg, localAttPerc),
          personalFactors: s.factores_personales || [],
          academicFactors: s.factores_academicos || [],
          institutionalFactors: s.factores_institucionales || [],
          avgExams: calcAvgByType(ActivityType.EXAMEN),
          avgTasks: calcAvgByType(ActivityType.TAREA),
          avgExercises: calcAvgByType(ActivityType.EJERCICIO),
          ciclo_id: s.ciclo_id
        };
      });

      setStudents(finalStudents);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error al consultar lista de estudiantes:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters({ career: 'ALL', semester: 'ALL', group: 'ALL', search: '' });
    setSortBy('name_asc');
    setCurrentPage(1);
  };

  useEffect(() => {
    syncFilters();
  }, [userId, role, filters.career, filters.semester]);

  useEffect(() => {
    fetchFilteredStudents();
  }, [filters, tutorGroups]);

  // Alumnos ordenados según el criterio seleccionado
  const processedStudents = useMemo(() => {
    let result = [...students];

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
        case 'id_asc':
          return a.id.localeCompare(b.id);
        case 'risk_desc': {
          const riskWeight = { [RiskLevel.HIGH]: 3, [RiskLevel.MEDIUM]: 2, [RiskLevel.LOW]: 1 };
          return riskWeight[b.risk] - riskWeight[a.risk];
        }
        case 'average_desc':
          return b.average - a.average;
        case 'average_asc':
          return a.average - b.average;
        case 'attendance_desc':
          return b.attendance - a.attendance;
        case 'attendance_asc':
          return a.attendance - b.attendance;
        default:
          return 0;
      }
    });

    return result;
  }, [students, sortBy]);

  // Métricas globales de la selección actual
  const stats = useMemo(() => {
    const total = students.length;
    if (total === 0) {
      return { total: 0, avgGrade: 0, avgAttendance: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 };
    }
    const sumGrade = students.reduce((acc, s) => acc + (s.average || 0), 0);
    const sumAtt = students.reduce((acc, s) => acc + (s.attendance || 0), 0);
    const highRisk = students.filter(s => s.risk === RiskLevel.HIGH).length;
    const mediumRisk = students.filter(s => s.risk === RiskLevel.MEDIUM).length;
    const lowRisk = students.filter(s => s.risk === RiskLevel.LOW).length;

    return {
      total,
      avgGrade: Number((sumGrade / total).toFixed(1)),
      avgAttendance: Math.round(sumAtt / total),
      highRisk,
      mediumRisk,
      lowRisk
    };
  }, [students]);

  // Paginación
  const totalPages = pageSize === 0 ? 1 : Math.ceil(processedStudents.length / pageSize);
  const paginatedStudents = useMemo(() => {
    if (pageSize === 0) return processedStudents;
    const start = (currentPage - 1) * pageSize;
    return processedStudents.slice(start, start + pageSize);
  }, [processedStudents, currentPage, pageSize]);

  // Exportar a CSV (Compatible con Excel)
  const handleExportCSV = () => {
    if (processedStudents.length === 0) {
      alert('No hay alumnos para exportar.');
      return;
    }

    const headers = [
      'Matricula',
      'Nombre Completo',
      'Licenciatura',
      'Semestre',
      'Grupo',
      'Turno',
      'Promedio General',
      'Asistencia %',
      'Prom. Examenes',
      'Prom. Tareas',
      'Prom. Ejercicios',
      'Nivel de Riesgo'
    ];

    const rows = processedStudents.map(s => [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.career || ''}"`,
      s.semester || '',
      `"${s.group || ''}"`,
      `"${s.shift || ''}"`,
      s.average.toFixed(2),
      `${s.attendance}%`,
      s.avgExams !== undefined ? s.avgExams.toFixed(1) : '0.0',
      s.avgTasks !== undefined ? s.avgTasks.toFixed(1) : '0.0',
      s.avgExercises !== undefined ? s.avgExercises.toFixed(1) : '0.0',
      `"${RISK_LABELS[s.risk]}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const groupName = filters.group !== 'ALL' ? `_grupo_${filters.group}` : '';
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `matricula_fcqb${groupName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalEnrollmentSum = (Object.values(groupCounts) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 space-y-5 pb-16 animate-in fade-in duration-300">
      
      {/* =========================================================
          ENCABEZADO OFICIAL EXCLUSIVO PARA IMPRESIÓN (PDF / PAPEL)
      ========================================================= */}
      <div className="hidden print:block mb-6 border-b-2 border-[#003B5C] pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-[#003B5C] uppercase tracking-tight">
              Universidad Autónoma de Sinaloa
            </h1>
            <h2 className="text-sm font-bold text-gray-800 uppercase">
              Facultad de Ciencias Químico Biológicas • Sistema STA
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Listado Oficial de Matrícula Estudiantil {filters.group !== 'ALL' ? `— Grupo ${filters.group}` : ''}
              {filters.career !== 'ALL' ? ` — ${filters.career}` : ''}
            </p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p><strong>Ciclo:</strong> {activeCycleName || 'Periodo Activo'}</p>
            <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Total en Padrón:</strong> {processedStudents.length} alumnos</p>
          </div>
        </div>
      </div>

      {/* =========================================================
          CABECERA PRINCIPAL Y ACCIONES INSTITUCIONALES
      ========================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-gray-100 print:hidden space-y-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#003B5C] text-[#FFD100] text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest shadow-xs">
                UAS FCQB • Matrícula Escolar
              </span>
              {activeCycleName && (
                <span className="bg-blue-50 text-[#003B5C] border border-blue-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md">
                  Ciclo: {activeCycleName}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#003B5C] tracking-tight">
              Listado de Matrícula
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              {role === UserRole.TUTOR
                ? 'Padrón de estudiantes asignados para acompañamiento y tutoría'
                : role === UserRole.DOCENTE
                ? 'Estudiantes inscritos en tus asignaturas y grupos del ciclo'
                : 'Padrón integral de estudiantes, seguimiento de trayectoria y semáforo de riesgo'}
            </p>
          </div>

          {/* ACCIONES SUPERIORES: EXPORTAR, IMPRIMIR Y RESTABLECER */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={processedStudents.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              title="Descargar padrón en formato Excel / CSV"
            >
              <span>📥</span>
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={processedStudents.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer disabled:opacity-40 shadow-xs"
              title="Imprimir formato oficial o guardar como PDF"
            >
              <span>🖨️</span>
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Limpiar todos los filtros"
            >
              🔄
            </button>
          </div>
        </div>

        {/* =========================================================
            KPI CARDS: RESUMEN DE RENDIMIENTO EN TIEMPO REAL
        ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* TOTAL MATRÍCULA */}
          <div className="bg-gray-50/80 border border-gray-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C]/10 text-[#003B5C] flex items-center justify-center text-lg font-black shrink-0">
              👥
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider truncate">Matrícula</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900">{stats.total}</p>
            </div>
          </div>

          {/* PROMEDIO GENERAL */}
          <div className="bg-blue-50/50 border border-blue-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C] text-[#FFD100] flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
              📊
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-[#003B5C] uppercase tracking-wider truncate">Promedio General</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg sm:text-2xl font-black text-[#003B5C]">{stats.avgGrade.toFixed(1)}</p>
                <span className="text-[9px] font-bold text-gray-400">/ 10</span>
              </div>
            </div>
          </div>

          {/* ASISTENCIA PROMEDIO */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
              🕒
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider truncate">Asistencia Media</p>
              <p className="text-lg sm:text-2xl font-black text-emerald-700">{stats.avgAttendance}%</p>
            </div>
          </div>

          {/* ATENCIÓN PRIORITARIA (RIESGO ALTO) */}
          <div className={`p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border transition-all ${
            stats.highRisk > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 shadow-xs ${
              stats.highRisk > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'
            }`}>
              ⚠️
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-wider truncate ${
                stats.highRisk > 0 ? 'text-rose-800' : 'text-gray-400'
              }`}>
                Riesgo Crítico
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-lg sm:text-2xl font-black ${stats.highRisk > 0 ? 'text-rose-700' : 'text-gray-700'}`}>
                  {stats.highRisk}
                </p>
                <span className="text-[10px] font-bold text-gray-400">
                  ({stats.total > 0 ? Math.round((stats.highRisk / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* =========================================================
            FILTROS PRINCIPALES (BÚSQUEDA, CARRERA, SEMESTRE, GRUPO)
        ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* BUSCADOR */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Buscar Estudiante
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre o matrícula..."
                value={filters.search}
                onChange={e => { setFilters({ ...filters, search: e.target.value }); setCurrentPage(1); }}
                className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 pl-9 rounded-2xl text-xs font-bold text-gray-900 outline-none transition-all placeholder:text-gray-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                🔍
              </span>
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* LICENCIATURA */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Licenciatura
            </label>
            <select
              value={filters.career}
              onChange={e => { setFilters({ ...filters, career: e.target.value, semester: 'ALL', group: 'ALL' }); setCurrentPage(1); }}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none transition-all cursor-pointer truncate"
            >
              <option value="ALL">TODAS LAS LICENCIATURAS</option>
              {CAREERS.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* SEMESTRE */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Semestre
            </label>
            <select
              value={filters.semester}
              onChange={e => { setFilters({ ...filters, semester: e.target.value, group: 'ALL' }); setCurrentPage(1); }}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none transition-all cursor-pointer truncate"
            >
              <option value="ALL">TODOS LOS SEMESTRES</option>
              {availableSemesters.map(n => (
                <option key={n} value={n}>
                  {n}° Semestre
                </option>
              ))}
            </select>
          </div>

          {/* GRUPO */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              {role === UserRole.TUTOR ? 'Grupo Tutorado' : 'Grupo Asignado'}
            </label>
            <select
              value={filters.group}
              onChange={e => { setFilters({ ...filters, group: e.target.value }); setCurrentPage(1); }}
              disabled={metaLoading}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none transition-all cursor-pointer truncate disabled:opacity-50"
            >
              <option value="ALL">
                {role === UserRole.TUTOR ? 'TODOS MIS GRUPOS' : 'TODOS LOS GRUPOS'} ({totalEnrollmentSum} alumnos)
              </option>
              {availableGroups.map(g => {
                const count = groupCounts[g] ?? 0;
                const subj = groupSubjectNames[g];
                return (
                  <option key={g} value={g}>
                    Grupo {g} {subj ? `— ${subj}` : ''} ({count} {count === 1 ? 'alumno' : 'alumnos'})
                  </option>
                );
              })}
            </select>
          </div>

        </div>

      </div>

      {/* =========================================================
          BARRA DE CONTEO Y CONTROLES (ORDENAMIENTO Y PAGINACIÓN)
      ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 bg-white/60 border border-gray-100 rounded-2xl print:hidden text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">
            Mostrando <strong className="text-gray-900 font-black">{paginatedStudents.length}</strong> de{' '}
            <strong className="text-[#003B5C] font-black">{processedStudents.length}</strong> estudiantes
          </span>
          {filters.group !== 'ALL' && (
            <span className="bg-[#003B5C]/10 text-[#003B5C] px-2 py-0.5 rounded-md font-black text-[10px]">
              Grupo {filters.group}
            </span>
          )}
        </div>

        {/* SELECTOR DE ORDENAMIENTO Y TAMAÑO DE PÁGINA */}
        <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-gray-400">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value as any); setCurrentPage(1); }}
              className="bg-white border border-gray-200 px-2.5 py-1 rounded-xl text-xs font-bold text-gray-800 outline-none cursor-pointer"
            >
              <option value="name_asc">Nombre (A - Z)</option>
              <option value="name_desc">Nombre (Z - A)</option>
              <option value="id_asc">Matrícula (Menor a Mayor)</option>
              <option value="risk_desc">Nivel de Riesgo (Mayor Primero)</option>
              <option value="average_desc">Promedio (Mayor a Menor)</option>
              <option value="average_asc">Promedio (Menor a Mayor)</option>
              <option value="attendance_asc">Asistencia (Menor Asistencia Primero)</option>
              <option value="attendance_desc">Asistencia (Mayor Asistencia Primero)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-gray-400">Mostrar:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white border border-gray-200 px-2 py-1 rounded-xl text-xs font-bold text-gray-800 outline-none cursor-pointer"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
              <option value={0}>Ver Todos</option>
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================
          CONTENIDO DEL LISTADO (MÓVIL EN TARJETAS / ESCRITORIO EN TABLA)
      ========================================================= */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
              Sincronizando matrícula y calificaciones...
            </p>
          </div>
        ) : processedStudents.length === 0 ? (
          <div className="py-20 text-center space-y-3 p-6">
            <span className="text-4xl">📭</span>
            <p className="font-black text-gray-700 text-sm">
              {students.length === 0
                ? 'No se encontraron alumnos registrados con los criterios seleccionados.'
                : 'Ningún alumno coincide con el filtro de riesgo o búsqueda aplicado.'}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-blue-600 font-black uppercase tracking-wider hover:underline"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------
                VISTA 1: TARJETAS RESPONSIVE PARA DISPOSITIVOS MÓVILES (< 768px)
            ------------------------------------------------------------- */}
            <div className="block md:hidden divide-y divide-gray-100 print:hidden">
              {paginatedStudents.map((student, idx) => {
                const globalIndex = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                return (
                  <div
                    key={student.id}
                    className="p-4 space-y-3 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* ENCABEZADO DE LA TARJETA */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-black text-gray-300 w-5 text-right shrink-0">
                          {globalIndex}
                        </span>
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            student.risk === RiskLevel.HIGH
                              ? 'bg-rose-500 text-white'
                              : student.risk === RiskLevel.MEDIUM
                              ? 'bg-amber-500 text-white'
                              : 'bg-[#003B5C] text-[#FFD100]'
                          }`}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-900 text-sm leading-snug truncate">
                            {student.name}
                          </h4>
                          <p className="font-mono font-bold text-xs text-gray-400 mt-0.5">
                            Matrícula: <span className="text-gray-700">{student.id}</span>
                          </p>
                        </div>
                      </div>

                      {/* BADGE DE RIESGO */}
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border tracking-wider shrink-0 ${RISK_COLORS[student.risk]}`}>
                        {RISK_LABELS[student.risk]}
                      </span>
                    </div>

                    {/* DETALLES ACADÉMICOS / PROGRAMA */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-gray-500">
                      <span className="bg-blue-50 text-[#003B5C] px-2 py-0.5 rounded-md font-black">
                        {student.career}
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                        {student.semester}° Sem.
                      </span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                        Grupo {student.group}
                      </span>
                      {student.shift && (
                        <span className="text-gray-400">
                          • {student.shift}
                        </span>
                      )}
                    </div>

                    {/* GRID DE MÉTRICAS */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-2xl text-center">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-gray-400">Promedio</span>
                        <p className={`text-sm font-black ${
                          student.average >= 8 ? 'text-emerald-700' : student.average >= 6 ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {student.average.toFixed(1)}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-gray-400">Asistencia</span>
                        <p className={`text-sm font-black ${
                          student.attendance >= 80 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {student.attendance}%
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black uppercase text-gray-400">Exám / Tar / Ej</span>
                        <p className="text-[11px] font-black text-gray-700 truncate">
                          {student.avgExams?.toFixed(1) || '0'} / {student.avgTasks?.toFixed(1) || '0'} / {student.avgExercises?.toFixed(1) || '0'}
                        </p>
                      </div>
                    </div>

                    {/* BOTÓN VER EXPEDIENTE */}
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                      className="w-full py-2.5 bg-white hover:bg-[#003B5C] text-[#003B5C] hover:text-white border border-[#003B5C]/20 hover:border-[#003B5C] rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>👁️</span>
                      <span>Ver Expediente del Alumno</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------------------
                VISTA 2: TABLA INSTITUCIONAL PARA ESCRITORIO / IMPRESIÓN (≥ 768px)
            ------------------------------------------------------------- */}
            <div className="hidden md:block overflow-x-auto print:block">
              <table className="w-full text-left">
                <thead className="bg-[#003B5C] text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="py-4 px-4 text-center w-12">#</th>
                    <th className="py-4 px-6">Estudiante & Matrícula</th>
                    <th className="py-4 px-5">Programa & Grupo</th>
                    <th className="py-4 px-4 text-center">Asistencia</th>
                    <th className="py-4 px-4 text-center">Promedio</th>
                    <th className="py-4 px-3 text-center">Exámenes</th>
                    <th className="py-4 px-3 text-center">Tareas</th>
                    <th className="py-4 px-3 text-center">Ejercicios</th>
                    <th className="py-4 px-4 text-center">Nivel de Riesgo</th>
                    <th className="py-4 px-5 text-center print:hidden w-28">Expediente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {paginatedStudents.map((student, idx) => {
                    const globalIndex = pageSize === 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-blue-50/20 transition-all group"
                      >
                        {/* NÚMERO CORRELATIVO */}
                        <td className="py-3.5 px-4 text-center font-bold text-gray-400 text-[11px]">
                          {globalIndex}
                        </td>

                        {/* ESTUDIANTE & MATRÍCULA */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs print:hidden ${
                                student.risk === RiskLevel.HIGH
                                  ? 'bg-rose-500 text-white'
                                  : student.risk === RiskLevel.MEDIUM
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[#003B5C] text-[#FFD100]'
                              }`}
                            >
                              {student.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p
                                onClick={() => setSelectedStudent(student)}
                                className="font-bold text-gray-900 hover:text-blue-700 cursor-pointer transition-colors leading-snug"
                                title="Click para ver expediente"
                              >
                                {student.name}
                              </p>
                              <p className="font-mono text-[10px] text-gray-400 font-bold uppercase">
                                {student.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* PROGRAMA & GRUPO */}
                        <td className="py-3.5 px-5">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-[#003B5C] uppercase leading-tight">
                              {student.career}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {student.semester}° Sem. • Grupo <strong>{student.group}</strong>
                              {student.shift ? ` (${student.shift})` : ''}
                            </span>
                          </div>
                        </td>

                        {/* ASISTENCIA */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`font-black text-xs ${
                              student.attendance >= 80 ? 'text-gray-800' : 'text-rose-600'
                            }`}>
                              {student.attendance}%
                            </span>
                            <div className="w-12 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-0.5 print:hidden">
                              <div
                                className={`h-full rounded-full ${
                                  student.attendance >= 80 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, student.attendance)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* PROMEDIO GENERAL */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg font-black text-xs ${
                            student.average >= 8
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : student.average >= 6
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {student.average.toFixed(1)}
                          </span>
                        </td>

                        {/* EXÁMENES */}
                        <td className="py-3.5 px-3 text-center font-bold text-gray-700 text-xs">
                          {student.avgExams !== undefined ? student.avgExams.toFixed(1) : '—'}
                        </td>

                        {/* TAREAS */}
                        <td className="py-3.5 px-3 text-center font-bold text-gray-700 text-xs">
                          {student.avgTasks !== undefined ? student.avgTasks.toFixed(1) : '—'}
                        </td>

                        {/* EJERCICIOS */}
                        <td className="py-3.5 px-3 text-center font-bold text-gray-700 text-xs">
                          {student.avgExercises !== undefined ? student.avgExercises.toFixed(1) : '—'}
                        </td>

                        {/* SEMÁFORO DE RIESGO */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-2xs ${RISK_COLORS[student.risk]}`}>
                            {RISK_LABELS[student.risk]}
                          </span>
                        </td>

                        {/* ACCIONES: BOTÓN FICHA */}
                        <td className="py-3.5 px-5 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(student)}
                            className="bg-gray-100 hover:bg-[#003B5C] text-gray-600 hover:text-white px-3.5 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-2xs active:scale-95 cursor-pointer"
                          >
                            Abrir Ficha
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {/* =========================================================
          CONTROLES DE PAGINACIÓN INFERIOR
      ========================================================= */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-xs print:hidden">
          <div className="text-xs text-gray-500 font-medium">
            Página <strong className="text-gray-900">{currentPage}</strong> de{' '}
            <strong className="text-gray-900">{totalPages}</strong> ({processedStudents.length} alumnos totales)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Primera página"
            >
              ««
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>

            <span className="px-3 py-1.5 bg-[#003B5C] text-[#FFD100] rounded-xl text-xs font-black">
              {currentPage}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Última página"
            >
              »»
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL DE EXPEDIENTE / FICHA INTEGRAL DEL ALUMNO
      ========================================================= */}
      {selectedStudent && (
        <StudentProfile
          student={selectedStudent}
          role={role}
          userId={userId}
          onClose={() => setSelectedStudent(null)}
        />
      )}

    </div>
  );
};

export default StudentListView;
