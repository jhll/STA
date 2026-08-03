// Configuración de API y base de datos para la aplicación STA-FCQB
// Permite obtener claves de variables de entorno de Vite o del almacenamiento local (localStorage)

export const getConfig = () => {
  const supabaseUrl = localStorage.getItem('VITE_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = localStorage.getItem('VITE_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const geminiApiKey = localStorage.getItem('VITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';

  return {
    supabaseUrl: supabaseUrl.trim(),
    supabaseAnonKey: supabaseAnonKey.trim(),
    geminiApiKey: geminiApiKey.trim(),
  };
};

export const saveConfig = (supabaseUrl: string, supabaseAnonKey: string, geminiApiKey: string) => {
  localStorage.setItem('VITE_SUPABASE_URL', supabaseUrl.trim());
  localStorage.setItem('VITE_SUPABASE_ANON_KEY', supabaseAnonKey.trim());
  localStorage.setItem('VITE_GEMINI_API_KEY', geminiApiKey.trim());
};

export const clearConfig = () => {
  localStorage.removeItem('VITE_SUPABASE_URL');
  localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
  localStorage.removeItem('VITE_GEMINI_API_KEY');
};

export const isConfigComplete = () => {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  // Validamos que por lo menos la URL de Supabase tenga un formato correcto y exista la anon key
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};
