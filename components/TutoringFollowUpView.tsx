import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Student, RiskLevel, UserRole } from '../types';
import { UAS_COLORS, RISK_COLORS, RISK_LABELS } from '../constants';
import StudentProfile from './StudentProfile';

export interface FollowUpRecord {
  id: string;
  estudiante_id: string;
  tipo_intervencion: string;
  descripcion: string;
  notas_adicionales: string;
  ciclo_id?: string;
  fecha: string;
  estatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  student?: Student;
}

export const PREVENTIVE_ACTION_TYPES = [
  'Asesoría Académica',
  'Apoyo Psicológico',
  'Seguimiento de Beca',
  'Vinculación Padres/Tutores',
  'Taller de Habilidades de Estudio',
  'Canalización Médica/Nutricional',
  'Orientación Vocacional'
] as const;

export const STATUS_LABELS: Record<string, { label: string; badgeClass: string; icon: string }> = {
  PENDING: {
    label: 'Canalizado / Por Iniciar',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '🟡'
  },
  IN_PROGRESS: {
    label: 'En Seguimiento Activo',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: '🔵'
  },
  COMPLETED: {
    label: 'Atendida / Concluida',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: '🟢'
  },
  CANCELLED: {
    label: 'Cancelada',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '⚪'
  }
};

const getActionTypeColor = (type: string) => {
  switch (type) {
    case 'Asesoría Académica':
      return 'border-blue-500 text-blue-800 bg-blue-50/80';
    case 'Apoyo Psicológico':
      return 'border-purple-500 text-purple-800 bg-purple-50/80';
    case 'Seguimiento de Beca':
      return 'border-emerald-500 text-emerald-800 bg-emerald-50/80';
    case 'Vinculación Padres/Tutores':
      return 'border-amber-500 text-amber-800 bg-amber-50/80';
    case 'Taller de Habilidades de Estudio':
      return 'border-indigo-500 text-indigo-800 bg-indigo-50/80';
    case 'Canalización Médica/Nutricional':
      return 'border-rose-500 text-rose-800 bg-rose-50/80';
    default:
      return 'border-cyan-500 text-cyan-800 bg-cyan-50/80';
  }
};

