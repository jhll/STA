
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Student, RiskLevel } from '../types';
import { calculateRisk } from '../constants';
import StudentProfile from './StudentProfile';

interface TeacherGroup {
  id: string;
  nombre_grupo: string;
  turno: string;
  materias: { nombre: string; carrera: string; semestre: number };
}

const GroupView: React.FC<{ userId: string }> = ({ userId }) => {
  const [assignedGroups, setAssignedGroups] = useState<TeacherGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isUpdate, setIsUpdate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchTeacherGroups = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select('id, nombre_grupo, turno, materias (nombre, carrera, semestre)')
        .eq('docente_id', userId);
      if (error) throw error;
      setAssignedGroups(data as any[] || []);
      if (data && data.length > 0) setSelectedGroupId(data[0].id);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchGroupStudentsAndAttendance = async (groupId: string, date: string) => {
    const group = assignedGroups.find(g => g.id === groupId);
    if (!group) return;
    setLoadingStudents(true);
    try {
      const { data: studentData } = await supabase.from('estudiantes').select('*').eq('grupo', group.nombre_grupo).order('nombre', { ascending: true });
      const { data: attendanceData } = await supabase.from('asistencias').select('estudiante_id, presente').eq('grupo_id', groupId).eq('fecha', date);

      const mapped: Student[] = (studentData || []).map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as RiskLevel,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || [], ciclo_id: s.ciclo_id
      }));

      setStudents(mapped);
      const initial: Record<string, boolean> = {};
      const serverRecordsFound = attendanceData && attendanceData.length > 0;
      setIsUpdate(serverRecordsFound);
      mapped.forEach(s => {
        const record = attendanceData?.find(a => a.estudiante_id === s.id);
        initial[s.id] = record ? record.presente : true;
      });
      setAttendance(initial);
      setHasChanges(false);
    } catch (err) { console.error(err); } finally { setLoadingStudents(false); }
  };

  const handleSaveAttendance = async () => {
    if (!selectedGroupId || students.length === 0) return;
    setIsSaving(true);
    try {
      const records = students.map(s => ({ estudiante_id: s.id, grupo_id: selectedGroupId, fecha: selectedDate, presente: !!attendance[s.id] }));
      const { error } = await supabase.from('asistencias').upsert(records, { onConflict: 'estudiante_id,grupo_id,fecha' });
      if (error) throw error;

      // Sincronizar métricas y riesgo
      for (const student of students) {
        // 1. Obtener todas las asistencias del alumno para este grupo
        const { data: attendanceData } = await supabase.from('asistencias').select('presente').eq('estudiante_id', student.id).eq('grupo_id', selectedGroupId);
        
        // 2. Obtener el promedio actual del alumno
        const { data: studentData } = await supabase.from('estudiantes').select('promedio_acumulado').eq('id', student.id).single();

        if (attendanceData && studentData) {
          const perc = Math.round((attendanceData.filter(d => d.presente).length / attendanceData.length) * 100);
          const avg = Number(studentData.promedio_acumulado);
          
          // 3. Calcular nuevo nivel de riesgo usando la función centralizada
          const newRisk = calculateRisk(avg, perc);

          // 4. Actualizar registro del estudiante
          await supabase.from('estudiantes').update({ 
            porcentaje_asistencia: perc,
            nivel_riesgo: newRisk
          }).eq('id', student.id);
        }
      }

      setIsUpdate(true);
      setHasChanges(false);
      alert("✅ Asistencia y niveles de riesgo actualizados.");
    } catch (err) { 
      console.error(err);
      alert("❌ Error al sincronizar métricas."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  useEffect(() => { fetchTeacherGroups(); }, [userId]);
  useEffect(() => { if (selectedGroupId && selectedDate) fetchGroupStudentsAndAttendance(selectedGroupId, selectedDate); }, [selectedGroupId, selectedDate, assignedGroups]);

  const toggleAll = (val: boolean) => {
    const next = { ...attendance };
    students.forEach(s => next[s.id] = val);
    setAttendance(next);
    setHasChanges(true);
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-gray-300">CONFIGURANDO...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between items-end gap-8">
        <div className="w-full xl:w-1/2">
           <div className="flex items-center gap-3 mb-2">
             <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-widest">Docente Tutor</span>
             <h2 className="text-3xl font-black text-gray-900 tracking-tighter leading-none">Control de Asistencia</h2>
           </div>
           <p className="text-gray-400 font-medium">Gestiona la puntualidad diaria y actualiza el riesgo académico.</p>
           
           <div className="mt-10 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Fecha de Clase</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Seleccionar Grupo</label>
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full bg-gray-50 border border-gray-200 p-4 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                  {assignedGroups.map(g => <option key={g.id} value={g.id}>{g.nombre_grupo} - {g.materias?.nombre}</option>)}
                </select>
              </div>
           </div>
        </div>

        <div className="w-full xl:w-auto flex flex-col items-end gap-4">
           {hasChanges && <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest animate-pulse">● Cambios sin guardar</span>}
           <button onClick={handleSaveAttendance} disabled={isSaving || !hasChanges} className={`w-full xl:w-auto px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${isUpdate ? 'bg-blue-600 text-white' : 'bg-gray-900 text-white hover:bg-emerald-600'}`}>
             {isSaving ? 'Sincronizando Riesgo...' : isUpdate ? 'Actualizar Pase' : 'Guardar Lista'}
           </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-[3rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
           <div className="flex gap-4">
             <button onClick={() => toggleAll(true)} className="text-[10px] font-black uppercase text-emerald-600 tracking-widest hover:underline">Todos Presentes</button>
             <button onClick={() => toggleAll(false)} className="text-[10px] font-black uppercase text-red-600 tracking-widest hover:underline">Todos Ausentes</button>
           </div>
           <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{students.length} Alumnos</span>
        </div>
        <table className="w-full text-left">
          <tbody className="divide-y divide-gray-50">
            {loadingStudents ? (
              <tr><td colSpan={3} className="py-20 text-center text-gray-300 font-black">CARGANDO NÓMINA...</td></tr>
            ) : students.map((student) => (
              <tr key={student.id} className="hover:bg-blue-50/10 group transition-all">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xs shadow-md transition-all group-hover:rotate-3 ${student.risk === 'HIGH' ? 'bg-red-500' : 'bg-gray-200 text-gray-500'}`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-none mb-1">{student.name}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{student.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <div className="flex justify-center">
                    <button 
                      onClick={() => { setAttendance(prev => ({ ...prev, [student.id]: !prev[student.id] })); setHasChanges(true); }}
                      className={`w-20 h-10 rounded-2xl transition-all relative border-2 ${attendance[student.id] ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}
                    >
                      <span className={`text-[9px] font-black uppercase tracking-widest ${attendance[student.id] ? 'text-emerald-600' : 'text-red-500'}`}>
                        {attendance[student.id] ? 'PRESENTE' : 'FALTA'}
                      </span>
                    </button>
                  </div>
                </td>
                <td className="px-10 py-6 text-right">
                  <button onClick={() => setSelectedStudent(student)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-900 hover:text-white transition-all shadow-inner">👁️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedStudent && <StudentProfile student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default GroupView;
