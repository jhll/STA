import React, { useState } from 'react';
import { UserRole } from '../types';
import { supabase } from '../services/supabaseClient';

// Definición de rutas de activos como constantes de cadena
const uasEscudo = './images/uas_escudo.png';
const fcqbLogo = './images/fcqb_logo.png';

interface LoginProps {
  onLogin: (role: UserRole, name: string, id: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: user, error: queryError } = await supabase
        .from('docentes')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (queryError || !user) {
        setError('El correo electrónico no está registrado.');
        setLoading(false);
        return;
      }

      if (user.password === password) {
        onLogin(user.rol as UserRole, user.nombre, user.id);
      } else {
        setError('La contraseña es incorrecta.');
        setLoading(false);
      }
    } catch (err) {
      setError('Ocurrió un error al intentar acceder.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-4 relative overflow-hidden">
      {/* Elementos decorativos institucionales */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#003B5C] hidden lg:block transform skew-x-12 translate-x-32 origin-top"></div>
      
      {/* Escudo UAS Gigante de Fondo */}
      <div className="absolute -left-20 -bottom-20 w-[600px] h-[600px] opacity-[0.08] hidden lg:block pointer-events-none select-none">
         <img src={uasEscudo} alt="" className="w-full h-full object-contain" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 border border-gray-100">
          <div className="text-center mb-10">
            {/* Logos de Cabecera */}
            <div className="flex justify-center items-center gap-6 mb-8">
               <div className="w-20 h-20 flex items-center justify-center">
                  <img src={uasEscudo} alt="UAS" className="max-w-full max-h-full object-contain" />
               </div>
               <div className="h-12 w-px bg-gray-200"></div>
               <div className="w-20 h-20 flex items-center justify-center p-1 bg-gray-50 rounded-lg">
                  <img src={fcqbLogo} alt="FCQB" className="max-w-full max-h-full object-contain" />
               </div>
            </div>

            <h1 className="text-2xl font-black text-[#003B5C] tracking-tighter leading-none mb-1">STA-FCQB</h1>
            <p className="text-[10px] font-black text-[#003B5C]/60 uppercase tracking-[0.2em] mb-2">Seguimiento de Trayectoria Académica</p>
            <div className="w-12 h-1 bg-[#FFD100] mx-auto rounded-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Correo Institucional</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#003B5C]/10 focus:border-[#003B5C] transition-all"
                placeholder="ejemplo@uas.edu.mx"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#003B5C]/10 focus:border-[#003B5C] transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-xl border border-red-100 animate-in fade-in duration-300">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#003B5C] text-white rounded-xl py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-[#005689] transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? 'Validando Credenciales...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-gray-100 text-center">
             <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">
               Facultad de Ciencias Químico Biológicas<br/>
               Universidad Autónoma de Sinaloa
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;