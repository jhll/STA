import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Student, RiskLevel, UserRole } from '../types';
import { calculateRisk, UAS_COLORS, RISK_COLORS, RISK_LABELS } from '../constants';
import StudentProfile from './StudentProfile';

interface TeacherGroup {
  id: string;
  nombre_grupo: string;
  turno: string;
  ciclo_id?: string;
  materias: any;
}

const GroupView: React.FC<{ userId: string; role: UserRole }> = ({ userId, role }) => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  const fetchTeacherGroups = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      let query = supabase
        .from('grupos')
        .select('id, nombre_grupo, turno, ciclo_id, materias (nombre, carrera, semestre)')
        .eq('docente_id', userId);

      if (activeCycle) {
        query = query.eq('ciclo_id', activeCycle.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssignedGroups(data || []);
      if (data && data.length > 0) setSelectedGroupId(data[0].id);
    } catch (err) {
      console.error('Error al cargar grupos del docente:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupStudentsAndAttendance = async (groupId: string, date: string) => {
    const group = assignedGroups.find(g => g.id === groupId);
    if (!group) return;
    setLoadingStudents(true);
    try {
      const { data: activeCycle } = await supabase
        .from('ciclos_escolares')
        .select('id')
        .eq('es_activo', true)
        .maybeSingle();

      const targetCycleId = (group as any).ciclo_id || activeCycle?.id;

      // 1. Consultar historial de estudiantes del ciclo
      let studentData: any[] = [];
      if (targetCycleId) {
        const { data: histData } = await supabase
          .from('historial_estudiantes_ciclo')
          .select('*, estudiantes(*)')
          .eq('ciclo_id', targetCycleId)
          .eq('grupo', group.nombre_grupo);

        if (histData && histData.length > 0) {
          studentData = histData.map(h => {
            const st = getRelation(h.estudiantes);
            return {
              id: h.estudiante_id,
              nombre: st?.nombre || 'Estudiante',
              carrera: h.carrera || st?.carrera,
              semestre: h.semestre || st?.semestre,
              grupo: h.grupo,
              turno: h.turno || st?.turno,
              promedio_acumulado: h.promedio_acumulado !== undefined ? h.promedio_acumulado : st?.promedio_acumulado,
              porcentaje_asistencia: h.porcentaje_asistencia !== undefined ? h.porcentaje_asistencia : st?.porcentaje_asistencia,
              nivel_riesgo: h.nivel_riesgo || st?.nivel_riesgo,
              factores_personales: st?.factores_personales || [],
              factores_academicos: st?.factores_academicos || [],
              factores_institucionales: st?.factores_institucionales || [],
              ciclo_id: h.ciclo_id
            };
          });
        }
      }

      // 2. Si no hay registros en historial, consultar tabla estudiantes
      if (studentData.length === 0) {
        if (group.nombre_grupo.startsWith('SUB - ')) {
          const accName = group.nombre_grupo.replace('SUB - ', '').trim();
          const { data: accData } = await supabase.from('acentuaciones').select('id').eq('nombre', accName).maybeSingle();
          if (accData) {
            const { data: stAccRows } = await supabase
              .from('estudiantes_acentuacion')
              .select('estudiante_id, estudiantes(*)')
              .eq('acentuacion_id', accData.id);
            if (stAccRows && stAccRows.length > 0) {
              studentData = stAccRows.map(r => getRelation(r.estudiantes)).filter(Boolean);
            }
          }
        }

        if (studentData.length === 0) {
          let rawQuery = supabase
            .from('estudiantes')
            .select('*')
            .eq('grupo', group.nombre_grupo);

          if (targetCycleId) {
            rawQuery = rawQuery.eq('ciclo_id', targetCycleId);
          }

          const { data: rawStudents } = await rawQuery.order('nombre', { ascending: true });
          studentData = rawStudents || [];
        }
      }

      const { data: attendanceData } = await supabase
        .from('asistencias')
        .select('estudiante_id, presente')
        .eq('grupo_id', groupId)
        .eq('fecha', date);

      const mapped: Student[] = studentData.map(s => ({
        id: s.id,
        name: s.nombre,
        career: s.carrera as any,
        semester: s.semestre,
        group: s.grupo,
        shift: s.turno as any,
        average: Number(s.promedio_acumulado || 0),
        attendance: s.porcentaje_asistencia || 100,
        risk: (s.nivel_riesgo || 'LOW') as RiskLevel,
        personalFactors: s.factores_personales || [],
        academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || [],
        ciclo_id: s.ciclo_id
      }));

      // Ordenar alfabéticamente ascendentemente por nombre (A - Z) con soporte de acentos en español
      mapped.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

      setStudents(mapped);
      const initial: Record<string, boolean> = {};
      const serverRecordsFound = Boolean(attendanceData && attendanceData.length > 0);
      setIsUpdate(serverRecordsFound);

      mapped.forEach(s => {
        const record = attendanceData?.find(a => a.estudiante_id === s.id);
        initial[s.id] = record ? record.presente : true;
      });

      setAttendance(initial);
      setHasChanges(false);
    } catch (err) {
      console.error('Error al cargar alumnos y asistencia:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedGroupId || students.length === 0) return;
    setIsSaving(true);
    try {
      const records = students.map(s => ({
        estudiante_id: s.id,
        grupo_id: selectedGroupId,
        fecha: selectedDate,
        presente: Boolean(attendance[s.id])
      }));

      const { error } = await supabase.from('asistencias').upsert(records, { onConflict: 'estudiante_id,grupo_id,fecha' });
      if (error) throw error;

      for (const student of students) {
        const { data: attendanceData } = await supabase
          .from('asistencias')
          .select('presente')
          .eq('estudiante_id', student.id)
          .eq('grupo_id', selectedGroupId);

        const { data: studentData } = await supabase
          .from('estudiantes')
          .select('promedio_acumulado')
          .eq('id', student.id)
          .single();

        if (attendanceData && studentData) {
          const perc = Math.round((attendanceData.filter(d => d.presente).length / attendanceData.length) * 100);
          const avg = Number(studentData.promedio_acumulado);
          const newRisk = calculateRisk(avg, perc);
          await supabase.from('estudiantes').update({ porcentaje_asistencia: perc, nivel_riesgo: newRisk }).eq('id', student.id);
        }
      }

      setIsUpdate(true);
      setHasChanges(false);
      alert('✅ Asistencia guardada y métricas actualizadas correctamente.');
    } catch (err) {
      console.error('Error al guardar asistencia:', err);
      alert('❌ Error al sincronizar el pase de lista.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchTeacherGroups();
  }, [userId]);

  useEffect(() => {
    if (selectedGroupId && selectedDate) {
      fetchGroupStudentsAndAttendance(selectedGroupId, selectedDate);
    }
  }, [selectedGroupId, selectedDate, assignedGroups]);

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    students.forEach(s => {
      next[s.id] = val;
    });
    setAttendance(next);
    setHasChanges(true);
  };

  const toggleStudent = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
    setHasChanges(true);
  };

  const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  };

  // Cálculos en tiempo real
  const totalStudents = students.length;
  const presentCount = students.filter(s => attendance[s.id]).length;
  const absentCount = totalStudents - presentCount;
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Filtrado, búsqueda y ordenamiento alfabético ascendente (A - Z)
  const filteredStudents = useMemo(() => {
    return students
      .filter(student => {
        const matchesSearch =
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.id.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;
        if (filterStatus === 'PRESENT') return attendance[student.id] === true;
        if (filterStatus === 'ABSENT') return attendance[student.id] === false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [students, searchTerm, filterStatus, attendance]);

  const currentGroup = assignedGroups.find(g => g.id === selectedGroupId);
  const currentMat = getRelation(currentGroup?.materias);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
        <p className="font-black text-gray-400 text-xs uppercase tracking-widest">
          Cargando entorno de asistencia...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-4 md:p-8 space-y-4 sm:space-y-6 pb-28 sm:pb-12 animate-in fade-in duration-300">
      
      {/* PANEL PRINCIPAL DE CONTROL / SELECTORES */}
      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 space-y-6">
        
        {/* ENCABEZADO Y TÍTULO */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4 sm:pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#003B5C] text-[#FFD100] text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest">
                STA • Asistencia Diaria
              </span>
              {isUpdate && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md">
                  Pase Registrado
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#003B5C] tracking-tight">
              Pase de Lista Institucional
            </h2>
            {currentGroup && (
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                Grupo <strong className="text-gray-900">{currentGroup.nombre_grupo}</strong> — {currentMat?.nombre || 'Asignatura'}
                {currentMat?.carrera ? ` (${currentMat.carrera})` : ''}
              </p>
            )}
          </div>

          {/* BOTÓN DE GUARDAR EN ESCRITORIO */}
          <div className="hidden sm:flex items-center gap-3 w-full lg:w-auto justify-end">
            {hasChanges && (
              <span className="text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider animate-pulse">
                ● Cambios pendientes
              </span>
            )}
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving || !hasChanges}
              className={`px-6 lg:px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                hasChanges
                  ? 'bg-[#003B5C] text-white hover:bg-blue-900 border-2 border-[#FFD100]'
                  : isUpdate
                  ? 'bg-blue-50 text-[#003B5C] border border-blue-200'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>{isUpdate ? 'Actualizar Pase' : 'Guardar Lista'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SELECTORES DE GRUPO Y FECHA (TOTALMENTE RESPONSIVE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          
          {/* SELECTOR DE GRUPO */}
          <div className="space-y-1 sm:col-span-1 lg:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <span>👥</span>
              <span>Grupo / Asignatura</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 sm:p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all cursor-pointer truncate shadow-xs"
            >
              {assignedGroups.map(g => {
                const matInfo = getRelation(g.materias);
                return (
                  <option key={g.id} value={g.id}>
                    Grupo {g.nombre_grupo} — {matInfo?.nombre || 'Sin Materia'} ({g.turno || 'Turno Regular'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* SELECTOR DE FECHA CON ACCESO RÁPIDO */}
          <div className="space-y-1 sm:col-span-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <span>📅</span>
                <span>Fecha de Asistencia</span>
              </label>
              <button
                type="button"
                onClick={setTodayDate}
                className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider hover:underline"
              >
                Hoy
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 sm:p-3.5 rounded-2xl font-bold text-xs sm:text-sm text-gray-900 outline-none transition-all cursor-pointer shadow-xs"
            />
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS EN VIVO DE LA SESIÓN */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-2">
          
          <div className="bg-gray-50 border border-gray-100 p-3 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C]/10 text-[#003B5C] flex items-center justify-center text-lg font-black shrink-0">
              👥
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Matrícula</p>
              <p className="text-base sm:text-xl font-black text-gray-900">{totalStudents}</p>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/80 p-3 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
              ✓
            </div>
            <div>
              <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">Presentes</p>
              <p className="text-base sm:text-xl font-black text-emerald-700">{presentCount}</p>
            </div>
          </div>

          <div className="bg-rose-50/60 border border-rose-200/80 p-3 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
              ✕
            </div>
            <div>
              <p className="text-[9px] font-black text-rose-800 uppercase tracking-wider">Faltas</p>
              <p className="text-base sm:text-xl font-black text-rose-700">{absentCount}</p>
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-200/80 p-3 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C] text-[#FFD100] flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
              %
            </div>
            <div>
              <p className="text-[9px] font-black text-[#003B5C] uppercase tracking-wider">Asistencia</p>
              <p className="text-base sm:text-xl font-black text-[#003B5C]">{attendanceRate}%</p>
            </div>
          </div>

        </div>

      </div>

      {/* BARRA DE ACCIONES RÁPIDAS Y BÚSQUEDA */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        
        {/* BOTONES MASIVOS DE ASISTENCIA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs"
          >
            <span>✓</span>
            <span>Todos Presentes</span>
          </button>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs"
          >
            <span>✕</span>
            <span>Todos Falta</span>
          </button>
        </div>

        {/* BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          
          {/* BUSCADOR */}
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="Buscar por nombre o ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-[#003B5C] focus:bg-white pl-8 pr-3 py-2 rounded-xl text-xs font-medium text-gray-900 outline-none transition-all"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              🔍
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* FILTROS POR ESTADO */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterStatus === 'ALL' ? 'bg-white text-[#003B5C] shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Todos ({totalStudents})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PRESENT')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterStatus === 'PRESENT' ? 'bg-emerald-500 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Pres. ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('ABSENT')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                filterStatus === 'ABSENT' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Falt. ({absentCount})
            </button>
          </div>

        </div>

      </div>

      {/* CONTENEDOR DEL LISTADO DE ALUMNOS */}
      <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
        
        {loadingStudents ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
              Obteniendo lista de alumnos...
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center space-y-2 p-6">
            <span className="text-3xl">📭</span>
            <p className="font-bold text-gray-700 text-sm">
              {students.length === 0
                ? 'No hay alumnos asignados a este grupo en el periodo activo.'
                : 'No se encontraron alumnos con los filtros seleccionados.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); }}
                className="text-xs text-blue-600 font-black uppercase tracking-wider hover:underline"
              >
                Restablecer búsqueda
              </button>
            )}
          </div>
        ) : (
          <>
            {/* VISTA 1: TARJETAS RESPONSIVE PARA MÓVIL (PANTALLAS PEQUEÑAS < 640px) */}
            <div className="block sm:hidden divide-y divide-gray-100">
              {filteredStudents.map((student, idx) => {
                const isPresent = Boolean(attendance[student.id]);
                return (
                  <div
                    key={student.id}
                    className={`p-3.5 transition-all flex items-center justify-between gap-3 ${
                      isPresent ? 'bg-emerald-50/20' : 'bg-rose-50/25'
                    }`}
                  >
                    {/* INFO DEL ALUMNO */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-black text-gray-300 w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
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
                        <p className="font-bold text-gray-900 text-xs truncate leading-snug">
                          {student.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[9px] font-mono text-gray-400">
                            {student.id}
                          </span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${RISK_COLORS[student.risk]}`}>
                            {RISK_LABELS[student.risk]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BOTONES DE ACCIÓN: TOGGLE DE ASISTENCIA Y PERFIL */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleStudent(student.id)}
                        className={`h-11 px-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-90 flex items-center gap-1.5 shadow-xs select-none ${
                          isPresent
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-rose-500 hover:bg-rose-600 text-white'
                        }`}
                        title={isPresent ? 'Click para marcar FALTA' : 'Click para marcar PRESENTE'}
                      >
                        <span className="text-sm">{isPresent ? '✓' : '✕'}</span>
                        <span className="text-[11px] font-black">
                          {isPresent ? 'PRESENTE' : 'FALTA'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="w-10 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm transition-all"
                        title="Ver Ficha y Trayectoria del Alumno"
                      >
                        👁️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VISTA 2: TABLA ESTILIZADA PARA TABLETS Y PANTALLAS GRANDES (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#003B5C] text-white uppercase text-[9px] font-black tracking-widest">
                  <tr>
                    <th className="py-3.5 px-4 text-center w-12">#</th>
                    <th className="py-3.5 px-6">Estudiante</th>
                    <th className="py-3.5 px-4 text-center">Matrícula / ID</th>
                    <th className="py-3.5 px-4 text-center">Nivel Riesgo</th>
                    <th className="py-3.5 px-4 text-center">Asistencia Acumulada</th>
                    <th className="py-3.5 px-6 text-center">Asistencia de Hoy</th>
                    <th className="py-3.5 px-4 text-center w-16">Ficha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredStudents.map((student, idx) => {
                    const isPresent = Boolean(attendance[student.id]);
                    return (
                      <tr
                        key={student.id}
                        className={`transition-all hover:bg-blue-50/20 ${
                          isPresent ? 'bg-white' : 'bg-rose-50/20'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-bold text-gray-400 text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                                student.risk === RiskLevel.HIGH
                                  ? 'bg-rose-500 text-white'
                                  : student.risk === RiskLevel.MEDIUM
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[#003B5C] text-[#FFD100]'
                              }`}
                            >
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{student.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">
                                {student.career || 'FCQB'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-gray-600 font-bold text-[11px]">
                          {student.id}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${RISK_COLORS[student.risk]}`}>
                            {RISK_LABELS[student.risk]}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-black text-gray-800 text-xs">
                              {student.attendance || 100}%
                            </span>
                            <div className="w-12 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (student.attendance || 100) >= 80 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, student.attendance || 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-6 text-center">
                          <button
                            type="button"
                            onClick={() => toggleStudent(student.id)}
                            className={`w-32 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                              isPresent
                                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-2 border-rose-300 hover:bg-rose-100'
                            }`}
                            title={isPresent ? 'Click para marcar FALTA' : 'Click para marcar PRESENTE'}
                          >
                            <span>{isPresent ? '✓' : '✕'}</span>
                            <span>{isPresent ? 'PRESENTE' : 'FALTA'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(student)}
                            className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-[#003B5C] hover:text-white text-gray-500 inline-flex items-center justify-center text-xs transition-all"
                            title="Abrir expediente del estudiante"
                          >
                            👁️
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

      {/* BARRA FLOTANTE FIJA PARA DISPOSITIVOS MÓVILES (FÁCIL ACCESO CON UNA MANO) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t-2 border-gray-200 px-4 py-3 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
              {hasChanges ? 'Por Guardar' : 'Registrado'}
            </span>
            <span className="text-xs font-black text-gray-900">
              <span className="text-emerald-600">✓ {presentCount}</span> / <span className="text-rose-600">✕ {absentCount}</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAttendance}
          disabled={isSaving || !hasChanges}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${
            hasChanges
              ? 'bg-[#003B5C] text-white border-2 border-[#FFD100]'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>{hasChanges ? 'Guardar Lista' : 'Al Día'}</span>
            </>
          )}
        </button>
      </div>

      {/* MODAL DE PERFIL / EXPEDIENTE DE ALUMNO */}
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

export default GroupView;
