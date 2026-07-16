import { useState, useEffect } from 'react';
import { Monitor, BarChart3, Sun, Moon, QrCode, Clock, AlertTriangle, Settings, User } from 'lucide-react';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { TvDashboard } from './components/TvDashboard';
import { LineDetailsModal } from './components/LineDetailsModal';
import { ScannerDrawer } from './components/ScannerDrawer';
import { ConfigurationModal } from './components/ConfigurationModal';
import { supabase } from './lib/supabaseClient';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDarkTheme, setIsDarkTheme] = useState(false); // Default to light theme for executive view
  const [currentClock, setCurrentClock] = useState('');
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // User Profile Role Control
  const [userRole, setUserRole] = useState<'admin' | 'supervisor' | 'viewer'>('admin');

  // Apply dark/light theme classes based on route or user toggle
  useEffect(() => {
    const root = document.documentElement;
    // TV view and line details in TV view (?tv=true) must always be dark theme
    const isTvMode = location.pathname.startsWith('/monitor') || 
                     (location.pathname.startsWith('/linea') && location.search.includes('tv=true'));
    
    if (isTvMode) {
      root.classList.add('dark-theme');
    } else {
      if (isDarkTheme) {
        root.classList.add('dark-theme');
      } else {
        root.classList.remove('dark-theme');
      }
    }
  }, [isDarkTheme, location.pathname, location.search]);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentClock(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitor database for understaffed alerts
  const checkActiveAlerts = async () => {
    const { data: lines } = await supabase.from('lineas').select('*');
    if (lines) {
      const incomplete = lines.filter((l: any) => l.status === 'FALTA PERSONAL').map((l: any) => l.name);
      setSystemAlerts(incomplete);
    }
  };

  useEffect(() => {
    checkActiveAlerts();
    
    // Subscribe to DB triggers
    const channel = supabase.channel('app-global-alerts')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        checkActiveAlerts();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <Routes>
      {/* Route for TV Monitor View */}
      <Route path="/monitor" element={<TvDashboard />} />

      {/* Route for Detailed Line View */}
      <Route path="/linea/:lineId" element={<LineDetailsModal />} />

      {/* Route for Executive Dashboard with Main Header */}
      <Route
        path="/dashboard"
        element={
          <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#050B18] text-slate-800 dark:text-slate-100 transition-colors duration-300">
            
            {/* 1. TOP POWER BI / MES TITLE BAR */}
            <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-20">
              
              {/* Brand logo & Shift Info */}
              <div className="flex items-center space-x-3.5">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  <span className="text-white font-black text-lg font-mono">LP</span>
                </div>
                <div>
                  <span className="text-lg font-black tracking-widest text-slate-100">LINEPULSE</span>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">MES Executive Dashboard</span>
                </div>
              </div>

              {/* Dynamic Warning ticker */}
              {systemAlerts.length > 0 && (
                <div className="hidden lg:flex items-center space-x-2 bg-red-950/60 border border-red-500/20 px-3 py-1 rounded-lg text-red-400 text-xs animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span>Alerta: <strong>{systemAlerts.join(', ')}</strong></span>
                </div>
              )}

              {/* Page Toggles & Utility tools */}
              <div className="flex items-center space-x-3">
                
                {/* Profile Role Selector */}
                <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-xl">
                  <User className="w-3.5 h-3.5 text-slate-450" />
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as any)}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-300 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="admin">Administrador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                </div>

                {/* Configurator button (Admin & Supervisor ONLY) */}
                {(userRole === 'admin' || userRole === 'supervisor') && (
                  <button
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center gap-1 bg-slate-850 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    title="Panel de Configuración de Planta"
                  >
                    <Settings className="w-3.5 h-3.5 text-emerald-450" />
                    <span>Configuración</span>
                  </button>
                )}

                {/* Executive & TV view toggles */}
                <div className="bg-slate-950 p-1 border border-slate-800 rounded-lg flex space-x-1">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all bg-emerald-600 text-white shadow-sm cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ejecutivo</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/monitor')}
                    className="text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Monitor TV</span>
                  </button>
                </div>

                {/* Scanner Drawer simulator trigger */}
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1 bg-slate-850 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-450" />
                  <span>Simular Gafete</span>
                </button>

                {/* Clock Ticker */}
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-350 font-mono font-bold bg-slate-950 border border-slate-850 px-2.5 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-emerald-450" />
                  <span>{currentClock || '--:--:--'}</span>
                </div>

                {/* Light/Dark Toggle */}
                <button
                  onClick={() => setIsDarkTheme(!isDarkTheme)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
                  title="Cambiar Tema"
                >
                  {isDarkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                </button>

              </div>
            </header>

            {/* 2. EXECUTIVE DASHBOARD MAIN VIEWPORT */}
            <main className="flex-grow p-4 overflow-hidden flex flex-col min-h-0">
              <ExecutiveDashboard />
            </main>

            {/* 3. COLLAPSIBLE SCANNING SIMULATION DRAWER */}
            <ScannerDrawer 
              isOpen={isScannerOpen} 
              onClose={() => setIsScannerOpen(false)} 
            />

            {/* 4. CONFIGURATION SETTINGS MODAL */}
            <ConfigurationModal
              isOpen={isConfigOpen}
              onClose={() => setIsConfigOpen(false)}
              userRole={userRole}
            />

          </div>
        }
      />

      {/* Fallback to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

