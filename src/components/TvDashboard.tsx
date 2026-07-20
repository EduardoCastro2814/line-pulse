import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { Clock, Maximize, Minimize, LayoutDashboard, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TvDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  const [currentClock, setCurrentClock] = useState('');
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentClock(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  const loadData = async () => {
    try {
      const { data: linesData } = await supabase.from('lineas').select('*');
      const { data: scansData } = await supabase.from('escaneos').select('*');
      const { data: dtData } = await supabase.from('tiempos_muertos').select('*');

      setLines(linesData || []);
      setScans(scansData || []);
      setDowntimes(dtData || []);
    } catch (err) {
      console.warn('Handling empty database query in TvDashboard:', err);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel('tv-dashboard-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const getPresentOperatorsCount = (lineId: string) => {
    const lineScans = scans.filter((s: any) => s.line_id === lineId && s.was_successful);
    const lastEventMap: Record<string, string> = {};
    lineScans
      .sort((a: any, b: any) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
      .forEach((scan: any) => {
        lastEventMap[scan.badge_id] = scan.event_type;
      });

    return Object.values(lastEventMap).filter(
      type => type === 'shift_start' || type === 'lunch_return'
    ).length;
  };

  const getActiveDowntimeMinutes = (lineId: string) => {
    const activeDt = downtimes.find((dt: any) => dt.line_id === lineId && !dt.resolved);
    if (!activeDt) return 0;
    const elapsedMs = new Date().getTime() - new Date(activeDt.start_time).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  };

  // Counts for top summary
  let countComplete = 0;
  let countInProgress = 0;
  let countCritical = 0;

  lines.forEach((line: any) => {
    const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
    const present = getPresentOperatorsCount(line.id);
    const pct = target > 0 ? Math.round((present / target) * 100) : 0;
    
    if (isCoverageActive || pct >= 100) {
      countComplete++;
    } else if (pct >= 80) {
      countInProgress++;
    } else {
      countCritical++;
    }
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F7FA] text-slate-800 font-sans select-none p-4 space-y-4">
      
      {/* 1. TOP CORPORATE TV HEADER (#005486) */}
      <header className="h-16 shrink-0 bg-[#005486] border border-[#00426a] rounded-2xl flex items-center justify-between px-6 shadow-md text-white">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center shadow-inner">
            <span className="text-white font-black text-xl font-mono">LP</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest uppercase text-white font-sans">MONITOR DE PLANTA ANDON</h1>
            <span className="block text-[9px] text-white/70 font-bold uppercase tracking-wider">LinePulse Corporate Floor Display</span>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center space-x-6 text-xs font-mono font-bold">
          <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-white">COMPLETAS: {countComplete}</span>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-white">ATENCIÓN: {countInProgress}</span>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span className="text-white">FALTANTES: {countCritical}</span>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center space-x-1.5 text-xs text-white font-mono font-bold bg-black/15 border border-white/10 px-3 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-emerald-300" />
            <span>{currentClock || '--:--:--'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. CORPORATE LIGHT TV GRID OF LINES */}
      <main className="flex-grow min-h-0 w-full overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 h-full w-full overflow-y-auto pr-1">
          {lines.map((line: any) => {
            const { target, isCoverageActive, activeShiftName } = getActiveStaffingTarget(line.id);
            const present = getPresentOperatorsCount(line.id);
            const pct = target > 0 ? Math.round((present / target) * 100) : 0;
            const dtMin = getActiveDowntimeMinutes(line.id);

            // Color Rules:
            // 🟢 VERDE (#22C55E): 100%
            // 🟡 AMARILLO (#EAB308): 80% - 99%
            // 🔴 ROJO (#EF4444): < 80%
            // 🔵 AZUL (#3B82F6): Cobertura Comedor
            let statusColor = '#EF4444';
            let statusEmoji = '🔴';

            if (isCoverageActive && present >= target) {
              statusColor = '#3B82F6';
              statusEmoji = '🔵';
            } else if (pct >= 100) {
              statusColor = '#22C55E';
              statusEmoji = '🟢';
            } else if (pct >= 80) {
              statusColor = '#EAB308';
              statusEmoji = '🟡';
            }

            return (
              <div
                key={line.id}
                onClick={() => navigate(`/linea/${line.id}?tv=true`)}
                style={{ borderColor: `${statusColor}` }}
                className="bg-white border-2 hover:shadow-md p-4 rounded-2xl transition-all flex flex-col justify-between cursor-pointer select-none relative overflow-hidden"
              >
                {/* Top: Name & Shift */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{statusEmoji}</span>
                      <span className="text-base font-black text-slate-900 uppercase tracking-wider font-mono">
                        {line.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                      {activeShiftName}
                    </span>
                  </div>

                  {isCoverageActive && (
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                      <Utensils className="w-3 h-3" />
                      Comedor
                    </span>
                  )}
                </div>

                {/* Center: Large KPI Compliance Ring / Text */}
                <div className="my-3 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-3xl font-black text-slate-900">{present}</span>
                    <span className="text-sm text-slate-400 font-semibold">/ {target} op</span>
                  </div>

                  <span className="text-3xl font-black font-mono" style={{ color: statusColor }}>
                    {pct}%
                  </span>
                </div>

                {/* Bottom Progress Bar & Downtime */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: statusColor }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 pt-1">
                    <span>Tiempo Muerto:</span>
                    {dtMin > 0 ? (
                      <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {dtMin} min
                      </span>
                    ) : (
                      <span>0 min</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

    </div>
  );
};
