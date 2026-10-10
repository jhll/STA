
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { UserRole, Student, RiskLevel, CicloEscolar } from '../types';
import TeacherAnalytics from './TeacherAnalytics';

const AnalyticsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<CicloEscolar[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('ALL');
  const [riskData, setRiskData] = useState<any[]>([]);
  const [factorData, setFactorData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
      console.error("Error al cargar ciclos en AnalyticsView:", err);
    }
  };

  const fetchRealAnalytics = async () => {
    setLoading(true);
    try {
      fetchCycles();

      // 1. Obtener estudiantes según el periodo seleccionado (o historial desde 2025-2026-2 al actual)
      let studentQuery = supabase.from('estudiantes').select('*');
      if (selectedCycleId !== 'ALL') {
        studentQuery = studentQuery.or(`ciclo_id.eq.${selectedCycleId},ciclo_id.is.null`);
      }
      const { data: students, error: studentError } = await studentQuery;

      if (studentError) throw studentError;

      // 2. Obtener todas las intervenciones para tendencias según el periodo
      let intQuery = supabase.from('intervenciones').select('fecha, ciclo_id');
      if (selectedCycleId !== 'ALL') {
        intQuery = intQuery.or(`ciclo_id.eq.${selectedCycleId},ciclo_id.is.null`);
      }
      const { data: interventions, error: intError } = await intQuery;

      if (intError) throw intError;

      // PROCESAMIENTO DE DATOS

      // A. Riesgo por Carrera
      const careers = [
        { full: 'Ingeniería Química', short: 'IQ' },
        { full: 'Ingeniería Bioquímica', short: 'IBQ' },
        { full: 'Químico Farmacéutico Biólogo', short: 'QFB' },
        { full: 'Biotecnología Genómica', short: 'BG' }
      ];

      const processedRisk = careers.map(c => {
        const studentsInCareer = students?.filter(s => s.carrera === c.full) || [];
        return {
          name: c.short,
          bajo: studentsInCareer.filter(s => s.nivel_riesgo === 'LOW').length,
          medio: studentsInCareer.filter(s => s.nivel_riesgo === 'MEDIUM').length,
          alto: studentsInCareer.filter(s => s.nivel_riesgo === 'HIGH').length,
        };
      });
      setRiskData(processedRisk);

      // B. Distribución de Factores
      let personal = 0, academic = 0, institutional = 0;
      students?.forEach(s => {
        personal += (s.factores_personales || []).length;
        academic += (s.factores_academicos || []).length;
        institutional += (s.factores_institucionales || []).length;
      });

      const totalFactors = personal + academic + institutional || 1;
      setFactorData([
        { name: 'Personales', value: Math.round((personal / totalFactors) * 100), color: '#3b82f6' },
        { name: 'Académicos', value: Math.round((academic / totalFactors) * 100), color: '#f59e0b' },
        { name: 'Institucionales', value: Math.round((institutional / totalFactors) * 100), color: '#8b5cf6' },
      ]);

      // C. Eficiencia (Promedio por carrera como proxy)
      const processedEfficiency = careers.map(c => {
        const studentsInCareer = students?.filter(s => s.carrera === c.full) || [];
        const avg = studentsInCareer.length > 0
          ? studentsInCareer.reduce((acc, curr) => acc + Number(curr.promedio_acumulado), 0) / studentsInCareer.length
          : 0;

        const colors: Record<string, string> = { 'IQ': 'blue', 'IBQ': 'indigo', 'QFB': 'emerald', 'BG': 'purple' };
        return {
          label: `${c.short} - ${c.full}`,
          value: Math.round(avg * 10), // Normalizar a base 100 para la barra
          realAvg: avg.toFixed(1),
          color: colors[c.short]
        };
      });
      setEfficiencyData(processedEfficiency);

      // D. Tendencia de Atención (Intervenciones por mes)
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const currentMonth = new Date().getMonth();
      const last6Months = [];

      for (let i = 5; i >= 0; i--) {
        const mIdx = (currentMonth - i + 12) % 12;
        const count = interventions?.filter(int => new Date(int.fecha).getMonth() === mIdx).length || 0;
        // Mock de retención basado en alumnos sin riesgo alto para visualización
        const retention = students ? Math.round((students.filter(s => s.nivel_riesgo !== 'HIGH').length / students.length) * 100) : 90;

        last6Months.push({
          month: months[mIdx],
          intervenciones: count,
          retención: retention
        });
      }
      setTrendData(last6Months);

    } catch (err) {
      console.error("Error al procesar analítica real:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealAnalytics();
  }, [selectedCycleId]);

  const downloadAttendanceReport = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      let allData: any[] = [];

      // 1. Get total count for progress calculation
      const { count } = await supabase
        .from('asistencias')
        .select('*', { count: 'exact', head: true });

      const totalCount = count || 1000;

      while (hasMore) {
        let asistQuery = supabase
          .from('asistencias')
          .select(`
            presente,
            fecha,
            estudiante_id,
            grupo_id,
            estudiantes(id, nombre),
            grupos(
              nombre_grupo,
              ciclo_id,
              materias(nombre),
              docentes(nombre)
            )
          `);

        const { data, error } = await asistQuery
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          setDownloadProgress(Math.min(90, Math.round((allData.length / totalCount) * 90)));
          if (data.length < pageSize) hasMore = false;
        } else {
          hasMore = false;
        }
        page++;
      }

      if (allData.length === 0) {
        alert("No hay registros de asistencia disponibles.");
        return;
      }

      setDownloadProgress(95); // Compiling data

      // Group by student and group
      const summarizedData: Record<string, any> = {};

      allData.forEach((row: any) => {
        const key = `${row.grupo_id}_${row.estudiante_id}`;

        if (!summarizedData[key]) {
          const estudiante = Array.isArray(row.estudiantes) ? row.estudiantes[0] : row.estudiantes || {};
          const grupo = Array.isArray(row.grupos) ? row.grupos[0] : row.grupos || {};
          const materia = Array.isArray(grupo.materias) ? grupo.materias[0] : grupo.materias || {};
          const docente = Array.isArray(grupo.docentes) ? grupo.docentes[0] : grupo.docentes || {};

          summarizedData[key] = {
            grupoNombre: grupo.nombre_grupo || 'N/A',
            materiaNombre: materia.nombre || 'N/A',
            docenteNombre: docente.nombre || 'N/A',
            folio: estudiante.id || 'N/A',
            estudianteNombre: estudiante.nombre || 'N/A',
            totalClases: 0,
            asistencias: 0,
            ultimFecha: row.fecha || 'N/A'
          };
        }

        // Update counts
        summarizedData[key].totalClases += 1;
        if (row.presente) {
          summarizedData[key].asistencias += 1;
        }

        // Update to latest date
        if (row.fecha > summarizedData[key].ultimFecha) {
          summarizedData[key].ultimFecha = row.fecha;
        }
      });

      const headers = ['Grupo', 'Materia', 'Docente', 'Folio', 'Nombre del Estudiante', 'Fecha del Último Registro', 'Porcentaje de Asistencia'];
      const csvRows = [headers.join(',')];

      Object.values(summarizedData).forEach((row) => {
        const porcentaje = row.totalClases > 0 ? Math.round((row.asistencias / row.totalClases) * 100) : 0;

        const csvLine = [
          `"${row.grupoNombre}"`,
          `"${row.materiaNombre}"`,
          `"${row.docenteNombre}"`,
          `"${row.folio}"`,
          `"${row.estudianteNombre}"`,
          `"${row.ultimFecha}"`,
          `"${porcentaje}%"`
        ].join(',');

        csvRows.push(csvLine);
      });

      setDownloadProgress(100);

      const csvContent = csvRows.join('\n');
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reporte_asistencia_porcentaje_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      console.error("Error al descargar el reporte de asistencia:", err);
      alert("Hubo un error al generar el reporte: " + err.message);
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadProgress(0), 1000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Compilando datos de analítica por periodo...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Módulo de Analítica</h2>
            <span className="bg-blue-50 text-[#003B5C] px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100">
              Histórico desde 2025-2026-2
            </span>
          </div>
          <p className="text-gray-500 font-medium text-xs mt-1">Monitoreo de métricas, rendimiento y trayectoria por periodos académicos del ciclo escolar.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Selector de Ciclo / Periodo Histórico */}
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
            <span className="text-xs ml-2">📅</span>
            <select
              value={selectedCycleId}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="bg-white text-gray-900 text-xs font-black px-3 py-2 rounded-xl outline-none cursor-pointer border border-gray-200 hover:border-blue-500 shadow-sm transition-all"
            >
              <option value="ALL">HISTÓRICO GENERAL (2025-2026-2 AL ACTUAL)</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  Periodo: {c.nombre} {c.es_activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button onClick={downloadAttendanceReport} disabled={isDownloading} className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2 relative overflow-hidden">
            {isDownloading && (
              <div
                className="absolute top-0 left-0 h-full bg-emerald-800/30 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            )}
            <span className="relative z-10">📥</span>
            <span className="relative z-10">{isDownloading ? `Generando... ${downloadProgress}%` : 'Reporte Asistencias'}</span>
          </button>

          <button onClick={() => window.print()} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-gray-50 transition-all">Imprimir</button>
          <button onClick={fetchRealAnalytics} className="bg-[#003B5C] text-white px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-blue-900 transition-all">Refrescar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trend Analysis */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Tendencia de Atención y Retención</h3>
            <p className="text-sm text-gray-400">Intervenciones realizadas vs % de alumnos en estatus regular.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="retención" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRet)" name="% Retención" />
                <Area type="monotone" dataKey="intervenciones" stroke="#ef4444" strokeWidth={3} fill="transparent" name="Intervenciones" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Distribución de Riesgo Real</h3>
            <p className="text-sm text-gray-400">Alumnos por nivel de riesgo segmentados por programa académico.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 600 }} width={40} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="bajo" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Bajo" />
                <Bar dataKey="medio" stackId="a" fill="#f59e0b" name="Medio" />
                <Bar dataKey="alto" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} name="Alto" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Factors Analysis */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Prevalencia de Factores de Riesgo</h3>
            <p className="text-sm text-gray-400">Distribución porcentual de las causas raíz detectadas.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-64 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={factorData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {factorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {factorData.map((item, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Academic Efficiency */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Rendimiento Promedio por Programa</h3>
            <p className="text-sm text-gray-400">Promedio general acumulado por los estudiantes de cada licenciatura.</p>
          </div>
          <div className="space-y-6">
            {efficiencyData.map((career, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">{career.label}</span>
                  <span className="text-gray-900">{career.realAvg} Promedio</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${career.color === 'blue' ? 'bg-blue-500' :
                      career.color === 'indigo' ? 'bg-indigo-500' :
                        career.color === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'
                      }`}
                    style={{ width: `${career.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teacher Analytics Section */}
      <TeacherAnalytics selectedCycleId={selectedCycleId} />
    </div>
  );
};

export default AnalyticsView;
