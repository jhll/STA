
import React, { useState, useEffect } from 'react';
import { Student, RiskLevel, UserRole, Grade } from '../types';
import { RISK_COLORS, RISK_LABELS, calculateRisk } from '../constants';
import { analyzeStudentRisk } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

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

const StudentProfile: React.FC<StudentProfileProps> = ({ student, role, userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'ai' | 'interventions' | 'attendance_history' | 'activities'>('info');
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [academicHistory, setAcademicHistory] = useState<AcademicRecord[]>([]);
  const [cycleTrajectoryRecords, setCycleTrajectoryRecords] = useState<any[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [totalInterventionsCount, setTotalInterventionsCount] = useState(0);
  const [detailedAttendance, setDetailedAttendance] = useState<{ fecha: string; presente: boolean; grupo: string }[]>([]);
  const [loadingDetailedAttendance, setLoadingDetailedAttendance] = useState(false);
  const [detailedActivities, setDetailedActivities] = useState<any[]>([]);
  const [loadingDetailedActivities, setLoadingDetailedActivities] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [editingGradeContent, setEditingGradeContent] = useState<Partial<Grade>>({});
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newIntervention, setNewIntervention] = useState({
    type: 'Asesoría Académica',
    description: '',
    additionalNotes: ''
  });

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const fetchRealAcademicHistory = async () => {
    setLoadingAcademic(true);
    try {
      // 1. Obtener conteo de intervenciones
      const { count: intCount } = await supabase
        .from('intervenciones')
        .select('*', { count: 'exact', head: true })
        .eq('estudiante_id', student.id);

      setTotalInterventionsCount(intCount || 0);

      // 2. Obtener calificaciones y materias
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

      const historyMap: Record<string, { totalGrade: number, count: number, grupo_id: string }> = {};

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

      // 3. Obtener trayectoria registrada por periodos de ciclo escolar
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

  const fetchInterventions = async () => {
    setLoadingInterventions(true);
    try {
      const { data, error } = await supabase
        .from('intervenciones')
        .select(`*, docentes(nombre)`)
        .eq('estudiante_id', student.id)
        .order('fecha', { ascending: false });
      if (error) throw error;
      setInterventions(data || []);
      setTotalInterventionsCount(data?.length || 0);
    } catch (err) {
      console.error("Error al cargar bitácora:", err);
    } finally {
      setLoadingInterventions(false);
    }
  };

  const fetchDetailedAttendance = async () => {
    if (role !== UserRole.DOCENTE || !userId) return;
    setLoadingDetailedAttendance(true);
    try {
      // 1. Obtener grupos del docente
      const { data: groups } = await supabase.from('grupos').select('id, nombre_grupo, materias(nombre)').eq('docente_id', userId);
      if (!groups || groups.length === 0) {
        setDetailedAttendance([]);
        return;
      }
      const groupIds = groups.map(g => g.id);
      const groupMap = groups.reduce((acc: any, g: any) => {
        acc[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
        return acc;
      }, {});

      // 2. Obtener asistencias de este estudiante en esos grupos
      const { data: attendanceData, error } = await supabase
        .from('asistencias')
        .select('*')
        .eq('estudiante_id', student.id)
        .in('grupo_id', groupIds)
        .order('fecha', { ascending: false });

      if (error) throw error;

      setDetailedAttendance((attendanceData || []).map(a => ({
        fecha: a.fecha,
        presente: a.presente,
        grupo: groupMap[a.grupo_id] || 'Grupo desconocido'
      })));

    } catch (err) {
      console.error("Error al obtener asistencia detallada:", err);
    } finally {
      setLoadingDetailedAttendance(false);
    }
  };

  const fetchDetailedActivities = async () => {
    if (role !== UserRole.DOCENTE || !userId) return;
    setLoadingDetailedActivities(true);
    try {
      const { data: groups } = await supabase.from('grupos').select('id, nombre_grupo, materias(nombre)').eq('docente_id', userId);
      if (!groups || groups.length === 0) {
        setDetailedActivities([]);
        return;
      }

      const { data: stAccData } = await supabase
        .from('estudiantes_acentuacion')
        .select(`
          acentuaciones (
            nombre
          )
        `)
        .eq('estudiante_id', student.id);

      const stAccNames = (stAccData || []).map((x: any) => {
        const acc = getRelation(x.acentuaciones);
        return acc ? `SUB - ${acc.nombre}` : null;
      }).filter(Boolean);

      const validGroupNames = [student.group, ...stAccNames];
      const filteredGroups = groups.filter(g => validGroupNames.includes(g.nombre_grupo));

      if (filteredGroups.length === 0) {
        setDetailedActivities([]);
        return;
      }

      const groupIds = filteredGroups.map(g => g.id);
      const groupMap = filteredGroups.reduce((acc: any, g: any) => {
        acc[g.id] = `${g.nombre_grupo} - ${Array.isArray(g.materias) ? g.materias[0]?.nombre : g.materias?.nombre}`;
        return acc;
      }, {});

      const { data: acts, error: actsError } = await supabase
        .from('actividades')
        .select('*')
        .in('grupo_id', groupIds)
        .order('fecha_entrega', { ascending: false });

      if (actsError) throw actsError;

      if (!acts || acts.length === 0) {
        setDetailedActivities([]);
        return;
      }

      const actIds = acts.map(a => a.id);

      const { data: grades, error: gradesError } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('estudiante_id', student.id)
        .in('actividad_id', actIds);

      if (gradesError) throw gradesError;

      const detailed = acts.map(act => {
        const grade = grades?.find(g => g.actividad_id === act.id) || null;
        return {
          actividad: act,
          grade: grade,
          grupo_nombre: groupMap[act.grupo_id] || 'Grupo desconocido'
        };
      });

      setDetailedActivities(detailed);
    } catch (err) {
      console.error("Error al obtener actividades:", err);
    } finally {
      setLoadingDetailedActivities(false);
    }
  };

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

      alert('Calificación guardada exitosamente.');
      setEditingGradeId(null);
      setEditingGradeContent({});
      fetchDetailedActivities();
    } catch (err: any) {
      alert("Error al guardar calificación: " + err.message);
    } finally {
      setIsSavingGrade(false);
    }
  };

  const fetchAiAnalysis = async () => {
    if (role === UserRole.DOCENTE) return;
    setLoadingAi(true);
    try {
      const result = await analyzeStudentRisk({
        nombre: student.name,
        promedio: student.average,
        asistencia: student.attendance,
        carrera: student.career,
        semestre: student.semester,
        factores: {
          personales: student.personalFactors,
          academicos: student.academicFactors,
          institucionales: student.institutionalFactors
        }
      });
      setAiAnalysis(result);
    } catch (err) {
      console.error("Gemini Error:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai' && !aiAnalysis) fetchAiAnalysis();
    if (activeTab === 'interventions') fetchInterventions();
    if (activeTab === 'academic') fetchRealAcademicHistory();
    if (activeTab === 'attendance_history') fetchDetailedAttendance();
    if (activeTab === 'activities') fetchDetailedActivities();
  }, [activeTab]);

  const handleSaveIntervention = async () => {
    if (!newIntervention.description) return alert("Por favor añada una descripción.");

    setIsSaving(true);
    try {
      const { error } = await supabase.from('intervenciones').insert([{
        estudiante_id: student.id,
        tipo_intervencion: newIntervention.type,
        descripcion: newIntervention.description,
        notas_adicionales: newIntervention.additionalNotes,
        ciclo_id: student.ciclo_id,
        estatus: 'COMPLETED'
      }]);

      if (error) throw error;

      alert("Registro guardado exitosamente.");
      setShowAddIntervention(false);
      setNewIntervention({ type: 'Asesoría Académica', description: '', additionalNotes: '' });
      fetchInterventions();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Asesoría Académica': return 'border-blue-500 text-blue-700 bg-blue-50';
      case 'Apoyo Psicológico': return 'border-purple-500 text-purple-700 bg-purple-50';
      case 'Seguimiento de Beca': return 'border-emerald-500 text-emerald-700 bg-emerald-50';
      case 'Vinculación Padres/Tutores': return 'border-amber-500 text-amber-700 bg-amber-50';
      default: return 'border-gray-500 text-gray-700 bg-gray-50';
    }
  };

  const canSeeAcademicHistory = role === UserRole.ADMIN || role === UserRole.TUTOR;
  const canSeeAiAgent = role === UserRole.ADMIN || role === UserRole.TUTOR;
  const canSeeAttendanceHistory = role === UserRole.DOCENTE;
  const canSeeActivities = role === UserRole.DOCENTE;

  const tabs = [
    { id: 'info', label: 'Integral', icon: '👤' },
    ...(canSeeAcademicHistory ? [{ id: 'academic', label: 'Historial', icon: '📚' }] : []),
    ...(canSeeAiAgent ? [{ id: 'ai', label: 'Agente IA', icon: '✨' }] : []),
    ...(canSeeAttendanceHistory ? [{ id: 'attendance_history', label: 'Asistencia', icon: '📅' }] : []),
    ...(canSeeActivities ? [{ id: 'activities', label: 'Actividades', icon: '📝' }] : []),
    { id: 'interventions', label: 'Bitácora', icon: '🛠️' },
  ];

  const approvedCount = academicHistory.filter(h => h.promedio >= 7.0).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col mt-10 sm:mt-0">
        <div className="p-6 sm:p-10 border-b border-gray-100 flex justify-between items-start sm:items-center bg-white sticky top-0 shrink-0">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-2xl shrink-0 ${student.risk === 'HIGH' ? 'bg-red-500' : student.risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}>
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tighter leading-tight break-words">{student.name}</h2>
              <p className="text-gray-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest mt-1">{student.career} • Semestre {student.semester}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex shrink-0 items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-xl sm:rounded-2xl text-gray-400 transition-all">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50/30 overflow-x-auto whitespace-nowrap hide-scrollbar shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 sm:px-10 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all border-b-4 flex items-center gap-2 sm:gap-3 shrink-0 ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
            >
              <span className="text-base sm:text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white">
          {activeTab === 'info' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-8 rounded-[2rem] border-2 ${RISK_COLORS[student.risk as RiskLevel]} shadow-xl`}>
                  <p className="text-[10px] uppercase font-black opacity-60 tracking-widest mb-2">Semáforo Integral</p>
                  <p className="text-2xl font-black">{RISK_LABELS[student.risk as RiskLevel]}</p>
                </div>
                <div className="p-8 rounded-[2rem] bg-blue-50 border border-blue-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-blue-800 opacity-60 tracking-widest mb-2">Promedio Gral</p>
                  <p className="text-2xl font-black text-blue-900">{student.average.toFixed(1)}</p>
                </div>
                <div className="p-8 rounded-[2rem] bg-indigo-50 border border-indigo-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-indigo-800 opacity-60 tracking-widest mb-2">Asistencia</p>
                  <p className="text-2xl font-black text-indigo-900">{student.attendance}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Personales
                  </h4>
                  <ul className="space-y-3">
                    {student.personalFactors.length > 0 ? student.personalFactors.map((f, i) => (
                      <li key={i} className="text-xs font-bold text-gray-600 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic opacity-50">Sin observaciones</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Académicos
                  </h4>
                  <ul className="space-y-3">
                    {student.academicFactors.length > 0 ? student.academicFactors.map((f, i) => (
                      <li key={i} className="text-xs font-bold text-gray-600 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic opacity-50">Sin observaciones</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Institucionales
                  </h4>
                  <ul className="space-y-3">
                    {student.institutionalFactors.length > 0 ? student.institutionalFactors.map((f, i) => (
                      <li key={i} className="text-xs font-bold text-gray-600 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic opacity-50">Sin observaciones</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && canSeeAiAgent && (
            <div className="space-y-8 animate-in zoom-in-95 duration-500">
              {loadingAi ? (
                <div className="flex flex-col items-center justify-center py-32 gap-8">
                  <div className="relative">
                    <div className="w-24 h-24 border-8 border-blue-50 border-t-[#003B5C] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-3xl">🍌</div>
                  </div>
                  <div className="text-center">
                    <p className="text-[#003B5C] font-black text-xs uppercase tracking-[0.3em] mb-2">Agente Inteligente Nano Banana</p>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">Sincronizando trayectoria académica...</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-10">
                  <div className={`p-10 rounded-[3rem] border-4 relative overflow-hidden shadow-2xl ${aiAnalysis.riskLevel === 'HIGH' ? 'border-red-100 bg-red-50/30' :
                    aiAnalysis.riskLevel === 'MEDIUM' ? 'border-amber-100 bg-amber-50/30' : 'border-emerald-100 bg-emerald-50/30'
                    }`}>
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-4xl">✨</span>
                      <h3 className="text-2xl font-black text-[#003B5C] tracking-tighter">Diagnóstico de Trayectoria</h3>
                    </div>
                    <p className="text-xl font-medium leading-relaxed italic text-gray-800 opacity-90 border-l-8 border-[#003B5C]/20 pl-8">
                      "{aiAnalysis.explanation}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl relative">
                      <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg">📋</div>
                      <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-8 ml-8">Hoja de Ruta Recomendada</h4>
                      <ul className="space-y-5">
                        {aiAnalysis.recommendedInterventions.map((item: string, idx: number) => (
                          <li key={idx} className="flex gap-5 group">
                            <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gray-50 text-gray-900 flex items-center justify-center text-xs font-black group-hover:bg-[#003B5C] group-hover:text-white transition-all shadow-sm">{idx + 1}</span>
                            <p className="text-gray-600 text-sm font-bold leading-snug self-center">{item}</p>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-[#003B5C] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-20 text-6xl">🛡️</div>
                      <div className="relative z-10">
                        <h4 className="font-black text-[10px] uppercase tracking-[0.3em] mb-6 opacity-70">Acción del Tutor</h4>
                        <p className="mb-10 text-blue-100 text-lg font-medium leading-relaxed">Este diagnóstico sugiere una intervención inmediata para mitigar factores críticos detectados por el agente.</p>
                        <button
                          onClick={() => setActiveTab('interventions')}
                          className="w-full bg-[#FFD100] text-[#003B5C] font-black text-xs uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-white hover:scale-105 transition-all shadow-2xl active:scale-95"
                        >
                          Ejecutar Intervención
                        </button>
                        <button onClick={fetchAiAnalysis} className="w-full mt-4 text-[9px] font-black uppercase tracking-widest text-blue-300 hover:text-white transition-colors">
                          🔄 Recalcular Diagnóstico
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-32 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                  <span className="text-6xl mb-6 block">🚫</span>
                  <p className="text-gray-400 font-black uppercase text-xs tracking-widest">No se pudo procesar el análisis inteligente.</p>
                  <button onClick={fetchAiAnalysis} className="mt-8 bg-[#003B5C] text-white px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-blue-800 transition-all">Intentar de nuevo</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'academic' && canSeeAcademicHistory && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#003B5C] p-10 rounded-[3rem] text-white shadow-2xl mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl">🎓</div>
                <h4 className="font-black text-xs uppercase tracking-[0.3em] opacity-80 mb-6">Métricas de Trayectoria Real</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <span className="text-[9px] font-black block uppercase opacity-50 tracking-widest mb-1">Cursos Totales</span>
                    <span className="text-4xl font-black">{academicHistory.length}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black block uppercase opacity-50 tracking-widest mb-1">Ciclo Promedio</span>
                    <span className="text-4xl font-black">
                      {academicHistory.length > 0
                        ? (academicHistory.reduce((acc, curr) => acc + curr.promedio, 0) / academicHistory.length).toFixed(1)
                        : '0.0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black block uppercase opacity-50 tracking-widest mb-1">Intervenciones</span>
                    <span className="text-4xl font-black text-[#FFD100]">{totalInterventionsCount}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black block uppercase opacity-50 tracking-widest mb-1">Estatus</span>
                    <span className="text-xl font-black uppercase tracking-tighter truncate">
                      {approvedCount === academicHistory.length ? 'Regular' : 'Con Adeudos'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-[3rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                      <tr>
                        <th className="px-6 sm:px-10 py-6">Asignatura</th>
                        <th className="px-6 sm:px-10 py-6 text-center">Promedio Actividades</th>
                        <th className="px-6 sm:px-10 py-6 text-center">Promedio Asistencias</th>
                        <th className="px-6 sm:px-10 py-6 text-right">Estatus Riesgo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingAcademic ? (
                        <tr><td colSpan={4} className="py-20 text-center animate-pulse font-black text-gray-300 uppercase text-[10px]">Consultando historial oficial...</td></tr>
                      ) : academicHistory.length === 0 ? (
                        <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin actividades evaluadas en el sistema</td></tr>
                      ) : academicHistory.map((course, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 sm:px-10 py-6 font-bold text-gray-800 text-sm whitespace-nowrap">{course.materia}</td>
                          <td className="px-6 sm:px-10 py-6 font-black text-gray-900 text-center text-lg">{course.promedio}</td>
                          <td className="px-6 sm:px-10 py-6 text-gray-500 text-center font-bold">{course.asistencia}%</td>
                          <td className="px-6 sm:px-10 py-6 text-right">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${RISK_COLORS[course.risk]}`}>
                              {RISK_LABELS[course.risk]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECCIÓN DE TRAYECTORIA POR PERIODO DEL CICLO ESCOLAR */}
              <div className="bg-white border border-gray-100 rounded-[3rem] p-8 overflow-hidden shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">📅</span>
                  <div>
                    <h4 className="font-black text-[#003B5C] text-sm uppercase tracking-wider">Trayectoria por Periodo del Ciclo Escolar</h4>
                    <p className="text-[10px] text-gray-400 font-bold">Historial de asignación de grupo, semestre y desempeño por periodo</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#003B5C]/5 text-[9px] font-black uppercase text-[#003B5C] border-b tracking-widest">
                      <tr>
                        <th className="p-4">Periodo / Ciclo</th>
                        <th className="p-4">Grupo Asignado</th>
                        <th className="p-4 text-center">Semestre</th>
                        <th className="p-4 text-center">Asistencia</th>
                        <th className="p-4 text-right">Riesgo Periodo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                      {cycleTrajectoryRecords.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-gray-400 font-bold uppercase text-[10px]">
                            Sin registros históricos en periodos anteriores
                          </td>
                        </tr>
                      ) : (
                        cycleTrajectoryRecords.map((item, i) => {
                          const cycleName = getRelation(item.ciclos_escolares)?.nombre || 'Periodo Escolar';
                          return (
                            <tr key={i} className="hover:bg-blue-50/20">
                              <td className="p-4 font-bold text-gray-900">{cycleName}</td>
                              <td className="p-4 text-gray-700 font-semibold">{item.grupo} ({item.carrera})</td>
                              <td className="p-4 text-center font-bold text-gray-800">{item.semestre}° Semestre</td>
                              <td className="p-4 text-center font-bold text-blue-700">{item.porcentaje_asistencia || 100}%</td>
                              <td className="p-4 text-right">
                                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${RISK_COLORS[item.nivel_riesgo as RiskLevel]}`}>
                                  {RISK_LABELS[item.nivel_riesgo as RiskLevel]}
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

          {activeTab === 'interventions' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-gray-50 p-10 rounded-[3rem] border border-gray-100 shadow-inner gap-6">
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tighter">Bitácora</h3>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Intervenciones UAS • FCQB</p>
                </div>
                {!showAddIntervention && (
                  <button
                    onClick={() => setShowAddIntervention(true)}
                    className="bg-[#003B5C] text-white px-10 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
                  >
                    + Nuevo Registro
                  </button>
                )}
              </div>

              {showAddIntervention ? (
                <div className="bg-white p-10 rounded-[3rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-500">
                  <h4 className="font-black text-xl text-gray-900 tracking-tight mb-8">Registrar Acción Preventiva</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Eje Temático</label>
                      <select
                        className="w-full bg-gray-50 border border-gray-200 p-5 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        value={newIntervention.type}
                        onChange={(e) => setNewIntervention({ ...newIntervention, type: e.target.value })}
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
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Minuta de Acuerdos</label>
                      <textarea
                        className="w-full bg-gray-50 border border-gray-200 p-5 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 h-40 resize-none"
                        placeholder="Describa la situación y compromisos adquiridos..."
                        value={newIntervention.description}
                        onChange={(e) => setNewIntervention({ ...newIntervention, description: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-4 pt-6">
                      <button onClick={() => setShowAddIntervention(false)} className="px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar</button>
                      <button onClick={handleSaveIntervention} disabled={isSaving} className="bg-[#003B5C] text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl disabled:opacity-50">
                        {isSaving ? 'Guardando...' : 'Formalizar Registro'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {loadingInterventions ? (
                    <p className="text-center py-20 animate-pulse text-[10px] font-black uppercase text-gray-400">Accediendo a servidores UAS...</p>
                  ) : interventions.length === 0 ? (
                    <div className="text-center py-32 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Sin intervenciones previas documentadas.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-8">
                      {interventions.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-100 rounded-[2.5rem] p-10 shadow-sm hover:shadow-2xl transition-all border-l-8 border-l-[#003B5C]">
                          <div className="flex justify-between items-start mb-8">
                            <span className={`text-[9px] font-black uppercase px-6 py-2 rounded-full tracking-widest border ${getTypeColor(item.tipo_intervencion)}`}>
                              {item.tipo_intervencion}
                            </span>
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-xl">
                              📅 {new Date(item.fecha).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-800 font-bold text-lg leading-relaxed mb-8">{item.description || item.descripcion}</p>
                          <div className="flex items-center justify-between pt-8 border-t border-gray-50">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-[#003B5C] flex items-center justify-center text-[10px] text-white font-black">UAS</div>
                              <p className="text-[11px] text-gray-900 font-black uppercase tracking-tighter">{item.docentes?.nombre || 'Docente Responsable'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance_history' && canSeeAttendanceHistory && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 rounded-[3rem] overflow-hidden shadow-sm">
                <div className="p-6 sm:p-8 border-b bg-gray-50/50">
                  <h3 className="text-lg sm:text-xl font-black text-[#003B5C]">Historial de Asistencia</h3>
                  <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle por fecha en sus asignaturas</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                      <tr>
                        <th className="px-6 sm:px-10 py-4 sm:py-5">Fecha</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5">Asignatura / Grupo</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5 text-right">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingDetailedAttendance ? (
                        <tr><td colSpan={3} className="py-20 text-center animate-pulse font-black text-gray-300 uppercase text-[10px]">Cargando registros...</td></tr>
                      ) : detailedAttendance.length === 0 ? (
                        <tr><td colSpan={3} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No hay registros de asistencia</td></tr>
                      ) : detailedAttendance.map((record, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 sm:px-10 py-4 sm:py-5 font-bold text-gray-800 text-xs sm:text-sm whitespace-nowrap">{new Date(record.fecha + 'T12:00:00').toLocaleDateString()}</td>
                          <td className="px-6 sm:px-10 py-4 sm:py-5 font-bold text-gray-600 text-[10px] sm:text-xs uppercase">{record.grupo}</td>
                          <td className="px-6 sm:px-10 py-4 sm:py-5 text-right">
                            <span className={`px-3 sm:px-4 py-1.5 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm ${record.presente ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                              {record.presente ? 'PRESENTE' : 'FALTA'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activities' && canSeeActivities && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 rounded-[3rem] overflow-hidden shadow-sm">
                <div className="p-6 sm:p-8 border-b bg-gray-50/50">
                  <h3 className="text-lg sm:text-xl font-black text-[#003B5C]">Tareas, Ejercicios y Exámenes</h3>
                  <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Listado de actividades y sus calificaciones asignadas</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                      <tr>
                        <th className="px-6 sm:px-10 py-4 sm:py-5">Actividad</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5">Asignatura / Grupo</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5 text-center">Entregado</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5 text-center">Calificación</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5">Comentarios</th>
                        <th className="px-6 sm:px-10 py-4 sm:py-5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingDetailedActivities ? (
                        <tr><td colSpan={6} className="py-20 text-center animate-pulse font-black text-gray-300 uppercase text-[10px]">Cargando actividades...</td></tr>
                      ) : detailedActivities.length === 0 ? (
                        <tr><td colSpan={6} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No hay actividades registradas</td></tr>
                      ) : detailedActivities.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 sm:px-10 py-4 sm:py-5">
                            <div className="font-bold text-gray-800 text-sm">{item.actividad.titulo}</div>
                            <div className="text-[8px] sm:text-[9px] font-black uppercase text-gray-400 tracking-widest whitespace-nowrap">{item.actividad.tipo} - máx {item.actividad.puntos_max} pts</div>
                          </td>
                          <td className="px-6 sm:px-10 py-4 sm:py-5 font-bold text-gray-600 text-[9px] sm:text-[10px] uppercase max-w-[150px] truncate">{item.grupo_nombre}</td>
                          {editingGradeId === item.actividad.id ? (
                            <>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-center">
                                <input type="checkbox" className="w-4 h-4 text-blue-600"
                                  checked={editingGradeContent.entregado !== undefined ? editingGradeContent.entregado : (item.grade?.entregado || false)}
                                  onChange={(e) => setEditingGradeContent({ ...editingGradeContent, entregado: e.target.checked })}
                                />
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-center">
                                <input type="number" step="0.1" min="0" max={item.actividad.puntos_max} className="w-16 p-2 rounded border text-sm text-center font-bold"
                                  value={editingGradeContent.calificacion !== undefined ? editingGradeContent.calificacion : (item.grade?.calificacion || 0)}
                                  onChange={(e) => setEditingGradeContent({ ...editingGradeContent, calificacion: Number(e.target.value) })}
                                />
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5">
                                <input type="text" className="w-full p-2 rounded border text-sm min-w-[150px]" placeholder="Opcional..."
                                  value={editingGradeContent.comentarios !== undefined ? editingGradeContent.comentarios : (item.grade?.comentarios || '')}
                                  onChange={(e) => setEditingGradeContent({ ...editingGradeContent, comentarios: e.target.value })}
                                />
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-right flex gap-2 justify-end items-center h-full">
                                <button onClick={() => setEditingGradeId(null)} className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-gray-200">Cancelar</button>
                                <button onClick={() => handleSaveGrade(item.actividad.id, item.grade)} disabled={isSavingGrade} className="px-3 py-1 bg-[#003B5C] text-white rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:bg-blue-800 disabled:opacity-50">Guardar</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-center">
                                {item.grade?.entregado ? <span className="text-emerald-500 font-black">Sí</span> : <span className="text-red-500 font-black">-</span>}
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 font-black text-gray-900 text-center text-lg">
                                {item.grade ? item.grade.calificacion : '-'}
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-xs text-gray-500 italic max-w-[150px] truncate">
                                {item.grade?.comentarios || ''}
                              </td>
                              <td className="px-6 sm:px-10 py-4 sm:py-5 text-right">
                                <button
                                  onClick={() => setEditingGradeId(item.actividad.id)}
                                  className="px-4 py-1.5 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm"
                                >
                                  Editar
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
