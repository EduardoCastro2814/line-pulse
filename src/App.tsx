import { useState, useEffect } from 'react';
import { Monitor, LayoutDashboard, Clock, AlertTriangle, Settings, User } from 'lucide-react';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { TvDashboard } from './components/TvDashboard';
import { LineDetailsModal } from './components/LineDetailsModal';
import { ScannerDrawer } from './components/ScannerDrawer';
import { ConfigurationModal } from './components/ConfigurationModal';
import { supabase } from './lib/supabaseClient';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();

  const [currentClock, setCurrentClock] = useState('');
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);
  const [isScannerOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
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

      {/* Route for Corporate Executive Dashboard with Main Header */}
      <Route
        path="/dashboard"
        element={
          <div className="flex flex-col h-screen overflow-hidden bg-[#F5F7FA] text-slate-800 font-sans select-none">
            
            {/* 1. CORPORATE HEADER BAR (#005486) */}
            <header className="h-14 shrink-0 bg-[#005486] border-b border-[#00426a] flex items-center justify-between px-6 z-20 shadow-md">
              
              {/* Brand logo & App Title */}
              <div className="flex items-center space-x-3.5">
                <div className="w-8 h-8 bg-white/15 border border-white/20 rounded-lg flex items-center justify-center shadow-inner">
                  <span className="text-white font-black text-lg font-mono">LP</span>
                </div>
                <div>
                  <span className="text-lg font-black tracking-widest text-white uppercase font-sans">LINEPULSE</span>
                  <span className="block text-[9px] text-white/70 font-bold uppercase tracking-wider font-sans">Operations & MES Platform</span>
                </div>
              </div>

              {/* Dynamic Alert Ticker */}
              {systemAlerts.length > 0 && (
                <div className="hidden lg:flex items-center space-x-2 bg-red-600/20 border border-red-200/30 px-3 py-1 rounded-lg text-white text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                  <span>Alerta: <strong>{systemAlerts.join(', ')}</strong></span>
                </div>
              )}

              {/* Navigation & Controls */}
              <div className="flex items-center space-x-3">
                
                {/* Dashboard & Monitor Navigation Switcher */}
                <div className="bg-black/15 p-1 border border-white/10 rounded-xl flex space-x-1">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all bg-white text-[#005486] shadow-sm cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/monitor')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Monitor</span>
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

                {/* Configuration button (Admin & Supervisor ONLY) */}
                {(userRole === 'admin' || userRole === 'supervisor') && (
                  <button
                    onClick={() => setIsConfigOpen(true)}
                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    title="Panel de Configuración de Planta"
                  >
                    <Settings className="w-3.5 h-3.5 text-white" />
                    <span>Configuración</span>
                  </button>
                )}

                {/* Digital Clock Ticker ONLY */}
                <div className="hidden sm:flex items-center space-x-1.5 text-xs text-white font-mono font-bold bg-black/15 border border-white/10 px-3 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{currentClock || '--:--:--'}</span>
                </div>

              </div>
            </header>

            {/* 2. CORPORATE DASHBOARD MAIN VIEWPORT */}
            <main className="flex-grow p-4 overflow-hidden flex flex-col min-h-0">
              <ExecutiveDashboard />
            </main>

            {/* 3. SCANNER DRAWER */}
            <ScannerDrawer 
              isOpen={isScannerOpen} 
              onClose={() => {}} 
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
