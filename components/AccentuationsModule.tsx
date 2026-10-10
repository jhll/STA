import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CAREERS, SPECIALTY_SEMESTERS, isSpecialtySemester } from '../constants';
import { Accentuation, Student } from '../types';

const AccentuationsModule: React.FC = () => {
    const [accentuations, setAccentuations] = useState<Accentuation[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);

    // Selection State
    const [selectedCareer, setSelectedCareer] = useState<string>(CAREERS[2]); // Default QFB
    const [selectedSemester, setSelectedSemester] = useState<string>('7'); // 7, 8, 9 o ALL
    const [selectedAccentuation, setSelectedAccentuation] = useState<string>('');

    // Filter by original student group to easily divide groups
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');

    // Assignment State
    const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
    const [allStudentAssignments, setAllStudentAssignments] = useState<Record<string, { accId: string; accName: string; tipo: string }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Fetch available accentuations and students when career or semester changes
    useEffect(() => {
        fetchData();
    }, [selectedCareer, selectedSemester]);

    // 2. Refresh assignment status when accentuation changes
    useEffect(() => {
        if (selectedAccentuation) {
            fetchAssignments();
        } else {
            setAssignedStudentIds([]);
        }
    }, [selectedAccentuation]);

    const fetchData = async () => {
        setLoading(true);
        setSearchTerm('');
        setSelectedGroupFilter('ALL');
        try {
            // 1. Fetch Accentuations for this Career & Semester
            let accQuery = supabase
                .from('acentuaciones')
                .select('*')
                .eq('carrera', selectedCareer)
                .order('semestre', { ascending: true })
                .order('nombre');

            const { data: accData } = await accQuery;

            const filteredAccs = (accData || []).filter(a => {
                if (selectedSemester === 'ALL') return true;
                const sem = parseInt(selectedSemester);
                return a.semestre === sem || (!a.semestre && sem === 8);
            });

            setAccentuations(filteredAccs);
            if (filteredAccs.length > 0) {
                // If previously selected accentuation is in the new list, keep it, else pick the first
                const exists = filteredAccs.find(a => a.id === selectedAccentuation);
                setSelectedAccentuation(exists ? exists.id : filteredAccs[0].id);
            } else {
                setSelectedAccentuation('');
            }

            // 2. Fetch Students for Specialty Semesters (7, 8, 9)
            let stQuery = supabase
                .from('estudiantes')
                .select('*')
                .eq('carrera', selectedCareer)
                .order('semestre', { ascending: true })
                .order('grupo', { ascending: true })
                .order('nombre');

            if (selectedSemester !== 'ALL') {
                stQuery = stQuery.eq('semestre', parseInt(selectedSemester));
            } else {
                stQuery = stQuery.in('semestre', [7, 8, 9]);
            }

            const { data: stData } = await stQuery;
            const mappedStudents: Student[] = (stData || []).map(s => ({
                ...s,
                name: s.nombre,
                career: s.carrera,
                semester: s.semestre,
                group: s.grupo,
                shift: s.turno,
                risk: s.nivel_riesgo || 'LOW',
                attendance: s.porcentaje_asistencia || 100,
                average: Number(s.promedio_acumulado || 0),
                personalFactors: [],
                academicFactors: [],
                institutionalFactors: []
            }));
            setStudents(mappedStudents);

            // 3. Fetch all assignments for these students to know which accentuation they have
            if (mappedStudents.length > 0) {
                const stIds = mappedStudents.map(s => s.id);
                const { data: stAccData } = await supabase
                    .from('estudiantes_acentuacion')
                    .select('estudiante_id, acentuacion_id, acentuaciones(id, nombre, tipo_optativa)')
                    .in('estudiante_id', stIds);

                const map: Record<string, { accId: string; accName: string; tipo: string }> = {};
                (stAccData || []).forEach((row: any) => {
                    const accObj = Array.isArray(row.acentuaciones) ? row.acentuaciones[0] : row.acentuaciones;
                    if (accObj) {
                        map[row.estudiante_id] = {
                            accId: row.acentuacion_id,
                            accName: accObj.nombre,
                            tipo: accObj.tipo_optativa
                        };
                    }
                });
                setAllStudentAssignments(map);
            } else {
                setAllStudentAssignments({});
            }

        } catch (err) {
            console.error("Error fetching specialty accentuations data:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignments = async () => {
        if (!selectedAccentuation) return;
        try {
            const { data } = await supabase
                .from('estudiantes_acentuacion')
                .select('estudiante_id')
                .eq('acentuacion_id', selectedAccentuation);

            setAssignedStudentIds(data?.map(d => d.estudiante_id) || []);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleAssignment = async (studentId: string, currentStatus: boolean) => {
        if (!selectedAccentuation) return;

        const newStatus = !currentStatus;
        setAssignedStudentIds(prev => newStatus ? [...prev, studentId] : prev.filter(id => id !== studentId));

        // Update local lookup map
        const currentAcc = accentuations.find(a => a.id === selectedAccentuation);
        setAllStudentAssignments(prev => {
            const next = { ...prev };
            if (newStatus && currentAcc) {
                next[studentId] = { accId: currentAcc.id, accName: currentAcc.nombre, tipo: currentAcc.tipo_optativa };
            } else if (!newStatus && next[studentId]?.accId === selectedAccentuation) {
                delete next[studentId];
            }
            return next;
        });

        try {
            if (newStatus) {
                // Assign to this accentuation
                await supabase.from('estudiantes_acentuacion').upsert({
                    estudiante_id: studentId,
                    acentuacion_id: selectedAccentuation
                }, { onConflict: 'estudiante_id,acentuacion_id' });
            } else {
                // Unassign
                await supabase.from('estudiantes_acentuacion').delete()
                    .eq('estudiante_id', studentId)
                    .eq('acentuacion_id', selectedAccentuation);
            }
        } catch (err) {
            alert("Error al actualizar asignación. Reintentando...");
            fetchAssignments();
        }
    };

    // Bulk assign / unassign filtered students
    const handleBulkAssignFiltered = async (assign: boolean) => {
        if (!selectedAccentuation || filteredStudents.length === 0) return;
        setIsSaving(true);
        try {
            const targetIds = filteredStudents.map(s => s.id);
            if (assign) {
                const inserts = targetIds.map(id => ({
                    estudiante_id: id,
                    acentuacion_id: selectedAccentuation
                }));
                await supabase.from('estudiantes_acentuacion').upsert(inserts, { onConflict: 'estudiante_id,acentuacion_id' });
            } else {
                await supabase.from('estudiantes_acentuacion')
                    .delete()
                    .eq('acentuacion_id', selectedAccentuation)
                    .in('estudiante_id', targetIds);
            }
            await fetchAssignments();
            await fetchData();
        } catch (err: any) {
            alert("Error en asignación masiva: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentAccentuationData = accentuations.find(a => a.id === selectedAccentuation);

    // Unique groups for base group filter
    const availableBaseGroups = Array.from(new Set(students.map(s => s.group).filter(Boolean))).sort();

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm);
        const matchesGroup = selectedGroupFilter === 'ALL' || s.group === selectedGroupFilter;
        return matchesSearch && matchesGroup;
    });

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                {/* Header Principal */}
                <div className="p-10 bg-[#003B5C] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-[#FFD100] text-[#003B5C] px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                Acentuación de Especialidad
                            </span>
                            <span className="text-blue-200 text-xs font-bold">• Semestres 7°, 8° y 9°</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter">Módulo de Acentuaciones y Subgrupos</h2>
                        <p className="text-blue-100 opacity-80 font-medium text-xs uppercase tracking-widest mt-1">
                            División de grupos en subgrupos de Optativa Libre para todas las carreras (QFB, IBQ, IQ, BG)
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-center">
                            <span className="block text-xl font-black text-[#FFD100]">{students.length}</span>
                            Alumnos en Fase
                        </div>
                        <div className="bg-white/10 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-center">
                            <span className="block text-xl font-black text-white">{accentuations.length}</span>
                            Optativas
                        </div>
                    </div>
                </div>

                <div className="p-8 md:p-10 space-y-8">
                    {/* Filtros Superiores: Programa Educativo y Semestre */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                        {/* 1. Selector de Carrera */}
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Programa Educativo</label>
                            <select
                                value={selectedCareer}
                                onChange={e => setSelectedCareer(e.target.value)}
                                className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                            >
                                {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* 2. Selector de Semestre (7, 8, 9 o Todos) */}
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Semestre de Especialidad</label>
                            <select
                                value={selectedSemester}
                                onChange={e => setSelectedSemester(e.target.value)}
                                className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                            >
                                <option value="7">7° Semestre (Acentuación I)</option>
                                <option value="8">8° Semestre (Acentuación II)</option>
                                <option value="9">9° Semestre (Acentuación III)</option>
                                <option value="ALL">Todos los semestres de especialidad (7°, 8° y 9°)</option>
                            </select>
                        </div>

                        {/* 3. Selector de Grupo Base para dividir */}
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filtrar por Grupo Base</label>
                            <select
                                value={selectedGroupFilter}
                                onChange={e => setSelectedGroupFilter(e.target.value)}
                                className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                            >
                                <option value="ALL">TODOS LOS GRUPOS BASE ({students.length} alumnos)</option>
                                {availableBaseGroups.map(g => {
                                    const count = students.filter(s => s.group === g).length;
                                    return (
                                        <option key={g} value={g}>
                                            Grupo {g} ({count} alumnos)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Selector de Acentuación / Subgrupo */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Seleccionar Tema de Acentuación / Subgrupo de Optativa Libre
                            </label>
                            <span className="text-[10px] font-bold text-gray-400">
                                {accentuations.length} opciones disponibles
                            </span>
                        </div>

                        {accentuations.length === 0 ? (
                            <div className="p-8 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-center space-y-2">
                                <p className="text-amber-900 font-black text-xs uppercase tracking-wider">
                                    No hay temas de acentuación registrados para {selectedCareer} en {selectedSemester === 'ALL' ? '7°, 8° y 9°' : `${selectedSemester}° Semestre`}.
                                </p>
                                <p className="text-[11px] text-amber-700">
                                    Puedes generarlos con 1 clic en la pestaña <strong>Materias → "⚡ Generar Acentuaciones y Optativas (7°, 8°, 9°)"</strong>.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                                {accentuations.map(acc => {
                                    const isSelected = selectedAccentuation === acc.id;
                                    return (
                                        <button
                                            key={acc.id}
                                            onClick={() => setSelectedAccentuation(acc.id)}
                                            className={`text-left p-4 rounded-2xl border transition-all flex justify-between items-center ${
                                                isSelected
                                                    ? 'bg-[#003B5C] border-[#003B5C] text-white shadow-lg scale-[1.02]'
                                                    : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <p className={`text-xs font-black uppercase leading-snug ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                    {acc.nombre}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {acc.tipo_optativa}
                                                    </span>
                                                    <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                                        {acc.semestre || 8}° Semestre
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && <span className="text-lg text-[#FFD100]">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Área de Asignación y División de Alumnos */}
                    {currentAccentuationData && (
                        <div className="space-y-6 pt-4 border-t border-gray-100 animate-in slide-in-from-bottom-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[9px] font-black uppercase">
                                            {currentAccentuationData.tipo_optativa}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-bold">
                                            {currentAccentuationData.semestre || 8}° Semestre
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-[#003B5C] tracking-tight mt-1">
                                        SUB - {currentAccentuationData.nombre}
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                        {assignedStudentIds.length} Alumnos asignados a este subgrupo
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre o matrícula..."
                                        className="bg-white border border-gray-200 px-5 py-3 rounded-xl text-xs font-bold w-full sm:w-64 outline-none focus:ring-2 focus:ring-[#003B5C]/20"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    {selectedGroupFilter !== 'ALL' && (
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleBulkAssignFiltered(true)}
                                                className="px-4 py-2.5 bg-[#003B5C] text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-blue-900 transition-all shadow-sm disabled:opacity-50"
                                                title={`Asignar todos los alumnos del Grupo ${selectedGroupFilter} a este subgrupo`}
                                            >
                                                + Asignar Todo Gpo {selectedGroupFilter}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSaving}
                                                onClick={() => handleBulkAssignFiltered(false)}
                                                className="px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-red-50 transition-all shadow-sm disabled:opacity-50"
                                                title={`Quitar a los alumnos del Grupo ${selectedGroupFilter} de este subgrupo`}
                                            >
                                                Desasignar Gpo {selectedGroupFilter}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Grid de Estudiantes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredStudents.length === 0 ? (
                                    <div className="col-span-full py-16 text-center text-gray-300 font-black uppercase text-xs">
                                        No se encontraron alumnos con los criterios seleccionados
                                    </div>
                                ) : (
                                    filteredStudents.map(student => {
                                        const isAssigned = assignedStudentIds.includes(student.id);
                                        const otherAcc = !isAssigned ? allStudentAssignments[student.id] : null;

                                        return (
                                            <div
                                                key={student.id}
                                                onClick={() => toggleAssignment(student.id, isAssigned)}
                                                className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-between group ${
                                                    isAssigned
                                                        ? 'bg-[#003B5C] border-[#003B5C] text-white shadow-lg ring-2 ring-[#003B5C]/20'
                                                        : 'bg-white border-gray-200 hover:border-blue-400 text-gray-700 hover:shadow-md'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                                                        isAssigned ? 'bg-white/20 text-[#FFD100]' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-xs font-black uppercase leading-tight ${
                                                            isAssigned ? 'text-white' : 'text-gray-900'
                                                        }`}>
                                                            {student.name}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                            <span className={`text-[9px] font-mono font-bold ${
                                                                isAssigned ? 'text-blue-200' : 'text-gray-400'
                                                            }`}>
                                                                {student.id} • {student.semester}° Gpo {student.group}
                                                            </span>
                                                            {otherAcc && (
                                                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[8px] font-black rounded uppercase" title={`Ya asignado a: ${otherAcc.accName}`}>
                                                                    En: {otherAcc.accName.slice(0, 15)}...
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                                    isAssigned ? 'border-[#FFD100] bg-[#FFD100]' : 'border-gray-200 bg-white'
                                                }`}>
                                                    {isAssigned && <span className="text-[#003B5C] text-xs font-black">✓</span>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccentuationsModule;
