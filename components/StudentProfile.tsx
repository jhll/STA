
import React, { useState, useEffect } from 'react';
import { Student, RiskLevel, Intervention, UserRole } from '../types';
import { RISK_COLORS, RISK_LABELS } from '../constants';
import { analyzeStudentRisk } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface StudentProfileProps {
  student: Student;
  role: UserRole;
  onClose: () => void;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ student, role, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'academic' | 'ai' | 'interventions'>('info');
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newIntervention, setNewIntervention] = useState({
    type: 'Asesoría Académica',
    description: '',
    additionalNotes: ''
  });

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
    if (activeTab === 'ai' && !aiAnalysis) {
      fetchAiAnalysis();
    }
    if (activeTab === 'interventions') {
      fetchInterventions();
    }
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

  const tabs = [
    { id: 'info', label: 'Integral', icon: '👤' },
    // Ocultar historial académico para docentes
    ...(role === UserRole.ADMIN ? [{ id: 'academic', label: 'Académico', icon: '📚' }] : []),
    { id: 'ai', label: 'Análisis IA', icon: '✨' },
    { id: 'interventions', label: 'Bitácora', icon: '🛠️' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg ${
              student.risk === 'HIGH' ? 'bg-red-500' : student.risk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}>
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{student.name}</h2>
              <p className="text-gray-500 font-medium">{student.career} • Semestre {student.semester}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {activeTab === 'info' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl border ${RISK_COLORS[student.risk as RiskLevel]} shadow-sm`}>
                  <p className="text-[10px] uppercase font-black opacity-60 tracking-widest mb-1">Estatus Riesgo</p>
                  <p className="text-lg font-black">{RISK_LABELS[student.risk as RiskLevel]}</p>
                </div>
                <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-blue-800 opacity-60 tracking-widest mb-1">Puntaje Académico</p>
                  <p className="text-lg font-black text-blue-900">{student.average.toFixed(1)} / 10.0</p>
                </div>
                <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm">
                  <p className="text-[10px] uppercase font-black text-indigo-800 opacity-60 tracking-widest mb-1">Nivel Asistencia</p>
                  <p className="text-lg font-black text-indigo-900">{student.attendance}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Personales
                  </h4>
                  <ul className="space-y-2">
                    {student.personalFactors.length > 0 ? student.personalFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">No hay factores registrados</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Académicos
                  </h4>
                  <ul className="space-y-2">
                    {student.academicFactors.length > 0 ? student.academicFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">No hay factores registrados</li>}
                  </ul>
                </div>
                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                  <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Institucionales
                  </h4>
                  <ul className="space-y-2">
                    {student.institutionalFactors.length > 0 ? student.institutionalFactors.map((f, i) => (
                      <li key={i} className="text-sm font-medium text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">{f}</li>
                    )) : <li className="text-xs text-gray-400 italic">No hay factores registrados</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academic' && role === UserRole.ADMIN && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Asignatura</th>
                      <th className="px-8 py-5">Calificación</th>
                      <th className="px-8 py-5">Inasistencias</th>
                      <th className="px-8 py-5">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { name: 'Química Orgánica II', grade: 8.5, absences: 2, status: 'Aprobado' },
                      { name: 'Bioquímica I', grade: 9.0, absences: 0, status: 'Aprobado' },
                      { name: 'Cálculo Multivariado', grade: 6.5, absences: 5, status: 'En Riesgo' },
                    ].map((course, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 font-bold text-gray-800">{course.name}</td>
                        <td className="px-8 py-5 font-black text-gray-900">{course.grade}</td>
                        <td className="px-8 py-5 text-gray-500">{course.absences}</td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            course.status === 'En Riesgo' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {course.status}
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
                  <div className="text-center">
                    <p className="text-gray-900 font-black uppercase tracking-[0.2em] text-xs">Análisis Inteligente en Proceso</p>
                    <p className="text-gray-400 text-xs font-medium mt-1">Evaluando variables de trayectoria académica...</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-8">
                  <div className={`p-8 rounded-3xl border-2 ${
                    aiAnalysis.riskLevel === 'HIGH' ? 'border-red-100 bg-red-50/50 text-red-900' : 
                    aiAnalysis.riskLevel === 'MEDIUM' ? 'border-amber-100 bg-amber-50/50 text-amber-900' : 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">✨</span>
                      <h3 className="text-lg font-black tracking-tight">Dictamen Predictivo de IA</h3>
                    </div>
                    <p className="text-lg font-medium leading-relaxed italic opacity-90">"{aiAnalysis.explanation}"</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
                      <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
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
                    <div className="bg-gray-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <h4 className="font-black text-xs uppercase tracking-widest mb-4 opacity-70">Acción Estratégica</h4>
                        <p className="mb-8 text-gray-300 font-medium leading-relaxed">Tras el análisis, se recomienda formalizar una intervención inmediata para mitigar los factores de riesgo detectados.</p>
                        <button 
                          onClick={() => setActiveTab('interventions')}
                          className="w-full bg-blue-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-blue-500 transition-all shadow-xl active:scale-95"
                        >
                          Iniciar Plan de Apoyo
                        </button>
                      </div>
                      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl group-hover:scale-125 transition-transform"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium">No se pudo generar el análisis predictivo.</p>
                  <button onClick={fetchAiAnalysis} className="mt-4 bg-white px-6 py-2 rounded-xl text-xs font-black uppercase text-blue-600 border border-blue-100 shadow-sm hover:bg-blue-50">Intentar de Nuevo</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'interventions' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-gray-50 p-8 rounded-[2rem] border border-gray-100 shadow-inner">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tighter">Bitácora de Seguimiento</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Historial clínico y académico del alumno</p>
                </div>
                {!showAddIntervention && (
                  <button 
                    onClick={() => setShowAddIntervention(true)}
                    className="bg-[#003B5C] text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95"
                  >
                    + Nueva Intervención
                  </button>
                )}
              </div>

              {showAddIntervention ? (
                <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-500">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-xl text-gray-900 tracking-tight">Registro de Nueva Acción</h4>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Formulario Oficial</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-blue-600 transition-colors">Eje de Intervención</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        value={newIntervention.type}
                        onChange={(e) => setNewIntervention({...newIntervention, type: e.target.value})}
                      >
                        <option>Asesoría Académica</option>
                        <option>Apoyo Psicológico</option>
                        <option>Seguimiento de Beca</option>
                        <option>Vinculación Padres/Tutores</option>
                        <option>Canalización Médica</option>
                        <option>Otro</option>
                      </select>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-blue-600 transition-colors">Descripción del Suceso/Acuerdos</label>
                      <textarea 
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all h-32 resize-none"
                        placeholder="Escriba los puntos clave discutidos y las acciones acordadas..."
                        value={newIntervention.description}
                        onChange={(e) => setNewIntervention({...newIntervention, description: e.target.value})}
                      />
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-blue-600 transition-colors">Observaciones Confidenciales / Notas Técnicas</label>
                      <textarea 
                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all h-24 resize-none"
                        placeholder="Información adicional relevante para el seguimiento..."
                        value={newIntervention.additionalNotes}
                        onChange={(e) => setNewIntervention({...newIntervention, additionalNotes: e.target.value})}
                      />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                      <button 
                        onClick={() => setShowAddIntervention(false)}
                        className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveIntervention}
                        disabled={isSaving}
                        className="bg-gray-900 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                      >
                        {isSaving ? 'Guardando Registro...' : 'Guardar en Bitácora'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-gray-100">
                  {loadingInterventions ? (
                    <div className="text-center py-10 animate-pulse text-[10px] font-black uppercase tracking-widest text-gray-400">Accediendo al servidor...</div>
                  ) : interventions.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
                      <span className="text-4xl block mb-4">📂</span>
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Sin registros en este ciclo escolar.</p>
                    </div>
                  ) : interventions.map((item, idx) => {
                    const typeColorClass = getTypeColor(item.tipo_intervencion);
                    return (
                      <div key={idx} className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group relative ml-16">
                        {/* Indicador de Línea de Tiempo */}
                        <div className="absolute -left-[3.25rem] top-10 w-4 h-4 rounded-full border-4 border-white bg-blue-600 shadow-md"></div>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getInterventionIcon(item.tipo_intervencion)}</span>
                            <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full tracking-widest border ${typeColorClass.split(' ')[0]} ${typeColorClass.split(' ')[2]}`}>
                              {item.tipo_intervencion}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Resuelto
                            </span>
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                              📅 {new Date(item.fecha).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="mb-6">
                           <p className="text-gray-800 font-bold text-sm leading-relaxed">
                              {item.descripcion}
                           </p>
                        </div>
                        
                        {item.notas_adicionales && (
                          <div className="bg-[#FFFCEB] p-6 rounded-2xl border-l-4 border-amber-300 mb-6 shadow-inner">
                            <p className="text-[8px] font-black text-amber-800 uppercase tracking-[0.3em] mb-2 flex items-center gap-1">
                               📌 Nota Técnica
                            </p>
                            <p className="text-amber-900 text-xs italic font-medium leading-relaxed">
                               "{item.notas_adicionales}"
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[9px] text-white font-black shadow-inner">
                               UAS
                            </div>
                            <div>
                               <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest leading-none">Responsable del Caso</p>
                               <p className="text-[10px] text-gray-900 font-black mt-1">{item.docentes?.nombre || 'Docente Tutor'}</p>
                            </div>
                          </div>
                          <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Ver detalles completos</button>
                        </div>
                      </div>
                    );
                  })}
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