const TutoringFollowUpView: React.FC<{ userId: string; role: UserRole; userName?: string }> = ({ userId, role, userName }) => {
  const [loading, setLoading] = useState(true);
  const [activeCycleName, setActiveCycleName] = useState<string>('');
  const [activeCycleId, setActiveCycleId] = useState<string>('');
  const [tutorStudents, setTutorStudents] = useState<Student[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [tutorName, setTutorName] = useState<string>('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  // Modal Nueva Canalización
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    estudiante_id: '',
    tipo_intervencion: 'Asesoría Académica',
    descripcion: '',
    notas_adicionales: '',
    estatus: 'IN_PROGRESS' as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
    area_destino: 'Centro de Asesorías FCQB'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Actualizar Seguimiento / Bitácora
  const [selectedFollowUpForUpdate, setSelectedFollowUpForUpdate] = useState<FollowUpRecord | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('IN_PROGRESS');
  const [newProgressNote, setNewProgressNote] = useState('');
  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);

  const getRelation = (data: any) => (Array.isArray(data) ? data[0] : data);

  const fetchTutorFollowUpData = async () => {
    setLoading(true);
    try {
      // 1. Obtener ciclo escolar activo
      const { data: cycleData } = await supabase
        .from('ciclos_escolares')
        .select('id, nombre')
        .eq('es_activo', true)
        .maybeSingle();

      if (cycleData) {
        setActiveCycleId(cycleData.id);
        setActiveCycleName(cycleData.nombre);
      }

      // 1.5 Obtener nombre del tutor autenticado
      if (userId) {
        try {
          const { data: userDoc } = await supabase
            .from('docentes')
            .select('nombre')
            .eq('id', userId)
            .maybeSingle();
          if (userDoc?.nombre) setTutorName(userDoc.nombre);
        } catch (e) {
          console.error("Error al obtener nombre de docente:", e);
        }
      }

      // 2. Obtener los alumnos asignados al tutor
      let assignedStudents: any[] = [];
      let tutorGroups: string[] = [];

      if (role === UserRole.TUTOR) {
        const { data: tutorias, error: tutoriaError } = await supabase
          .from('tutorias')
          .select('nombre_grupo, estudiante_id')
          .eq('tutor_id', userId);

        if (tutoriaError) throw tutoriaError;

        tutorGroups = Array.from(new Set((tutorias?.map(t => t.nombre_grupo).filter(Boolean) || []) as string[]));
        const studentIds = Array.from(new Set((tutorias?.map(t => t.estudiante_id).filter(Boolean) || []) as string[]));

        if (tutorGroups.length > 0 || studentIds.length > 0) {
          const orConditions: string[] = [];
          if (tutorGroups.length > 0) orConditions.push(`grupo.in.(${tutorGroups.map(g => `"${g}"`).join(',')})`);
          if (studentIds.length > 0) orConditions.push(`id.in.(${studentIds.map(id => `"${id}"`).join(',')})`);

          let query = supabase.from('estudiantes').select('*');
          if (orConditions.length > 1) {
            query = query.or(orConditions.join(','));
          } else if (orConditions.length === 1) {
            if (tutorGroups.length > 0) query = query.in('grupo', tutorGroups);
            if (studentIds.length > 0) query = query.in('id', studentIds);
          }

          if (cycleData?.id) {
            query = query.eq('ciclo_id', cycleData.id);
          }

          const { data: studentRows, error: studentError } = await query;
          if (studentError) throw studentError;

          // Si el filtro de ciclo no devolvió alumnos (p.ej. registros sin ciclo_id explícito), consultar sin ciclo
          if (!studentRows || studentRows.length === 0) {
            let fallbackQuery = supabase.from('estudiantes').select('*');
            if (orConditions.length > 1) {
              fallbackQuery = fallbackQuery.or(orConditions.join(','));
            } else if (orConditions.length === 1) {
              if (tutorGroups.length > 0) fallbackQuery = fallbackQuery.in('grupo', tutorGroups);
              if (studentIds.length > 0) fallbackQuery = fallbackQuery.in('id', studentIds);
            }
            const { data: fallbackRows } = await fallbackQuery;
            assignedStudents = fallbackRows || [];
          } else {
            assignedStudents = studentRows;
          }
        }
      } else {
        // ADMIN: tiene visibilidad de todos los alumnos
        let adminQuery = supabase.from('estudiantes').select('*').limit(500);
        if (cycleData?.id) {
          adminQuery = adminQuery.eq('ciclo_id', cycleData.id);
        }
        const { data: adminStudents } = await adminQuery;
        assignedStudents = adminStudents || [];
      }

      const mappedStudents: Student[] = assignedStudents.map(s => ({
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

      // Ordenar alfabéticamente
      mappedStudents.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setTutorStudents(mappedStudents);

      // 3. Consultar las intervenciones / canalizaciones de estos alumnos
      if (mappedStudents.length > 0) {
        const studentIdsList = mappedStudents.map(s => s.id);
        const { data: intRows, error: intError } = await supabase
          .from('intervenciones')
          .select('*')
          .in('estudiante_id', studentIdsList)
          .order('fecha', { ascending: false });

        if (intError) throw intError;

        const mappedFollowUps: FollowUpRecord[] = (intRows || []).map((row: any) => {
          const studentObj = mappedStudents.find(s => s.id === row.estudiante_id);
          return {
            id: row.id,
            estudiante_id: row.estudiante_id,
            tipo_intervencion: row.tipo_intervencion || 'Asesoría Académica',
            descripcion: row.descripcion || '',
            notas_adicionales: row.notas_adicionales || '',
            ciclo_id: row.ciclo_id,
            fecha: row.fecha || new Date().toISOString(),
            estatus: (row.estatus || 'IN_PROGRESS') as any,
            student: studentObj
          };
        });

        setFollowUps(mappedFollowUps);
      } else {
        setFollowUps([]);
      }
    } catch (err) {
      console.error('Error al cargar datos de seguimiento de tutorías:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorFollowUpData();
  }, [userId, role]);

  // Alumnos del tutor que tienen riesgo ALTO y NO tienen ninguna canalización registrada
  const unchanneledAtRiskStudents = useMemo(() => {
    const channeledStudentIds = new Set(followUps.map(f => f.estudiante_id));
    return tutorStudents.filter(
      student => student.risk === RiskLevel.HIGH && !channeledStudentIds.has(student.id)
    );
  }, [tutorStudents, followUps]);

  // Grupos únicos de los alumnos del tutor
  const availableGroups = useMemo(() => {
    return Array.from(new Set(tutorStudents.map(s => s.group).filter(Boolean))).sort();
  }, [tutorStudents]);

  // Filtrado de las canalizaciones en la lista
  const filteredFollowUps = useMemo(() => {
    return followUps.filter(record => {
      const studentName = record.student?.name || '';
      const studentId = record.estudiante_id || '';
      const matchesSearch =
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter !== 'ALL' && record.estatus !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'ALL' && record.tipo_intervencion !== typeFilter) {
        return false;
      }

      if (groupFilter !== 'ALL' && record.student?.group !== groupFilter) {
        return false;
      }

      return true;
    });
  }, [followUps, searchTerm, statusFilter, typeFilter, groupFilter]);

  // Contadores globales
  const stats = useMemo(() => {
    const totalCanalizaciones = followUps.length;
    const distinctChanneledStudents = new Set(followUps.map(f => f.estudiante_id)).size;
    const inProgress = followUps.filter(f => f.estatus === 'IN_PROGRESS').length;
    const pending = followUps.filter(f => f.estatus === 'PENDING').length;
    const completed = followUps.filter(f => f.estatus === 'COMPLETED').length;

    return {
      totalCanalizaciones,
      distinctChanneledStudents,
      activeFollowUps: inProgress + pending,
      completed,
      urgentUnchanneled: unchanneledAtRiskStudents.length
    };
  }, [followUps, unchanneledAtRiskStudents]);

  // Crear nueva canalización
  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.estudiante_id) {
      alert('Por favor selecciona un estudiante.');
      return;
    }
    if (!createForm.descripcion.trim()) {
      alert('Por favor ingresa el motivo o diagnóstico de la canalización.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedStudentObj = tutorStudents.find(s => s.id === createForm.estudiante_id);
      const nowFormatted = new Date().toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const initialNote = `[${nowFormatted}] Canalizado por Tutor a: ${createForm.area_destino}.\n${
        createForm.notas_adicionales ? `Observaciones iniciales: ${createForm.notas_adicionales.trim()}` : ''
      }`.trim();

      const author = tutorName || (role === UserRole.ADMIN ? 'Administración Escolar / Tutoría' : 'Tutor Académico UAS');

      const newRecord = {
        estudiante_id: createForm.estudiante_id,
        tipo_intervencion: createForm.tipo_intervencion,
        descripcion: `[${createForm.area_destino}] ${createForm.descripcion.trim()}`,
        notas_adicionales: initialNote,
        ciclo_id: selectedStudentObj?.ciclo_id || activeCycleId || null,
        estatus: createForm.estatus,
        nombre_docente: author,
        docente_id: userId || null
      };

      const { error } = await supabase.from('intervenciones').insert([newRecord]);
      if (error) {
        if (error.code === '42703' || error.message?.includes('nombre_docente') || error.message?.includes('docente_id')) {
          const fallbackRecord = {
            estudiante_id: createForm.estudiante_id,
            tipo_intervencion: createForm.tipo_intervencion,
            descripcion: `[${createForm.area_destino}] ${createForm.descripcion.trim()}`,
            notas_adicionales: `${initialNote}\n[Docente/Tutor: ${author}]`,
            ciclo_id: selectedStudentObj?.ciclo_id || activeCycleId || null,
            estatus: createForm.estatus
          };
          const { error: fbErr } = await supabase.from('intervenciones').insert([fallbackRecord]);
          if (fbErr) throw fbErr;
        } else {
          throw error;
        }
      }

      alert('✅ Alumno canalizado exitosamente a la acción preventiva.');
      setShowCreateModal(false);
      setCreateForm({
        estudiante_id: '',
        tipo_intervencion: 'Asesoría Académica',
        descripcion: '',
        notas_adicionales: '',
        estatus: 'IN_PROGRESS',
        area_destino: 'Centro de Asesorías FCQB'
      });
      fetchTutorFollowUpData();
    } catch (err: any) {
      console.error('Error al registrar canalización:', err);
      alert(`❌ Error al guardar: ${err.message || 'Ocurrió un problema'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal de actualización
  const handleOpenUpdateModal = (record: FollowUpRecord) => {
    setSelectedFollowUpForUpdate(record);
    setUpdateStatus(record.estatus);
    setNewProgressNote('');
  };

  // Guardar avance en la bitácora
  const handleSaveProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUpForUpdate) return;

    setIsUpdatingFollowUp(true);
    try {
      const nowFormatted = new Date().toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      let updatedNotes = selectedFollowUpForUpdate.notas_adicionales || '';
      if (newProgressNote.trim()) {
        const newEntry = `\n\n--- [${nowFormatted}] Seguimiento del Tutor ---\n${newProgressNote.trim()}`;
        updatedNotes = `${updatedNotes}${newEntry}`.trim();
      }

      const { error } = await supabase
        .from('intervenciones')
        .update({
          estatus: updateStatus,
          notas_adicionales: updatedNotes
        })
        .eq('id', selectedFollowUpForUpdate.id);

      if (error) throw error;

      alert('✅ Seguimiento de la canalización actualizado con éxito.');
      setSelectedFollowUpForUpdate(null);
      fetchTutorFollowUpData();
    } catch (err: any) {
      console.error('Error al actualizar seguimiento:', err);
      alert(`❌ Error al actualizar: ${err.message || 'Ocurrió un problema'}`);
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  // Iniciar canalización rápida para un alumno en riesgo
  const handleQuickChannel = (student: Student) => {
    setCreateForm({
      estudiante_id: student.id,
      tipo_intervencion: 'Asesoría Académica',
      descripcion: `Intervención preventiva prioritaria por semáforo de riesgo ALTO (Promedio: ${student.average}, Asistencia: ${student.attendance}%).`,
      notas_adicionales: 'Canalización preventiva generada desde el panel de alerta temprana de tutorías.',
      estatus: 'IN_PROGRESS',
      area_destino: 'Centro de Asesorías FCQB'
    });
    setShowCreateModal(true);
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (filteredFollowUps.length === 0) {
      alert('No hay registros de canalización para exportar.');
      return;
    }

    const headers = [
      'Matrícula',
      'Nombre Completo',
      'Licenciatura',
      'Semestre',
      'Grupo',
      'Nivel de Riesgo',
      'Tipo de Acción Preventiva',
      'Fecha de Canalización',
      'Estatus',
      'Motivo / Diagnóstico',
      'Bitácora de Seguimiento'
    ];

    const rows = filteredFollowUps.map(f => [
      `"${f.estudiante_id}"`,
      `"${f.student?.name?.replace(/"/g, '""') || 'Estudiante'}"`,
      `"${f.student?.career || ''}"`,
      f.student?.semester || '',
      `"${f.student?.group || ''}"`,
      `"${f.student ? RISK_LABELS[f.student.risk] : ''}"`,
      `"${f.tipo_intervencion}"`,
      `"${new Date(f.fecha).toLocaleDateString('es-MX')}"`,
      `"${STATUS_LABELS[f.estatus]?.label || f.estatus}"`,
      `"${f.descripcion.replace(/"/g, '""')}"`,
      `"${f.notas_adicionales.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `canalizaciones_tutorias_fcqb_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 space-y-6 pb-20 animate-in fade-in duration-300">
      
      {/* =========================================================
          ENCABEZADO OFICIAL PARA IMPRESIÓN (PDF / REPORTE)
      ========================================================= */}
      <div className="hidden print:block mb-6 border-b-2 border-[#003B5C] pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-[#003B5C] uppercase tracking-tight">
              Universidad Autónoma de Sinaloa
            </h1>
            <h2 className="text-sm font-bold text-gray-800 uppercase">
              Facultad de Ciencias Químico Biológicas • Sistema de Tutorías y Acompañamiento (STA)
            </h2>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Reporte Oficial de Seguimiento a Canalizaciones y Acciones Preventivas de Tutorías
            </p>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p><strong>Ciclo Escolar:</strong> {activeCycleName || 'Periodo Activo'}</p>
            <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>Casos Documentados:</strong> {filteredFollowUps.length}</p>
          </div>
        </div>
      </div>

      {/* =========================================================
          CABECERA PRINCIPAL Y ACCIONES
      ========================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-gray-100 print:hidden space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#003B5C] text-[#FFD100] text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest shadow-xs">
                UAS FCQB • Programa Institucional de Tutorías (PIT)
              </span>
              {activeCycleName && (
                <span className="bg-blue-50 text-[#003B5C] border border-blue-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-md">
                  Ciclo: {activeCycleName}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#003B5C] tracking-tight">
              Seguimiento a Alumnos Canalizados
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Control, bitácora y monitoreo de acciones preventivas aplicadas a tus tutorados para mitigar rezago y deserción.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#003B5C] hover:bg-blue-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md border-2 border-[#FFD100] cursor-pointer"
            >
              <span>➕</span>
              <span>Nueva Canalización</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredFollowUps.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 shadow-xs cursor-pointer"
              title="Exportar a Excel / CSV"
            >
              <span>📥</span>
              <span>Exportar</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredFollowUps.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 shadow-xs cursor-pointer"
              title="Imprimir formato oficial o PDF"
            >
              <span>🖨️</span>
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={fetchTutorFollowUpData}
              className="p-3 bg-white hover:bg-gray-50 text-gray-500 border border-gray-200 rounded-2xl text-xs font-black transition-all shadow-xs cursor-pointer"
              title="Actualizar datos"
            >
              🔄
            </button>
          </div>
        </div>

        {/* =========================================================
            KPI CARDS: MÉTRICAS DE IMPACTO EN TIEMPO REAL
        ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* TOTAL CANALIZADOS */}
          <div className="bg-gray-50/80 border border-gray-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C]/10 text-[#003B5C] flex items-center justify-center text-lg font-black shrink-0">
              👥
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider truncate">Alumnos Atendidos</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900">{stats.distinctChanneledStudents}</p>
            </div>
          </div>

          {/* EN SEGUIMIENTO ACTIVO */}
          <div className="bg-blue-50/50 border border-blue-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003B5C] text-[#FFD100] flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
              ⏳
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-[#003B5C] uppercase tracking-wider truncate">En Seguimiento Activo</p>
              <p className="text-lg sm:text-2xl font-black text-[#003B5C]">{stats.activeFollowUps}</p>
            </div>
          </div>

          {/* ACCIONES CONCLUIDAS */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-black shrink-0 shadow-xs">
              ✓
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider truncate">Acciones Concluidas</p>
              <p className="text-lg sm:text-2xl font-black text-emerald-700">{stats.completed}</p>
            </div>
          </div>

          {/* CASOS SIN CANALIZAR */}
          <div className={`p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 border transition-all ${
            stats.urgentUnchanneled > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 shadow-xs ${
              stats.urgentUnchanneled > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'
            }`}>
              ⚠️
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] font-black uppercase tracking-wider truncate ${
                stats.urgentUnchanneled > 0 ? 'text-rose-800' : 'text-gray-400'
              }`}>
                Riesgo Sin Canalizar
              </p>
              <p className={`text-lg sm:text-2xl font-black ${stats.urgentUnchanneled > 0 ? 'text-rose-700' : 'text-gray-700'}`}>
                {stats.urgentUnchanneled}
              </p>
            </div>
          </div>

        </div>

        {/* =========================================================
            ALERTA VISUAL: ALUMNOS EN RIESGO CRÍTICO SIN CANALIZAR
        ========================================================= */}
        {unchanneledAtRiskStudents.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-200 p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚨</span>
              <h3 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-wide">
                Atención Prioritaria: {unchanneledAtRiskStudents.length} Alumnos en Riesgo Alto sin Canalización Preventiva
              </h3>
            </div>
            <p className="text-xs text-rose-700 font-medium">
              Los siguientes alumnos asignados presentan bajo promedio o asistencia crítica y requieren una acción preventiva inmediata:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {unchanneledAtRiskStudents.map(student => (
                <div
                  key={student.id}
                  className="bg-white border border-rose-200 px-3 py-2 rounded-xl flex items-center gap-3 shadow-xs"
                >
                  <div>
                    <p className="font-bold text-gray-900 text-xs">{student.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Grupo {student.group} • Prom: <strong className="text-rose-600">{student.average}</strong> • Asist: <strong className="text-rose-600">{student.attendance}%</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickChannel(student)}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                  >
                    Canalizar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            FILTROS Y BUSCADOR DE SEGUIMIENTOS
        ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* BUSCADOR */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Buscar Alumno o Motivo
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre, matrícula o palabra clave..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 pl-9 rounded-2xl text-xs font-bold text-gray-900 outline-none transition-all placeholder:text-gray-400"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">🔍</span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* FILTRO ESTATUS */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Estatus de la Acción
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none cursor-pointer"
            >
              <option value="ALL">TODOS LOS ESTATUS</option>
              <option value="IN_PROGRESS">🔵 En Seguimiento Activo</option>
              <option value="PENDING">🟡 Canalizado / Por Iniciar</option>
              <option value="COMPLETED">🟢 Atendida / Concluida</option>
            </select>
          </div>

          {/* FILTRO TIPO DE ACCIÓN PREVENTIVA */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Tipo de Acción Preventiva
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none cursor-pointer truncate"
            >
              <option value="ALL">TODAS LAS ACCIONES PREVENTIVAS</option>
              {PREVENTIVE_ACTION_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* FILTRO GRUPO */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              Grupo Tutorado
            </label>
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none cursor-pointer"
            >
              <option value="ALL">TODOS LOS GRUPOS</option>
              {availableGroups.map(grp => (
                <option key={grp} value={grp}>
                  Grupo {grp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================
          LISTADO / TABLA DE CANALIZACIONES CON SEGUIMIENTO
      ========================================================= */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-600 font-bold">
            Mostrando <strong className="text-[#003B5C] font-black">{filteredFollowUps.length}</strong> canalizaciones registradas
          </span>
          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || groupFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setGroupFilter('ALL');
              }}
              className="text-[10px] font-black text-blue-600 hover:underline uppercase"
            >
              Restablecer Filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#003B5C]/20 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
              Cargando historial de canalizaciones...
            </p>
          </div>
        ) : filteredFollowUps.length === 0 ? (
          <div className="py-20 text-center space-y-3 p-6">
            <span className="text-4xl">🛡️</span>
            <p className="font-black text-gray-700 text-sm">
              {followUps.length === 0
                ? 'Aún no has registrado canalizaciones a acciones preventivas para tus alumnos.'
                : 'No se encontraron canalizaciones con los filtros seleccionados.'}
            </p>
            {followUps.length === 0 && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#003B5C] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-900 transition-all shadow-sm"
              >
                <span>➕ Registrar Primera Canalización</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* -------------------------------------------------------------
                VISTA MÓVIL (< 768px): TARJETAS TÁCTILES DE SEGUIMIENTO
            ------------------------------------------------------------- */}
            <div className="block md:hidden divide-y divide-gray-100 print:hidden">
              {filteredFollowUps.map(record => {
                const statusMeta = STATUS_LABELS[record.estatus] || STATUS_LABELS.IN_PROGRESS;
                return (
                  <div key={record.id} className="p-4 space-y-3 hover:bg-gray-50/50 transition-colors">
                    {/* Header de la tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-900 text-sm truncate">
                          {record.student?.name || 'Estudiante'}
                        </h4>
                        <p className="font-mono text-xs text-gray-400 mt-0.5">
                          Matrícula: <span className="text-gray-700 font-bold">{record.estudiante_id}</span> • Grupo {record.student?.group}
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider shrink-0 ${statusMeta.badgeClass}`}>
                        {statusMeta.icon} {statusMeta.label}
                      </span>
                    </div>

                    {/* Tipo de Acción y Fecha */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${getActionTypeColor(record.tipo_intervencion)}`}>
                        {record.tipo_intervencion}
                      </span>
                      <span className="text-[10px] font-medium text-gray-400">
                        📅 {new Date(record.fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Descripción y Bitácora */}
                    <div className="bg-gray-50 p-3 rounded-xl space-y-1.5 text-xs">
                      <p className="font-semibold text-gray-800">
                        <strong className="text-gray-500 text-[10px] uppercase block">Motivo / Canalización:</strong>
                        {record.descripcion}
                      </p>
                      {record.notas_adicionales && (
                        <p className="text-gray-600 text-[11px] whitespace-pre-line border-t border-gray-200/60 pt-1.5 mt-1 font-mono">
                          {record.notas_adicionales}
                        </p>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateModal(record)}
                        className="flex-1 py-2.5 bg-[#003B5C] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-900 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <span>📝</span>
                        <span>Actualizar Bitácora</span>
                      </button>

                      {record.student && (
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForProfile(record.student!)}
                          className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-2xs"
                          title="Abrir expediente completo del alumno"
                        >
                          👁️ Ficha
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------------------
                VISTA ESCRITORIO (≥ 768px) & IMPRESIÓN: TABLA DE SEGUIMIENTO
            ------------------------------------------------------------- */}
            <div className="hidden md:block overflow-x-auto print:block">
              <table className="w-full text-left">
                <thead className="bg-[#003B5C] text-white text-[9px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="py-4 px-6">Estudiante & Grupo</th>
                    <th className="py-4 px-4">Acción Preventiva</th>
                    <th className="py-4 px-4 text-center">Fecha</th>
                    <th className="py-4 px-4 text-center">Estatus</th>
                    <th className="py-4 px-6">Motivo & Bitácora de Avance</th>
                    <th className="py-4 px-6 text-center print:hidden w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredFollowUps.map(record => {
                    const statusMeta = STATUS_LABELS[record.estatus] || STATUS_LABELS.IN_PROGRESS;
                    return (
                      <tr key={record.id} className="hover:bg-blue-50/20 transition-all group">
                        {/* ESTUDIANTE */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs print:hidden ${
                                record.student?.risk === RiskLevel.HIGH
                                  ? 'bg-rose-500 text-white'
                                  : record.student?.risk === RiskLevel.MEDIUM
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[#003B5C] text-[#FFD100]'
                              }`}
                            >
                              {record.student?.name?.charAt(0) || 'E'}
                            </div>
                            <div className="min-w-0">
                              <p
                                onClick={() => record.student && setSelectedStudentForProfile(record.student)}
                                className="font-bold text-gray-900 hover:text-blue-700 cursor-pointer transition-colors leading-snug"
                                title="Click para ver expediente"
                              >
                                {record.student?.name || 'Estudiante'}
                              </p>
                              <p className="font-mono text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                {record.estudiante_id} • Grupo <strong>{record.student?.group || 'N/A'}</strong>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* ACCIÓN PREVENTIVA */}
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border tracking-wider ${getActionTypeColor(record.tipo_intervencion)}`}>
                            {record.tipo_intervencion}
                          </span>
                        </td>

                        {/* FECHA */}
                        <td className="py-4 px-4 text-center font-mono text-[11px] text-gray-500 font-bold whitespace-nowrap">
                          {new Date(record.fecha).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </td>

                        {/* ESTATUS */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase border shadow-2xs ${statusMeta.badgeClass}`}>
                            <span>{statusMeta.icon}</span>
                            <span>{statusMeta.label}</span>
                          </span>
                        </td>

                        {/* MOTIVO & BITÁCORA */}
                        <td className="py-4 px-6 max-w-md">
                          <p className="font-bold text-gray-900 leading-snug text-xs line-clamp-2">
                            {record.descripcion}
                          </p>
                          {record.notas_adicionales && (
                            <p className="text-gray-500 text-[10px] font-mono line-clamp-2 mt-1 bg-gray-50 p-1.5 rounded-md border border-gray-100">
                              {record.notas_adicionales}
                            </p>
                          )}
                        </td>

                        {/* ACCIONES */}
                        <td className="py-4 px-6 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenUpdateModal(record)}
                              className="bg-[#003B5C] hover:bg-blue-900 text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-2xs active:scale-95 cursor-pointer"
                              title="Registrar nota de avance o cambiar estatus"
                            >
                              Bitácora
                            </button>

                            {record.student && (
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForProfile(record.student!)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-xl text-xs transition-all"
                                title="Ver expediente completo"
                              >
                                👁️
                              </button>
                            )}
                          </div>
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
          MODAL: NUEVA CANALIZACIÓN A ACCIÓN PREVENTIVA
      ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 animate-in zoom-in-95 space-y-6">
            
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <span className="bg-[#003B5C] text-[#FFD100] text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest">
                  Canalización • Tutorías FCQB
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-[#003B5C] tracking-tight mt-1">
                  Nueva Acción Preventiva
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Canaliza a un alumno tutorado a los departamentos de apoyo institucional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFollowUp} className="space-y-4 text-xs">
              {/* SELECTOR DE ESTUDIANTE */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Estudiante Tutorado *
                </label>
                <select
                  value={createForm.estudiante_id}
                  onChange={e => setCreateForm({ ...createForm, estudiante_id: e.target.value })}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-bold text-xs outline-none transition-all cursor-pointer"
                >
                  <option value="">-- Selecciona un alumno --</option>
                  {tutorStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.id}) • Grupo {st.group} • Riesgo: {RISK_LABELS[st.risk]}
                    </option>
                  ))}
                </select>
              </div>

              {/* TIPO DE ACCIÓN PREVENTIVA */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Tipo de Acción Preventiva *
                </label>
                <select
                  value={createForm.tipo_intervencion}
                  onChange={e => setCreateForm({ ...createForm, tipo_intervencion: e.target.value })}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-bold text-xs outline-none transition-all cursor-pointer"
                >
                  {PREVENTIVE_ACTION_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* ÁREA O DEPARTAMENTO DESTINO */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Área / Departamento Destino
                </label>
                <input
                  type="text"
                  placeholder="Ej: Centro de Asesorías FCQB, Orientación Educativa, Becas..."
                  value={createForm.area_destino}
                  onChange={e => setCreateForm({ ...createForm, area_destino: e.target.value })}
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-bold text-xs outline-none transition-all"
                />
              </div>

              {/* MOTIVO / DIAGNÓSTICO */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Motivo / Diagnóstico de Canalización *
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe la situación detectada (ej. reprobación en Química Orgánica, problemas de asistencia, necesidad de apoyo socioeconómico)..."
                  value={createForm.descripcion}
                  onChange={e => setCreateForm({ ...createForm, descripcion: e.target.value })}
                  required
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-medium text-xs outline-none transition-all"
                />
              </div>

              {/* NOTAS ADICIONALES */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Observaciones / Acuerdos Iniciales
                </label>
                <textarea
                  rows={2}
                  placeholder="Acuerdos con el estudiante, horario de atención pactado o compromisos..."
                  value={createForm.notas_adicionales}
                  onChange={e => setCreateForm({ ...createForm, notas_adicionales: e.target.value })}
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-medium text-xs outline-none transition-all"
                />
              </div>

              {/* ESTATUS INICIAL */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Estatus Inicial
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, estatus: 'IN_PROGRESS' })}
                    className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${
                      createForm.estatus === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    🔵 En Seguimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, estatus: 'PENDING' })}
                    className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border transition-all ${
                      createForm.estatus === 'PENDING'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    🟡 Canalizado / Por Iniciar
                  </button>
                </div>
              </div>

              {/* BOTONES MODAL */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-[#003B5C] hover:bg-blue-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Canalización'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: ACTUALIZAR SEGUIMIENTO Y BITÁCORA DE AVANCE
      ========================================================= */}
      {selectedFollowUpForUpdate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 animate-in zoom-in-95 space-y-6">
            
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <span className="bg-[#003B5C] text-[#FFD100] text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest">
                  Bitácora • Seguimiento de Tutoría
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-[#003B5C] tracking-tight mt-1">
                  Actualizar Seguimiento
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  {selectedFollowUpForUpdate.student?.name} ({selectedFollowUpForUpdate.estudiante_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFollowUpForUpdate(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProgressUpdate} className="space-y-4 text-xs">
              {/* RESUMEN DE LA CANALIZACIÓN */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border ${getActionTypeColor(selectedFollowUpForUpdate.tipo_intervencion)}`}>
                    {selectedFollowUpForUpdate.tipo_intervencion}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(selectedFollowUpForUpdate.fecha).toLocaleDateString('es-MX')}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-800">
                  {selectedFollowUpForUpdate.descripcion}
                </p>
              </div>

              {/* CAMBIAR ESTATUS */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Estatus Actual de la Acción Preventiva
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateStatus('IN_PROGRESS')}
                    className={`py-2 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all ${
                      updateStatus === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    🔵 En Proceso
                  </button>

                  <button
                    type="button"
                    onClick={() => setUpdateStatus('COMPLETED')}
                    className={`py-2 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all ${
                      updateStatus === 'COMPLETED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    🟢 Concluida
                  </button>

                  <button
                    type="button"
                    onClick={() => setUpdateStatus('PENDING')}
                    className={`py-2 rounded-xl font-black text-[11px] uppercase tracking-wider border transition-all ${
                      updateStatus === 'PENDING'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    🟡 Pendiente
                  </button>
                </div>
              </div>

              {/* NUEVA NOTA DE AVANCE */}
              <div className="space-y-1">
                <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">
                  Añadir Nota de Avance a la Bitácora
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe las acciones realizadas (ej. asistió a la asesoría de Bioquímica, presentó mejora en su examen, se entrevistó con la orientadora educativa)..."
                  value={newProgressNote}
                  onChange={e => setNewProgressNote(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-200 hover:border-[#003B5C] focus:border-[#003B5C] focus:bg-white p-3 rounded-2xl font-medium text-xs outline-none transition-all"
                />
              </div>

              {/* HISTORIAL PREVIO DE NOTAS */}
              {selectedFollowUpForUpdate.notas_adicionales && (
                <div className="space-y-1">
                  <label className="font-black text-gray-400 uppercase tracking-widest text-[9px]">
                    Historial Registrado en Bitácora
                  </label>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/60 max-h-36 overflow-y-auto font-mono text-[11px] text-gray-700 whitespace-pre-line leading-relaxed">
                    {selectedFollowUpForUpdate.notas_adicionales}
                  </div>
                </div>
              )}

              {/* BOTONES */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedFollowUpForUpdate(null)}
                  className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingFollowUp}
                  className="px-6 py-3 bg-[#003B5C] hover:bg-blue-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {isUpdatingFollowUp ? 'Actualizando...' : 'Guardar en Bitácora'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================
          EXPEDIENTE INTEGRAL DEL ESTUDIANTE (MODAL)
      ========================================================= */}
      {selectedStudentForProfile && (
        <StudentProfile
          student={selectedStudentForProfile}
          role={role}
          userId={userId}
          userName={userName || tutorName}
          onClose={() => setSelectedStudentForProfile(null)}
        />
      )}

    </div>
  );
};

export default TutoringFollowUpView;
