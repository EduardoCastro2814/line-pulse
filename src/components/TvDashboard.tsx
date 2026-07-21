import React, { useEffect, useState } from 'react';
import { supabase, calculateLineMetrics, mapScanFromSupabase, getDonutColor, getLineIntegrationTimeMinutes, getLocalDateString, getCurrentShift } from '../lib/supabaseClient';
import { Clock, Maximize, Minimize, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LargeDonutGauge: React.FC<{ percentage: number; color: string; present: number; target: number }> = ({
  percentage,
  color,
  present,
  target
}) => {
  const size = 100;
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0 my-1">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth="8"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-black font-mono leading-none" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-xs font-mono font-black text-slate-700 mt-1">
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
      <main className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-3">
        <div className="w-full h-full flex flex-wrap gap-4 items-start justify-center overflow-y-auto content-start p-2">
          {lines.map((line: any) => {
            const metrics = calculateLineMetrics(line.id, posiciones, scans, []);
            const { 
              target, 
              scannedCount: present, 
              coveragePct: pct, 
              statusEmoji, 
              isCoverageActive
            } = metrics;

            const donutColor = getDonutColor(pct);
            const dtMin = getActiveDowntimeMinutes(line.id);
            const integrationMin = getLineIntegrationTimeMinutes(line, scans);

            // Responsive Card Dimensions
            let cardWidthClass = 'w-[300px] h-[235px]';
            if (lineCount > 16) {
              cardWidthClass = 'w-[250px] h-[210px] text-xs';
            } else if (lineCount > 10) {
              cardWidthClass = 'w-[280px] h-[225px]';
            }

            return (
              <div
                key={line.id}
                onClick={() => navigate(`/linea/${line.id}?tv=true`)}
                style={{ borderColor: donutColor }}
                className={`${cardWidthClass} bg-white border-2 hover:shadow-xl rounded-2xl transition-all flex flex-col justify-between p-4 cursor-pointer select-none relative overflow-hidden shrink-0 shadow-sm hover:scale-[1.01]`}
              >
                {/* 1. Nombre Línea */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{statusEmoji}</span>
                    <span className="text-lg font-black text-slate-900 uppercase tracking-wider font-mono truncate max-w-[190px]">
                      {line.name}
                    </span>
                  </div>
                  {isCoverageActive && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono tracking-wide bg-blue-100 text-blue-700 border border-blue-300">
                      COMEDOR
                    </span>
                  )}
                </div>

                {/* 2. Cobertura Donut Grande + 3. Escaneados / Plantilla (Inside Gauge) */}
                <div className="flex flex-col items-center justify-center">
                  <LargeDonutGauge
                    percentage={pct}
                    color={donutColor}
                    present={present}
                    target={target}
                  />
                </div>

                {/* 4. Estado + 5. Tiempo Integración */}
                <div className="flex justify-between items-center text-xs font-mono pt-2 border-t border-slate-100">
                  <span className="font-extrabold text-[11px] uppercase tracking-wide" style={{ color: donutColor }}>
                    {pct >= 100 ? '🟢 COMPLETO' : (pct >= 50 ? '🟡 PARCIAL' : '🔴 FALTANTES')}
                  </span>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1">
                      <span>Integración:</span>
                      <strong className="text-slate-900 font-mono font-black">{integrationMin}m</strong>
                    </span>
                    {dtMin > 0 && (
                      <span className="text-[9px] text-amber-700 font-extrabold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 mt-0.5">
                        T. Muerto: {dtMin}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* CINTA DE DEPURACIÓN EN VIVO (TEMPORAL) */}
      <footer className="bg-slate-900 text-slate-300 text-[10px] font-mono px-6 py-1.5 flex items-center justify-between border-t border-slate-700 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span>📅 <strong>Fecha Detectada:</strong> <span className="text-emerald-400">{getLocalDateString(new Date())}</span></span>
          <span>⏱️ <strong>Turno Detectado:</strong> <span className="text-emerald-400">{lines[0] ? getCurrentShift(lines[0], new Date()).shiftName : 'Turno 1'}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span>🔍 <strong>Escaneos en BD:</strong> <span className="text-amber-400">{scans.length}</span></span>
          <span>✅ <strong>Filtro:</strong> <span className="text-emerald-400">Estricto Hoy + Turno Activo</span></span>
        </div>
      </footer>

    </div>
  );
};
