import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { CAREERS } from '../constants';
import { CicloEscolar } from '../types';
import TeacherCertificateModal from './TeacherCertificateModal';

interface TeacherAnalyticsData {
    docenteId: string;
    docenteNombre: string;
    grupoId: string;
    grupoNombre: string;
    materiaNombre: string;
    carrera: string;
    semestre: number;
    cicloNombre: string;
    actividadesCount: number;
    asistenciasCount: number;
    lastActivityDate: string | null;
    lastAttendanceDate: string | null;
}

interface TeacherAnalyticsProps {
    selectedCycleId?: string;
}

const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ selectedCycleId: externalCycleId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TeacherAnalyticsData[]>([]);
    const [cycles, setCycles] = useState<CicloEscolar[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>(externalCycleId || 'ALL');
    const [selectedCareer, setSelectedCareer] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeacherCertId, setSelectedTeacherCertId] = useState<string | null>(null);

    useEffect(() => {
        if (externalCycleId !== undefined) {
            setSelectedCycleId(externalCycleId);
        }
    }, [externalCycleId]);

    const fetchCycles = async () => {
        try {
            const { data } = await supabase
                .from('ciclos_escolares')
                .select('*')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                setCycles(data);
            }
        } catch (err) {
            console.error("Error al cargar ciclos en TeacherAnalytics:", err);
        }
    };

    const fetchAllRecords = async (table: string, selectQuery: string) => {
        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(table)
                .select(selectQuery)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;

            if (data) {
                allData = [...allData, ...data];
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
            page++;
        }
        return allData;
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            fetchCycles();

            // 1. Fetch Groups filtered by cycle if selected
            let groupQuery = supabase
                .from('grupos')
                .select(`
                    id,
                    nombre_grupo,
                    docente_id,
                    ciclo_id,
                    ciclos_escolares (nombre),
                    docentes (id, nombre),
                    materias (nombre, carrera, semestre)
                `);

            if (selectedCycleId !== 'ALL') {
                groupQuery = groupQuery.or(`ciclo_id.eq.${selectedCycleId},ciclo_id.is.null`);
            }

            const { data: groups, error: groupsErr } = await groupQuery;
            if (groupsErr) throw groupsErr;

            // 2. Fetch ALL Activities
            const activities = await fetchAllRecords('actividades', 'grupo_id, created_at');

            // 3. Fetch ALL Attendance
            const attendance = await fetchAllRecords('asistencias', 'grupo_id, fecha');

            // Process Data
            const processed: TeacherAnalyticsData[] = (groups || []).map((group: any) => {
                const docente = Array.isArray(group.docentes) ? group.docentes[0] : group.docentes;
                const materia = Array.isArray(group.materias) ? group.materias[0] : group.materias;
                const ciclo = Array.isArray(group.ciclos_escolares) ? group.ciclos_escolares[0] : group.ciclos_escolares;

                // Filter activities for this group
                const groupActivities = activities.filter((a: any) => a.grupo_id === group.id);
                const activitiesCount = groupActivities.length;

                // Find last activity date
                let lastActivityDate = null;
                if (groupActivities.length > 0) {
                    const sortedActs = groupActivities.map((a: any) => a.created_at).sort();
                    lastActivityDate = sortedActs[sortedActs.length - 1];
                }

                // Filter attendance for this group and count unique dates
                const groupAttendance = attendance.filter((a: any) => a.grupo_id === group.id);
                const uniqueDates = new Set(groupAttendance.map((a: any) => a.fecha));
                const asistenciasCount = uniqueDates.size;

                // Find last attendance date
                let lastAttendanceDate = null;
                if (groupAttendance.length > 0) {
                    const sortedDates = groupAttendance.map((a: any) => a.fecha).sort();
                    lastAttendanceDate = sortedDates[sortedDates.length - 1];
                }

                return {
                    docenteId: docente?.id || 'N/A',
                    docenteNombre: docente?.nombre || 'Sin Asignar',
                    grupoId: group.id,
                    grupoNombre: group.nombre_grupo,
                    materiaNombre: materia?.nombre || 'Sin Materia',
                    carrera: materia?.carrera || 'N/A',
                    semestre: materia?.semestre || 0,
                    cicloNombre: ciclo?.nombre || '2025-2026-2',
                    actividadesCount: activitiesCount,
                    asistenciasCount,
                    lastActivityDate,
                    lastAttendanceDate
                };
            });

            setData(processed);

        } catch (err) {
            console.error("Error fetching teacher analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [selectedCycleId]);

    // Filter Data
    const filteredData = data.filter(item => {
        const careerMatch = selectedCareer === 'ALL' || item.carrera === selectedCareer;
        const searchMatch = !searchTerm ||
            item.docenteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.materiaNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.grupoNombre.toLowerCase().includes(searchTerm.toLowerCase());

        return careerMatch && searchMatch;
    });

    if (loading) {
        return (
            <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
                <div className="h-6 w-1/3 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
                <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
                <div className="h-4 w-2/3 bg-gray-100 rounded"></div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-black text-[#003B5C]">Desempeño Docente por Clase</h3>
                    <p className="text-sm text-gray-400">Monitoreo de actividad en plataforma y cumplimiento de asistencia.</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                    <button
                        onClick={() => {
                            const headers = ['Docente', 'ID Docente', 'Materia', 'Grupo', 'Carrera', 'Semestre', 'Actividades', 'Días Asistencia', 'Última Actividad', 'Último Pase', 'Estado'];
                            const csvContent = [
                                headers.join(','),
                                ...filteredData.map(row => [
                                    `"${row.docenteNombre}"`,
                                    `"${row.docenteId}"`,
                                    `"${row.materiaNombre}"`,
                                    `"${row.grupoNombre}"`,
                                    `"${row.carrera}"`,
                                    row.semestre,
                                    row.actividadesCount,
                                    row.asistenciasCount,
                                    row.lastActivityDate ? new Date(row.lastActivityDate).toLocaleDateString('es-MX') : 'N/A',
                                    row.lastAttendanceDate ? new Date(row.lastAttendanceDate).toLocaleDateString('es-MX') : 'N/A',
                                    (row.actividadesCount > 0 || row.asistenciasCount > 0) ? 'ACTIVO' : 'INACTIVO'
                                ].join(','))
                            ].join('\n');

                            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement("a");
                            const url = URL.createObjectURL(blob);
                            link.setAttribute("href", url);
                            link.setAttribute("download", `reporte_docente_sta_${new Date().toISOString().slice(0, 10)}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                        <span>📥</span> CSV
                    </button>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar docente, materia..."
                            className="w-full sm:w-64 bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    </div>

                    <select
                        className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer"
                        value={selectedCareer}
                        onChange={e => setSelectedCareer(e.target.value)}
                    >
                        <option value="ALL">TODAS LAS CARRERAS</option>
                        {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        className="bg-blue-50/60 border border-blue-200 text-[#003B5C] p-3 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer shadow-sm"
                        value={selectedCycleId}
                        onChange={e => setSelectedCycleId(e.target.value)}
                    >
                        <option value="ALL">HISTÓRICO GENERAL (2025-2026-2 AL ACTUAL)</option>
                        {cycles.map(c => (
                            <option key={c.id} value={c.id}>
                                Periodo: {c.nombre} {c.es_activo ? '(Activo)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400 tracking-widest">
                        <tr>
                            <th className="px-6 py-4 rounded-l-xl">Docente</th>
                            <th className="px-6 py-4">Materia / Grupo</th>
                            <th className="px-6 py-4 text-center">Actividades</th>
                            <th className="px-6 py-4 text-center">Días Asistencia</th>
                            <th className="px-6 py-4 text-center">Última Actividad</th>
                            <th className="px-6 py-4 text-center">Último Pase</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-center rounded-r-xl">Constancia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-gray-300 font-bold text-xs uppercase">No se encontraron registros</td>
                            </tr>
                        ) : (
                            filteredData.map((row) => {
                                const isActive = row.actividadesCount > 0 || row.asistenciasCount > 0;
                                return (
                                    <tr key={row.grupoId} className="hover:bg-blue-50/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-xs text-gray-900">{row.docenteNombre}</div>
                                            <div className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-0.5">ID: {row.docenteId.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-xs text-[#003B5C]">{row.materiaNombre}</div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wide">{row.grupoNombre}</span>
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wide border border-blue-100">{row.cicloNombre}</span>
                                                <span className="text-[8px] font-bold text-gray-400 uppercase truncate max-w-[120px]">{row.carrera}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-black ${row.actividadesCount > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                                {row.actividadesCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs font-black ${row.asistenciasCount > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                                                {row.asistenciasCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-mono text-gray-500">
                                                {row.lastActivityDate ? new Date(row.lastActivityDate).toLocaleDateString('es-MX') : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-mono text-gray-500">
                                                {row.lastAttendanceDate ? new Date(row.lastAttendanceDate).toLocaleDateString('es-MX') : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${isActive
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-red-50 text-red-500 border-red-100'
                                                }`}>
                                                {isActive ? 'ACTIVO' : 'INACTIVO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {row.docenteId && row.docenteId !== 'N/A' ? (
                                                <button
                                                    onClick={() => setSelectedTeacherCertId(row.docenteId)}
                                                    className="inline-flex items-center gap-1 bg-[#003B5C] text-[#FFD100] px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-blue-900 transition-all shadow-xs"
                                                    title="Ver / Descargar Constancia PDF"
                                                >
                                                    <span>📄</span> PDF
                                                </button>
                                            ) : (
                                                <span className="text-[9px] text-gray-300 font-bold">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {selectedTeacherCertId && (
                <TeacherCertificateModal
                    userId={selectedTeacherCertId}
                    cycleId={selectedCycleId !== 'ALL' ? selectedCycleId : undefined}
                    onClose={() => setSelectedTeacherCertId(null)}
                />
            )}
        </div>
    );
};

export default TeacherAnalytics;
