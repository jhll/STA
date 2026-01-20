
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../services/supabaseClient';
import { SQL_SCHEMA } from '../constants/sqlSchema';

const uasEscudo = './images/uas_escudo.png';
const fcqbLogo = './images/fcqb_logo.png';

interface LoginProps {
  onLogin: (role: UserRole, name: string, id: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.DOCENTE);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'missing_tables' | 'error'>('checking');
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [setupData, setSetupData] = useState({ nombre: '', email: '', password: '', numero_empleado: 'ADMIN-001' });

  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const { error: checkError } = await supabase.from('docentes').select('id').limit(1);
        
        if (checkError) {
          if (checkError.code === '42P01' || checkError.message.includes('does not exist')) {
            setDbStatus('missing_tables');
          } else {
            setDbStatus('error');
            setError(`Error de conexión: ${checkError.message}`);
          }
        } else {
          setDbStatus('ready');
          const { count, error: countError } = await supabase.from('docentes').select('*', { count: 'exact', head: true });
          if (!countError && count === 0) {
            setShowInitialSetup(true);
          }
        }
      } catch (err) {
        setDbStatus('error');
        setError("No se pudo contactar con el servidor.");
      }
    };
    checkDatabase();
  }, []);

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('docentes')
        .insert([{
          ...setupData,
          email: setupData.email.trim().toLowerCase(),
          rol: [UserRole.ADMIN, UserRole.DOCENTE, UserRole.TUTOR]
        }]);

      if (insertError) throw insertError;
      alert("¡Administrador maestro creado! Ya puedes ingresar.");
      setShowInitialSetup(false);
      setDbStatus('ready');
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: user, error: queryError } = await supabase
        .from('docentes')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (queryError) {
        setError(`Error DB: ${queryError.message}`);
        setLoading(false);
        return;
      }

      if (!user) {
        setError("Usuario no encontrado.");
        setLoading(false);
        return;
      }

      // NORMALIZACIÓN DE ROLES
      let userRoles: string[] = [];
      const rawRol = user.rol;

      if (Array.isArray(rawRol)) {
        userRoles = rawRol;
      } else if (typeof rawRol === 'string') {
        userRoles = rawRol.replace(/[{}"\s]/g, '').split(',').filter(r => r.length > 0);
      }

      if (!userRoles.includes(selectedRole)) {
        setError(`Acceso denegado: Tu perfil no cuenta con el rol de ${selectedRole}.`);
        setLoading(false);
        return;
      }

      if (user.password === password) {
        onLogin(selectedRole, user.nombre, user.id);
      } else {
        setError("Contraseña incorrecta.");
        setLoading(false);
      }
    } catch (err) {
      setError("Error crítico de autenticación.");
      setLoading(false);
    }
  };

  if (dbStatus === 'missing_tables' || showSqlModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-6">
        <div className="max-w-4xl w-full bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden animate-in zoom-in-95">
          <div className="flex items-center gap-4 mb-6 text-red-600">
            <span className="text-5xl">⚠️</span>
            <div>
              <h2 className="text-2xl font-black">Reinicio Maestro de Base de Datos v7.0</h2>
              <p className="text-gray-500 text-sm italic font-bold">Aviso: Este script borrará los datos actuales para corregir el error de tipos de Postgres.</p>
            </div>
          </div>
          <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
             <p className="text-xs text-amber-800 font-bold">Copia el siguiente código y ejecútalo en el SQL EDITOR de Supabase para forzar la estructura correcta.</p>
          </div>
          <pre className="bg-gray-900 text-emerald-400 p-8 rounded-3xl text-[10px] h-96 overflow-auto font-mono mb-6 border border-white/10 whitespace-pre">
            {SQL_SCHEMA}
          </pre>
          <div className="flex gap-4">
            <button 
              onClick={() => { 
                navigator.clipboard.writeText(SQL_SCHEMA); 
                alert("Script de Reinicio v7.0 copiado."); 
              }} 
              className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-xl transition-all"
            >
              Copiar Script de Reinicio
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="flex-1 bg-gray-100 text-gray-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200"
            >
              Ya lo ejecuté, reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showInitialSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-emerald-100">
          <h2 className="text-2xl font-black text-[#003B5C] text-center mb-6">Configuración de Admin Maestro</h2>
          <form onSubmit={handleInitialSetup} className="space-y-4">
            <input type="text" placeholder="Nombre completo" className="w-full bg-gray-50 border p-4 rounded-2xl text-sm font-bold outline-none" value={setupData.nombre} onChange={e => setSetupData({...setupData, nombre: e.target.value})} required />
            <input type="email" placeholder="Correo UAS" className="w-full bg-gray-50 border p-4 rounded-2xl text-sm font-bold outline-none" value={setupData.email} onChange={e => setSetupData({...setupData, email: e.target.value})} required />
            <input type="password" placeholder="Contraseña segura" className="w-full bg-gray-50 border p-4 rounded-2xl text-sm font-bold outline-none" value={setupData.password} onChange={e => setSetupData({...setupData, password: e.target.value})} required />
            {error && <p className="text-red-500 text-[10px] font-bold text-center">⚠️ {error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-[#003B5C] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">
              {loading ? 'Inicializando...' : 'Crear Admin Maestro'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-4 relative overflow-hidden text-gray-900">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#003B5C] hidden lg:block transform skew-x-12 translate-x-32 origin-top"></div>
      <div className="max-w-xl w-full relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-6 mb-6">
               <img src={uasEscudo} alt="UAS" className="w-16 h-16 object-contain" />
               <div className="h-10 w-px bg-gray-200"></div>
               <img src={fcqbLogo} alt="FCQB" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-[#003B5C] tracking-tighter mb-1 text-center">STA-FCQB</h1>
            <p className="text-[10px] font-black text-[#003B5C]/60 uppercase tracking-[0.2em] text-center">Trayectoria Académica • UAS</p>
          </div>
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: UserRole.DOCENTE, label: 'Docente', icon: '👨‍🏫' },
                { id: UserRole.TUTOR, label: 'Tutor', icon: '📋' },
                { id: UserRole.ADMIN, label: 'Admin', icon: '⚙️' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedRole(opt.id)}
                  className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300 ${
                    selectedRole === opt.id 
                    ? 'border-[#FFD100] bg-blue-50/30 ring-4 ring-[#FFD100]/10' 
                    : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl mb-2">{opt.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Correo UAS</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none" placeholder="personal@uas.edu.mx" required />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none" placeholder="••••••••" required />
            </div>
            {error && <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-xl border border-red-100 animate-pulse text-center">⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-[#003B5C] text-white rounded-2xl py-5 text-[11px] font-black uppercase tracking-widest shadow-xl hover:bg-[#005689] transition-all disabled:opacity-50">{loading ? 'Validando...' : `Entrar como ${selectedRole.toLowerCase()}`}</button>
          </form>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
             <button onClick={() => setShowSqlModal(true)} className="text-[9px] font-black uppercase text-blue-600 hover:underline">Reparar base de datos (Reiniciar)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
