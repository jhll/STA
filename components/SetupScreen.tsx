import React, { useState } from 'react';
import { saveConfig, getConfig } from '../services/configService';

import uasEscudo from './images/uas_escudo.png';
import fcqbLogo from './images/fcqb_logo.png';

const SetupScreen: React.FC = () => {
  const currentConfig = getConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.supabaseAnonKey);
  const [geminiApiKey, setGeminiApiKey] = useState(currentConfig.geminiApiKey);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supabaseUrl.trim().startsWith('http://') && !supabaseUrl.trim().startsWith('https://')) {
      setError('La URL de Supabase debe comenzar con http:// o https://');
      return;
    }

    if (!supabaseAnonKey.trim()) {
      setError('La Anon Key de Supabase es obligatoria.');
      return;
    }

    setLoading(true);
    try {
      saveConfig(supabaseUrl, supabaseAnonKey, geminiApiKey);
      alert('✅ Configuración guardada correctamente. La página se recargará.');
      window.location.reload();
    } catch (err: any) {
      setError('Error al guardar la configuración: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-4 relative overflow-hidden text-gray-900">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#003B5C] hidden lg:block transform skew-x-12 translate-x-32 origin-top"></div>
      
      <div className="max-w-2xl w-full relative z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-6 mb-6">
              <img src={uasEscudo} alt="UAS" className="w-16 h-16 object-contain" />
              <div className="h-10 w-px bg-gray-200"></div>
              <img src={fcqbLogo} alt="FCQB" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-[#003B5C] tracking-tighter mb-1">STA-FCQB • Configuración Inicial</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Configuración de Base de Datos y APIs</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl mb-8">
            <h4 className="text-xs font-black text-[#003B5C] uppercase tracking-wider mb-2">💡 ¿Por qué veo esta pantalla?</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Para garantizar la seguridad de la aplicación, las credenciales de la base de datos y la API de Gemini ya no están codificadas en el sistema. Introduce tus claves a continuación. Se guardarán de forma segura únicamente en tu navegador.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Supabase Project URL</label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none"
                placeholder="https://your-project.supabase.co"
                required
              />
              <p className="text-[9px] text-gray-400 ml-1">Ubicado en Supabase Console &gt; Project Settings &gt; API</p>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Supabase Anon Key</label>
              <input
                type="text"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
              />
              <p className="text-[9px] text-gray-400 ml-1">Clave pública "anon/public". Ubicada en Project Settings &gt; API</p>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Gemini API Key (Opcional)</label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none"
                placeholder="AIzaSyB..."
              />
              <p className="text-[9px] text-gray-400 ml-1">Requerido para el análisis de riesgo de deserción mediante IA. Obtenla gratis en Google AI Studio.</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-xl border border-red-100 text-center animate-pulse">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003B5C] text-white rounded-2xl py-5 text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-[#005689] transition-all disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;
