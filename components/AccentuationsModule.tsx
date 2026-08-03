import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CAREERS, UAS_COLORS } from '../constants';
import { Accentuation, Student } from '../types';

const AccentuationsModule: React.FC = () => {
    const [accentuations, setAccentuations] = useState<Accentuation[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);

    // Selection State
    const [selectedCareer, setSelectedCareer] = useState<string>(CAREERS[0]);
    const [selectedAccentuation, setSelectedAccentuation] = useState<string>('');

    // Assignment State
    const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Fetch available accentuations and students when career changes
    useEffect(() => {
        fetchData();
    }, [selectedCareer]);

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
        try {
            // Fetch Accentuations for this Career
            const { data: accData } = await supabase
                .from('acentuaciones')
                .select('*')
                .eq('carrera', selectedCareer)
                .order('nombre');

            setAccentuations(accData || []);
            if (accData && accData.length > 0) {
                setSelectedAccentuation(accData[0].id);
            } else {
                setSelectedAccentuation('');
            }

            // Fetch 8th Semester Students for this Career
            const { data: stData } = await supabase
                .from('estudiantes')
                .select('*')
                .eq('carrera', selectedCareer)
                .eq('semestre', 8)
                .order('nombre');

            setStudents((stData || []).map(s => ({
                ...s,
                name: s.nombre,
                career: s.carrera,
                semester: s.semestre,
                group: s.grupo,
                shift: s.turno,
                risk: 'LOW',
                attendance: 100,
                average: 10,
                personalFactors: [],
                academicFactors: [],
                institutionalFactors: []
            })));

        } catch (err) {
            console.error("Error fetching data:", err);
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

        // Optimistic Update
        const newStatus = !currentStatus;
        setAssignedStudentIds(prev => newStatus ? [...prev, studentId] : prev.filter(id => id !== studentId));

        try {
            if (newStatus) {
                // Assign
                await supabase.from('estudiantes_acentuacion').insert({
                    estudiante_id: studentId,
                    acentuacion_id: selectedAccentuation
                });
            } else {
                // Unassign
                await supabase.from('estudiantes_acentuacion').delete()
                    .eq('estudiante_id', studentId)
                    .eq('acentuacion_id', selectedAccentuation);
            }
        } catch (err) {
            alert("Error al actualizar asignación. Reintentando...");
            fetchAssignments(); // Revert on error
        }
    };

    const currentAccentuationData = accentuations.find(a => a.id === selectedAccentuation);
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.includes(searchTerm)
    );

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-10 bg-[#003B5C] text-white flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter">Módulo de Acentuaciones</h2>
                        <p className="text-blue-100 opacity-80 font-medium text-xs uppercase tracking-widest mt-1">
                            Gestión de Subgrupos • 8vo Semestre
                        </p>
                    </div>
                    <div className="bg-white/10 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                        Total 8vo: {students.length} Alumnos
                    </div>
                </div>

                <div className="p-10 space-y-8">
                    {/* 1. Career Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Programa Educativo</label>
                            <select
                                value={selectedCareer}
                                onChange={e => setSelectedCareer(e.target.value)}
                                className="w-full bg-white border border-gray-200 p-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                            >
                                {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* 2. Accentuation Selector (Cards) */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Seleccionar Acentuación</label>
                            {accentuations.length === 0 ? (
                                <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-400 text-xs font-bold">Sin acentuaciones registradas</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2">
                                    {accentuations.map(acc => (
                                        <button
                                            key={acc.id}
                                            onClick={() => setSelectedAccentuation(acc.id)}
                                            className={`text-left p-4 rounded-xl border transition-all flex justify-between items-center ${selectedAccentuation === acc.id
                                                ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]'
                                                : 'bg-white border-gray-100 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div>
                                                <p className={`text-xs font-black uppercase ${selectedAccentuation === acc.id ? 'text-[#003B5C]' : 'text-gray-600'}`}>
                                                    {acc.nombre}
                                                </p>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                    {acc.tipo_optativa}
                                                </span>
                                            </div>
                                            {selectedAccentuation === acc.id && <span className="text-xl">✅</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Assignment Area */}
                    {currentAccentuationData && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50 p-6 rounded-[2rem]">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 leading-none">
                                        {currentAccentuationData.nombre}
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                        {assignedStudentIds.length} Alumnos inscritos
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar alumno..."
                                    className="bg-white border border-gray-200 px-6 py-3 rounded-xl text-xs font-bold w-full md:w-64 outline-none focus:ring-2 focus:ring-blue-500/10"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredStudents.length === 0 ? (
                                    <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase text-xs">
                                        No hay alumnos de 8vo semestre en esta carrera o búsqueda sin resultados
                                    </div>
                                ) : filteredStudents.map(student => {
                                    const isAssigned = assignedStudentIds.includes(student.id);
                                    return (
                                        <div
                                            key={student.id}
                                            onClick={() => toggleAssignment(student.id, isAssigned)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] flex items-center justify-between group ${isAssigned
                                                ? 'bg-[#003B5C] border-[#003B5C] text-white shadow-xl'
                                                : 'bg-white border-gray-200 hover:border-blue-300 text-gray-500 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isAssigned ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-black uppercase leading-tight ${isAssigned ? 'text-white' : 'text-gray-800'}`}>
                                                        {student.name}
                                                    </span>
                                                    <span className={`text-[9px] font-mono font-bold ${isAssigned ? 'text-blue-200' : 'text-gray-400'}`}>
                                                        {student.id} • Gpo {student.group}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isAssigned ? 'border-[#FFD100] bg-[#FFD100]' : 'border-gray-200 bg-white'
                                                }`}>
                                                {isAssigned && <span className="text-[#003B5C] text-xs font-black">✓</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccentuationsModule;
