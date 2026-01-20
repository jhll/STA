
import React, { useState, useEffect } from 'react';
import { Student, RiskLevel, UserRole } from '../types';
import { RISK_COLORS, RISK_LABELS } from '../constants';
import { analyzeStudentRisk } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface StudentProfileProps {
  student: Student;
  role: UserRole;
  onClose: () => void;
}

interface AcademicRecord {
  materia: string;
  promedio: number;
  asistencia: number;
  estatus: 'Aprobado' | 'En Riesgo' | 'Pendiente';
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, role, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'ai' | 'interventions'>('info');
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [academicHistory, setAcademicHistory] = useState<AcademicRecord[]>([]);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  
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
      // 1. Obtener todas las calificaciones del alumno con info de materia
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

      // 2. Obtener asistencias por grupo
      const { data: attendanceData, error: attError } = await supabase
        .from('asistencias')
        .select('grupo_id, presente')
        .eq('estudiante_id', student.id);

      if (attError) throw attError;

      // 3. Procesar y agrupar por materia
      const historyMap: Record<string, { totalGrade: number, count: number, grupo_id: string }> = {};
      
      gradesData?.forEach(g => {
        const activity = getRelation(g.actividades);
        const grupo = getRelation(activity?.grupos);
        const materia = getRelation(grupo?.materias);
        const materiaNombre = materia?.nombre || 'Materia Desconocida';

        if (!historyMap[materiaNombre]) {
          historyMap[materiaNombre] = { totalGrade: 0, count: 0, grupo_id: grupo?.id };
        }
        
        // Normalizar calificación a base 10 si puntos_max es diferente
        const normalizedGrade = (g.calificacion / (activity?.puntos_max || 10)) * 10;
        historyMap[materiaNombre].totalGrade += normalizedGrade;
        historyMap[materiaNombre].count += 1;
      });

      const processedHistory: AcademicRecord[] = Object.keys(historyMap).map(materiaName => {
        const info = historyMap[materiaName];
        const avg = info.totalGrade / info.count;
        
        // Calcular asistencia específica para este grupo/materia
        const relevantAtt = attendanceData?.filter(a => a.grupo_id === info.grupo_id) || [];
        const attPerc = relevantAtt.length > 0 
          ? (relevantAtt.filter(a => a.presente).length / relevantAtt.length) * 100 
          : 100;

        return {
          materia: materiaName,
          promedio: Number(avg.toFixed(1)),
          asistencia: Math.round(attPerc),
          estatus: (avg >= 7.0 && attPerc >= 80) ? 'Aprobado' : 'En Riesgo'
        };
      });

