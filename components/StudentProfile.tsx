import React, { useState, useEffect, useRef } from 'react';
import { Student, RiskLevel, UserRole, Grade, ActivityType, Turno } from '../types';
import { RISK_COLORS, RISK_LABELS, calculateRisk, UAS_COLORS } from '../constants';
import { analyzeStudentRisk } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import fcqbLogo from './images/fcqb_logo.png';
import uasEscudo from './images/uas_escudo.png';

interface StudentProfileProps {
  student: Student;
  role: UserRole;
  userId?: string;
  onClose: () => void;
}

interface AcademicRecord {
  materia: string;
  promedio: number;
  asistencia: number;
  risk: RiskLevel;
}

interface AssignedTutor {
  id: string;
  nombre: string;
  email: string;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, role, userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'attendance_activities' | 'interventions' | 'ai'>('info');
  
  // Datos complementarios del estudiante
  const [assignedTutor, setAssignedTutor] = useState<AssignedTutor | null>(null);
  const [acentuacion, setAcentuacion] = useState<{ id: string; nombre: string } | null>(null);
  const [activeCycleName, setActiveCycleName] = useState<string>('Ciclo Actual');

  // Factores interactivos
  const [personalFactors, setPersonalFactors] = useState<string[]>(student.personalFactors || []);
  const [academicFactors, setAcademicFactors] = useState<string[]>(student.academicFactors || []);
  const [institutionalFactors, setInstitutionalFactors] = useState<string[]>(student.institutionalFactors || []);
  const [isAddingFactor, setIsAddingFactor] = useState(false);
  const [newFactorText, setNewFactorText] = useState('');
  const [newFactorCategory, setNewFactorCategory] = useState<'personal' | 'academic' | 'institutional'>('personal');
  const [isSavingFactors, setIsSavingFactors] = useState(false);

  // IA Gemini
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Bitácora / Intervenciones
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [isSavingIntervention, setIsSavingIntervention] = useState(false);
  const [newIntervention, setNewIntervention] = useState({
    type: 'Asesoría Académica',
    description: '',
    additionalNotes: '',
    estatus: 'COMPLETED'
  });

  // Historial Académico
  const [academicHistory, setAcademicHistory] = useState<AcademicRecord[]>([]);
  const [cycleTrajectoryRecords, setCycleTrajectoryRecords] = useState<any[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);

