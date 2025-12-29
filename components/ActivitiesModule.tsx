
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { calculateRisk } from '../constants';
import { Activity, ActivityType, UserRole, Grade, RiskLevel } from '../types';

interface ActivitiesModuleProps {
  userId: string;
  role: UserRole;
}

const ActivitiesModule: React.FC<ActivitiesModuleProps> = ({ userId, role }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [evaluatingActivity, setEvaluatingActivity] = useState<Activity | null>(null);
  const [activityStudents, setActivityStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, Partial<Grade>>>({});
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

  const fetchActivities = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('actividades').select('*, grupos(nombre_grupo)').eq('docente_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      setActivities(data?.map(a => ({ ...a, grupo_nombre: a.grupos?.nombre_grupo })) || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAssignedGroups = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase.from('grupos').select('id, nombre_grupo, materias(nombre)').eq('docente_id', userId);
      setAssignedGroups(data || []);
      if (data && data.length > 0 && !newActivity.grupo_id) {
        setNewActivity(prev => ({ ...prev, grupo_id: data[0].id }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchActivities(); fetchAssignedGroups(); }, [userId]);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.grupo_id || !newActivity.titulo || !newActivity.fecha_entrega) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        titulo: newActivity.titulo.trim(),
        descripcion: newActivity.descripcion.trim(),
        tipo: String(newActivity.tipo),
        unidad: Math.floor(Number(newActivity.unidad)),
        grupo_id: newActivity.grupo_id,
        docente_id: userId,
        fecha_entrega: new Date(newActivity.fecha_entrega).toISOString(),
        puntos_max: Math.floor(Number(newActivity.puntos_max))
      };

      const { error } = await supabase.from('actividades').insert([payload]);
      if (error) throw error;

      setShowCreateModal(false);
      setNewActivity({
        titulo: '', descripcion: '', tipo: ActivityType.TAREA, unidad: 1, grupo_id: assignedGroups[0]?.id || '', fecha_entrega: '', puntos_max: 10
      });
      fetchActivities();
      alert("✨ Actividad publicada exitosamente.");
    } catch (err: any) {
      alert("Error al crear actividad: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!evaluatingActivity) return;
    setIsSaving(true);
    try {
      const payloads = Object.values(grades).map(g => ({ ...(g as Record<string, any>), actividad_id: evaluatingActivity.id }));
      const { error } = await supabase.from('calificaciones').upsert(payloads, { onConflict: 'actividad_id,estudiante_id' });
      if (error) throw error;

      // Sincronizar métricas y riesgo
      for (const student of activityStudents) {
        // 1. Obtener todas las calificaciones del alumno
        const { data: gradesData } = await supabase.from('calificaciones').select('calificacion').eq('estudiante_id', student.id);
        
        // 2. Obtener datos actuales de asistencia del alumno
        const { data: studentData } = await supabase.from('estudiantes').select('porcentaje_asistencia').eq('id', student.id).single();

        if (gradesData && gradesData.length > 0 && studentData) {
          const avg = gradesData.reduce((acc, curr) => acc + Number(curr.calificacion), 0) / gradesData.length;
          const attendance = studentData.porcentaje_asistencia;
          
          // 3. Calcular nuevo nivel de riesgo usando la función centralizada
          const newRisk = calculateRisk(avg, attendance);

          // 4. Actualizar registro del estudiante
          await supabase.from('estudiantes').update({ 
            promedio_acumulado: avg,
            nivel_riesgo: newRisk
          }).eq('id', student.id);
        }
      }
      alert("✅ Calificaciones y niveles de riesgo sincronizados.");
      setEvaluatingActivity(null);
    } catch (err) { 
      console.error(err);
      alert("Error al sincronizar datos académicos."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const startEvaluation = async (activity: Activity) => {
    setEvaluatingActivity(activity);
    try {
      const { data: students } = await supabase.from('estudiantes').select('*').eq('grupo', activity.grupo_nombre).order('nombre', { ascending: true });
      const { data: existingGrades } = await supabase.from('calificaciones').select('*').eq('actividad_id', activity.id);
      setActivityStudents(students || []);
      const map: Record<string, Partial<Grade>> = {};
      students?.forEach(s => {
        const found = existingGrades?.find(g => g.estudiante_id === s.id);
        map[s.id] = found || { actividad_id: activity.id, estudiante_id: s.id, calificacion: 0, entregado: false };
      });
      setGrades(map);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Planeación Estratégica</h2>
          <p className="text-gray-400 font-medium">Asigna y evalúa actividades para medir el desempeño grupal.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all active:scale-95">
          + Nueva Actividad
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {activities.map(activity => (
          <div key={activity.id} className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden relative">
             <div className="flex justify-between items-start mb-6">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  activity.tipo === ActivityType.EXAMEN ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>{activity.tipo}</span>
                <span className="text-2xl font-black text-gray-100 group-hover:text-blue-600 transition-colors">U{activity.unidad}</span>
             </div>
             <h4 className="text-xl font-black text-gray-900 mb-2 leading-tight pr-10">{activity.titulo}</h4>
             <p className="text-gray-400 text-xs font-medium line-clamp-2 mb-2">{activity.descripcion || 'Sin descripción adicional.'}</p>
             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-10 flex items-center gap-2">
                📅 Entrega: {new Date(activity.fecha_entrega).toLocaleDateString()}
             </p>
             
             <div className="flex justify-between items-end mt-6 pt-6 border-t border-gray-50">
                <div>
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Grupo</p>
                  <p className="text-[10px] font-black text-gray-900 uppercase">{activity.grupo_nombre}</p>
                </div>
                <button onClick={() => startEvaluation(activity)} className="bg-gray-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95">Evaluar</button>
             </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
             <span className="text-5xl block mb-4">📓</span>
             <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No hay actividades publicadas aún.</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-lg p-12 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-8">Definir Actividad</h3>
            <form onSubmit={handleCreateActivity} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo Destino</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                  value={newActivity.grupo_id} 
                  onChange={e => setNewActivity({...newActivity, grupo_id: e.target.value})} 
                  required
                >
                  <option value="">Selecciona un grupo...</option>
                  {assignedGroups.map(g => <option key={g.id} value={g.id}>{g.nombre_grupo} - {g.materias?.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Título</label>
                <input type="text" placeholder="Ej: Reporte de Laboratorio II" className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={newActivity.titulo} onChange={e => setNewActivity({...newActivity, titulo: e.target.value})} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tipo</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    value={newActivity.tipo}
                    onChange={e => setNewActivity({...newActivity, tipo: e.target.value as ActivityType})}
                  >
                    <option value={ActivityType.TAREA}>Tarea</option>
                    <option value={ActivityType.EJERCICIO}>Ejercicio</option>
                    <option value={ActivityType.EXAMEN}>Examen</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Unidad</label>
                  <input type="number" placeholder="Ej: 1" className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={newActivity.unidad} onChange={e => setNewActivity({...newActivity, unidad: Number(e.target.value)})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Puntos Máximos</label>
                  <input type="number" placeholder="Ej: 10" className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={newActivity.puntos_max} onChange={e => setNewActivity({...newActivity, puntos_max: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fecha Entrega</label>
                  <input type="datetime-local" className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-[10px] outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={newActivity.fecha_entrega} onChange={e => setNewActivity({...newActivity, fecha_entrega: e.target.value})} required />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descripción (Opcional)</label>
                <textarea 
                  placeholder="Instrucciones adicionales..." 
                  className="w-full bg-gray-50 border border-gray-100 p-5 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all h-24 resize-none" 
                  value={newActivity.descripcion} 
                  onChange={e => setNewActivity({...newActivity, descripcion: e.target.value})}
                />
              </div>

              <button disabled={isSaving} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl mt-4 hover:bg-blue-700 transition-all active:scale-95">
                {isSaving ? 'Publicando...' : 'Crear Actividad'}
              </button>
              <button type="button" onClick={() => setShowCreateModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase tracking-widest">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {evaluatingActivity && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-12 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tighter leading-none mb-2">{evaluatingActivity.titulo}</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Evaluación de Desempeño • {evaluatingActivity.grupo_nombre}</p>
              </div>
              <button onClick={() => setEvaluatingActivity(null)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 space-y-4">
              {activityStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 hover:bg-white transition-all shadow-sm">
                  <div className="flex items-center gap-5">
                     <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center font-black text-gray-500 text-xs uppercase">{student.nombre.charAt(0)}</div>
                     <span className="font-bold text-gray-900 text-sm">{student.nombre}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input type="number" step="0.1" max={evaluatingActivity.puntos_max} className="w-24 bg-white border border-gray-100 p-4 rounded-2xl text-center font-black text-lg focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" value={grades[student.id]?.calificacion || 0} onChange={e => setGrades({...grades, [student.id]: { ...(grades[student.id] || {}), calificacion: Number(e.target.value) }})} />
                    <button onClick={() => setGrades({...grades, [student.id]: { ...(grades[student.id] || {}), entregado: !grades[student.id]?.entregado }})} className={`px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${grades[student.id]?.entregado ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                      {grades[student.id]?.entregado ? 'Recibido' : 'Pendiente'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-12 border-t flex justify-end gap-6 bg-gray-50/50">
              <button onClick={() => setEvaluatingActivity(null)} className="font-black text-xs text-gray-400 uppercase tracking-widest">Cerrar</button>
              <button onClick={handleSaveGrades} disabled={isSaving} className="bg-gray-900 text-white px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95">{isSaving ? 'Sincronizando...' : 'Guardar Notas'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesModule;
