
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';
import { CAREERS } from '../constants';

const AnalyticsView: React.FC = () => {
  const trendData = [
    { month: 'Ene', deserción: 12, retención: 88 },
    { month: 'Feb', deserción: 10, retención: 90 },
    { month: 'Mar', deserción: 15, retención: 85 },
    { month: 'Abr', deserción: 8, retención: 92 },
    { month: 'May', deserción: 5, retención: 95 },
    { month: 'Jun', deserción: 7, retención: 93 },
  ];

  const riskByCareer = [
    { name: 'IQ', bajo: 45, medio: 12, alto: 5 },
    { name: 'IBQ', bajo: 38, medio: 15, alto: 8 },
    { name: 'QFB', bajo: 55, medio: 10, alto: 4 },
    { name: 'BG', bajo: 42, medio: 18, alto: 12 },
  ];

  const factorDistribution = [
    { name: 'Económicos', value: 40, color: '#ef4444' },
    { name: 'Académicos', value: 30, color: '#f59e0b' },
    { name: 'Personales', value: 20, color: '#3b82f6' },
    { name: 'Institucionales', value: 10, color: '#8b5cf6' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Módulo de Analítica</h2>
          <p className="text-gray-500 font-medium">Conocimiento agregado para la toma de decisiones estratégicas.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50">Descargar PDF</button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-700">Exportar CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trend Analysis */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Tendencia de Retención Escolar</h3>
            <p className="text-sm text-gray-400">Comparativa mensual de desertores vs alumnos activos.</p>
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
                <Area type="monotone" dataKey="retención" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRet)" />
                <Area type="monotone" dataKey="deserción" stroke="#ef4444" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-800">Niveles de Riesgo por Programa</h3>
            <p className="text-sm text-gray-400">Distribución semafórica acumulada por licenciatura.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskByCareer} layout="vertical">
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
            <h3 className="text-lg font-bold text-gray-800">Factores de Deserción Predominantes</h3>
            <p className="text-sm text-gray-400">Categorización de causas raíz identificadas por el modelo predictivo.</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-64 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={factorDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {factorDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {factorDistribution.map((item, i) => (
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
            <h3 className="text-lg font-bold text-gray-800">Eficiencia Terminal vs Deserción</h3>
            <p className="text-sm text-gray-400">Relación entre créditos aprobados y riesgo de abandono.</p>
          </div>
          <div className="space-y-6">
            {[
              { label: 'IQ - Ingeniería Química', value: 78, color: 'blue' },
              { label: 'IBQ - Ingeniería Bioquímica', value: 82, color: 'indigo' },
              { label: 'QFB - Químico Farmacéutico Biólogo', value: 91, color: 'emerald' },
              { label: 'BG - Biotecnología Genómica', value: 85, color: 'purple' },
            ].map((career, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">{career.label}</span>
                  <span className="text-gray-900">{career.value}% Eficiencia</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-${career.color}-500 transition-all duration-1000`} 
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
