import React, { useEffect, useState } from 'react';
import { supabase, calculateLineMetrics, mapScanFromSupabase, getDonutColor } from '../lib/supabaseClient';
import { Clock, Maximize, Minimize, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SmallCircularGauge: React.FC<{ percentage: number; color: string; present: number; target: number }> = ({
  percentage,
  color,
  present,
  target
}) => {
  const size = 66;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth="6"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xs font-black font-mono leading-none" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-[9px] font-mono font-extrabold text-slate-500 mt-0.5">
          {present}/{target}
        </span>
      </div>
    </div>
  );
};

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
      const { data: linesData } = await supabase.from('lineas').select('*, area:areas(*)').order('name');
      setLines(linesData || []);

      const { data: scansData } = await supabase.from('escaneos').select('*');
      const mappedScans = (scansData || []).map(mapScanFromSupabase);
      setScans(mappedScans);

      const { data: dtData } = await supabase.from('tiempos_muertos').select('*');
      setDowntimes(dtData || []);

      const { data: posData } = await supabase.from('posiciones').select('*');
      setPosiciones(posData || []);
    } catch (err) {
      console.error('Error loading TvDashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel('tv-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escaneos' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posiciones' }, () => loadData())
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const getActiveDowntimeMinutes = (lineId: string) => {
    const active = downtimes.find(d => d.line_id === lineId && !d.resolved);
    if (!active) return 0;
    const start = new Date(active.start_time).getTime();
    const now = new Date().getTime();
    return Math.max(1, Math.floor((now - start) / 60000));
  };

  const lineCount = lines.length;

  return (
    <div className="fixed inset-0 bg-[#F5F7FA] flex flex-col font-sans select-none overflow-hidden">
      
      {/* 1. TOP LIGHT HEADER BAR */}
      <header className="h-14 bg-[#005486] text-white px-6 flex items-center justify-between border-b border-[#00426a] shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-base font-black tracking-wider uppercase font-mono">
            LinePulse — Monitor Andon Operativo
          </h1>
          <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full font-mono text-white/90">
            {lineCount} líneas activas
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
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
      <main className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-2">
        <div className="w-full h-full flex flex-wrap gap-4 items-start justify-center overflow-hidden content-start">
          {lines.map((line: any) => {
            const metrics = calculateLineMetrics(line.id, posiciones, scans, []);
            const { 
              target, 
              scannedCount: present, 
              coveragePct: pct, 
              statusBadgeText, 
              statusEmoji, 
              isCoverageActive, 
              activeShiftName 
            } = metrics;

            const donutColor = getDonutColor(pct);
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
                style={{ borderColor: donutColor }}
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
                    style={{ backgroundColor: `${donutColor}15`, color: donutColor, border: `1px solid ${donutColor}40` }}
                  >
                    {isCoverageActive ? 'COMEDOR' : statusBadgeText}
                  </span>
                </div>

                {/* Center: Donut Gauge + Operator Counts */}
                <div className="my-1 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-3xl font-black text-slate-900">{present}</span>
                      <span className="text-xs text-slate-400 font-bold">/ {target} op</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase font-mono block mt-1" style={{ color: donutColor }}>
                      {pct >= 100 ? '🟢 COMPLETO' : (pct >= 50 ? '🟡 PARCIAL' : '🔴 FALTANTES')}
                    </span>
                  </div>

                  <SmallCircularGauge
                    percentage={pct}
                    color={donutColor}
                    present={present}
                    target={target}
                  />
                </div>

                {/* Bottom Downtime Footer */}
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100">
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
            );
          })}
        </div>
      </main>

    </div>
  );
};
