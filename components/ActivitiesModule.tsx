import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { calculateRisk, UAS_COLORS } from '../constants';
import { Activity, ActivityType, UserRole, Grade, RiskLevel } from '../types';
import fcqbLogo from './images/fcqb_logo.png';
import uasEscudo from './images/uas_escudo.png';

interface ActivitiesModuleProps {
  userId: string;
  role: UserRole;
  userName?: string;
}

interface EnrichedActivity extends Activity {
  grupo_nombre?: string;
  materia_nombre?: string;
  docente_nombre?: string;
  totalCalificados?: number;
  totalAlumnosEstimado?: number;
  promedioActividad?: number;
  totalEntregados?: number;
}

const ActivitiesModule: React.FC<ActivitiesModuleProps> = ({ userId, role, userName }) => {
  // Lista de actividades y grupos
  const [activities, setActivities] = useState<EnrichedActivity[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<{ id: string; nombre: string } | null>(null);

  // Filtros de actividades
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'EVALUATED' | 'IN_PROGRESS' | 'PENDING'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Crear / Editar Actividad
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newActivity, setNewActivity] = useState({
    titulo: '',
    descripcion: '',
    tipo: ActivityType.TAREA,
    unidad: 1,
    grupo_id: '',
    fecha_entrega: '',
    puntos_max: 10
  });

  // Modal de Captura de Calificaciones
  const [evaluatingActivity, setEvaluatingActivity] = useState<EnrichedActivity | null>(null);
  const [activityStudents, setActivityStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, Partial<Grade>>>({});
  const [evalSearchTerm, setEvalSearchTerm] = useState('');
  const [evalFilter, setEvalFilter] = useState<'ALL' | 'PENDING' | 'UNSUBMITTED' | 'PASSED' | 'FAILED'>('ALL');
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Referencias a los inputs de calificación para navegación con teclado
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  // Obtener ciclo escolar y actividades
  const fetchActivities = async () => {
    setLoading(true);
    try {
      // 1. Ciclo escolar activo
      const { data: cycleData } = await supabase
        .from('ciclos_escolares')
        .select('id, nombre')
        .eq('es_activo', true)
        .maybeSingle();

      if (cycleData) {
        setActiveCycle(cycleData);
      }

      // 2. Consulta de actividades con grupos, materias y calificaciones vinculadas
      let query = supabase
        .from('actividades')
        .select(`
          *,
          grupos (
            id,
            nombre_grupo,
            materias (nombre)
          ),
          docentes (id, nombre),
          calificaciones (id, estudiante_id, calificacion, entregado)
        `)
        .order('created_at', { ascending: false });

      if (role !== UserRole.ADMIN && userId) {
        query = query.eq('docente_id', userId);
      }

      if (cycleData) {
        query = query.eq('ciclo_id', cycleData.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const processed: EnrichedActivity[] = (data || []).map((a: any) => {
        const grupoRel = getRelation(a.grupos);
        const materiaRel = getRelation(grupoRel?.materias);
        const docenteRel = getRelation(a.docentes);
        const califs: any[] = a.calificaciones || [];

        const totalCalificados = califs.length;
        const totalEntregados = califs.filter(c => c.entregado).length;
        const suma = califs.reduce((acc, c) => acc + Number(c.calificacion || 0), 0);
        const maxPts = Number(a.puntos_max) || 10;
        const promedioActividad = totalCalificados > 0 ? (suma / totalCalificados) : 0;

        return {
          ...a,
          grupo_nombre: grupoRel?.nombre_grupo || a.grupo_id,
          materia_nombre: materiaRel?.nombre || 'Asignatura Curricular',
          docente_nombre: docenteRel?.nombre || '',
          totalCalificados,
          promedioActividad: Number(promedioActividad.toFixed(2)),
          totalEntregados,
          calificaciones: califs
        };
      });

      setActivities(processed);
    } catch (err) {
      console.error("Error al cargar actividades:", err);
    } finally {
      setLoading(false);
    }
  };

  // Obtener grupos asignados al docente
  const fetchAssignedGroups = async () => {
    try {
      const { data: cycleData } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      let query = supabase
        .from('grupos')
        .select('id, nombre_grupo, ciclo_id, materias(nombre)');

      if (role !== UserRole.ADMIN && userId) {
        query = query.eq('docente_id', userId);
      }

      if (cycleData) {
        query = query.eq('ciclo_id', cycleData.id);
      }

      const { data } = await query.order('nombre_grupo', { ascending: true });
      setAssignedGroups(data || []);

      if (data && data.length > 0 && !newActivity.grupo_id) {
        setNewActivity(prev => ({ ...prev, grupo_id: data[0].id }));
      }
    } catch (err) {
      console.error("Error al cargar grupos asignados:", err);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchAssignedGroups();

    const handleCycleUpdate = () => {
      fetchActivities();
      fetchAssignedGroups();
    };

    window.addEventListener('sta-cycle-updated', handleCycleUpdate);
    return () => window.removeEventListener('sta-cycle-updated', handleCycleUpdate);
  }, [userId, role]);

  // Abrir modal de edición
  const handleOpenEdit = (activity: EnrichedActivity) => {
    setEditingId(activity.id);
    setIsEditing(true);
    let formattedDate = '';
    try {
      const date = new Date(activity.fecha_entrega);
      formattedDate = date.toISOString().slice(0, 16);
    } catch {
      formattedDate = '';
    }

    setNewActivity({
      titulo: activity.titulo,
      descripcion: activity.descripcion || '',
      tipo: activity.tipo,
      unidad: activity.unidad,
      grupo_id: activity.grupo_id,
      fecha_entrega: formattedDate,
      puntos_max: activity.puntos_max
    });
    setShowCreateModal(true);
  };

  // Eliminar actividad
  const handleDeleteActivity = async (id: string, titulo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la actividad "${titulo}"? Se eliminarán también las calificaciones asociadas.`)) {
      return;
    }
    try {
      const { error } = await supabase.from('actividades').delete().eq('id', id);
      if (error) throw error;
      fetchActivities();
    } catch (err: any) {
      alert("Error al eliminar la actividad: " + err.message);
    }
  };

  // Guardar actividad (Crear o Actualizar)
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.grupo_id) {
      alert("Por favor selecciona un grupo y asignatura.");
      return;
    }
    if (!newActivity.titulo.trim()) {
      alert("Por favor ingresa un título para la actividad.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        titulo: newActivity.titulo.trim(),
        descripcion: newActivity.descripcion.trim(),
        tipo: String(newActivity.tipo),
        unidad: Math.floor(Number(newActivity.unidad)) || 1,
        grupo_id: newActivity.grupo_id,
        docente_id: userId,
        fecha_entrega: new Date(newActivity.fecha_entrega).toISOString(),
        puntos_max: Math.max(1, Math.floor(Number(newActivity.puntos_max)) || 10),
        ciclo_id: activeCycle?.id || null
      };

      if (isEditing && editingId) {
        const { error } = await supabase.from('actividades').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('actividades').insert([payload]);
        if (error) throw error;
      }

      setShowCreateModal(false);
      resetForm();
      fetchActivities();
    } catch (err: any) {
      alert("Error al guardar actividad: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewActivity({
      titulo: '',
      descripcion: '',
      tipo: ActivityType.TAREA,
      unidad: 1,
      grupo_id: assignedGroups[0]?.id || '',
      fecha_entrega: '',
      puntos_max: 10
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Abrir formato de captura de calificaciones
  const startEvaluation = async (activity: EnrichedActivity) => {
    setEvaluatingActivity(activity);
    setLoadingStudents(true);
    setEvalSearchTerm('');
    setEvalFilter('ALL');

    try {
      let students: any[] = [];

      // 1. Intentar por historial del ciclo activo
      if (activeCycle) {
        const { data: histData } = await supabase
          .from('historial_estudiantes_ciclo')
          .select('*, estudiantes(*)')
          .eq('ciclo_id', activeCycle.id)
          .eq('grupo', activity.grupo_nombre);

        if (histData && histData.length > 0) {
          students = histData.map(h => {
            const st = getRelation(h.estudiantes);
            return {
              id: h.estudiante_id,
              nombre: st?.nombre || 'Estudiante',
              carrera: h.carrera || st?.carrera || '',
              semestre: h.semestre || st?.semestre || 1,
              grupo: h.grupo
            };
          });
        }
      }

      // 2. Si es subgrupo de acentuación
      if (students.length === 0 && activity.grupo_nombre?.startsWith('SUB - ')) {
        const accName = activity.grupo_nombre.replace('SUB - ', '').trim();
        const { data: accData } = await supabase
          .from('acentuaciones')
          .select('id')
          .eq('nombre', accName)
          .maybeSingle();

        if (accData) {
          const { data: stAccRows } = await supabase
            .from('estudiantes_acentuacion')
            .select('estudiante_id, estudiantes(*)')
            .eq('acentuacion_id', accData.id);

          if (stAccRows && stAccRows.length > 0) {
            students = stAccRows.map(r => {
              const st = getRelation(r.estudiantes);
              return st ? {
                id: st.id,
                nombre: st.nombre,
                carrera: st.carrera,
                semestre: st.semestre,
                grupo: st.grupo
              } : null;
            }).filter(Boolean);
          }
        }
      }

      // 3. Fallback directo a estudiantes por grupo
      if (students.length === 0) {
        let rawQuery = supabase
          .from('estudiantes')
          .select('*')
          .eq('grupo', activity.grupo_nombre);

        if (activeCycle) {
          rawQuery = rawQuery.eq('ciclo_id', activeCycle.id);
        }

        const { data: rawStudents } = await rawQuery.order('nombre', { ascending: true });
        students = (rawStudents || []).map(s => ({
          id: s.id,
          nombre: s.nombre,
          carrera: s.carrera,
          semestre: s.semestre,
          grupo: s.grupo
        }));
      }

      // Ordenar alfabéticamente por apellido/nombre
      students.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      setActivityStudents(students);

      // 4. Consultar calificaciones existentes de esta actividad
      const { data: existingGrades } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('actividad_id', activity.id);

      const map: Record<string, Partial<Grade>> = {};
      students.forEach(s => {
        const found = existingGrades?.find(g => g.estudiante_id === s.id);
        if (found) {
          map[s.id] = {
            id: found.id,
            actividad_id: activity.id,
            estudiante_id: s.id,
            calificacion: Number(found.calificacion),
            entregado: Boolean(found.entregado)
          };
        } else {
          map[s.id] = {
            actividad_id: activity.id,
            estudiante_id: s.id,
            calificacion: 0,
            entregado: false
          };
        }
      });

      setGrades(map);
    } catch (err) {
      console.error("Error al preparar evaluación:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Guardar calificaciones y sincronizar promedios
  const handleSaveGrades = async () => {
    if (!evaluatingActivity) return;
    setIsSavingGrades(true);

    try {
      // 1. Guardar o actualizar calificaciones en la base de datos
      const payloads = Object.values(grades).map((g: any) => ({
        actividad_id: evaluatingActivity.id,
        estudiante_id: g.estudiante_id,
        calificacion: Number(g.calificacion || 0),
        entregado: Boolean(g.entregado)
      }));

      const { error: gradesError } = await supabase
        .from('calificaciones')
        .upsert(payloads, { onConflict: 'actividad_id,estudiante_id' });

      if (gradesError) throw gradesError;

      // 2. Recalcular promedios acumulados y nivel de riesgo de los estudiantes
      const studentIds = activityStudents.map(s => s.id);

      const { data: allGrades } = await supabase
        .from('calificaciones')
        .select('estudiante_id, calificacion, actividades(puntos_max)')
        .in('estudiante_id', studentIds);

      const { data: studentsData } = await supabase
        .from('estudiantes')
        .select('id, porcentaje_asistencia')
        .in('id', studentIds);

      const updatePromises = (studentsData || []).map(async s => {
        const sGrades = (allGrades || []).filter(g => g.estudiante_id === s.id);

        let totalNormalized = 0;
        sGrades.forEach(g => {
          const ptsMax = getRelation(g.actividades)?.puntos_max || 10;
          totalNormalized += (Number(g.calificacion) / ptsMax) * 10;
        });

        const globalAvg = sGrades.length > 0 ? totalNormalized / sGrades.length : 0;
        const currentAtt = s.porcentaje_asistencia || 0;

        return supabase
          .from('estudiantes')
          .update({
            promedio_acumulado: Number(globalAvg.toFixed(2)),
            nivel_riesgo: calculateRisk(globalAvg, currentAtt)
          })
          .eq('id', s.id);
      });

      const results = await Promise.all(updatePromises);
      const firstError = results.find(r => r.error);
      if (firstError) throw firstError.error;

      alert(`✅ Calificaciones guardadas exitosamente para ${evaluatingActivity.titulo}. Los promedios generales han sido recalculados.`);
      setEvaluatingActivity(null);
      fetchActivities();
    } catch (err: any) {
      console.error("Error al guardar calificaciones:", err);
      alert("❌ Error al guardar calificaciones: " + (err.message || "Error desconocido"));
    } finally {
      setIsSavingGrades(false);
    }
  };

  // Acciones en Lote (Batch Actions)
  const handleBatchMarkDelivered = () => {
    setGrades(prev => {
      const next = { ...prev };
      activityStudents.forEach(s => {
        next[s.id] = { ...(next[s.id] || {}), entregado: true };
      });
      return next;
    });
  };

  const handleBatchMaxScoreToDelivered = () => {
    if (!evaluatingActivity) return;
    const maxPts = evaluatingActivity.puntos_max;
    setGrades(prev => {
      const next = { ...prev };
      activityStudents.forEach(s => {
        if (next[s.id]?.entregado) {
          next[s.id] = { ...(next[s.id] || {}), calificacion: maxPts };
        }
      });
      return next;
    });
  };

  const handleBatchZeroUnsubmitted = () => {
    setGrades(prev => {
      const next = { ...prev };
      activityStudents.forEach(s => {
        if (!next[s.id]?.entregado) {
          next[s.id] = { ...(next[s.id] || {}), calificacion: 0, entregado: false };
        }
      });
      return next;
    });
  };

  const handleBatchClear = () => {
    if (!window.confirm("¿Deseas reiniciar todas las calificaciones de la lista a 0 y sin entregar?")) return;
    setGrades(prev => {
      const next = { ...prev };
      activityStudents.forEach(s => {
        next[s.id] = { ...(next[s.id] || {}), calificacion: 0, entregado: false };
      });
      return next;
    });
  };

  // Navegación con teclado (Enter o Flecha Abajo salta al siguiente estudiante)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = inputRefs.current[currentIndex + 1];
      if (next) {
        next.focus();
        next.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = inputRefs.current[currentIndex - 1];
      if (prev) {
        prev.focus();
        prev.select();
      }
    }
  };

  // Formato de badge de tipo de actividad
  const getActivityTypeBadge = (tipo: ActivityType | string) => {
    switch (tipo) {
      case ActivityType.EXAMEN:
        return {
          label: 'Examen',
          icon: '📑',
          bg: 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-500/10',
          borderAccent: 'from-rose-500 to-red-600',
          pillColor: 'bg-rose-500'
        };
      case ActivityType.TAREA:
        return {
          label: 'Tarea',
          icon: '📋',
          bg: 'bg-blue-50 text-[#003B5C] border-blue-200 ring-blue-500/10',
          borderAccent: 'from-[#003B5C] to-blue-700',
          pillColor: 'bg-[#003B5C]'
        };
      case ActivityType.EJERCICIO:
      default:
        return {
          label: 'Ejercicio / Práctica',
          icon: '✏️',
          bg: 'bg-amber-50 text-amber-900 border-amber-200 ring-amber-500/10',
          borderAccent: 'from-amber-500 to-yellow-600',
          pillColor: 'bg-amber-500'
        };
    }
  };

  // Filtrado de actividades del tablero
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchSearch =
        a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.grupo_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.materia_nombre || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (selectedGroupFilter !== 'ALL' && a.grupo_id !== selectedGroupFilter) {
        return false;
      }

      if (selectedTypeFilter !== 'ALL' && a.tipo !== selectedTypeFilter) {
        return false;
      }

      if (selectedUnitFilter !== 'ALL' && String(a.unidad) !== selectedUnitFilter) {
        return false;
      }

      if (selectedStatusFilter !== 'ALL') {
        const califsCount = a.totalCalificados || 0;
        if (selectedStatusFilter === 'EVALUATED' && califsCount === 0) return false;
        if (selectedStatusFilter === 'PENDING' && califsCount > 0) return false;
      }

      return true;
    });
  }, [activities, searchTerm, selectedGroupFilter, selectedTypeFilter, selectedUnitFilter, selectedStatusFilter]);

  // Métricas globales del tablero
  const stats = useMemo(() => {
    const total = activities.length;
    const tareas = activities.filter(a => a.tipo === ActivityType.TAREA).length;
    const examenes = activities.filter(a => a.tipo === ActivityType.EXAMEN).length;
    const ejercicios = activities.filter(a => a.tipo === ActivityType.EJERCICIO).length;

    const evaluatedActivities = activities.filter(a => (a.totalCalificados || 0) > 0);
    const sumAverages = evaluatedActivities.reduce((acc, a) => {
      const maxPts = a.puntos_max || 10;
      const normalizedAvg = ((a.promedioActividad || 0) / maxPts) * 10;
      return acc + normalizedAvg;
    }, 0);

    const globalAvg = evaluatedActivities.length > 0 ? (sumAverages / evaluatedActivities.length) : 0;
    const totalSubmissions = activities.reduce((acc, a) => acc + (a.totalEntregados || 0), 0);

    return {
      total,
      tareas,
      examenes,
      ejercicios,
      globalAvg: Number(globalAvg.toFixed(1)),
      totalSubmissions,
      groupsCount: assignedGroups.length
    };
  }, [activities, assignedGroups]);

  // Alumnos filtrados en la captura de calificaciones
  const filteredStudentsForEvaluation = useMemo(() => {
    return activityStudents.filter(s => {
      const matchSearch =
        s.nombre.toLowerCase().includes(evalSearchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(evalSearchTerm.toLowerCase());

      if (!matchSearch) return false;

      const g = grades[s.id];
      const maxPts = evaluatingActivity?.puntos_max || 10;
      const calif = Number(g?.calificacion || 0);
      const isDelivered = Boolean(g?.entregado);
      const normalized = (calif / maxPts) * 10;

      if (evalFilter === 'PENDING' && calif > 0) return false;
      if (evalFilter === 'UNSUBMITTED' && isDelivered) return false;
      if (evalFilter === 'PASSED' && normalized < 7.0) return false;
      if (evalFilter === 'FAILED' && normalized >= 7.0) return false;

      return true;
    });
  }, [activityStudents, evalSearchTerm, evalFilter, grades, evaluatingActivity]);

  // Métricas en tiempo real dentro del modal de evaluación
  const evalMetrics = useMemo(() => {
    if (!evaluatingActivity || activityStudents.length === 0) {
      return { total: 0, gradedCount: 0, avg: 0, passed: 0, failed: 0, delivered: 0, progressPct: 0 };
    }

    const maxPts = evaluatingActivity.puntos_max || 10;
    let gradedCount = 0;
    let totalScore = 0;
    let passed = 0;
    let failed = 0;
    let delivered = 0;

    activityStudents.forEach(s => {
      const g = grades[s.id];
      if (g) {
        if (g.entregado) delivered++;
        const score = Number(g.calificacion);
        if (score > 0 || g.entregado) {
          gradedCount++;
          totalScore += score;
          const normalized = (score / maxPts) * 10;
          if (normalized >= 7.0) passed++;
          else failed++;
        }
      }
    });

    const avg = gradedCount > 0 ? totalScore / gradedCount : 0;
    const progressPct = Math.round((gradedCount / activityStudents.length) * 100);

    return {
      total: activityStudents.length,
      gradedCount,
      avg: Number(avg.toFixed(1)),
      passed,
      failed,
      delivered,
      progressPct
    };
  }, [evaluatingActivity, activityStudents, grades]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 md:p-8 space-y-8 animate-in fade-in duration-300">
      
      {/* =========================================================================
          BANNER INSTITUCIONAL UAS • FCQB CON ESTADÍSTICAS
      ========================================================================= */}
      <div className="bg-gradient-to-r from-[#003B5C] via-[#002b45] to-[#001D30] text-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-xl border-b-4 border-[#FFD100] relative overflow-hidden">
        {/* Decoración heráldica */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <img src={fcqbLogo} alt="FCQB" className="h-44 object-contain" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-[#FFD100] text-[#003B5C] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xs">
                {activeCycle ? activeCycle.nombre : 'Periodo Escolar Activo'}
              </span>
              <span className="bg-white/10 text-blue-200 border border-white/15 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
                Módulo Docente FCQB
              </span>
              {userName && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-[10px] font-bold">
                  Docente: {userName}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Gestión Integral de Actividades
            </h1>
            <p className="text-blue-200/80 text-xs sm:text-sm font-medium mt-1 max-w-2xl leading-relaxed">
              Diseña asignaciones, exámenes y prácticas. Captura y pondera calificaciones en tiempo real con recálculo automático de la trayectoria académica de los estudiantes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="w-full sm:w-auto bg-[#FFD100] text-[#003B5C] hover:bg-yellow-400 active:scale-95 px-7 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="text-base font-bold">+</span>
              <span>Nueva Actividad</span>
            </button>
            <button
              onClick={fetchActivities}
              title="Recargar actividades"
              className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/20 transition-all active:scale-95"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TARJETAS DE MÉTRICAS GLOBALES (KPIs)
      ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* KPI 1: TOTAL DE ACTIVIDADES */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Actividades Creadas</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-[#003B5C] flex items-center justify-center text-sm font-bold">📚</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{stats.total}</span>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-500">
              <span className="text-blue-600">{stats.tareas} Tareas</span>
              <span>•</span>
              <span className="text-rose-600">{stats.examenes} Exámenes</span>
              <span>•</span>
              <span className="text-amber-600">{stats.ejercicios} Ejercicios</span>
            </div>
          </div>
        </div>

        {/* KPI 2: GRUPOS ATENDIDOS */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Grupos Asignados</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-bold">👥</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{stats.groupsCount}</span>
            <p className="text-[10px] font-bold text-indigo-600 mt-2">
              Carga docente activa en el ciclo
            </p>
          </div>
        </div>

        {/* KPI 3: ENTREGAS REGISTRADAS */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Entregas Recibidas</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold">📦</span>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{stats.totalSubmissions}</span>
            <p className="text-[10px] font-bold text-emerald-600 mt-2">
              Trabajos evaluados y registrados
            </p>
          </div>
        </div>

        {/* KPI 4: PROMEDIO GLOBAL */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Promedio General</span>
            <span className="w-8 h-8 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center text-sm font-bold">🎯</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl sm:text-4xl font-black tracking-tight ${
              stats.globalAvg >= 8.5 ? 'text-emerald-700' : stats.globalAvg >= 7.0 ? 'text-[#003B5C]' : 'text-rose-600'
            }`}>
              {stats.globalAvg.toFixed(1)}
            </span>
            <span className="text-xs font-bold text-slate-400">/ 10</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Desempeño global acumulado
          </p>
        </div>

      </div>

      {/* =========================================================================
          BARRA DE CONTROL, BÚSQUEDA Y FILTRADO INTELIGENTE
      ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        
        {/* Fila superior: Buscador y Switch de Vista */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar actividad por título, grupo, asignatura o temática..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-[#003B5C] rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all focus:ring-2 focus:ring-[#003B5C]/20"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">Vista:</span>
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#003B5C] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Tarjetas"
              >
                <span>▦</span>
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#003B5C] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en Tabla"
              >
                <span>☰</span>
                <span className="hidden sm:inline">Tabla</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila inferior: Filtros por Grupo, Tipo, Unidad y Estado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          
          {/* Filtro Grupo */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
              Grupo / Materia
            </label>
            <select
              value={selectedGroupFilter}
              onChange={e => setSelectedGroupFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
            >
              <option value="ALL">Todos los Grupos ({assignedGroups.length})</option>
              {assignedGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nombre_grupo} • {getRelation(g.materias)?.nombre || 'Asignatura'}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
              Tipo de Actividad
            </label>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
            >
              <option value="ALL">Todos los Tipos</option>
              <option value={ActivityType.TAREA}>📋 Tareas</option>
              <option value={ActivityType.EXAMEN}>📑 Exámenes</option>
              <option value={ActivityType.EJERCICIO}>✏️ Ejercicios / Prácticas</option>
            </select>
          </div>

          {/* Filtro Unidad */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
              Unidad Temática
            </label>
            <select
              value={selectedUnitFilter}
              onChange={e => setSelectedUnitFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
            >
              <option value="ALL">Todas las Unidades</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(u => (
                <option key={u} value={String(u)}>Unidad {u}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div>
            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
              Estado Evaluación
            </label>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
            >
              <option value="ALL">Cualquier Estado</option>
              <option value="EVALUATED">✓ Con Calificaciones</option>
              <option value="PENDING">⏱️ Sin Calificar</option>
            </select>
          </div>

        </div>

      </div>

      {/* =========================================================================
          CONTENIDO: VISTA EN CUADRÍCULA O TABLA
      ========================================================================= */}
      {loading ? (
        <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Cargando catálogo de actividades y registro de calificaciones...
          </p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="bg-white p-16 rounded-[2.5rem] border border-slate-200 text-center space-y-4">
          <span className="text-5xl block mb-2">📋</span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            No se encontraron actividades con los filtros actuales
          </h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            {activities.length === 0
              ? 'Aún no tienes actividades registradas para este periodo. Haz clic en "+ Nueva Actividad" para comenzar.'
              : 'Intenta modificar el término de búsqueda o restablecer los filtros para visualizar otras asignaciones.'}
          </p>
          {activities.length > 0 && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedGroupFilter('ALL');
                setSelectedTypeFilter('ALL');
                setSelectedUnitFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        
        /* ---------------- VISTA EN TARJETAS (CARDS VIEW) ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map(activity => {
            const badgeCfg = getActivityTypeBadge(activity.tipo);
            const califsCount = activity.totalCalificados || 0;
            const entregadosCount = activity.totalEntregados || 0;
            const hasGraded = califsCount > 0;
            const avg = activity.promedioActividad || 0;
            const maxPts = activity.puntos_max || 10;
            const normalizedAvg = (avg / maxPts) * 10;

            const isDueDatePast = new Date(activity.fecha_entrega) < new Date();

            return (
              <div
                key={activity.id}
                className="bg-white rounded-[2rem] border border-slate-200 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group hover:border-[#003B5C]/40 relative"
              >
                {/* Barra superior de acento según tipo */}
                <div className={`h-2.5 bg-gradient-to-r ${badgeCfg.borderAccent}`}></div>

                {/* Contenido de la Tarjeta */}
                <div className="p-6 flex flex-col flex-1">
                  
                  {/* Encabezado: Badges y Botones Rápidos */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeCfg.bg}`}>
                        {badgeCfg.icon} {badgeCfg.label}
                      </span>
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-200">
                        Unidad {activity.unidad}
                      </span>
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[9px] font-black tracking-wider border border-slate-200">
                        ⭐ {activity.puntos_max} pts
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(activity)}
                        title="Editar Actividad"
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-700 border border-slate-200 flex items-center justify-center text-xs transition-all active:scale-90"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(activity.id, activity.titulo)}
                        title="Eliminar Actividad"
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 flex items-center justify-center text-xs transition-all active:scale-90"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Título y Materia */}
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-[#003B5C] transition-colors mb-2">
                    {activity.titulo}
                  </h3>

                  {activity.descripcion && (
                    <p className="text-slate-500 text-xs font-normal line-clamp-2 mb-4 leading-relaxed">
                      {activity.descripcion}
                    </p>
                  )}

                  {/* Metadatos de Grupo y Materia */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 mb-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Grupo</span>
                      <span className="font-black text-[#003B5C] bg-white px-2.5 py-0.5 rounded-md border border-slate-200/80 shadow-xs">
                        {activity.grupo_nombre}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Asignatura</span>
                      <span className="font-bold text-slate-700 truncate max-w-[180px]" title={activity.materia_nombre}>
                        {activity.materia_nombre}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Fecha Límite</span>
                      <span className={`text-[10px] font-bold ${isDueDatePast ? 'text-amber-700' : 'text-slate-600'}`}>
                        📅 {new Date(activity.fecha_entrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Progreso de Calificaciones */}
                  <div className="mt-auto pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${hasGraded ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          {hasGraded ? `${califsCount} Calificados` : 'Sin Calificar'}
                        </span>
                      </div>
                      {hasGraded && (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Promedio:</span>
                          <span className={`font-black text-xs ${
                            normalizedAvg >= 8.5 ? 'text-emerald-700' : normalizedAvg >= 7.0 ? 'text-[#003B5C]' : 'text-rose-600'
                          }`}>
                            {avg.toFixed(1)} / {maxPts}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botón Principal para Capturar Calificaciones */}
                    <button
                      onClick={() => startEvaluation(activity)}
                      className="w-full bg-[#003B5C] text-white hover:bg-blue-800 active:scale-95 py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:bg-[#002b45]"
                    >
                      <span>📝</span>
                      <span>{hasGraded ? 'Modificar Calificaciones' : 'Capturar Calificaciones'}</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ---------------- VISTA EN TABLA (TABLE VIEW) ---------------- */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#003B5C] text-white uppercase text-[9px] font-black tracking-wider">
                <tr>
                  <th className="py-4 px-4">Tipo</th>
                  <th className="py-4 px-4">Título de la Actividad</th>
                  <th className="py-4 px-3 text-center">Unidad</th>
                  <th className="py-4 px-4">Grupo / Materia</th>
                  <th className="py-4 px-4">Fecha Límite</th>
                  <th className="py-4 px-3 text-center">Ponderación</th>
                  <th className="py-4 px-4 text-center">Calificados</th>
                  <th className="py-4 px-3 text-center">Promedio</th>
                  <th className="py-4 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredActivities.map(activity => {
                  const badgeCfg = getActivityTypeBadge(activity.tipo);
                  const califsCount = activity.totalCalificados || 0;
                  const avg = activity.promedioActividad || 0;
                  const maxPts = activity.puntos_max || 10;
                  const normalizedAvg = (avg / maxPts) * 10;

                  return (
                    <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badgeCfg.bg}`}>
                          {badgeCfg.icon} {badgeCfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs">
                        <div className="truncate">{activity.titulo}</div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold">
                        U{activity.unidad}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#003B5C]">{activity.grupo_nombre}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{activity.materia_nombre}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px]">
                        {new Date(activity.fecha_entrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold whitespace-nowrap">
                        {activity.puntos_max} pts
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          califsCount > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {califsCount} alumnos
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold whitespace-nowrap">
                        {califsCount > 0 ? (
                          <span className={`${
                            normalizedAvg >= 8.5 ? 'text-emerald-700' : normalizedAvg >= 7.0 ? 'text-[#003B5C]' : 'text-rose-600'
                          }`}>
                            {avg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => startEvaluation(activity)}
                          className="bg-[#003B5C] hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Calificar
                        </button>
                        <button
                          onClick={() => handleOpenEdit(activity)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(activity.id, activity.titulo)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* =========================================================================
          MODAL: CREAR / EDITAR ACTIVIDAD ACADÉMICA
      ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-auto animate-in zoom-in-95 duration-200">
            
            {/* Header del modal */}
            <div className="bg-[#003B5C] text-white p-6 flex justify-between items-center border-b-4 border-[#FFD100]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/10">
                  {isEditing ? '✏️' : '📝'}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFD100] block">
                    Gestión Académica UAS • FCQB
                  </span>
                  <h3 className="text-lg font-black text-white">
                    {isEditing ? 'Editar Asignación Académica' : 'Nueva Asignación Académica'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveActivity} className="p-6 sm:p-8 space-y-5 max-h-[78vh] overflow-y-auto">
              
              {/* Campo: Grupo y Asignatura */}
              <div>
                <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                  Grupo y Asignatura Asignada <span className="text-rose-500">*</span>
                </label>
                <select
                  className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 outline-none transition-all"
                  value={newActivity.grupo_id}
                  onChange={e => setNewActivity({ ...newActivity, grupo_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona el grupo...</option>
                  {assignedGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      Grupo {g.nombre_grupo} — {getRelation(g.materias)?.nombre || 'Asignatura'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campo: Título */}
              <div>
                <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                  Título de la Actividad <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tarea 2: Mecanismos de Reacción y Cinética Química"
                  value={newActivity.titulo}
                  onChange={e => setNewActivity({ ...newActivity, titulo: e.target.value })}
                  className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Grid 2 columnas: Tipo y Unidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                    Tipo de Actividad <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newActivity.tipo}
                    onChange={e => setNewActivity({ ...newActivity, tipo: e.target.value as ActivityType })}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 outline-none transition-all"
                    required
                  >
                    <option value={ActivityType.TAREA}>📋 Tarea Académica</option>
                    <option value={ActivityType.EJERCICIO}>✏️ Ejercicio / Práctica</option>
                    <option value={ActivityType.EXAMEN}>📑 Examen Parcial / Departamental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                    Unidad de Aprendizaje <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newActivity.unidad}
                    onChange={e => setNewActivity({ ...newActivity, unidad: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-900 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Grid 2 columnas: Ponderación y Fecha Límite */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                    Puntaje Máximo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={newActivity.puntos_max}
                      onChange={e => setNewActivity({ ...newActivity, puntos_max: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#003B5C] p-3.5 pr-14 rounded-2xl font-bold text-xs sm:text-sm text-slate-900 outline-none transition-all"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      pts
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                    Fecha y Hora de Entrega <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newActivity.fecha_entrega}
                    onChange={e => setNewActivity({ ...newActivity, fecha_entrega: e.target.value })}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-slate-900 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-black text-[#003B5C] uppercase tracking-wider mb-1">
                  Instrucciones o Criterios de Evaluación <span className="text-slate-400 text-[10px] lowercase font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  value={newActivity.descripcion}
                  onChange={e => setNewActivity({ ...newActivity, descripcion: e.target.value })}
                  placeholder="Detalla los requisitos de entrega, formato de entrega, rúbrica o enlaces de consulta..."
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-medium text-xs sm:text-sm text-slate-900 outline-none transition-all resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-all text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto bg-[#003B5C] text-white hover:bg-blue-800 active:scale-95 px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 border border-[#FFD100]/40 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : (isEditing ? 'Actualizar Actividad' : 'Crear Asignación')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL ULTRA PROFESIONAL: FORMATO DE CAPTURA DE CALIFICACIONES
      ========================================================================= */}
      {evaluatingActivity && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[110] p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* ENCABEZADO INSTITUCIONAL */}
            <div className="bg-gradient-to-r from-[#003B5C] via-[#002b45] to-[#001D30] text-white p-5 sm:p-7 shrink-0 border-b-4 border-[#FFD100] relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
                <img src={fcqbLogo} alt="FCQB" className="h-32 object-contain" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="bg-[#FFD100] text-[#003B5C] px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                      {evaluatingActivity.tipo}
                    </span>
                    <span className="bg-white/10 text-blue-200 px-3 py-0.5 rounded-full text-[9px] font-bold">
                      Grupo: {evaluatingActivity.grupo_nombre}
                    </span>
                    <span className="bg-white/10 text-blue-200 px-3 py-0.5 rounded-full text-[9px] font-bold">
                      Puntaje Máximo: {evaluatingActivity.puntos_max} pts
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {evaluatingActivity.titulo}
                  </h2>
                  <p className="text-blue-200/80 text-xs font-medium mt-0.5">
                    {evaluatingActivity.materia_nombre} • Unidad {evaluatingActivity.unidad}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/10 border border-white/20 px-4 py-2 rounded-2xl text-center hidden sm:block">
                    <span className="text-[9px] font-black uppercase text-blue-200 tracking-wider block">Avance de Captura</span>
                    <span className="text-lg font-black text-[#FFD100]">
                      {evalMetrics.progressPct}%
                    </span>
                  </div>
                  <button
                    onClick={() => setEvaluatingActivity(null)}
                    className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-all"
                    title="Cerrar Captura"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* BANNER DINÁMICO DE MÉTRICAS EN TIEMPO REAL */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Promedio de Actividad</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-xl font-black ${
                    evalMetrics.avg >= (evaluatingActivity.puntos_max * 0.85)
                      ? 'text-emerald-700'
                      : evalMetrics.avg >= (evaluatingActivity.puntos_max * 0.7)
                      ? 'text-[#003B5C]'
                      : 'text-rose-600'
                  }`}>
                    {evalMetrics.avg.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">/ {evaluatingActivity.puntos_max}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Calificados</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-slate-900">{evalMetrics.gradedCount}</span>
                  <span className="text-[10px] text-slate-400 font-bold">de {evalMetrics.total}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Entregados</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-blue-700">{evalMetrics.delivered}</span>
                  <span className="text-[10px] text-slate-400 font-bold">alumnos</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Aprobados (&gt;= 7.0)</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-600">{evalMetrics.passed}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    ({evalMetrics.gradedCount > 0 ? Math.round((evalMetrics.passed / evalMetrics.gradedCount) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">No Acreditados (&lt; 7.0)</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-rose-600">{evalMetrics.failed}</span>
                  <span className="text-[10px] text-rose-600 font-bold">
                    ({evalMetrics.gradedCount > 0 ? Math.round((evalMetrics.failed / evalMetrics.gradedCount) * 100) : 0}%)
                  </span>
                </div>
              </div>

            </div>

            {/* BARRA DE HERRAMIENTAS Y ACCIONES EN LOTE (BATCH ACTIONS) */}
            <div className="p-4 bg-white border-b border-slate-200 shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Buscador de alumnos */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar estudiante por nombre o matrícula..."
                  value={evalSearchTerm}
                  onChange={e => setEvalSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#003B5C] rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20 transition-all"
                />
                {evalSearchTerm && (
                  <button
                    onClick={() => setEvalSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtros rápidos de lista */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEvalFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    evalFilter === 'ALL' ? 'bg-[#003B5C] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({activityStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEvalFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    evalFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sin Calif.
                </button>
                <button
                  type="button"
                  onClick={() => setEvalFilter('UNSUBMITTED')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    evalFilter === 'UNSUBMITTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Sin Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setEvalFilter('PASSED')}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    evalFilter === 'PASSED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Aprobados
                </button>
              </div>

              {/* Menú de acciones masivas para ahorrar tiempo al docente */}
              <div className="flex items-center gap-1.5 self-end md:self-auto">
                <button
                  type="button"
                  onClick={handleBatchMarkDelivered}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                  title="Marcar a todos los alumnos como Entregado"
                >
                  <span>✓</span>
                  <span>Todos Entregaron</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchMaxScoreToDelivered}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                  title={`Asignar ${evaluatingActivity.puntos_max} pts a todos los que entregaron`}
                >
                  <span>⭐</span>
                  <span>Calif. Máx a Entregados</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchZeroUnsubmitted}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                  title="Asignar 0 a los no entregados"
                >
                  <span>0️⃣</span>
                  <span>0 a Faltantes</span>
                </button>
              </div>

            </div>

            {/* TABLA PRINCIPAL DE CAPTURA DE CALIFICACIONES */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50">
              {loadingStudents ? (
                <div className="p-20 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-bold text-slate-500">Cargando lista de estudiantes del grupo...</p>
                </div>
              ) : filteredStudentsForEvaluation.length === 0 ? (
                <div className="p-16 text-center space-y-2">
                  <span className="text-4xl block">🔍</span>
                  <p className="font-bold text-sm text-slate-700">No se encontraron estudiantes con los filtros aplicados</p>
                  <p className="text-xs text-slate-400">Prueba cambiando el filtro o limpiando el buscador.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Estudiante (Matrícula)</th>
                      <th className="py-3 px-4 text-center w-36">Estado de Entrega</th>
                      <th className="py-3 px-4 text-center w-48">Calificación ({evaluatingActivity.puntos_max} pts)</th>
                      <th className="py-3 px-4 text-center w-32">Equivalencia</th>
                      <th className="py-3 px-4 text-center w-32">Estatus</th>
                      <th className="py-3 px-4 text-center w-40">Asignar Rápido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 bg-white text-xs">
                    {filteredStudentsForEvaluation.map((student, idx) => {
                      const g = grades[student.id] || { calificacion: 0, entregado: false };
                      const currentScore = Number(g.calificacion || 0);
                      const isDelivered = Boolean(g.entregado);
                      const maxPts = evaluatingActivity.puntos_max || 10;
                      const normalized10 = (currentScore / maxPts) * 10;
                      const pct = Math.round((currentScore / maxPts) * 100);

                      const isPassed = normalized10 >= 7.0;

                      return (
                        <tr
                          key={student.id}
                          className={`hover:bg-blue-50/40 transition-colors ${
                            !isDelivered ? 'bg-slate-50/50' : ''
                          }`}
                        >
                          {/* 1. # Consecutivo */}
                          <td className="py-3.5 px-4 text-center font-bold text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* 2. Estudiante */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-slate-900 text-sm">{student.nombre}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                              <span className="font-bold text-slate-600">{student.id}</span>
                              {student.carrera && <span>• {student.carrera}</span>}
                              {student.semestre && <span>• Sem. {student.semestre}</span>}
                            </div>
                          </td>

                          {/* 3. Switch de Entrega */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const nextDelivered = !isDelivered;
                                setGrades(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    ...(prev[student.id] || {}),
                                    entregado: nextDelivered,
                                    calificacion: nextDelivered ? (prev[student.id]?.calificacion || maxPts) : 0
                                  }
                                }));
                              }}
                              className={`w-full py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                                isDelivered
                                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300'
                              }`}
                            >
                              <span>{isDelivered ? '✓' : '✕'}</span>
                              <span>{isDelivered ? 'Entregado' : 'Sin Entrega'}</span>
                            </button>
                          </td>

                          {/* 4. Campo Numérico de Calificación con Teclado Rápido */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                ref={el => (inputRefs.current[idx] = el)}
                                type="number"
                                step="0.1"
                                min="0"
                                max={maxPts}
                                value={currentScore === 0 && !isDelivered ? '' : currentScore}
                                placeholder="0.0"
                                onKeyDown={e => handleKeyDown(e, idx)}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const val = e.target.value === '' ? 0 : Math.min(maxPts, Math.max(0, Number(e.target.value)));
                                  setGrades(prev => ({
                                    ...prev,
                                    [student.id]: {
                                      ...(prev[student.id] || {}),
                                      calificacion: val,
                                      entregado: val > 0 ? true : isDelivered
                                    }
                                  }));
                                }}
                                className={`w-28 py-2 px-3 text-center font-black text-sm rounded-xl outline-none transition-all border-2 ${
                                  normalized10 >= 8.5
                                    ? 'bg-emerald-50/70 border-emerald-400 text-emerald-900 focus:ring-4 focus:ring-emerald-500/10'
                                    : normalized10 >= 7.0
                                    ? 'bg-blue-50/70 border-blue-400 text-[#003B5C] focus:ring-4 focus:ring-blue-500/10'
                                    : currentScore > 0
                                    ? 'bg-rose-50/70 border-rose-400 text-rose-900 focus:ring-4 focus:ring-rose-500/10'
                                    : 'bg-slate-100 border-slate-300 text-slate-600 focus:border-[#003B5C]'
                                }`}
                              />
                            </div>
                          </td>

                          {/* 5. Equivalencia y Porcentaje */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="font-black text-slate-800 text-xs">
                              {normalized10.toFixed(1)} / 10
                            </div>
                            <div className="w-20 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  normalized10 >= 8.5 ? 'bg-emerald-500' : normalized10 >= 7.0 ? 'bg-[#003B5C]' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{pct}%</span>
                          </td>

                          {/* 6. Estatus de Aprobación */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {currentScore === 0 && !isDelivered ? (
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                Pendiente
                              </span>
                            ) : isPassed ? (
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                                ✓ Acreditado
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200 shadow-xs">
                                ⚠️ No Acreditado
                              </span>
                            )}
                          </td>

                          {/* 7. Asignación Rápida con 1 Clic */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setGrades(prev => ({
                                    ...prev,
                                    [student.id]: { ...(prev[student.id] || {}), calificacion: maxPts, entregado: true }
                                  }));
                                }}
                                className="px-2 py-1 rounded-md text-[9px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-all"
                                title={`Poner nota máxima (${maxPts})`}
                              >
                                {maxPts}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const score8 = Number(((maxPts * 0.8)).toFixed(1));
                                  setGrades(prev => ({
                                    ...prev,
                                    [student.id]: { ...(prev[student.id] || {}), calificacion: score8, entregado: true }
                                  }));
                                }}
                                className="px-2 py-1 rounded-md text-[9px] font-black bg-blue-100 hover:bg-blue-200 text-[#003B5C] border border-blue-300 transition-all"
                                title="Poner nota de 80%"
                              >
                                {Number(((maxPts * 0.8)).toFixed(1))}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const score6 = Number(((maxPts * 0.6)).toFixed(1));
                                  setGrades(prev => ({
                                    ...prev,
                                    [student.id]: { ...(prev[student.id] || {}), calificacion: score6, entregado: true }
                                  }));
                                }}
                                className="px-2 py-1 rounded-md text-[9px] font-black bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all"
                                title="Poner nota de 60%"
                              >
                                {Number(((maxPts * 0.6)).toFixed(1))}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setGrades(prev => ({
                                    ...prev,
                                    [student.id]: { ...(prev[student.id] || {}), calificacion: 0, entregado: false }
                                  }));
                                }}
                                className="px-2 py-1 rounded-md text-[9px] font-black bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition-all"
                                title="Poner 0"
                              >
                                0
                              </button>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* PIE DEL MODAL CON BOTONES DE GUARDADO Y RESUMEN */}
            <div className="p-4 sm:p-6 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>{evalMetrics.gradedCount} de {evalMetrics.total} evaluados</span>
                </span>
                <span>•</span>
                <span className="text-[11px] text-slate-400">
                  Presiona <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[10px]">Enter</kbd> para avanzar al siguiente alumno
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setEvaluatingActivity(null)}
                  className="px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-all"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={isSavingGrades}
                  onClick={handleSaveGrades}
                  className="flex-1 sm:flex-none bg-[#003B5C] hover:bg-blue-800 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-[#FFD100]/40"
                >
                  {isSavingGrades ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>Actualizando Métricas...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Guardar Calificaciones</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ActivitiesModule;
