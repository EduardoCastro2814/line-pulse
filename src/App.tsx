import { useState, useEffect } from 'react';
import { Monitor, LayoutDashboard, Clock, User, FileText } from 'lucide-react';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { TvDashboard } from './components/TvDashboard';
import { LineDetailsModal } from './components/LineDetailsModal';
import { ReportsView } from './components/ReportsView';
import { ScannerDrawer } from './components/ScannerDrawer';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentClock, setCurrentClock] = useState('');
  const [isScannerOpen] = useState(false);
  
  // User Profile Role Control
  const [userRole, setUserRole] = useState<'admin' | 'supervisor' | 'viewer'>('admin');

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentClock(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentRoute = (path: string) => location.pathname === path;

  return (
    <Routes>
      {/* Route for TV Monitor View */}
      <Route path="/monitor" element={<TvDashboard />} />

      {/* Route for Detailed Operational View */}
      <Route path="/linea/:lineId" element={<LineDetailsModal />} />

      {/* Corporate Header Wrapper for Dashboard & Reportes */}
      <Route
        path="/*"
        element={
          <div className="flex flex-col h-screen overflow-hidden bg-[#F5F7FA] text-slate-800 font-sans select-none">
            
            {/* 1. CORPORATE HEADER BAR (#005486) */}
            <header className="h-14 shrink-0 bg-[#005486] border-b border-[#00426a] flex items-center justify-between px-6 z-20 shadow-md">
              
              {/* Brand logo & App Title */}
              <div className="flex items-center space-x-3.5">
                {/* SVG Process Indicator Icon */}
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-inner">
                  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="20" stroke="#005486" strokeWidth="6" fill="#FFFFFF"/>
                    <circle cx="24" cy="24" r="10" fill="#005486"/>
                  </svg>
                </div>
                <div>
                  <span className="text-lg font-black tracking-widest text-white uppercase font-sans">LINEPULSE</span>
                  <span className="block text-[9px] text-white/70 font-bold uppercase tracking-wider font-sans">Operations MES Platform</span>
                </div>
              </div>

              {/* Navigation & Controls */}
              <div className="flex items-center space-x-3">
                
                {/* Navigation Switcher (Dashboard | Monitor | Reportes) */}
                <div className="bg-black/15 p-1 border border-white/10 rounded-xl flex space-x-1">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCurrentRoute('/dashboard')
                        ? 'bg-white text-[#005486] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/monitor')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCurrentRoute('/monitor')
                        ? 'bg-white text-[#005486] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Monitor</span>
                  </button>

                  <button
                    onClick={() => navigate('/reportes')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCurrentRoute('/reportes')
                        ? 'bg-white text-[#005486] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Reportes</span>
                  </button>
                </div>

                {/* Profile Role Selector */}
                <div className="flex items-center space-x-1.5 bg-black/15 border border-white/10 px-2.5 py-1.5 rounded-xl text-white">
                  <User className="w-3.5 h-3.5 text-white/80" />
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as any)}
                    className="bg-transparent border-none text-[11px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="admin" className="text-slate-800">Administrador</option>
                    <option value="supervisor" className="text-slate-800">Supervisor</option>
                    <option value="viewer" className="text-slate-800">Visualizador</option>
                  </select>
                </div>

                {/* Digital Clock Ticker */}
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-white font-mono font-bold bg-black/15 border border-white/10 px-3 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{currentClock || '--:--:--'}</span>
                </div>

              </div>
            </header>

            {/* 2. MAIN VIEWPORT ROUTES */}
            <main className="flex-grow p-4 overflow-hidden flex flex-col min-h-0">
              <Routes>
                <Route path="/dashboard" element={<ExecutiveDashboard userRole={userRole} />} />
                <Route path="/reportes" element={<ReportsView />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>

            {/* 3. SCANNER DRAWER */}
            <ScannerDrawer 
              isOpen={isScannerOpen} 
              onClose={() => {}} 
            />

          </div>
        }
      />
    </Routes>
  );
}
