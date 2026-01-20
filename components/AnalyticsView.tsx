
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { UserRole, Student, RiskLevel } from '../types';

const AnalyticsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [factorData, setFactorData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);

  const fetchRealAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Obtener todos los estudiantes
      const { data: students, error: studentError } = await supabase
        .from('estudiantes')
        .select('*');

      if (studentError) throw studentError;

      // 2. Obtener todas las intervenciones para tendencias
      const { data: interventions, error: intError } = await supabase
        .from('intervenciones')
        .select('fecha');

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
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Compilando datos en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Módulo de Analítica</h2>
          <p className="text-gray-500 font-medium">Información real extraída de la matrícula y registros de la FCQB.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50">Imprimir Reporte</button>
          <button onClick={fetchRealAnalytics} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700">Actualizar Datos</button>
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
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
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontWeight: 600}} width={40} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
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
                    className={`h-full transition-all duration-1000 ${
                      career.color === 'blue' ? 'bg-blue-500' : 
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
    </div>
  );
};

export default AnalyticsView;
