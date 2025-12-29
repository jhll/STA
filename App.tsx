
import React, { useState } from 'react';
import { UserRole } from './types';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import GroupView from './components/GroupView';
import AnalyticsView from './components/AnalyticsView';
import StudentListView from './components/StudentListView';
import ActivitiesModule from './components/ActivitiesModule';
import Login from './components/Login';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.DOCENTE);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'groups' | 'admin' | 'analytics' | 'interventions' | 'student-list' | 'activities'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  };

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: '🏠', roles: [UserRole.ADMIN, UserRole.DOCENTE] },
    { id: 'student-list', label: 'Alumnos', icon: '📋', roles: [UserRole.ADMIN, UserRole.DOCENTE] },
    { id: 'groups', label: 'Asistencia', icon: '👥', roles: [UserRole.DOCENTE] },
    { id: 'activities', label: 'Actividades', icon: '📝', roles: [UserRole.DOCENTE] },
    { id: 'admin', label: 'Sistema', icon: '⚙️', roles: [UserRole.ADMIN] },
    { id: 'analytics', label: 'Estadísticas', icon: '📊', roles: [UserRole.ADMIN] },
  ];

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const currentNavItems = navItems.filter(item => item.roles.includes(currentRole));

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7F9]">
      {/* Header Institucional FCQB-UAS */}
      <nav className="bg-[#003B5C] border-b-4 border-[#FFD100] sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4 lg:gap-12">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveView('dashboard'); setIsMenuOpen(false); }}>
                <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center p-1 shadow-inner border border-gray-200">
                   {/* Logo FCQB en el Navbar - Ruta corregida y tamaño natural */}
                   <img src="images/fcqb_logo.png" alt="FCQB" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black text-white tracking-tighter leading-none">STA-FCQB</span>
                  <span className="text-[9px] font-black text-[#FFD100] uppercase tracking-[0.2em] mt-0.5">Universidad Autónoma de Sinaloa</span>
                </div>
              </div>

              {/* Navegación Escritorio */}
              <div className="hidden lg:flex items-center gap-1">
                {currentNavItems.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveView(item.id as any)}
                    className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                      activeView === item.id ? 'bg-[#FFD100] text-[#003B5C] shadow-lg' : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-xs font-black text-white">{userName}</p>
                <span className="text-[9px] font-black text-[#FFD100] uppercase tracking-widest">{currentRole === UserRole.ADMIN ? 'Administrador' : 'Docente Tutor'}</span>
              </div>
              <button onClick={handleLogout} className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white hover:bg-red-600 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Menú Lateral Móvil */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsMenuOpen(false)}></div>
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-[#003B5C] z-[60] lg:hidden animate-in slide-in-from-left duration-300 flex flex-col p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-10 pb-6 border-b border-white/10">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1">
                 <img src="images/fcqb_logo.png" alt="FCQB" className="max-w-full max-h-full object-contain" />
              </div>
              <span className="text-xl font-black text-white tracking-tighter">STA-FCQB</span>
            </div>
            <div className="flex-1 space-y-2">
              {currentNavItems.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => { setActiveView(item.id as any); setIsMenuOpen(false); }}
                  className={`w-full px-5 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-4 ${
                    activeView === item.id ? 'bg-[#FFD100] text-[#003B5C]' : 'text-blue-100 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="flex-1 pb-16 w-full">
        <div className="bg-[#003B5C]/5 py-4 border-b border-[#003B5C]/10 mb-6">
           <div className="max-w-7xl mx-auto px-6 flex items-center gap-2">
              <span className="text-[#003B5C] font-black text-[10px] uppercase tracking-widest">FCQB</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest">{activeView}</span>
           </div>
        </div>
        {activeView === 'dashboard' && <Dashboard role={currentRole} userId={userId} />}
        {activeView === 'student-list' && <StudentListView role={currentRole} userId={userId} />}
        {activeView === 'groups' && <GroupView userId={userId} />}
        {activeView === 'activities' && <ActivitiesModule userId={userId} role={currentRole} />}
        {activeView === 'admin' && <AdminPanel />}
        {activeView === 'analytics' && <AnalyticsView />}
      </main>

      <footer className="bg-[#003B5C] py-8 text-white border-t-4 border-[#FFD100]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
           <p className="text-[10px] font-black uppercase tracking-[0.3em]">Facultad de Ciencias Químico Biológicas • UAS</p>
           <p className="text-[9px] text-blue-200 font-medium">© 2025 STA - Seguimiento de Trayectoria Académica</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
