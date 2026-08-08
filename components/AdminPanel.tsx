


import React, { useState, useEffect } from 'react';
import { CAREERS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { UserRole, CicloEscolar, Subject, Student, Career } from '../types';
import StudentProfile from './StudentProfile';
import Papa from 'papaparse';
import AccentuationsModule from './AccentuationsModule';
import DatabaseBackup from './DatabaseBackup';
import { getConfig, saveConfig, clearConfig } from '../services/configService';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'ciclos' | 'subjects' | 'students' | 'assignments' | 'tutor-assignments' | 'accentuations' | 'config' | 'backups'>('users');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isEditingTutoria, setIsEditingTutoria] = useState(false);
  const [editingTutoriaId, setEditingTutoriaId] = useState<string | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<any[]>([]);
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [tutorias, setTutorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [groupsMetadata, setGroupsMetadata] = useState<{ grupo: string, carrera: string, semestre: number, turno: string }[]>([]);
  const [accentuations, setAccentuations] = useState<any[]>([]);

  // Estados de configuración de claves de API
  const [configForm, setConfigForm] = useState({ supabaseUrl: '', supabaseAnonKey: '', geminiApiKey: '' });
  const [showConfigKeys, setShowConfigKeys] = useState(false);

  // Filtros
  const [subjectFilters, setSubjectFilters] = useState({ search: '', career: 'ALL', semester: 'ALL' });
  const [assignmentFilters, setAssignmentFilters] = useState({ search: '', career: 'ALL', semester: 'ALL' });
  const [modalAssignmentFilters, setModalAssignmentFilters] = useState({ career: '', semester: 'ALL' });
  const [tutorFilters, setTutorFilters] = useState({ search: '', career: 'ALL', semester: 'ALL' });
  const [userFilters, setUserFilters] = useState({ search: '' });
  const [studentTabFilters, setStudentTabFilters] = useState({ search: '', career: 'ALL', semester: 'ALL', group: 'ALL' });

  // Formularios
  const [newCycle, setNewCycle] = useState({ nombre: '', fecha_inicio: '', fecha_fin: '' });
  const [newUser, setNewUser] = useState({ numero_empleado: '', nombre: '', email: '', password: '', rol: [UserRole.DOCENTE] as UserRole[] });
  const [newGroup, setNewGroup] = useState({ nombre_grupo: '', materia_id: '', docente_id: '', turno: 'Matutino', ciclo_id: '' });
  const [newTutoria, setNewTutoria] = useState({ nombre_grupo: '', tutor_id: '', ciclo_id: '' });
  const [newSubject, setNewSubject] = useState<{
    codigo: string;
    nombre: string;
    carrera: Career;
    semestre: number;
    creditos: number;
  }>({ codigo: '', nombre: '', carrera: Career.QFB, semestre: 1, creditos: 5 });

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    matricula: '',
    nombre: '',
    carrera: Career.QFB,
    semestre: 1,
    grupo: '',
    turno: 'Matutino'
  });

  const [searchingMatricula, setSearchingMatricula] = useState(false);
  const [foundExistingStudent, setFoundExistingStudent] = useState<any | null>(null);

  const handleSearchMatricula = async (matriculaToSearch: string) => {
    const cleanId = matriculaToSearch.trim();
    if (!cleanId || isEditingStudent) return;

    setSearchingMatricula(true);
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        setFoundExistingStudent(data);
        const nextSemester = data.semestre < 10 ? data.semestre + 1 : 10;
        setNewStudent(prev => ({
          ...prev,
          matricula: data.id,
          nombre: data.nombre,
          carrera: data.carrera as Career,
          semestre: nextSemester,
          turno: data.turno || 'Matutino'
        }));
      } else {
        setFoundExistingStudent(null);
      }
    } catch (err) {
      console.error("Error al buscar estudiante por matrícula:", err);
      setFoundExistingStudent(null);
    } finally {
      setSearchingMatricula(false);
    }
  };

  // New State for Student Assignment
  const [tutorModalFilters, setTutorModalFilters] = useState({ career: '', semester: '', group: '' });
  const [modalStudents, setModalStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assignedStudents, setAssignedStudents] = useState<Set<string>>(new Set()); // New state for validation
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Normalización exhaustiva para evitar errores de tipo unknown al filtrar datos de Supabase
  const normalizeText = (text: any): string => {
    if (!text) return '';
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const fetchData = async () => {
    setLoading(true);
    try {
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      const [tRes, cRes, sRes, accRes] = await Promise.all([
        supabase.from('docentes').select('*').order('nombre'),
        supabase.from('ciclos_escolares').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('materias').select('*').order('nombre'),
        supabase.from('acentuaciones').select('*')
      ]);

      setTeachers(tRes.data || []);
      setCycles(cRes.data || []);
      setSubjects(sRes.data || []);
      setAccentuations(accRes.data || []);

      // Paginación para Grupos
      let allGroups: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('grupos')
          .select('*, materias(*), docentes(*), ciclos_escolares(*)')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allGroups = [...allGroups, ...data];
          if (data.length < pageSize) hasMore = false;
          page++;
        }
      }
      setGroups(allGroups);

      // Paginación para Tutorías
      let allTutorias: any[] = [];
      page = 0;
      hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('tutorias')
          .select('*, docentes(*), estudiantes(*), ciclos_escolares(*)')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allTutorias = [...allTutorias, ...data];
          if (data.length < pageSize) hasMore = false;
          page++;
        }
      }
      setTutorias(allTutorias);


      const active = cRes.data?.find(c => c.es_activo) || cRes.data?.[0];
      if (active) {
        setActiveCycleId(active.id);
        setSelectedCycleId(prev => prev || active.id);
        setNewGroup(p => ({ ...p, ciclo_id: p.ciclo_id || active.id }));
        setNewTutoria(p => ({ ...p, ciclo_id: p.ciclo_id || active.id }));
      }

      // CORRECCIÓN PARA MATRÍCULAS GRANDES: Paginación para obtener TODOS los grupos
      let allStudentMeta: any[] = [];
      hasMore = true;
      page = 0;

      while (hasMore) {
        const { data: mData, error: mError } = await supabase
          .from('estudiantes')
          .select('grupo, carrera, semestre, turno')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (mError || !mData || mData.length === 0) {
          hasMore = false;
        } else {
          allStudentMeta = [...allStudentMeta, ...mData];
          if (mData.length < pageSize) hasMore = false;
          page++;
        }
      }

      if (allStudentMeta.length > 0) {
        const unique = allStudentMeta.reduce((acc: any[], curr) => {
          const gName = curr.grupo?.toString().trim();
          const gCareer = curr.carrera?.toString().trim();
          const gSem = parseInt(curr.semestre);

          const alreadyExists = acc.find(x =>
            normalizeText(x.grupo) === normalizeText(gName) &&
            normalizeText(x.carrera) === normalizeText(gCareer) &&
            x.semestre === gSem
          );

          if (!alreadyExists && gName && gCareer) {
            acc.push({ ...curr, grupo: gName, semestre: gSem }); // Keep turnover
          }
          return acc;
        }, []);
        setGroupsMetadata(unique);
      }

      // Estudiantes para la tabla principal (Paginación para obtener TODOS los estudiantes)
      let allStudents: any[] = [];
      hasMore = true;
      page = 0;

      while (hasMore) {
        const { data: stChunk, error: stError } = await supabase
          .from('estudiantes')
          .select('*')
          .order('nombre')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (stError || !stChunk || stChunk.length === 0) {
          hasMore = false;
        } else {
          allStudents = [...allStudents, ...stChunk];
          if (stChunk.length < pageSize) hasMore = false;
          page++;
        }
      }

      setStudents(allStudents.map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as Career, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as any,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || [], ciclo_id: s.ciclo_id
      })));

    } catch (err) { console.error("Error crítico en fetchData:", err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'config') {
      const current = getConfig();
      setConfigForm(current);
    } else {
      fetchData();
    }
  }, [activeTab]);

  const downloadCsvTemplate = () => {
    const headers = ['matricula', 'nombre', 'carrera', 'semestre', 'grupo', 'turno'];
    const sampleData = [
      ['21234567', 'JUAN PEREZ GARCIA', 'Químico Farmacéutico Biólogo', '4', '2-01', 'Matutino'],
      ['21876543', 'MARIA LOPEZ DIAZ', 'Ingeniería Bioquímica', '6', '3-02', 'Vespertino']
    ];
    const csvContent = [headers, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_STA_FCQB.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        try {
          if (results.data.length === 0) throw new Error("El archivo no contiene datos.");
          let cycle = activeCycleId;
          if (!cycle) {
            const { data: active } = await supabase.from('ciclos_escolares').select('id').eq('es_activo', true).maybeSingle();
            if (!active) throw new Error("No hay un Ciclo Escolar activo.");
            cycle = active.id;
          }

          const formatted = results.data.map((row: any) => {
            const findKey = (aliases: string[]) => {
              const keys = Object.keys(row);
              return keys.find(k => {
                const normalized = normalizeText(k);
                return aliases.some(a => normalized === normalizeText(a));
              });
            };

            const kId = findKey(['matricula', 'id', 'nocontrol', 'no control', 'control']);
            const kNombre = findKey(['nombre', 'alumno', 'estudiante', 'nombre completo']);
            const kCarrera = findKey(['carrera', 'programa', 'licenciatura']);
            const kSemestre = findKey(['semestre', 'grado', 'nivel']);
            const kGrupo = findKey(['grupo', 'seccion']);
            const kTurno = findKey(['turno', 'horario']);

            if (!kId || !kNombre) return null;

            return {
              id: String(row[kId]).trim(),
              nombre: String(row[kNombre]).trim().toUpperCase(),
              carrera: String(row[kCarrera] || 'Sin Carrera').trim(),
              semestre: parseInt(row[kSemestre]) || 1,
              grupo: String(row[kGrupo] || '1-1').trim(),
              turno: String(row[kTurno] || 'Matutino').trim(),
              ciclo_id: cycle,
              nivel_riesgo: 'LOW'
            };
          }).filter(x => x !== null);

          const { error } = await supabase.from('estudiantes').upsert(formatted, { onConflict: 'id' });
          if (error) throw error;

          if (cycle) {
            const historyRecords = formatted.map(s => ({
              estudiante_id: s.id,
              ciclo_id: cycle,
              grupo: s.grupo,
              carrera: s.carrera,
              semestre: s.semestre,
              turno: s.turno,
              promedio_acumulado: 0,
              porcentaje_asistencia: 100,
              nivel_riesgo: 'LOW'
            }));
            await supabase.from('historial_estudiantes_ciclo').upsert(historyRecords, { onConflict: 'estudiante_id,ciclo_id' });
          }

          alert(`✅ Se han sincronizado ${formatted.length} estudiantes en el periodo escolar.`);
          setShowCsvModal(false);
          fetchData();
        } catch (err: any) {
          alert("❌ Error: " + err.message);
        } finally {
          setIsSaving(false);
          if (e.target) e.target.value = '';
        }
      }
    });
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {

      let finalMateriaId = newGroup.materia_id;

      // Special logic for Accentuation virtual subjects
      if (finalMateriaId.startsWith('ACC:')) {
        // It's a virtual subject ID, we need to resolve it to a real UUID
        const accName = modalFilteredSubjects.find(s => s.id === finalMateriaId)?.nombre;

        // 1. Check if a subject with this name already exists for this career
        const { data: existingSub } = await supabase
          .from('materias')
          .select('id')
          .eq('nombre', accName)
          .eq('carrera', modalAssignmentFilters.career) // Use filter state as context, or newGroup if available
          .maybeSingle(); // Use maybeSingle to avoid error if not found

        if (existingSub) {
          finalMateriaId = existingSub.id;
        } else {
          // 2. If not, create it on the fly
          const { data: newSub, error } = await supabase.from('materias').insert({
            codigo: 'OPT-ACENT', // Generic code for internal tracking
            nombre: accName,
            carrera: modalAssignmentFilters.career, // Context career
            semestre: 8,
            creditos: 10 // Standard credits
          }).select().single();

          if (error) throw error;
          finalMateriaId = newSub.id;
        }
      }

      const targetCycleId = newGroup.ciclo_id || activeCycleId;
      const groupPayload = { ...newGroup, materia_id: finalMateriaId, ciclo_id: targetCycleId };

      if (isEditingGroup && editingGroupId) {
        await supabase.from('grupos').update(groupPayload).eq('id', editingGroupId);
      } else {
        await supabase.from('grupos').insert([groupPayload]);
      }
      setShowGroupModal(false);
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditingSubject && editingSubjectId) await supabase.from('materias').update(newSubject).eq('id', editingSubjectId);
      else await supabase.from('materias').insert([newSubject]);
      setShowSubjectModal(false);
      fetchData();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  // Fetch students for modal when filters change
  useEffect(() => {
    if (!showTutorModal) return;
    const fetchModalStudents = async () => {
      setLoadingStudents(true);
      try {
        let query = supabase.from('estudiantes').select('*').order('nombre');

        if (tutorModalFilters.career && tutorModalFilters.career !== 'ALL') {
          query = query.eq('carrera', tutorModalFilters.career);
        }
        if (tutorModalFilters.semester && tutorModalFilters.semester !== 'ALL') {
          query = query.eq('semestre', parseInt(tutorModalFilters.semester));
        }
        if (tutorModalFilters.group && tutorModalFilters.group !== 'ALL') {
          query = query.eq('grupo', tutorModalFilters.group);
        }

        // Limit to avoid UI lag, but user wants to see them
        const { data } = await query.limit(500);

        // Fetch existing assignments for the current active cycle (or the one being used)
        const cycleToCheck = activeCycleId;
        const { data: existingAssignments } = await supabase
          .from('tutorias')
          .select('estudiante_id')
          .eq('ciclo_id', cycleToCheck);

        const assignedSet = new Set(existingAssignments?.map((a: any) => a.estudiante_id) || []);
        setAssignedStudents(assignedSet);

        if (data) {
          setModalStudents(data.map(s => ({
            id: s.id, name: s.nombre, career: s.carrera as Career, semester: s.semestre,
            group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
            attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as any,
            personalFactors: [], academicFactors: [], institutionalFactors: []
          })));
        }
      } catch (err) { console.error(err); } finally { setLoadingStudents(false); }
    };
    fetchModalStudents();
  }, [tutorModalFilters, showTutorModal, activeCycleId]); // Added activeCycleId dependency

  const handleSaveTutoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditingTutoria && editingTutoriaId) {
        // Edit mode (single assignment or group update) - Keep legacy behavior roughly or just update tutor
        // If editing a group assignment, we let them change tutor.
        // If editing an individual assignment, we let them change tutor.
        await supabase.from('tutorias').update({ tutor_id: newTutoria.tutor_id }).eq('id', editingTutoriaId);
      } else {
        // Create Mode: Assign to Selected Students
        if (selectedStudentIds.size === 0) throw new Error("Debes seleccionar al menos un estudiante.");

        // Validation against double assignment
        const doubleAssignments = Array.from(selectedStudentIds).filter(id => assignedStudents.has(id));
        if (doubleAssignments.length > 0) {
          throw new Error(`Hay ${doubleAssignments.length} estudiantes seleccionados que ya tienen tutor asignado. Desmárcalos para continuar.`);
        }

        const assignments = Array.from(selectedStudentIds).map(studentId => ({
          tutor_id: newTutoria.tutor_id,
          estudiante_id: studentId,
          ciclo_id: activeCycleId || newTutoria.ciclo_id
        }));

        const { error } = await supabase.from('tutorias').insert(assignments);
        if (error) throw error;
      }
      setShowTutorModal(false);
      setSelectedStudentIds(new Set());
      setTutorModalFilters({ career: '', semester: '', group: '' });
      fetchData();
      alert("✅ Asignación de tutores completada.");
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cycleToAssign = selectedCycleId || activeCycleId;
      const targetId = (isEditingStudent && editingStudentId ? editingStudentId : newStudent.matricula).trim();

      if (!targetId) throw new Error("Debes proporcionar una matrícula válida.");

      if (isEditingStudent || foundExistingStudent) {
        // Alumno existente: Actualizar datos y reinscribir en el ciclo nuevo sin incrementar la matrícula total
        const { error } = await supabase.from('estudiantes').update({
          nombre: newStudent.nombre,
          carrera: newStudent.carrera,
          semestre: newStudent.semestre,
          grupo: newStudent.grupo,
          turno: newStudent.turno,
          ciclo_id: cycleToAssign
        }).eq('id', targetId);

        if (error) throw error;
      } else {
        // Verificar en DB si el estudiante ya existía previamente
        const { data: dbExisting } = await supabase.from('estudiantes').select('id').eq('id', targetId).maybeSingle();

        if (dbExisting) {
          // El alumno ya existe en DB: Actualizarlo sin duplicar matrícula
          const { error } = await supabase.from('estudiantes').update({
            nombre: newStudent.nombre,
            carrera: newStudent.carrera,
            semestre: newStudent.semestre,
            grupo: newStudent.grupo,
            turno: newStudent.turno,
            ciclo_id: cycleToAssign
          }).eq('id', targetId);

          if (error) throw error;
        } else {
          // Alumno verdaderamente nuevo: Registrar en DB (se incrementa la matrícula total)
          const { error } = await supabase.from('estudiantes').insert([{
            id: targetId,
            nombre: newStudent.nombre,
            carrera: newStudent.carrera,
            semestre: newStudent.semestre,
            grupo: newStudent.grupo,
            turno: newStudent.turno,
            ciclo_id: cycleToAssign,
            promedio_acumulado: 0,
            porcentaje_asistencia: 100,
            nivel_riesgo: 'LOW'
          }]);

          if (error) throw error;
        }
      }

      if (cycleToAssign && targetId) {
        await supabase.from('historial_estudiantes_ciclo').upsert([{
          estudiante_id: targetId,
          ciclo_id: cycleToAssign,
          grupo: newStudent.grupo,
          carrera: newStudent.carrera,
          semestre: newStudent.semestre,
          turno: newStudent.turno,
          promedio_acumulado: 0,
          porcentaje_asistencia: 100,
          nivel_riesgo: 'LOW'
        }], { onConflict: 'estudiante_id,ciclo_id' });
      }

      setShowStudentModal(false);
      setNewStudent({ matricula: '', nombre: '', carrera: Career.QFB, semestre: 1, grupo: '', turno: 'Matutino' });
      setFoundExistingStudent(null);
      setIsEditingStudent(false);
      setEditingStudentId(null);
      fetchData();
      alert(foundExistingStudent ? "✅ Estudiante existente reinscrito al periodo sin duplicar matrícula." : "✅ Estudiante registrado en la matrícula.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm.supabaseUrl.trim().startsWith('http://') && !configForm.supabaseUrl.trim().startsWith('https://')) {
      alert('La URL de Supabase debe comenzar con http:// o https://');
      return;
    }
    if (!configForm.supabaseAnonKey.trim()) {
      alert('La Anon Key de Supabase es obligatoria.');
      return;
    }
    try {
      saveConfig(configForm.supabaseUrl, configForm.supabaseAnonKey, configForm.geminiApiKey);
      alert('✅ Configuración guardada correctamente. La página se recargará para reiniciar la conexión.');
      window.location.reload();
    } catch (err: any) {
      alert('Error al guardar la configuración: ' + err.message);
    }
  };

  const handleClearConfig = () => {
    if (confirm('¿Estás seguro de restablecer las claves? Se eliminarán los valores guardados localmente.')) {
      clearConfig();
      alert('✅ Configuración eliminada. La página se recargará.');
      window.location.reload();
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este estudiante? Se borrarán todos sus datos y asignaciones.")) return;
    try {
      const { error } = await supabase.from('estudiantes').delete().eq('id', id);
      if (error) throw error;
      fetchData();
      alert("🗑️ Estudiante eliminado.");
    } catch (err: any) {
      alert("Error al eliminar: " + err.message);
    }
  };

  const handleDeleteTutoria = async (id: string) => {
    if (!confirm("¿Desea eliminar esta tutoría?")) return;
    await supabase.from('tutorias').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta asignación?")) return;
    try {
      const { error } = await supabase.from('grupos').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert("Error al borrar asignación: " + err.message);
    }
  };

  const handleSetActiveCycle = async (id: string) => {
    setIsSaving(true);
    try {
      await supabase.from('ciclos_escolares').update({ es_activo: false }).neq('id', id);
      await supabase.from('ciclos_escolares').update({ es_activo: true }).eq('id', id);
      window.dispatchEvent(new CustomEvent('sta-cycle-updated'));
      fetchData();
      alert("Ciclo escolar actualizado como activo.");
    } catch (err: any) {
      alert("Error al cambiar ciclo activo: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSubjects = subjects.filter(s => {
    // Adding explicit string casting to avoid unknown type errors from Supabase responses
    const sMatch = !subjectFilters.search ||
      normalizeText(s.nombre).includes(normalizeText(subjectFilters.search)) ||
      normalizeText(s.codigo).includes(normalizeText(subjectFilters.search));
    const cMatch = subjectFilters.career === 'ALL' || normalizeText(s.carrera) === normalizeText(subjectFilters.career);
    const semMatch = subjectFilters.semester === 'ALL' || s.semestre === parseInt(subjectFilters.semester);
    return sMatch && cMatch && semMatch;
  });

  const availableSemestersForSubjects = Array.from(new Set(
    subjects
      .filter(s => subjectFilters.career === 'ALL' || normalizeText(s.carrera) === normalizeText(subjectFilters.career))
      .map(s => s.semestre)
  )).sort((a: any, b: any) => a - b);

  const availableCareersForSubjects = Array.from(new Set(
    subjects
      .filter(s => subjectFilters.semester === 'ALL' || s.semestre === parseInt(subjectFilters.semester))
      .map(s => s.carrera)
  )).sort();

  const filteredGroups = groups.filter(g => {
    if (selectedCycleId) {
      if (g.ciclo_id && g.ciclo_id !== selectedCycleId) return false;
      if (!g.ciclo_id && activeCycleId && selectedCycleId !== activeCycleId) return false;
    }
    const mat = getRelation(g.materias);
    const doc = getRelation(g.docentes);

    // Explicitly casting mat and doc properties to string to avoid unknown type errors in normalizeText.
    const searchMatch = !assignmentFilters.search ||
      normalizeText(mat?.nombre).includes(normalizeText(assignmentFilters.search)) ||
      normalizeText(doc?.nombre).includes(normalizeText(assignmentFilters.search));
    const cMatch = assignmentFilters.career === 'ALL' || normalizeText(mat?.carrera).includes(normalizeText(assignmentFilters.career));
    const semMatch = assignmentFilters.semester === 'ALL' || mat?.semestre === parseInt(assignmentFilters.semester);

    return searchMatch && cMatch && semMatch;
  });

  const filteredTutorias = tutorias.filter((t: any) => {
    if (selectedCycleId) {
      if (t.ciclo_id && t.ciclo_id !== selectedCycleId) return false;
      if (!t.ciclo_id && activeCycleId && selectedCycleId !== activeCycleId) return false;
    }
    const tutorName: string = String(getRelation(t.docentes)?.nombre || '');
    // Handle both new Student relation and legacy Group name
    const studentRel = getRelation(t.estudiantes);
    const assignedName: string = studentRel ? studentRel.nombre : String(t.nombre_grupo || 'Grupo Completo');

    // For filters, if it's a student, use their data. If group, use metadata.
    let car = '', sem = 0;
    if (studentRel) {
      car = studentRel.carrera;
      sem = studentRel.semestre;
    } else {
      const groupMeta = groupsMetadata.find(gm => String(gm.grupo) === String(t.nombre_grupo));
      car = groupMeta?.carrera || '';
      sem = groupMeta?.semestre || 0;
    }

    const searchTerm: string = String(tutorFilters.search || '');
    const searchMatch = !searchTerm ||
      normalizeText(tutorName).includes(normalizeText(searchTerm)) ||
      normalizeText(assignedName).includes(normalizeText(searchTerm));

    const careerMatch = tutorFilters.career === 'ALL' || normalizeText(car).includes(normalizeText(tutorFilters.career));
    const semesterMatch = tutorFilters.semester === 'ALL' || sem === parseInt(String(tutorFilters.semester));

    return searchMatch && careerMatch && semesterMatch;
  });

  // Fix for line 524: Use explicit string casting for t properties to satisfy normalizeText(text: string)
  const filteredTeachers = teachers.filter((t: any) => {
    const searchStr = String(userFilters.search || '');
    if (!searchStr) return true;

    return normalizeText(t.nombre).includes(normalizeText(searchStr)) ||
      normalizeText(t.email).includes(normalizeText(searchStr)) ||
      normalizeText(t.numero_empleado).includes(normalizeText(searchStr));
  });

  const availableGroupsForStudentsTab = Array.from(new Set(
    groupsMetadata
      .filter(gm =>
        (studentTabFilters.career === 'ALL' || normalizeText(gm.carrera) === normalizeText(studentTabFilters.career)) &&
        (studentTabFilters.semester === 'ALL' || gm.semestre === parseInt(studentTabFilters.semester))
      )
      .map(gm => gm.grupo)
  )).sort();

  const filteredStudentsTab = students.filter(s => {
    if (selectedCycleId) {
      if (s.ciclo_id && s.ciclo_id !== selectedCycleId) return false;
      if (!s.ciclo_id && activeCycleId && selectedCycleId !== activeCycleId) return false;
    }
    const searchMatch = !studentTabFilters.search ||
      normalizeText(s.name).includes(normalizeText(studentTabFilters.search)) ||
      normalizeText(s.id).includes(normalizeText(studentTabFilters.search));
    const careerMatch = studentTabFilters.career === 'ALL' || normalizeText(s.career).includes(normalizeText(studentTabFilters.career));
    const semesterMatch = studentTabFilters.semester === 'ALL' || s.semester === parseInt(studentTabFilters.semester);
    const groupMatch = studentTabFilters.group === 'ALL' || normalizeText(s.group) === normalizeText(studentTabFilters.group);
    return searchMatch && careerMatch && semesterMatch && groupMatch;
  });

  const modalFilteredExistingGroups = (() => {
    // 1. Base Groups from Metadata (Standard groups)
    const base = groupsMetadata.filter(gm => {
      const careerToMatch = modalAssignmentFilters.career;
      const semesterToMatch = modalAssignmentFilters.semester;
      const cMatch = !careerToMatch || normalizeText(gm.carrera) === normalizeText(careerToMatch);
      const semMatch = semesterToMatch === 'ALL' || gm.semestre === parseInt(semesterToMatch);
      return cMatch && semMatch;
    });

    // 2. If 8th Semester, inject Accentuations as virtual groups (SUB-...)
    if (modalAssignmentFilters.semester === '8' && modalAssignmentFilters.career) {
      const careerAccentuations = accentuations
        .filter((a: any) => normalizeText(a.carrera) === normalizeText(modalAssignmentFilters.career))
        .map((a: any) => ({
          grupo: `SUB - ${a.nombre}`,
          carrera: a.carrera,
          semestre: 8,
          turno: 'Variable'
        }));
      return [...base, ...careerAccentuations];
    }
    return base;
  })();

  const modalFilteredSubjects = (() => {
    // 1. Base Subjects
    const filtered = subjects.filter(s => {
      const cMatch = !modalAssignmentFilters.career || normalizeText(s.carrera) === normalizeText(modalAssignmentFilters.career);
      const semMatch = modalAssignmentFilters.semester === 'ALL' || s.semestre === parseInt(modalAssignmentFilters.semester);
      return cMatch && semMatch;
    });

    // 2. If 8th Semester, inject Accentuations as virtual Subjects
    if (modalAssignmentFilters.semester === '8' && modalAssignmentFilters.career) {
      const asSubjects = accentuations
        .filter((a: any) => normalizeText(a.carrera) === normalizeText(modalAssignmentFilters.career))
        .map((a: any) => ({
          id: `ACC:${a.id}`, // Custom prefix ID
          codigo: a.tipo_optativa,
          nombre: a.nombre,
          carrera: a.carrera,
          semestre: 8,
          creditos: 10
        } as Subject));
      return [...filtered, ...asSubjects];
    }
    return filtered;
  })();


  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-10 bg-[#003B5C] text-white flex flex-col md:flex-row justify-between items-center gap-6 relative">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">Administración STA</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-blue-100 opacity-80 font-medium text-sm uppercase tracking-widest">Gestión Centralizada FCQB</span>
              {cycles.length > 0 && (
                <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/20">
                  <span className="text-[#FFD100] text-xs font-black uppercase tracking-wider">📅 Periodo:</span>
                  <select
                    value={selectedCycleId || ''}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedCycleId(cId);
                      setNewGroup(p => ({ ...p, ciclo_id: cId }));
                      setNewTutoria(p => ({ ...p, ciclo_id: cId }));
                    }}
                    className="bg-white text-[#003B5C] font-black text-xs px-3 py-1 rounded-lg outline-none cursor-pointer shadow-md"
                  >
                    {cycles.map(c => (
                      <option key={c.id} value={c.id} className="text-gray-900 font-bold">
                        {c.nombre} {c.es_activo ? '(Activo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {activeTab === 'users' && <button onClick={() => { setIsEditingUser(false); setNewUser({ numero_empleado: '', nombre: '', email: '', password: '', rol: [UserRole.DOCENTE] }); setShowUserModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Personal</button>}
            {activeTab === 'ciclos' && <button onClick={() => setShowCycleModal(true)} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Ciclo</button>}
            {activeTab === 'subjects' && <button onClick={() => { setIsEditingSubject(false); setNewSubject({ codigo: '', nombre: '', carrera: Career.QFB, semestre: 1, creditos: 5 }); setShowSubjectModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Materia</button>}
            {activeTab === 'assignments' && <button onClick={() => { setIsEditingGroup(false); setNewGroup({ nombre_grupo: '', materia_id: '', docente_id: '', turno: 'Matutino', ciclo_id: activeCycleId || '' }); setShowGroupModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Asignación</button>}
            {activeTab === 'tutor-assignments' && <button onClick={() => { setIsEditingTutoria(false); setNewTutoria({ nombre_grupo: '', tutor_id: '', ciclo_id: activeCycleId || '' }); setShowTutorModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Asignar Tutor</button>}
            {activeTab === 'students' && (
              <div className="flex gap-2">
                <button onClick={downloadCsvTemplate} className="bg-white/10 text-white border border-white/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">📄 Bajar Formato</button>
                <button onClick={() => { setIsEditingStudent(false); setNewStudent({ matricula: '', nombre: '', carrera: Career.QFB, semestre: 1, grupo: '', turno: 'Matutino' }); setShowStudentModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Estudiante</button>
                <button onClick={() => setShowCsvModal(true)} className="bg-white text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">📂 Cargar CSV</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50/30 overflow-x-auto scrollbar-hide">
          {[
            { id: 'users', label: 'Personal' },
            { id: 'ciclos', label: 'Ciclos' },
            { id: 'subjects', label: 'Materias' },
            { id: 'assignments', label: 'Carga Docente' },
            { id: 'tutor-assignments', label: 'Tutorías' },
            { id: 'students', label: 'Matrícula' },
            { id: 'accentuations', label: 'Acentuaciones' },
            { id: 'config', label: 'Configuración API' },
            { id: 'backups', label: 'Respaldos DB' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-10 py-6 text-[11px] font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-[#003B5C] border-[#FFD100] bg-white' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-10">
          {loading ? (
            <div className="py-32 text-center animate-pulse">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compilando Metadata FCQB... ({groupsMetadata.length} grupos detectados)</span>
            </div>
          ) : (
            <>
              {activeTab === 'users' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex items-center gap-4">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Buscar personal por nombre o correo..."
                        className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                        value={userFilters.search}
                        onChange={e => setUserFilters({ ...userFilters, search: e.target.value })}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-10 py-5">Docente</th><th className="px-10 py-5">Email</th><th className="px-10 py-5">Roles</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTeachers.length === 0 ? (
                          <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No se encontró personal con los criterios de búsqueda</td></tr>
                        ) : filteredTeachers.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 text-[12px] group transition-all">
                            <td className="px-10 py-5 font-bold text-gray-900">{t.nombre}</td>
                            <td className="px-10 py-5 text-gray-600">{t.email}</td>
                            <td className="px-10 py-5">
                              <div className="flex gap-1">{(Array.isArray(t.rol) ? t.rol : [t.rol]).map((r: any) => <span key={r} className="px-3 py-1 bg-blue-50 text-blue-700 text-[8px] font-black uppercase rounded-lg border border-blue-100 tracking-widest">{r}</span>)}</div>
                            </td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingUserId(t.id); setIsEditingUser(true); setNewUser({ numero_empleado: t.numero_empleado, nombre: t.nombre, email: t.email, password: t.password, rol: Array.isArray(t.rol) ? t.rol : [t.rol] }); setShowUserModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => { if (confirm("¿Borrar usuario?")) supabase.from('docentes').delete().eq('id', t.id).then(() => fetchData()) }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'subjects' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                        value={subjectFilters.search}
                        onChange={e => setSubjectFilters({ ...subjectFilters, search: e.target.value })}
                      />
                    </div>
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={subjectFilters.career}
                      onChange={e => {
                        const newCareer = e.target.value;
                        const possibleSemesters = Array.from(new Set(subjects.filter(s => newCareer === 'ALL' || normalizeText(s.carrera) === normalizeText(newCareer)).map(s => s.semestre)));
                        let newSemester = subjectFilters.semester;
                        if (newSemester !== 'ALL' && !possibleSemesters.includes(parseInt(newSemester))) {
                          newSemester = 'ALL';
                        }
                        setSubjectFilters({ ...subjectFilters, career: newCareer, semester: newSemester });
                      }}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => {
                        const hasSubjects = availableCareersForSubjects.some(ac => normalizeText(ac) === normalizeText(c));
                        return <option key={c} value={c} className={!hasSubjects && subjectFilters.semester !== 'ALL' ? 'text-gray-300' : ''}>{c}</option>;
                      })}
                    </select>
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={subjectFilters.semester}
                      onChange={e => setSubjectFilters({ ...subjectFilters, semester: e.target.value })}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                        const isAvailable = availableSemestersForSubjects.includes(s);
                        return (
                          <option
                            key={s}
                            value={s}
                            disabled={!isAvailable && subjectFilters.career !== 'ALL'}
                            className={!isAvailable ? 'text-gray-300' : ''}
                          >
                            {s}° Semestre {!isAvailable && subjectFilters.career !== 'ALL' ? '(Sin materias)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-8 py-5">Código</th><th className="px-8 py-5">Materia</th><th className="px-8 py-5">Programa</th><th className="px-8 py-5 text-center">Créditos</th><th className="px-8 py-5 text-right">Acción</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredSubjects.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No se encontraron materias con los filtros aplicados</td></tr>
                        ) : filteredSubjects.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 text-[12px] group transition-all">
                            <td className="px-8 py-5 font-mono font-black text-blue-600">{s.codigo}</td>
                            <td className="px-8 py-5 font-bold">{s.nombre}</td>
                            <td className="px-8 py-5 text-[10px] font-black uppercase text-gray-400">{s.carrera} • {s.semestre}°</td>
                            <td className="px-8 py-5 text-center font-black text-[#003B5C]">{s.creditos}</td>
                            <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingSubjectId(s.id); setIsEditingSubject(true); setNewSubject({ codigo: s.codigo, nombre: s.nombre, carrera: s.carrera, semestre: s.semestre, creditos: s.creditos }); setShowSubjectModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => { if (confirm("¿Borrar materia?")) supabase.from('materias').delete().eq('id', s.id).then(() => fetchData()) }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'tutor-assignments' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Buscar tutor o grupo..."
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none"
                      value={tutorFilters.search}
                      onChange={e => setTutorFilters({ ...tutorFilters, search: e.target.value })}
                    />
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={tutorFilters.career}
                      onChange={e => setTutorFilters({ ...tutorFilters, career: e.target.value })}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={tutorFilters.semester}
                      onChange={e => setTutorFilters({ ...tutorFilters, semester: e.target.value })}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-10 py-5">Tutor</th><th className="px-10 py-5">Estudiante / Grupo</th><th className="px-10 py-5">Programa</th><th className="px-10 py-5">Ciclo</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTutorias.length === 0 ? (
                          <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin tutores asignados con los filtros aplicados</td></tr>
                        ) : filteredTutorias.map(t => (
                          <tr key={t.id} className="hover:bg-blue-50/20 text-[12px] group transition-all">
                            <td className="px-10 py-5 font-bold text-gray-900">{getRelation(t.docentes)?.nombre}</td>
                            <td className="px-10 py-5">
                              {getRelation(t.estudiantes) ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900">{getRelation(t.estudiantes).nombre}</span>
                                  <span className="text-[9px] text-gray-400 font-mono">{t.estudiantes.grupo}</span>
                                </div>
                              ) : (
                                <p className="font-mono text-blue-600 font-black">{t.nombre_grupo} (Grupo)</p>
                              )}
                            </td>
                            <td className="px-10 py-5">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                {getRelation(t.estudiantes) ?
                                  `${getRelation(t.estudiantes).carrera} • ${getRelation(t.estudiantes).semestre}°`
                                  :
                                  (groupsMetadata.find(gm => gm.grupo === t.nombre_grupo) ? `${groupsMetadata.find(gm => gm.grupo === t.nombre_grupo)?.carrera} • ${groupsMetadata.find(gm => gm.grupo === t.nombre_grupo)?.semestre}°` : '---')
                                }
                              </p>
                            </td>
                            <td className="px-10 py-5">
                              <span className="px-3 py-1 bg-blue-50 text-[#003B5C] font-black text-[10px] uppercase rounded-lg border border-blue-100 shadow-sm tracking-wider inline-block whitespace-nowrap">
                                {getRelation(t.ciclos_escolares)?.nombre || cycles.find(c => c.id === t.ciclo_id)?.nombre || (t.ciclo_id ? t.ciclo_id : (cycles.find(c => c.es_activo)?.nombre || '2025-2026-2'))}
                              </span>
                            </td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingTutoriaId(t.id); setIsEditingTutoria(true); setNewTutoria({ nombre_grupo: t.nombre_grupo, tutor_id: t.tutor_id, ciclo_id: t.ciclo_id }); setShowTutorModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => handleDeleteTutoria(t.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'assignments' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Buscar por materia o docente..."
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={assignmentFilters.search}
                      onChange={e => setAssignmentFilters({ ...assignmentFilters, search: e.target.value })}
                    />
                    <select className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black" value={assignmentFilters.career} onChange={e => setAssignmentFilters({ ...assignmentFilters, career: e.target.value })}>
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black" value={assignmentFilters.semester} onChange={e => setAssignmentFilters({ ...assignmentFilters, semester: e.target.value })}>
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-10 py-5">Materia</th><th className="px-10 py-5">Docente</th><th className="px-10 py-5">Grupo</th><th className="px-10 py-5">Ciclo</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGroups.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin asignaciones registradas con los filtros aplicados</td></tr>
                        ) : filteredGroups.map(g => (
                          <tr key={g.id} className="hover:bg-blue-50/20 text-[12px] group transition-all">
                            <td className="px-10 py-5">
                              <p className="font-bold text-gray-900">{getRelation(g.materias)?.nombre}</p>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{getRelation(g.materias)?.carrera}</p>
                            </td>
                            <td className="px-10 py-5 text-blue-700 font-black">{getRelation(g.docentes)?.nombre}</td>
                            <td className="px-10 py-5 font-mono text-[#003B5C] font-black bg-blue-50/30 text-center rounded-lg">{g.nombre_grupo}</td>
                            <td className="px-10 py-5">
                              <span className="px-3 py-1 bg-blue-50 text-[#003B5C] font-black text-[10px] uppercase rounded-lg border border-blue-100 shadow-sm tracking-wider inline-block whitespace-nowrap">
                                {getRelation(g.ciclos_escolares)?.nombre || cycles.find(c => c.id === g.ciclo_id)?.nombre || (g.ciclo_id ? g.ciclo_id : (cycles.find(c => c.es_activo)?.nombre || '2025-2026-2'))}
                              </span>
                            </td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingGroupId(g.id); setIsEditingGroup(true); setNewGroup({ nombre_grupo: g.nombre_grupo, materia_id: g.materia_id, docente_id: g.docente_id, turno: g.turno, ciclo_id: g.ciclo_id }); setShowGroupModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => handleDeleteGroup(g.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'students' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none appearance-none cursor-pointer"
                      value={studentTabFilters.career}
                      onChange={e => {
                        const newCareer = e.target.value;
                        setStudentTabFilters({ ...studentTabFilters, career: newCareer, semester: 'ALL', group: 'ALL' });
                      }}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none appearance-none cursor-pointer"
                      value={studentTabFilters.semester}
                      onChange={e => {
                        const newSemester = e.target.value;
                        setStudentTabFilters({ ...studentTabFilters, semester: newSemester, group: 'ALL' });
                      }}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                    <select
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none appearance-none cursor-pointer"
                      value={studentTabFilters.group}
                      onChange={e => setStudentTabFilters({ ...studentTabFilters, group: e.target.value })}
                    >
                      <option value="ALL">TODOS LOS GRUPOS</option>
                      {availableGroupsForStudentsTab.map((g, idx) => (
                        <option key={`${g}-${idx}`} value={g}>Grupo {g}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o matrícula..."
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none"
                      value={studentTabFilters.search}
                      onChange={e => setStudentTabFilters({ ...studentTabFilters, search: e.target.value })}
                    />
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-8 py-5">Matrícula</th><th className="px-8 py-5">Nombre</th><th className="px-8 py-5">Grupo</th><th className="px-8 py-5">Programa</th><th className="px-8 py-5 text-right">Perfil</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudentsTab.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No se encontraron alumnos con los filtros aplicados</td></tr>
                        ) : filteredStudentsTab.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 text-[12px] transition-all group">
                            <td className="px-8 py-5 font-mono text-blue-700 font-bold">{s.id}</td>
                            <td className="px-8 py-5 font-bold text-gray-900 cursor-pointer hover:text-blue-600" onClick={() => setSelectedStudent(s)}>{s.name}</td>
                            <td className="px-8 py-5 font-black text-[#003B5C]">{s.group}</td>
                            <td className="px-8 py-5 text-gray-400 text-[10px] font-bold uppercase">{s.career} ({s.semester}°)</td>
                            <td className="px-8 py-5 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setSelectedStudent(s)} className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:bg-[#003B5C] hover:text-white transition-all" title="Ver Perfil">👁️</button>
                              <button onClick={() => {
                                setEditingStudentId(s.id);
                                setIsEditingStudent(true);
                                setNewStudent({ matricula: s.id, nombre: s.name, carrera: s.career, semestre: s.semester, grupo: s.group, turno: s.shift });
                                setShowStudentModal(true);
                              }} className="p-2 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white transition-all" title="Editar">✏️</button>
                              <button onClick={() => handleDeleteStudent(s.id)} className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Eliminar">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'ciclos' && (
                <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                      <tr><th className="px-10 py-5">Periodo</th><th className="px-10 py-5">Estatus</th><th className="px-10 py-5 text-right">Acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cycles.map(c => (
                        <tr key={c.id} className={`hover:bg-gray-50 text-[12px] ${c.es_activo ? 'bg-blue-50/30' : ''}`}>
                          <td className="px-10 py-5 font-bold text-gray-900">{c.nombre}</td>
                          <td className="px-10 py-5">
                            {c.es_activo ? <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">ACTIVO</span> : <span className="text-gray-400 text-[9px] font-black">INACTIVO</span>}
                          </td>
                          <td className="px-10 py-5 text-right">
                            {!c.es_activo && <button onClick={() => handleSetActiveCycle(c.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">Activar</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'accentuations' && (
                <AccentuationsModule />
              )}

              {activeTab === 'backups' && (
                <DatabaseBackup />
              )}

              {activeTab === 'config' && (
                <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 shadow-xl space-y-6">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                      <span className="text-4xl">⚙️</span>
                      <div>
                        <h3 className="text-2xl font-black text-[#003B5C] tracking-tight">Configuración de Llaves de API y Base de Datos</h3>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mt-1">Gestión segura del entorno de producción</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                      <p className="text-xs text-amber-800 font-bold leading-relaxed">
                        ⚠️ <strong>Nota de Seguridad:</strong> Las llaves guardadas en este panel se almacenan localmente en el navegador (`localStorage`). No quedan registradas en el servidor ni se compilan en los archivos del cliente, por lo que son invisibles para usuarios no autorizados o estudiantes.
                      </p>
                    </div>

                    <form onSubmit={handleSaveConfig} className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Supabase Project URL</label>
                        <input
                          type="text"
                          value={configForm.supabaseUrl}
                          onChange={(e) => setConfigForm({ ...configForm, supabaseUrl: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none"
                          placeholder="https://your-project.supabase.co"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Supabase Anon Key</label>
                        <div className="relative">
                          <input
                            type={showConfigKeys ? 'text' : 'password'}
                            value={configForm.supabaseAnonKey}
                            onChange={(e) => setConfigForm({ ...configForm, supabaseAnonKey: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-5 pr-12 py-4 text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none"
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfigKeys(!showConfigKeys)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs uppercase"
                          >
                            {showConfigKeys ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gemini API Key (Opcional)</label>
                        <div className="relative">
                          <input
                            type={showConfigKeys ? 'text' : 'password'}
                            value={configForm.geminiApiKey}
                            onChange={(e) => setConfigForm({ ...configForm, geminiApiKey: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-5 pr-12 py-4 text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none"
                            placeholder="AIzaSyB..."
                          />
                        </div>
                        <p className="text-[9px] text-gray-400 ml-1">Requerido para habilitar el semáforo inteligente de riesgo mediante IA.</p>
                      </div>

                      <div className="pt-6 flex flex-col sm:flex-row gap-4">
                        <button
                          type="submit"
                          className="flex-1 bg-[#003B5C] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all active:scale-95"
                        >
                          Guardar Cambios y Reiniciar
                        </button>
                        <button
                          type="button"
                          onClick={handleClearConfig}
                          className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                        >
                          Restablecer Claves
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showTutorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingTutoria ? 'Editar Tutor' : 'Asignar Nuevo Tutor'}</h3>
            <form onSubmit={handleSaveTutoria} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seleccionar Docente / Tutor</label>
                <select className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-sm outline-none" value={newTutoria.tutor_id} onChange={e => setNewTutoria({ ...newTutoria, tutor_id: e.target.value })} required>
                  <option value="">-- Elige un docente --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              {!isEditingTutoria && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Filtro Carrera</label>
                      <select className="w-full bg-gray-50 border border-gray-100 p-2 rounded-xl text-[10px] font-bold" value={tutorModalFilters.career} onChange={e => setTutorModalFilters({ ...tutorModalFilters, career: e.target.value })}>
                        <option value="">Todas...</option>
                        {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Semestre</label>
                      <select className="w-full bg-gray-50 border border-gray-100 p-2 rounded-xl text-[10px] font-bold" value={tutorModalFilters.semester} onChange={e => setTutorModalFilters({ ...tutorModalFilters, semester: e.target.value })}>
                        <option value="">Todos</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}°</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Grupo</label>
                      <select className="w-full bg-gray-50 border border-gray-100 p-2 rounded-xl text-[10px] font-bold" value={tutorModalFilters.group} onChange={e => setTutorModalFilters({ ...tutorModalFilters, group: e.target.value })}>
                        <option value="">Todos</option>
                        {Array.from(new Set(groupsMetadata.filter(gm =>
                          (!tutorModalFilters.career || gm.carrera === tutorModalFilters.career) &&
                          (!tutorModalFilters.semester || gm.semestre === parseInt(tutorModalFilters.semester))
                        ).map(gm => gm.grupo))).sort().map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-[300px] overflow-y-auto">
                    {loadingStudents ? <p className="text-center text-xs text-gray-400 py-4">Cargando...</p> : (
                      modalStudents.length === 0 ? <p className="text-center text-xs text-gray-400 py-4">No hay estudiantes con estos filtros</p> : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                            <span className="text-[10px] font-black text-gray-400 uppercase">{modalStudents.length} Estudiantes encontrados</span>
                            <button type="button" onClick={() => {
                              // Only select UNASSIGNED students
                              const availableStudents = modalStudents.filter(s => !assignedStudents.has(s.id));
                              const areAllAvailableSelected = availableStudents.every(s => selectedStudentIds.has(s.id));

                              if (areAllAvailableSelected && availableStudents.length > 0) {
                                // Deselect all
                                setSelectedStudentIds(new Set());
                              } else {
                                // Select all available
                                const all = new Set(selectedStudentIds);
                                availableStudents.forEach(s => all.add(s.id));
                                setSelectedStudentIds(all);
                              }
                            }} className="text-[10px] text-blue-600 font-bold hover:underline">
                              {selectedStudentIds.size > 0 && modalStudents.some(s => !assignedStudents.has(s.id) && !selectedStudentIds.has(s.id)) ? 'Marcar Todos Disp.' : 'Desmarcar Todos'}
                            </button>
                          </div>
                          {modalStudents.map(s => {
                            const isAssigned = assignedStudents.has(s.id);
                            return (
                              <label key={s.id} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isAssigned ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'hover:bg-white cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 text-[#003B5C] focus:ring-[#003B5C]"
                                  checked={selectedStudentIds.has(s.id)}
                                  disabled={isAssigned}
                                  onChange={e => {
                                    if (isAssigned) return;
                                    const next = new Set(selectedStudentIds);
                                    if (e.target.checked) next.add(s.id);
                                    else next.delete(s.id);
                                    setSelectedStudentIds(next);
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-gray-800 flex items-center gap-2">
                                    {s.name}
                                    {isAssigned && <span className="text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">Asignado</span>}
                                  </p>
                                  <p className="text-[9px] text-gray-400 uppercase">{s.id} • {s.career} ({s.semester}°)</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                  <p className="text-right text-[10px] font-black text-[#003B5C]">
                    {selectedStudentIds.size} Estudiantes Seleccionados
                  </p>
                </div>
              )}

              <button disabled={isSaving || (!isEditingTutoria && selectedStudentIds.size === 0)} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? 'Guardando...' : (isEditingTutoria ? 'Actualizar Tutor' : 'Confirmar Asignación')}
              </button>
              <button type="button" onClick={() => setShowTutorModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingSubject ? 'Editar Materia' : 'Nueva Materia'}</h3>
            <form onSubmit={handleSaveSubject} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Código (Ej: IQ-101)" value={newSubject.codigo} onChange={e => setNewSubject({ ...newSubject, codigo: e.target.value })} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre de la Materia" value={newSubject.nombre} onChange={e => setNewSubject({ ...newSubject, nombre: e.target.value })} required />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.carrera} onChange={e => setNewSubject({ ...newSubject, carrera: e.target.value as Career })} required>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.semestre} onChange={e => setNewSubject({ ...newSubject, semestre: parseInt(e.target.value) })} required>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Créditos SATCA</label>
                <input type="number" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Cantidad de créditos" value={newSubject.creditos} onChange={e => setNewSubject({ ...newSubject, creditos: parseInt(e.target.value) })} required />
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-800 transition-all">{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              <button type="button" onClick={() => setShowSubjectModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8 flex items-center gap-3">
              <span className="text-3xl">📚</span>
              {isEditingGroup ? 'Editar Carga Docente' : 'Nueva Asignación de Grupo'}
            </h3>
            <form onSubmit={handleSaveGroup} className="space-y-6">
              <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtro Carrera</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold" value={modalAssignmentFilters.career} onChange={e => setModalAssignmentFilters({ ...modalAssignmentFilters, career: e.target.value })}>
                      <option value="">Todas...</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtro Semestre</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold" value={modalAssignmentFilters.semester} onChange={e => setModalAssignmentFilters({ ...modalAssignmentFilters, semester: e.target.value })}>
                      <option value="ALL">Cualquiera...</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Grupo (Matrícula)</label>
                    <select
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-xs"
                      value={newGroup.nombre_grupo}
                      onChange={e => setNewGroup({ ...newGroup, nombre_grupo: e.target.value })}
                      required
                    >
                      <option value="">-- Selecciona --</option>
                      {modalFilteredExistingGroups.map((gm, idx) => (
                        <option key={`${gm.grupo}-${idx}`} value={gm.grupo}>
                          {gm.grupo} ({gm.turno})
                        </option>
                      ))}
                    </select>
                    {modalFilteredExistingGroups.length === 0 && modalAssignmentFilters.career && (
                      <p className="text-[8px] text-red-500 font-bold mt-1 ml-1">
                        ⚠ Sin grupos para {modalAssignmentFilters.career} {modalAssignmentFilters.semester}°
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Seleccionar Materia</label>
                  <select
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-sm"
                    value={newGroup.materia_id}
                    onChange={e => {
                      const mId = e.target.value;
                      setNewGroup({ ...newGroup, materia_id: mId });
                      const sub = subjects.find(s => s.id === mId);
                      if (sub) {
                        setModalAssignmentFilters({ career: sub.carrera, semester: sub.semestre.toString() });
                      }
                    }}
                    required
                  >
                    <option value="">-- Elige una materia --</option>
                    {modalFilteredSubjects.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.codigo})</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Docente Responsable</label>
                <select className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none" value={newGroup.docente_id} onChange={e => setNewGroup({ ...newGroup, docente_id: e.target.value })} required>
                  <option value="">-- Selecciona Docente --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Turno</label>
                <select className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none" value={newGroup.turno} onChange={e => setNewGroup({ ...newGroup, turno: e.target.value })} required>
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50">
                  {isSaving ? 'Guardando...' : 'Confirmar Asignación'}
                </button>
                <button type="button" onClick={() => setShowGroupModal(false)} className="text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors">Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCsvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-12 text-center animate-in zoom-in-95">
            <span className="text-6xl mb-6 block">📂</span>
            <h3 className="text-3xl font-black text-[#003B5C] mb-2 tracking-tighter">Importar Matrícula</h3>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-10 opacity-70">Sincroniza alumnos vía CSV</p>
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] p-10 mb-8">
              <div className="text-left mb-6 bg-white p-4 rounded-xl border border-gray-100">
                <p className="text-[10px] font-black text-[#003B5C] uppercase tracking-widest mb-2">Columnas requeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {['matricula', 'nombre', 'carrera', 'semestre', 'grupo', 'turno'].map(c => (
                    <span key={c} className="bg-blue-50 text-blue-700 text-[8px] font-black px-2 py-1 rounded border border-blue-100">{c}</span>
                  ))}
                </div>
              </div>
              <label className="bg-[#003B5C] text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl cursor-pointer hover:bg-blue-800 transition-all inline-block active:scale-95">
                {isSaving ? 'Validando...' : 'Elegir Archivo .CSV'}
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={isSaving} />
              </label>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={downloadCsvTemplate} className="text-[#003B5C] font-black text-[10px] uppercase tracking-widest hover:underline">Descargar Plantilla Maestra</button>
              <button onClick={() => setShowCsvModal(false)} className="text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar Operación</button>
            </div>
          </div>
        </div>
      )}

      {showCycleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">Nuevo Ciclo Escolar</h3>
            <form onSubmit={async (e) => { e.preventDefault(); setIsSaving(true); try { await supabase.from('ciclos_escolares').insert([newCycle]); setShowCycleModal(false); fetchData(); } finally { setIsSaving(false); } }} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre (Ej: 2024-2025 I)" value={newCycle.nombre} onChange={e => setNewCycle({ ...newCycle, nombre: e.target.value })} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_inicio} onChange={e => setNewCycle({ ...newCycle, fecha_inicio: e.target.value })} required />
                <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_fin} onChange={e => setNewCycle({ ...newCycle, fecha_fin: e.target.value })} required />
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl">Crear Ciclo</button>
              <button type="button" onClick={() => setShowCycleModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingUser ? 'Editar Personal' : 'Nuevo Registro de Personal'}</h3>
            <form onSubmit={async (e) => { e.preventDefault(); setIsSaving(true); try { if (isEditingUser) await supabase.from('docentes').update(newUser).eq('id', editingUserId); else await supabase.from('docentes').insert([newUser]); setShowUserModal(false); fetchData(); } finally { setIsSaving(false); } }} className="space-y-5">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Número de Empleado" value={newUser.numero_empleado} onChange={e => setNewUser({ ...newUser, numero_empleado: e.target.value })} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Nombre Completo" value={newUser.nombre} onChange={e => setNewUser({ ...newUser, nombre: e.target.value })} required />
              <input type="email" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Correo UAS (@uas.edu.mx)" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Contraseña de acceso" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
              <div className="flex gap-2">
                {[UserRole.DOCENTE, UserRole.TUTOR, UserRole.ADMIN].map(r => (
                  <button key={r} type="button" onClick={() => { const roles = newUser.rol.includes(r) ? newUser.rol.filter(x => x !== r) : [...newUser.rol, r]; setNewUser({ ...newUser, rol: roles }); }} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${newUser.rol.includes(r) ? 'bg-[#003B5C] text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{r}</button>
                ))}
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              <button type="button" onClick={() => setShowUserModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {showStudentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-4">{isEditingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</h3>
            <div className="mb-6 p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl flex items-center justify-between">
              <span className="text-[10px] font-black text-[#003B5C] uppercase tracking-wider flex items-center gap-1.5">
                <span>📅</span> Periodo Asignado:
              </span>
              <span className="text-xs font-black text-blue-900 bg-white px-3 py-1 rounded-xl shadow-sm border border-blue-100">
                {cycles.find(c => c.id === (selectedCycleId || activeCycleId))?.nombre || 'Periodo Activo'}
              </span>
            </div>
            <form onSubmit={handleSaveStudent} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Matrícula (ID)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-gray-50 border p-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                    placeholder="Matrícula (Ej: 21234567)"
                    value={newStudent.matricula}
                    onChange={e => {
                      setNewStudent({ ...newStudent, matricula: e.target.value });
                      if (foundExistingStudent && e.target.value.trim() !== foundExistingStudent.id) {
                        setFoundExistingStudent(null);
                      }
                    }}
                    onBlur={e => handleSearchMatricula(e.target.value)}
                    disabled={isEditingStudent}
                    required
                  />
                  {!isEditingStudent && (
                    <button
                      type="button"
                      onClick={() => handleSearchMatricula(newStudent.matricula)}
                      disabled={searchingMatricula || !newStudent.matricula.trim()}
                      className="px-4 bg-[#003B5C] text-white rounded-xl font-black text-xs uppercase hover:bg-blue-800 transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                    >
                      {searchingMatricula ? '...' : '🔍 Buscar'}
                    </button>
                  )}
                </div>
                {foundExistingStudent ? (
                  <p className="text-[10px] font-black text-emerald-600 mt-1 ml-1 leading-tight flex items-center gap-1">
                    <span>⚡</span> Alumno existente. Se auto-completaron datos y avanzó a {newStudent.semestre}° Semestre (sin duplicar matrícula).
                  </p>
                ) : newStudent.matricula.trim() && !searchingMatricula ? (
                  <p className="text-[10px] font-bold text-gray-400 mt-1 ml-1 leading-tight">
                    ℹ Estudiante nuevo. Completa sus datos para registrar su matrícula.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Nombre Completo" value={newStudent.nombre} onChange={e => setNewStudent({ ...newStudent, nombre: e.target.value })} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <select className="flex-1 bg-gray-50 border p-4 rounded-xl font-bold text-sm" value={newStudent.carrera} onChange={e => setNewStudent({ ...newStudent, carrera: e.target.value as Career })} required>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" value={newStudent.semestre} onChange={e => setNewStudent({ ...newStudent, semestre: parseInt(e.target.value) })} required>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Grupo (Ej: 3-01)" value={newStudent.grupo} onChange={e => setNewStudent({ ...newStudent, grupo: e.target.value })} required />
                <select className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" value={newStudent.turno} onChange={e => setNewStudent({ ...newStudent, turno: e.target.value })} required>
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </div>

              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">{isSaving ? 'Guardando...' : 'Registrar Estudiante'}</button>
              <button type="button" onClick={() => setShowStudentModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {selectedStudent && <StudentProfile student={selectedStudent} role={UserRole.ADMIN} onClose={() => setSelectedStudent(null)} />}
    </div>
  );
};

export default AdminPanel;
