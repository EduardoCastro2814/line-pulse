import React, { useEffect, useState } from 'react';
import { supabase, calculateLineMetrics, mapScanFromSupabase } from '../lib/supabaseClient';
import { Clock, Maximize, Minimize, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TvDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);
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
      const { data: linesData } = await supabase.from('lineas').select('*').order('name', { ascending: true });
      const { data: scansData } = await supabase.from('escaneos').select('*');
      const { data: dtData } = await supabase.from('tiempos_muertos').select('*');

      let posData: any[] = [];
      const resPos = await supabase.from('posiciones').select('*');
      if (resPos.data && resPos.data.length > 0) {
        posData = resPos.data;
      } else {
        const resLinePos = await supabase.from('line_positions').select('*');
        posData = resLinePos.data || [];
      }

      setLines(linesData || []);
      setScans((scansData || []).map(mapScanFromSupabase));
      setDowntimes(dtData || []);
      setPosiciones(posData);
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

  const getActiveDowntimeMinutes = (lineId: string) => {
    const activeDt = downtimes.find((dt: any) => dt.line_id === lineId && !dt.resolved);
    if (!activeDt) return 0;
    const elapsedMs = new Date().getTime() - new Date(activeDt.start_time).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  };

  // Counts for top summary using UNIFIED calculateLineMetrics helper
  let countComplete = 0;
  let countInProgress = 0;
  let countCritical = 0;

  lines.forEach((line: any) => {
    const { coveragePct, isCoverageActive } = calculateLineMetrics(line.id, posiciones, scans, []);
    
    if (isCoverageActive || coveragePct >= 100) {
      countComplete++;
    } else if (coveragePct > 0) {
      countInProgress++;
    } else {
      countCritical++;
    }
  });

  // Responsive layout scaling calculation to guarantee NO vertical scrollbar
  const lineCount = lines.length;

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

      {/* 2. CORPORATE LIGHT TV GRID OF LINES (FIXED SIZE CARDS & AUTO-SCALING FOR ZERO SCROLLBAR) */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-2">
        <div className="w-full h-full flex flex-wrap gap-4 items-start justify-center overflow-hidden content-start">
          {lines.map((line: any) => {
            const metrics = calculateLineMetrics(line.id, posiciones, scans, []);
            const { 
              target, 
              scannedCount: present, 
              coveragePct: pct, 
              statusColor, 
              statusBadgeText, 
              statusEmoji, 
              isCoverageActive, 
              activeShiftName 
            } = metrics;

            const dtMin = getActiveDowntimeMinutes(line.id);

            // Responsive Scaling classes based on total line count to prevent scroll
            let cardWidthClass = 'w-[320px] h-[210px]';
            if (lineCount > 16) {
              cardWidthClass = 'w-[260px] h-[170px] text-xs';
            } else if (lineCount > 10) {
              cardWidthClass = 'w-[290px] h-[190px]';
            }

            return (
              <div
                key={line.id}
                onClick={() => navigate(`/linea/${line.id}?tv=true`)}
                style={{ borderColor: `${statusColor}` }}
                className={`${cardWidthClass} bg-white border-2 hover:shadow-lg rounded-2xl transition-all flex flex-col justify-between p-4 cursor-pointer select-none relative overflow-hidden shrink-0 shadow-sm`}
              >
                {/* Top Header: Status Emoji, Name & Status Badge */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{statusEmoji}</span>
                      <span className="text-base font-black text-slate-900 uppercase tracking-wider font-mono truncate max-w-[160px]">
                        {line.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                      {activeShiftName}
                    </span>
                  </div>

                  <span 
                    className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono tracking-wide"
                    style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}
                  >
                    {isCoverageActive ? 'COMEDOR' : statusBadgeText}
                  </span>
                </div>

                {/* Center: Large KPI Compliance & Counts */}
                <div className="my-1 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-3xl font-black text-slate-900">{present}</span>
                    <span className="text-xs text-slate-400 font-bold">/ {target} op</span>
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

                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-0.5">
                    <span className="font-bold text-slate-400">TIEMPO MUERTO:</span>
                    {dtMin > 0 ? (
                      <span className="text-amber-700 font-extrabold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        {dtMin} min
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-400">0 min</span>
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
