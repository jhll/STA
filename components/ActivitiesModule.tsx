
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { calculateRisk, UAS_COLORS } from '../constants';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newActivity, setNewActivity] = useState({
    titulo: '', 
    descripcion: '', 
    tipo: ActivityType.TAREA, 
    unidad: 1, 
    grupo_id: '', 
    fecha_entrega: '', 
    puntos_max: 10
  });

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const fetchActivities = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      let query = supabase
        .from('actividades')
        .select('*, grupos(nombre_grupo)')
        .eq('docente_id', userId)
        .order('created_at', { ascending: false });

      if (activeCycle) {
        query = query.eq('ciclo_id', activeCycle.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivities(data?.map(a => ({ ...a, grupo_nombre: getRelation(a.grupos)?.nombre_grupo })) || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchAssignedGroups = async () => {
    if (!userId) return;
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      let query = supabase
        .from('grupos')
        .select('id, nombre_grupo, ciclo_id, materias(nombre)')
        .eq('docente_id', userId);

      if (activeCycle) {
        query = query.eq('ciclo_id', activeCycle.id);
      }

      const { data } = await query;
      setAssignedGroups(data || []);
      if (data && data.length > 0 && !newActivity.grupo_id) {
        setNewActivity(prev => ({ ...prev, grupo_id: data[0].id }));
      }
    } catch (err) { console.error(err); }
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
  }, [userId]);

  const handleOpenEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setIsEditing(true);
    const date = new Date(activity.fecha_entrega);
    const formattedDate = date.toISOString().slice(0, 16);
    
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

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta actividad?")) return;
    try {
      const { error } = await supabase.from('actividades').delete().eq('id', id);
      if (error) throw error;
      fetchActivities();
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      const payload = {
        titulo: newActivity.titulo.trim(),
        descripcion: newActivity.descripcion.trim(),
        tipo: String(newActivity.tipo),
        unidad: Math.floor(Number(newActivity.unidad)),
        grupo_id: newActivity.grupo_id,
        docente_id: userId,
        fecha_entrega: new Date(newActivity.fecha_entrega).toISOString(),
        puntos_max: Math.floor(Number(newActivity.puntos_max)),
        ciclo_id: activeCycle?.id || null
      };

      if (isEditing && editingId) {
        await supabase.from('actividades').update(payload).eq('id', editingId);
      } else {
        await supabase.from('actividades').insert([payload]);
      }

      setShowCreateModal(false);
      resetForm();
      fetchActivities();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const resetForm = () => {
    setNewActivity({
      titulo: '', descripcion: '', tipo: ActivityType.TAREA, unidad: 1, grupo_id: assignedGroups[0]?.id || '', fecha_entrega: '', puntos_max: 10
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSaveGrades = async () => {
    if (!evaluatingActivity) return;
    setIsSaving(true);
    try {
      // 1. Guardar las calificaciones actuales de la actividad
      const payloads = Object.values(grades).map((g: any) => ({
        actividad_id: evaluatingActivity.id,
        estudiante_id: g.estudiante_id,
        calificacion: Number(g.calificacion),
        entregado: !!g.entregado
      }));

      const { error: gradesError } = await supabase.from('calificaciones').upsert(payloads, { onConflict: 'actividad_id,estudiante_id' });
      if (gradesError) throw gradesError;

      // 2. Obtener IDs de estudiantes afectados
      const studentIds = activityStudents.map(s => s.id);
      
      // 3. Recalcular métricas de cada estudiante
      const { data: allGrades } = await supabase
        .from('calificaciones')
        .select('estudiante_id, calificacion, actividades(puntos_max)')
        .in('estudiante_id', studentIds);

      const { data: studentsData } = await supabase
        .from('estudiantes')
        .select('id, porcentaje_asistencia')
        .in('id', studentIds);

      // 4. Ejecutar actualizaciones individuales con .update() para evitar el error de campos nulos
      const updatePromises = (studentsData || []).map(async (s) => {
        const sGrades = (allGrades || []).filter(g => g.estudiante_id === s.id);
        
        let totalNormalized = 0;
        sGrades.forEach(g => {
          const pointsMax = getRelation(g.actividades)?.puntos_max || 10;
          totalNormalized += (Number(g.calificacion) / pointsMax) * 10;
        });
        
        const globalAvg = sGrades.length > 0 ? totalNormalized / sGrades.length : 0;
        const currentAtt = s.porcentaje_asistencia || 0;

        // IMPORTANTE: Usamos .update() en lugar de .upsert() 
        // para solo modificar las columnas de interés y no violar restricciones NOT NULL de otras columnas
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
      
      alert("✅ Calificaciones y métricas actualizadas correctamente.");
      setEvaluatingActivity(null);
      fetchActivities();
    } catch (err: any) { 
      console.error("Error al guardar calificaciones:", err);
      alert("❌ Error al guardar: " + (err.message || "Error desconocido en el servidor")); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const startEvaluation = async (activity: Activity) => {
    setEvaluatingActivity(activity);
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      let students: any[] = [];
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
              carrera: h.carrera || st?.carrera,
              semestre: h.semestre || st?.semestre,
              grupo: h.grupo
            };
          });
        }
      }

      if (students.length === 0) {
        if (activity.grupo_nombre?.startsWith('SUB - ')) {
          const accName = activity.grupo_nombre.replace('SUB - ', '').trim();
          const { data: accData } = await supabase.from('acentuaciones').select('id').eq('nombre', accName).maybeSingle();
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

        if (students.length === 0) {
          let rawQuery = supabase
            .from('estudiantes')
            .select('*')
            .eq('grupo', activity.grupo_nombre);

          if (activeCycle) {
            rawQuery = rawQuery.eq('ciclo_id', activeCycle.id);
          }

          const { data: rawStudents } = await rawQuery.order('nombre', { ascending: true });
          students = rawStudents || [];
        }
      }

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

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm gap-6 relative overflow-hidden">
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-4xl font-black text-[#003B5C] tracking-tighter">Gestión de Actividades</h2>
          <p className="text-gray-400 font-medium mt-1">Evalúa el progreso y registra calificaciones permanentes.</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreateModal(true); }} className="relative z-10 bg-[#003B5C] text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-800 transition-all active:scale-95">
          + Nueva Actividad
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {activities.map(activity => (
          <div key={activity.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden flex flex-col relative">
             <div className={`h-3 ${activity.tipo === ActivityType.EXAMEN ? 'bg-red-500' : activity.tipo === ActivityType.TAREA ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
             
             <div className="absolute top-6 right-6 flex gap-2">
                <button onClick={() => handleOpenEdit(activity)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg hover:bg-blue-600 hover:text-white transition-all border border-gray-100">✏️</button>
                <button onClick={() => handleDeleteActivity(activity.id)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg hover:bg-red-600 hover:text-white transition-all border border-gray-100">🗑️</button>
             </div>

             <div className="p-8 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4 pr-24">
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${activity.tipo === ActivityType.EXAMEN ? 'bg-red-50 border-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{activity.tipo}</span>
                    <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[8px] font-black uppercase">U{activity.unidad}</span>
                  </div>
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-6 leading-tight">{activity.titulo}</h4>
                <div className="mt-auto pt-4 border-t border-gray-50">
                   <div className="flex justify-between items-center mb-6">
                      <div className="flex flex-col"><span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Grupo</span><span className="text-[11px] font-black text-[#003B5C]">{activity.grupo_nombre}</span></div>
                      <div className="flex flex-col items-end"><span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Límite</span><span className="text-[11px] font-black text-gray-600">{getDayLabel(activity.fecha_entrega)}</span></div>
                   </div>
                   <button onClick={() => startEvaluation(activity)} className="w-full bg-[#003B5C] text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg hover:bg-[#FFD100] hover:text-[#003B5C] transition-all">Calificar Ahora</button>
                </div>
             </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 my-auto animate-in zoom-in-95 duration-200">
            {/* ENCABEZADO DEL FORMULARIO */}
            <div className="bg-[#003B5C] text-white p-5 sm:p-6 flex justify-between items-center border-b-4 border-[#FFD100]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/10">
                  {isEditing ? '✏️' : '📝'}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFD100] block">
                    Sistema STA • Gestión Docente
                  </span>
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    {isEditing ? 'Editar Actividad Académica' : 'Nueva Actividad Académica'}
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

            {/* FORMULARIO */}
            <form onSubmit={handleSaveActivity} className="p-6 sm:p-8 space-y-6 max-h-[78vh] overflow-y-auto">
              
              {/* CAMPO 1: GRUPO Y ASIGNATURA */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>👥</span>
                    <span>Grupo y Asignatura Asignada</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">Periodo Activo</span>
                </div>
                <select
                  className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-800 outline-none transition-all shadow-xs"
                  value={newActivity.grupo_id}
                  onChange={e => setNewActivity({ ...newActivity, grupo_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona el grupo y asignatura...</option>
                  {assignedGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      Grupo {g.nombre_grupo} — {getRelation(g.materias)?.nombre || 'Asignatura'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500">
                  La actividad se registrará únicamente para los alumnos de este grupo en el periodo escolar en curso.
                </p>
              </div>

              {/* CAMPO 2: TÍTULO DE LA ACTIVIDAD */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                  <span>📌</span>
                  <span>Título o Nombre de la Actividad</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all shadow-xs placeholder:text-gray-400"
                  placeholder="Ej. Tarea 2: Balanceo de Ecuaciones Químicas"
                  value={newActivity.titulo}
                  onChange={e => setNewActivity({ ...newActivity, titulo: e.target.value })}
                  required
                />
              </div>

              {/* GRID 2 COLUMNAS: TIPO DE ACTIVIDAD Y UNIDAD TEMÁTICA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* CAMPO 3: TIPO DE ACTIVIDAD */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏷️</span>
                    <span>Tipo de Actividad</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-800 outline-none transition-all shadow-xs"
                    value={newActivity.tipo}
                    onChange={e => setNewActivity({ ...newActivity, tipo: e.target.value as ActivityType })}
                    required
                  >
                    <option value={ActivityType.TAREA}>📋 Tarea Académica</option>
                    <option value={ActivityType.EJERCICIO}>✏️ Ejercicio / Práctica</option>
                    <option value={ActivityType.EXAMEN}>📑 Examen Parcial / Departamental</option>
                  </select>
                </div>

                {/* CAMPO 4: UNIDAD TEMÁTICA */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>Unidad de Aprendizaje</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all shadow-xs"
                    placeholder="Ej. 1"
                    value={newActivity.unidad}
                    onChange={e => setNewActivity({ ...newActivity, unidad: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              {/* GRID 2 COLUMNAS: PUNTOS MÁXIMOS Y FECHA DE ENTREGA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* CAMPO 5: PUNTOS MÁXIMOS */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>⭐</span>
                    <span>Puntaje Máximo (Ponderación)</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 pr-16 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all shadow-xs"
                      placeholder="10"
                      value={newActivity.puntos_max}
                      onChange={e => setNewActivity({ ...newActivity, puntos_max: Number(e.target.value) })}
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                      pts
                    </span>
                  </div>
                </div>

                {/* CAMPO 6: FECHA Y HORA LÍMITE */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                    <span>📅</span>
                    <span>Fecha y Hora Límite de Entrega</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all shadow-xs"
                    value={newActivity.fecha_entrega}
                    onChange={e => setNewActivity({ ...newActivity, fecha_entrega: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* CAMPO 7: DESCRIPCIÓN O INSTRUCCIONES */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                  <span>💬</span>
                  <span>Instrucciones o Descripción Detallada</span>
                  <span className="text-xs text-gray-400 font-medium lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-gray-50/80 hover:bg-gray-50 focus:bg-white border-2 border-gray-200 focus:border-[#003B5C] p-3.5 rounded-2xl font-medium text-xs sm:text-sm text-gray-900 outline-none transition-all shadow-xs resize-none placeholder:text-gray-400"
                  placeholder="Describe los lineamientos, rúbrica, criterios de entrega o enlaces de consulta para los estudiantes..."
                  value={newActivity.descripcion}
                  onChange={e => setNewActivity({ ...newActivity, descripcion: e.target.value })}
                />
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto bg-[#003B5C] text-white hover:bg-blue-900 active:scale-95 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 border border-[#FFD100]/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>{isEditing ? 'Actualizar Actividad' : 'Guardar Actividad'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {evaluatingActivity && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
              <h3 className="text-2xl font-black text-[#003B5C]">{evaluatingActivity.titulo}</h3>
              <button onClick={() => setEvaluatingActivity(null)} className="text-2xl text-gray-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-4">
              {activityStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-100">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{student.nombre}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{student.id}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" step="0.1" max={evaluatingActivity.puntos_max} 
                      className="w-24 bg-gray-50 border p-4 rounded-xl text-center font-black outline-none focus:ring-2 focus:ring-blue-500/20" 
                      value={grades[student.id]?.calificacion || 0} 
                      onChange={e => setGrades({...grades, [student.id]: { ...(grades[student.id] || {}), calificacion: Number(e.target.value) }})} 
                    />
                    <button 
                      onClick={() => setGrades({...grades, [student.id]: { ...(grades[student.id] || {}), entregado: !grades[student.id]?.entregado }})} 
                      className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${grades[student.id]?.entregado ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {grades[student.id]?.entregado ? 'Entregado' : 'Pendiente'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-10 border-t flex justify-end gap-4 bg-gray-50/50">
              <button onClick={() => setEvaluatingActivity(null)} className="text-gray-400 font-black text-xs uppercase tracking-widest">Cerrar</button>
              <button onClick={handleSaveGrades} disabled={isSaving} className="bg-[#003B5C] text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-emerald-600 transition-all">
                {isSaving ? 'Guardando...' : 'Finalizar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitiesModule;