      setAcademicHistory(processedHistory);
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
    } catch (err) {
      console.error("Error al cargar bitácora:", err);
    } finally {
      setLoadingInterventions(false);
    }
  };

  const fetchAiAnalysis = async () => {
    setLoadingAi(true);
    const result = await analyzeStudentRisk(student);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  useEffect(() => {
    if (activeTab === 'ai' && !aiAnalysis) fetchAiAnalysis();
    if (activeTab === 'interventions') fetchInterventions();
    if (activeTab === 'academic') fetchRealAcademicHistory();
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

  const getInterventionIcon = (type: string) => {
    switch(type) {
      case 'Asesoría Académica': return '📚';
      case 'Apoyo Psicológico': return '🧠';
      case 'Seguimiento de Beca': return '💰';
      case 'Vinculación Padres/Tutores': return '👨‍👩‍👧';
      case 'Canalización Médica': return '🏥';
      default: return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'Asesoría Académica': return 'border-blue-500 text-blue-700 bg-blue-50';
      case 'Apoyo Psicológico': return 'border-purple-500 text-purple-700 bg-purple-50';
      case 'Seguimiento de Beca': return 'border-emerald-500 text-emerald-700 bg-emerald-50';
      case 'Vinculación Padres/Tutores': return 'border-amber-500 text-amber-700 bg-amber-50';
      default: return 'border-gray-500 text-gray-700 bg-gray-50';
    }
  };

  const canSeeAcademicHistory = role === UserRole.ADMIN || role === UserRole.TUTOR;

  const tabs = [
    { id: 'info', label: 'Integral', icon: '👤' },
    ...(canSeeAcademicHistory ? [{ id: 'academic', label: 'Historial', icon: '📚' }] : []),
    { id: 'ai', label: 'Análisis IA', icon: '✨' },
    { id: 'interventions', label: 'Bitácora', icon: '🛠️' },
  ];

  const approvedCount = academicHistory.filter(h => h.promedio >= 7.0).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg ${
              student.risk === 'HIGH' ? 'bg-red-500' : student.risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}>
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{student.name}</h2>
              <p className="text-gray-500 font-medium uppercase text-[10px] tracking-widest">{student.career} • Semestre {student.semester}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {activeTab === 'info' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl border ${RISK_COLORS[student.risk as RiskLevel]} shadow-sm`}>
                  <p className="text-[10px] uppercase font-black opacity-60 tracking-widest mb-1">Estatus Riesgo</p>
                  <p className="text-lg font-black">{RISK_LABELS[student.risk as RiskLevel]}</p>
                </div>
                <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-blue-800 opacity-60 tracking-widest mb-1">Promedio Gral</p>
                  <p className="text-lg font-black text-blue-900">{student.average.toFixed(1)} / 10.0</p>
                </div>
                <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-indigo-800 opacity-60 tracking-widest mb-1">Asistencia</p>
                  <p className="text-lg font-black text-indigo-900">{student.attendance}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Personales
                  </h4>
                  <ul className="space-y-2">
                    {student.personalFactors.length > 0 ? student.personalFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">Sin observaciones</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Académicos
                  </h4>
                  <ul className="space-y-2">
                    {student.academicFactors.length > 0 ? student.academicFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">Sin observaciones</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Institucionales
                  </h4>
                  <ul className="space-y-2">
                    {student.institutionalFactors.length > 0 ? student.institutionalFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">Sin observaciones</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && canSeeAcademicHistory && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg mb-4">
                 <h4 className="font-black text-xs uppercase tracking-widest opacity-80 mb-2">Resumen de Trayectoria Real</h4>
                 <div className="flex gap-10">
                    <div>
                       <span className="text-[10px] font-bold block uppercase opacity-70">Asignaturas Cursadas</span>
                       <span className="text-xl font-black">{academicHistory.length}</span>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold block uppercase opacity-70">Regularidad</span>
                       <span className="text-xl font-black">
                         {approvedCount === academicHistory.length ? 'Regular' : 'Con Adeudos'}
                       </span>
                    </div>
                    <div>
                       <span className="text-[10px] font-bold block uppercase opacity-70">Promedio de Ciclo</span>
                       <span className="text-xl font-black">
                         {academicHistory.length > 0 
                            ? (academicHistory.reduce((a,b) => a + b.promedio, 0) / academicHistory.length).toFixed(1) 
                            : '0.0'}
                       </span>
                    </div>
                 </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Asignatura</th>
                      <th className="px-8 py-5 text-center">Promedio Actividades</th>
                      <th className="px-8 py-5 text-center">Asistencia Real</th>
                      <th className="px-8 py-5 text-right">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingAcademic ? (
                      <tr><td colSpan={4} className="py-20 text-center animate-pulse font-black text-gray-300 uppercase text-[10px]">Calculando historial real...</td></tr>
                    ) : academicHistory.length === 0 ? (
                      <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin actividades evaluadas en este ciclo</td></tr>
                    ) : academicHistory.map((course, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 font-bold text-gray-800 text-sm">{course.materia}</td>
                        <td className="px-8 py-5 font-black text-gray-900 text-center">{course.promedio}</td>
                        <td className="px-8 py-5 text-gray-500 text-center font-bold">{course.asistencia}%</td>
                        <td className="px-8 py-5 text-right">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            course.eststatus === 'En Riesgo' || course.promedio < 7.0 || course.asistencia < 80 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {course.promedio < 7.0 || course.asistencia < 80 ? 'En Riesgo' : 'Aprobado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
              {loadingAi ? (
                <div className="flex flex-col items-center justify-center py-20 gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xl">✨</div>
                  </div>
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Nano Banana procesando datos...</p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-8">
                  <div className={`p-8 rounded-3xl border-2 ${
                    aiAnalysis.riskLevel === 'HIGH' ? 'border-red-100 bg-red-50/50' : 
                    aiAnalysis.riskLevel === 'MEDIUM' ? 'border-amber-100 bg-amber-50/50' : 'border-emerald-100 bg-emerald-50/50'
                  }`}>
                    <h3 className="text-lg font-black tracking-tight mb-4 flex items-center gap-2">✨ Diagnóstico Inteligente</h3>
                    <p className="text-lg font-medium leading-relaxed italic opacity-90">"{aiAnalysis.explanation}"</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                      <h4 className="font-black text-gray-900 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                        📋 Hoja de Ruta Recomendada
                      </h4>
                      <ul className="space-y-4">
                        {aiAnalysis.recommendedInterventions.map((item: string, idx: number) => (
                          <li key={idx} className="flex gap-4 group">
                            <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-100 text-gray-900 flex items-center justify-center text-xs font-black group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">{idx + 1}</span>
                            <p className="text-gray-600 text-sm font-medium leading-snug">{item}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-[#003B5C] p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <h4 className="font-black text-[10px] uppercase tracking-widest mb-4 opacity-70">Acción Estratégica</h4>
                        <p className="mb-8 text-blue-100 font-medium leading-relaxed">Se sugiere formalizar una intervención para documentar el progreso de las sugerencias de la IA.</p>
                        <button 
                          onClick={() => setActiveTab('interventions')}
                          className="w-full bg-[#FFD100] text-[#003B5C] font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-white transition-all shadow-xl"
                        >
                          Registrar Intervención
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">No se pudo generar el análisis predictivo.</p>
                  <button onClick={fetchAiAnalysis} className="mt-4 bg-white px-6 py-2 rounded-xl text-xs font-black uppercase text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50">Reintentar</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'interventions' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-gray-50 p-8 rounded-[2rem] border border-gray-100 shadow-inner">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Bitácora de Seguimiento</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Acciones preventivas y correctivas</p>
                </div>
                {!showAddIntervention && (
                  <button 
                    onClick={() => setShowAddIntervention(true)}
                    className="bg-[#003B5C] text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
                  >
                    + Nuevo Registro
                  </button>
                )}
              </div>

              {showAddIntervention ? (
                <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-500">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-xl text-gray-900 tracking-tight">Registro de Intervención</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Eje de Intervención</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 transition-all"
                        value={newIntervention.type}
                        onChange={(e) => setNewIntervention({...newIntervention, type: e.target.value})}
                      >
                        <option>Asesoría Académica</option>
                        <option>Apoyo Psicológico</option>
                        <option>Seguimiento de Beca</option>
                        <option>Vinculación Padres/Tutores</option>
                        <option>Canalización Médica</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Descripción y Acuerdos</label>
                      <textarea 
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:border-blue-500 h-32 resize-none"
                        placeholder="Describa los puntos clave discutidos..."
                        value={newIntervention.description}
                        onChange={(e) => setNewIntervention({...newIntervention, description: e.target.value})}
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                      <button onClick={() => setShowAddIntervention(false)} className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">Cancelar</button>
                      <button onClick={handleSaveIntervention} disabled={isSaving} className="bg-[#003B5C] text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50">
                        {isSaving ? 'Guardando...' : 'Guardar Bitácora'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100">
                  {loadingInterventions ? (
                    <p className="text-center py-10 animate-pulse text-[10px] font-black uppercase text-gray-400">Consultando historial...</p>
                  ) : interventions.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Sin registros de intervención.</p>
                    </div>
                  ) : interventions.map((item, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all relative ml-16">
                      <div className="absolute -left-[3.25rem] top-10 w-4 h-4 rounded-full border-4 border-white bg-blue-600 shadow-md"></div>
                      
                      <div className="flex justify-between items-start mb-6">
                        <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest border ${getTypeColor(item.tipo_intervencion)}`}>
                          {item.tipo_intervencion}
                        </span>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
                          📅 {new Date(item.fecha).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-gray-800 font-bold text-sm leading-relaxed mb-6">{item.descripcion}</p>
                      
                      <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[9px] text-white font-black">UAS</div>
                          <p className="text-[10px] text-gray-900 font-black">{item.docentes?.nombre || 'Docente Tutor'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
