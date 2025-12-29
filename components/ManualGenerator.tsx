
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const ManualGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('Dashboard de seguimiento con semáforos de riesgo académico');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateManualImage = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullPrompt = `Generate a high-quality professional UI mockup for a user manual of a university system called "STA-FCQB". 
      Style: Modern, clean, professional. 
      Institutional Colors: Navy Blue (#003B5C) and Gold (#FFD100).
      Content to show: ${prompt}.
      Include: Tables, charts, and student profile icons. No realistic people, just UI elements. 
      The header should say "Manual de Usuario - FCQB".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error al conectar con Nano Banana. Verifique su API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-[#003B5C] p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-3xl font-black tracking-tighter mb-2">Diseñador de Manuales IA</h3>
          <p className="text-blue-200 text-sm max-w-xl">
            Utiliza Gemini 2.5 Flash Image para generar ilustraciones personalizadas para el manual de usuario del sistema STA.
          </p>
          
          <div className="mt-8 flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Vista de analítica con gráficas de barras..."
              className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-white placeholder-blue-300 outline-none focus:ring-4 focus:ring-[#FFD100]/20 transition-all"
            />
            <button 
              onClick={generateManualImage}
              disabled={isGenerating || !prompt}
              className="bg-[#FFD100] text-[#003B5C] px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-xl disabled:opacity-50"
            >
              {isGenerating ? 'Generando...' : 'Generar Ilustración'}
            </button>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="min-h-[400px] bg-gray-50 border-4 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {isGenerating ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-[#003B5C]/10 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
            <p className="text-[#003B5C] font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Nano Banana está dibujando...</p>
          </div>
        ) : generatedImage ? (
          <div className="w-full space-y-6">
            <img src={generatedImage} alt="Manual Illustration" className="w-full rounded-3xl shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-500" />
            <div className="flex justify-center">
              <a 
                href={generatedImage} 
                download="ilustracion_manual_fcqb.png"
                className="bg-gray-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
              >
                Descargar para Manual
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <span className="text-6xl block mb-4 opacity-20">🎨</span>
            <p className="font-bold uppercase text-[10px] tracking-widest">Las ilustraciones generadas aparecerán aquí</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Dashboard', desc: 'Resumen de riesgos y métricas grupales', p: 'Dashboard con gráficas de pastel y tarjetas de métricas' },
          { title: 'Ficha Estudiantil', desc: 'Detalle de un alumno con factores de riesgo', p: 'Perfil de estudiante con timeline de intervenciones' },
          { title: 'Analítica', desc: 'Gráficas avanzadas de retención escolar', p: 'Módulo de analítica con mapas de calor y tendencias' },
        ].map((s, i) => (
          <button 
            key={i}
            onClick={() => { setPrompt(s.p); }}
            className="p-6 bg-white border border-gray-100 rounded-3xl text-left hover:border-[#FFD100] hover:shadow-lg transition-all group"
          >
            <h4 className="font-black text-[#003B5C] mb-1 group-hover:text-blue-600">{s.title}</h4>
            <p className="text-xs text-gray-500 font-medium">{s.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ManualGenerator;
