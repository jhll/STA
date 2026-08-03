
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";

const ManualGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('Dashboard de seguimiento con semáforos de riesgo académico');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<{ url: string, prompt: string, timestamp: number }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('sta_manual_images');
    if (saved) {
      try {
        setGeneratedImages(JSON.parse(saved));
      } catch (e) {
        console.error("Error al cargar historial", e);
      }
    }
  }, []);

  const saveImages = (newList: any[]) => {
    setGeneratedImages(newList);
    localStorage.setItem('sta_manual_images', JSON.stringify(newList));
  };

  const generateManualImage = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullPrompt = `Generate a professional UI mockup for a university system user manual. 
      Institutional Colors: Navy Blue (#003B5C) and Gold (#FFD100).
      Topic: ${prompt}.
      Style: Clean, professional, flat design. The header must say "Manual STA-FCQB".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9" }
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const newImg = {
            url: `data:image/png;base64,${part.inlineData.data}`,
            prompt: prompt,
            timestamp: Date.now()
          };
          saveImages([newImg, ...generatedImages].slice(0, 10));
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error al conectar con la IA de Imagen.");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = () => {
    if (confirm("¿Deseas borrar el historial de ilustraciones?")) {
      saveImages([]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="bg-[#003B5C] p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
             <span className="text-4xl">🎨</span>
             <h3 className="text-3xl font-black tracking-tighter">Diseñador de Ilustraciones IA</h3>
          </div>
          <p className="text-blue-200 text-sm max-w-xl mb-8">
            Crea recursos visuales para manuales y presentaciones institucionales utilizando la IA Nano Banana.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-white placeholder-blue-300 outline-none focus:ring-4 focus:ring-[#FFD100]/20 transition-all"
              placeholder="Describe la interfaz que deseas ilustrar..."
            />
            <button 
              onClick={generateManualImage}
              disabled={isGenerating || !prompt}
              className="bg-[#FFD100] text-[#003B5C] px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all shadow-xl disabled:opacity-50"
            >
              {isGenerating ? 'Generando...' : 'Generar Imagen'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
            <h4 className="font-black text-[#003B5C] uppercase text-[10px] tracking-widest px-4">Preajustes Rápidos</h4>
            <div className="grid grid-cols-1 gap-4">
              {[
                { title: 'Dashboard de Riesgo', p: 'Dashboard con semáforos de riesgo académico y gráficas' },
                { title: 'Ficha de Alumno', p: 'Perfil detallado de estudiante con factores personales e historial' },
                { title: 'Módulo Analítico', p: 'Gráficas de retención escolar y eficiencia terminal' },
              ].map((s, i) => (
                <button 
                  key={i}
                  onClick={() => setPrompt(s.p)}
                  className="p-6 bg-white border border-gray-100 rounded-3xl text-left hover:border-[#FFD100] hover:shadow-lg transition-all group flex justify-between items-center"
                >
                    <span className="font-bold text-[#003B5C]">{s.title}</span>
                    <span className="text-gray-300 group-hover:text-[#FFD100]">→</span>
                </button>
              ))}
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
                <h4 className="font-black text-[#003B5C] uppercase text-[10px] tracking-widest">Resultado más reciente</h4>
                {generatedImages.length > 0 && <button onClick={clearHistory} className="text-[9px] font-black text-red-500 uppercase">Borrar Historial</button>}
            </div>
            
            <div className="min-h-[300px] bg-white border-2 border-dashed border-gray-200 rounded-[3rem] flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-sm">
                {isGenerating ? (
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-[#003B5C]/10 border-t-[#003B5C] rounded-full animate-spin mx-auto"></div>
                        <p className="text-[#003B5C] font-black text-[9px] uppercase tracking-widest">IA Generando Ilustración...</p>
                    </div>
                ) : generatedImages.length > 0 ? (
                    <div className="w-full space-y-4">
                        <img src={generatedImages[0].url} alt="Latest Generation" className="w-full rounded-[2rem] shadow-xl border border-gray-100" />
                        <div className="flex justify-center">
                            <a href={generatedImages[0].url} download="ilustracion_sta.png" className="bg-emerald-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Descargar Ilustración</a>
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-300 font-bold uppercase text-[10px]">Sin resultados previos</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManualGenerator;
