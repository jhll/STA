
import React, { useState, useEffect } from 'react';
import { UserRole, CicloEscolar } from './types';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import GroupView from './components/GroupView';
import AnalyticsView from './components/AnalyticsView';
import StudentListView from './components/StudentListView';
import ActivitiesModule from './components/ActivitiesModule';
import Login from './components/Login';
import { supabase } from './services/supabaseClient';

const fcqbLogo = './images/fcqb_logo.png';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.DOCENTE);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'groups' | 'admin' | 'analytics' | 'student-list' | 'activities'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCycle, setActiveCycle] = useState<CicloEscolar | null>(null);

  const fetchActiveCycle = async () => {
    try {
      const { data, error } = await supabase
        .from('ciclos_escolares')
        .select('*')
        .eq('es_activo', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setActiveCycle(data[0]);
      } else {
        setActiveCycle(null);
      }
    } catch (err) {
      console.error("Error al obtener ciclo activo:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveCycle();
      const handleCycleUpdate = () => {
        setTimeout(fetchActiveCycle, 500);
      };
      window.addEventListener('sta-cycle-updated', handleCycleUpdate);
      return () => {
        window.removeEventListener('sta-cycle-updated', handleCycleUpdate);
      };
    }
  }, [isAuthenticated]);

  const handleLogin = (role: UserRole, name: string, id: string) => {
    setCurrentRole(role);
    setUserName(name);
    setUserId(id);
    setIsAuthenticated(true);
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserName('');
    setUserId('');
    setIsMenuOpen(false);
    setActiveCycle(null);
  };

  // Definición clara de items de navegación por rol (DISEÑADOR IA ELIMINADO)
  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: '🏠', roles: [UserRole.ADMIN, UserRole.DOCENTE, UserRole.TUTOR] },
    { id: 'student-list', label: 'Matrícula', icon: '📋', roles: [UserRole.ADMIN, UserRole.TUTOR, UserRole.DOCENTE] },
    { id: 'groups', label: 'Asistencia', icon: '👥', roles: [UserRole.DOCENTE] },
    { id: 'activities', label: 'Actividades', icon: '📝', roles: [UserRole.DOCENTE, UserRole.ADMIN] },
    { id: 'analytics', label: 'Estadísticas', icon: '📊', roles: [UserRole.ADMIN, UserRole.TUTOR] },
    { id: 'admin', label: 'Sistema', icon: '⚙️', roles: [UserRole.ADMIN] },
  ];

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const currentNavItems = navItems.filter(item => item.roles.includes(currentRole));
  const activeNavItem = navItems.find(n => n.id === activeView);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F9]">
      {/* HEADER Y NAVEGACIÓN DESKTOP */}
      <nav className="bg-[#003B5C] border-b-4 border-[#FFD100] sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4 lg:gap-8">
              {/* Botón Hamburguesa para Móvil */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-3 text-white hover:bg-white/10 rounded-xl transition-all"
                aria-label="Menú principal"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              {/* Logo e Identidad */}
              <div 
                className="flex items-center gap-3 cursor-pointer group" 
                onClick={() => setActiveView('dashboard')}
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg border border-gray-100 group-hover:scale-105 transition-transform">
                   <img src={fcqbLogo} alt="FCQB" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-white tracking-tighter leading-none">STA-FCQB</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] font-black text-[#FFD100] uppercase tracking-[0.2em] opacity-80">Trayectoria Académica</span>
                  </div>
                </div>
              </div>

              {/* Items de Navegación (Solo Desktop) */}
              <div className="hidden lg:flex items-center gap-1 ml-6">
                {currentNavItems.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveView(item.id as any)}
                    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${
                      activeView === item.id 
                      ? 'bg-[#FFD100] text-[#003B5C] shadow-lg scale-105' 
                      : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base">{String(item.icon)}</span>
                    {String(item.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Perfil de Usuario */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <p className="text-xs font-black text-white">{String(userName)}</p>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                   <span className="text-[9px] font-black text-[#FFD100] uppercase tracking-widest opacity-80">
                     {String(currentRole)}
                   </span>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-red-600 transition-all border border-white/10 group"
                title="Cerrar Sesión"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MENÚ MÓVIL (DRAWER LATERAL) */}
      <div className={`fixed inset-0 z-[60] lg:hidden transition-all duration-300 ${isMenuOpen ? 'visible' : 'invisible'}`}>
         {/* Backdrop */}
         <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setIsMenuOpen(false)}
         ></div>
         
         {/* Panel Lateral */}
         <div className={`absolute left-0 top-0 bottom-0 w-80 bg-[#003B5C] shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-8 border-b border-white/10 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg p-1.5">
                    <img src={fcqbLogo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <h3 className="text-white font-black uppercase text-xs tracking-widest">Navegación STA</h3>
               </div>
               {activeCycle && (
                  <div className="bg-[#FFD100] text-[#003B5C] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                    Ciclo: {String(activeCycle.nombre)}
                  </div>
               )}
            </div>
            
            <div className="p-4 space-y-2 mt-4">
               {currentNavItems.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => { setActiveView(item.id as any); setIsMenuOpen(false); }}
                    className={`w-full px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-5 ${
                      activeView === item.id 
                      ? 'bg-[#FFD100] text-[#003B5C] shadow-lg' 
                      : 'text-blue-100 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl">{String(item.icon)}</span>
                    {String(item.label)}
                  </button>
               ))}
            </div>

            <div className="absolute bottom-10 left-6 right-6">
               <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4">
                  <p className="text-[10px] text-blue-200/50 font-black uppercase mb-1">Usuario</p>
                  <p className="text-white text-xs font-bold truncate">{String(userName)}</p>
               </div>
               <button 
                onClick={handleLogout} 
                className="w-full bg-red-600/20 text-red-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-600/30 hover:bg-red-600 hover:text-white transition-all"
               >
                Desconectarse
               </button>
            </div>
         </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 w-full overflow-x-hidden">
        {/* Sub-header de ubicación */}
        <div className="bg-white border-b border-gray-200 py-4 shadow-sm">
           <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <span className="text-[#003B5C] font-black text-[10px] uppercase tracking-widest">Plataforma FCQB</span>
                 <span className="text-gray-300">/</span>
                 <span className="text-blue-600 font-black text-[10px] uppercase tracking-widest">
                   {activeNavItem ? String(activeNavItem.label) : String(activeView)}
                 </span>
              </div>
              {activeCycle && (
                <div className="hidden sm:flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                  <span className="text-[#003B5C] font-black text-[9px] uppercase tracking-widest">
                    Periodo Activo: {String(activeCycle.nombre)}
                  </span>
                </div>
              )}
           </div>
        </div>

        {/* Renderizado de Vistas */}
        <div className="p-4 md:p-0">
          {activeView === 'dashboard' && <Dashboard role={currentRole} userId={userId} />}
          {activeView === 'student-list' && <StudentListView role={currentRole} userId={userId} />}
          {activeView === 'groups' && <GroupView userId={userId} role={currentRole} />}
          {activeView === 'activities' && <ActivitiesModule userId={userId} role={currentRole} />}
          {activeView === 'admin' && <AdminPanel />}
          {activeView === 'analytics' && <AnalyticsView />}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#003B5C] py-12 text-white border-t-4 border-[#FFD100] mt-auto">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-col items-center md:items-start gap-4">
                 <div className="flex items-center gap-3">
                    <img src={fcqbLogo} alt="" className="w-10 h-10 opacity-60 grayscale brightness-200" />
                    <div className="h-6 w-px bg-white/20"></div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80">UAS • FCQB</p>
                 </div>
                 <p className="text-[10px] text-blue-200/40 text-center md:text-left max-w-xs">
                    Sistema de Seguimiento de Trayectoria Académica. Todos los derechos reservados UAS 2026.
                 </p>
              </div>
              
              <div className="flex gap-8">
                 <div className="flex flex-col items-center md:items-end">
                    <span className="text-[9px] font-black text-[#FFD100] uppercase tracking-widest mb-1">Contacto Soporte</span>
                    <span className="text-xs font-medium text-blue-200">informatica.fcqb@uas.edu.mx</span>
                 </div>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
