
import React, { useState, useEffect } from 'react';
import { CAREERS } from '../constants';
import { SQL_SCHEMA } from '../constants/sqlSchema';
import { supabase } from '../services/supabaseClient';
import { UserRole, CicloEscolar, Subject, Career, Student, Turno } from '../types';
import Papa from 'papaparse';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'ciclos' | 'subjects' | 'students' | 'assignments' | 'tutor-assignments'>('users');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
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
  
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  
  // Metadatos de grupos existentes en la matrícula
  const [groupsMetadata, setGroupsMetadata] = useState<{grupo: string, carrera: string, semestre: number, turno: string}[]>([]);

  // Filtros de materias
  const [subjectFilters, setSubjectFilters] = useState({
    search: '',
    career: 'ALL',
    semester: 'ALL'
  });

  // Filtros de carga docente (Assignments)
  const [assignmentFilters, setAssignmentFilters] = useState({
    career: 'ALL',
    semester: 'ALL'
  });

  // Filtros locales para el modal de nueva carga
  const [modalAssignmentFilters, setModalAssignmentFilters] = useState({
    career: '',
    semester: 'ALL'
  });

  // Formulario de nuevo ciclo
  const [newCycle, setNewCycle] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: ''
  });

  // Formulario de nuevo usuario
  const [newUser, setNewUser] = useState({
    numero_empleado: '',
    nombre: '',
    email: '',
    password: '',
    rol: [UserRole.DOCENTE] as UserRole[]
  });

  // Formulario de nueva carga docente (Grupo)
  const [newGroup, setNewGroup] = useState({
    nombre_grupo: '',
    materia_id: '',
    docente_id: '',
    turno: 'Matutino',
    ciclo_id: ''
  });

  // Formulario de nueva materia
  const [newSubject, setNewSubject] = useState({
    codigo: '',
    nombre: '',
    carrera: '',
    semestre: 1,
    creditos: 5
  });

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase.from('docentes').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchCycles = async () => {
    try {
      const { data, error } = await supabase.from('ciclos_escolares').select('*').order('fecha_inicio', { ascending: false });
      if (error) throw error;
      setCycles(data || []);
      const active = data?.find(c => c.es_activo);
      if (active) {
        setActiveCycleId(active.id);
        setNewGroup(prev => ({ ...prev, ciclo_id: active.id }));
      } else {
        setActiveCycleId(null);
      }
    } catch (err) { console.error(err); }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from('materias').select('*').order('carrera', { ascending: true }).order('semestre', { ascending: true }).order('nombre', { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchExistingGroupNames = async () => {
    try {
      const { data, error } = await supabase.from('estudiantes').select('grupo, carrera, semestre, turno');
      if (error) throw error;
      if (data) {
        const uniqueMeta = data.reduce((acc, current) => {
          const exists = acc.find(item => 
            item.grupo === current.grupo && 
            item.carrera === current.carrera && 
            item.semestre === current.semestre
          );
          if (!exists) acc.push(current);
          return acc;
        }, [] as any[]);
        setGroupsMetadata(uniqueMeta);
      }
    } catch (err) { console.error(err); }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.from('estudiantes').select('*').order('nombre', { ascending: true }).limit(500);
      if (error) throw error;
      setStudents((data || []).map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as any, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as any,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || []
      })));
    } catch (err) { console.error(err); }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select('*, materias(nombre, carrera, semestre), docentes(nombre), ciclos_escolares(nombre)')
        .order('nombre_grupo', { ascending: true });
      if (error) throw error;
      setGroups(data || []);
    } catch (err) { console.error(err); }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTeachers(),
      fetchCycles(),
      fetchSubjects(),
      fetchGroups(),
      fetchExistingGroupNames()
    ]);
    if (activeTab === 'students') await fetchStudents();
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.materia_id || !newGroup.docente_id || !newGroup.nombre_grupo) {
      alert("Completa todos los campos para asignar la carga.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('grupos').insert([newGroup]);
      if (error) throw error;
      alert("✅ Carga docente asignada correctamente.");
      setShowGroupModal(false);
      fetchGroups();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.numero_empleado || !newUser.nombre || !newUser.email || !newUser.password) {
      alert("Por favor completa todos los campos del usuario.");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditingUser && editingUserId) {
        const { error } = await supabase.from('docentes').update(newUser).eq('id', editingUserId);
        if (error) throw error;
        alert("✅ Usuario actualizado correctamente.");
      } else {
        const { error } = await supabase.from('docentes').insert([newUser]);
        if (error) throw error;
        alert("✅ Usuario creado correctamente.");
      }
      setShowUserModal(false);
      fetchTeachers();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetUserForm = () => {
    setNewUser({ numero_empleado: '', nombre: '', email: '', password: '', rol: [UserRole.DOCENTE] });
    setIsEditingUser(false);
    setEditingUserId(null);
  };

  const handleEditUser = (user: any) => {
    setNewUser({
      numero_empleado: user.numero_empleado,
      nombre: user.nombre,
      email: user.email,
      password: user.password,
      rol: Array.isArray(user.rol) ? user.rol : [user.rol]
    });
    setEditingUserId(user.id);
    setIsEditingUser(true);
    setShowUserModal(true);
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase.from('ciclos_escolares').insert([newCycle]);
      if (error) throw error;
      alert("✅ Ciclo escolar creado.");
      setShowCycleModal(false);
      setNewCycle({ nombre: '', fecha_inicio: '', fecha_fin: '' });
      fetchCycles();
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleSetActiveCycle = async (id: string) => {
    setIsSaving(true);
    try {
      await supabase.from('ciclos_escolares').update({ es_activo: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await supabase.from('ciclos_escolares').update({ es_activo: true }).eq('id', id);
      if (error) throw error;
      
      window.dispatchEvent(new CustomEvent('sta-cycle-updated'));
      await fetchCycles();
      alert("✅ Ciclo establecido como ACTIVO.");
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleEditSubject = (subject: Subject) => {
    setNewSubject({
      codigo: subject.codigo || '',
      nombre: subject.nombre,
      carrera: subject.carrera,
      semestre: subject.semestre,
      creditos: subject.creditos
    });
    setEditingSubjectId(subject.id);
    setIsEditingSubject(true);
    setShowSubjectModal(true);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.nombre || !newSubject.carrera || !newSubject.codigo) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditingSubject && editingSubjectId) {
        const { error } = await supabase.from('materias').update(newSubject).eq('id', editingSubjectId);
        if (error) throw error;
        alert("✅ Materia actualizada correctamente.");
      } else {
        const { error } = await supabase.from('materias').insert([newSubject]);
        if (error) throw error;
        alert("✅ Materia creada correctamente.");
      }
      
      closeSubjectModal();
      fetchSubjects();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const closeSubjectModal = () => {
    setShowSubjectModal(false);
    setIsEditingSubject(false);
    setEditingSubjectId(null);
    setNewSubject({ codigo: '', nombre: '', carrera: '', semestre: 1, creditos: 5 });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      encoding: "UTF-8",
      complete: async (results) => {
        try {
          if (results.data.length === 0) throw new Error("El archivo seleccionado está vacío.");
          
          let targetCycle = activeCycleId;
          if (!targetCycle) {
            const { data: activeCycle } = await supabase.from('ciclos_escolares').select('id').eq('es_activo', true).maybeSingle();
            if (!activeCycle) throw new Error("No hay un ciclo escolar activo definido.");
            targetCycle = activeCycle.id;
          }
          
          const formatted = results.data.map((row: any) => {
            const getVal = (aliases: string[]) => {
              const keys = Object.keys(row);
              const found = keys.find(k => aliases.some(a => k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === a.toLowerCase()));
              return found ? String(row[found]).trim() : '';
            };

            const id = getVal(['matricula', 'id', 'nocontrol', 'no control', 'no_control', 'control']);
            const nombre = getVal(['nombre', 'estudiante', 'alumno', 'nombre completo']);
            const carrera = getVal(['carrera', 'programa', 'licenciatura']);
            const semestre = parseInt(getVal(['semestre', 'grado', 'nivel'])) || 1;
            const grupo = getVal(['grupo', 'seccion', 'aula']);
            const turno = getVal(['turno', 'horario']) || 'Matutino';

            if (!id || !nombre) return null;

            return { id, nombre, carrera, semestre, grupo, turno, ciclo_id: targetCycle, nivel_riesgo: 'LOW' };
          }).filter(item => item !== null);

          const { error } = await supabase.from('estudiantes').upsert(formatted, { onConflict: 'id' });
          if (error) throw error;

          alert(`✅ Importación exitosa: ${formatted.length} estudiantes.`);
          setShowCsvModal(false);
          fetchStudents();
          fetchExistingGroupNames(); // Recargar metadatos de grupos
        } catch (err: any) {
          alert("❌ Error: " + err.message);
        } finally {
          setIsSaving(false);
          if (e.target) e.target.value = '';
        }
      }
    });
  };

  const filteredCatalogSubjects = subjects.filter(s => {
    const searchMatch = !subjectFilters.search || 
      s.nombre.toLowerCase().includes(subjectFilters.search.toLowerCase()) || 
      s.codigo?.toLowerCase().includes(subjectFilters.search.toLowerCase());
    const careerMatch = subjectFilters.career === 'ALL' || s.carrera === subjectFilters.career;
    const semesterMatch = subjectFilters.semester === 'ALL' || s.semestre === parseInt(subjectFilters.semester);
    return searchMatch && careerMatch && semesterMatch;
  });

  const filteredGroups = groups.filter(g => {
    const mat = getRelation(g.materias);
    const careerMatch = assignmentFilters.career === 'ALL' || mat?.carrera === assignmentFilters.career;
    const semesterMatch = assignmentFilters.semester === 'ALL' || mat?.semestre === parseInt(assignmentFilters.semester);
    return careerMatch && semesterMatch;
  });

  const modalFilteredSubjects = subjects.filter(s => {
    const careerMatch = !modalAssignmentFilters.career || s.carrera === modalAssignmentFilters.career;
    const semesterMatch = modalAssignmentFilters.semester === 'ALL' || s.semestre === parseInt(modalAssignmentFilters.semester);
    return careerMatch && semesterMatch;
  });

  // Filtrar metadatos de grupos existentes según filtros del modal
  const modalFilteredExistingGroups = groupsMetadata.filter(gm => {
    const careerMatch = !modalAssignmentFilters.career || gm.carrera === modalAssignmentFilters.career;
    const semesterMatch = modalAssignmentFilters.semester === 'ALL' || gm.semestre === parseInt(modalAssignmentFilters.semester);
    return careerMatch && semesterMatch;
  });

  const handleSelectExistingGroup = (groupName: string) => {
    const found = groupsMetadata.find(gm => gm.grupo === groupName);
    if (found) {
      setNewGroup({
        ...newGroup,
        nombre_grupo: found.grupo,
        turno: found.turno
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-10 bg-[#003B5C] text-white flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">Administración STA</h2>
            <p className="text-blue-100 opacity-80 font-medium text-sm uppercase tracking-widest">Configuración Maestra FCQB</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowSqlModal(true)} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 transition-all">Esquema DB</button>
            {activeTab === 'users' && (
              <button onClick={() => { resetUserForm(); setShowUserModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Personal</button>
            )}
            {activeTab === 'ciclos' && (
              <button onClick={() => setShowCycleModal(true)} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Ciclo</button>
            )}
            {activeTab === 'subjects' && (
              <button onClick={() => { setIsEditingSubject(false); setShowSubjectModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Materia</button>
            )}
            {activeTab === 'assignments' && (
              <button onClick={() => setShowGroupModal(true)} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Carga</button>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50/30 overflow-x-auto scrollbar-hide">
          {[
            { id: 'users', label: 'Personal' },
            { id: 'ciclos', label: 'Ciclos' },
            { id: 'subjects', label: 'Materias' },
            { id: 'assignments', label: 'Carga Docente' },
            { id: 'students', label: 'Matrícula' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-10">
          {loading ? (
            <div className="py-20 text-center animate-pulse text-[12px] font-black text-gray-300 uppercase tracking-widest">Sincronizando con Supabase...</div>
          ) : (
            <>
              {activeTab === 'users' && (
                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                        <tr><th className="px-10 py-5">Docente</th><th className="px-10 py-5">Email</th><th className="px-10 py-5">Roles</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {teachers.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 text-[12px] group">
                            <td className="px-10 py-5 font-bold text-gray-900">{t.nombre}</td>
                            <td className="px-10 py-5 text-gray-600">{t.email}</td>
                            <td className="px-10 py-5 flex gap-2">
                              {(Array.isArray(t.rol) ? t.rol : [t.rol]).map((r: string) => (
                                <span key={r} className="px-2 py-1 bg-blue-50 text-blue-700 text-[8px] font-black uppercase border rounded-lg">{r}</span>
                              ))}
                            </td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditUser(t)} className="p-2 text-blue-600">✏️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              )}

              {activeTab === 'assignments' && (
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Licenciatura</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none"
                        value={assignmentFilters.career}
                        onChange={e => setAssignmentFilters({...assignmentFilters, career: e.target.value})}
                      >
                        <option value="ALL">TODAS LAS CARRERAS</option>
                        {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none"
                        value={assignmentFilters.semester}
                        onChange={e => setAssignmentFilters({...assignmentFilters, semester: e.target.value})}
                      >
                        <option value="ALL">TODOS LOS SEMESTRES</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                          <tr>
                            <th className="px-10 py-5">Materia</th>
                            <th className="px-10 py-5">Docente</th>
                            <th className="px-10 py-5">Grupo</th>
                            <th className="px-10 py-5">Turno</th>
                            <th className="px-10 py-5">Ciclo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredGroups.length === 0 ? (
                            <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase">Sin resultados con estos filtros</td></tr>
                          ) : filteredGroups.map(g => (
                            <tr key={g.id} className="hover:bg-gray-50 text-[12px]">
                              <td className="px-10 py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900">{getRelation(g.materias)?.nombre}</span>
                                  <span className="text-[9px] text-gray-400 font-bold uppercase">{getRelation(g.materias)?.carrera} • {getRelation(g.materias)?.semestre}° Sem.</span>
                                </div>
                              </td>
                              <td className="px-10 py-5 text-blue-600 font-black">{getRelation(g.docentes)?.nombre}</td>
                              <td className="px-10 py-5 font-mono">{g.nombre_grupo}</td>
                              <td className="px-10 py-5 text-gray-500">{g.turno}</td>
                              <td className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{getRelation(g.ciclos_escolares)?.nombre}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
                </div>
              )}

              {activeTab === 'subjects' && (
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Buscador</label>
                      <input 
                        type="text" 
                        placeholder="Nombre o código..." 
                        className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-bold outline-none"
                        value={subjectFilters.search}
                        onChange={e => setSubjectFilters({...subjectFilters, search: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Licenciatura</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none"
                        value={subjectFilters.career}
                        onChange={e => setSubjectFilters({...subjectFilters, career: e.target.value})}
                      >
                        <option value="ALL">TODAS LAS CARRERAS</option>
                        {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-xs font-black outline-none"
                        value={subjectFilters.semester}
                        onChange={e => setSubjectFilters({...subjectFilters, semester: e.target.value})}
                      >
                        <option value="ALL">TODOS LOS SEMESTRES</option>
                        {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                          <tr>
                            <th className="px-8 py-5">Código</th>
                            <th className="px-8 py-5">Materia</th>
                            <th className="px-8 py-5">Programa</th>
                            <th className="px-8 py-5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredCatalogSubjects.map(s => (
                            <tr key={s.id} className="hover:bg-gray-50 text-[12px] group">
                              <td className="px-8 py-5 font-mono font-black text-blue-600">{s.codigo}</td>
                              <td className="px-8 py-5 font-bold text-gray-900">{s.nombre}</td>
                              <td className="px-8 py-5 text-gray-400 font-medium text-[10px] uppercase">{s.carrera} • {s.semestre}°</td>
                              <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditSubject(s)} className="p-2 text-blue-600">✏️</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  </div>
                </div>
              )}

              {activeTab === 'students' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black text-gray-900">Control de Matrícula</h3>
                    <div className="flex items-center gap-4">
                      {!activeCycleId && (
                        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase animate-pulse border border-red-100">
                          ⚠️ Falta Ciclo Activo
                        </div>
                      )}
                      <button 
                        onClick={() => setShowCsvModal(true)} 
                        disabled={!activeCycleId}
                        className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase shadow-xl disabled:opacity-50"
                      >
                        📂 Cargar CSV
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
                        <tr><th className="px-8 py-5">Matrícula</th><th className="px-8 py-5">Nombre</th><th className="px-8 py-5">Grupo</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {students.length === 0 ? (
                           <tr><td colSpan={3} className="py-20 text-center text-gray-300 font-black uppercase">Sin alumnos registrados</td></tr>
                        ) : students.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 text-[12px]">
                            <td className="px-8 py-5 font-mono text-blue-600 font-bold">{s.id}</td>
                            <td className="px-8 py-5 font-bold">{s.name}</td>
                            <td className="px-8 py-5 font-black text-[#003B5C]">{s.group}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODAL ASIGNAR CARGA (CON SINCRONIZACIÓN DE GRUPOS) */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl p-10 animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">Nueva Carga Docente</h3>
            <form onSubmit={handleCreateGroup} className="space-y-6">
              
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Paso 1: Localizar Materia</p>
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    className="bg-white border border-blue-200 p-4 rounded-2xl text-xs font-bold"
                    value={modalAssignmentFilters.career}
                    onChange={e => setModalAssignmentFilters({...modalAssignmentFilters, career: e.target.value, semester: 'ALL'})}
                  >
                    <option value="">Cualquier Carrera...</option>
                    {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                    className="bg-white border border-blue-200 p-4 rounded-2xl text-xs font-bold"
                    value={modalAssignmentFilters.semester}
                    onChange={e => setModalAssignmentFilters({...modalAssignmentFilters, semester: e.target.value})}
                  >
                    <option value="ALL">Cualquier Semestre...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                  </select>
                </div>
                
                <select 
                  className="w-full bg-white border border-blue-200 p-4 rounded-2xl font-bold text-sm outline-none" 
                  value={newGroup.materia_id} 
                  onChange={e => setNewGroup({...newGroup, materia_id: e.target.value})} 
                  required
                >
                  <option value="">Selecciona Materia de la lista filtrada...</option>
                  {modalFilteredSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre} ({s.carrera} - {s.semestre}°)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Paso 2: Datos de Asignación</p>
                
                {/* SINCRONIZACIÓN CON MATRÍCULA */}
                <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 space-y-3">
                  <label className="text-[10px] font-black text-[#003B5C] uppercase tracking-widest block ml-1">Sincronizar con Grupo Existente (Opcional)</label>
                  <select 
                    className="w-full bg-white border border-gray-200 p-3 rounded-2xl text-xs font-bold outline-none"
                    onChange={(e) => handleSelectExistingGroup(e.target.value)}
                    value={newGroup.nombre_grupo}
                  >
                    <option value="">--- Seleccionar de matrícula ---</option>
                    {modalFilteredExistingGroups.map(gm => (
                      <option key={gm.grupo} value={gm.grupo}>Grupo {gm.grupo} ({gm.turno})</option>
                    ))}
                  </select>
                  <p className="text-[8px] text-gray-400 font-bold uppercase ml-2 tracking-tighter">Esto rellena automáticamente el nombre y el turno.</p>
                </div>

                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm outline-none" value={newGroup.docente_id} onChange={e => setNewGroup({...newGroup, docente_id: e.target.value})} required>
                  <option value="">Selecciona Docente...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Nombre del Grupo</label>
                    <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newGroup.nombre_grupo} onChange={e => setNewGroup({...newGroup, nombre_grupo: e.target.value})} placeholder="Grupo (Ej: 1-1)" required />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">Turno</label>
                    <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm outline-none" value={newGroup.turno} onChange={e => setNewGroup({...newGroup, turno: e.target.value})} required>
                      <option value="Matutino">Matutino</option>
                      <option value="Vespertino">Vespertino</option>
                    </select>
                  </div>
                </div>
              </div>

              <button disabled={isSaving || !activeCycleId} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl disabled:opacity-50">
                {isSaving ? 'Guardando...' : 'Confirmar Carga Docente'}
              </button>
              <button type="button" onClick={() => setShowGroupModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CICLO */}
      {showCycleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">Nuevo Ciclo Escolar</h3>
            <form onSubmit={handleCreateCycle} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre (Ej: 2024-2025 I)" value={newCycle.nombre} onChange={e => setNewCycle({...newCycle, nombre: e.target.value})} required />
              <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_inicio} onChange={e => setNewCycle({...newCycle, fecha_inicio: e.target.value})} required />
              <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_fin} onChange={e => setNewCycle({...newCycle, fecha_fin: e.target.value})} required />
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl">{isSaving ? 'Guardando...' : 'Crear Ciclo'}</button>
              <button type="button" onClick={() => setShowCycleModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CSV */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-[#003B5C] p-8 text-white text-center">
                <h3 className="text-2xl font-black tracking-tighter">Importar Estudiantes</h3>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest mt-1">Matrícula, Nombre, Carrera, Semestre, Grupo, Turno</p>
            </div>
            <div className="p-10 text-center">
              <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-[3rem] p-12">
                <span className="text-5xl mb-6 block">📄</span>
                <p className="text-blue-900 font-black mb-6 uppercase text-[11px] tracking-widest">Cargar archivo .CSV</p>
                <label className="bg-[#003B5C] text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl cursor-pointer hover:bg-blue-700 transition-all inline-block">
                  {isSaving ? 'Sincronizando...' : 'Seleccionar Archivo'}
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={isSaving} />
                </label>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="mt-6 text-gray-400 font-bold text-[10px] uppercase">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MATERIA */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingSubject ? 'Editar Materia' : 'Nueva Materia'}</h3>
            <form onSubmit={handleCreateSubject} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Código" value={newSubject.codigo} onChange={e => setNewSubject({...newSubject, codigo: e.target.value})} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre" value={newSubject.nombre} onChange={e => setNewSubject({...newSubject, nombre: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.carrera} onChange={e => setNewSubject({...newSubject, carrera: e.target.value})} required>
                  <option value="">Licenciatura...</option>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.semestre} onChange={e => setNewSubject({...newSubject, semestre: Number(e.target.value)})} required>
                  {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                </select>
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl">{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              <button type="button" onClick={closeSubjectModal} className="w-full text-gray-400 font-bold text-[10px] uppercase">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {showSqlModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <h3 className="text-xl font-black mb-4">Esquema DB</h3>
            <pre className="bg-gray-900 text-emerald-400 p-6 rounded-2xl text-[10px] flex-1 overflow-auto font-mono mb-6">{SQL_SCHEMA}</pre>
            <button onClick={() => setShowSqlModal(false)} className="bg-gray-900 text-white px-10 py-3 rounded-xl font-black text-[10px] uppercase ml-auto">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
