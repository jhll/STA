import React, { useState, useEffect } from 'react';
import { CAREERS } from '../constants';
import { supabase } from '../services/supabaseClient';
import { UserRole, CicloEscolar, Subject, Student, Career } from '../types';
import Papa from 'papaparse';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'ciclos' | 'subjects' | 'students' | 'assignments' | 'tutor-assignments'>('users');
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
  
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [tutorias, setTutorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  
  const [groupsMetadata, setGroupsMetadata] = useState<{grupo: string, carrera: string, semestre: number, turno: string}[]>([]);

  // Filtros
  const [subjectFilters, setSubjectFilters] = useState({ search: '', career: 'ALL', semester: 'ALL' });
  const [assignmentFilters, setAssignmentFilters] = useState({ career: 'ALL', semester: 'ALL' });
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

  const getRelation = (data: any) => Array.isArray(data) ? data[0] : data;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, cRes, sRes, gRes, tutRes] = await Promise.all([
        supabase.from('docentes').select('*').order('nombre'),
        supabase.from('ciclos_escolares').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('materias').select('*').order('nombre'),
        supabase.from('grupos').select('*, materias(nombre, carrera, semestre), docentes(nombre), ciclos_escolares(nombre)').order('nombre_grupo'),
        supabase.from('tutorias').select('*, docentes(nombre), ciclos_escolares(nombre)').order('nombre_grupo')
      ]);

      setTeachers(tRes.data || []);
      setCycles(cRes.data || []);
      setSubjects(sRes.data || []);
      setGroups(gRes.data || []);
      setTutorias(tutRes.data || []);

      const active = cRes.data?.find(c => c.es_activo);
      if (active) {
        setActiveCycleId(active.id);
        setNewGroup(p => ({ ...p, ciclo_id: active.id }));
        setNewTutoria(p => ({ ...p, ciclo_id: active.id }));
      }

      const { data: mData } = await supabase.from('estudiantes').select('grupo, carrera, semestre, turno');
      if (mData) {
        const unique = mData.reduce((acc: any[], curr) => {
          if (!acc.find(x => x.grupo === curr.grupo)) acc.push(curr);
          return acc;
        }, []);
        setGroupsMetadata(unique);
      }

      // Fetch students without small limit for the admin overview, but keeping it reasonable
      const { data: stData } = await supabase.from('estudiantes').select('*').order('nombre').limit(1000);
      setStudents((stData || []).map(s => ({
        id: s.id, name: s.nombre, career: s.carrera as Career, semester: s.semestre,
        group: s.grupo, shift: s.turno as any, average: Number(s.promedio_acumulado),
        attendance: s.porcentaje_asistencia, risk: s.nivel_riesgo as any,
        personalFactors: s.factores_personales || [], academicFactors: s.factores_academicos || [],
        institutionalFactors: s.factores_institucionales || []
      })));
      
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

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
                const normalized = k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return aliases.some(a => normalized === a.toLowerCase());
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

          alert(`✅ Se han sincronizado ${formatted.length} estudiantes.`);
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
      if (isEditingGroup && editingGroupId) await supabase.from('grupos').update(newGroup).eq('id', editingGroupId);
      else await supabase.from('grupos').insert([newGroup]);
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

  const handleSaveTutoria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditingTutoria && editingTutoriaId) {
        await supabase.from('tutorias').update(newTutoria).eq('id', editingTutoriaId);
      } else {
        await supabase.from('tutorias').insert([newTutoria]);
      }
      setShowTutorModal(false);
      fetchData();
      alert("✅ Tutoría guardada.");
    } catch (err: any) { alert(err.message); } finally { setIsSaving(false); }
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
    const sMatch = !subjectFilters.search || 
                   s.nombre.toLowerCase().includes(subjectFilters.search.toLowerCase()) || 
                   s.codigo?.toLowerCase().includes(subjectFilters.search.toLowerCase());
    const cMatch = subjectFilters.career === 'ALL' || s.carrera === subjectFilters.career;
    const semMatch = subjectFilters.semester === 'ALL' || s.semestre === parseInt(subjectFilters.semester);
    return sMatch && cMatch && semMatch;
  });

  // Metadatos para sincronizar filtros de materias
  const availableSemestersForSubjects = Array.from(new Set(
    subjects
      .filter(s => subjectFilters.career === 'ALL' || s.carrera === subjectFilters.career)
      .map(s => s.semestre)
  )).sort((a: any, b: any) => a - b);

  const availableCareersForSubjects = Array.from(new Set(
    subjects
      .filter(s => subjectFilters.semester === 'ALL' || s.semestre === parseInt(subjectFilters.semester))
      .map(s => s.carrera)
  )).sort();

  const filteredGroups = groups.filter(g => {
    const mat = getRelation(g.materias);
    const cMatch = assignmentFilters.career === 'ALL' || mat?.carrera === assignmentFilters.career;
    const semMatch = assignmentFilters.semester === 'ALL' || mat?.semestre === parseInt(assignmentFilters.semester);
    return cMatch && semMatch;
  });

  const filteredTutorias = tutorias.filter(t => {
    const tutorName = getRelation(t.docentes)?.nombre || '';
    const groupMeta = groupsMetadata.find(gm => gm.grupo === t.nombre_grupo);
    
    const searchMatch = !tutorFilters.search || 
           tutorName.toLowerCase().includes(tutorFilters.search.toLowerCase()) || 
           t.nombre_grupo.toLowerCase().includes(tutorFilters.search.toLowerCase());
           
    const careerMatch = tutorFilters.career === 'ALL' || groupMeta?.carrera === tutorFilters.career;
    const semesterMatch = tutorFilters.semester === 'ALL' || groupMeta?.semestre === parseInt(tutorFilters.semester);
    
    return searchMatch && careerMatch && semesterMatch;
  });

  const filteredTeachers = teachers.filter(t => {
    const searchMatch = !userFilters.search || 
                        t.nombre.toLowerCase().includes(userFilters.search.toLowerCase()) || 
                        t.email.toLowerCase().includes(userFilters.search.toLowerCase()) ||
                        t.numero_empleado?.toLowerCase().includes(userFilters.search.toLowerCase());
    return searchMatch;
  });

  // Metadatos para sincronizar filtros de matrícula (contexto dinámico para Grupos)
  const availableGroupsForStudentsTab = Array.from(new Set(
    students
      .filter(s => 
        (studentTabFilters.career === 'ALL' || s.career === studentTabFilters.career) &&
        (studentTabFilters.semester === 'ALL' || s.semester === parseInt(studentTabFilters.semester))
      )
      .map(s => s.group)
  )).sort();

  const filteredStudentsTab = students.filter(s => {
    const searchMatch = !studentTabFilters.search || 
                        s.name.toLowerCase().includes(studentTabFilters.search.toLowerCase()) || 
                        s.id.toLowerCase().includes(studentTabFilters.search.toLowerCase());
    const careerMatch = studentTabFilters.career === 'ALL' || s.career === studentTabFilters.career;
    const semesterMatch = studentTabFilters.semester === 'ALL' || s.semester === parseInt(studentTabFilters.semester);
    const groupMatch = studentTabFilters.group === 'ALL' || s.group === studentTabFilters.group;
    return searchMatch && careerMatch && semesterMatch && groupMatch;
  });

  const modalFilteredSubjects = subjects.filter(s => {
    const cMatch = !modalAssignmentFilters.career || s.carrera === modalAssignmentFilters.career;
    const semMatch = modalAssignmentFilters.semester === 'ALL' || s.semestre === parseInt(modalAssignmentFilters.semester);
    return cMatch && semMatch;
  });

  const modalFilteredExistingGroups = groupsMetadata.filter(gm => {
    const careerToMatch = modalAssignmentFilters.career;
    const semesterToMatch = modalAssignmentFilters.semester;

    const cMatch = !careerToMatch || gm.carrera.trim().toLowerCase() === careerToMatch.trim().toLowerCase();
    const semMatch = semesterToMatch === 'ALL' || gm.semestre === parseInt(semesterToMatch);
    
    return cMatch && semMatch;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-10 bg-[#003B5C] text-white flex flex-col md:flex-row justify-between items-center gap-6 relative">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">Administración STA</h2>
            <p className="text-blue-100 opacity-80 font-medium text-sm uppercase tracking-widest mt-1">Gestión Centralizada FCQB</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
             {activeTab === 'users' && <button onClick={() => { setIsEditingUser(false); setNewUser({numero_empleado: '', nombre: '', email: '', password: '', rol: [UserRole.DOCENTE]}); setShowUserModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Personal</button>}
             {activeTab === 'ciclos' && <button onClick={() => setShowCycleModal(true)} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nuevo Ciclo</button>}
             {activeTab === 'subjects' && <button onClick={() => { setIsEditingSubject(false); setNewSubject({codigo: '', nombre: '', carrera: Career.QFB, semestre: 1, creditos: 5}); setShowSubjectModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Materia</button>}
             {activeTab === 'assignments' && <button onClick={() => { setIsEditingGroup(false); setNewGroup({nombre_grupo: '', materia_id: '', docente_id: '', turno: 'Matutino', ciclo_id: activeCycleId || ''}); setShowGroupModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Nueva Asignación</button>}
             {activeTab === 'tutor-assignments' && <button onClick={() => { setIsEditingTutoria(false); setNewTutoria({nombre_grupo: '', tutor_id: '', ciclo_id: activeCycleId || ''}); setShowTutorModal(true); }} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">+ Asignar Tutor</button>}
             {activeTab === 'students' && (
               <div className="flex gap-2">
                 <button onClick={downloadCsvTemplate} className="bg-white/10 text-white border border-white/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">📄 Bajar Formato</button>
                 <button onClick={() => setShowCsvModal(true)} className="bg-[#FFD100] text-[#003B5C] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all">📂 Cargar Matrícula</button>
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
            { id: 'students', label: 'Matrícula' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-10 py-6 text-[11px] font-black uppercase tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-[#003B5C] border-[#FFD100] bg-white' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>{tab.label}</button>
          ))}
        </div>

        <div className="p-10">
          {loading ? (
            <div className="py-32 text-center animate-pulse">
               <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full mx-auto mb-4 animate-spin"></div>
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando con Supabase...</span>
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
                        onChange={e => setUserFilters({...userFilters, search: e.target.value})}
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
                              <button onClick={() => { setEditingUserId(t.id); setIsEditingUser(true); setNewUser({numero_empleado: t.numero_empleado, nombre: t.nombre, email: t.email, password: t.password, rol: Array.isArray(t.rol) ? t.rol : [t.rol]}); setShowUserModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => { if(confirm("¿Borrar usuario?")) supabase.from('docentes').delete().eq('id', t.id).then(() => fetchData()) }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
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
                        onChange={e => setSubjectFilters({...subjectFilters, search: e.target.value})}
                      />
                    </div>
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10" 
                      value={subjectFilters.career} 
                      onChange={e => {
                        const newCareer = e.target.value;
                        // Sincronizar: Si el semestre actual no existe en la nueva carrera, resetear a ALL
                        const possibleSemesters = Array.from(new Set(subjects.filter(s => newCareer === 'ALL' || s.carrera === newCareer).map(s => s.semestre)));
                        let newSemester = subjectFilters.semester;
                        if (newSemester !== 'ALL' && !possibleSemesters.includes(parseInt(newSemester))) {
                          newSemester = 'ALL';
                        }
                        setSubjectFilters({...subjectFilters, career: newCareer, semester: newSemester});
                      }}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => {
                        const hasSubjects = availableCareersForSubjects.includes(c);
                        return <option key={c} value={c} className={!hasSubjects && subjectFilters.semester !== 'ALL' ? 'text-gray-300' : ''}>{c}</option>;
                      })}
                    </select>
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10" 
                      value={subjectFilters.semester} 
                      onChange={e => setSubjectFilters({...subjectFilters, semester: e.target.value})}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => {
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
                              <button onClick={() => { setEditingSubjectId(s.id); setIsEditingSubject(true); setNewSubject({codigo: s.codigo, nombre: s.nombre, carrera: s.carrera, semestre: s.semestre, creditos: s.creditos}); setShowSubjectModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
                              <button onClick={() => { if(confirm("¿Borrar materia?")) supabase.from('materias').delete().eq('id', s.id).then(() => fetchData()) }} className="p-3 text-red-500 hover:bg-red-50 rounded-xl ml-2">🗑️</button>
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
                      onChange={e => setTutorFilters({...tutorFilters, search: e.target.value})}
                    />
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10" 
                      value={tutorFilters.career} 
                      onChange={e => setTutorFilters({...tutorFilters, career: e.target.value})}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10" 
                      value={tutorFilters.semester} 
                      onChange={e => setTutorFilters({...tutorFilters, semester: e.target.value})}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-10 py-5">Tutor</th><th className="px-10 py-5">Grupo Asignado</th><th className="px-10 py-5">Ciclo</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredTutorias.length === 0 ? (
                          <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin tutores asignados con los filtros aplicados</td></tr>
                        ) : filteredTutorias.map(t => (
                          <tr key={t.id} className="hover:bg-blue-50/20 text-[12px] group transition-all">
                            <td className="px-10 py-5 font-bold text-gray-900">{getRelation(t.docentes)?.nombre}</td>
                            <td className="px-10 py-5">
                              <p className="font-mono text-blue-600 font-black">{t.nombre_grupo}</p>
                              {groupsMetadata.find(gm => gm.grupo === t.nombre_grupo) && (
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                  {groupsMetadata.find(gm => gm.grupo === t.nombre_grupo)?.carrera} • {groupsMetadata.find(gm => gm.grupo === t.nombre_grupo)?.semestre}°
                                </p>
                              )}
                            </td>
                            <td className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase">{getRelation(t.ciclos_escolares)?.nombre}</td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingTutoriaId(t.id); setIsEditingTutoria(true); setNewTutoria({nombre_grupo: t.nombre_grupo, tutor_id: t.tutor_id, ciclo_id: t.ciclo_id}); setShowTutorModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
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
                  <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black" value={assignmentFilters.career} onChange={e => setAssignmentFilters({...assignmentFilters, career: e.target.value})}>
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black" value={assignmentFilters.semester} onChange={e => setAssignmentFilters({...assignmentFilters, semester: e.target.value})}>
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-10 py-5">Materia</th><th className="px-10 py-5">Docente</th><th className="px-10 py-5">Grupo</th><th className="px-10 py-5">Ciclo</th><th className="px-10 py-5 text-right">Acciones</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGroups.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">Sin asignaciones registradas</td></tr>
                        ) : filteredGroups.map(g => (
                          <tr key={g.id} className="hover:bg-blue-50/20 text-[12px] group transition-all">
                            <td className="px-10 py-5">
                               <p className="font-bold text-gray-900">{getRelation(g.materias)?.nombre}</p>
                               <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{getRelation(g.materias)?.carrera}</p>
                            </td>
                            <td className="px-10 py-5 text-blue-700 font-black">{getRelation(g.docentes)?.nombre}</td>
                            <td className="px-10 py-5 font-mono text-[#003B5C] font-black bg-blue-50/30 text-center rounded-lg">{g.nombre_grupo}</td>
                            <td className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase">{getRelation(g.ciclos_escolares)?.nombre}</td>
                            <td className="px-10 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingGroupId(g.id); setIsEditingGroup(true); setNewGroup({nombre_grupo: g.nombre_grupo, materia_id: g.materia_id, docente_id: g.docente_id, turno: g.turno, ciclo_id: g.ciclo_id}); setShowGroupModal(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl">✏️</button>
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
                    <input 
                      type="text" 
                      placeholder="Buscar por nombre o matrícula..." 
                      className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold outline-none"
                      value={studentTabFilters.search}
                      onChange={e => setStudentTabFilters({...studentTabFilters, search: e.target.value})}
                    />
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none" 
                      value={studentTabFilters.career} 
                      onChange={e => setStudentTabFilters({...studentTabFilters, career: e.target.value, group: 'ALL'})}
                    >
                      <option value="ALL">TODAS LAS CARRERAS</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none" 
                      value={studentTabFilters.semester} 
                      onChange={e => setStudentTabFilters({...studentTabFilters, semester: e.target.value, group: 'ALL'})}
                    >
                      <option value="ALL">TODOS LOS SEMESTRES</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                    <select 
                      className="bg-white border border-gray-200 p-4 rounded-xl text-xs font-black outline-none" 
                      value={studentTabFilters.group} 
                      onChange={e => setStudentTabFilters({...studentTabFilters, group: e.target.value})}
                    >
                      <option value="ALL">TODOS LOS GRUPOS</option>
                      {availableGroupsForStudentsTab.map(g => (
                        <option key={g} value={g}>Grupo {g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-[#003B5C]/5 text-[10px] font-black uppercase text-[#003B5C] border-b">
                        <tr><th className="px-8 py-5">Matrícula</th><th className="px-8 py-5">Nombre</th><th className="px-8 py-5">Grupo</th><th className="px-8 py-5">Programa</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudentsTab.length === 0 ? (
                          <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-black uppercase text-[10px]">No se encontraron alumnos con los filtros aplicados</td></tr>
                        ) : filteredStudentsTab.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 text-[12px] transition-all">
                            <td className="px-8 py-5 font-mono text-blue-700 font-bold">{s.id}</td>
                            <td className="px-8 py-5 font-bold text-gray-900">{s.name}</td>
                            <td className="px-8 py-5 font-black text-[#003B5C]">{s.group}</td>
                            <td className="px-8 py-5 text-gray-400 text-[10px] font-bold uppercase">{s.career} ({s.semester}°)</td>
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
            </>
          )}
        </div>
      </div>

      {/* MODAL TUTORÍAS */}
      {showTutorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingTutoria ? 'Editar Tutor' : 'Asignar Nuevo Tutor'}</h3>
            <form onSubmit={handleSaveTutoria} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seleccionar Docente / Tutor</label>
                <select className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-sm outline-none" value={newTutoria.tutor_id} onChange={e => setNewTutoria({...newTutoria, tutor_id: e.target.value})} required>
                   <option value="">-- Elige un docente --</option>
                   {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo a Cargo</label>
                <select className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl font-bold text-sm outline-none" value={newTutoria.nombre_grupo} onChange={e => setNewTutoria({...newTutoria, nombre_grupo: e.target.value})} required>
                   <option value="">-- Elige el grupo --</option>
                   {groupsMetadata.map(gm => <option key={gm.grupo} value={gm.grupo}>{gm.grupo} ({gm.carrera})</option>)}
                </select>
              </div>

              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all">{isSaving ? 'Guardando...' : 'Confirmar Asignación'}</button>
              <button type="button" onClick={() => setShowTutorModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MATERIAS */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingSubject ? 'Editar Materia' : 'Nueva Materia'}</h3>
            <form onSubmit={handleSaveSubject} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Código (Ej: IQ-101)" value={newSubject.codigo} onChange={e => setNewSubject({...newSubject, codigo: e.target.value})} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre de la Materia" value={newSubject.nombre} onChange={e => setNewSubject({...newSubject, nombre: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.carrera} onChange={e => setNewSubject({...newSubject, carrera: e.target.value as Career})} required>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newSubject.semestre} onChange={e => setNewSubject({...newSubject, semestre: parseInt(e.target.value)})} required>
                  {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Créditos SATCA</label>
                <input type="number" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Cantidad de créditos" value={newSubject.creditos} onChange={e => setNewSubject({...newSubject, creditos: parseInt(e.target.value)})} required />
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-800 transition-all">{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              <button type="button" onClick={() => setShowSubjectModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN DE CARGA */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8 flex items-center gap-3">
               <span className="text-3xl">📚</span>
               {isEditingGroup ? 'Editar Carga Docente' : 'Nueva Asignación de Grupo'}
            </h3>
            <form onSubmit={handleSaveGroup} className="space-y-6">
              <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtro Carrera</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold" value={modalAssignmentFilters.career} onChange={e => setModalAssignmentFilters({...modalAssignmentFilters, career: e.target.value})}>
                      <option value="">Todas...</option>
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Filtro Semestre</label>
                    <select className="w-full bg-white border border-gray-200 p-4 rounded-xl text-xs font-bold" value={modalAssignmentFilters.semester} onChange={e => setModalAssignmentFilters({...modalAssignmentFilters, semester: e.target.value})}>
                      <option value="ALL">Cualquiera...</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>{s}° Semestre</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Seleccionar Materia</label>
                   <select 
                    className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-sm" 
                    value={newGroup.materia_id} 
                    onChange={e => {
                      const mId = e.target.value;
                      setNewGroup({...newGroup, materia_id: mId});
                      // Sincronizar filtros automáticos según la materia seleccionada
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
                <select className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none" value={newGroup.docente_id} onChange={e => setNewGroup({...newGroup, docente_id: e.target.value})} required>
                  <option value="">-- Selecciona Docente --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Grupo (Matrícula)</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none" 
                    value={newGroup.nombre_grupo} 
                    onChange={e => setNewGroup({...newGroup, nombre_grupo: e.target.value})} 
                    required
                  >
                    <option value="">-- Selecciona --</option>
                    {modalFilteredExistingGroups.map(gm => <option key={gm.grupo} value={gm.grupo}>{gm.grupo} ({gm.turno})</option>)}
                  </select>
                  {modalFilteredExistingGroups.length === 0 && modalAssignmentFilters.career && (
                    <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 animate-pulse">
                      ⚠ No hay grupos registrados para {modalAssignmentFilters.career} en {modalAssignmentFilters.semester}° Sem.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Turno</label>
                  <select className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none" value={newGroup.turno} onChange={e => setNewGroup({...newGroup, turno: e.target.value})} required>
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                  </select>
                </div>
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

      {/* MODAL CARGA CSV */}
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

      {/* MODAL CICLOS */}
      {showCycleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">Nuevo Ciclo Escolar</h3>
            <form onSubmit={async (e) => { e.preventDefault(); setIsSaving(true); try { await supabase.from('ciclos_escolares').insert([newCycle]); setShowCycleModal(false); fetchData(); } finally { setIsSaving(false); } }} className="space-y-6">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" placeholder="Nombre (Ej: 2024-2025 I)" value={newCycle.nombre} onChange={e => setNewCycle({...newCycle, nombre: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_inicio} onChange={e => setNewCycle({...newCycle, fecha_inicio: e.target.value})} required />
                <input type="date" className="w-full bg-gray-50 border p-4 rounded-2xl font-bold text-sm" value={newCycle.fecha_fin} onChange={e => setNewCycle({...newCycle, fecha_fin: e.target.value})} required />
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase shadow-xl">Crear Ciclo</button>
              <button type="button" onClick={() => setShowCycleModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERSONAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-md p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-[#003B5C] mb-8">{isEditingUser ? 'Editar Personal' : 'Nuevo Registro de Personal'}</h3>
            <form onSubmit={async (e) => { e.preventDefault(); setIsSaving(true); try { if(isEditingUser) await supabase.from('docentes').update(newUser).eq('id', editingUserId); else await supabase.from('docentes').insert([newUser]); setShowUserModal(false); fetchData(); } finally { setIsSaving(false); } }} className="space-y-5">
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Número de Empleado" value={newUser.numero_empleado} onChange={e => setNewUser({...newUser, numero_empleado: e.target.value})} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Nombre Completo" value={newUser.nombre} onChange={e => setNewUser({...newUser, nombre: e.target.value})} required />
              <input type="email" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Correo UAS (@uas.edu.mx)" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
              <input type="text" className="w-full bg-gray-50 border p-4 rounded-xl font-bold text-sm" placeholder="Contraseña de acceso" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
              <div className="flex gap-2">
                 {[UserRole.DOCENTE, UserRole.TUTOR, UserRole.ADMIN].map(r => (
                   <button key={r} type="button" onClick={() => { const roles = newUser.rol.includes(r) ? newUser.rol.filter(x => x !== r) : [...newUser.rol, r]; setNewUser({...newUser, rol: roles}); }} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${newUser.rol.includes(r) ? 'bg-[#003B5C] text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{r}</button>
                 ))}
              </div>
              <button disabled={isSaving} className="w-full bg-[#003B5C] text-white py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">{isSaving ? 'Guardando...' : 'Confirmar'}</button>
              <button type="button" onClick={() => setShowUserModal(false)} className="w-full text-gray-400 font-bold text-[10px] uppercase text-center">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;