  // Asistencias y Actividades
  const [detailedAttendance, setDetailedAttendance] = useState<{ fecha: string; presente: boolean; grupo: string }[]>([]);
  const [loadingDetailedAttendance, setLoadingDetailedAttendance] = useState(false);
  const [detailedActivities, setDetailedActivities] = useState<any[]>([]);
  const [loadingDetailedActivities, setLoadingDetailedActivities] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editingGradeContent, setEditingGradeContent] = useState<Partial<Grade>>({});
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Vista de impresión
  const [showPrintModal, setShowPrintModal] = useState(false);

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  // Cargar datos de tutor y acentuación
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // 1. Ciclo activo
        const { data: cycleData } = await supabase
          .from('ciclos_escolares')
          .select('nombre')
          .eq('es_activo', true)
          .maybeSingle();
        if (cycleData?.nombre) setActiveCycleName(cycleData.nombre);

        // 2. Tutor asignado
        const { data: directTutoria } = await supabase
          .from('tutorias')
          .select('id, tutor_id, docentes(id, nombre, email)')
          .eq('estudiante_id', student.id)
          .limit(1);

        if (directTutoria && directTutoria.length > 0) {
          const doc = getRelation(directTutoria[0].docentes);
          if (doc) setAssignedTutor({ id: doc.id, nombre: doc.nombre, email: doc.email });
        } else {
          // Fallback a tutoría por grupo
          const { data: groupTutoria } = await supabase
            .from('tutorias')
            .select('id, tutor_id, docentes(id, nombre, email)')
            .eq('nombre_grupo', student.group)
            .limit(1);
          if (groupTutoria && groupTutoria.length > 0) {
            const doc = getRelation(groupTutoria[0].docentes);
            if (doc) setAssignedTutor({ id: doc.id, nombre: doc.nombre, email: doc.email });
          }
        }

        // 3. Acentuación disciplinar
        const { data: accData } = await supabase
          .from('estudiantes_acentuacion')
          .select('id, acentuaciones(id, nombre)')
          .eq('estudiante_id', student.id)
          .limit(1);

        if (accData && accData.length > 0) {
          const acc = getRelation(accData[0].acentuaciones);
          if (acc) setAcentuacion({ id: acc.id, nombre: acc.nombre });
        }
      } catch (err) {
        console.error("Error al cargar metadatos del estudiante:", err);
      }
    };

    fetchMetadata();
    fetchRealAcademicHistory();
    fetchInterventions();
  }, [student.id]);

  useEffect(() => {
    if (activeTab === 'ai' && !aiAnalysis) fetchAiAnalysis();
    if (activeTab === 'interventions') fetchInterventions();
    if (activeTab === 'academic') fetchRealAcademicHistory();
    if (activeTab === 'attendance_activities') {
      fetchDetailedAttendance();
      fetchDetailedActivities();
    }
  }, [activeTab]);

  // Sincronizar Historial Académico
  const fetchRealAcademicHistory = async () => {
    setLoadingAcademic(true);
    try {
      const { data: gradesData, error: gradesError } = await supabase
        .from('calificaciones')
        .select(`
          calificacion,
          actividades (
            id,
            puntos_max,
            grupos (
              id,
              nombre_grupo,
              materias (nombre)
            )
          )
        `)
        .eq('estudiante_id', student.id);

      if (gradesError) throw gradesError;

      const { data: attendanceData, error: attError } = await supabase
        .from('asistencias')
        .select('grupo_id, presente')
        .eq('estudiante_id', student.id);

      if (attError) throw attError;

      const historyMap: Record<string, { totalGrade: number; count: number; grupo_id: string }> = {};

      gradesData?.forEach(g => {
        const activity = getRelation(g.actividades);
        const grupo = getRelation(activity?.grupos);
        const materia = getRelation(grupo?.materias);
        const materiaNombre = materia?.nombre || 'Materia Desconocida';

        if (!historyMap[materiaNombre]) {
          historyMap[materiaNombre] = { totalGrade: 0, count: 0, grupo_id: grupo?.id };
        }

        const normalizedGrade = (Number(g.calificacion) / (activity?.puntos_max || 10)) * 10;
        historyMap[materiaNombre].totalGrade += normalizedGrade;
        historyMap[materiaNombre].count += 1;
      });

      const processedHistory: AcademicRecord[] = Object.keys(historyMap).map(materiaName => {
        const info = historyMap[materiaName];
        const avg = info.totalGrade / info.count;

        const relevantAtt = attendanceData?.filter(a => a.grupo_id === info.grupo_id) || [];
        const attPerc = relevantAtt.length > 0
          ? (relevantAtt.filter(a => a.presente).length / relevantAtt.length) * 100
          : 100;

        return {
          materia: materiaName,
          promedio: Number(avg.toFixed(1)),
          asistencia: Math.round(attPerc),
          risk: calculateRisk(avg, attPerc)
        };
      });

      setAcademicHistory(processedHistory);

      // Trayectoria por periodos históricos
      const { data: trajectoryData } = await supabase
        .from('historial_estudiantes_ciclo')
        .select('*, ciclos_escolares(nombre)')
        .eq('estudiante_id', student.id)
        .order('created_at', { ascending: false });

      setCycleTrajectoryRecords(trajectoryData || []);
    } catch (err) {
      console.error("Error al sincronizar historial:", err);
    } finally {
      setLoadingAcademic(false);
    }
  };

  // Cargar Intervenciones
  const fetchInterventions = async () => {
    setLoadingInterventions(true);
    try {
      const { data, error } = await supabase
        .from('intervenciones')
        .select(`*, docentes(nombre, email)`)
        .eq('estudiante_id', student.id)
        .order('fecha', { ascending: false });
      if (error) throw error;
      setInterventions(data || []);
    } catch (err) {
      console.error("Error al cargar bitácora:", err);
    } finally {
      setLoadingInterventions(false);
    }
  };

  // Cargar Asistencias
  const fetchDetailedAttendance = async () => {
    setLoadingDetailedAttendance(true);
    try {
      let groupIds: string[] = [];
      let groupMap: Record<string, string> = {};

      if (role === UserRole.DOCENTE && userId) {
        const { data: groups } = await supabase
          .from('grupos')
          .select('id, nombre_grupo, materias(nombre)')
          .eq('docente_id', userId);
        if (!groups || groups.length === 0) {
          setDetailedAttendance([]);
          setLoadingDetailedAttendance(false);
          return;
        }
        groupIds = groups.map(g => g.id);
        groupMap = groups.reduce((acc: any, g: any) => {
          acc[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
          return acc;
        }, {});
      } else {
        // ADMIN / TUTOR: Consulta todos los grupos asociados al estudiante
        const { data: allGroups } = await supabase
          .from('grupos')
          .select('id, nombre_grupo, materias(nombre)');
        (allGroups || []).forEach(g => {
          groupMap[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
        });
      }

      let attQuery = supabase
        .from('asistencias')
        .select('*')
        .eq('estudiante_id', student.id)
        .order('fecha', { ascending: false });

      if (role === UserRole.DOCENTE && groupIds.length > 0) {
        attQuery = attQuery.in('grupo_id', groupIds);
      }

      const { data: attendanceData, error } = await attQuery;
      if (error) throw error;

      setDetailedAttendance((attendanceData || []).map(a => ({
        fecha: a.fecha,
        presente: a.presente,
        grupo: groupMap[a.grupo_id] || 'Grupo de Clase'
      })));
    } catch (err) {
      console.error("Error al obtener asistencia detallada:", err);
    } finally {
      setLoadingDetailedAttendance(false);
    }
  };

  // Cargar Actividades
  const fetchDetailedActivities = async () => {
    setLoadingDetailedActivities(true);
    try {
      let groupIds: string[] = [];
      let groupMap: Record<string, string> = {};

      if (role === UserRole.DOCENTE && userId) {
        const { data: groups } = await supabase
          .from('grupos')
          .select('id, nombre_grupo, materias(nombre)')
          .eq('docente_id', userId);
        if (!groups || groups.length === 0) {
          setDetailedActivities([]);
          setLoadingDetailedActivities(false);
          return;
        }
        groupIds = groups.map(g => g.id);
        groupMap = groups.reduce((acc: any, g: any) => {
          acc[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
          return acc;
        }, {});
      } else {
        const { data: allGroups } = await supabase
          .from('grupos')
          .select('id, nombre_grupo, materias(nombre)');
        (allGroups || []).forEach(g => {
          groupMap[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
        });
      }

      let actQuery = supabase
        .from('actividades')
        .select('*')
        .order('fecha_entrega', { ascending: false });

      if (role === UserRole.DOCENTE && groupIds.length > 0) {
        actQuery = actQuery.in('grupo_id', groupIds);
      }

      const { data: acts, error: actsError } = await actQuery;
      if (actsError) throw actsError;

      if (!acts || acts.length === 0) {
        setDetailedActivities([]);
        setLoadingDetailedActivities(false);
        return;
      }

      const actIds = acts.map(a => a.id);
      const { data: grades, error: gradesError } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', student.id)
        .in('actividad_id', actIds);

      if (gradesError) throw gradesError;

      const detailed = acts
        .map(act => {
          const grade = grades?.find(g => g.actividad_id === act.id) || null;
          return {
            actividad: act,
            grade: grade,
            grupo_nombre: groupMap[act.grupo_id] || 'Asignatura Registrada'
          };
        })
        .filter(item => (role === UserRole.DOCENTE ? true : item.grade !== null));

      setDetailedActivities(detailed);
    } catch (err) {
      console.error("Error al obtener actividades:", err);
    } finally {
      setLoadingDetailedActivities(false);
    }
  };

  // Guardar calificación rápida (Docentes)
  const handleSaveGrade = async (actividadId: string, currentGrade: any) => {
    setIsSavingGrade(true);
    try {
      const payload = {
        actividad_id: actividadId,
        estudiante_id: student.id,
        calificacion: editingGradeContent.calificacion !== undefined ? editingGradeContent.calificacion : (currentGrade?.calificacion || 0),
        comentarios: editingGradeContent.comentarios !== undefined ? editingGradeContent.comentarios : (currentGrade?.comentarios || ''),
        entregado: editingGradeContent.entregado !== undefined ? editingGradeContent.entregado : (currentGrade?.entregado || false),
        fecha_evaluacion: new Date().toISOString()
      };

      if (currentGrade?.id) {
        const { error } = await supabase.from('calificaciones').update(payload).eq('id', currentGrade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('calificaciones').insert([payload]);
        if (error) throw error;
      }

      setEditingGradeId(null);
      setEditingGradeContent({});
      fetchDetailedActivities();
      fetchRealAcademicHistory();
    } catch (err: any) {
      alert("Error al guardar calificación: " + err.message);
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Guardar nueva intervención
  const handleSaveIntervention = async () => {
    if (!newIntervention.description.trim()) {
      alert("Por favor ingrese la descripción o minuta de la intervención.");
      return;
    }

    setIsSavingIntervention(true);
    try {
      const { error } = await supabase.from('intervenciones').insert([{
        estudiante_id: student.id,
        tipo_intervencion: newIntervention.type,
        descripcion: newIntervention.description.trim(),
        notas_adicionales: newIntervention.additionalNotes.trim(),
        ciclo_id: student.ciclo_id,
        estatus: newIntervention.estatus || 'COMPLETED'
      }]);

      if (error) throw error;

      setShowAddIntervention(false);
      setNewIntervention({
        type: 'Asesoría Académica',
        description: '',
        additionalNotes: '',
        estatus: 'COMPLETED'
      });
      fetchInterventions();
    } catch (err: any) {
      alert("Error al guardar intervención: " + err.message);
    } finally {
      setIsSavingIntervention(false);
    }
  };

  // Agregar nuevo factor de riesgo
  const handleAddFactor = async () => {
    if (!newFactorText.trim()) return;
    setIsSavingFactors(true);

    const updatedPersonal = [...personalFactors];
    const updatedAcademic = [...academicFactors];
    const updatedInstitutional = [...institutionalFactors];

    if (newFactorCategory === 'personal') updatedPersonal.push(newFactorText.trim());
    if (newFactorCategory === 'academic') updatedAcademic.push(newFactorText.trim());
    if (newFactorCategory === 'institutional') updatedInstitutional.push(newFactorText.trim());

    try {
      const { error } = await supabase
        .from('estudiantes')
        .update({
          factores_personales: updatedPersonal,
          factores_academicos: updatedAcademic,
          factores_institucionales: updatedInstitutional
        })
        .eq('id', student.id);

      if (error) throw error;

      setPersonalFactors(updatedPersonal);
      setAcademicFactors(updatedAcademic);
      setInstitutionalFactors(updatedInstitutional);
      setNewFactorText('');
      setIsAddingFactor(false);
    } catch (err: any) {
      alert("Error al actualizar factores: " + err.message);
    } finally {
      setIsSavingFactors(false);
    }
  };

  // Eliminar factor de riesgo
  const handleRemoveFactor = async (category: 'personal' | 'academic' | 'institutional', index: number) => {
    setIsSavingFactors(true);
    const updatedPersonal = category === 'personal' ? personalFactors.filter((_, i) => i !== index) : personalFactors;
    const updatedAcademic = category === 'academic' ? academicFactors.filter((_, i) => i !== index) : academicFactors;
    const updatedInstitutional = category === 'institutional' ? institutionalFactors.filter((_, i) => i !== index) : institutionalFactors;

    try {
      const { error } = await supabase
        .from('estudiantes')
        .update({
          factores_personales: updatedPersonal,
          factores_academicos: updatedAcademic,
          factores_institucionales: updatedInstitutional
        })
        .eq('id', student.id);

      if (error) throw error;

      setPersonalFactors(updatedPersonal);
      setAcademicFactors(updatedAcademic);
      setInstitutionalFactors(updatedInstitutional);
    } catch (err: any) {
      alert("Error al remover factor: " + err.message);
    } finally {
      setIsSavingFactors(false);
    }
  };

  // Consultar IA Gemini
  const fetchAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const result = await analyzeStudentRisk({
        nombre: student.name,
        promedio: student.average,
        asistencia: student.attendance,
        carrera: student.career,
        semestre: student.semester,
        factores: {
          personales: personalFactors,
          academicos: academicFactors,
          institucionales: institutionalFactors
        }
      });
      setAiAnalysis(result);
    } catch (err) {
      console.error("Gemini Error:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'Asesoría Académica':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Apoyo Psicológico':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Seguimiento de Beca':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Vinculación Padres/Tutores':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Canalización Médica':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const approvedCourses = academicHistory.filter(h => h.promedio >= 7.0).length;
  const isRegular = academicHistory.length === 0 || approvedCourses === academicHistory.length;

  const canEditFactors = role === UserRole.ADMIN || role === UserRole.TUTOR;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-[70] p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] overflow-hidden flex flex-col border border-slate-200/80">
        
        {/* ================= HEADER INSTITUCIONAL UAS • FCQB ================= */}
        <div className="bg-gradient-to-r from-[#003B5C] via-[#002840] to-[#001D30] text-white p-5 sm:p-7 relative overflow-hidden shrink-0 border-b-4 border-[#FFD100]">
          {/* Marcas de agua institucionales decorativas */}
          <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
            <img src={fcqbLogo} alt="FCQB" className="h-32 object-contain" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Avatar Estudiante con Semáforo Ring */}
              <div className="relative shrink-0">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-xl ring-4 ${
                    student.risk === RiskLevel.HIGH
                      ? 'bg-rose-600 ring-rose-300/40'
                      : student.risk === RiskLevel.MEDIUM
                      ? 'bg-amber-500 ring-amber-300/40'
                      : 'bg-emerald-600 ring-emerald-300/40'
                  }`}
                >
                  {student.name.charAt(0)}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase border shadow-md ${
                    student.risk === RiskLevel.HIGH
                      ? 'bg-rose-500 text-white border-rose-300'
                      : student.risk === RiskLevel.MEDIUM
                      ? 'bg-amber-400 text-slate-900 border-amber-200'
                      : 'bg-emerald-400 text-slate-950 border-emerald-200'
                  }`}
                >
                  {RISK_LABELS[student.risk]}
                </div>
              </div>

              {/* Datos Clave */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="bg-white/15 text-white/90 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-sm border border-white/10">
                    Matrícula: {student.id}
                  </span>
                  <span className="bg-[#FFD100] text-[#003B5C] px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm">
                    {student.group}
                  </span>
                  <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider">
                    {student.shift}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate leading-tight">
                  {student.name}
                </h2>

                <p className="text-blue-100/80 font-bold text-xs sm:text-sm tracking-wide mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{student.career}</span>
                  <span className="text-white/40">•</span>
                  <span>{student.semester}° Semestre</span>
                  {acentuacion && (
                    <>
                      <span className="text-white/40">•</span>
                      <span className="text-[#FFD100] font-black">Especialidad: {acentuacion.nombre}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Acciones de Cabecera */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                onClick={() => setShowPrintModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-white/15 transition-all shadow-sm active:scale-95"
                title="Imprimir o exportar ficha oficial"
              >
                <span>🖨️</span>
                <span className="hidden sm:inline">Ficha Oficial</span>
              </button>

              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all border border-white/15 active:scale-95"
                title="Cerrar Ficha"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Barra rápida de Tutor Asignado y Ciclo */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-blue-100/90 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[#FFD100] font-black">👨‍🏫 Tutor Académico:</span>
              {assignedTutor ? (
                <span className="font-semibold text-white">
                  {assignedTutor.nombre} {assignedTutor.email && <span className="text-blue-200 text-[10px]">({assignedTutor.email})</span>}
                </span>
              ) : (
                <span className="italic text-white/60">Sin tutor asignado en el ciclo activo</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-wider text-white/70">
              <span>Ciclo: <strong className="text-white">{activeCycleName}</strong></span>
              <span>•</span>
              <span className={isRegular ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                {isRegular ? '✓ Alumno Regular' : '⚠ Con Seguimiento Preventivo'}
              </span>
            </div>
          </div>
        </div>

        {/* ================= KPIS / TARJETAS RESUMEN ================= */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 shrink-0">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Promedio General</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-[#003B5C]">{student.average.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-400">/ 10</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Asistencia Global</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-900">{student.attendance}%</span>
              <span className="text-[10px] font-bold text-slate-400">cumplida</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Exámenes / Tareas</span>
            <div className="flex items-baseline gap-1 mt-1 text-xs font-black text-slate-700">
              <span title="Promedio Exámenes">📝 {student.avgExams ? student.avgExams.toFixed(1) : '-'}</span>
              <span className="text-slate-300">|</span>
              <span title="Promedio Tareas">📋 {student.avgTasks ? student.avgTasks.toFixed(1) : '-'}</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Intervenciones</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-600">{interventions.length}</span>
              <span className="text-[10px] font-bold text-slate-400">en bitácora</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Semáforo de Riesgo</span>
            <div className="mt-1">
              <span
                className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                  student.risk === RiskLevel.HIGH
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : student.risk === RiskLevel.MEDIUM
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                ● {RISK_LABELS[student.risk]}
              </span>
            </div>
          </div>
        </div>

        {/* ================= TABS DE NAVEGACIÓN ================= */}
        <div className="flex border-b border-slate-200 bg-white overflow-x-auto whitespace-nowrap hide-scrollbar shrink-0 px-4 sm:px-6">
          {[
            { id: 'info', label: 'Expediente Integral', icon: '👤', count: null },
            { id: 'academic', label: 'Historial y Calificaciones', icon: '📚', count: academicHistory.length },
            { id: 'attendance_activities', label: 'Asistencia y Actividades', icon: '📅', count: detailedActivities.length },
            { id: 'interventions', label: 'Bitácora de Tutoría', icon: '🛠️', count: interventions.length },
            { id: 'ai', label: 'Diagnóstico IA', icon: '✨', count: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 sm:px-7 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2.5 shrink-0 ${
                activeTab === tab.id
                  ? 'border-[#003B5C] text-[#003B5C] bg-blue-50/40'
                  : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                    activeTab === tab.id ? 'bg-[#003B5C] text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ================= CONTENIDO DE PESTAÑAS ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50">

          {/* 1. EXPEDIENTE INTEGRAL */}
          {activeTab === 'info' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              {/* Tarjeta de Datos Escolares Completos */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 text-[#003B5C] flex items-center justify-center font-black text-base border border-blue-100">
                      📋
                    </span>
                    <div>
                      <h3 className="text-base font-black text-[#003B5C]">Ficha de Identificación Académica</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Facultad de Ciencias Químico Biológicas • UAS
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
                    Ciclo Escolar: {activeCycleName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Nombre Completo</span>
                    <p className="font-bold text-slate-900 text-sm">{student.name}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Matrícula Escolar</span>
                    <p className="font-bold text-slate-900 text-sm font-mono">{student.id}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Licenciatura / Carrera</span>
                    <p className="font-bold text-slate-900 text-sm">{student.career}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Semestre y Grupo</span>
                    <p className="font-bold text-slate-900 text-sm">{student.semester}° Semestre — Grupo {student.group}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Turno Asignado</span>
                    <p className="font-bold text-slate-900 text-sm">{student.shift}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Tutor Académico</span>
                    <p className="font-bold text-slate-900 text-sm">
                      {assignedTutor ? assignedTutor.nombre : <span className="text-amber-600 italic">Sin tutor registrado</span>}
                    </p>
                  </div>
                  {acentuacion && (
                    <div className="sm:col-span-2 md:col-span-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase text-amber-800 tracking-wider block">Acentuación / Especialidad Disciplinar</span>
                        <p className="font-black text-amber-950 text-sm mt-0.5">{acentuacion.nombre}</p>
                      </div>
                      <span className="text-xl">🧪</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FACTORES DE RIESGO POR DIMENSIÓN */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span>🎯</span> Dimensiones de Riesgo y Factores Determinantes
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      Condiciones registradas que inciden en la trayectoria académica
                    </p>
                  </div>
                  {canEditFactors && !isAddingFactor && (
                    <button
                      onClick={() => setIsAddingFactor(true)}
                      className="bg-blue-50 text-[#003B5C] hover:bg-blue-100 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all self-start sm:self-auto border border-blue-200"
                    >
                      + Añadir Factor
                    </button>
                  )}
                </div>

                {/* Formulario para agregar factor */}
                {isAddingFactor && canEditFactors && (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-blue-200 space-y-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-[#003B5C] uppercase tracking-wider">
                        Registrar Factor de Riesgo / Observación
                      </h4>
                      <button
                        onClick={() => { setIsAddingFactor(false); setNewFactorText(''); }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕ Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Dimensión</label>
                        <select
                          value={newFactorCategory}
                          onChange={e => setNewFactorCategory(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                        >
                          <option value="personal">🧠 Factores Personales</option>
                          <option value="academic">📚 Factores Académicos</option>
                          <option value="institutional">🏛️ Factores Institucionales</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Descripción de la Observación</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ej. Trabaja turnos nocturnos, problema de salud..."
                            value={newFactorText}
                            onChange={e => setNewFactorText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddFactor(); }}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                          />
                          <button
                            onClick={handleAddFactor}
                            disabled={isSavingFactors || !newFactorText.trim()}
                            className="bg-[#003B5C] text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all disabled:opacity-50"
                          >
                            {isSavingFactors ? '...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Factores Personales */}
                  <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                        <span className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Personales
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">({personalFactors.length})</span>
                      </div>
                      <ul className="space-y-2">
                        {personalFactors.length > 0 ? (
                          personalFactors.map((f, i) => (
                            <li
                              key={i}
                              className="text-xs font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 shadow-xs group"
                            >
                              <span>{f}</span>
                              {canEditFactors && (
                                <button
                                  onClick={() => handleRemoveFactor('personal', i)}
                                  className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold px-1"
                                  title="Remover factor"
                                >
                                  ✕
                                </button>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="text-[11px] text-slate-400 font-bold italic py-4 text-center">
                            Sin observaciones registradas
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Factores Académicos */}
                  <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                        <span className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Académicos
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">({academicFactors.length})</span>
                      </div>
                      <ul className="space-y-2">
                        {academicFactors.length > 0 ? (
                          academicFactors.map((f, i) => (
                            <li
                              key={i}
                              className="text-xs font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 shadow-xs group"
                            >
                              <span>{f}</span>
                              {canEditFactors && (
                                <button
                                  onClick={() => handleRemoveFactor('academic', i)}
                                  className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold px-1"
                                  title="Remover factor"
                                >
                                  ✕
                                </button>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="text-[11px] text-slate-400 font-bold italic py-4 text-center">
                            Sin observaciones registradas
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Factores Institucionales */}
                  <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                        <span className="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Institucionales
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">({institutionalFactors.length})</span>
                      </div>
                      <ul className="space-y-2">
                        {institutionalFactors.length > 0 ? (
                          institutionalFactors.map((f, i) => (
                            <li
                              key={i}
                              className="text-xs font-semibold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 shadow-xs group"
                            >
                              <span>{f}</span>
                              {canEditFactors && (
                                <button
                                  onClick={() => handleRemoveFactor('institutional', i)}
                                  className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all text-xs font-bold px-1"
                                  title="Remover factor"
                                >
                                  ✕
                                </button>
                              )}
                            </li>
                          ))
                        ) : (
                          <li className="text-[11px] text-slate-400 font-bold italic py-4 text-center">
                            Sin observaciones registradas
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. HISTORIAL Y CALIFICACIONES */}
          {activeTab === 'academic' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              {/* Asignaturas del Ciclo Actual */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#003B5C]">Desempeño Académico por Asignatura</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Promedio de actividades evaluadas y porcentaje de asistencia por materia
                    </p>
                  </div>
                  <span className="text-xs font-black text-[#003B5C] bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                    {academicHistory.length} Asignaturas Registradas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Materia / Asignatura</th>
                        <th className="px-6 py-4 text-center">Promedio Actividades</th>
                        <th className="px-6 py-4 text-center">Asistencias</th>
                        <th className="px-6 py-4 text-right">Semáforo Riesgo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingAcademic ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">
                            Sincronizando calificaciones del servidor...
                          </td>
                        </tr>
                      ) : academicHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 font-bold text-xs">
                            Sin materias con evaluaciones registradas en el ciclo activo
                          </td>
                        </tr>
                      ) : (
                        academicHistory.map((course, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{course.materia}</td>
                            <td className="px-6 py-4 text-center font-black text-slate-900 text-sm">
                              <span className={course.promedio < 7.0 ? 'text-rose-600' : course.promedio < 8.0 ? 'text-amber-600' : 'text-[#003B5C]'}>
                                {course.promedio.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-700">
                              {course.asistencia}%
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border shadow-xs ${
                                  course.risk === RiskLevel.HIGH
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : course.risk === RiskLevel.MEDIUM
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}
                              >
                                {RISK_LABELS[course.risk]}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trayectoria Histórica por Ciclos */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#003B5C]">Trayectoria por Ciclos Escolares Anteriores</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Historial histórico acumulado en el sistema
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {cycleTrajectoryRecords.length} Ciclos Previos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Ciclo / Periodo</th>
                        <th className="px-6 py-4">Grupo Cursado</th>
                        <th className="px-6 py-4 text-center">Semestre</th>
                        <th className="px-6 py-4 text-center">Asistencia</th>
                        <th className="px-6 py-4 text-right">Nivel Riesgo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cycleTrajectoryRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400 font-bold text-xs">
                            No se registran periodos históricos previos para este estudiante
                          </td>
                        </tr>
                      ) : (
                        cycleTrajectoryRecords.map((item, idx) => {
                          const cycleName = getRelation(item.ciclos_escolares)?.nombre || 'Periodo Anterior';
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900">{cycleName}</td>
                              <td className="px-6 py-4 font-semibold text-slate-700">{item.grupo}</td>
                              <td className="px-6 py-4 text-center font-bold text-slate-800">{item.semestre}°</td>
                              <td className="px-6 py-4 text-center font-bold text-blue-700">{item.porcentaje_asistencia || 100}%</td>
                              <td className="px-6 py-4 text-right">
                                <span
                                  className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                                    item.nivel_riesgo === 'HIGH'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : item.nivel_riesgo === 'MEDIUM'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  {RISK_LABELS[item.nivel_riesgo as RiskLevel] || item.nivel_riesgo}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. ASISTENCIA Y ACTIVIDADES */}
          {activeTab === 'attendance_activities' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              {/* Tareas, Ejercicios y Exámenes */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#003B5C]">Actividades, Tareas y Evaluaciones</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Desglose de entregas y calificaciones individuales
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {detailedActivities.length} Actividades
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Actividad</th>
                        <th className="px-6 py-4">Grupo / Asignatura</th>
                        <th className="px-6 py-4 text-center">Entregado</th>
                        <th className="px-6 py-4 text-center">Calificación</th>
                        <th className="px-6 py-4">Comentarios</th>
                        {role === UserRole.DOCENTE && <th className="px-6 py-4 text-right">Acción</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingDetailedActivities ? (
                        <tr>
                          <td colSpan={role === UserRole.DOCENTE ? 6 : 5} className="py-12 text-center text-slate-400 font-bold animate-pulse text-xs">
                            Cargando actividades y calificaciones...
                          </td>
                        </tr>
                      ) : detailedActivities.length === 0 ? (
                        <tr>
                          <td colSpan={role === UserRole.DOCENTE ? 6 : 5} className="py-12 text-center text-slate-400 font-bold text-xs">
                            Sin actividades registradas para este estudiante
                          </td>
                        </tr>
                      ) : (
                        detailedActivities.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{item.actividad.titulo}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                {item.actividad.tipo} • Máx {item.actividad.puntos_max} pts
                              </div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-600 max-w-[180px] truncate">
                              {item.grupo_nombre}
                            </td>

                            {editingGradeId === item.actividad.id && role === UserRole.DOCENTE ? (
                              <>
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-[#003B5C] rounded"
                                    checked={editingGradeContent.entregado !== undefined ? editingGradeContent.entregado : (item.grade?.entregado || false)}
                                    onChange={e => setEditingGradeContent({ ...editingGradeContent, entregado: e.target.checked })}
                                  />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={item.actividad.puntos_max}
                                    className="w-16 p-1.5 rounded-lg border text-sm text-center font-bold"
                                    value={editingGradeContent.calificacion !== undefined ? editingGradeContent.calificacion : (item.grade?.calificacion || 0)}
                                    onChange={e => setEditingGradeContent({ ...editingGradeContent, calificacion: Number(e.target.value) })}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    className="w-full p-1.5 rounded-lg border text-xs"
                                    placeholder="Retroalimentación..."
                                    value={editingGradeContent.comentarios !== undefined ? editingGradeContent.comentarios : (item.grade?.comentarios || '')}
                                    onChange={e => setEditingGradeContent({ ...editingGradeContent, comentarios: e.target.value })}
                                  />
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingGradeId(null)}
                                      className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 hover:text-slate-700"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleSaveGrade(item.actividad.id, item.grade)}
                                      disabled={isSavingGrade}
                                      className="px-3 py-1 bg-[#003B5C] text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-800 disabled:opacity-50"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-4 text-center">
                                  {item.grade?.entregado ? (
                                    <span className="text-emerald-600 font-black">✓ Entregado</span>
                                  ) : (
                                    <span className="text-rose-500 font-bold">Sin Entrega</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center font-black text-slate-900 text-sm">
                                  {item.grade ? item.grade.calificacion : '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-500 italic text-[11px] max-w-[200px] truncate">
                                  {item.grade?.comentarios || '-'}
                                </td>
                                {role === UserRole.DOCENTE && (
                                  <td className="px-6 py-4 text-right">
                                    <button
                                      onClick={() => {
                                        setEditingGradeId(item.actividad.id);
                                        setEditingGradeContent({
                                          calificacion: item.grade?.calificacion,
                                          entregado: item.grade?.entregado,
                                          comentarios: item.grade?.comentarios
                                        });
                                      }}
                                      className="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                    >
                                      Editar
                                    </button>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial Detallado de Asistencias */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#003B5C]">Registro Diario de Asistencias</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Bitácora de asistencias y faltas por fecha
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    {detailedAttendance.length} Registros
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Asignatura / Grupo</th>
                        <th className="px-6 py-4 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingDetailedAttendance ? (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-slate-400 font-bold animate-pulse text-xs">
                            Cargando asistencias...
                          </td>
                        </tr>
                      ) : detailedAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-slate-400 font-bold text-xs">
                            Sin registros de asistencia documentados
                          </td>
                        </tr>
                      ) : (
                        detailedAttendance.map((record, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-900">
                              {new Date(record.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-slate-600">{record.grupo}</td>
                            <td className="px-6 py-3.5 text-right">
                              <span
                                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border ${
                                  record.presente
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {record.presente ? 'PRESENTE' : 'FALTA'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. BITÁCORA DE TUTORÍA */}
          {activeTab === 'interventions' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>🛠️</span> Bitácora de Acompañamiento y Tutoría
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Registro de acciones preventivas, acuerdos y seguimiento tutorial
                  </p>
                </div>
                {!showAddIntervention && (
                  <button
                    onClick={() => setShowAddIntervention(true)}
                    className="bg-[#003B5C] text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all shadow-md active:scale-95"
                  >
                    + Nueva Intervención
                  </button>
                )}
              </div>

              {/* Formulario Nueva Intervención */}
              {showAddIntervention && (
                <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-blue-200 shadow-lg space-y-5 animate-in slide-in-from-top-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-black text-sm text-[#003B5C] uppercase tracking-wider">
                      Registrar Nueva Acción de Tutoría
                    </h4>
                    <button
                      onClick={() => setShowAddIntervention(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕ Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                        Eje de Intervención
                      </label>
                      <select
                        value={newIntervention.type}
                        onChange={e => setNewIntervention({ ...newIntervention, type: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                      >
                        <option>Asesoría Académica</option>
                        <option>Apoyo Psicológico</option>
                        <option>Seguimiento de Beca</option>
                        <option>Vinculación Padres/Tutores</option>
                        <option>Canalización Médica</option>
                        <option>Otros</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                        Estatus de Seguimiento
                      </label>
                      <select
                        value={newIntervention.estatus}
                        onChange={e => setNewIntervention({ ...newIntervention, estatus: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                      >
                        <option value="COMPLETED">Completada / Atendida</option>
                        <option value="IN_PROGRESS">En Seguimiento Activo</option>
                        <option value="PENDING">Pendiente de Cita</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                        Minuta de Acuerdos y Situación Detectada
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Describa los motivos de la sesión, acuerdos asumidos por el estudiante y compromisos de seguimiento..."
                        value={newIntervention.description}
                        onChange={e => setNewIntervention({ ...newIntervention, description: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20 resize-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                        Notas Adicionales / Observaciones Confidenciales (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Comentarios adicionales para el expediente..."
                        value={newIntervention.additionalNotes}
                        onChange={e => setNewIntervention({ ...newIntervention, additionalNotes: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowAddIntervention(false)}
                      className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={handleSaveIntervention}
                      disabled={isSavingIntervention}
                      className="bg-[#003B5C] text-white px-7 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all shadow-md disabled:opacity-50"
                    >
                      {isSavingIntervention ? 'Guardando...' : 'Formalizar Registro'}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista Cronológica de Intervenciones */}
              <div className="space-y-4">
                {loadingInterventions ? (
                  <div className="text-center py-16 text-slate-400 font-bold text-xs animate-pulse">
                    Accediendo a la bitácora institucional...
                  </div>
                ) : interventions.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
                    <span className="text-4xl block mb-2">📖</span>
                    <p className="text-slate-500 font-bold text-sm">Sin intervenciones registradas para este estudiante</p>
                    <p className="text-slate-400 text-xs mt-1">
                      Utilice el botón "Nueva Intervención" para registrar la primera sesión de tutoría.
                    </p>
                  </div>
                ) : (
                  interventions.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all border-l-6 border-l-[#003B5C]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getTypeBadgeClass(item.tipo_intervencion)}`}>
                          {item.tipo_intervencion}
                        </span>
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold">
                          <span>📅 {new Date(item.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          <span>•</span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black">
                            {item.estatus || 'COMPLETED'}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-800 font-medium text-sm leading-relaxed mb-4">
                        {item.description || item.descripcion}
                      </p>

                      {item.notas_adicionales && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-normal mb-3">
                          <strong className="text-slate-800 font-bold block text-[10px] uppercase">Nota adicional:</strong>
                          {item.notas_adicionales}
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#003B5C] text-white flex items-center justify-center font-black text-[9px]">
                            UAS
                          </span>
                          <span className="font-bold text-slate-700">
                            {item.docentes?.nombre || 'Docente Tutor Responsable'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. DIAGNÓSTICO INTELIGENTE IA */}
          {activeTab === 'ai' && (
            <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
              {loadingAi ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
                  <div>
                    <h4 className="text-base font-black text-[#003B5C] tracking-wide">
                      Analizando Perfil y Trayectoria Integral
                    </h4>
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      El modelo de IA está ponderando promedio, asistencias, historial y factores de riesgo...
                    </p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-6">
                  {/* Tarjeta de Diagnóstico */}
                  <div
                    className={`p-6 sm:p-8 rounded-3xl border-2 shadow-sm ${
                      aiAnalysis.riskLevel === 'HIGH'
                        ? 'border-rose-200 bg-rose-50/50'
                        : aiAnalysis.riskLevel === 'MEDIUM'
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-emerald-200 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✨</span>
                        <div>
                          <h3 className="text-base font-black text-[#003B5C]">
                            Diagnóstico Asistido de Trayectoria Académica
                          </h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Ponderación de factores y riesgo de rezago escolar
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                          aiAnalysis.riskLevel === 'HIGH'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : aiAnalysis.riskLevel === 'MEDIUM'
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-emerald-600 text-white border-emerald-700'
                        }`}
                      >
                        Nivel {RISK_LABELS[aiAnalysis.riskLevel as RiskLevel] || aiAnalysis.riskLevel}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 leading-relaxed italic bg-white/70 p-5 rounded-2xl border border-black/5">
                      "{aiAnalysis.explanation}"
                    </p>
                  </div>

                  {/* Hoja de Ruta de Intervención Recomendada */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span>📋</span> Acciones Preventivas Sugeridas
                      </h4>
                      <ul className="space-y-3">
                        {(aiAnalysis.recommendedInterventions || []).map((rec: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-xs text-slate-700 font-semibold bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                            <span className="w-6 h-6 rounded-lg bg-[#003B5C] text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="leading-snug">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gradient-to-br from-[#003B5C] to-[#002840] p-6 sm:p-8 rounded-3xl text-white shadow-md flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD100]">
                          Plan de Acompañamiento
                        </span>
                        <h4 className="text-lg font-black text-white mt-1 mb-3">
                          Intervención Inmediata de Tutoría
                        </h4>
                        <p className="text-xs text-blue-100/90 leading-relaxed font-medium mb-6">
                          Con base en el diagnóstico del modelo, se recomienda formalizar un acuerdo con el estudiante y programar una sesión de asesoría académica o canalización institucional.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setActiveTab('interventions');
                            setShowAddIntervention(true);
                            if (aiAnalysis.recommendedInterventions?.[0]) {
                              setNewIntervention(prev => ({
                                ...prev,
                                description: `Acción acordada con base en diagnóstico: ${aiAnalysis.recommendedInterventions[0]}`
                              }));
                            }
                          }}
                          className="w-full bg-[#FFD100] text-[#003B5C] py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-white transition-all shadow-md text-center block"
                        >
                          Formalizar en Bitácora
                        </button>
                        <button
                          onClick={fetchAiAnalysis}
                          className="w-full text-center text-[10px] font-black uppercase tracking-wider text-blue-200 hover:text-white py-2"
                        >
                          🔄 Recalcular Diagnóstico
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
                  <span className="text-4xl block">✨</span>
                  <p className="text-slate-600 font-bold text-sm">
                    No se ha generado un análisis para este estudiante en la sesión activa
                  </p>
                  <button
                    onClick={fetchAiAnalysis}
                    className="bg-[#003B5C] text-white px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all shadow-md"
                  >
                    Generar Diagnóstico Ahora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL DE VISTA PREVIA / IMPRESIÓN OFICIAL ================= */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[90] p-2 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 sm:p-10 text-slate-900 border border-slate-200 relative my-auto">
            {/* Botones de acción del modal */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-black uppercase tracking-wider text-[#003B5C] flex items-center gap-2">
                <span>🖨️</span> Expediente Oficial Listo para Impresión / PDF
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-[#003B5C] hover:bg-blue-800 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2"
                >
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* DOCUMENTO OFICIAL FORMAL (MEMBRETE UAS - FCQB) */}
            <div className="space-y-6 text-slate-900">
              {/* Encabezado Institucional */}
              <div className="flex items-center justify-between border-b-2 border-[#003B5C] pb-4">
                <img src={uasEscudo} alt="Escudo UAS" className="h-16 w-16 object-contain" />
                <div className="text-center px-4">
                  <h1 className="text-sm sm:text-base font-black text-[#003B5C] tracking-tight uppercase leading-tight">
                    Universidad Autónoma de Sinaloa
                  </h1>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Facultad de Ciencias Químico Biológicas
                  </h2>
                  <p className="text-[10px] font-black text-[#FFD100] bg-[#003B5C] px-3 py-0.5 rounded-full inline-block uppercase tracking-wider mt-1">
                    Sistema de Seguimiento de Trayectoria Académica (STA)
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Ficha Técnica y Expediente Académico del Estudiante
                  </p>
                </div>
                <img src={fcqbLogo} alt="Logo FCQB" className="h-16 w-16 object-contain" />
              </div>

              {/* Datos Generales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Estudiante:</span>
                  <strong className="text-slate-900 text-sm block">{student.name}</strong>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Matrícula:</span>
                  <strong className="text-slate-900 text-sm block font-mono">{student.id}</strong>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Programa / Carrera:</span>
                  <strong className="text-slate-900 block">{student.career}</strong>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Semestre y Grupo:</span>
                  <strong className="text-slate-900 block">{student.semester}° — {student.group} ({student.shift})</strong>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Tutor Asignado:</span>
                  <span className="font-bold text-slate-800 block">{assignedTutor ? assignedTutor.nombre : 'No asignado'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Ciclo Escolar:</span>
                  <span className="font-bold text-slate-800 block">{activeCycleName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Promedio General:</span>
                  <span className="font-black text-[#003B5C] text-sm block">{student.average.toFixed(1)} / 10</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Semáforo de Riesgo:</span>
                  <span className="font-black text-slate-900 block uppercase">
                    {RISK_LABELS[student.risk]} ({student.attendance}% asistencia)
                  </span>
                </div>
              </div>

              {/* Calificaciones y Desempeño */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#003B5C] mb-2 pb-1 border-b border-slate-200">
                  Resumen de Materias y Calificaciones
                </h4>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-[9px] font-black uppercase text-slate-600">
                    <tr>
                      <th className="p-2 border">Asignatura</th>
                      <th className="p-2 border text-center">Promedio Actividades</th>
                      <th className="p-2 border text-center">Asistencia</th>
                      <th className="p-2 border text-center">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-slate-400 italic">Sin materias evaluadas en el ciclo activo</td>
                      </tr>
                    ) : (
                      academicHistory.map((c, i) => (
                        <tr key={i} className="border">
                          <td className="p-2 border font-bold">{c.materia}</td>
                          <td className="p-2 border text-center font-bold">{c.promedio.toFixed(1)}</td>
                          <td className="p-2 border text-center">{c.asistencia}%</td>
                          <td className="p-2 border text-center font-bold">{RISK_LABELS[c.risk]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bitácora de Intervenciones Recientes */}
              {interventions.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#003B5C] mb-2 pb-1 border-b border-slate-200">
                    Intervenciones de Tutoría Registradas ({interventions.length})
                  </h4>
                  <div className="space-y-2">
                    {interventions.slice(0, 3).map((intv, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div className="flex justify-between font-bold text-slate-700 mb-1">
                          <span>{intv.tipo_intervencion}</span>
                          <span className="text-[10px] text-slate-400">{new Date(intv.fecha).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 font-normal">{intv.description || intv.descripcion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Firmas de Autorización Oficial */}
              <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{assignedTutor ? assignedTutor.nombre : 'Tutor Académico'}</p>
                  <p className="text-[9px] uppercase font-black text-slate-400">Tutor Responsable</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">{student.name}</p>
                  <p className="text-[9px] uppercase font-black text-slate-400">Firma del Estudiante</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-900">Coordinación de Tutorías</p>
                  <p className="text-[9px] uppercase font-black text-slate-400">Sello y Firma FCQB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
