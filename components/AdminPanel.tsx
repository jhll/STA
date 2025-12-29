
import React, { useState, useEffect, useRef } from 'react';
import { CAREERS } from '../constants';
import { SQL_SCHEMA } from '../constants/sqlSchema';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import ManualGenerator from './ManualGenerator';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'upload' | 'subjects' | 'ciclos' | 'assignments' | 'manual'>('users');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [loadingCiclos, setLoadingCiclos] = useState(false);
  const [showCicloForm, setShowCicloForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Materias y Docentes
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [filterCareerSubjects, setFilterCareerSubjects] = useState(CAREERS[0]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [showSubjectForm, setShowSubjectForm] = useState(false);

  // Estados para Asignaciones
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [formAssignment, setFormAssignment] = useState({
    ciclo_id: '',
    materia_id: '',
    docente_id: '',
    nombre_grupo: '',
    turno: 'Matutino'
  });

  const [formCiclo, setFormCiclo] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: '',
    es_activo: false
  });

  const [uploadData, setUploadData] = useState({
    career: CAREERS[0],
    ciclo: '',
    group: '',
    shift: 'Matutino',
    semester: 1
  });

  const [formUser, setFormUser] = useState({
    numero_empleado: '',
    nombre: '',
    email: '',
    password: '',
    rol: 'DOCENTE'
  });

  const [formSubject, setFormSubject] = useState({
    codigo: '',
    nombre: '',
    carrera: CAREERS[0],
    semestre: 1,
    creditos: 5
  });

  const getErrorMessage = (err: any) => {
    if (!err) return "Error desconocido";
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return JSON.stringify(err);
  };

  // Funciones de carga de datos
  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const { data, error } = await supabase.from('docentes').select('*').order('nombre', { ascending: true });
      if (error) throw error;
      setTeachers(data || []);
    } catch (err: any) { 
      console.error("Error fetching teachers:", err); 
    } finally { 
      setLoadingTeachers(false); 
    }
  };

  const fetchSubjectsList = async () => {
    setLoadingSubjects(true);
    try {
      const { data, error } = await supabase
        .from('materias')
        .select('*')
        .eq('carrera', filterCareerSubjects)
        .order('semestre', { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (err: any) { 
      console.error("Error fetching subjects:", err); 
    } finally { 
      setLoadingSubjects(false); 
    }
  };

  const fetchCiclos = async () => {
    setLoadingCiclos(true);
    try {
      const { data, error } = await supabase.from('ciclos_escolares').select('*').order('fecha_inicio', { ascending: false });
      if (error) throw error;
      setCiclos(data || []);
      const activo = data?.find(c => c.es_activo);
      if (activo) {
        setUploadData(prev => ({ ...prev, ciclo: activo.id }));
        setFormAssignment(prev => ({ ...prev, ciclo_id: activo.id }));
      }
    } catch (err: any) { 
      console.error("Error fetching cycles:", err); 
    } finally { 
      setLoadingCiclos(false); 
    }
  };

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select(`
          id, 
          nombre_grupo, 
          turno, 
          materias (nombre, carrera, semestre), 
          docentes (nombre), 
          ciclos_escolares (nombre)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAssignments(data || []);
    } catch (err: any) { 
      console.error("Error fetching assignments:", err); 
    } finally { 
      setLoadingAssignments(false); 
    }
  };

  useEffect(() => {
    if (activeTab === 'users') fetchTeachers();
    if (activeTab === 'subjects') fetchSubjectsList();
    if (activeTab === 'ciclos' || activeTab === 'upload') fetchCiclos();
    if (activeTab === 'assignments') {
      fetchCiclos();
      fetchTeachers();
      fetchSubjectsList();
      fetchAssignments();
    }
  }, [activeTab, filterCareerSubjects]);

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAssignment.docente_id || !formAssignment.materia_id || !formAssignment.ciclo_id || !formAssignment.nombre_grupo) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('grupos').insert([formAssignment]);
      if (error) throw error;
      alert("Asignación académica guardada correctamente.");
      setShowAssignmentForm(false);
      fetchAssignments();
      setFormAssignment({ ...formAssignment, nombre_grupo: '', materia_id: '' });
    } catch (err: any) {
      alert("Error al asignar: " + getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase.from('docentes').update(formUser).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('docentes').insert([formUser]);
        if (error) throw error;
      }
      setShowRegisterForm(false);
      fetchTeachers();
      alert(`Docente ${isEditing ? 'actualizado' : 'registrado'} exitosamente.`);
    } catch (err: any) { 
      alert("Error: " + getErrorMessage(err)); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = isEditing ? await supabase.from('materias').update(formSubject).eq('id', editingId) : await supabase.from('materias').insert([formSubject]);
      if (error) throw error;
      setShowSubjectForm(false);
      fetchSubjectsList();
      alert("Materia guardada correctamente.");
    } catch (err: any) { 
      alert("Error: " + getErrorMessage(err)); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleSaveCiclo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = isEditing ? await supabase.from('ciclos_escolares').update(formCiclo).eq('id', editingId) : await supabase.from('ciclos_escolares').insert([formCiclo]);
      if (error) throw error;
      setShowCicloForm(false);
      fetchCiclos();
      alert("Ciclo escolar actualizado.");
    } catch (err: any) { 
      alert("Error: " + getErrorMessage(err)); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => setPreviewData(res.data) });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setPreviewData(XLSX.utils.sheet_to_json(ws));
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleConfirmUpload = async () => {
    if (previewData.length === 0) return;
    setIsUploading(true);
    try {
      const students = previewData.map(row => ({
        id: (row.Matrícula || row.matricula || Object.values(row)[0])?.toString(),
        nombre: (row.Nombre || row.nombre || Object.values(row)[1])?.toString(),
        carrera: uploadData.career,
        semestre: uploadData.semester,
        grupo: uploadData.group,
        turno: uploadData.shift,
        ciclo_id: uploadData.ciclo,
        nivel_riesgo: 'LOW'
      })).filter(s => s.id && s.nombre);
      const { error } = await supabase.from('estudiantes').insert(students);
      if (error) throw error;
      alert(`✅ ${students.length} alumnos matriculados.`);
      setPreviewData([]);
    } catch (err: any) { 
      alert("Error en la carga: " + getErrorMessage(err)); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    alert("Script SQL copiado al portapapeles.");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 border border-gray-100 overflow-hidden">
        <div className="p-10 bg-gradient-to-r from-blue-700 to-indigo-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">Administración STA</h2>
            <p className="text-blue-100 opacity-80 font-medium">Panel de gestión institucional FCQB.</p>
          </div>
          <button onClick={() => setShowSqlModal(true)} className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95">Script SQL</button>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50/30 overflow-x-auto">
          <button onClick={() => setActiveTab('users')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'users' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Docentes</button>
          <button onClick={() => setActiveTab('subjects')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'subjects' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Materias</button>
          <button onClick={() => setActiveTab('assignments')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'assignments' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Asignaciones</button>
          <button onClick={() => setActiveTab('ciclos')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'ciclos' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Ciclos</button>
          <button onClick={() => setActiveTab('upload')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'upload' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Carga Alumnos</button>
          <button onClick={() => setActiveTab('manual')} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest border-b-2 ${activeTab === 'manual' ? 'text-blue-600 border-blue-600 bg-white' : 'text-gray-400 hover:text-gray-900'}`}>Manual IA</button>
        </div>

        <div className="p-10">
          {activeTab === 'manual' && <ManualGenerator />}
          
          {activeTab === 'assignments' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Carga Académica Docente</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Vinculación de profesores con grupos y materias</p>
                  </div>
                  <button 
                    onClick={() => setShowAssignmentForm(true)} 
                    className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all"
                  >
                    + Nueva Asignación
                  </button>
               </div>

               <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Docente</th>
                        <th className="px-8 py-5">Asignatura / Carrera</th>
                        <th className="px-8 py-5">Grupo / Turno</th>
                        <th className="px-8 py-5">Ciclo</th>
                        <th className="px-8 py-5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingAssignments ? (
                        <tr><td colSpan={5} className="py-20 text-center animate-pulse">Consultando asignaciones...</td></tr>
                      ) : assignments.length === 0 ? (
                        <tr><td colSpan={5} className="py-20 text-center text-gray-400 font-medium">No hay asignaciones registradas para este periodo.</td></tr>
                      ) : assignments.map(asig => (
                        <tr key={asig.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-6">
                            <p className="font-bold text-gray-900">{asig.docentes?.nombre}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="font-bold text-blue-600 text-xs">{asig.materias?.nombre}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{asig.materias?.carrera}</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-black">{asig.nombre_grupo}</span>
                              <span className="text-xs text-gray-500">{asig.turno}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-xs text-gray-500 font-bold">{asig.ciclos_escolares?.nombre}</td>
                          <td className="px-8 py-6 text-right">
                             <button className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900">Personal Académico</h3>
                <button onClick={() => { setIsEditing(false); setFormUser({numero_empleado: '', nombre: '', email: '', password: '', rol: 'DOCENTE'}); setShowRegisterForm(true); }} className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600">Registrar Docente</button>
              </div>
              <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                    <tr><th className="px-8 py-5">No. Empleado</th><th className="px-8 py-5">Nombre</th><th className="px-8 py-5">Email</th><th className="px-8 py-5 text-right">Acción</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingTeachers ? <tr><td colSpan={4} className="py-10 text-center animate-pulse">Cargando...</td></tr> : teachers.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 font-mono text-xs font-black text-blue-600">{t.numero_empleado}</td>
                        <td className="px-8 py-5 font-bold">{t.nombre}</td>
                        <td className="px-8 py-5 text-gray-500">{t.email}</td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => { setFormUser(t); setEditingId(t.id); setIsEditing(true); setShowRegisterForm(true); }} className="p-2 bg-gray-100 rounded-lg hover:bg-blue-600 hover:text-white transition-all">✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Malla Curricular</h3>
                  <select value={filterCareerSubjects} onChange={(e) => setFilterCareerSubjects(e.target.value)} className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-gray-600 outline-none">
                    {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={() => { setIsEditing(false); setFormSubject({codigo: '', nombre: '', carrera: filterCareerSubjects, semestre: 1, creditos: 5}); setShowSubjectForm(true); }} className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600">Añadir Materia</button>
              </div>
              <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest">
                    <tr><th className="px-8 py-5">Código</th><th className="px-8 py-5">Nombre</th><th className="px-8 py-5">Semestre</th><th className="px-8 py-5 text-right">Créditos</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subjects.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-5 font-mono text-xs font-black text-indigo-600">{s.codigo}</td>
                        <td className="px-8 py-5 font-bold">{s.nombre}</td>
                        <td className="px-8 py-5 text-gray-500">{s.semestre}° Semestre</td>
                        <td className="px-8 py-5 text-right font-black text-blue-600">{s.creditos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ciclos' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Periodos Académicos</h3>
                  <button onClick={() => { setIsEditing(false); setFormCiclo({nombre: '', fecha_inicio: '', fecha_fin: '', es_activo: true}); setShowCicloForm(true); }} className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl">+ Definir Ciclo</button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {ciclos.map(c => (
                   <div key={c.id} className={`p-8 rounded-[2rem] border relative group transition-all cursor-pointer ${c.es_activo ? 'border-blue-500 bg-blue-50/20 shadow-xl' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}>
                      {c.es_activo && <span className="absolute top-4 right-4 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full">ACTIVO</span>}
                      <h4 className="text-xl font-black text-gray-900">{c.nombre}</h4>
                      <p className="text-[10px] text-gray-400 mt-2 uppercase font-black tracking-widest">{c.fecha_inicio} a {c.fecha_fin}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-12 animate-in fade-in duration-300">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv, .xlsx, .xls" />
              {previewData.length > 0 ? (
                <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 flex justify-between items-center">
                   <p className="text-blue-900 font-black tracking-tight">{previewData.length} registros listos para matricular en grupo {uploadData.group} ({uploadData.shift}).</p>
                   <div className="flex gap-4">
                     <button onClick={() => setPreviewData([])} className="px-6 py-3 font-bold text-gray-400 uppercase text-xs">Descartar</button>
                     <button onClick={handleConfirmUpload} disabled={isUploading} className="bg-gray-900 text-white px-8 py-4 rounded-xl font-black text-xs uppercase shadow-xl disabled:opacity-50">Confirmar Carga</button>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  <div className="lg:col-span-1 bg-gray-50 p-8 rounded-[2rem] border border-gray-100 shadow-inner space-y-4">
                    <h3 className="text-xl font-black text-gray-900 mb-4">Configurar Lote</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ciclo Escolar</label>
                      <select value={uploadData.ciclo} onChange={(e) => setUploadData({...uploadData, ciclo: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-xs font-black outline-none">
                        <option value="">Seleccione ciclo...</option>
                        {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.es_activo ? '(ACTIVO)' : ''}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Programa Educativo</label>
                      <select value={uploadData.career} onChange={(e) => setUploadData({...uploadData, career: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-xs font-black outline-none">
                        {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
                        <input type="number" placeholder="Ej: 3" value={uploadData.semester} onChange={(e) => setUploadData({...uploadData, semester: parseInt(e.target.value)})} className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-xs font-black text-gray-700 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Grupo</label>
                        <input type="text" placeholder="Ej: 301" value={uploadData.group} onChange={(e) => setUploadData({...uploadData, group: e.target.value.toUpperCase()})} className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-xs font-black text-gray-700 outline-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Turno del Grupo</label>
                      <select value={uploadData.shift} onChange={(e) => setUploadData({...uploadData, shift: e.target.value})} className="w-full bg-white border border-gray-200 p-4 rounded-2xl text-xs font-black outline-none">
                        <option value="Matutino">Matutino</option>
                        <option value="Vespertino">Vespertino</option>
                      </select>
                    </div>
                  </div>
                  <div onClick={() => fileInputRef.current?.click()} className="lg:col-span-2 border-4 border-dashed rounded-[3rem] p-20 text-center bg-gray-50 hover:bg-blue-50 cursor-pointer group transition-all flex flex-col items-center justify-center">
                     <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">📁</span>
                     <h4 className="text-2xl font-black text-gray-900 tracking-tight">Cargar Archivo de Alumnos</h4>
                     <p className="text-gray-400 text-xs mt-2 uppercase font-black tracking-widest leading-relaxed">Sube la lista en formato Excel (.xlsx) o CSV con columnas: Matrícula y Nombre</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSqlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1a1c23] rounded-[3rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Esquema de Base de Datos (Supabase)</h3>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">STA-FCQB CORE SQL v3.0</p>
              </div>
              <div className="flex gap-4">
                <button onClick={copyToClipboard} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">Copiar Script</button>
                <button onClick={() => setShowSqlModal(false)} className="text-white/40 hover:text-white transition-colors text-2xl">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 font-mono text-sm">
              <pre className="text-blue-100 bg-black/40 p-10 rounded-[2rem] border border-white/5 whitespace-pre-wrap">{SQL_SCHEMA}</pre>
            </div>
            <div className="p-8 border-t border-white/5 bg-white/5 text-center">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest italic">Pega este script en el SQL Editor de tu proyecto Supabase para inicializar las tablas.</p>
            </div>
          </div>
        </div>
      )}

      {showAssignmentForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black text-gray-900">Vincular Docente a Grupo</h3>
              <button onClick={() => setShowAssignmentForm(false)} className="text-gray-400 hover:text-gray-900 transition-colors text-2xl">✕</button>
            </div>
            <form onSubmit={handleSaveAssignment} className="p-10 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ciclo Escolar Activo</label>
                <select value={formAssignment.ciclo_id} onChange={e => setFormAssignment({...formAssignment, ciclo_id: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                  <option value="">Seleccione ciclo...</option>
                  {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.es_activo ? '(ACTUAL)' : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Docente Responsable</label>
                <select value={formAssignment.docente_id} onChange={e => setFormAssignment({...formAssignment, docente_id: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                  <option value="">Seleccione docente...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Materia (Filtrada por {filterCareerSubjects})</label>
                <select value={formAssignment.materia_id} onChange={e => setFormAssignment({...formAssignment, materia_id: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                  <option value="">Seleccione asignatura...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.semestre}° Sem)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre del Grupo</label>
                  <input type="text" placeholder="Ej: 301" value={formAssignment.nombre_grupo} onChange={e => setFormAssignment({...formAssignment, nombre_grupo: e.target.value.toUpperCase()})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Turno</label>
                  <select value={formAssignment.turno} onChange={e => setFormAssignment({...formAssignment, turno: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none">
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                  </select>
                </div>
              </div>
              <button disabled={isSaving} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all disabled:opacity-50 mt-4">{isSaving ? 'Vinculando...' : 'Confirmar Asignación'}</button>
            </form>
          </div>
        </div>
      )}

      {(showRegisterForm || showSubjectForm || showCicloForm) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-2xl font-black text-gray-900">{showRegisterForm ? 'Datos del Docente' : showSubjectForm ? 'Datos de la Materia' : 'Configurar Periodo'}</h3>
              <button onClick={() => { setShowRegisterForm(false); setShowSubjectForm(false); setShowCicloForm(false); }} className="text-gray-300 hover:text-gray-900 transition-colors text-2xl">✕</button>
            </div>
            <form onSubmit={showRegisterForm ? handleSubmitTeacher : showSubjectForm ? handleSaveSubject : handleSaveCiclo} className="p-10 space-y-6">
              {showRegisterForm && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número de Empleado</label>
                    <input type="text" placeholder="Ej: 1234567" value={formUser.numero_empleado} onChange={e => setFormUser({...formUser, numero_empleado: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                    <input type="text" placeholder="Nombre y Apellidos" value={formUser.nombre} onChange={e => setFormUser({...formUser, nombre: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Correo UAS</label>
                    <input type="email" placeholder="ejemplo@uas.edu.mx" value={formUser.email} onChange={e => setFormUser({...formUser, email: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contraseña de Acceso</label>
                    <input type="password" placeholder="••••••••" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required={!isEditing} />
                    {isEditing && <p className="text-[9px] text-gray-400 mt-1 italic">Dejar vacío si no se desea cambiar la contraseña actual.</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rol en el Sistema</label>
                    <select value={formUser.rol} onChange={e => setFormUser({...formUser, rol: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                      <option value="DOCENTE">DOCENTE TUTOR</option>
                      <option value="ADMIN">ADMINISTRADOR</option>
                    </select>
                  </div>
                </>
              )}
              {showSubjectForm && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Programa Educativo (Carrera)</label>
                    <select 
                      value={formSubject.carrera} 
                      onChange={e => setFormSubject({...formSubject, carrera: e.target.value})} 
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    >
                      {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Código de Materia</label>
                    <input type="text" placeholder="Ej: QUIM101" value={formSubject.codigo} onChange={e => setFormSubject({...formSubject, codigo: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre de la Asignatura</label>
                    <input type="text" placeholder="Ej: Bioquímica Aplicada" value={formSubject.nombre} onChange={e => setFormSubject({...formSubject, nombre: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre</label>
                      <input type="number" placeholder="Semestre" value={formSubject.semestre} onChange={e => setFormSubject({...formSubject, semestre: parseInt(e.target.value)})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Créditos</label>
                      <input type="number" placeholder="Créditos" value={formSubject.creditos} onChange={e => setFormSubject({...formSubject, creditos: parseInt(e.target.value)})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                  </div>
                </>
              )}
              {showCicloForm && (
                <>
                  <input type="text" placeholder="Ej: 2024-2025 Ciclo I" value={formCiclo.nombre} onChange={e => setFormCiclo({...formCiclo, nombre: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none" required />
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fecha Inicio</label><input type="date" value={formCiclo.fecha_inicio} onChange={e => setFormCiclo({...formCiclo, fecha_inicio: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none" required /></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fecha Fin</label><input type="date" value={formCiclo.fecha_fin} onChange={e => setFormCiclo({...formCiclo, fecha_fin: e.target.value})} className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl text-sm font-bold outline-none" required /></div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <input type="checkbox" checked={formCiclo.es_activo} onChange={e => setFormCiclo({...formCiclo, es_activo: e.target.checked})} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-bold text-blue-900">Establecer como ciclo activo</span>
                  </label>
                </>
              )}
              <button disabled={isSaving} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all disabled:opacity-50">{isSaving ? 'Guardando...' : 'Confirmar Registro'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
